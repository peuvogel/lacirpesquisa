import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { fmtNumber, fmtSigned } from '@/shared/format';

export interface GroupSummary {
  label: string;
  n: number;
  mean: number;
  sd: number;
}

function sampleStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const average = legacyStats.mean(values);
  const sumSquaredDiffs = values.reduce((accumulator, value) => accumulator + (value - average) ** 2, 0);
  return Math.sqrt(sumSquaredDiffs / (values.length - 1));
}

/**
 * Descriptive summary per group label. Unparseable numeric cells are skipped
 * (never counted as zero) so pt-BR decimal commas behave like the legacy app.
 */
export function summarizeGroups(
  rows: string[][],
  groupColumnIndex: number,
  valueColumnIndex: number,
): GroupSummary[] {
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    const label = (row[groupColumnIndex] ?? '').trim();
    if (!label) continue;

    const parsed = legacyStats.parseNumber(row[valueColumnIndex]);
    if (parsed === null) continue;

    const existing = buckets.get(label) ?? [];
    existing.push(parsed);
    buckets.set(label, existing);
  }

  return [...buckets.entries()].map(([label, values]) => ({
    label,
    n: values.length,
    mean: values.length ? legacyStats.mean(values) : 0,
    sd: sampleStandardDeviation(values),
  }));
}

/**
 * Plain-Portuguese didactic copy for the demo stub. Describes the data honestly
 * and explicitly avoids inferential claims — Phase 2 owns significance testing.
 */
export function buildDemoInterpretation(summaries: GroupSummary[]): string[] {
  if (!summaries.length) {
    return ['Não há dados numéricos suficientes para descrever os grupos selecionados.'];
  }

  const sorted = [...summaries].sort((left, right) => right.mean - left.mean);
  const higher = sorted[0];
  const lower = sorted[sorted.length - 1];
  const labels = summaries.map((summary) => summary.label).join(' e ');

  const paragraphs: string[] = [
    `Esta visualização resume o tempo de internação informado para ${labels}. ` +
      `Cada barra representa a média observada no grupo, calculada apenas com os valores numéricos válidos da tabela.`,
  ];

  if (summaries.length >= 2 && higher.label !== lower.label) {
    const difference = higher.mean - lower.mean;
    paragraphs.push(
      `${higher.label} apresentou média de ${fmtNumber(higher.mean)} dias (n = ${higher.n}), ` +
        `enquanto ${lower.label} ficou em ${fmtNumber(lower.mean)} dias (n = ${lower.n}). ` +
        `A diferença entre as médias observadas é de ${fmtSigned(difference)} dias.`,
    );
  } else {
    const only = summaries[0];
    paragraphs.push(
      `${only.label} concentra ${only.n} observações válidas, com média de ${fmtNumber(only.mean)} dias ` +
        `e desvio padrão amostral de ${fmtNumber(only.sd)} dias.`,
    );
  }

  paragraphs.push(
    'Este Teste demo descreve os números que você colou ou importou — ainda não realiza testes de significância. ' +
      'Quando os testes estatísticos forem migrados na próxima fase, eles aparecerão aqui com interpretação formal.',
  );

  return paragraphs;
}
