import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ModeChoiceCard } from '@/features/tests/shared/ModeChoiceCard';
import { ResearchQuestionField } from '@/features/tests/shared/ResearchQuestionField';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import {
  defaultQuestion,
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
  researchQuestion: string;
  onResearchQuestionChange: (value: string) => void;
  showSoftReset: boolean;
  onConfirm: (confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) => void;
}

export function TStudentConfigPanel({
  loadedInput,
  mode,
  onModeChange,
  alpha,
  onAlphaChange,
  researchQuestion,
  onResearchQuestionChange,
  showSoftReset,
  onConfirm,
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
