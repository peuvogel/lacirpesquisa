import type { PraisSeriesRow } from './praisEngine';

export interface SeriesPreviewTableProps {
  rows: PraisSeriesRow[];
  timeHeaderLabel: string;
  yHeaderLabel: string;
  maxPreviewRows?: number;
}

/**
 * Read-only mono preview of parsed temporal series (UI-SPEC: max 8 rows + truncation).
 */
export function SeriesPreviewTable({
  rows,
  timeHeaderLabel,
  yHeaderLabel,
  maxPreviewRows = 8,
}: SeriesPreviewTableProps) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum ponto temporal válido encontrado. Volte a Dados e confira as colunas de tempo e valor.
      </p>
    );
  }

  const previewRows = rows.slice(0, maxPreviewRows);
  const remaining = rows.length - previewRows.length;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">Prévia da série temporal</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr>
              <th className="border-b border-border px-3 py-2 text-left text-sm font-bold text-foreground">
                {timeHeaderLabel}
              </th>
              <th className="border-b border-border px-3 py-2 text-left text-sm font-bold text-foreground">
                {yHeaderLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row) => (
              <tr key={`${row.index}-${row.timeSortKey}`}>
                <td
                  className="border-b border-border/60 px-3 py-1.5 text-foreground"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-data)',
                    lineHeight: 'var(--text-data--line-height)',
                  }}
                >
                  {row.timeLabel}
                </td>
                <td
                  className="border-b border-border/60 px-3 py-1.5 text-foreground"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-data)',
                    lineHeight: 'var(--text-data--line-height)',
                  }}
                >
                  {row.yRaw}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 ? (
        <p className="text-sm text-muted-foreground">… e mais {remaining} linhas</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Mostrando {previewRows.length} de {rows.length} pontos válidos
        </p>
      )}
    </div>
  );
}
