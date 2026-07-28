import { getTestById, isTestAvailable, type TestRegistryEntry } from '@/features/tests/registry';
import type { CatalogEntry } from './types';

export interface TestHint {
  testId: string;
  rationale: string;
}

/** CAT-03 — single-variable hint (pair mode deferred). */
export function suggestTestForVariable(entry: CatalogEntry): TestHint {
  const label = entry.label;
  switch (entry.variableType) {
    case 'contagem':
      return {
        testId: 'poisson',
        rationale: `"${label}" é uma contagem. A regressão de Poisson modela fatores que influenciam sua frequência.`,
      };
    case 'taxa':
      return {
        testId: 'prais-winsten',
        rationale: `"${label}" é uma taxa ao longo do tempo. O Prais-Winsten estima tendência temporal com correção de autocorrelação.`,
      };
    case 'numerica':
      return {
        testId: 't-student',
        rationale: `"${label}" é numérica contínua. O t de Student compara médias entre dois grupos de território.`,
      };
    case 'ordinal':
      return {
        testId: 'kruskal-dunn',
        rationale: `"${label}" é ordinal. Kruskal-Wallis/Dunn compara grupos sem exigir normalidade.`,
      };
    case 'categorica':
      return {
        testId: 'qui-quadrado',
        rationale: `"${label}" é categórica. O qui-quadrado testa associação entre categorias.`,
      };
    case 'texto':
    default:
      return {
        testId: 't-student',
        rationale: `"${label}" é descritiva/textual — prepare colunas numéricas e use o t de Student para comparar grupos.`,
      };
  }
}

/** Resolve hint against TEST_REGISTRY; fall back to t-student when unavailable. */
export function resolveHint(entry: CatalogEntry): TestHint & { registry?: TestRegistryEntry } {
  const hint = suggestTestForVariable(entry);
  const registry = getTestById(hint.testId);
  if (!registry || !isTestAvailable(hint.testId)) {
    return {
      testId: 't-student',
      rationale: 'Nenhum teste específico disponível para este tipo — comece pelo t de Student.',
      registry: getTestById('t-student'),
    };
  }
  return { ...hint, registry };
}
