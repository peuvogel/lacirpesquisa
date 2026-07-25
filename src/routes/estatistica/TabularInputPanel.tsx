import { useState, type ChangeEvent, type DragEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { UseTabularInputResult } from '@/shared/data-input/useTabularInput';
import { ColumnPreviewTable } from './ColumnPreviewTable';

const ACCEPTED_FILE_TYPES = '.csv,.txt,.tsv,.xlsx';

export interface TabularInputPanelProps extends UseTabularInputResult {
  onConfirm?: (confirmed: { headers: string[]; rows: string[][] }) => void;
}

/**
 * Textarea + file dropzone + friendly error Alert (UI-03). Purely
 * presentational: the useTabularInput result is passed in as props by the
 * caller (the demo stub in 01-10, the wizard panel in 01-08), so this
 * component owns no parsing logic of its own.
 */
export function TabularInputPanel({
  status,
  rawText,
  setRawText,
  setFile,
  headers,
  bodyRows,
  recognizedColumns,
  error,
  onConfirm,
}: TabularInputPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleTextareaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setRawText(event.target.value);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void setFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void setFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleConfirm(confirmed: { headers: string[]; rows: string[][] }) {
    onConfirm?.(confirmed);
  }

  return (
    <div className="space-y-4">
      {status === 'idle' ? (
        <div>
          <h2 className="text-lg font-bold text-foreground">Cole ou envie seus dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cole uma tabela copiada do DataSUS/TABNET, digite valores separados por <code>;</code> ou envie um
            arquivo <code>.csv</code>/<code>.xlsx</code>. Detectamos as colunas automaticamente — você confirma
            antes de continuar.
          </p>
        </div>
      ) : null}

      <textarea
        aria-label="Cole aqui os dados copiados do DataSUS/TABNET"
        value={rawText}
        onChange={handleTextareaChange}
        rows={10}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-data)', lineHeight: 'var(--text-data--line-height)' }}
      />

      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        data-drag-over={isDragOver ? 'true' : undefined}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors',
          isDragOver && 'border-primary bg-primary/10 text-primary',
        )}
      >
        <span>Arraste um arquivo .csv/.xlsx aqui ou clique para selecionar</span>
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileInputChange}
          className="sr-only"
          aria-label="Selecionar arquivo de dados (.csv, .txt, .tsv, .xlsx)"
        />
      </label>

      {status === 'parsing' ? (
        <div role="status" aria-live="polite" className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
          Analisando os dados…
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div aria-live="polite">
          <Alert variant="destructive">
            <AlertTitle>Não conseguimos reconhecer esses dados</AlertTitle>
            <AlertDescription>
              <p>
                Confira se há pelo menos duas colunas e tente novamente — aceitamos texto colado do DataSUS/TABNET,{' '}
                <code>;</code>, vírgula decimal, CSV ou Excel.
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-bold">Ver detalhes</summary>
                <ul className="mt-1 list-disc pl-4">
                  {error.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </details>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {status === 'loaded' ? (
        <ColumnPreviewTable
          headers={headers}
          bodyRows={bodyRows}
          recognizedColumns={recognizedColumns}
          onConfirm={handleConfirm}
        />
      ) : null}
    </div>
  );
}
