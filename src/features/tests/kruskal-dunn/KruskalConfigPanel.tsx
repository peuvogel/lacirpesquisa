import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { RoleBindingPanel } from '@/features/tests/shared/RoleBindingPanel';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import {
  didacticCards,
  TABULAR_OPTIONS,
} from './kruskalConfig';

export interface KruskalLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface KruskalConfigPanelProps {
  loadedInput: KruskalLoadedInput;
  alpha: AlphaValue;
  onAlphaChange: (value: AlphaValue) => void;
  showSoftReset: boolean;
  onRoleAdjust: () => void;
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

export function KruskalConfigPanel({
  loadedInput,
  alpha,
  onAlphaChange,
  showSoftReset,
  onRoleAdjust,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  onUndo,
  importWarnings,
}: KruskalConfigPanelProps) {
  return (
    <div className="space-y-4">
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
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={TABULAR_OPTIONS}
          onRoleAdjust={onRoleAdjust}
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

export function KruskalValidationAlert({ message }: { message: string }) {
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
