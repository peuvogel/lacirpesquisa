import type { SessionDataset } from '@/shared/session/SessionProvider';
import type { CatalogEntry, PackFile } from './types';

/** CAT-04 — build SessionDataset from catalog selection (stub). */
export function assertCompatibleSelection(
  _selected: CatalogEntry[],
  _packsById: Record<string, PackFile>,
): void {
  throw new Error('not implemented');
}

export function buildSessionDataset(
  _selected: CatalogEntry[],
  _packsById: Record<string, PackFile>,
  _confirmedAt?: number,
): SessionDataset {
  throw new Error('not implemented');
}
