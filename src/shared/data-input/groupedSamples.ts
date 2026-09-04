import { parseNumber } from './legacyAdapters';
import { enabledRowEntries, resolveBindings, type TableDocument } from './tableDocument';
import type { AnalysisIssue } from './analysisIssues';

export type GroupedSampleFormat = 'wide' | 'long';

export interface PreparedSampleGroup {
  label: string;
  values: number[];
  columnId?: string;
}

export interface PreparedGroupedSamples {
  format: GroupedSampleFormat;
  groups: PreparedSampleGroup[];
  invalidRowCount: number;
  invalidRowNumbers: number[];
  issues: AnalysisIssue[];
}

const MIN_GROUP_OBSERVATIONS = 3;
const MAX_TOTAL_OBSERVATIONS = 10_000;

function uniqueRowNumbers(rows: number[]): number[] {
  return [...new Set(rows)].sort((left, right) => left - right);
}

function missingBindingIssue(format: GroupedSampleFormat, roles: string[]): AnalysisIssue {
  return {
    code: 'missing_binding',
    severity: 'error',
    message: `Falta vincular ${roles.join(' e ')} para o formato ${format === 'wide' ? 'uma coluna por grupo' : 'valor + coluna de grupo'}.`,
    hint: 'Escolha colunas diferentes nos papéis obrigatórios antes de analisar.',
  };
}

function appendCommonIssues(
  groups: PreparedSampleGroup[],
  invalidRowNumbers: number[],
  issues: AnalysisIssue[],
): void {
  if (invalidRowNumbers.length) {
    issues.push({
      code: 'rows_ignored',
      severity: 'warning',
      message: `${invalidRowNumbers.length} linha(s) têm valor ausente ou inválido e não entram integralmente na comparação.`,
      rowNumbers: invalidRowNumbers,
      hint: 'Revise as linhas indicadas; valores válidos de colunas independentes foram preservados.',
    });
  }

  if (groups.length !== 2) {
    const labels = groups.slice(0, 6).map((group) => group.label).join(', ');
    issues.push({
      code: 'group_count',
      severity: 'error',
      message: groups.length === 1
        ? `Foi encontrado 1 grupo (${labels}). Mann–Whitney exige exatamente dois grupos independentes.`
        : `Foram encontrados ${groups.length} grupos${labels ? ` (${labels})` : ''}. Mann–Whitney exige exatamente dois grupos independentes.`,
      hint: groups.length > 2
        ? 'Escolha a coluna categórica correta ou use o formato “Uma coluna por grupo”; nenhum grupo foi descartado.'
        : 'Confira os vínculos e preencha os dois grupos.',
    });
  }

  const smallGroups = groups.filter((group) => group.values.length < MIN_GROUP_OBSERVATIONS);
  if (smallGroups.length) {
    const listed = smallGroups.slice(0, 10).map((group) => `${group.label} (n=${group.values.length})`).join(', ');
    const remaining = smallGroups.length - 10;
    issues.push({
      code: 'group_too_small',
      severity: 'error',
      message: `Cada grupo precisa de pelo menos ${MIN_GROUP_OBSERVATIONS} observações válidas. Revise: ${listed}${remaining > 0 ? ` e mais ${remaining}` : ''}.`,
      hint: 'Inclua observações independentes válidas ou corrija o vínculo das colunas.',
    });
  }

  const allValues = groups.flatMap((group) => group.values);
  if (allValues.length > 1 && new Set(allValues).size < 2) {
    issues.push({
      code: 'all_values_tied',
      severity: 'error',
      message: 'Todos os valores válidos estão empatados; não há variação para ordenar os grupos.',
      hint: 'Confira se a coluna numérica correta foi escolhida e se os dados não foram arredondados em excesso.',
    });
  }

  if (allValues.length > MAX_TOTAL_OBSERVATIONS) {
    issues.push({
      code: 'too_many_observations',
      severity: 'error',
      message: `Limite de ${MAX_TOTAL_OBSERVATIONS.toLocaleString('pt-BR')} observações excedido.`,
      hint: 'Reduza a seleção antes de executar o teste.',
    });
  }
}

export function prepareGroupedSamples(
  document: TableDocument,
  testId: string,
  format: GroupedSampleFormat,
  recognizedColumns?: Record<string, number>,
): PreparedGroupedSamples {
  const bindings = recognizedColumns ?? resolveBindings(document, testId);
  const issues: AnalysisIssue[] = [];
  const invalidRows: number[] = [];
  const groups: PreparedSampleGroup[] = [];

  if (format === 'wide') {
    const missingRoles = ['grupo_a', 'grupo_b'].filter((role) => bindings[role] === undefined);
    if (missingRoles.length) {
      return { format, groups, invalidRowCount: 0, invalidRowNumbers: [], issues: [missingBindingIssue(format, missingRoles)] };
    }
    const indexes = [bindings.grupo_a!, bindings.grupo_b!];
    if (indexes[0] === indexes[1]) {
      return {
        format,
        groups,
        invalidRowCount: 0,
        invalidRowNumbers: [],
        issues: [{
          code: 'duplicate_binding',
          severity: 'error',
          message: 'Os dois grupos precisam usar colunas diferentes.',
          hint: 'Vincule grupo A e grupo B a duas colunas numéricas distintas.',
        }],
      };
    }

    indexes.forEach((index, groupIndex) => {
      groups.push({
        label: document.columns[index]?.name.trim() || `Grupo ${groupIndex === 0 ? 'A' : 'B'}`,
        values: [],
        columnId: document.columns[index]?.id,
      });
    });
    enabledRowEntries(document).forEach(({ row, index: rowIndex }) => {
      indexes.forEach((columnIndex, groupIndex) => {
        const value = parseNumber(row[columnIndex] ?? '');
        if (value === null) invalidRows.push(rowIndex + 1);
        else groups[groupIndex]!.values.push(value);
      });
    });
  } else {
    const missingRoles = ['desfecho', 'grupo'].filter((role) => bindings[role] === undefined);
    if (missingRoles.length) {
      return { format, groups, invalidRowCount: 0, invalidRowNumbers: [], issues: [missingBindingIssue(format, missingRoles)] };
    }
    const outcomeIndex = bindings.desfecho!;
    const groupIndex = bindings.grupo!;
    if (outcomeIndex === groupIndex) {
      return {
        format,
        groups,
        invalidRowCount: 0,
        invalidRowNumbers: [],
        issues: [{
          code: 'duplicate_binding',
          severity: 'error',
          message: 'Valor e grupo precisam usar colunas diferentes.',
          hint: 'Escolha uma coluna numérica para o valor e outra categórica para o grupo.',
        }],
      };
    }
    const byLabel = new Map<string, PreparedSampleGroup>();
    enabledRowEntries(document).forEach(({ row, index: rowIndex }) => {
      const label = String(row[groupIndex] ?? '').trim();
      const value = parseNumber(row[outcomeIndex] ?? '');
      if (!label || value === null) {
        invalidRows.push(rowIndex + 1);
        return;
      }
      let group = byLabel.get(label);
      if (!group) {
        group = { label, values: [], columnId: document.columns[groupIndex]?.id };
        byLabel.set(label, group);
      }
      group.values.push(value);
    });
    groups.push(...byLabel.values());
  }

  const invalidRowNumbers = uniqueRowNumbers(invalidRows);
  appendCommonIssues(groups, invalidRowNumbers, issues);
  return {
    format,
    groups,
    invalidRowCount: invalidRowNumbers.length,
    invalidRowNumbers,
    issues,
  };
}
