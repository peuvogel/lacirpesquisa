import { describe, expect, it, vi } from 'vitest';
import { normalizeImportedMatrix } from './importDiagnostics';

describe('normalizeImportedMatrix', () => {
  it('makes every imported cell visible with synthesized headers', () => {
    const headers = ['A', 'B'];
    const bodyRows = [['1', '2', 'extra'], ['3']];

    const result = normalizeImportedMatrix(headers, bodyRows);

    expect(result.headers).toEqual(['A', 'B', 'Coluna 3']);
    expect(result.bodyRows).toEqual([['1', '2', 'extra'], ['3', '', '']]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'extra_cells', rowNumbers: [1] }),
      expect.objectContaining({ code: 'short_rows', rowNumbers: [2] }),
    ]));
    expect(headers).toEqual(['A', 'B']);
    expect(bodyRows).toEqual([['1', '2', 'extra'], ['3']]);
  });

  it('blocks excess width before constructing normalized cells', () => {
    const fromSpy = vi.spyOn(Array, 'from');

    try {
      expect(() => normalizeImportedMatrix(Array.from({ length: 129 }, () => 'A'), [])).toThrow(/128.*colunas/i);
      expect(fromSpy).toHaveBeenCalledTimes(1);
    } finally {
      fromSpy.mockRestore();
    }
  });
});
