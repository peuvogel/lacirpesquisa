import type { TestRegistryEntry } from '@/features/tests/registry';
import type { CatalogEntry } from './types';

export interface TestHint {
  testId: string;
  rationale: string;
}

/** CAT-03 — single-variable hint (pair mode deferred). */
export function suggestTestForVariable(_entry: CatalogEntry): TestHint {
  throw new Error('not implemented');
}

export function resolveHint(
  _entry: CatalogEntry,
): TestHint & { registry?: TestRegistryEntry } {
  throw new Error('not implemented');
}
