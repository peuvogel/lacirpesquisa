import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

import legacyConfig from '../../../../tests/prais-winsten/config.json';

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    id: ['id', 'unidade', 'uf', 'serie', 'série', 'nome', 'local'],
    tempo: [
      'tempo',
      'ano',
      'year',
      'periodo',
      'período',
      'x',
      'variavel_x',
      'variável_x',
      'variavel_1',
      'variavel 1',
      'variavel1',
      'semestre',
      'semester',
      'trimestre',
      'quarter',
      'mes',
      'mês',
      'data',
    ],
    variavel_y: [
      'variavel_y',
      'variável_y',
      'variavel y',
      'variável y',
      'y',
      'taxa',
      'valor',
      'desfecho',
      'variavel_2',
      'variavel 2',
      'variavel2',
      'indicador',
      'internacoes',
      'internações',
    ],
    observacao_opcional: ['observacao', 'observação', 'obs', 'comentario', 'comentário'],
  },
  requiredKeys: ['tempo', 'variavel_y'],
  numericKeys: ['variavel_y'],
  temporalKeys: ['tempo'],
  expectedFormatLabel: 'variavel_1;variavel_2',
  positionFallback: {
    keysByIndex: ['tempo', 'variavel_y', 'observacao_opcional'],
    minColumns: 2,
    requiredKeys: ['tempo', 'variavel_y'],
    introText:
      'Não reconhecemos os nomes padrão das colunas. Usamos a estrutura da planilha por posição: 1ª coluna = variável 1, 2ª = variável 2.',
    headerText: 'Os nomes reais do cabeçalho foram mantidos na interface.',
    failureMessage:
      'Não conseguimos identificar automaticamente as colunas nem usar a estrutura por posição.',
    minimumColumnsText: 'Esperávamos pelo menos 2 colunas úteis: variável 1 e variável 2.',
    consistencyText:
      'A primeira linha precisa funcionar como cabeçalho, a 1ª coluna deve representar tempo/ordem e a 2ª coluna precisa conter valores numéricos válidos.',
  },
};

export const didacticCards: DidacticCard[] = legacyConfig.didacticCards.map((card) => ({
  title: card.title,
  body: card.text,
}));

function buildExampleText(): string {
  const headers = legacyConfig.exampleHeaders ?? ['Ano', 'Internacoes'];
  const rows = legacyConfig.exampleRows ?? [];
  return [
    headers.join(';'),
    ...rows.map((row) => [String(row[0] ?? ''), String(row[1] ?? '')].join(';')),
  ].join('\n');
}

export const exampleText = buildExampleText();

export const CHART_PRESET_LABELS = {
  trend: 'Tendência observada e ajustada',
  residual: 'Resíduos ao longo do tempo',
} as const;

export const PRAIS_TREND_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showFittedLine', label: 'Mostrar linha ajustada' },
  { id: 'showPointLabels', label: 'Mostrar rótulos nos pontos' },
  { id: 'logScaleY', label: 'Escala logarítmica (Y)' },
];

export const PRAIS_RESIDUAL_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showZeroLine', label: 'Linha zero nos resíduos' },
];
