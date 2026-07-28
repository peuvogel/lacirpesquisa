/**
 * Mesorregião presets (IBGE). Selecting a meso selects its municipalities
 * and paints them on the Brazil map (see mesoMembership.json).
 */
import { listMesoMembership } from './mesoMembership';

export interface MesoPreset {
  id: string;
  label: string;
  /** Parent UF siglas (UF-level packs / soft highlight). */
  ufSiglas: readonly string[];
  /** IBGE mesoregion code. */
  mesoCode: string;
}

/** Prefer curated metros first, then the rest of IBGE mesos from membership. */
const CURATED_FIRST: readonly { mesoCode: string; label?: string }[] = [
  { mesoCode: '3515', label: 'Metropolitana de São Paulo' },
  { mesoCode: '3306', label: 'Metropolitana do Rio de Janeiro' },
  { mesoCode: '3107', label: 'Metropolitana de Belo Horizonte' },
  { mesoCode: '2905', label: 'Metropolitana de Salvador' },
  { mesoCode: '2605', label: 'Metropolitana de Recife' },
  { mesoCode: '2303', label: 'Metropolitana de Fortaleza' },
  { mesoCode: '4305', label: 'Metropolitana de Porto Alegre' },
  { mesoCode: '4109', label: 'Metropolitana de Curitiba' },
  { mesoCode: '1303', label: 'Centro Amazonense' },
  { mesoCode: '1503', label: 'Metropolitana de Belém' },
  { mesoCode: '5203', label: 'Centro Goiano' },
  { mesoCode: '5301', label: 'Distrito Federal' },
];

function buildMesoPresets(): MesoPreset[] {
  const all = listMesoMembership();
  const byCode = new Map(all.map((m) => [m.mesoCode, m]));
  const used = new Set<string>();
  const out: MesoPreset[] = [];

  for (const curated of CURATED_FIRST) {
    const entry = byCode.get(curated.mesoCode);
    if (!entry) continue;
    used.add(curated.mesoCode);
    out.push({
      id: `meso.${curated.mesoCode}`,
      label: curated.label ?? entry.label,
      ufSiglas: [entry.ufSigla],
      mesoCode: curated.mesoCode,
    });
  }

  for (const entry of all) {
    if (used.has(entry.mesoCode)) continue;
    out.push({
      id: `meso.${entry.mesoCode}`,
      label: `${entry.label} (${entry.ufSigla})`,
      ufSiglas: [entry.ufSigla],
      mesoCode: entry.mesoCode,
    });
  }

  // Fallback curated-only when membership file is empty (CI before fetch).
  if (out.length === 0) {
    return CURATED_FIRST.map((c) => ({
      id: `meso.${c.mesoCode}`,
      label: c.label ?? c.mesoCode,
      ufSiglas: [],
      mesoCode: c.mesoCode,
    }));
  }

  return out;
}

export const MESO_PRESETS: readonly MesoPreset[] = buildMesoPresets();
