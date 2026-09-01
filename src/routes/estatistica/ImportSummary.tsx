import { AlertTriangle, FileSpreadsheet, Info } from 'lucide-react';
import type { TabularImportSummary } from '@/shared/data-input/importDiagnostics';

export interface ImportSummaryProps {
  summary: TabularImportSummary;
}

const mappingLabels: Record<TabularImportSummary['recognitionMode'], string> = {
  aliases: 'mapeamento por nomes',
  position: 'mapeamento por posição',
  unmapped: 'sem mapeamento automático',
};

function sourceText(summary: TabularImportSummary): string {
  return summary.sourceType === 'file' ? `Arquivo ${summary.fileName}` : 'Dados colados';
}

/** Compact, reusable provenance and import-warning disclosure. */
export function ImportSummary({ summary }: ImportSummaryProps) {
  const hasWarnings = summary.diagnostics.length > 0 || summary.importWarnings.length > 0;
  const separator = summary.delimiter ? `separador “${summary.delimiter}”` : 'sem separador';

  return (
    <section aria-label="Resumo da importação" className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
      <div className="flex items-start gap-2 text-foreground">
        <FileSpreadsheet aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-semibold">{sourceText(summary)}</p>
          <p className="text-muted-foreground">
            Aba {summary.tableName} · {summary.rowCount} linhas · {summary.columnCount} colunas · {summary.formatLabel} · {separator} · {mappingLabels[summary.recognitionMode]}
          </p>
        </div>
      </div>
      {hasWarnings ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-foreground">
            Ver avisos da importação
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {summary.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${index}`} className="flex gap-2">
                {diagnostic.severity === 'warning'
                  ? <AlertTriangle aria-label="Aviso" className="mt-0.5 size-4 shrink-0 text-warning" />
                  : <Info aria-label="Informação" className="mt-0.5 size-4 shrink-0 text-primary" />}
                <span>{diagnostic.message}</span>
              </li>
            ))}
            {summary.importWarnings.map((warning) => (
              <li key={`${warning.cellReference}-${warning.rowNumber}-${warning.columnIndex}-${warning.code}`} className="flex gap-2">
                <AlertTriangle aria-label="Aviso" className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{warning.cellReference} (linha original {warning.rowNumber}): {warning.message}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
