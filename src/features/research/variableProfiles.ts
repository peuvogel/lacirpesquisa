import type { VariableProfile } from './types';

const internacoes: VariableProfile = {
  variableId: 'internacoes',
  label: 'Internações',
  variableType: 'count',
  unit: 'internações',
  temporalAggregation: 'sum',
};

const obitos: VariableProfile = {
  variableId: 'obitos',
  label: 'Óbitos hospitalares',
  variableType: 'count',
  unit: 'óbitos',
  temporalAggregation: 'sum',
};

const valorTotal: VariableProfile = {
  variableId: 'valor_total',
  label: 'Valor total',
  variableType: 'numeric',
  unit: 'BRL',
  temporalAggregation: 'sum',
};

const diasPermanencia: VariableProfile = {
  variableId: 'dias_permanencia',
  label: 'Dias de permanência',
  variableType: 'numeric',
  unit: 'dias',
  temporalAggregation: 'sum',
};

const taxaMortalidade: VariableProfile = {
  variableId: 'taxa_mortalidade',
  label: 'Taxa de mortalidade',
  variableType: 'rate',
  unit: '%',
  numeratorVariableId: 'obitos',
  denominatorVariableId: 'internacoes',
  rateMultiplier: 100,
  temporalAggregation: 'recompute_rate',
};

const taxaInternacao100k: VariableProfile = {
  variableId: 'taxa_internacao_100k',
  label: 'Taxa de internação por 100 mil',
  variableType: 'rate',
  unit: 'por 100 mil habitantes',
  numeratorVariableId: 'internacoes',
  denominatorVariableId: 'populacao',
  rateMultiplier: 100_000,
  temporalAggregation: 'recompute_rate',
};

const taxaObitos100k: VariableProfile = {
  variableId: 'taxa_obitos_100k',
  label: 'Taxa de óbitos por 100 mil',
  variableType: 'rate',
  unit: 'por 100 mil habitantes',
  numeratorVariableId: 'obitos',
  denominatorVariableId: 'populacao',
  rateMultiplier: 100_000,
  temporalAggregation: 'recompute_rate',
};

const mediaPermanencia: VariableProfile = {
  variableId: 'media_permanencia_calculada',
  label: 'Média de permanência',
  variableType: 'numeric',
  unit: 'dias por internação',
  numeratorVariableId: 'dias_permanencia',
  denominatorVariableId: 'internacoes',
  exposureVariableId: 'internacoes',
  temporalAggregation: 'weighted_mean',
};

const desfechoHospitalar: VariableProfile = {
  variableId: 'desfecho_hospitalar',
  label: 'Desfecho hospitalar (óbito/não óbito)',
  variableType: 'categorical',
  numeratorVariableId: 'obitos',
  denominatorVariableId: 'internacoes',
  temporalAggregation: 'point_only',
};

export const VARIABLE_PROFILES: readonly VariableProfile[] = [
  internacoes,
  obitos,
  valorTotal,
  diasPermanencia,
  taxaMortalidade,
  taxaInternacao100k,
  taxaObitos100k,
  mediaPermanencia,
  desfechoHospitalar,
];

const VARIABLE_PROFILE_ID_BY_MAP_MEASURE: Readonly<Record<string, string>> = {
  custo: 'valor_total',
  taxa_internacao: 'taxa_internacao_100k',
};

/** Converte o id didático usado em Mapas para o indicador analítico carregável. */
export function variableProfileIdForMapMeasure(measureId: string): string {
  return VARIABLE_PROFILE_ID_BY_MAP_MEASURE[measureId] ?? measureId;
}

export function findVariableProfile(variableId: string): VariableProfile | undefined {
  return VARIABLE_PROFILES.find((profile) => profile.variableId === variableId);
}
