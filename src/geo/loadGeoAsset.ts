/**
 * MAP-05 offline-only contract: all map geometry is served from bundled static JSON
 * via dynamic import(). Runtime fetch to IBGE or external APIs is forbidden — loaders
 * throw if assets are missing; run scripts/fetch-geo-assets.mjs at build time.
 */
import type { Topology } from 'topojson-specification';
import type { MuniEntry } from './types';

export type GeoAssetKind = 'muni' | 'meso' | 'health-macro';

/** All 27 federative units — two-digit IBGE codes. */
const ALL_UF_IBGE = [
  '11', '12', '13', '14', '15', '16', '17',
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '31', '32', '33', '35',
  '41', '42', '43',
  '50', '51', '52', '53',
] as const;

const UF_SIGLA_BY_IBGE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

function muniLoader(ufIbge: string): () => Promise<{ default: Topology }> {
  return () =>
    import(`@/geo/topo/muni-${ufIbge}.json`) as unknown as Promise<{ default: Topology }>;
}

/** Dynamic import loaders — no runtime fetch (MAP-05). Vite code-splits each JSON chunk. */
const MUNI_LOADERS: Record<string, () => Promise<{ default: Topology }>> = Object.fromEntries(
  ALL_UF_IBGE.map((code) => [code, muniLoader(code)]),
);

const MESO_LOADER = (): Promise<{ default: Topology }> =>
  import('@/geo/topo/br-meso.json') as unknown as Promise<{ default: Topology }>;

/** Didactic BA sample — full MS/SUS health-macro.json ships after manual fetch + mapshaper. */
const HEALTH_MACRO_LOADER = (): Promise<{ default: Topology }> =>
  import('@/geo/topo/health-macro.sample.json') as unknown as Promise<{ default: Topology }>;

const NAME_TABLE_LOADERS: Record<string, () => Promise<{ default: MuniEntry[] }>> = Object.fromEntries(
  Object.entries(UF_SIGLA_BY_IBGE).map(([ibge, sigla]) => [
    sigla,
    () => import(`@/geo/nameTables/muni-${sigla}.json`) as Promise<{ default: MuniEntry[] }>,
  ]),
);

/** Load municipality TopoJSON for a UF by IBGE code (e.g. "29" for BA). */
export async function loadMuniTopo(ufIbge: string): Promise<Topology> {
  const loader = MUNI_LOADERS[ufIbge];
  if (!loader) {
    throw new Error(`Sem malha municipal para UF IBGE ${ufIbge}. Execute scripts/fetch-geo-assets.mjs.`);
  }
  try {
    const mod = await loader();
    return mod.default;
  } catch {
    throw new Error(`Sem malha municipal para UF IBGE ${ufIbge}. Execute scripts/fetch-geo-assets.mjs.`);
  }
}

/** Load Brazil mesorregiões TopoJSON (sample in CI; full br-meso.json from fetch script). */
export async function loadMesoTopo(): Promise<Topology> {
  const mod = await MESO_LOADER();
  return mod.default;
}

/**
 * Load health macro-region TopoJSON (MAP-08).
 * CI uses health-macro.sample.json (didactic BA subset); production asset is separate from br-meso.json.
 */
export async function loadHealthMacroTopo(): Promise<Topology> {
  const mod = await HEALTH_MACRO_LOADER();
  return mod.default;
}

/** Load municipality name table for a UF sigla. */
export async function loadMuniNameTable(ufSigla: string): Promise<MuniEntry[]> {
  const normalized = ufSigla.toUpperCase();
  const loader = NAME_TABLE_LOADERS[normalized];
  if (!loader) {
    throw new Error(`Sem tabela de nomes para UF ${ufSigla}. Execute scripts/fetch-geo-assets.mjs.`);
  }
  try {
    const mod = await loader();
    return mod.default;
  } catch {
    throw new Error(`Sem tabela de nomes para UF ${ufSigla}. Execute scripts/fetch-geo-assets.mjs.`);
  }
}

/** Unified loader by kind + key. */
export async function loadGeoAsset(kind: GeoAssetKind, key?: string): Promise<Topology | MuniEntry[]> {
  switch (kind) {
    case 'muni':
      if (!key) throw new Error('loadGeoAsset(muni) requires UF IBGE code');
      return loadMuniTopo(key);
    case 'meso':
      return loadMesoTopo();
    case 'health-macro':
      return loadHealthMacroTopo();
    default:
      throw new Error(`Unknown geo asset kind: ${kind satisfies never}`);
  }
}

export { ALL_UF_IBGE, UF_SIGLA_BY_IBGE };
