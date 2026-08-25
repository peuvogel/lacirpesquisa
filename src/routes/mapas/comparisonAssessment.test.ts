import { describe, expect, it } from 'vitest';
import type { TerritoryRef } from '@/geo/types';
import { catalogIdFor } from '@/features/catalog/taxonomy';
import type { MapAnalysisGroup } from './mapAnalysisState';
import { assessGroupComparison, groupCompletionIssues } from './comparisonAssessment';

const bahia: TerritoryRef = {
  level: 'uf',
  ibgeCode: '29',
  sigla: 'BA',
  name: 'Bahia',
};

const rio: TerritoryRef = {
  level: 'uf',
  ibgeCode: '33',
  sigla: 'RJ',
  name: 'Rio de Janeiro',
};

const saoPaulo: TerritoryRef = {
  level: 'uf',
  ibgeCode: '35',
  sigla: 'SP',
  name: 'São Paulo',
};

function group(
  id: string,
  overrides: Partial<MapAnalysisGroup> = {},
): MapAnalysisGroup {
  return {
    id,
    name: `Grupo ${id}`,
    territoryIds: [bahia],
    time: { mode: 'point', point: '2019' },
    variableIds: [catalogIdFor('taxa_internacao', 'embolia_e_trombose_arteriais')],
    ...overrides,
  };
}

function issueCodes(groups: MapAnalysisGroup[]): string[] {
  return assessGroupComparison(groups).issues.map((issue) => issue.code);
}

describe('groupCompletionIssues', () => {
  it('explica exatamente o que falta em um grupo', () => {
    const issues = groupCompletionIssues(
      group('1', {
        territoryIds: [],
        time: { mode: 'point' },
        variableIds: [],
      }),
    );

    expect(issues.map((issue) => issue.code)).toEqual([
      'missing_territory',
      'missing_outcome',
      'missing_period',
    ]);
    expect(issues.every((issue) => issue.severity === 'block')).toBe(true);
  });

  it('bloqueia grupo com mais de um desfecho primário', () => {
    const issues = groupCompletionIssues(
      group('1', {
        variableIds: [
          catalogIdFor('taxa_internacao', 'embolia_e_trombose_arteriais'),
          catalogIdFor('taxa_mortalidade', 'embolia_e_trombose_arteriais'),
        ],
      }),
    );

    expect(issues.map((issue) => issue.code)).toContain('multiple_outcomes');
  });
});

describe('assessGroupComparison', () => {
  it('mantém um grupo completo disponível para descrição sem inventar inferência', () => {
    const assessment = assessGroupComparison([group('1')]);

    expect(assessment).toMatchObject({
      designKind: 'descriptive',
      differingDimensions: [],
      canDescribe: true,
      canInfer: false,
      candidateTestIds: [],
    });
    expect(assessment.issues.map((issue) => issue.code)).toContain('ecological_data');
  });

  it('reconhece comparação independente entre lugares disjuntos com a mesma taxa', () => {
    const assessment = assessGroupComparison([
      group('1'),
      group('2', { territoryIds: [rio] }),
    ]);

    expect(assessment).toMatchObject({
      designKind: 'independent_place',
      differingDimensions: ['territory'],
      canDescribe: true,
      canInfer: true,
      candidateTestIds: ['t-student', 'mann-whitney'],
    });
  });

  it('sugere testes para três ou mais lugares independentes', () => {
    const assessment = assessGroupComparison([
      group('1'),
      group('2', { territoryIds: [rio] }),
      group('3', { territoryIds: [saoPaulo] }),
    ]);

    expect(assessment.designKind).toBe('independent_place');
    expect(assessment.candidateTestIds).toEqual(['anova-tukey', 'kruskal-dunn']);
  });

  it('reconhece períodos pareados no mesmo território', () => {
    const assessment = assessGroupComparison([
      group('1', { time: { mode: 'range', start: '2015', end: '2019' } }),
      group('2', { time: { mode: 'range', start: '2020', end: '2024' } }),
    ]);

    expect(assessment).toMatchObject({
      designKind: 'paired_period',
      differingDimensions: ['period'],
      canInfer: true,
      candidateTestIds: ['t-student'],
    });
  });

  it('bloqueia somas brutas quando as janelas temporais têm durações diferentes', () => {
    const assessment = assessGroupComparison([
      group('1', {
        time: { mode: 'range', start: '2015', end: '2019' },
        variableIds: [catalogIdFor('internacoes', 'embolia_e_trombose_arteriais')],
      }),
      group('2', {
        time: { mode: 'range', start: '2020', end: '2022' },
        variableIds: [catalogIdFor('internacoes', 'embolia_e_trombose_arteriais')],
      }),
    ]);

    expect(assessment.canInfer).toBe(false);
    expect(assessment.canDescribe).toBe(true);
    expect(assessment.issues).toContainEqual(
      expect.objectContaining({ code: 'unequal_raw_count_windows', severity: 'block' }),
    );
  });

  it('reconhece doenças pareadas quando lugar, medida e período são iguais', () => {
    const assessment = assessGroupComparison([
      group('1'),
      group('2', {
        variableIds: [catalogIdFor('taxa_internacao', 'amputacao_mmii')],
      }),
    ]);

    expect(assessment).toMatchObject({
      designKind: 'paired_disease',
      differingDimensions: ['disease'],
      canInfer: true,
      candidateTestIds: ['t-student'],
    });
  });

  it('bloqueia grupos duplicados que não definem um contraste', () => {
    const assessment = assessGroupComparison([group('1'), group('2')]);

    expect(assessment.designKind).toBe('unsupported');
    expect(assessment.canDescribe).toBe(true);
    expect(assessment.canInfer).toBe(false);
    expect(issueCodes([group('1'), group('2')])).toContain('duplicate_group');
  });

  it('bloqueia confusão quando lugar e período mudam ao mesmo tempo', () => {
    const assessment = assessGroupComparison([
      group('1'),
      group('2', {
        territoryIds: [rio],
        time: { mode: 'point', point: '2024' },
      }),
    ]);

    expect(assessment).toMatchObject({
      designKind: 'confounded',
      differingDimensions: ['territory', 'period'],
      canDescribe: true,
      canInfer: false,
    });
    expect(assessment.issues.map((issue) => issue.code)).toContain('confounded_dimensions');
  });

  it('bloqueia territórios parcialmente sobrepostos em grupos independentes', () => {
    const assessment = assessGroupComparison([
      group('1', { territoryIds: [bahia, rio] }),
      group('2', { territoryIds: [rio, saoPaulo] }),
    ]);

    expect(assessment.designKind).toBe('unsupported');
    expect(assessment.canInfer).toBe(false);
    expect(assessment.issues.map((issue) => issue.code)).toContain('partial_overlap');
  });

  it('avisa que contagens brutas de populações distintas precisam de denominador', () => {
    const assessment = assessGroupComparison([
      group('1', {
        variableIds: [catalogIdFor('internacoes', 'embolia_e_trombose_arteriais')],
      }),
      group('2', {
        territoryIds: [rio],
        variableIds: [catalogIdFor('internacoes', 'embolia_e_trombose_arteriais')],
      }),
    ]);

    expect(assessment.designKind).toBe('independent_place');
    expect(assessment.canDescribe).toBe(true);
    expect(assessment.canInfer).toBe(false);
    expect(assessment.issues.map((issue) => issue.code)).toContain(
      'raw_count_without_denominator',
    );
  });

  it('bloqueia medidas incompatíveis mesmo quando o resto é igual', () => {
    const assessment = assessGroupComparison([
      group('1'),
      group('2', {
        variableIds: [catalogIdFor('taxa_mortalidade', 'embolia_e_trombose_arteriais')],
      }),
    ]);

    expect(assessment.designKind).toBe('unsupported');
    expect(assessment.differingDimensions).toEqual(['measure']);
    expect(assessment.issues.map((issue) => issue.code)).toContain('incompatible_measure');
  });

  it('não permite analisar enquanto algum grupo estiver incompleto', () => {
    const assessment = assessGroupComparison([
      group('1'),
      group('2', { territoryIds: [], variableIds: [], time: { mode: 'point' } }),
    ]);

    expect(assessment.designKind).toBe('unsupported');
    expect(assessment.canDescribe).toBe(false);
    expect(assessment.canInfer).toBe(false);
    expect(assessment.issues.map((issue) => issue.code)).toContain('incomplete_group');
  });
});
