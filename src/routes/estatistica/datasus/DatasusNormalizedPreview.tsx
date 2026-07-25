import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fmtNumber } from '@/shared/format';
import type { DatasusSource } from '@/shared/data-input/types';

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-data)',
  lineHeight: 'var(--text-data--line-height)',
} as const;

export interface DatasusNormalizedPreviewProps {
  source: DatasusSource;
}

export function DatasusNormalizedPreview({ source }: DatasusNormalizedPreviewProps) {
  const normalized = source.normalized;
  if (!normalized) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2">
          <div className="text-xs font-bold text-muted-foreground">Registros normalizados</div>
          <div className="text-xl font-bold text-foreground">{fmtNumber(normalized.summary.recordCount, 0)}</div>
          <div className="text-xs text-muted-foreground">
            Válidos: {fmtNumber(normalized.summary.validRecordCount, 0)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2">
          <div className="text-xs font-bold text-muted-foreground">Categorias</div>
          <div className="text-xl font-bold text-foreground">{fmtNumber(normalized.summary.categoryCount, 0)}</div>
          <div className="text-xs text-muted-foreground">{normalized.schema.categoryLabel || 'Categoria'}</div>
        </div>
        <div className="rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2">
          <div className="text-xs font-bold text-muted-foreground">Tempo</div>
          <div className="text-xl font-bold text-foreground">{fmtNumber(normalized.summary.timeCount, 0)}</div>
          <div className="text-xs text-muted-foreground">{normalized.schema.timeLabel || 'Sem eixo temporal'}</div>
        </div>
        <div className="rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2">
          <div className="text-xs font-bold text-muted-foreground">Medidas</div>
          <div className="text-xl font-bold text-foreground">
            {fmtNumber(normalized.schema.metricOptions.length, 0)}
          </div>
          <div className="text-xs text-muted-foreground">
            {normalized.schema.metricOptions.map((option) => option.label).join(', ') || 'Nenhuma'}
          </div>
        </div>
      </div>

      {!normalized.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Normalização incompleta</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {normalized.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertDescription>A base interna está pronta para ser usada pelos módulos estatísticos.</AlertDescription>
        </Alert>
      )}

      {normalized.previewRows && normalized.previewRows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" style={monoStyle}>
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-bold">Categoria</th>
                <th className="px-3 py-2 font-bold">Tempo</th>
                <th className="px-3 py-2 font-bold">Valor</th>
                <th className="px-3 py-2 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {normalized.previewRows.map((row, index) => (
                <tr key={index} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">{row.category || ''}</td>
                  <td className="px-3 py-2">{row.time || ''}</td>
                  <td className="px-3 py-2">
                    {row.value === null || row.value === undefined ? '' : String(row.value)}
                  </td>
                  <td className="px-3 py-2">{row.isTotal ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ainda não há linhas normalizadas suficientes para pré-visualização.
        </p>
      )}
    </div>
  );
}
