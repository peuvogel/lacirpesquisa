import { useState } from 'react';
import { Info, Lock, Unlock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { AnalysisIssue } from '@/shared/data-input/analysisIssues';
import type { TemporalMode } from '@/shared/data-input/temporalPeriods';
import type { ImportWarning } from '@/shared/data-input/types';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { RoleBindingPanel } from '@/features/tests/shared/RoleBindingPanel';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import WheelPicker from '@/components/ui/wheelPicker/WheelPicker';
import {
  didacticCards,
  TABULAR_OPTIONS,
  TEMPORAL_MODE_HELP,
  TEMPORAL_MODE_OPTIONS,
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
  onUndo?: () => void;
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
  onUndo,
  importWarnings,
}: PraisWinstenConfigPanelProps) {
  const [temporalUnlocked, setTemporalUnlocked] = useState(false);
  const previewDataset = buildDatasetFromConfirmed({
    headers: loadedInput.headers,
    rows: loadedInput.rows,
    recognizedColumns: loadedInput.recognizedColumns,
    temporalMode,
  });

  return (
    <div className="space-y-4">
      {showSoftReset ? <SoftResetAlert /> : null}

      {/* Significância, periodicidade e papéis na mesma linha: as três escolhas
          que governam o ajuste. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AlphaSelector value={alpha} onChange={onAlphaChange} />

        <section aria-label="Configuração temporal" className="group/temporal relative space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-foreground">Interpretar períodos como</p>
            <div className="flex shrink-0 items-center gap-0.5">
            {/* Sempre visível, ao contrário do cadeado: é ajuda, não ação. Cada
                modo espera um formato próprio, e errar o formato custa a
                análise inteira. */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="O que é cada tipo de período"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-transparent text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3.5" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[70vh] w-96 overflow-y-auto">
                <p className="text-sm font-bold text-foreground">Tipos de período</p>
                <dl className="mt-2 space-y-3">
                  {TEMPORAL_MODE_OPTIONS.map((option) => {
                    const help = TEMPORAL_MODE_HELP[option.value as TemporalMode];
                    return (
                      <div key={option.value}>
                        <dt className="text-xs font-bold text-foreground">{option.label}</dt>
                        <dd className="text-xs text-muted-foreground">
                          {help.what}
                          <span className="mt-0.5 block">
                            <span className="font-bold text-foreground">Exemplo: </span>
                            {help.example}
                          </span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  Nos modos de calendário o efeito sai anualizado (por ano). Em "Valores numéricos"
                  ele é por unidade informada, e em "Ordem das linhas", por intervalo observado.
                </p>
              </PopoverContent>
            </Popover>
            {/* Nasce travada, como a roda de tipo: a periodicidade muda o
                sentido do efeito estimado, não pode girar por acidente. */}
            <button
              type="button"
              onClick={() => setTemporalUnlocked((previous) => !previous)}
              aria-pressed={!temporalUnlocked}
              aria-label={temporalUnlocked ? 'Travar a periodicidade' : 'Destravar a periodicidade'}
              className="rounded-md p-0.5 text-white opacity-0 transition-opacity hover:opacity-70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/temporal:opacity-100"
            >
              {temporalUnlocked ? <Unlock className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
            </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 py-1">
            <WheelPicker
              ariaLabel="Interpretar períodos como"
              options={TEMPORAL_MODE_OPTIONS}
              value={temporalMode}
              onChange={(value) => onTemporalModeChange(value as TemporalMode)}
              disabled={!temporalUnlocked}
              width={150}
              className="lacir-wheel-compact"
            />
            <p className="text-center text-xs text-muted-foreground">
              Periodicidade detectada: {previewDataset.frequencyLabel || 'não definida'}
              <span className="block">{previewDataset.effectBasisLabel}</span>
            </p>
          </div>
        </section>

        <RoleBindingPanel
          document={document}
          testId={testId}
          tabularOptions={TABULAR_OPTIONS}
          onDocumentChange={onDocumentChange}
        />
      </div>

      <DidacticCards cards={didacticCards} />

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
          onUndo={onUndo}
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
