import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    categoria_a: [
      'categoria_a',
      'categoria a',
      'tratamento',
      'grupo',
      'fator',
      'linha',
      'variavel_1',
      'variavel 1',
    ],
    categoria_b: [
      'categoria_b',
      'categoria b',
      'desfecho',
      'resultado',
      'coluna',
      'variavel_2',
      'variavel 2',
    ],
  },
  requiredKeys: ['categoria_a', 'categoria_b'],
  expectedFormatLabel: 'categoria_a;categoria_b',
  positionFallback: {
    keysByIndex: ['categoria_a', 'categoria_b'],
    minColumns: 2,
    requiredKeys: ['categoria_a', 'categoria_b'],
    introText:
      'Não reconhecemos os nomes padrão das colunas, então usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = categoria A, 2ª coluna = categoria B.',
    headerText: 'Os nomes do cabeçalho foram aproveitados automaticamente na interface.',
  },
};

export const didacticCards: DidacticCard[] = [
  {
    title: 'O que testa',
    body: 'O qui-quadrado de independência verifica se duas variáveis categóricas estão associadas ou se parecem independentes na amostra.',
  },
  {
    title: 'Como colar os dados',
    body: 'Use duas colunas categóricas (texto), uma observação por linha. O sistema monta a tabela de contingência automaticamente.',
  },
  {
    title: 'Pressupostos',
    body: 'Contagens esperadas ≥ 5 em cada célula tornam o teste mais confiável. Células esparsas geram um aviso, sem bloquear o resultado.',
  },
];

/** Mirrors `src/test/fixtures/tests/qui-quadrado-exemplo.txt` (browser-safe; no node:fs). */
export const exampleText = `tratamento;desfecho
A;sim
A;sim
A;sim
A;nao
A;nao
B;sim
B;sim
B;nao
B;nao
B;nao
C;sim
C;sim
C;sim
C;sim
C;nao
`;

export const CHART_PRESET_LABELS = {
  contingency: 'Observado vs esperado',
} as const;

export const QUI_QUADRADO_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showCellCounts', label: 'Mostrar contagens nas barras' },
  { id: 'showPValue', label: 'Mostrar valor de p no gráfico' },
];
