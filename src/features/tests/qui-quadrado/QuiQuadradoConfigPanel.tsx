import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { RoleBindingPanel } from '@/features/tests/shared/RoleBindingPanel';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import type { QuiQuadradoInputFormat } from './quiQuadradoEngine';
import {
  didacticCards,
  TABULAR_OPTIONS,
} from './quiQuadradoConfig';

export interface QuiQuadradoLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface QuiQuadradoConfigPanelProps {
  inputFormat: QuiQuadradoInputFormat;
  resolvedFormat: 'individual' | 'counts';
  onInputFormatChange: (format: QuiQuadradoInputFormat) => void;
  loadedInput: QuiQuadradoLoadedInput;
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

export function QuiQuadradoConfigPanel({
  inputFormat,
  resolvedFormat,
  onInputFormatChange,
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
}: QuiQuadradoConfigPanelProps) {
  return (
    <div className="space-y-4">
      {showSoftReset ? <SoftResetAlert /> : null}

      <label className="block space-y-2 text-sm font-medium">
        <span>Formato dos dados</span>
        <select className="block w-full rounded-md border border-border bg-background p-2 text-foreground"
          value={inputFormat} onChange={(event) => onInputFormatChange(event.target.value as QuiQuadradoInputFormat)}>
          <option value="auto">Detectar automaticamente</option>
          <option value="counts">Tabela de contagens (DATASUS)</option>
          <option value="individual">Dados individuais (duas categorias)</option>
        </select>
      </label>
      {resolvedFormat === 'counts' ? (
        <p className="text-sm text-muted-foreground" role="status">
          Tabela de contagens: a primeira coluna identifica as linhas; as demais colunas ativas contêm as frequências.
          A linha e a coluna Total e as notas da fonte não entram no cálculo. Nenhuma contagem é transformada em categoria.
        </p>
      ) : <p className="text-sm text-muted-foreground">Uma observação por linha. Se os dados já são frequências sem uma linha ou coluna Total, selecione Tabela de contagens (DATASUS).</p>}

      {/* Significância e papéis lado a lado: as duas escolhas que governam a
          análise, agora fora da tabela. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlphaSelector value={alpha} onChange={onAlphaChange} />
        {resolvedFormat === 'individual' ? <RoleBindingPanel
          document={document}
          testId={testId}
          tabularOptions={TABULAR_OPTIONS}
          onDocumentChange={onDocumentChange}
        /> : null}
      </div>

      <DidacticCards cards={didacticCards} />

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={resolvedFormat === 'counts' ? { requiredKeys: [] } : TABULAR_OPTIONS}
          confirmMode="categorical-pair"
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

export function QuiQuadradoValidationAlert({ message }: { message: string }) {
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
