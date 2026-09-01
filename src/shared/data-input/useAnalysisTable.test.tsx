import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { useAnalysisTable } from './useAnalysisTable';

const options = {
  aliases: { desfecho: ['Desfecho'], grupo: ['Grupo'] },
  requiredKeys: ['desfecho', 'grupo'],
  numericKeys: ['desfecho'],
};

describe('useAnalysisTable', () => {
  afterEach(() => vi.useRealTimers());

  it('persists a draft role/type edit, invalidates confirmation, and keeps it on another test binding', () => {
    const { result } = renderHook(() => useAnalysisTable('anova-tukey', { tabularOptions: options }), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });

    act(() => result.current.replaceTable(['Desfecho', 'Grupo'], [['10', 'A']], 'exemplo'));
    const desfecho = result.current.table!.columns[0]!.id;
    const grupo = result.current.table!.columns[1]!.id;
    act(() => {
      result.current.setBinding('desfecho', desfecho);
      result.current.setBinding('grupo', grupo);
      result.current.setColumnType(desfecho, 'numerica');
      result.current.confirm();
    });
    expect(result.current.confirmed?.recognizedColumns).toEqual({ desfecho: 0, grupo: 1 });

    act(() => result.current.setCell(0, 0, '11'));
    expect(result.current.confirmed).toBeNull();
    expect(result.current.table!.columns[0]).toMatchObject({ id: desfecho, type: 'numerica', explicitType: true });

    act(() => result.current.setBindingForTest('correlacao', 'variavel_x', desfecho));
    expect(result.current.table!.bindings).toMatchObject({
      'anova-tukey': { desfecho, grupo },
      correlacao: { variavel_x: desfecho },
    });
  });

  it('accepts a later same-shaped paste instead of deduplicating it by a lossy table fingerprint', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnalysisTable('anova-tukey', { tabularOptions: options }), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });

    act(() => {
      result.current.tabular.setRawText('Desfecho;Grupo\n10;A\n20;B');
      vi.advanceTimersByTime(200);
    });
    expect(result.current.table!.rows[1]).toEqual(['20', 'B']);

    act(() => {
      result.current.tabular.setRawText('Desfecho;Grupo\n10;A\n30;B');
      vi.advanceTimersByTime(200);
    });
    expect(result.current.table!.rows[1]).toEqual(['30', 'B']);
  });

  it('keeps role bindings per test when the active test changes and changes back', () => {
    const { result, rerender } = renderHook(
      ({ testId }) => useAnalysisTable(testId, { tabularOptions: options }),
      {
        initialProps: { testId: 'anova-tukey' },
        wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
      },
    );

    act(() => result.current.replaceTable(['Desfecho', 'Grupo'], [['10', 'A']], 'colado'));
    const desfecho = result.current.table!.columns[0]!.id;
    const grupo = result.current.table!.columns[1]!.id;
    act(() => {
      result.current.setBinding('desfecho', desfecho);
      result.current.setBinding('grupo', grupo);
    });

    rerender({ testId: 'correlacao' });
    act(() => result.current.setBinding('variavel_x', desfecho));
    rerender({ testId: 'anova-tukey' });

    expect(result.current.recognizedColumns).toMatchObject({ desfecho: 0, grupo: 1 });
    expect(result.current.table!.bindings.correlacao).toEqual({ variavel_x: desfecho });
  });

  it('uses the actual source label for example and a later paste', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnalysisTable('anova-tukey', { tabularOptions: options }), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });

    act(() => {
      result.current.useExample('Desfecho;Grupo\n10;A');
      vi.advanceTimersByTime(200);
    });
    expect(result.current.table?.sourceLabel).toBe('exemplo');

    act(() => {
      result.current.requestPaste('Desfecho;Grupo\n20;B');
      vi.advanceTimersByTime(200);
    });
    expect(result.current.table?.sourceLabel).toBe('colado');
  });

  it('uses the uploaded filename as the source label', async () => {
    const { result } = renderHook(() => useAnalysisTable('anova-tukey', { tabularOptions: options }), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });
    const file = new File(['Desfecho;Grupo\n10;A'], 'dados-estudo.csv', { type: 'text/csv' });

    act(() => result.current.requestFile(file));

    await waitFor(() => expect(result.current.table?.sourceLabel).toBe('dados-estudo.csv'));
  });

  it('persists the rectangular import diagnostics with a ragged paste', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnalysisTable('anova-tukey', { tabularOptions: options }), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });

    act(() => {
      result.current.requestPaste('Desfecho;Grupo\n10;A;extra\n20');
      vi.advanceTimersByTime(200);
    });

    expect(result.current.table?.importSummary?.diagnostics.map((diagnostic) => diagnostic.code)).toContain('extra_cells');
    expect(result.current.table?.importSummary?.diagnostics.map((diagnostic) => diagnostic.code)).toContain('short_rows');
  });

  it('confirms only the documented SessionDataset fields', () => {
    const { result } = renderHook(() => {
      const analysis = useAnalysisTable('anova-tukey', { tabularOptions: options });
      return { analysis, session: useSession() };
    }, { wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider> });

    act(() => result.current.analysis.replaceTable(['Desfecho', 'Grupo'], [['10', 'A']], 'exemplo'));
    act(() => result.current.analysis.confirm());

    expect(result.current.session.dataset).toMatchObject({
      headers: ['Desfecho', 'Grupo'], rows: [['10', 'A']], sourceLabel: 'exemplo', table: result.current.analysis.table,
    });
    expect(result.current.session.dataset).not.toHaveProperty('document');
    expect(result.current.session.dataset).not.toHaveProperty('recognizedColumns');
  });

  it('invalidates its draft and confirmation when the global session is cleared', () => {
    const { result } = renderHook(() => {
      const analysis = useAnalysisTable('anova-tukey', { tabularOptions: options });
      return { analysis, session: useSession() };
    }, { wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider> });

    act(() => result.current.analysis.replaceTable(['Desfecho', 'Grupo'], [['10', 'A']], 'colado'));
    act(() => result.current.analysis.confirm());
    expect(result.current.analysis.confirmed).not.toBeNull();

    act(() => result.current.session.clearSession());

    expect(result.current.analysis.table).toBeNull();
    expect(result.current.analysis.confirmed).toBeNull();
  });

  it('asks before discarding an edited table and clearing cancels a pending replacement read', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnalysisTable('anova-tukey', { tabularOptions: options }), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });
    act(() => result.current.replaceTable(['Desfecho', 'Grupo'], [['10', 'A']], 'colado'));
    act(() => result.current.setCell(0, 0, '11'));

    act(() => result.current.requestPaste('Desfecho;Grupo\n20;B'));
    expect(result.current.pendingAction).toBe('Substituir dados');
    expect(result.current.table!.rows).toEqual([['11', 'A']]);
    act(() => result.current.cancelPendingAction());
    expect(result.current.table!.rows).toEqual([['11', 'A']]);

    act(() => result.current.requestPaste('Desfecho;Grupo\n20;B'));
    act(() => result.current.confirmPendingAction());
    act(() => result.current.requestClear());
    expect(result.current.pendingAction).toBe('Limpar tabela');
    act(() => result.current.confirmPendingAction());
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.table).toBeNull();
    expect(result.current.confirmed).toBeNull();
  });
});
