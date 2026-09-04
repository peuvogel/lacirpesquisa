import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    contagem: ['contagem', 'count', 'eventos', 'casos', 'frequencia', 'n'],
    preditor: ['preditor', 'exposicao', 'exposição', 'dose', 'tempo', 'covariavel', 'x'],
    offset_exposure: ['populacao', 'população', 'denominador', 'pessoa_tempo', 'person_time', 'offset'],
  },
  requiredKeys: ['contagem', 'preditor'],
  numericKeys: ['contagem', 'preditor', 'offset_exposure'],
  expectedFormatLabel: 'contagem;preditor',
  positionFallback: {
    keysByIndex: ['contagem', 'preditor'],
    minColumns: 2,
    requiredKeys: ['contagem', 'preditor'],
    introText:
      'Não reconhecemos os nomes padrão das colunas, então usamos a estrutura por posição da planilha.',
    assumptionText: 'Assumimos: 1ª coluna = contagem (inteiro ≥ 0), 2ª = preditor numérico.',
    headerText: 'Os nomes do cabeçalho foram aproveitados automaticamente na interface.',
  },
};

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar Poisson',
    body: 'Modela contagens (inteiros não negativos) em função de preditores com efeitos multiplicativos no desfecho. Efeitos principais apenas, sem interações nesta versão didática.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna de contagem (inteiro ≥ 0) e ao menos um preditor numérico. Em comparações territoriais, inclua população ou pessoa-tempo positiva: o sistema usa log(exposição) como offset.',
  },
  {
    title: 'Superdispersão',
    body: 'Se a variância observada excede a prevista pelo modelo (razão χ²/df > 1,25), aparece um aviso sugerindo Binomial Negativa, você decide se troca de teste.',
  },
];

/** Mirrors `src/test/fixtures/tests/poisson-exemplo.txt` (browser-safe; no node:fs). */
export const exampleText = `contagem;exposicao
2;1,0
3;1,0
4;1,2
5;1,2
6;1,5
7;1,5
8;2,0
9;2,0
10;2,5
11;2,5
12;3,0
13;3,0
`;

export const CHART_PRESET_LABELS = {
  forest: 'Coeficientes (IC95%)',
  predicted: 'Observado vs previsto',
} as const;

export const POISSON_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showCoefficientValues', label: 'Mostrar valores dos coeficientes' },
  { id: 'showReferenceLine', label: 'Mostrar linha de referência (y = x)' },
];

/** Poisson → NB handoff target (D-20). */
export const NB_HANDOFF_TEST_ID = 'binomial-negativa' as const;
