import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabularInput } from './useTabularInput';
import * as parseTabularModule from './parseTabular';
import * as legacyAdaptersModule from './legacyAdapters';
import type { TabularImportSummary } from './importDiagnostics';
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

const TEST_IMPORT_SUMMARY: TabularImportSummary = {
  sourceType: 'file',
  fileName: 'dados.csv',
  tableName: 'Tabela',
  sheetNames: [],
  formatLabel: 'texto',
  delimiter: ',',
  rowCount: 1,
  columnCount: 2,
  headerRowNumber: 1,
  recognitionMode: 'aliases',
  recognitionDetails: [],
  diagnostics: [],
  importWarnings: [],
};

function makeLoadedState(overrides: Partial<TabularLoadedState> = {}): TabularLoadedState {
  const { summary = TEST_IMPORT_SUMMARY, ...stateOverrides } = overrides;
  return {
    status: 'loaded',
    summary,
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
    ...stateOverrides,
  };
}

function makeDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function deferNextFileRead() {
  const gate = makeDeferred<void>();
  const readFileText = legacyAdaptersModule.legacyUtils.readFileText;
  const readFileTextSpy = vi.spyOn(legacyAdaptersModule.legacyUtils, 'readFileText');
  readFileTextSpy.mockImplementationOnce(async (file) => {
    await gate.promise;
    return readFileText(file);
  });
  return { gate, readFileTextSpy };
}

describe('useTabularInput', () => {
  it('forwards source import warnings and clears them on a new source', async () => {
    const warning = { code: 'formula-without-cache' as const, rowNumber: 3, columnIndex: 0, cellReference: 'A3', message: 'Fórmula sem cache.' };
    vi.mocked(parseTabularModule.readTabularFileState).mockResolvedValueOnce(makeLoadedState({ importWarnings: [warning] }));
    const { result } = renderHook(() => useTabularInput());
    await act(async () => result.current.setFile(new File(['x'], 'dados.xlsx')));
    expect(result.current.importWarnings).toEqual([warning]);
    act(() => result.current.setRawText('A;B\n1;2'));
    expect(result.current.importWarnings ?? []).toEqual([]);
  });
  it('surfaces a synchronous paste parser failure without escaping the debounce', () => {
    const { result } = renderHook(() => useTabularInput());
    act(() => result.current.setRawText('A;B\n"incompleto;2'));
    expect(() => act(() => vi.advanceTimersByTime(200))).not.toThrow();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toMatch(/aspas/i);
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it('lets a file replace pasted input while the paste debounce is pending', async () => {
    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File(['Município;Taxa por 100k\nArquivo;2'], 'arquivo.csv', { type: 'text/csv' });
    const { gate, readFileTextSpy } = deferNextFileRead();

    act(() => {
      result.current.setRawText('Município;Taxa por 100k\nColado;1');
    });
    let filePromise!: Promise<void>;
    act(() => {
      filePromise = result.current.setFile(file);
    });
    gate.resolve();
    await act(async () => {
      await filePromise;
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.headers).toEqual(['Município', 'Taxa por 100k']);
    expect(result.current.bodyRows).toEqual([['Arquivo', '2']]);
    expect(readFileTextSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps pasted input when a deferred file resolves after it', async () => {
    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File(['Município;Taxa por 100k\nArquivo;2'], 'arquivo.csv', { type: 'text/csv' });
    const { gate } = deferNextFileRead();
    let filePromise!: Promise<void>;
    act(() => {
      filePromise = result.current.setFile(file);
    });

    act(() => {
      result.current.setRawText('Município;Taxa por 100k\nColado;1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(result.current.bodyRows).toEqual([['Colado', '1']]);

    gate.resolve();
    await act(async () => {
      await filePromise;
    });

    expect(result.current.headers).toEqual(['Município', 'Taxa por 100k']);
    expect(result.current.bodyRows).toEqual([['Colado', '1']]);
  });

  it('keeps the idle state when a deferred file resolves after reset', async () => {
    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File(['Município;Taxa por 100k\nArquivo;2'], 'arquivo.csv', { type: 'text/csv' });
    const { gate } = deferNextFileRead();
    let filePromise!: Promise<void>;
    act(() => {
      filePromise = result.current.setFile(file);
    });

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.headers).toEqual([]);
    expect(result.current.bodyRows).toEqual([]);

    gate.resolve();
    await act(async () => {
      await filePromise;
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.headers).toEqual([]);
    expect(result.current.bodyRows).toEqual([]);
  });

  it('does not commit a deferred file after unmount', async () => {
    const hook = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File(['Município;Taxa por 100k\nArquivo;2'], 'arquivo.csv', { type: 'text/csv' });
    const { gate } = deferNextFileRead();
    let filePromise!: Promise<void>;
    act(() => {
      filePromise = hook.result.current.setFile(file);
    });

    hook.unmount();
    gate.resolve();
    await act(async () => {
      await filePromise;
    });

    expect(hook.result.current.status).toBe('parsing');
    expect(hook.result.current.headers).toEqual([]);
    expect(hook.result.current.bodyRows).toEqual([]);
  });

  it('ignores a stale file failure after pasted input has loaded', async () => {
    const { result } = renderHook(() => useTabularInput(commaAmbiguousOptions));
    const file = new File(['Município;Taxa por 100k\nArquivo;2'], 'arquivo.csv', { type: 'text/csv' });
    const { gate } = deferNextFileRead();
    let filePromise!: Promise<void>;
    act(() => {
      filePromise = result.current.setFile(file);
    });

    act(() => {
      result.current.setRawText('Município;Taxa por 100k\nColado;1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(result.current.status).toBe('loaded');

    gate.reject(new Error('leitura falhou'));
    await act(async () => {
      await filePromise;
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.bodyRows).toEqual([['Colado', '1']]);
    expect(result.current.error).toBeNull();
  });

  it('invalidates pending file work through StrictMode cleanup', async () => {
    const hook = renderHook(() => useTabularInput(commaAmbiguousOptions), { reactStrictMode: true });
    const file = new File(['Município;Taxa por 100k\nArquivo;2'], 'arquivo.csv', { type: 'text/csv' });
    const { gate } = deferNextFileRead();
    let filePromise!: Promise<void>;
    act(() => {
      filePromise = hook.result.current.setFile(file);
    });

    hook.unmount();
    gate.resolve();
    await act(async () => {
      await filePromise;
    });

    expect(hook.result.current.status).toBe('parsing');
    expect(hook.result.current.headers).toEqual([]);
  });
});
