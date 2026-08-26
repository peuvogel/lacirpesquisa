import { useState, type ChangeEvent, type DragEvent } from 'react';
import { Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { UseTabularInputResult } from '@/shared/data-input/useTabularInput';
import { ColumnPreviewTable } from './ColumnPreviewTable';

const ACCEPTED_FILE_TYPES = '.csv,.txt,.tsv,.xlsx';

export interface TabularInputPanelProps extends UseTabularInputResult {
  onConfirm?: (confirmed: { headers: string[]; rows: string[][] }) => void;
  onUseExample?: () => void;
  onClear?: () => void;
  onRawTextChange?: (text: string) => void;
  onFileSelect?: (file: File) => void;
  pendingAction?: string | null;
  onConfirmPendingAction?: () => void;
  onCancelPendingAction?: () => void;
  /** When false, loaded data is acknowledged without rendering ColumnPreviewTable (01-10 flow). */
  showPreview?: boolean;
}

/**
 * Textarea + file dropzone + friendly error Alert.
 * On successful parse, shows a clear visual OK state (morph target for scroll flow).
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
  onUseExample,
  onClear,
  onRawTextChange,
  onFileSelect,
  pendingAction,
  onConfirmPendingAction,
  onCancelPendingAction,
  showPreview = true,
}: TabularInputPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleTextareaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    (onRawTextChange ?? setRawText)(event.target.value);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (onFileSelect) onFileSelect(file);
      else void setFile(file);
    }
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (onFileSelect) onFileSelect(file);
      else void setFile(file);
    }
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

  const loadedOk = status === 'loaded';

  return (
    <div className="space-y-4">
      {status === 'idle' ? (
        <div>
          <h2 className="text-lg font-bold text-foreground">Cole ou envie seus dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cole uma tabela copiada do DataSUS/TABNET, digite valores separados por <code>;</code> ou envie um
            arquivo <code>.csv</code>/<code>.xlsx</code>. Detectamos as colunas automaticamente.
          </p>
        </div>
      ) : null}

      {onUseExample || onClear ? (
        <div aria-label="Ações da tabela" className="flex flex-wrap gap-2">
          {onUseExample ? <Button type="button" variant="outline" onClick={onUseExample}>Usar exemplo</Button> : null}
          {onClear ? <Button type="button" variant="outline" onClick={onClear}>Limpar tabela</Button> : null}
        </div>
      ) : null}

      {loadedOk ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Dados reconhecidos</p>
            <p className="text-sm text-muted-foreground">
              {bodyRows.length} linhas · {headers.length} colunas. Ajuste a tabela abaixo e clique em Analisar
              dados.
            </p>
          </div>
        </div>
      ) : null}

      <>
          <textarea
            aria-label="Cole aqui os dados copiados do DataSUS/TABNET"
            value={rawText}
            onChange={handleTextareaChange}
            rows={10}
            className={cn(
              'w-full rounded-lg border bg-background px-3 py-2 text-foreground transition-colors',
              status === 'error' ? 'border-destructive' : 'border-border',
            )}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-data)',
              lineHeight: 'var(--text-data--line-height)',
            }}
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
      </>

      {status === 'parsing' ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground"
        >
          Analisando os dados…
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div aria-live="polite">
          <Alert variant="destructive">
            <AlertTitle>Não conseguimos reconhecer esses dados</AlertTitle>
            <AlertDescription>
              <p className="font-bold">{error.message}</p>
              <p className="mt-1">
                Confira se há pelo menos duas colunas e tente novamente. Aceitamos texto colado do DataSUS/TABNET,{' '}
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

      {status === 'loaded' && showPreview ? (
        <ColumnPreviewTable
          headers={headers}
          bodyRows={bodyRows}
          recognizedColumns={recognizedColumns}
          onConfirm={handleConfirm}
        />
      ) : null}
      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) onCancelPendingAction?.(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction}</DialogTitle>
            <DialogDescription>Há edições na tabela atual. Deseja descartá-las?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancelPendingAction}>Manter tabela</Button>
            <Button type="button" variant="destructive" onClick={onConfirmPendingAction}>Descartar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
