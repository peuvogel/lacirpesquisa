import { describe, expect, it } from 'vitest';
import {
  compareScenarios,
  createRecommendedScenario,
  excludeObservedValue,
  excludeVariable,
  restoreRecommendation,
  reviseScenario,
  scenarioCellKey,
  treatAsMissing,
  useOriginalValue,
} from './scenarios';
import type { AnalysisCell } from './types';

function cell(overrides: Partial<AnalysisCell> = {}): AnalysisCell {
  return {
    territoryId: 'BA',
    groupId: 'nordeste',
    periodKey: '2025',
    variableId: 'internacoes',
    rawValue: 0,
    sourceStatus: 'collection_zero',
    analyticStatus: 'exclude_suspected_noncollection',
    reasonCode: 'zero_suspected_noncollection',
    ...overrides,
  };
}

describe('analysis scenarios', () => {
  it('keeps the recommended scenario deeply unchanged when using the original zero', () => {
    const sourceCells = [cell()];
    const recommended = createRecommendedScenario(sourceCells);
    const before = structuredClone(recommended);
    const revised = reviseScenario(recommended, [useOriginalValue(scenarioCellKey(sourceCells[0]))]);

    expect(revised).toMatchObject({ kind: 'researcher_reviewed', createdAfterResults: false });
    expect(revised.cells[0]).toMatchObject({
      rawValue: 0,
      sourceStatus: 'collection_zero',
      analyticStatus: 'include',
      reasonCode: 'manual_use_original',
    });
    expect(recommended).toEqual(before);
    expect(sourceCells).toEqual([cell()]);
    expect(() => {
      revised.cells[0].rawValue = 99;
    }).toThrow();
  });

  it('treats a numeric value as analytically missing without inventing source missingness', () => {
    const raw = cell();
    const recommended = createRecommendedScenario([raw]);
    const revised = reviseScenario(recommended, [treatAsMissing(scenarioCellKey(raw), 'Revisão do pesquisador')]);

    expect(revised.cells[0]).toMatchObject({
      rawValue: 0,
      sourceStatus: 'collection_zero',
      analyticStatus: 'exclude_manual',
      reasonCode: 'manual_treat_as_missing',
    });
  });

  it('restores the system recommendation after a pending manual choice', () => {
    const raw = cell();
    const recommended = createRecommendedScenario([raw]);
    const revised = reviseScenario(recommended, [
      useOriginalValue(scenarioCellKey(raw)),
      restoreRecommendation(scenarioCellKey(raw)),
    ]);

    expect(revised.cells[0]).toEqual(recommended.cells[0]);
  });

  it('does not allow a truly missing cell to be included as an original value', () => {
    const missing = cell({ rawValue: null, sourceStatus: 'missing', analyticStatus: 'exclude_missing' });
    const recommended = createRecommendedScenario([missing]);

    expect(() => reviseScenario(recommended, [useOriginalValue(scenarioCellKey(missing))])).toThrow(
      'Não existe valor disponível para esta observação.',
    );
  });

  it.each(['suppressed', 'not_applicable', 'not_queried'] as const)(
    'does not include a numeric payload whose source status is %s',
    (sourceStatus) => {
      const unavailable = cell({ rawValue: 0, sourceStatus, analyticStatus: 'exclude_missing' });
      const recommended = createRecommendedScenario([unavailable]);

      expect(() => reviseScenario(recommended, [useOriginalValue(scenarioCellKey(unavailable))])).toThrow(
        'Não existe valor disponível para esta observação.',
      );
    },
  );

  it('requires a non-empty justification to exclude a positive observed value', () => {
    const positive = cell({ rawValue: 25, sourceStatus: 'observed', analyticStatus: 'include', reasonCode: undefined });
    const recommended = createRecommendedScenario([positive]);

    expect(() => reviseScenario(recommended, [excludeObservedValue(scenarioCellKey(positive), '  ')])).toThrow(
      'Informe uma justificativa para excluir um valor positivo observado.',
    );
    const revised = reviseScenario(
      recommended,
      [excludeObservedValue(scenarioCellKey(positive), 'Erro territorial documentado')],
      { createdAfterResults: true },
    );
    expect(revised).toMatchObject({ createdAfterResults: true });
    expect(revised.cells[0]).toMatchObject({ analyticStatus: 'exclude_manual', reasonCode: 'manual_positive_exclusion' });
  });

  it('represents the manual option to exclude a small or rare variable', () => {
    const cells = [
      cell({ territoryId: 'BA' }),
      cell({ territoryId: 'SE', rawValue: 12, sourceStatus: 'observed', analyticStatus: 'include' }),
    ];
    const recommended = createRecommendedScenario(cells);
    const revised = reviseScenario(recommended, [excludeVariable('internacoes', 'Variável rara inadequada para inferência')]);

    expect(revised.cells.map(({ analyticStatus, reasonCode }) => ({ analyticStatus, reasonCode }))).toEqual([
      { analyticStatus: 'exclude_manual', reasonCode: 'manual_variable_exclusion' },
      { analyticStatus: 'exclude_manual', reasonCode: 'manual_variable_exclusion' },
    ]);
  });

  it('uses a variable-specific message when exclusion justification is blank', () => {
    const recommended = createRecommendedScenario([cell()]);

    expect(() => reviseScenario(recommended, [excludeVariable('internacoes', ' ')])).toThrow(
      'Informe uma justificativa para excluir esta variável.',
    );
  });

  it('marks post-result revision as exploratory and exposes comparison hooks without calculating statistics', () => {
    const raw = cell();
    const recommended = createRecommendedScenario([raw]);
    const revised = reviseScenario(
      recommended,
      [useOriginalValue(scenarioCellKey(raw))],
      { createdAfterResults: true },
    );
    const comparison = compareScenarios(recommended, revised, {
      recommended: { n: 0, effectDirection: 'positive', interpretationKey: 'not_significant' },
      revised: { n: 1, effectDirection: 'negative', interpretationKey: 'significant' },
    });

    expect(comparison).toEqual({
      exploratory: true,
      n: { recommended: 0, revised: 1, delta: 1, changed: true },
      effectDirection: { recommended: 'positive', revised: 'negative', changed: true },
      interpretationChanged: true,
    });
    expect(revised.fingerprint).not.toBe(recommended.fingerprint);
  });
});
