import { describe, expect, it } from 'vitest';
import { createTableDocument, setTableRoleBinding } from './tableDocument';
import { prepareGroupedSamples } from './groupedSamples';

function bind(headers: string[], rows: string[][], roles: Record<string, number>) {
  let document = createTableDocument(headers, rows, 'teste', () => 'doc-1');
  Object.entries(roles).forEach(([role, index]) => {
    document = setTableRoleBinding(document, 'mann-whitney', role, document.columns[index]!.id);
  });
  return document;
}

describe('prepareGroupedSamples', () => {
  it('prepares two independent wide columns and keeps a valid value from a partially missing row', () => {
    const document = bind(
      ['Grupo A', 'Grupo B'],
      [['1', '4'], ['2', '5'], ['3', '6'], ['7', '']],
      { grupo_a: 0, grupo_b: 1 },
    );

    const prepared = prepareGroupedSamples(document, 'mann-whitney', 'wide');

    expect(prepared.groups).toEqual([
      expect.objectContaining({ label: 'Grupo A', values: [1, 2, 3, 7] }),
      expect.objectContaining({ label: 'Grupo B', values: [4, 5, 6] }),
    ]);
    expect(prepared.invalidRowNumbers).toEqual([4]);
    expect(prepared.issues).toContainEqual(expect.objectContaining({ code: 'rows_ignored', severity: 'warning' }));
    expect(prepared.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('prepares long data without dropping a third group to force a comparison', () => {
    const document = bind(
      ['Valor', 'Grupo'],
      [['1', 'constructor'], ['2', 'constructor'], ['3', 'B'], ['4', 'B'], ['5', '__proto__'], ['6', '__proto__']],
      { desfecho: 0, grupo: 1 },
    );

    const prepared = prepareGroupedSamples(document, 'mann-whitney', 'long');

    expect(prepared.groups.map((group) => group.label)).toEqual(['constructor', 'B', '__proto__']);
    expect(prepared.groups.map((group) => group.values)).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(prepared.issues).toContainEqual(expect.objectContaining({
      code: 'group_count',
      severity: 'error',
      message: expect.stringMatching(/3 grupos.*constructor.*B.*__proto__/i),
    }));
  });

  it('reports one group, insufficient replication and all-tied samples with distinct issue codes', () => {
    const oneGroup = bind(
      ['Valor', 'Grupo'],
      [['5', 'A'], ['5', 'A']],
      { desfecho: 0, grupo: 1 },
    );
    const prepared = prepareGroupedSamples(oneGroup, 'mann-whitney', 'long');

    expect(prepared.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'group_count',
      'group_too_small',
      'all_values_tied',
    ]));
  });

  it('reports missing bindings instead of reading an arbitrary column', () => {
    const document = createTableDocument(['A', 'B'], [['1', '2']], 'teste', () => 'doc-1');
    const prepared = prepareGroupedSamples(document, 'mann-whitney', 'wide');

    expect(prepared.groups).toEqual([]);
    expect(prepared.issues).toContainEqual(expect.objectContaining({ code: 'missing_binding', severity: 'error' }));
  });
});
