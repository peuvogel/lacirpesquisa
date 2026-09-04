import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

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

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar ANOVA de uma via',
    body: 'Compare médias de um desfecho numérico entre três ou mais grupos definidos por um fator categórico. O teste omnibus responde se algum grupo difere; o Tukey HSD aponta quais pares diferem, com p ajustado.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna numérica (desfecho) e uma coluna categórica (grupo). Cada linha é uma observação. Grupos com poucas repetições ou tamanhos muito desiguais merecem cautela, veja os avisos de pressupostos.',
  },
  {
    title: 'Pós-hoc Tukey',
    body: 'Quando o F omnibus é significativo, a tabela par a par mostra contrastes, estatística, p ajustado e intervalo de confiança. Ordenamos por p ajustado crescente para destacar as diferenças mais evidentes.',
  },
];

/** Mirrors `src/test/fixtures/tests/anova-tukey-exemplo.txt` (browser-safe; no node:fs). */
export const exampleText = `desfecho;grupo
12,3;A
14,1;A
10,9;A
11,8;A
13,5;A
18,2;B
17,4;B
19,1;B
16,8;B
20,3;B
24,5;C
23,1;C
25,8;C
22,4;C
26,2;C
`;

export const CHART_PRESET_LABELS = {
  rawData: 'Dados individuais por grupo',
  means: 'Médias por grupo (IC95%)',
  heatmap: 'Mapa de p ajustado (Tukey)',
} as const;

export const ANOVA_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showMeanValues', label: 'Mostrar valor das médias' },
  { id: 'showPValue', label: 'Mostrar p omnibus no gráfico' },
];
