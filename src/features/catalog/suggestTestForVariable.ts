import type { CatalogEntry } from './types';

export interface TestHint {
  testId: string;
  rationale: string;
}

/**
 * Legacy compatibility adapter. A catalog type/label contains neither the
 * research design nor the observed values required to release a test.
 */
export function suggestTestForVariable(_entry: CatalogEntry): null {
  return null;
}

/** Test hints are resolved only by the value-aware research eligibility engine. */
export function resolveHint(_entry: CatalogEntry): null {
  return null;
}
