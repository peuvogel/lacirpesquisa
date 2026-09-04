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

export const didacticCards: DidacticCard[] = legacyConfig.didacticCards.map((card) => ({
  title: card.title,
  body: card.text,
}));

export const exampleText: string = legacyConfig.exampleText;

export const MODE_OPTIONS = [
  {
    id: 'independent',
    title: 't independente (Welch)',
    description:
      'Dois conjuntos de unidades diferentes, sem ligação entre uma linha e outra. '
      + 'Welch não exige que os grupos tenham o mesmo tamanho nem a mesma variabilidade, '
      + 'por isso é a escolha segura na maioria dos casos reais. '
      + 'Ex: comparar a taxa de internação dos municípios do Nordeste com a dos municípios do Sudeste. '
      + 'São municípios distintos, e nada liga o 1º do Nordeste ao 1º do Sudeste.',
  },
  {
    id: 'paired',
    title: 't pareado',
    description:
      'A mesma unidade medida duas vezes, uma em cada coluna, sempre na mesma linha. '
      + 'O teste olha a diferença dentro de cada par, o que remove as diferenças entre unidades. '
      + 'Ex: a taxa de cada município em 2019 e a do MESMO município em 2023. '
      + 'A linha 1 é sempre o mesmo município nas duas colunas. Trocar a ordem de uma delas invalida o teste.',
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
  { id: 'showPValue', label: 'Mostrar valor de p das comparações' },
];
