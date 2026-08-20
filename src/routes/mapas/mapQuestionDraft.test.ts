import { describe, expect, it } from 'vitest';
import type { MapAnalysisState } from './mapAnalysisState';
import {
  buildQuestionSentence,
  createInitialMapQuestionDraft,
  validateMapQuestion,
  type MapQuestionDraft,
} from './mapQuestionDraft';

const embolia = 'sih.embolia_e_trombose_arteriais.internacoes';

function stateWith(groups: MapAnalysisState['groups']): MapAnalysisState {
  return {
    groups,
    activeGroupId: groups[0]?.id ?? null,
    mapView: { level: 'uf' },
    provenance: 'catalog',
    sharedTime: { mode: 'range', start: '2013-01', end: '2025-12' },
    periodScope: 'shared',
    locationBasis: 'ocorrencia',
  };
}

function group(
  id: string,
  name: string,
  ibgeCode: string,
  sigla: string,
  territoryName: string,
): MapAnalysisState['groups'][number] {
  return {
    id,
    name,
    territoryIds: [{ level: 'uf', ibgeCode, sigla, name: territoryName }],
    time: { mode: 'range', start: '2013-01', end: '2025-12' },
    variableIds: [embolia],
  };
}

describe('mapQuestionDraft', () => {
  it('starts with one descriptive axis and no assumed objective', () => {
    expect(createInitialMapQuestionDraft()).toEqual({
      comparisonAxis: 'none',
      objective: null,
    });
  });

  it('allows a descriptive question only after population, disease, period and objective are real', () => {
    const state = stateWith([group('g1', 'População selecionada', '29', 'BA', 'Bahia')]);

    expect(
      validateMapQuestion(state, { comparisonAxis: 'none', objective: 'describe' }),
    ).toEqual({ safeToStart: true, reasons: [] });
    expect(
      validateMapQuestion(state, { comparisonAxis: 'none', objective: 'compare' }),
    ).toMatchObject({ safeToStart: false });
  });

  it('requires a populated comparator for a place comparison', () => {
    const onePopulation = stateWith([
      group('g1', 'População selecionada', '29', 'BA', 'Bahia'),
    ]);
    const draft: MapQuestionDraft = { comparisonAxis: 'place', objective: 'compare' };

    expect(validateMapQuestion(onePopulation, draft)).toMatchObject({
      safeToStart: false,
      reasons: [expect.stringMatching(/comparador/i)],
    });

    const twoPopulations = stateWith([
      ...onePopulation.groups,
      group('g2', 'Comparador', '33', 'RJ', 'Rio de Janeiro'),
    ]);
    expect(validateMapQuestion(twoPopulations, draft)).toEqual({
      safeToStart: true,
      reasons: [],
    });
  });

  it('requires the existing per-group period preparation for a period comparison', () => {
    const state = stateWith([group('g1', 'População selecionada', '29', 'BA', 'Bahia')]);

    expect(
      validateMapQuestion(state, { comparisonAxis: 'period', objective: 'compare' }),
    ).toMatchObject({
      safeToStart: false,
      reasons: [expect.stringMatching(/períodos/i)],
    });

    const prepared: MapAnalysisState = {
      ...state,
      periodScope: 'per-group',
      groups: [
        {
          ...state.groups[0]!,
          id: 'pre',
          time: { mode: 'range', start: '2013-01', end: '2019-12' },
        },
        {
          ...state.groups[0]!,
          id: 'post',
          name: 'Comparador',
          time: { mode: 'range', start: '2020-01', end: '2025-12' },
        },
      ],
    };
    expect(
      validateMapQuestion(prepared, { comparisonAxis: 'period', objective: 'compare' }),
    ).toEqual({ safeToStart: true, reasons: [] });
  });

  it('fails closed for disease and exposure axes that the current analytic unit cannot represent', () => {
    const state = stateWith([group('g1', 'População selecionada', '29', 'BA', 'Bahia')]);

    expect(
      validateMapQuestion(state, { comparisonAxis: 'disease', objective: 'compare' }),
    ).toMatchObject({ safeToStart: false, reasons: [expect.stringMatching(/doenças.*combinadas/i)] });
    expect(
      validateMapQuestion(state, { comparisonAxis: 'exposure', objective: 'compare' }),
    ).toMatchObject({ safeToStart: false, reasons: [expect.stringMatching(/exposição.*carregável/i)] });
  });

  it('builds a natural sentence from the actual territories, disease and time', () => {
    const onePopulation = stateWith([
      group('g1', 'População selecionada', '29', 'BA', 'Bahia'),
    ]);
    expect(
      buildQuestionSentence(onePopulation, {
        comparisonAxis: 'none',
        objective: 'describe',
      }),
    ).toBe(
      'Na Bahia, como se comportaram os dados de Embolia e trombose arteriais entre 2013 e 2025?',
    );

    const twoPopulations = stateWith([
      ...onePopulation.groups,
      group('g2', 'Comparador', '33', 'RJ', 'Rio de Janeiro'),
    ]);
    expect(
      buildQuestionSentence(twoPopulations, {
        comparisonAxis: 'place',
        objective: 'compare',
      }),
    ).toBe(
      'Os dados de Embolia e trombose arteriais diferem entre Bahia e Rio de Janeiro entre 2013 e 2025?',
    );
  });
});
