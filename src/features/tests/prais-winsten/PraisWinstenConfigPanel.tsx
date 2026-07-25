import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { ResearchQuestionField } from '@/features/tests/shared/ResearchQuestionField';
import {
  defaultQuestion,
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
  researchQuestion: string;
  onResearchQuestionChange: (value: string) => void;
  onConfirm: (confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) => void;
}

export function PraisWinstenConfigPanel({
  loadedInput,
  alpha,
  onAlphaChange,
  researchQuestion,
  onResearchQuestionChange,
  onConfirm,
}: PraisWinstenConfigPanelProps) {
  const previewDataset = buildDatasetFromConfirmed({
    headers: loadedInput.headers,
    rows: loadedInput.rows,
    recognizedColumns: loadedInput.recognizedColumns,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AlphaSelector value={alpha} onChange={onAlphaChange} />
        <ResearchQuestionField
          value={researchQuestion}
          onChange={onResearchQuestionChange}
          placeholder={defaultQuestion}
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
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

export function PraisWinstenValidationAlert({ message }: { message: string }) {
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
