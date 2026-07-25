import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as legacyAdapters from './legacyAdapters';
import { useDatasusWizard } from './useDatasusWizard';

vi.mock('./legacyAdapters', async () => {
  const actual = await vi.importActual<typeof import('./legacyAdapters')>('./legacyAdapters');
  return {
    ...actual,
    legacyUtils: {
      ...actual.legacyUtils,
      readFileText: vi.fn(actual.legacyUtils.readFileText),
    },
  };
});

const fixtureDir = join(__dirname, '../../test/fixtures/tabnet');

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

describe('useDatasusWizard', () => {
  afterEach(() => {
    vi.mocked(legacyAdapters.legacyUtils.readFileText).mockReset();
  });

  it('starts with the legacy Portuguese status message', () => {
    const { result } = renderHook(() => useDatasusWizard());
    expect(result.current.status.message).toBe('Importe um ou mais arquivos DATASUS para iniciar o assistente.');
    expect(result.current.status.tone).toBe('status');
  });

  it('addTextSources with metadata fixture creates one active source with mapping columns', async () => {
    const { result } = renderHook(() => useDatasusWizard());

    await act(async () => {
      await result.current.addTextSources([
        { rawText: readFixture('tabnet-semicolon-metadata.txt'), fileName: 'tabnet-semicolon-metadata.txt' },
      ]);
    });

    expect(result.current.sources).toHaveLength(1);
    expect(result.current.activeSource?.fileName).toBe('tabnet-semicolon-metadata.txt');
    expect(result.current.activeSource?.mapping?.columns.length).toBeGreaterThan(0);
  });

  it('setHeaderRow changes detected headers and resets confirmed', async () => {
    const { result } = renderHook(() => useDatasusWizard());

    await act(async () => {
      await result.current.addTextSources([
        { rawText: readFixture('tabnet-semicolon-metadata.txt'), fileName: 'metadata.txt' },
      ]);
    });

    const sourceId = result.current.activeSource!.id;
    const initialHeaderRow = result.current.activeSource!.parsed!.headerRowIndex;

    await act(async () => {
      result.current.confirmSource(sourceId);
    });
    expect(result.current.activeSource!.confirmed).toBe(true);

    const alternateRow = initialHeaderRow === 0 ? 1 : 0;
    const headersBefore = [...(result.current.activeSource!.parsed!.headers ?? [])];

    await act(async () => {
      result.current.setHeaderRow(sourceId, alternateRow);
    });

    expect(result.current.activeSource!.confirmed).toBe(false);
    expect(result.current.activeSource!.parsed!.headerRowIndex).toBe(alternateRow);
    if (headersBefore.length > 0) {
      expect(result.current.activeSource!.parsed!.headers).not.toEqual(headersBefore);
    }
  });

  it('setColumnRole to ignore removes the column from normalized schema', async () => {
    const { result } = renderHook(() => useDatasusWizard());

    await act(async () => {
      await result.current.addTextSources([
        { rawText: readFixture('tabnet-semicolon-metadata.txt'), fileName: 'metadata.txt' },
      ]);
    });

    const sourceId = result.current.activeSource!.id;
    const targetColumn = result.current.activeSource!.mapping!.columns.find((column) => column.role === 'measure');
    expect(targetColumn).toBeDefined();

    const metricCountBefore = result.current.activeSource!.normalized!.schema.metricOptions.length;

    await act(async () => {
      result.current.setColumnRole(sourceId, targetColumn!.index, 'ignore');
    });

    const ignored = result.current.activeSource!.mapping!.columns.find((column) => column.index === targetColumn!.index);
    expect(ignored?.role).toBe('ignore');
    expect(result.current.activeSource!.normalized!.schema.metricOptions.length).toBeLessThan(metricCountBefore);
  });

  it('confirmSource is refused while normalized.ok is false', async () => {
    const { result } = renderHook(() => useDatasusWizard());

    await act(async () => {
      await result.current.addTextSources([{ rawText: 'linha invalida sem estrutura', fileName: 'invalid.txt' }]);
    });

    const sourceId = result.current.sources[0]?.id;
    if (!sourceId) return;

    if (!result.current.activeSource!.normalized!.ok) {
      await act(async () => {
        result.current.confirmSource(sourceId);
      });
      expect(result.current.activeSource!.confirmed).toBe(false);
      expect(result.current.session.confirmedSources).toHaveLength(0);
    }
  });

  it('confirmSource accepts a valid mapping and fires onSessionChange', async () => {
    const onSessionChange = vi.fn();
    const { result } = renderHook(() => useDatasusWizard({ onSessionChange }));

    await act(async () => {
      await result.current.addTextSources([
        { rawText: readFixture('tabnet-semicolon-metadata.txt'), fileName: 'metadata.txt' },
      ]);
    });

    const sourceId = result.current.activeSource!.id;
    expect(result.current.activeSource!.normalized!.ok).toBe(true);

    await act(async () => {
      result.current.confirmSource(sourceId);
    });

    expect(result.current.activeSource!.confirmed).toBe(true);
    expect(result.current.session.confirmedSources).toHaveLength(1);
    expect(onSessionChange).toHaveBeenCalled();
    const lastCall = onSessionChange.mock.calls.at(-1)?.[0];
    expect(lastCall.confirmedSources).toHaveLength(1);
  });

  it('adding a second source keeps the first', async () => {
    const { result } = renderHook(() => useDatasusWizard());

    await act(async () => {
      await result.current.addTextSources([
        { rawText: readFixture('tabnet-semicolon-metadata.txt'), fileName: 'first.txt' },
      ]);
    });

    const firstId = result.current.sources[0]!.id;

    await act(async () => {
      await result.current.addTextSources([{ rawText: readFixture('tabnet-tab-mojibake.txt'), fileName: 'second.txt' }]);
    });

    expect(result.current.sources).toHaveLength(2);
    expect(result.current.sources.some((source) => source.id === firstId)).toBe(true);
  });

  it('addFiles with a rejecting read sets error tone and preserves existing sources', async () => {
    const { result } = renderHook(() => useDatasusWizard());

    await act(async () => {
      await result.current.addTextSources([
        { rawText: readFixture('tabnet-semicolon-metadata.txt'), fileName: 'kept.txt' },
      ]);
    });

    expect(result.current.sources).toHaveLength(1);

    vi.mocked(legacyAdapters.legacyUtils.readFileText).mockRejectedValueOnce(new Error('read failed'));

    const badFile = new File([''], 'broken.txt', { type: 'text/plain' });

    await act(async () => {
      await result.current.addFiles([badFile]);
    });

    expect(result.current.sources).toHaveLength(1);
    expect(result.current.status.tone).toBe('error');
    expect(result.current.status.message).toContain('broken.txt');
  });
});
