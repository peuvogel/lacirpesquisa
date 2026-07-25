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
  'Há diferença entre as médias dos grupos para o desfecho analisado?';

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar ANOVA de uma via',
    body: 'Compare médias de um desfecho numérico entre três ou mais grupos definidos por um fator categórico. O teste omnibus responde se algum grupo difere; o Tukey HSD aponta quais pares diferem, com p ajustado.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna numérica (desfecho) e uma coluna categórica (grupo). Cada linha é uma observação. Grupos com poucas repetições ou tamanhos muito desiguais merecem cautela — veja os avisos de pressupostos.',
  },
  {
    title: 'Pós-hoc Tukey',
    body: 'Quando o F omnibus é significativo, a tabela par a par mostra contrastes, estatística, p ajustado e intervalo de confiança. Ordenamos por p ajustado crescente para destacar as diferenças mais evidentes.',
  },
];

const fixturePath = join(__dirname, '../../../test/fixtures/tests/anova-tukey-exemplo.txt');
export const exampleText: string = readFileSync(fixturePath, 'utf8');

export const CHART_PRESET_LABELS = {
  means: 'Médias por grupo (IC95%)',
  heatmap: 'Mapa de p ajustado (Tukey)',
} as const;

export const ANOVA_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showMeanValues', label: 'Mostrar valor das médias' },
  { id: 'showPValue', label: 'Mostrar p omnibus no gráfico' },
];

export const MAX_RESEARCH_QUESTION_LENGTH = 500;
