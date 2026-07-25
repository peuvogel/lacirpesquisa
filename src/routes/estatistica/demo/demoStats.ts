import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { fmtNumber, fmtSigned } from '@/shared/format';

export interface GroupSummary {
  label: string;
  n: number;
  mean: number;
  sd: number;
}

export interface AnalysisColumns {
  groupIndex: number;
  valueIndex: number;
  note?: string;
}

function sampleStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const average = legacyStats.mean(values);
  const sumSquaredDiffs = values.reduce((accumulator, value) => accumulator + (value - average) ** 2, 0);
  return Math.sqrt(sumSquaredDiffs / (values.length - 1));
}

function normalizeNumericToken(raw: string): string {
  return raw.trim().replace(/\./g, '').replace(',', '.');
}

function looksNumeric(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return Number.isFinite(Number(normalizeNumericToken(value)));
}

function detectColumnRole(columnIndex: number, rows: string[][]): 'numerica' | 'categorica' {
  const values = rows.map((row) => row[columnIndex] ?? '').filter((value) => value.trim() !== '');
  if (!values.length) return 'categorica';

  const numericRatio = values.filter(looksNumeric).length / values.length;
  return numericRatio >= 0.6 ? 'numerica' : 'categorica';
}

/**
 * Picks group/value columns from confirmed data, falling back to the first
 * categórica + numérica pair when roles are ambiguous.
 */
export function pickAnalysisColumns(headers: string[], rows: string[][]): AnalysisColumns {
  const roles = headers.map((_, index) => detectColumnRole(index, rows));
  const numericIndexes = roles.map((role, index) => (role === 'numerica' ? index : -1)).filter((index) => index >= 0);
  const categoricalIndexes = roles
    .map((role, index) => (role === 'categorica' ? index : -1))
    .filter((index) => index >= 0);

  const valueIndex = numericIndexes[0] ?? Math.max(headers.length - 1, 0);
  const groupIndex = categoricalIndexes[0] ?? 0;

  let note: string | undefined;
  if (numericIndexes.length !== 1 || categoricalIndexes.length !== 1) {
    note =
      'Usamos a primeira coluna categórica como grupo e a primeira numérica como medida — ajuste os papéis em Configurar se necessário.';
  }

  return { groupIndex, valueIndex, note };
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
