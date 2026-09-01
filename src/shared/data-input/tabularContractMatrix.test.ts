import { describe, expect, it } from 'vitest';
import { TABULAR_OPTIONS as tOptions } from '@/features/tests/t-student/tStudentConfig';
import {
  LONG_TABULAR_OPTIONS as mannLongOptions,
  WIDE_TABULAR_OPTIONS as mannWideOptions,
} from '@/features/tests/mann-whitney/mannWhitneyConfig';
import { TABULAR_OPTIONS as correlationOptions } from '@/features/tests/correlacao/correlacaoConfig';
import { TABULAR_OPTIONS as praisOptions } from '@/features/tests/prais-winsten/praisConfig';
import { TABULAR_OPTIONS as chiOptions } from '@/features/tests/qui-quadrado/quiQuadradoConfig';
import { TABULAR_OPTIONS as anovaOptions } from '@/features/tests/anova-tukey/anovaConfig';
import { TABULAR_OPTIONS as kruskalOptions } from '@/features/tests/kruskal-dunn/kruskalConfig';
import { TABULAR_OPTIONS as poissonOptions } from '@/features/tests/poisson/poissonConfig';
import { TABULAR_OPTIONS as negativeBinomialOptions } from '@/features/tests/binomial-negativa/binomialNegativaConfig';
import { TABULAR_OPTIONS as logisticOptions } from '@/features/tests/logistica/logisticaConfig';
import { prepareGroupedSamples } from './groupedSamples';
import { legacyStats } from './legacyAdapters';
import { readTabularPasteState } from './parseTabular';
import { deriveRecognizedColumnsFromDocument, tableValiditySummary } from './analysisTable';
import { createTableDocument, setTableCell } from './tableDocument';
import type { TableDocument } from './tableDocument';
import type { TabularInputOptions, TabularLoadedState } from './types';

interface ContractCase {
  id: string;
  options: TabularInputOptions;
  headers: string[];
  rows: string[][];
  requiredKeys: string[];
}

const contractCases = [
  {
    id: 't-student', options: tOptions,
    headers: ['unidade', 'grupo_a', 'grupo_b'],
    rows: [['BA', '1.1', '2.1'], ['SE', '1.2', '2.2'], ['AL', '1.3', '2.3']],
    requiredKeys: ['grupo_a', 'grupo_b'],
  },
  {
    id: 'mann-long', options: mannLongOptions,
    headers: ['desfecho', 'grupo'],
    rows: [['1.1', 'A'], ['1.2', 'A'], ['2.1', 'B'], ['2.2', 'B']],
    requiredKeys: ['desfecho', 'grupo'],
  },
  {
    id: 'mann-wide', options: mannWideOptions,
    headers: ['grupo_a', 'grupo_b'],
    rows: [['1.1', '2.1'], ['1.2', '2.2'], ['1.3', '2.3']],
    requiredKeys: ['grupo_a', 'grupo_b'],
  },
  {
    id: 'correlacao', options: correlationOptions,
    headers: ['id', 'variavel_x', 'variavel_y'],
    rows: [['A', '1.1', '2.1'], ['B', '1.2', '2.2'], ['C', '1.3', '2.3']],
    requiredKeys: ['variavel_x', 'variavel_y'],
  },
  {
    id: 'prais-winsten', options: praisOptions,
    headers: ['Semestre', 'N de inscritos'],
    rows: [['2021.1', '90'], ['2021.2', '92'], ['2022.1', '93']],
    requiredKeys: ['tempo', 'variavel_y'],
  },
  {
    id: 'qui-quadrado', options: chiOptions,
    headers: ['categoria_a', 'categoria_b'],
    rows: [['A', 'Sim'], ['A', 'Não'], ['B', 'Sim'], ['B', 'Não']],
    requiredKeys: ['categoria_a', 'categoria_b'],
  },
  {
    id: 'anova-tukey', options: anovaOptions,
    headers: ['desfecho', 'grupo'],
    rows: [['1.1', 'A'], ['1.2', 'A'], ['2.1', 'B'], ['2.2', 'B']],
    requiredKeys: ['desfecho', 'grupo'],
  },
  {
    id: 'kruskal-dunn', options: kruskalOptions,
    headers: ['desfecho', 'grupo'],
    rows: [['1.1', 'A'], ['1.2', 'A'], ['2.1', 'B'], ['2.2', 'B']],
    requiredKeys: ['desfecho', 'grupo'],
  },
  {
    id: 'poisson', options: poissonOptions,
    headers: ['contagem', 'preditor'],
    rows: [['1', '1.1'], ['2', '1.2'], ['3', '1.3']],
    requiredKeys: ['contagem', 'preditor'],
  },
  {
    id: 'binomial-negativa', options: negativeBinomialOptions,
    headers: ['contagem', 'preditor'],
    rows: [['3', '1.1'], ['8', '1.2'], ['15', '1.3']],
    requiredKeys: ['contagem', 'preditor'],
  },
  {
    id: 'logistica', options: logisticOptions,
    headers: ['desfecho_binario', 'preditor'],
    rows: [['0', '1.1'], ['1', '1.2'], ['0', '1.3'], ['1', '1.4']],
    requiredKeys: ['desfecho_binario', 'preditor'],
  },
] satisfies ContractCase[];

const delimiters = [
  { label: 'ponto e vírgula', value: ';' },
  { label: 'tabulação', value: '\t' },
  { label: 'vírgula com ponto decimal', value: ',' },
] as const;

function serialize(headers: readonly string[], rows: readonly (readonly string[])[], delimiter = ';'): string {
  return [headers, ...rows].map((row) => row.join(delimiter)).join('\n');
}

function load(text: string, options: TabularInputOptions): TabularLoadedState {
  const loaded = readTabularPasteState(text, legacyStats, options);
  expect(loaded.status).toBe('loaded');
  if (loaded.status !== 'loaded') throw new Error(loaded.message);
  return loaded;
}

function documentFrom(caseDefinition: ContractCase): {
  document: TableDocument;
  recognized: Record<string, number>;
} {
  const loaded = load(serialize(caseDefinition.headers, caseDefinition.rows), caseDefinition.options);
  const document = createTableDocument(
    loaded.headers,
    loaded.bodyRows,
    loaded.tableName,
    () => `contract-${caseDefinition.id}`,
    loaded.summary,
  );
  return {
    document,
    recognized: deriveRecognizedColumnsFromDocument(document, caseDefinition.id, caseDefinition.options),
  };
}

describe.each(contractCases)('$id tabular import contract', (caseDefinition) => {
  it.each(delimiters)('characterization: recognizes required roles with $label', ({ value: delimiter }) => {
    const loaded = load(
      serialize(caseDefinition.headers, caseDefinition.rows, delimiter),
      caseDefinition.options,
    );
    const document = createTableDocument(
      loaded.headers,
      loaded.bodyRows,
      loaded.tableName,
      () => `contract-${caseDefinition.id}-${delimiter}`,
      loaded.summary,
    );
    const recognized = deriveRecognizedColumnsFromDocument(document, caseDefinition.id, caseDefinition.options);

    expect(loaded.delimiter).toBe(delimiter);
    expect(caseDefinition.requiredKeys.every((key) => loaded.recognizedColumns[key])).toBe(true);
    expect(caseDefinition.requiredKeys.every((key) => recognized[key] !== undefined)).toBe(true);
    expect(loaded.summary).toMatchObject({
      sourceType: 'paste',
      rowCount: caseDefinition.rows.length,
      columnCount: caseDefinition.headers.length,
      diagnostics: expect.any(Array),
    });
    expect(document.importSummary).toEqual(loaded.summary);
  });

  it('characterization: reports a missing required cell as incomplete without treating it as valid', () => {
    const { document, recognized } = documentFrom(caseDefinition);
    const missingColumn = recognized[caseDefinition.requiredKeys[0]!]!;
    const edited = setTableCell(document, 0, missingColumn, '');

    expect(tableValiditySummary(
      edited,
      caseDefinition.id,
      caseDefinition.requiredKeys,
      caseDefinition.options.numericKeys,
      recognized,
      caseDefinition.options.temporalKeys,
    )).toEqual({ valid: caseDefinition.rows.length - 1, incomplete: [1], invalid: [] });
  });

  const numericRequiredKey = caseDefinition.requiredKeys.find((key) => (
    caseDefinition.options.numericKeys?.includes(key)
  ));
  if (numericRequiredKey) {
    it(`characterization: reports non-numeric ${numericRequiredKey} as invalid`, () => {
      const { document, recognized } = documentFrom(caseDefinition);
      const edited = setTableCell(document, 0, recognized[numericRequiredKey]!, 'não-numérico');

      expect(tableValiditySummary(
        edited,
        caseDefinition.id,
        caseDefinition.requiredKeys,
        caseDefinition.options.numericKeys,
        recognized,
        caseDefinition.options.temporalKeys,
      )).toEqual({ valid: caseDefinition.rows.length - 1, incomplete: [], invalid: [1] });
    });
  }
});

describe('cross-cutting import characterizations', () => {
  it.each([';', '\t'])('preserves decimal commas with %s separators', (delimiter) => {
    const loaded = load(
      serialize(['desfecho', 'grupo'], [['1,25', 'A'], ['2,50', 'B']], delimiter),
      anovaOptions,
    );

    expect(loaded.decimalCommaDetected).toBe(true);
    expect(loaded.bodyRows).toEqual([['1,25', 'A'], ['2,50', 'B']]);
    expect(loaded.summary.diagnostics).toContainEqual(expect.objectContaining({ code: 'decimal_comma' }));
  });

  it('rejects an invalid semester token during editable-table preflight', () => {
    const praisCase = contractCases.find(({ id }) => id === 'prais-winsten')!;
    const { document, recognized } = documentFrom(praisCase);
    const edited = setTableCell(document, 0, recognized.tempo!, '2024-X9');

    expect(tableValiditySummary(
      edited,
      praisCase.id,
      praisCase.requiredKeys,
      praisCase.options.numericKeys,
      recognized,
      praisCase.options.temporalKeys,
    )).toEqual({ valid: 2, incomplete: [], invalid: [1] });
  });

  it('keeps ragged imports rectangular and records short-row/extra-cell diagnostics', () => {
    const loaded = load('desfecho;grupo\n1;A\n2;B;nota\n3', anovaOptions);

    expect(loaded.headers).toEqual(['desfecho', 'grupo', 'Coluna 3']);
    expect(loaded.bodyRows).toEqual([
      ['1', 'A', ''],
      ['2', 'B', 'nota'],
      ['3', '', ''],
    ]);
    expect(loaded.bodyRows.every((row) => row.length === loaded.headers.length)).toBe(true);
    expect(loaded.summary).toMatchObject({ rowCount: 3, columnCount: 3 });
    expect(loaded.summary.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'extra_cells', rowNumbers: [2] }),
      expect.objectContaining({ code: 'short_rows', rowNumbers: [1, 3] }),
    ]));
  });

  it('preserves the other independent Mann–Whitney sample when one wide cell is absent', () => {
    const wideCase = contractCases.find(({ id }) => id === 'mann-wide')!;
    const { document, recognized } = documentFrom(wideCase);
    const edited = setTableCell(document, 0, recognized.grupo_a!, '');
    const validity = tableValiditySummary(
      edited,
      wideCase.id,
      wideCase.requiredKeys,
      wideCase.options.numericKeys,
      recognized,
    );
    const prepared = prepareGroupedSamples(edited, wideCase.id, 'wide', recognized);
    const warning = prepared.issues.find(({ code }) => code === 'rows_ignored');

    expect(validity).toEqual({ valid: 2, incomplete: [1], invalid: [] });
    expect(prepared.groups).toMatchObject([
      { label: 'grupo_a', values: [1.2, 1.3] },
      { label: 'grupo_b', values: [2.1, 2.2, 2.3] },
    ]);
    expect(prepared.groups.flatMap(({ values }) => values)).not.toContain(0);
    expect(prepared.groups).toHaveLength(2);
    expect(warning).toMatchObject({
      severity: 'warning',
      rowNumbers: [1],
      hint: expect.stringMatching(/valores válidos.*preservados/i),
    });
    expect(`${warning?.message ?? ''} ${warning?.hint ?? ''}`).not.toMatch(/ambos.*descart|dois valores.*descart/i);
  });

  it('retains every discovered Mann–Whitney long-format group and rejects the extra group', () => {
    const loaded = load(serialize(
      ['desfecho', 'grupo'],
      [['1', 'A'], ['2', 'A'], ['3', 'A'], ['4', 'B'], ['5', 'B'], ['6', 'B'], ['7', 'C'], ['8', 'C'], ['9', 'C']],
    ), mannLongOptions);
    const document = createTableDocument(loaded.headers, loaded.bodyRows, loaded.tableName, () => 'mann-three-groups', loaded.summary);
    const recognized = deriveRecognizedColumnsFromDocument(document, 'mann-long', mannLongOptions);
    const prepared = prepareGroupedSamples(document, 'mann-long', 'long', recognized);

    expect(prepared.groups.map(({ label, values }) => ({ label, values }))).toEqual([
      { label: 'A', values: [1, 2, 3] },
      { label: 'B', values: [4, 5, 6] },
      { label: 'C', values: [7, 8, 9] },
    ]);
    expect(prepared.issues).toContainEqual(expect.objectContaining({
      code: 'group_count',
      severity: 'error',
      message: expect.stringMatching(/3 grupos.*exatamente dois grupos/i),
      hint: expect.stringMatching(/nenhum grupo foi descartado/i),
    }));
  });
});
