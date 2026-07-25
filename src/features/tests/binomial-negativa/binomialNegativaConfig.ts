import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DidacticCard } from '@/features/tests/shared/DidacticCards';
import type { AnnotationDefinition } from '@/shared/charts/useChartCustomizer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixturePath = join(__dirname, '../../../test/fixtures/tests/binomial-negativa-exemplo.txt');

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
  'O preditor está associado à contagem de eventos após relaxar equidispersão com Binomial Negativa?';

export const didacticCards: DidacticCard[] = [
  {
    title: 'Quando usar Binomial Negativa',
    body: 'Modela contagens com variância maior que a média (superdispersão). Relaxa a equidispersão do Poisson via parâmetro θ — efeitos log-lineares nos preditores, como no Poisson.',
  },
  {
    title: 'Colunas esperadas',
    body: 'Uma coluna de contagem (inteiro ≥ 0) e ao menos um preditor numérico. Cada linha é uma observação independente.',
  },
  {
    title: 'Parâmetro θ (dispersão)',
    body: 'θ controla variância extra: Var(Y) = μ + μ²/θ. Valores menores indicam mais superdispersão. Compare com Poisson quando χ²/gl > 1,25.',
  },
];

export const exampleText: string = readFileSync(fixturePath, 'utf8');

export const CHART_PRESET_LABELS = {
  forest: 'Coeficientes (IC95%)',
  predicted: 'Observado vs previsto',
} as const;

export const BINOMIAL_NEGATIVA_ANNOTATIONS: AnnotationDefinition[] = [
  { id: 'showConfidenceIntervals', label: 'Mostrar intervalos de confiança' },
  { id: 'showCoefficientValues', label: 'Mostrar valores dos coeficientes' },
  { id: 'showReferenceLine', label: 'Mostrar linha de referência (y = x)' },
];

export const MAX_RESEARCH_QUESTION_LENGTH = 500;
