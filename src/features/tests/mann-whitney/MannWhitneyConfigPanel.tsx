import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ResearchQuestionField } from '@/features/tests/shared/ResearchQuestionField';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import { defaultQuestion, didacticCards, TABULAR_OPTIONS } from './mannWhitneyConfig';

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
  independenceConfirmed,
  onIndependenceConfirmedChange,
  onRoleAdjust,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  importWarnings,
}: MannWhitneyConfigPanelProps) {
  return (
    <div className="space-y-4">
      {showSoftReset ? <SoftResetAlert /> : null}
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
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={TABULAR_OPTIONS}
          onRoleAdjust={onRoleAdjust}
          onConfirm={onConfirm}
          confirmDisabled={!independenceConfirmed}
          document={document}
          testId={testId}
          onDocumentChange={onDocumentChange}
          importWarnings={importWarnings}
        />
      </div>
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
