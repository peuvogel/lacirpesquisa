import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ModeChoiceCard } from '@/features/tests/shared/ModeChoiceCard';
import { ResearchQuestionField } from '@/features/tests/shared/ResearchQuestionField';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import {
  defaultQuestion,
  didacticCards,
  METHOD_OPTIONS,
  TABULAR_OPTIONS,
  type CorrelacaoMethod,
} from './correlacaoConfig';

export interface CorrelacaoLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface CorrelacaoConfigPanelProps {
  loadedInput: CorrelacaoLoadedInput;
  method: CorrelacaoMethod;
  onMethodChange: (method: CorrelacaoMethod) => void;
  alpha: AlphaValue;
  onAlphaChange: (value: AlphaValue) => void;
  researchQuestion: string;
  onResearchQuestionChange: (value: string) => void;
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

export function CorrelacaoConfigPanel({
  loadedInput,
  method,
  onMethodChange,
  alpha,
  onAlphaChange,
  researchQuestion,
  onResearchQuestionChange,
  showSoftReset,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  importWarnings,
}: CorrelacaoConfigPanelProps) {
  return (
    <div className="space-y-4">
      <ModeChoiceCard
        groupLabel="Método de correlação"
        options={[...METHOD_OPTIONS]}
        value={method}
        onChange={(value) => onMethodChange(value as CorrelacaoMethod)}
      />

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

      <div className="space-y-3">
        <div
          role="status"
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <p className="font-bold text-foreground">Tabela pronta para configurar</p>
          <p className="text-muted-foreground">
            Fonte: {loadedInput.sourceLabel}. Clique nas células ou nos nomes das colunas para ajustar.
          </p>
        </div>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={TABULAR_OPTIONS}
          onConfirm={onConfirm}
          editable
          document={document}
          testId={testId}
          onDocumentChange={onDocumentChange}
          importWarnings={importWarnings}
        />
      </div>
    </div>
  );
}

export function CorrelacaoValidationAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="border-l-4">
      <AlertTitle className="text-base font-bold">Não foi possível analisar com estas configurações.</AlertTitle>
      <AlertDescription className="text-base">
        {message}
        <p className="mt-2">Ajuste os dados ou as opções acima e tente novamente.</p>
      </AlertDescription>
    </Alert>
  );
}
