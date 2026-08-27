import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ResearchQuestionField } from '@/features/tests/shared/ResearchQuestionField';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import { ModeChoiceCard } from '@/features/tests/shared/ModeChoiceCard';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import { hasBlockingIssues, type AnalysisIssue } from '@/shared/data-input/analysisIssues';
import type { PreparedGroupedSamples } from '@/shared/data-input/groupedSamples';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import {
  defaultQuestion,
  didacticCards,
  getMannWhitneyTabularOptions,
  MANN_WHITNEY_FORMAT_OPTIONS,
  type MannWhitneyFormat,
} from './mannWhitneyConfig';

export interface MannWhitneyLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface MannWhitneyConfigPanelProps {
  loadedInput: MannWhitneyLoadedInput;
  alpha: AlphaValue;
  onAlphaChange: (value: AlphaValue) => void;
  researchQuestion: string;
  onResearchQuestionChange: (value: string) => void;
  showSoftReset: boolean;
  format: MannWhitneyFormat;
  onFormatChange: (format: MannWhitneyFormat) => void;
  preparation: PreparedGroupedSamples | null;
  independenceConfirmed: boolean;
  onIndependenceConfirmedChange: (confirmed: boolean) => void;
  onRoleAdjust: () => void;
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

export function MannWhitneyConfigPanel({
  loadedInput,
  alpha,
  onAlphaChange,
  researchQuestion,
  onResearchQuestionChange,
  showSoftReset,
  format,
  onFormatChange,
  preparation,
  independenceConfirmed,
  onIndependenceConfirmedChange,
  onRoleAdjust,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  importWarnings,
}: MannWhitneyConfigPanelProps) {
  const issues: AnalysisIssue[] = [
    ...(preparation?.issues ?? []),
    ...(!independenceConfirmed ? [{
      code: 'independence_not_confirmed',
      severity: 'error' as const,
      message: 'Confirme que os grupos são independentes e que cada unidade aparece uma única vez.',
      hint: 'Se as medidas são pareadas ou repetidas, Mann–Whitney não é o teste apropriado.',
    }] : []),
  ];
  return (
    <div className="space-y-4">
      {showSoftReset ? <SoftResetAlert /> : null}
      <ModeChoiceCard
        groupLabel="Formato dos grupos"
        options={[...MANN_WHITNEY_FORMAT_OPTIONS]}
        value={format}
        onChange={(value) => onFormatChange(value as MannWhitneyFormat)}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <AlphaSelector value={alpha} onChange={onAlphaChange} />
        <ResearchQuestionField
          value={researchQuestion}
          onChange={onResearchQuestionChange}
          placeholder={defaultQuestion}
        />
      </div>
      <DidacticCards cards={didacticCards} />
      <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={independenceConfirmed}
          onChange={(event) => onIndependenceConfirmedChange(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-primary)]"
        />
        <span>
          Confirmo que os dois grupos são independentes e que cada unidade aparece uma única vez.
        </span>
      </label>
      {preparation ? (
        <section aria-label="Prévia dos grupos" className="rounded-lg border border-border bg-muted/20 p-4">
          <h2 className="text-base font-bold text-foreground">Grupos encontrados</h2>
          {preparation.groups.length ? (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {preparation.groups.slice(0, 20).map((group, index) => (
                <li key={`${group.columnId ?? 'grupo'}-${index}-${group.label}`} className="rounded-full border border-border bg-background px-3 py-1">
                  <strong>{group.label}</strong>: n={group.values.length}
                </li>
              ))}
              {preparation.groups.length > 20 ? (
                <li className="rounded-full border border-border bg-background px-3 py-1">
                  e mais {preparation.groups.length - 20} grupo(s)
                </li>
              ) : null}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">Nenhum grupo válido enquanto os papéis não estiverem vinculados.</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            {preparation.invalidRowCount} linha(s) com ausência ou valor inválido.
            {preparation.invalidRowNumbers.length
              ? ` Linhas: ${preparation.invalidRowNumbers.slice(0, 20).join(', ')}${preparation.invalidRowNumbers.length > 20 ? '…' : ''}.`
              : ''}
          </p>
        </section>
      ) : null}
      <MannWhitneyIssueList issues={issues} />
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={getMannWhitneyTabularOptions(format)}
          onRoleAdjust={onRoleAdjust}
          onConfirm={onConfirm}
          confirmDisabled={hasBlockingIssues(issues)}
          document={document}
          testId={testId}
          onDocumentChange={onDocumentChange}
          importWarnings={importWarnings}
        />
      </div>
    </div>
  );
}

export function MannWhitneyIssueList({ issues }: { issues: AnalysisIssue[] }) {
  if (!issues.length) return null;
  return (
    <div aria-label="Pendências da análise" className="space-y-2">
      {issues.map((issue, index) => (
        <Alert key={`${issue.code}-${index}`} variant={issue.severity === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{issue.severity === 'error' ? 'Corrija antes de analisar' : 'Revise antes de interpretar'}</AlertTitle>
          <AlertDescription>
            {issue.message}
            {issue.hint ? <p className="mt-1">{issue.hint}</p> : null}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export function MannWhitneyValidationAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="border-l-4">
      <AlertTitle className="text-base font-bold">Não foi possível analisar com Mann–Whitney.</AlertTitle>
      <AlertDescription className="text-base">{message}</AlertDescription>
    </Alert>
  );
}
