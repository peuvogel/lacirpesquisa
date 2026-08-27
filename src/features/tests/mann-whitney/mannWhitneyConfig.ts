import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { TabularInputOptions } from '@/shared/data-input/types';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

export type MannWhitneyFormat = 'wide' | 'long';

export const LONG_TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    desfecho: ['desfecho', 'outcome', 'valor', 'medida', 'resposta'],
    grupo: ['grupo', 'grupo_fator', 'fator', 'categoria', 'tratamento'],
  },
  requiredKeys: ['desfecho', 'grupo'],
  numericKeys: ['desfecho'],
  expectedFormatLabel: 'desfecho;grupo',
  positionFallback: {
    keysByIndex: ['desfecho', 'grupo'],
    minColumns: 2,
    requiredKeys: ['desfecho', 'grupo'],
    introText: 'Usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = desfecho numérico, 2ª = grupo.',
    headerText: 'Confirme os papéis antes de analisar.',
  },
};

export const WIDE_TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    grupo_a: ['grupo_a', 'grupo a', 'grupo1', 'grupo 1', 'amostra a'],
    grupo_b: ['grupo_b', 'grupo b', 'grupo2', 'grupo 2', 'amostra b'],
  },
  requiredKeys: ['grupo_a', 'grupo_b'],
  numericKeys: ['grupo_a', 'grupo_b'],
  expectedFormatLabel: 'grupo_a;grupo_b',
  positionFallback: {
    keysByIndex: ['grupo_a', 'grupo_b'],
    minColumns: 2,
    requiredKeys: ['grupo_a', 'grupo_b'],
    introText: 'Usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = grupo A, 2ª = grupo B.',
    headerText: 'Os nomes das colunas serão os rótulos dos grupos; confirme os papéis antes de analisar.',
  },
};

/** Backwards-compatible default for existing long-format imports. */
export const TABULAR_OPTIONS = LONG_TABULAR_OPTIONS;

export const MANN_WHITNEY_FORMAT_OPTIONS = [
  {
    id: 'wide',
    title: 'Uma coluna por grupo',
    description: 'Use duas colunas numéricas independentes; o cabeçalho de cada coluna nomeia o grupo.',
  },
  {
    id: 'long',
    title: 'Valor + coluna de grupo',
    description: 'Use uma coluna numérica de valores e outra coluna categórica que identifica cada grupo.',
  },
] as const;

export function getMannWhitneyTabularOptions(format: MannWhitneyFormat): TabularInputOptions {
  return format === 'wide' ? WIDE_TABULAR_OPTIONS : LONG_TABULAR_OPTIONS;
}

export const defaultQuestion = 'As distribuições do desfecho diferem entre os dois grupos independentes?';

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar Mann–Whitney',
    body: 'Para comparar um desfecho ordenável entre exatamente dois grupos independentes quando uma comparação por postos é mais defensável que uma comparação de médias.',
  },
  {
    title: 'O que ele testa',
    body: 'O teste avalia a ordenação e a distribuição dos valores. Ele só pode ser lido como diferença de localização quando os formatos das distribuições são comparáveis.',
  },
  {
    title: 'Independência',
    body: 'Cada linha deve ser uma unidade independente e pertencer a um único grupo. Medidas pareadas ou anos repetidos do mesmo território exigem outro desenho.',
  },
];

export const exampleText = `desfecho;grupo
12,3;Grupo A
14,1;Grupo A
10,9;Grupo A
11,8;Grupo A
13,5;Grupo A
18,2;Grupo B
17,4;Grupo B
19,1;Grupo B
16,8;Grupo B
20,3;Grupo B
`;

export const MANN_WHITNEY_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showPValue', label: 'Mostrar valor de p' },
];

export const MAX_RESEARCH_QUESTION_LENGTH = 500;
