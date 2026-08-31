import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

import legacyConfig from '../../../../tests/correlacao/config.json';

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    id: ['id', 'unidade', 'uf', 'nome', 'rotulo', 'identificador'],
    variavel_x: ['variavel_x', 'variavel x', 'x', 'grupo_x'],
    variavel_y: ['variavel_y', 'variavel y', 'y', 'grupo_y'],
    observacao_opcional: ['observacao', 'observacao opcional', 'obs', 'comentario', 'comentario opcional'],
  },
  requiredKeys: ['variavel_x', 'variavel_y'],
  numericKeys: ['variavel_x', 'variavel_y'],
  expectedFormatLabel: 'id;variavel_x;variavel_y;observacao_opcional',
  positionFallback: {
    keysByIndex: ['id', 'variavel_x', 'variavel_y', 'observacao_opcional'],
    minColumns: 3,
    requiredKeys: ['variavel_x', 'variavel_y'],
    introText:
      'Não reconhecemos os nomes padrão das colunas, então usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = identificação, 2ª = variável X, 3ª = variável Y.',
    headerText: 'Os nomes do cabeçalho foram aproveitados automaticamente na interface.',
  },
};

export const didacticCards: DidacticCard[] = legacyConfig.didacticCards.map((card) => ({
  title: card.title,
  body: card.text,
}));

const padraoExample = legacyConfig.examples.find((example) => example.id === 'padrao');
export const exampleText: string =
  padraoExample?.text ??
  'id;variavel_x;variavel_y;observacao_opcional\nUF1;12,3;45,2;\nUF2;14,1;43,8;\nUF3;10,9;48,0;\nUF4;15,2;42,7;';

export const METHOD_OPTIONS = [
  {
    id: 'pearson',
    title: 'Pearson',
    description: 'Associação linear entre duas variáveis quantitativas.',
  },
  {
    id: 'spearman',
    title: 'Spearman',
    description: 'Associação monótona; mais robusta a outliers e curvas.',
  },
] as const;

export type CorrelacaoMethod = (typeof METHOD_OPTIONS)[number]['id'];

/** Display labels aligned with Datawrapper-style catalog names. */
export const CHART_PRESET_LABELS = {
  scatter: 'Dispersão',
  rankScatter: 'Dispersão com ranks',
  scatterWithFit: 'Dispersão + linha de ajuste',
} as const;

export const CORRELACAO_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showRegressionLine', label: 'Linha de regressão' },
  { id: 'highlightOutliers', label: 'Destacar outliers / gaps de posto' },
  { id: 'showEquation', label: 'Mostrar equação / coeficiente no gráfico' },
];
