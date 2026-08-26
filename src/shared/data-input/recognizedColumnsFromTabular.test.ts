import { describe, expect, it } from 'vitest';
import { parseDelimitedRows } from './parseTabular';
import { deriveRecognizedColumnsFromTabular, deriveRecognizedColumnsFromRoles } from './recognizedColumnsFromTabular';
import { TABULAR_OPTIONS as correlacaoOptions } from '@/features/tests/correlacao/correlacaoConfig';
import { TABULAR_OPTIONS as praisOptions } from '@/features/tests/prais-winsten/praisConfig';
import { TABULAR_OPTIONS as tStudentOptions } from '@/features/tests/t-student/tStudentConfig';
import { exampleText as correlacaoExampleText } from '@/features/tests/correlacao/correlacaoConfig';
import { exampleText as praisExampleText } from '@/features/tests/prais-winsten/praisConfig';
import { exampleText as tStudentExampleText } from '@/features/tests/t-student/tStudentConfig';

function exampleToTabular(text: string): { headers: string[]; rows: string[][] } {
  const parsed = parseDelimitedRows(text);
  const [headerRow, ...bodyRows] = parsed.rows;
  return {
    headers: headerRow.map(String),
    rows: bodyRows.map((row) => row.map(String)),
  };
}

describe('deriveRecognizedColumnsFromTabular', () => {
  it('resolves grupo_a and grupo_b for t-student example headers/rows', () => {
    const { headers, rows } = exampleToTabular(tStudentExampleText);
    const recognized = deriveRecognizedColumnsFromTabular(headers, rows, tStudentOptions);

    expect(recognized.grupo_a).toBeDefined();
    expect(recognized.grupo_b).toBeDefined();
    expect(typeof recognized.grupo_a).toBe('number');
    expect(typeof recognized.grupo_b).toBe('number');
    expect(recognized.grupo_a).not.toBe(recognized.grupo_b);
  });

  it('resolves variavel_x and variavel_y for correlacao example headers/rows', () => {
    const { headers, rows } = exampleToTabular(correlacaoExampleText);
    const recognized = deriveRecognizedColumnsFromTabular(headers, rows, correlacaoOptions);

    expect(recognized.variavel_x).toBeDefined();
    expect(recognized.variavel_y).toBeDefined();
    expect(typeof recognized.variavel_x).toBe('number');
    expect(typeof recognized.variavel_y).toBe('number');
  });

  it('resolves tempo and variavel_y for prais-winsten example headers/rows', () => {
    const { headers, rows } = exampleToTabular(praisExampleText);
    const recognized = deriveRecognizedColumnsFromTabular(headers, rows, praisOptions);

    expect(recognized.tempo).toBeDefined();
    expect(recognized.variavel_y).toBeDefined();
    expect(typeof recognized.tempo).toBe('number');
    expect(typeof recognized.variavel_y).toBe('number');
  });

  it('uses position fallback for generic 3-column headers', () => {
    const headers = ['Identificador', 'Medida A', 'Medida B'];
    const rows = [
      ['UF1', '12,3', '45,2'],
      ['UF2', '14,1', '43,8'],
      ['UF3', '10,9', '48,0'],
    ];
    const recognized = deriveRecognizedColumnsFromTabular(headers, rows, tStudentOptions);

    expect(recognized.grupo_a).toBe(1);
    expect(recognized.grupo_b).toBe(2);
  });

  it('does not apply position fallback when the structured rows are incompatible', () => {
    const recognized = deriveRecognizedColumnsFromTabular(
      ['Identificador', 'Medida A', 'Medida B'],
      [['UF1', 'sem medida', 'também texto'], ['UF2', 'inválido', 'inválido']],
      tStudentOptions,
    );

    expect(recognized.grupo_a).toBeUndefined();
    expect(recognized.grupo_b).toBeUndefined();
  });

  it('returns empty object for unrecognizable table without throwing', () => {
    const headers = ['Notas'];
    const rows = [['abc'], ['def']];
    const recognized = deriveRecognizedColumnsFromTabular(headers, rows, tStudentOptions);

    expect(recognized).toEqual({});
  });

  it('keeps structural handoff cells untouched when they contain delimiters and newlines', () => {
    const headers = ['variavel_x', 'variavel_y'];
    const rows = [['texto; literal', 'linha 1\nlinha 2']];

    expect(deriveRecognizedColumnsFromTabular(headers, rows, correlacaoOptions)).toEqual({
      variavel_x: 0,
      variavel_y: 1,
    });
    expect(rows).toEqual([['texto; literal', 'linha 1\nlinha 2']]);
  });
});

describe('deriveRecognizedColumnsFromRoles', () => {
  it('assigns numeric columns to grupo_a/grupo_b via positionFallback for t-student', () => {
    const headers = ['Identificador', 'Medida A', 'Medida B'];
    const roles = ['categorica', 'numerica', 'numerica'] as const;
    const recognized = deriveRecognizedColumnsFromRoles([...roles], headers, tStudentOptions);

    expect(recognized.grupo_a).toBe(1);
    expect(recognized.grupo_b).toBe(2);
  });

  it('maps tempo role to tempo and numeric columns to variavel_x/variavel_y for correlacao', () => {
    const headers = ['id', 'variavel_x', 'variavel_y', 'observacao_opcional'];
    const roles = ['categorica', 'numerica', 'numerica', 'ignorar'] as const;
    const recognized = deriveRecognizedColumnsFromRoles([...roles], headers, correlacaoOptions);

    expect(recognized.variavel_x).toBe(1);
    expect(recognized.variavel_y).toBe(2);
    expect(recognized.id).toBe(0);
  });

  it('maps tempo role to tempo key for prais-winsten', () => {
    const headers = ['Ano', 'Internacoes'];
    const roles = ['tempo', 'numerica'] as const;
    const recognized = deriveRecognizedColumnsFromRoles([...roles], headers, praisOptions);

    expect(recognized.tempo).toBe(0);
    expect(recognized.variavel_y).toBe(1);
  });

  it('excludes columns marked ignorar from the mapping', () => {
    const headers = ['id', 'variavel_x', 'variavel_y'];
    const roles = ['categorica', 'ignorar', 'numerica'] as const;
    const recognized = deriveRecognizedColumnsFromRoles([...roles], headers, correlacaoOptions);

    expect(recognized.variavel_x).toBeUndefined();
    expect(recognized.variavel_y).toBe(2);
  });
});
