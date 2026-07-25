import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabularInput } from './useTabularInput';
import * as parseTabularModule from './parseTabular';
import type { TabularInputOptions, TabularLoadedState } from './types';

// Wraps the real port with a spy so individual tests can override a single
// call (mockRejectedValueOnce/mockImplementationOnce) while every other call
// still exercises the real, unmocked parser.
vi.mock('./parseTabular', async () => {
  const actual = await vi.importActual<typeof import('./parseTabular')>('./parseTabular');
  return {
    ...actual,
    readTabularFileState: vi.fn(actual.readTabularFileState),
  };
});

const fixtureDir = join(__dirname, '../../test/fixtures/tabnet');
function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

const semicolonMetadataOptions: TabularInputOptions = {
  aliases: {
    uf: ['Unidade da Federação'],
    internacoes: ['Internações'],
    valor: ['Valor total'],
    taxa: ['Taxa de mortalidade'],
  },
  requiredKeys: ['uf', 'internacoes'],
  numericKeys: ['internacoes', 'valor', 'taxa'],
  expectedFormatLabel: 'Unidade da Federação; Internações; Valor total; Taxa de mortalidade',
};

const commaAmbiguousOptions: TabularInputOptions = {
  aliases: {
    municipio: ['Município'],
    taxa: ['Taxa por 100k'],
    situacao: ['Situação'],
  },
  requiredKeys: ['municipio', 'taxa'],
  numericKeys: ['taxa'],
  expectedFormatLabel: 'Município; Taxa por 100k; Situação',
};

function makeLoadedState(overrides: Partial<TabularLoadedState> = {}): TabularLoadedState {
  return {
    status: 'loaded',
    fileName: 'dados.csv',
    workbookKind: 'text',
    tableName: 'Tabela',
    formatLabel: 'texto',
    delimiter: ',',
    headerRowIndex: 0,
    headers: ['A', 'B'],
    bodyRows: [['1', '2']],
    recognizedColumns: {},
    duplicates: [],
    sheetNames: [],
    decimalCommaDetected: false,
    numericCellCount: 0,
    sourceType: 'file',
    recognitionMode: 'aliases',
    usedPositionalFallback: false,
    recognitionDetails: [],
    ...overrides,
  };
}

describe('useTabularInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(parseTabularModule.readTabularFileState).mockClear();
  });

  it('parses a pasted TABNET fixture into a loaded state after the debounce', () => {
    const { result } = renderHook(() => useTabularInput(semicolonMetadataOptions));

    act(() => {
      result.current.setRawText(readFixture('tabnet-semicolon-metadata.txt'));
    });
    expect(result.current.status).toBe('parsing');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.headers.length).toBeGreaterThan(0);
    expect(result.current.bodyRows.length).toBeGreaterThan(0);
    expect(result.current.recognizedColumns.uf).toBe(0);
  });

  it('reaches an error state with a non-empty details array for unrecognizable pasted text', () => {
    const { result } = renderHook(() => useTabularInput(semicolonMetadataOptions));

    act(() => {
      result.current.setRawText('palavraisolada');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.details.length).toBeGreaterThan(0);
  });

  it('returns to idle when the pasted text is cleared', () => {
    const { result } = renderHook(() => useTabularInput(semicolonMetadataOptions));

    act(() => {
      result.current.setRawText(readFixture('tabnet-semicolon-metadata.txt'));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.status).toBe('loaded');

    act(() => {
      result.current.setRawText('   ');
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.headers).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('resolves a real file to a loaded state via setFile', async () => {
    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File([readFixture('tabnet-comma-ambiguous.txt')], 'dados.csv', { type: 'text/csv' });

    await act(async () => {
      await result.current.setFile(file);
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.headers.length).toBeGreaterThan(0);
    expect(result.current.bodyRows.length).toBeGreaterThan(0);
  });

  it('setFile never throws and surfaces the Portuguese file-read copy when the parser call itself rejects', async () => {
    vi.mocked(parseTabularModule.readTabularFileState).mockRejectedValueOnce(new Error('leitura falhou'));
    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File(['x'], 'dados.csv', { type: 'text/csv' });

    await act(async () => {
      await expect(result.current.setFile(file)).resolves.toBeUndefined();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe(
      'Não foi possível ler este arquivo. Tente novamente ou cole os dados diretamente.',
    );
    expect(result.current.error?.details).toEqual(['leitura falhou']);
  });

  it('keeps only the latest of two overlapping setFile calls in state', async () => {
    let resolveSlow: (value: TabularLoadedState) => void = () => {};
    const slow = new Promise<TabularLoadedState>((resolve) => {
      resolveSlow = resolve;
    });

    vi.mocked(parseTabularModule.readTabularFileState)
      .mockImplementationOnce(() => slow)
      .mockImplementationOnce(async () => makeLoadedState({ headers: ['FAST'] }));

    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const slowFile = new File(['slow'], 'slow.csv');
    const fastFile = new File(['fast'], 'fast.csv');

    let slowPromise!: Promise<void>;
    await act(async () => {
      slowPromise = result.current.setFile(slowFile);
      await result.current.setFile(fastFile);
    });

    expect(result.current.headers).toEqual(['FAST']);

    await act(async () => {
      resolveSlow(makeLoadedState({ headers: ['SLOW'] }));
      await slowPromise;
    });

    // The stale slow response must not overwrite the later fast one.
    expect(result.current.headers).toEqual(['FAST']);
  });
});
