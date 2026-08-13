import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import gzip from 'node:zlib';
import {
  clearPartitionCache,
  loadMunicipioPartition,
  type MunicipioPartition,
} from './loadMunicipioPartition';

const SUPABASE_URL = 'https://exemplo.supabase.co';
const BASE = `${SUPABASE_URL}/storage/v1/object/public/sih-municipio/v1/`;

// Mesma fixture real que o produtor Python (partitions.py, Task 1) grava e testa contra --
// produtor e consumidor são provados contra o mesmo byte (D-20/D-21).
const FIXTURE_PATH = resolve(
  process.cwd(),
  'pipeline/sih/tests/fixtures/particao_exemplo.json.gz',
);

function fixtureGzipBuffer(): ArrayBuffer {
  // ArrayBuffer puro (não Blob, não Uint8Array direto): o Blob do polyfill jsdom corrompe bytes
  // binários (bug observado ao vivo -- "incorrect header check" do gunzip, achado nesta task);
  // Uint8Array<ArrayBufferLike> não é aceito estruturalmente pelo BodyInit do lib.dom.d.ts
  // instalado. `new Uint8Array(buffer)` copia para um ArrayBuffer novo do tamanho exato --
  // nunca a view compartilhada/paginada que `Buffer` pode ter internamente.
  return new Uint8Array(readFileSync(FIXTURE_PATH)).buffer as ArrayBuffer;
}

function fixtureJson(): MunicipioPartition {
  const raw = gzip.gunzipSync(readFileSync(FIXTURE_PATH));
  return JSON.parse(raw.toString('utf-8')) as MunicipioPartition;
}

describe('loadMunicipioPartition', () => {
  beforeEach(() => {
    clearPartitionCache();
    vi.stubEnv('VITE_SUPABASE_URL', SUPABASE_URL);
  });

  afterEach(() => {
    clearPartitionCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubFetchWithFixture() {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url !== `${BASE}AC.json.gz`) {
        return new Response(null, { status: 404 });
      }
      return new Response(fixtureGzipBuffer(), { status: 200 });
    });
  }

  it('loads columnar data with coherent column/row lengths from the real fixture (AC)', async () => {
    vi.stubGlobal('fetch', stubFetchWithFixture());

    const partition = await loadMunicipioPartition('AC');
    const esperado = fixtureJson();

    expect(partition.schema).toBe(esperado.schema);
    expect(partition.uf).toBe('AC');
    expect(partition.colunas).toEqual(esperado.colunas);
    expect(partition.dados).toHaveLength(partition.colunas.length);
    for (const coluna of partition.dados) {
      expect(coluna).toHaveLength(partition.dados[0].length);
    }
    expect(partition.dados[0].length).toBeGreaterThan(0);
  });

  it('reuses the in-memory cache on a second call for the same UF (no second fetch)', async () => {
    const fetchMock = stubFetchWithFixture();
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadMunicipioPartition('AC');
    const second = await loadMunicipioPartition('AC');

    expect(second).toBe(first);
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it('clearPartitionCache forces the next call to fetch again', async () => {
    const fetchMock = stubFetchWithFixture();
    vi.stubGlobal('fetch', fetchMock);

    await loadMunicipioPartition('AC');
    expect(fetchMock.mock.calls.length).toBe(1);

    clearPartitionCache();
    await loadMunicipioPartition('AC');
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('concurrent calls for the same UF share a single fetch (cache stores the promise, T-09-35)', async () => {
    const fetchMock = stubFetchWithFixture();
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([
      loadMunicipioPartition('AC'),
      loadMunicipioPartition('AC'),
    ]);

    expect(a).toBe(b);
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it('throws an error naming the UF and the HTTP status on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    await expect(loadMunicipioPartition('AC')).rejects.toThrow(/AC/);
    await expect(loadMunicipioPartition('AC')).rejects.toThrow(/503/);
  });

  it('throws when the response has no body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const res = new Response(fixtureGzipBuffer(), { status: 200 });
        Object.defineProperty(res, 'body', { value: null });
        return res;
      }),
    );

    await expect(loadMunicipioPartition('AC')).rejects.toThrow(/corpo de resposta/);
  });

  it('throws before any fetch when VITE_SUPABASE_URL is not configured (no valid prefix exists)', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_SUPABASE_URL', undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadMunicipioPartition('AC')).rejects.toThrow(/VITE_SUPABASE_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws for a DATASUS/IBGE host even when the (misconfigured) prefix would match', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://tabnet.datasus.gov.br');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadMunicipioPartition('AC')).rejects.toThrow(/DATASUS\/IBGE/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed UF sigla before any fetch (path-traversal guard, ASVS V13)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadMunicipioPartition('../evil')).rejects.toThrow(/sigla de UF inválida/);
    await expect(loadMunicipioPartition('ac')).rejects.toThrow(/sigla de UF inválida/);
    await expect(loadMunicipioPartition('ACR')).rejects.toThrow(/sigla de UF inválida/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('delivers taxa_mortalidade as null, never coerced to 0', async () => {
    const base = fixtureJson();
    const idx = base.colunas.indexOf('taxa_mortalidade');
    // A fixture real de AC (Task 1) não tem nenhuma linha com internacoes=0 -- toda Row
    // materializada tem >= 1 internação (mesmo achado do produtor Python). O contrato de
    // "ausência nunca vira 0" é provado com um payload sintético mínimo, mesma disciplina do
    // teste Python equivalente.
    const sintetico: MunicipioPartition = {
      ...base,
      dados: base.colunas.map((_coluna, i) => (i === idx ? [null] : [base.dados[i][0]])),
    };
    const corpo = new Uint8Array(gzip.gzipSync(Buffer.from(JSON.stringify(sintetico), 'utf-8')))
      .buffer as ArrayBuffer;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(corpo, { status: 200 })),
    );

    const partition = await loadMunicipioPartition('AC');
    expect(partition.dados[idx]).toEqual([null]);
    expect(partition.dados[idx]).not.toEqual([0]);
  });

  it('isolates caller abort while sharing the underlying same-UF fetch', async () => {
    let release: (() => void) | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        release = resolve;
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      });
      return new Response(fixtureGzipBuffer(), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = loadMunicipioPartition('AC', { signal: firstController.signal });
    const second = loadMunicipioPartition('AC', { signal: secondController.signal });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    firstController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).not.toBe(firstController.signal);
    release!();
    await expect(second).resolves.toMatchObject({ uf: 'AC' });
  });

  it('aborts the underlying fetch when its last consumer aborts and allows retry', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        await new Promise<void>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
            once: true,
          });
        });
      }
      return new Response(fixtureGzipBuffer(), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const stale = loadMunicipioPartition('AC', { signal: controller.signal });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
    await expect(loadMunicipioPartition('AC')).resolves.toMatchObject({ uf: 'AC' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
