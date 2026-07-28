/** Parse `sih.{disease}.{measure}` catalog ids used by Mapas / SIH packs. */

export const MEASURE_SHORT_LABEL: Record<string, string> = {
  internacoes: 'Internações',
  obitos: 'Óbitos',
  valor_total: 'Valor total',
  dias_permanencia: 'Dias de permanência',
  taxa_mortalidade: 'Taxa de mortalidade (%)',
  media_permanencia_calculada: 'Média de permanência',
  taxa_internacao_por_100k: 'Taxa de internação (por 100 mil)',
  letalidade_calculada_pct: 'Letalidade (%)',
};

export interface ParsedSihVariable {
  diseaseId: string;
  measure: string;
  shortLabel: string;
}

export function parseSihVariableId(variableId: string): ParsedSihVariable | null {
  const parts = variableId.split('.');
  if (parts.length < 3 || parts[0] !== 'sih') return null;
  const measure = parts[parts.length - 1]!;
  const diseaseId = parts.slice(1, -1).join('.');
  if (!diseaseId || !measure) return null;
  return {
    diseaseId,
    measure,
    shortLabel: MEASURE_SHORT_LABEL[measure] ?? measure.replace(/_/g, ' '),
  };
}

/** Column header for handoff: short measure, disease suffix only when ambiguous. */
export function handoffMeasureHeader(
  variableId: string,
  options: { disambiguate?: boolean; diseaseLabel?: string } = {},
): string {
  const parsed = parseSihVariableId(variableId);
  if (!parsed) {
    return options.diseaseLabel ?? variableId;
  }
  if (options.disambiguate && options.diseaseLabel) {
    return `${parsed.shortLabel} (${options.diseaseLabel})`;
  }
  if (options.disambiguate) {
    return `${parsed.shortLabel} (${parsed.diseaseId.replace(/_/g, ' ')})`;
  }
  return parsed.shortLabel;
}

export function formatHandoffNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Number.isInteger(value)) return String(value);
  // Keep engine-friendly decimal point; trim trailing zeros.
  return String(Number(value.toPrecision(10)));
}
