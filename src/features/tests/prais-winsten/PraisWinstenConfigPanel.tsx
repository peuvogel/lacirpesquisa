import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { AnalysisIssue } from '@/shared/data-input/analysisIssues';
import type { TemporalMode } from '@/shared/data-input/temporalPeriods';
import type { ImportWarning } from '@/shared/data-input/types';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import {
  didacticCards,
  TABULAR_OPTIONS,
} from './praisConfig';
import { buildDatasetFromConfirmed } from './praisEngine';
import { SeriesPreviewTable } from './SeriesPreviewTable';

export interface PraisWinstenLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface PraisWinstenConfigPanelProps {
  loadedInput: PraisWinstenLoadedInput;
  alpha: AlphaValue;
  onAlphaChange: (value: AlphaValue) => void;
  temporalMode: TemporalMode;
  onTemporalModeChange: (mode: TemporalMode) => void;
  showSoftReset: boolean;
  onConfirm: (confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) => void;
  document?: TableDocument;
  testId?: string;
  onDocumentChange?: (document: TableDocument) => void;
  importWarnings?: ImportWarning[];
}

export function PraisWinstenConfigPanel({
  loadedInput,
  alpha,
  onAlphaChange,
  temporalMode,
  onTemporalModeChange,
  showSoftReset,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  importWarnings,
}: PraisWinstenConfigPanelProps) {
  const previewDataset = buildDatasetFromConfirmed({
    headers: loadedInput.headers,
    rows: loadedInput.rows,
    recognizedColumns: loadedInput.recognizedColumns,
    temporalMode,
  });

  return (
    <div className="space-y-4">
      {showSoftReset ? <SoftResetAlert /> : null}

      <AlphaSelector value={alpha} onChange={onAlphaChange} />

      <DidacticCards cards={didacticCards} />

      <section aria-label="Configuração temporal" className="rounded-lg border border-border p-3">
        <p className="text-sm font-bold text-foreground">
          Periodicidade detectada: {previewDataset.frequencyLabel || 'não definida'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{previewDataset.effectBasisLabel}</p>
        <label className="mt-3 flex max-w-sm flex-col gap-1 text-sm font-bold">
          Interpretar períodos como
          <select
            value={temporalMode}
            onChange={(event) => onTemporalModeChange(event.target.value as TemporalMode)}
            className="rounded-md border border-border bg-background px-2 py-1.5 font-normal"
          >
            <option value="auto">Automático</option>
            <option value="annual">Anual</option>
            <option value="semiannual">Semestral</option>
            <option value="quarterly">Trimestral</option>
            <option value="monthly">Mensal</option>
            <option value="dates">Datas</option>
            <option value="numeric">Valores numéricos</option>
            <option value="order">Ordem das linhas</option>
          </select>
        </label>
      </section>

      <SeriesPreviewTable
        rows={previewDataset.orderedRows}
        timeHeaderLabel={previewDataset.timeHeaderLabel}
        yHeaderLabel={previewDataset.yHeaderLabel}
      />

      {previewDataset.periodLabel ? (
        <p className="text-sm text-muted-foreground">
          Período detectado: {previewDataset.periodLabel}
          {previewDataset.reordered ? ' · A série será ordenada crescentemente por tempo antes do ajuste.' : ''}
        </p>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={TABULAR_OPTIONS}
          onConfirm={onConfirm}
          document={document}
          testId={testId}
          onDocumentChange={onDocumentChange}
          importWarnings={importWarnings}
        />
      </div>
    </div>
  );
}

function issueRows(issue: AnalysisIssue): string {
  return issue.rowNumbers?.length ? ` Linhas: ${issue.rowNumbers.join(', ')}.` : '';
}

export function PraisWinstenWarningList({ issues }: { issues: AnalysisIssue[] }) {
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  if (!warnings.length) return null;

  return (
    <Alert className="border-l-4 border-amber-500">
      <AlertTitle className="text-base font-bold">Observações sobre a série temporal</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {warnings.map((issue) => <li key={`${issue.code}-${issue.message}`}>{issue.message}{issueRows(issue)}</li>)}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function PraisWinstenValidationAlert({ issues }: { issues: AnalysisIssue[] }) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const firstError = errors[0];
  if (!firstError) return <PraisWinstenWarningList issues={issues} />;

  return (
    <div className="space-y-3">
      <Alert variant="destructive" className="border-l-4">
        <AlertTitle className="text-base font-bold">Não foi possível analisar com estas configurações.</AlertTitle>
        <AlertDescription className="text-base">
          <p>{firstError.message}{issueRows(firstError)}</p>
          {errors.length > 1 ? (
            <details className="mt-2">
              <summary>Ver outros problemas encontrados</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.slice(1).map((issue) => <li key={`${issue.code}-${issue.message}`}>{issue.message}{issueRows(issue)}</li>)}
              </ul>
            </details>
          ) : null}
          <p className="mt-2">Ajuste os dados ou as opções acima e tente novamente.</p>
        </AlertDescription>
      </Alert>
      <PraisWinstenWarningList issues={issues} />
    </div>
  );
}
