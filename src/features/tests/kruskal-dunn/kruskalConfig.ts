import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TABULAR_OPTIONS: TabularInputOptions = {
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
    introText:
      'Não reconhecemos os nomes padrão das colunas, então usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = desfecho numérico, 2ª = grupo categórico.',
    headerText: 'Os nomes do cabeçalho foram aproveitados automaticamente na interface.',
  },
};

export const defaultQuestion =
  'Há diferença na distribuição do desfecho entre os grupos (comparação por postos)?';

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar Kruskal-Wallis',
    body: 'Alternativa não paramétrica à ANOVA: compara a distribuição (postos) de um desfecho numérico entre três ou mais grupos. Não exige normalidade dentro de cada grupo — útil quando os dados são assimétricos ou com outliers.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna numérica (desfecho) e uma coluna categórica (grupo). Cada linha é uma observação. Com apenas dois grupos, Mann-Whitney pode ser mais direto; com três ou mais, o Dunn pós-hoc indica quais pares diferem.',
  },
  {
    title: 'Pós-hoc Dunn (Holm)',
    body: 'Quando o H omnibus é significativo, a tabela par a par mostra contrastes, estatística z e p ajustado pelo método de Holm. Ordenamos por p ajustado crescente para destacar as diferenças mais evidentes.',
  },
];

const fixturePath = join(__dirname, '../../../test/fixtures/tests/kruskal-dunn-exemplo.txt');
export const exampleText: string = readFileSync(fixturePath, 'utf8');

export const CHART_PRESET_LABELS = {
  medians: 'Medianas por grupo',
  heatmap: 'Mapa de p ajustado (Dunn)',
} as const;

export const KRUSKAL_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showMeanValues', label: 'Mostrar valor das medianas' },
  { id: 'showPValue', label: 'Mostrar p omnibus no gráfico' },
];

export const MAX_RESEARCH_QUESTION_LENGTH = 500;
