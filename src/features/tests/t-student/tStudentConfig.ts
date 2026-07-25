import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

import legacyConfig from '../../../../tests/t-student/config.json';

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    unidade: ['unidade', 'uf', 'unidade_analitica', 'unidade analitica', 'estado'],
    grupo_a: ['grupo_a', 'grupo a', 'grupo1', 'grupo_1', 'grupo 1'],
    grupo_b: ['grupo_b', 'grupo b', 'grupo2', 'grupo_2', 'grupo 2'],
    observacao_opcional: ['observacao', 'observacao opcional', 'obs', 'comentario', 'comentario opcional'],
  },
  requiredKeys: ['grupo_a', 'grupo_b'],
  numericKeys: ['grupo_a', 'grupo_b'],
  expectedFormatLabel: 'unidade;grupo_a;grupo_b;observacao_opcional',
  positionFallback: {
    keysByIndex: ['unidade', 'grupo_a', 'grupo_b', 'observacao_opcional'],
    minColumns: 3,
    requiredKeys: ['grupo_a', 'grupo_b'],
    introText:
      'Não reconhecemos os nomes padrão das colunas, então usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = identificação, 2ª = grupo A, 3ª = grupo B.',
    headerText: 'Os nomes do cabeçalho foram aproveitados automaticamente na interface.',
  },
};

export const defaultQuestion: string = legacyConfig.defaultQuestion;

export const didacticCards: DidacticCard[] = legacyConfig.didacticCards.map((card) => ({
  title: card.title,
  body: card.text,
}));

export const exampleText: string = legacyConfig.exampleText;

export const MODE_OPTIONS = [
  {
    id: 'independent',
    title: 't independente (Welch)',
    description: 'Compare dois grupos distintos; cada coluna pode ter linhas válidas independentes.',
  },
  {
    id: 'paired',
    title: 't pareado',
    description: 'Compare as mesmas unidades nas duas colunas, na mesma ordem.',
  },
] as const;

export type TStudentMode = (typeof MODE_OPTIONS)[number]['id'];

export const CHART_PRESET_LABELS = {
  distribution: 'Distribuição por grupo',
  diff: 'Diferença de médias (IC95%)',
  meansBar: 'Barras de médias',
} as const;

export const T_STUDENT_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showMeanValues', label: 'Mostrar valor das médias' },
];

export const MAX_RESEARCH_QUESTION_LENGTH = 500;
