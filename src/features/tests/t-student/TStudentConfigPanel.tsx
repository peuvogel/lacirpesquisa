import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { RoleBindingPanel } from '@/features/tests/shared/RoleBindingPanel';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ModeChoiceCard } from '@/features/tests/shared/ModeChoiceCard';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import {
  didacticCards,
  MODE_OPTIONS,
  TABULAR_OPTIONS,
  type TStudentMode,
} from './tStudentConfig';

export interface TStudentLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface TStudentConfigPanelProps {
  loadedInput: TStudentLoadedInput;
  mode: TStudentMode;
  onModeChange: (mode: TStudentMode) => void;
  alpha: AlphaValue;
  onAlphaChange: (value: AlphaValue) => void;
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

export function TStudentConfigPanel({
  loadedInput,
  mode,
  onModeChange,
  alpha,
  onAlphaChange,
  showSoftReset,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  onUndo,
  importWarnings,
}: TStudentConfigPanelProps) {
  return (
    <div className="space-y-4">
      <ModeChoiceCard
        groupLabel="Tipo de comparação"
        options={[...MODE_OPTIONS]}
        value={mode}
        onChange={(value) => onModeChange(value as TStudentMode)}
      />

      {showSoftReset ? <SoftResetAlert /> : null}

      {/* Significância e papéis lado a lado: as duas escolhas que governam a
          análise, agora fora da tabela. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlphaSelector value={alpha} onChange={onAlphaChange} />
        <RoleBindingPanel
          document={document}
          testId={testId}
          tabularOptions={TABULAR_OPTIONS}
          onDocumentChange={onDocumentChange}
        />
      </div>

      <DidacticCards cards={didacticCards} />

      <div className="space-y-3">
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={TABULAR_OPTIONS}
          onUndo={onUndo}
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

export function TStudentValidationAlert({ message }: { message: string }) {
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
