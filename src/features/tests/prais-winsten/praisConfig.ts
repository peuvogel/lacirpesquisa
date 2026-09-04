import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

import legacyConfig from '../../../../tests/prais-winsten/config.json';
import type { TemporalMode } from '@/shared/data-input/temporalPeriods';
import type { WheelOption } from '@/components/ui/wheelPicker/WheelPicker';

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


/** Opções de "Interpretar períodos como", na ordem da roda. */
export const TEMPORAL_MODE_OPTIONS: WheelOption[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'annual', label: 'Anual' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'dates', label: 'Datas' },
  { value: 'numeric', label: 'Valores numéricos' },
  { value: 'order', label: 'Ordem das linhas' },
];

/**
 * O que cada modo espera achar na coluna de tempo, com o formato que o parser
 * de fato aceita (`temporalPeriods.ts`). A escolha muda o sentido do efeito
 * estimado, então errar o formato não é detalhe: é a diferença entre "queda de
 * 4% ao ano" e "periodicidade não reconhecida".
 */
export const TEMPORAL_MODE_HELP: Record<TemporalMode, { what: string; example: string }> = {
  auto: {
    what: 'Lê a coluna inteira (e pistas do cabeçalho) e decide sozinho a periodicidade. Só assume um formato quando todas as linhas casam com ele.',
    example: '2015, 2016, 2017 vira Anual; 2015-01, 2015-02, 2015-03 vira Mensal.',
  },
  annual: {
    what: 'Um ano de quatro dígitos por linha. O efeito sai por ano.',
    example: '2015, 2016, 2017.',
  },
  semiannual: {
    what: 'Dois períodos por ano. O primeiro semestre é 1; o segundo, 2.',
    example: '2015-S1, S1 2015, 2015/1 ou 2015.1 — todos valem.',
  },
  quarterly: {
    what: 'Quatro períodos por ano, de 1 a 4.',
    example: '2015-T1, T1 2015, Q1 2015 ou 2015.1 até 2015.4.',
  },
  monthly: {
    what: 'Doze períodos por ano, com o mês em dois dígitos.',
    example: '2015-03 ou 03/2015 (março de 2015).',
  },
  dates: {
    what: 'Data completa, com dia. Se todas caírem numa cadência regular (todo dia 1º, todo fim de mês), ele adota essa cadência em vez do dia solto.',
    example: '2015-03-15 ou 15/03/2015.',
  },
  numeric: {
    what: 'A coluna vira um eixo numérico livre: serve para tempo decorrido, dose, idade. Aqui o efeito é por unidade informada, não por ano.',
    example: '1, 2, 3 (semanas após a intervenção) ou 0.5, 1.0, 1.5.',
  },
  order: {
    what: 'Ignora o conteúdo da coluna e usa a ordem em que as linhas estão. O efeito passa a ser por intervalo observado — use quando o rótulo é texto.',
    example: 'Semana 1, Semana 2, Semana 3 — a 1ª linha é o período 1, a 2ª é o 2, e assim por diante.',
  },
};

export function temporalModeLabel(mode: TemporalMode): string {
  return TEMPORAL_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}
