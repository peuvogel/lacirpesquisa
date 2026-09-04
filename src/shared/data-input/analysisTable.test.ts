import { describe, expect, it } from 'vitest';
import {
  createTableDocument,
  setTableColumnEnabled,
  setTableColumnType,
  setTableRoleBinding,
  setTableRowEnabled,
} from './tableDocument';
import { deriveRecognizedColumnsFromDocument, tableValiditySummary } from './analysisTable';

describe('analysis table helpers', () => {
  it('derives structural aliases without serializing delimiters or embedded newlines', () => {
    const document = createTableDocument(
      ['x;medida', 'Y'],
      [['texto; preservado', 'linha 1\nlinha 2']],
      'handoff',
      () => 'doc-1',
    );
    const bound = setTableRoleBinding(document, 'correlacao', 'variavel_y', document.columns[1]!.id);

    expect(
      deriveRecognizedColumnsFromDocument(bound, 'correlacao', {
        aliases: { variavel_x: ['x;medida'], variavel_y: ['Y'] },
        requiredKeys: ['variavel_x', 'variavel_y'],
        numericKeys: ['variavel_x', 'variavel_y'],
      }),
    ).toEqual({ variavel_x: 0, variavel_y: 1 });
    expect(bound.rows[0]).toEqual(['texto; preservado', 'linha 1\nlinha 2']);
  });

  it('lets a manual binding win without leaving an automatic role on the same column', () => {
    const document = createTableDocument(['X', 'Y'], [['1', '2']], 'colado', () => 'doc-1');
    const bound = setTableRoleBinding(document, 'correlacao', 'variavel_x', document.columns[1]!.id);

    expect(deriveRecognizedColumnsFromDocument(bound, 'correlacao', {
      aliases: { variavel_x: ['X'], variavel_y: ['Y'] },
      requiredKeys: ['variavel_x', 'variavel_y'],
      numericKeys: ['variavel_x', 'variavel_y'],
    })).toEqual({ variavel_x: 1 });
  });

  it('does not auto-detect a column that the user marked to ignore', () => {
    const document = createTableDocument(['X', 'Y'], [['1', '2']], 'colado', () => 'doc-1');
    const ignored = setTableColumnType(document, document.columns[0]!.id, 'ignorar');

    expect(deriveRecognizedColumnsFromDocument(ignored, 'correlacao', {
      aliases: { variavel_x: ['X'], variavel_y: ['Y'] },
      requiredKeys: ['variavel_x', 'variavel_y'],
      numericKeys: ['variavel_x', 'variavel_y'],
    })).toEqual({ variavel_y: 1 });
  });

  it('does not suggest positional numeric roles for incompatible edited rows', () => {
    const document = createTableDocument(
      ['Identificador', 'Medida A', 'Medida B'],
      [['UF1', 'texto', 'texto'], ['UF2', 'texto', 'texto']],
      'colado',
      () => 'doc-1',
    );

    const recognized = deriveRecognizedColumnsFromDocument(document, 't-student', {
      aliases: { unidade: ['Identificador'] },
      requiredKeys: ['grupo_a', 'grupo_b'],
      numericKeys: ['grupo_a', 'grupo_b'],
      positionFallback: {
        minColumns: 3,
        keysByIndex: ['unidade', 'grupo_a', 'grupo_b'],
        requiredKeys: ['grupo_a', 'grupo_b'],
      },
    });

    expect(recognized.grupo_a).toBeUndefined();
    expect(recognized.grupo_b).toBeUndefined();
  });

  it('counts only rows relevant to the selected test roles', () => {
    const document = createTableDocument(
      ['Desfecho', 'Grupo', 'Observação opcional'],
      [['10', 'A', ''], ['', 'B', 'nota'], ['invalido', 'A', '']],
      'colado',
      () => 'doc-1',
    );
    const bound = setTableRoleBinding(
      setTableRoleBinding(document, 'anova-tukey', 'desfecho', document.columns[0]!.id),
      'anova-tukey',
      'grupo',
      document.columns[1]!.id,
    );

    expect(tableValiditySummary(bound, 'anova-tukey', ['desfecho', 'grupo'], ['desfecho'])).toEqual({
      valid: 1,
      incomplete: [2],
      invalid: [3],
    });
  });

  it('does not mark rows invalid for an optional numeric role with no binding', () => {
    const document = createTableDocument(['Desfecho', 'Grupo'], [['10', 'A']], 'colado', () => 'doc-1');
    const bound = setTableRoleBinding(
      setTableRoleBinding(document, 'poisson', 'desfecho', document.columns[0]!.id),
      'poisson',
      'grupo',
      document.columns[1]!.id,
    );

    expect(tableValiditySummary(bound, 'poisson', ['desfecho', 'grupo'], ['desfecho', 'exposicao'])).toEqual({
      valid: 1,
      incomplete: [],
      invalid: [],
    });
  });

  it('rejects malformed numeric tokens instead of repairing them into another number', () => {
    const document = createTableDocument(['Desfecho', 'Grupo'], [['1.2.3', 'A']], 'colado', () => 'doc-1');
    const bound = setTableRoleBinding(
      setTableRoleBinding(document, 'anova-tukey', 'desfecho', document.columns[0]!.id),
      'anova-tukey',
      'grupo',
      document.columns[1]!.id,
    );

    expect(tableValiditySummary(bound, 'anova-tukey', ['desfecho', 'grupo'], ['desfecho'])).toEqual({
      valid: 0,
      incomplete: [],
      invalid: [1],
    });
  });

  it('accepts temporal role values and identifies unsupported temporal tokens', () => {
    const document = createTableDocument(
      ['Tempo', 'Valor'],
      [['2024-S1', '10'], ['2024-X9', '11']],
      'colado',
      () => 'doc-time',
    );
    const bound = setTableRoleBinding(
      setTableRoleBinding(document, 'prais-winsten', 'tempo', document.columns[0]!.id),
      'prais-winsten',
      'variavel_y',
      document.columns[1]!.id,
    );

    expect(tableValiditySummary(
      bound,
      'prais-winsten',
      ['tempo', 'variavel_y'],
      ['variavel_y'],
      undefined,
      ['tempo'],
    )).toEqual({ valid: 1, incomplete: [], invalid: [2] });
  });
});

describe('disabled rows and columns', () => {
  const options = {
    aliases: { desfecho: ['valor'], grupo: ['grupo'] },
    requiredKeys: ['desfecho', 'grupo'],
    numericKeys: ['desfecho'],
  };
  // Sem vínculos explícitos, resolveBindings devolve {} e toda linha contaria
  // como incompleta — o mapa vai direto.
  const RESOLVED = { desfecho: 0, grupo: 1 };
  const base = () => createTableDocument(
    ['valor', 'grupo'],
    [['1', 'A'], ['2', 'B'], ['x', 'C'], ['4', 'D']],
    'colado',
    () => 'doc-off',
  );

  it('drops a switched-off column from recognizedColumns', () => {
    const document = setTableColumnEnabled(base(), 'doc-off-col-2', false);
    const recognized = deriveRecognizedColumnsFromDocument(document, 'teste', options);

    expect(recognized.grupo).toBeUndefined();
    // A coluna continua nas linhas, então o índice do que sobrou não desloca.
    expect(recognized.desfecho).toBe(0);
  });

  it('skips disabled rows while keeping the reported numbers original', () => {
    const before = tableValiditySummary(base(), 'teste', ['desfecho', 'grupo'], ['desfecho'], RESOLVED);
    expect(before.valid).toBe(3);
    expect(before.invalid).toEqual([3]);

    // Desliga a linha 2, que é válida: a inválida continua sendo a de número 3.
    const document = setTableRowEnabled(base(), 1, false);
    const after = tableValiditySummary(document, 'teste', ['desfecho', 'grupo'], ['desfecho'], RESOLVED);
    expect(after.valid).toBe(2);
    expect(after.invalid).toEqual([3]);
  });

  it('stops counting a disabled row as invalid', () => {
    const document = setTableRowEnabled(base(), 2, false);
    const summary = tableValiditySummary(document, 'teste', ['desfecho', 'grupo'], ['desfecho'], RESOLVED);

    expect(summary.invalid).toEqual([]);
    expect(summary.valid).toBe(3);
  });
});
