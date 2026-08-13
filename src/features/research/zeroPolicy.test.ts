import { describe, expect, it } from 'vitest';
import {
  ZERO_POLICY_CONFIG,
  analysisCellKey,
  recommendZeroPolicy,
} from './zeroPolicy';
import type { AnalysisCell, ResearchGeography, VariableProfile } from './types';

const countProfile: VariableProfile = {
  variableId: 'internacoes',
  label: 'Internações',
  variableType: 'count',
  temporalAggregation: 'sum',
};

function valueCell(
  territoryId: string,
  periodKey: string,
  rawValue: number,
  groupId = 'brasil',
): AnalysisCell {
  return {
    territoryId,
    groupId,
    periodKey,
    variableId: 'internacoes',
    rawValue,
    sourceStatus: rawValue === 0 ? 'collection_zero' : 'observed',
    analyticStatus: 'include',
  };
}

function abruptStateFixture(geography: ResearchGeography = 'uf') {
  const target = valueCell('BA', '2025', 0);
  const history = [valueCell('BA', '2024', 10_000), valueCell('BA', '2026', 12_000)];
  const peers = ['AC', 'AL', 'AP', 'AM', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG'].map((uf, index) =>
    valueCell(uf, '2025', 12_000 + index * 1_000),
  );
  return { targetCell: target, cells: [target, ...history, ...peers], profile: countProfile, geography };
}

describe('recommendZeroPolicy', () => {
  it('keeps policy thresholds in the approved central configuration', () => {
    expect(ZERO_POLICY_CONFIG).toEqual({
      minimumComparable: 5,
      positiveShare: 0.8,
      minimumExpected: 20,
      smallIndependentGroup: 10,
      unstableRateEvents: 16,
    });
  });

  it('excludes an abrupt high-volume state zero while preserving raw provenance', () => {
    const fixture = abruptStateFixture();
    const before = structuredClone(fixture);
    const recommendation = recommendZeroPolicy(fixture);

    expect(recommendation.cell).toMatchObject({
      rawValue: 0,
      sourceStatus: 'collection_zero',
      analyticStatus: 'exclude_suspected_noncollection',
      reasonCode: 'zero_suspected_noncollection',
    });
    expect(recommendation.explanation).toBe(
      'Zero abrupto incompatível com o histórico e com territórios comparáveis; tratado como provável falha de coleta.',
    );
    expect(fixture).toEqual(before);
  });

  it('uses exposure-normalized peers when exposures are available', () => {
    const fixture = abruptStateFixture();
    const exposures = Object.fromEntries(
      fixture.cells.map((cell) => [analysisCellKey(cell), cell.territoryId === 'BA' ? 2_000_000 : 1_000_000]),
    );
    const recommendation = recommendZeroPolicy({ ...fixture, exposures });

    expect(recommendation.diagnostics.peerExpected).toBeGreaterThanOrEqual(24_000);
    expect(recommendation.diagnostics.usedExposureNormalization).toBe(true);
    expect(recommendation.cell.analyticStatus).toBe('exclude_suspected_noncollection');
  });

  it.each([
    ['municipio', { geography: 'municipio' as const }, 'zero_review_municipal'],
    ['rare variable', { rareVariable: true }, 'zero_review_rare_variable'],
    ['independent group smaller than ten', { cells: abruptStateFixture().cells.slice(0, 8) }, 'zero_review_small_independent_group'],
  ])('requires review for %s instead of auto-excluding', (_label, override, reasonCode) => {
    const fixture = abruptStateFixture();
    const recommendation = recommendZeroPolicy({ ...fixture, ...override });

    expect(recommendation.cell).toMatchObject({ analyticStatus: 'requires_review', reasonCode });
  });

  it('never auto-excludes solely from peers when adjacent positive history is absent', () => {
    const fixture = abruptStateFixture();
    const recommendation = recommendZeroPolicy({
      ...fixture,
      cells: fixture.cells.filter((cell) => cell.territoryId !== 'BA' || cell.periodKey === '2025'),
    });

    expect(recommendation.cell).toMatchObject({
      rawValue: 0,
      sourceStatus: 'collection_zero',
      analyticStatus: 'requires_review',
      reasonCode: 'zero_review_insufficient_history',
    });
  });

  it('does not borrow comparable peers from another study group', () => {
    const fixture = abruptStateFixture();
    const sameGroupPeers = fixture.cells
      .filter((cell) => cell.territoryId !== 'BA' && cell.periodKey === '2025')
      .slice(0, 4);
    const groupUnits = ['CE', 'DF', 'ES', 'GO', 'MA'].map((territoryId) =>
      valueCell(territoryId, '2024', 10_000),
    );
    const foreignPeers = fixture.cells
      .filter((cell) => cell.territoryId !== 'BA' && cell.periodKey === '2025')
      .map((cell) => ({ ...cell, groupId: 'outro-grupo' }));
    const recommendation = recommendZeroPolicy({
      ...fixture,
      cells: [
        fixture.targetCell,
        ...fixture.cells.filter((cell) => cell.territoryId === 'BA' && cell.periodKey !== '2025'),
        ...sameGroupPeers,
        ...groupUnits,
        ...foreignPeers,
      ],
    });

    expect(recommendation.cell).toMatchObject({
      analyticStatus: 'requires_review',
      reasonCode: 'zero_review_insufficient_comparables',
    });
  });

  it('does not borrow adjacent history from another study group', () => {
    const fixture = abruptStateFixture();
    const foreignHistory = fixture.cells
      .filter((cell) => cell.territoryId === 'BA' && cell.periodKey !== '2025')
      .map((cell) => ({ ...cell, groupId: 'outro-grupo' }));
    const sameGroupPeers = fixture.cells.filter(
      (cell) => cell.territoryId !== 'BA' && cell.periodKey === '2025',
    );
    const recommendation = recommendZeroPolicy({
      ...fixture,
      cells: [fixture.targetCell, ...foreignHistory, ...sameGroupPeers],
    });

    expect(recommendation.cell).toMatchObject({
      analyticStatus: 'requires_review',
      reasonCode: 'zero_review_insufficient_history',
    });
  });

  it('requires review for a zero rate when numerator-event evidence is unavailable', () => {
    const fixture = abruptStateFixture();
    const rateProfile: VariableProfile = {
      ...countProfile,
      variableId: 'taxa_internacao_100k',
      variableType: 'rate',
      rateMultiplier: 100_000,
      temporalAggregation: 'recompute_rate',
    };
    const rateCells = fixture.cells.map((item) => ({ ...item, variableId: rateProfile.variableId }));
    const recommendation = recommendZeroPolicy({
      ...fixture,
      targetCell: rateCells[0],
      cells: rateCells,
      profile: rateProfile,
    });

    expect(recommendation.cell).toMatchObject({
      analyticStatus: 'requires_review',
      reasonCode: 'zero_review_missing_rate_events',
    });
  });

  it('does not reinterpret explicit confirmation or a non-zero value', () => {
    const fixture = abruptStateFixture();
    const confirmed = recommendZeroPolicy({ ...fixture, explicitlyConfirmedZero: true });
    const positive = recommendZeroPolicy({
      ...fixture,
      targetCell: valueCell('BA', '2025', 42),
    });

    expect(confirmed.cell).toMatchObject({ analyticStatus: 'include', reasonCode: 'zero_confirmed_by_source' });
    expect(positive.cell).toEqual(valueCell('BA', '2025', 42));
  });
});
