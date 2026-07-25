import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixturePath = join(__dirname, '../../../test/fixtures/tests/poisson-exemplo.txt');

export const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    contagem: ['contagem', 'count', 'eventos', 'casos', 'frequencia', 'n'],
    preditor: ['preditor', 'exposicao', 'exposição', 'dose', 'tempo', 'covariavel', 'x'],
  },
  requiredKeys: ['contagem', 'preditor'],
  numericKeys: ['contagem', 'preditor'],
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

export const defaultQuestion =
  'O preditor está associado à contagem de eventos, após ajuste log-linear?';

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar Poisson',
    body: 'Modela contagens (inteiros não negativos) em função de preditores com efeitos multiplicativos no desfecho. Efeitos principais apenas — sem interações nesta versão didática.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna de contagem (inteiro ≥ 0) e ao menos um preditor numérico. Cada linha é uma observação independente.',
  },
  {
    title: 'Superdispersão',
    body: 'Se a variância observada excede a prevista pelo modelo (razão χ²/df > 1,25), aparece um aviso sugerindo Binomial Negativa — você decide se troca de teste.',
  },
];

export const exampleText: string = readFileSync(fixturePath, 'utf8');

export const CHART_PRESET_LABELS = {
  forest: 'Coeficientes (IC95%)',
  predicted: 'Observado vs previsto',
} as const;

export const POISSON_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showCoefficientValues', label: 'Mostrar valores dos coeficientes' },
  { id: 'showReferenceLine', label: 'Mostrar linha de referência (y = x)' },
];

export const MAX_RESEARCH_QUESTION_LENGTH = 500;

/** Poisson → NB handoff target (D-20). */
export const NB_HANDOFF_TEST_ID = 'binomial-negativa' as const;
