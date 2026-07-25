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
        testId: 'demo',
        rationale: `"${label}" é descritiva/textual — use o fluxo de dados para preparar colunas antes de um teste formal.`,
      };
  }
}

/** Resolve hint against TEST_REGISTRY; fall back to demo when unavailable (D-13). */
export function resolveHint(entry: CatalogEntry): TestHint & { registry?: TestRegistryEntry } {
  const hint = suggestTestForVariable(entry);
  const registry = getTestById(hint.testId);
  if (!registry || (hint.testId !== 'demo' && !isTestAvailable(hint.testId))) {
    return {
      testId: 'demo',
      rationale: 'Nenhum teste disponível para este tipo ainda — explore o fluxo demonstração.',
      registry: getTestById('demo'),
    };
  }
  return { ...hint, registry };
}
