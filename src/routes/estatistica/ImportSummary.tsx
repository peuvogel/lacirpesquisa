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

function visibleDelimiter(delimiter: string): string {
  const labels: Record<string, string> = {
    '\t': 'separador: tabulação',
    ',': 'separador: vírgula',
    ';': 'separador: ponto e vírgula',
    '|': 'separador: barra vertical',
  };
  if (labels[delimiter]) return labels[delimiter];
  const safeText = Array.from(delimiter).map((character) => {
    const code = character.codePointAt(0)!;
    if (character === '\t') return 'tabulação';
    if (character === '\n') return 'nova linha';
    if (character === '\r') return 'retorno de carro';
    return /^[\p{Cc}\p{Cf}\p{Cs}]$/u.test(character)
      ? `U+${code.toString(16).toUpperCase().padStart(4, '0')}`
      : character;
  }).join('');
  return `separador: “${safeText}”`;
}

function worksheetSegment(summary: TabularImportSummary): string | null {
  const isAvailableXlsxSheet = summary.sourceType === 'file'
    && summary.formatLabel.trim().toUpperCase() === 'XLSX'
    && Boolean(summary.tableName)
    && summary.sheetNames.includes(summary.tableName);
  return isAvailableXlsxSheet ? `Aba ${summary.tableName}` : null;
}

/** Compact, reusable provenance and import-warning disclosure. */
export function ImportSummary({ summary }: ImportSummaryProps) {
  const hasWarnings = summary.recognitionDetails.length > 0
    || summary.diagnostics.length > 0
    || summary.importWarnings.length > 0;
  const segments = [
    worksheetSegment(summary),
    `${summary.rowCount} ${summary.rowCount === 1 ? 'linha' : 'linhas'}`,
    `${summary.columnCount} ${summary.columnCount === 1 ? 'coluna' : 'colunas'}`,
    summary.formatLabel,
    ...(summary.delimiter ? [visibleDelimiter(summary.delimiter)] : []),
    mappingLabels[summary.recognitionMode],
  ].filter((segment): segment is string => Boolean(segment));

  return (
    <section aria-label="Resumo da importação" className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
      <div className="flex items-start gap-2 text-foreground">
        <FileSpreadsheet aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="min-w-0 text-muted-foreground">
          <span className="font-semibold text-foreground">{sourceText(summary)}</span>
          {' · '}{segments.join(' · ')}
        </p>
      </div>
      {hasWarnings ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-foreground">
            Ver avisos da importação
          </summary>
          <ul aria-label="Detalhes da importação" className="mt-2 space-y-1 text-muted-foreground">
            {summary.recognitionDetails.map((detail, index) => (
              <li key={`recognition-${index}`} className="flex gap-2">
                <Info aria-label="Informação" className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{detail}</span>
              </li>
            ))}
            {summary.diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${index}`} className="flex gap-2">
                {diagnostic.severity === 'warning'
                  ? <AlertTriangle aria-label="Aviso" className="mt-0.5 size-4 shrink-0 text-warning" />
                  : <Info aria-label="Informação" className="mt-0.5 size-4 shrink-0 text-primary" />}
                <span>
                  {diagnostic.message}
                  {diagnostic.rowNumbers?.length ? ` Linhas: ${diagnostic.rowNumbers.join(', ')}.` : ''}
                </span>
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
