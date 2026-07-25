import { UF_LIST } from './ufCodes';
import { MOCK_VARIABLES_BY_UF } from './mockVariablesByUF';

export interface MockVariable {
  id: string;
  label: string;
  provenance: 'mock' | 'paste';
  unit?: string;
}

/** Stable mock variable IDs for Phase 5 catalog swap (D-14). */
export const MOCK_ANALYSIS_VARIABLES: readonly MockVariable[] = [
  { id: 'mock.internacoes', label: 'Internações hospitalares', provenance: 'mock', unit: 'n' },
  { id: 'mock.obitos', label: 'Óbitos hospitalares', provenance: 'mock', unit: 'n' },
  { id: 'mock.taxa_mortalidade', label: 'Taxa de mortalidade infantil', provenance: 'mock', unit: '‰' },
  { id: 'mock.amputacoes', label: 'Amputações de membros inferiores', provenance: 'mock', unit: 'n' },
  { id: 'mock.cobertura_aps', label: 'Cobertura de atenção primária', provenance: 'mock', unit: '%' },
  { id: 'mock.procedimentos', label: 'Procedimentos ambulatoriais', provenance: 'mock', unit: 'n' },
] as const;

/** Didactic compare-mode years (D-14 stable IDs for Phase 5). */
export const MOCK_TIME_SERIES_YEARS = [2018, 2019, 2020, 2021, 2022] as const;

/** Maps Phase 1 label strings to stable mock variable IDs. */
export const MOCK_LABEL_TO_ID: Record<string, string> = {
  'Internações por causa': 'mock.internacoes',
  'Óbitos hospitalares': 'mock.obitos',
  'Taxa de mortalidade infantil': 'mock.taxa_mortalidade',
  'Cobertura de atenção primária': 'mock.cobertura_aps',
  'Amputações de membros inferiores': 'mock.amputacoes',
  'Procedimentos ambulatoriais': 'mock.procedimentos',
};

export const MOCK_ID_TO_LABEL: Record<string, string> = Object.fromEntries(
  MOCK_ANALYSIS_VARIABLES.map((entry) => [entry.id, entry.label]),
);

const DEFAULT_VARIABLE_ID = MOCK_ANALYSIS_VARIABLES[0]!.id;

/** Population-weighted didactic multipliers by UF sigla (SP highest for internações). */
const UF_WEIGHT: Record<string, number> = Object.fromEntries(
  UF_LIST.map(({ sigla }, index) => {
    if (sigla === 'SP') return [sigla, 1.0];
    if (sigla === 'RJ') return [sigla, 0.62];
    if (sigla === 'MG') return [sigla, 0.58];
    if (sigla === 'BA') return [sigla, 0.45];
    if (sigla === 'RS') return [sigla, 0.38];
    if (sigla === 'PR') return [sigla, 0.35];
    if (sigla === 'PE') return [sigla, 0.28];
    if (sigla === 'CE') return [sigla, 0.26];
    if (sigla === 'DF') return [sigla, 0.22];
    return [sigla, 0.12 + (index % 7) * 0.02];
  }),
);

const IBGE_BY_SIGLA: Record<string, string> = Object.fromEntries(
  UF_LIST.map(({ sigla, ibgeCode }) => [sigla, ibgeCode]),
);

function buildMetric(base: number, spread: number): Record<string, number> {
  return Object.fromEntries(
    UF_LIST.map(({ sigla }) => {
      const weight = UF_WEIGHT[sigla] ?? 0.15;
      const value = Math.round(base * weight + spread * (weight * 0.4));
      return [sigla, Math.max(1, value)];
    }),
  );
}

const METRICS_BY_VARIABLE: Record<string, Record<string, number>> = {
  'mock.internacoes': buildMetric(850_000, 120_000),
  'mock.obitos': buildMetric(42_000, 8_000),
  'mock.taxa_mortalidade': buildMetric(18, 4),
  'mock.amputacoes': buildMetric(2_400, 600),
  'mock.cobertura_aps': Object.fromEntries(
    UF_LIST.map(({ sigla }) => [sigla, Math.round(55 + (UF_WEIGHT[sigla] ?? 0.15) * 35)]),
  ),
  'mock.procedimentos': buildMetric(1_200_000, 180_000),
};

export function getMockVariableById(variableId: string): MockVariable | undefined {
  return MOCK_ANALYSIS_VARIABLES.find((entry) => entry.id === variableId);
}

/** Returns UF metrics keyed by sigla for the active mock variable. */
export function getMockMetricByUf(variableId: string = DEFAULT_VARIABLE_ID): Record<string, number> {
  const metrics = METRICS_BY_VARIABLE[variableId] ?? METRICS_BY_VARIABLE[DEFAULT_VARIABLE_ID]!;
  return { ...metrics };
}

/** Crosswalk helper — same mock value keyed by IBGE two-digit UF code. */
export function getMockMetricByIbgeCode(variableId: string): Record<string, number> {
  const bySigla = getMockMetricByUf(variableId);
  return Object.fromEntries(
    Object.entries(bySigla).map(([sigla, value]) => [IBGE_BY_SIGLA[sigla] ?? sigla, value]),
  );
}

export function getDefaultMockVariableId(): string {
  return DEFAULT_VARIABLE_ID;
}

/** UF sigla → mock variable IDs available in that UF (intersection helper). */
export function getMockVariableIdsByUf(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(MOCK_VARIABLES_BY_UF).map(([uf, labels]) => [
      uf,
      labels
        .map((label) => MOCK_LABEL_TO_ID[label])
        .filter((id): id is string => Boolean(id)),
    ]),
  );
}

/** Time-series metrics keyed by year for compare-mode choropleths. */
export function getMockMetricByUfAndYear(
  variableId: string,
  year: number,
): Record<string, number> {
  const base = getMockMetricByUf(variableId);
  const yearIndex = MOCK_TIME_SERIES_YEARS.indexOf(year as (typeof MOCK_TIME_SERIES_YEARS)[number]);
  const factor = yearIndex >= 0 ? 0.85 + yearIndex * 0.075 : 1;
  return Object.fromEntries(
    Object.entries(base).map(([sigla, value]) => [sigla, Math.max(1, Math.round(value * factor))]),
  );
}
