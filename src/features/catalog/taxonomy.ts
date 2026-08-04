/**
 * Measure × disease taxonomy — UI picks disease, then measures / place context vars.
 * Catalog loadable ids remain `sih.{disease}.{measure}` for pack columns.
 * Disease list: full TabNet Lista Morb CID-10 (+ procedimento amputação) — see diseases.lista.json.
 */

import diseasesLista from './diseases.lista.json';

export interface MeasureDef {
  id: string;
  label: string;
  /** Short UI label (uppercase didactic). */
  shortLabel: string;
  variableType: 'contagem' | 'taxa' | 'numerica';
  unit?: string;
}

export interface DiseaseDef {
  id: string;
  label: string;
  /** TabNet filter kind */
  filterKind: 'lista_morb' | 'procedimento';
  /** Internal TabNet code */
  tabnetCode: string;
  /**
   * CID-10 codes for this Lista Morb category (e.g. "I74", "C00-C14").
   * Null for procedimentos that are not Lista Morb.
   */
  cid?: string | null;
  packId: string;
  domain: string;
}

/** Place / period context variables (territory denominators and supply). */
export interface PlaceContextVariableDef {
  id: string;
  label: string;
  shortLabel: string;
  /** Grouping in the Mapas step-3 UI */
  kind: 'lugar' | 'periodo';
  /**
   * Why the variable may be unavailable as a loadable pack on the site.
   * Selection is still allowed — the analysis can proceed with paste / scrape later.
   */
  unavailableReason: string;
}

/** Analysis measures shown in the disease-variables step. */
export const MEASURES: readonly MeasureDef[] = [
  { id: 'internacoes', label: 'Internações', shortLabel: 'INTERNAÇÕES', variableType: 'contagem', unit: 'n' },
  { id: 'obitos', label: 'Óbitos hospitalares', shortLabel: 'ÓBITOS', variableType: 'contagem', unit: 'n' },
  { id: 'custo', label: 'Custo (valor total)', shortLabel: 'CUSTO', variableType: 'numerica', unit: 'R$' },
  {
    id: 'dias_permanencia',
    label: 'Dias de permanência',
    shortLabel: 'PERMANÊNCIA',
    variableType: 'contagem',
    unit: 'dias',
  },
  {
    id: 'taxa_mortalidade',
    label: 'Taxa de mortalidade hospitalar',
    shortLabel: 'MORTALIDADE',
    variableType: 'taxa',
    unit: '%',
  },
  {
    id: 'taxa_internacao',
    label: 'Taxa de internação (por 100 mil)',
    shortLabel: 'TX INTERNAÇÃO',
    variableType: 'taxa',
    unit: 'por 100 mil',
  },
] as const;

/**
 * Full SIH Lista Morb CID-10 (+ procedimento) — synced from TabNet nibr.def / diseases.json.
 */
export const DISEASES: readonly DiseaseDef[] = diseasesLista as DiseaseDef[];

/**
 * Variables of the place (and shared period denominators), independent of disease.
 * Toggle uses the catalog id directly (not measure×disease).
 */
export const PLACE_CONTEXT_VARIABLES: readonly PlaceContextVariableDef[] = [
  {
    id: 'sidra.populacao_residente',
    label: 'População residente (SIDRA)',
    shortLabel: 'POPULAÇÃO',
    kind: 'periodo',
    unavailableReason: 'Pack UF×ano ainda não gerado nesta instalação.',
  },
  {
    id: 'ref.sidra.6579',
    label: 'Estimativas populacionais anuais (SIDRA 6579)',
    shortLabel: 'SIDRA 6579',
    kind: 'periodo',
    unavailableReason:
      'Referência oficial; no v1 não há pack tidy — use após scrape ou cole a série.',
  },
  {
    id: 'ref.sidra.9514',
    label: 'População do Censo 2022 (SIDRA 9514)',
    shortLabel: 'CENSO 2022',
    kind: 'periodo',
    unavailableReason: 'Corte censitário pontual; sem série anual empacotada no site.',
  },
  {
    id: 'cnes.medicos_vasculares_sus',
    label: 'Médicos vasculares no SUS (CNES)',
    shortLabel: 'MÉDICOS VASO',
    kind: 'lugar',
    unavailableReason: 'Pack CNES UF×ano ainda não gerado nesta instalação.',
  },
  {
    id: 'cnes.medicos_vasculares_por_100k',
    label: 'Densidade de médicos vasculares SUS (por 100 mil)',
    shortLabel: 'MÉDICOS/100k',
    kind: 'lugar',
    unavailableReason: 'Depende do pack CNES + população; ainda não gerado aqui.',
  },
  {
    id: 'ref.cnes.prid02',
    label: 'Profissionais identificados no CNES (prid02)',
    shortLabel: 'CNES PRID02',
    kind: 'lugar',
    unavailableReason: 'Tabela TabNet de referência — sem pack UF×ano no catálogo v1.',
  },
  {
    id: 'ref.cnes.leiint',
    label: 'Leitos de internação (CNES)',
    shortLabel: 'LEITOS CNES',
    kind: 'lugar',
    unavailableReason: 'Indicador de capacidade; referência sem série empacotada no v1.',
  },
  {
    id: 'ref.cnes.estabs',
    label: 'Tipos de estabelecimentos (CNES)',
    shortLabel: 'ESTABS CNES',
    kind: 'lugar',
    unavailableReason: 'Contagem de estabelecimentos; sem pack tidy UF×ano no v1.',
  },
  {
    id: 'ref.egestor.cobertura_aps',
    label: 'Cobertura da atenção primária (e-Gestor APS)',
    shortLabel: 'COBERTURA APS',
    kind: 'lugar',
    unavailableReason: 'Dados no portal e-Gestor; ainda não há scrape → pack no site.',
  },
  {
    id: 'ref.opendatasus.leitos',
    label: 'Hospitais e leitos (OpenDataSUS)',
    shortLabel: 'LEITOS API',
    kind: 'lugar',
    unavailableReason: 'API MS referenciada; resposta não empacotada no catálogo v1.',
  },
  {
    id: 'ref.opendatasus.ubs',
    label: 'Unidades básicas de saúde (OpenDataSUS)',
    shortLabel: 'UBS',
    kind: 'lugar',
    unavailableReason: 'Catálogo OpenDataSUS; sem série UF×ano no pack v1.',
  },
  {
    id: 'ref.ans.dados_setor',
    label: 'Dados do setor de saúde suplementar (ANS)',
    shortLabel: 'ANS',
    kind: 'lugar',
    unavailableReason: 'Indicadores ANS externos — referência, sem pack didático v1.',
  },
  {
    id: 'ref.atlas.brasil',
    label: 'Atlas do Desenvolvimento Humano (IDHM)',
    shortLabel: 'IDHM',
    kind: 'lugar',
    unavailableReason: 'Indicadores municipais/UF do Atlas; não empacotados no v1.',
  },
  {
    id: 'ref.ipea.atlas_violencia',
    label: 'Atlas da Violência (IPEA)',
    shortLabel: 'VIOLÊNCIA',
    kind: 'lugar',
    unavailableReason: 'Série IPEA de referência; sem pack no catálogo didático v1.',
  },
  {
    id: 'ref.covid.opendata',
    label: 'COVID-19 — dados abertos oficiais',
    shortLabel: 'COVID-19',
    kind: 'periodo',
    unavailableReason: 'Portal de dados abertos MS; não faz parte dos packs SIH v1.',
  },
] as const;

/** Map measure id → column suffix used in packs / columnMap. */
export const MEASURE_COLUMN_SUFFIX: Record<string, string> = {
  internacoes: 'internacoes',
  obitos: 'obitos',
  custo: 'valor_total',
  dias_permanencia: 'dias_permanencia',
  taxa_mortalidade: 'taxa_mortalidade',
  taxa_internacao: 'taxa_internacao',
};

/** Legacy pack ids that differ from the canonical measure×disease form. */
const CATALOG_ID_ALIASES: Record<string, string> = {
  'sih.embolia_e_trombose_arteriais.taxa_internacao': 'sih.embolia_e_trombose_arteriais.taxa_internacao_100k',
  'sih.amputacao_mmii.taxa_internacao': 'sih.amputacao_mmii.taxa_internacao_100k',
};

const MEASURE_ID_FROM_SUFFIX: Record<string, string> = {
  taxa_internacao_100k: 'taxa_internacao',
  valor_total: 'custo',
  custo: 'custo',
};

/** Resolve catalog entry id for a measure×disease pair (legacy pack naming). */
export function catalogIdFor(measureId: string, diseaseId: string): string {
  if (diseaseId === 'embolia_e_trombose_arteriais') {
    const map: Record<string, string> = {
      internacoes: 'sih.embolia_e_trombose_arteriais.internacoes',
      obitos: 'sih.embolia_e_trombose_arteriais.obitos',
      dias_permanencia: 'sih.embolia_e_trombose_arteriais.dias_permanencia',
      taxa_mortalidade: 'sih.embolia_e_trombose_arteriais.taxa_mortalidade',
      taxa_internacao: 'sih.embolia_e_trombose_arteriais.taxa_internacao_100k',
      custo: 'sih.embolia_e_trombose_arteriais.custo',
    };
    return map[measureId] ?? `sih.${diseaseId}.${measureId}`;
  }
  if (diseaseId === 'amputacao_mmii') {
    const map: Record<string, string> = {
      internacoes: 'sih.amputacao_mmii.internacoes',
      obitos: 'sih.amputacao_mmii.obitos',
      taxa_mortalidade: 'sih.amputacao_mmii.taxa_mortalidade',
      taxa_internacao: 'sih.amputacao_mmii.taxa_internacao_100k',
      custo: 'sih.amputacao_mmii.custo',
      dias_permanencia: 'sih.amputacao_mmii.dias_permanencia',
    };
    return map[measureId] ?? `sih.${diseaseId}.${measureId}`;
  }
  const canonical = `sih.${diseaseId}.${measureId}`;
  return CATALOG_ID_ALIASES[canonical] ?? canonical;
}

export function parseCatalogId(id: string): { measureId: string; diseaseId: string } | null {
  const m = id.match(/^sih\.([a-z0-9_]+)\.([a-z0-9_]+)$/);
  if (!m) return null;
  const diseaseId = m[1]!;
  const rawMeasure = m[2]!;
  const measureId = MEASURE_ID_FROM_SUFFIX[rawMeasure] ?? rawMeasure;
  if (!DISEASES.some((d) => d.id === diseaseId)) return null;
  if (!MEASURES.some((x) => x.id === measureId)) return null;
  return { diseaseId, measureId };
}

export function isPlaceContextVariableId(id: string): boolean {
  return PLACE_CONTEXT_VARIABLES.some((v) => v.id === id);
}
