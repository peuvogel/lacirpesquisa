import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    desfecho_binario: [
      'desfecho_binario',
      'desfecho',
      'outcome',
      'evento',
      'caso',
      'binario',
      'y',
      'resposta',
    ],
    preditor: ['preditor', 'dose', 'exposicao', 'exposição', 'idade', 'covariavel', 'x'],
  },
  requiredKeys: ['desfecho_binario', 'preditor'],
  numericKeys: ['preditor'],
  expectedFormatLabel: 'desfecho_binario;preditor',
  positionFallback: {
    keysByIndex: ['desfecho_binario', 'preditor'],
    minColumns: 2,
    requiredKeys: ['desfecho_binario', 'preditor'],
    introText:
      'Não reconhecemos os nomes padrão das colunas, então usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = desfecho binário (0/1 ou dois níveis), 2ª = preditor numérico.',
    headerText: 'Os nomes do cabeçalho foram aproveitados automaticamente na interface.',
  },
};

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar Logística',
    body: 'Modela a probabilidade de um desfecho binário (sim/não, 0/1) em função de preditores numéricos. Reportamos odds ratios (OR) com intervalo de confiança de 95%.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna de desfecho binário (0/1 numérico ou fator com dois níveis) e ao menos um preditor numérico. Cada linha é uma observação independente.',
  },
  {
    title: 'Eventos raros e separação',
    body: 'Desfechos muito desequilibrados ou coeficientes extremos podem indicar eventos raros ou separação quase perfeita, interpretar OR com cautela.',
  },
];

/** Mirrors `src/test/fixtures/tests/logistica-exemplo.txt` (browser-safe; no node:fs). */
export const exampleText = `desfecho_binario;dose
1;1
0;2
1;1
0;3
0;2
1;3
1;2
0;4
1;1
0;3
0;2
1;2
`;

export const CHART_PRESET_LABELS = {
  forest: 'Odds ratios (IC95%)',
} as const;

export const LOGISTICA_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showCoefficientValues', label: 'Mostrar valores dos odds ratios' },
];

/** Minimum proportion in the minority class before rare-events nudge (D-06). */
export const RARE_EVENTS_THRESHOLD = 0.05;

/** |β| above this triggers separation heuristic nudge (D-06). */
export const SEPARATION_BETA_THRESHOLD = 10;
