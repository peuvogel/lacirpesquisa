import type { NormalizedDatasusResult } from '@/shared/data-input/types';

/** Converts a confirmed DataSUS normalization into the tabular shape paste uses. */
export function datasusNormalizedToTabular(normalized: NormalizedDatasusResult): {
  headers: string[];
  rows: string[][];
} {
  const { schema, records } = normalized;
  const categoryHeader = schema.categoryLabel || 'Categoria';
  const valueHeader =
    schema.metricOptions.find((option) => option.key === schema.primaryMetricKey)?.label || 'Valor';

  const validRecords = records.filter(
    (record) => !record.isTotal && !record.isMissing && record.value !== null,
  );

  const formatValue = (value: number) =>
    value.toLocaleString('pt-BR', { maximumFractionDigits: 4, minimumFractionDigits: 0 });

  if (schema.hasTime) {
    const timeHeader = schema.timeLabel || 'Tempo';
    return {
      headers: [categoryHeader, timeHeader, valueHeader],
      rows: validRecords.map((record) => [record.category, record.time, formatValue(record.value as number)]),
    };
  }

  return {
    headers: [categoryHeader, valueHeader],
    rows: validRecords.map((record) => [record.category, formatValue(record.value as number)]),
  };
}
