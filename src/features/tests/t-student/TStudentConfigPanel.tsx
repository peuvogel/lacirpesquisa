import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { DatasusSession } from '@/shared/data-input/useDatasusWizard';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ModeChoiceCard } from '@/features/tests/shared/ModeChoiceCard';
import { ResearchQuestionField } from '@/features/tests/shared/ResearchQuestionField';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import {
  defaultQuestion,
  didacticCards,
  MODE_OPTIONS,
  type TStudentMode,
} from './tStudentConfig';
import type { DatasusKnobState } from './tStudentEngine';
import { TStudentDatasusKnobs } from './TStudentDatasusKnobs';

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
  isDatasus: boolean;
  datasusSession: DatasusSession | null;
  datasusKnobs: DatasusKnobState;
  onDatasusKnobsChange: (knobs: DatasusKnobState) => void;
  onConfirm: (confirmed: { headers: string[]; rows: string[][] }) => void;
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
  isDatasus,
  datasusSession,
  datasusKnobs,
  onDatasusKnobsChange,
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

      {isDatasus && datasusSession ? (
        <TStudentDatasusKnobs
          session={datasusSession}
          knobs={datasusKnobs}
          onChange={onDatasusKnobsChange}
        />
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          onConfirm={onConfirm}
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
