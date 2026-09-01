import { describe, expect, it } from 'vitest';
import {
  createTableDocument,
  setTableCell,
  setTableColumnName,
  setTableColumnType,
  setTableRoleBinding,
  resolveBindings,
} from './tableDocument';
import type { TabularImportSummary } from './importDiagnostics';

const importSummary: TabularImportSummary = {
  sourceType: 'paste', fileName: '', tableName: 'Dados', sheetNames: [], formatLabel: 'CSV', delimiter: ';',
  rowCount: 1, columnCount: 2, headerRowNumber: 1, recognitionMode: 'aliases', recognitionDetails: [],
  diagnostics: [], importWarnings: [],
};

describe('TableDocument', () => {
  it('gives duplicate headers distinct stable identities', () => {
    const document = createTableDocument(['Valor', 'Valor'], [['1', '2']], 'colado', () => 'doc-1');

    expect(document.id).toBe('doc-1');
    expect(document.columns.map((column) => column.id)).toEqual(['doc-1-col-1', 'doc-1-col-2']);
    expect(new Set(document.columns.map((column) => column.id)).size).toBe(2);
  });

  it('preserves optional import provenance through editable revisions', () => {
    const document = createTableDocument(['Valor'], [['1']], 'colado', () => 'doc-1', importSummary);
    const edited = setTableCell(document, 0, 0, '2');

    expect(edited.importSummary).toEqual(importSummary);
  });

  it('suggests numeric and temporal types at creation without marking them user-explicit', () => {
    const document = createTableDocument(
      ['Ano', 'Taxa', 'Região'],
      [['2020', '12,5', 'BA'], ['2021', '13,1', 'SP']],
      'colado',
      () => 'doc-1',
    );

    expect(document.columns.map(({ type, explicitType }) => ({ type, explicitType }))).toEqual([
      { type: 'tempo', explicitType: false },
      { type: 'numerica', explicitType: false },
      { type: 'categorica', explicitType: false },
    ]);
  });

  it('classifies semantic semester labels as temporal, not numeric', () => {
    const document = createTableDocument(
      ['Semestre', 'Valor'],
      [['2024-S1', '10'], ['2024-S2', '11']],
      'colado',
      () => 'doc-time',
    );

    expect(document.columns.map((column) => column.type)).toEqual(['tempo', 'numerica']);
  });

  it('does not suggest numeric for malformed tokens that only look numeric after punctuation is removed', () => {
    const document = createTableDocument(
      ['Medida'],
      [['1.2.3'], ['2.3.4']],
      'colado',
      () => 'doc-1',
    );

    expect(document.columns[0]).toMatchObject({ type: 'categorica', explicitType: false });
  });

  it('keeps a column identity and explicit type when its header or cell is edited', () => {
    const document = createTableDocument(['Região', 'Valor'], [['BA', '10']], 'colado', () => 'doc-1');
    const typed = setTableColumnType(document, document.columns[0]!.id, 'categorica');
    const renamed = setTableColumnName(typed, document.columns[0]!.id, 'UF');
    const edited = setTableCell(renamed, 0, 0, 'SP');

    expect(edited.columns[0]).toMatchObject({ id: document.columns[0]!.id, name: 'UF', type: 'categorica', explicitType: true });
    expect(edited.rows[0]![0]).toBe('SP');
    expect(edited.revision).toBe(3);
  });

  it('stores role bindings per test and resolves them to engine indexes', () => {
    const document = createTableDocument(['X', 'Y', 'Grupo'], [['1', '2', 'A']], 'colado', () => 'doc-1');
    const withCorrelation = setTableRoleBinding(
      setTableRoleBinding(document, 'correlacao', 'variavel_x', document.columns[0]!.id),
      'correlacao',
      'variavel_y',
      document.columns[1]!.id,
    );
    const withAnova = setTableRoleBinding(withCorrelation, 'anova-tukey', 'grupo', document.columns[2]!.id);

    expect(resolveBindings(withAnova, 'correlacao')).toEqual({ variavel_x: 0, variavel_y: 1 });
    expect(resolveBindings(withAnova, 'anova-tukey')).toEqual({ grupo: 2 });
  });

  it('stores an explicit unbound role so automatic suggestions do not override the user', () => {
    const document = createTableDocument(['Grupo A', 'Grupo B'], [['1', '2']], 'exemplo', () => 'doc-1');
    const unbound = setTableRoleBinding(document, 't-student', 'grupo_b', null);

    expect(unbound.bindings['t-student']).toEqual({ grupo_b: null });
    expect(resolveBindings(unbound, 't-student')).toEqual({});
  });

  it('removes bindings to a column when the column is explicitly ignored', () => {
    const document = createTableDocument(['X', 'Y'], [['1', '2']], 'colado', () => 'doc-1');
    const bound = setTableRoleBinding(document, 'correlacao', 'variavel_x', document.columns[0]!.id);
    const ignored = setTableColumnType(bound, document.columns[0]!.id, 'ignorar');

    expect(resolveBindings(ignored, 'correlacao')).toEqual({});
    expect(ignored.bindings.correlacao).toBeUndefined();
    expect(ignored.revision).toBe(bound.revision + 1);
  });

  it('does not let two roles in one test bind the same column', () => {
    const document = createTableDocument(['X', 'Y'], [['1', '2']], 'colado', () => 'doc-1');
    const first = setTableRoleBinding(document, 'correlacao', 'variavel_x', document.columns[0]!.id);
    const duplicate = setTableRoleBinding(first, 'correlacao', 'variavel_y', document.columns[0]!.id);

    expect(duplicate).toBe(first);
    expect(resolveBindings(duplicate, 'correlacao')).toEqual({ variavel_x: 0 });
  });
});
