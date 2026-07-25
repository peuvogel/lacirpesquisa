import type { SessionDataset } from '@/shared/session/SessionProvider';
import type { CatalogEntry, PackFile, PackRow } from './types';

const REQUIRED_JOIN_KEYS = ['uf_codigo', 'ano'] as const;

function cellValue(row: PackRow | undefined, columnKey: string): string {
  if (!row) return 'n/d';
  const v = row[columnKey];
  return v === null || v === undefined ? 'n/d' : String(v);
}

function rowKey(ufCodigo: string, ano: number | string): string {
  return `${ufCodigo}::${ano}`;
}

function packHasJoinKeys(pack: PackFile): boolean {
  return REQUIRED_JOIN_KEYS.every((key) => pack.keys.includes(key));
}

/**
 * UI preflight for multi-select load (D-16).
 * Throws a clear PT-BR Error when selection cannot form a tidy UF×ano table.
 */
export function assertCompatibleSelection(
  selected: CatalogEntry[],
  packsById: Record<string, PackFile>,
): void {
  if (selected.length === 0) {
    throw new Error('Selecione ao menos uma variável carregável.');
  }
  if (selected.some((e) => !e.loadable || !e.packId || !e.columnKey)) {
    throw new Error('Só variáveis carregáveis podem ir para a Estatística.');
  }

  const packs: PackFile[] = [];
  for (const entry of selected) {
    const pack = packsById[entry.packId!];
    if (!pack) {
      throw new Error(`Pack não encontrado para a variável "${entry.label}".`);
    }
    if (!pack.metricKeys.includes(entry.columnKey!)) {
      throw new Error(
        `A coluna "${entry.columnKey}" não existe no pack ${entry.packId}.`,
      );
    }
    packs.push(pack);
  }

  const uniquePacks = [...new Map(packs.map((p) => [p.packId, p])).values()];
  for (const pack of uniquePacks) {
    if (!packHasJoinKeys(pack)) {
      throw new Error(
        'Seleção incompatível: só é possível juntar packs com chaves uf_codigo e ano.',
      );
    }
  }

  if (uniquePacks.length > 1) {
    const grains = new Set(uniquePacks.map((p) => p.grain));
    if (grains.size > 1) {
      throw new Error(
        'Seleção incompatível: packs com granularidades diferentes não podem ser carregados juntos.',
      );
    }
  }
}

function indexPackRows(pack: PackFile): Map<string, PackRow> {
  const map = new Map<string, PackRow>();
  for (const row of pack.rows) {
    map.set(rowKey(String(row.uf_codigo), row.ano), row);
  }
  return map;
}

/**
 * CAT-04 — build tidy UF×ano SessionDataset for Estatística handoff (D-14/D-16).
 * Left-joins additional packs onto the first selected pack's rows; never invents numbers.
 */
export function buildSessionDataset(
  selected: CatalogEntry[],
  packsById: Record<string, PackFile>,
  confirmedAt: number = Date.now(),
): SessionDataset {
  assertCompatibleSelection(selected, packsById);

  const primaryPack = packsById[selected[0]!.packId!]!;
  const packIndexes = new Map<string, Map<string, PackRow>>();
  for (const entry of selected) {
    const packId = entry.packId!;
    if (!packIndexes.has(packId)) {
      packIndexes.set(packId, indexPackRows(packsById[packId]!));
    }
  }

  const headers = ['uf_codigo', 'uf', 'ano', ...selected.map((e) => e.label)];
  const rows = primaryPack.rows.map((baseRow) => {
    const key = rowKey(String(baseRow.uf_codigo), baseRow.ano);
    const metricCells = selected.map((entry) => {
      const index = packIndexes.get(entry.packId!)!;
      const row = entry.packId === primaryPack.packId ? baseRow : index.get(key);
      return cellValue(row, entry.columnKey!);
    });
    return [String(baseRow.uf_codigo), String(baseRow.uf), String(baseRow.ano), ...metricCells];
  });

  const cite = selected
    .map((e) => `${e.sourceSystem} · ${e.tableOrIndicator}`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' · ');

  return {
    headers,
    rows,
    sourceLabel: `Catálogo LACIR · ${cite} · ${selected[0]!.period}`,
    confirmedAt,
  };
}
