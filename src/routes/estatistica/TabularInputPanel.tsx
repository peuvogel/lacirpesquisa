import { useRef, useState, type ChangeEvent, type DragEvent, type ReactElement } from 'react';
import { Check, Copy, Eraser, FileText, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { UseTabularInputResult } from '@/shared/data-input/useTabularInput';
import { ColumnPreviewTable } from './ColumnPreviewTable';
import { PastePreviewTable } from './PastePreviewTable';

const ACCEPTED_FILE_TYPES = '.csv,.txt,.tsv,.xlsx';

/** Ação sobre a caixa de dados: ícone de dois quadradinhos + rótulo simples sem fundos nem pílulas. */
function TableActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactElement;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/action flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer select-none"
    >
      <span
        aria-hidden
        className="text-muted-foreground transition-colors duration-150 group-hover/action:text-foreground [&>svg]:size-4"
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

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
  importSummary,
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
  // Enquanto a caixa está focada o usuário está editando o texto, então as
  // ações saem da frente. O estado é da textarea, não do wrapper: com
  // `focus-within` os botões sumiriam ao receberem o próprio clique.
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Colar traz uma tabela nova e passa pelo guarda de "Substituir dados";
  // digitar é edição do próprio texto e não pode virar uma pergunta a cada
  // tecla — era o que fazia o Enter abrir a confirmação em vez de quebrar linha.
  const pastedRef = useRef(false);

  function handleTextareaPaste() {
    pastedRef.current = true;
  }

  function handleTextareaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const camePasted = pastedRef.current;
    pastedRef.current = false;
    if (camePasted && onRawTextChange) onRawTextChange(event.target.value);
    else setRawText(event.target.value);
  }

  async function handlePasteClick() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text?.trim()) {
        (onRawTextChange ?? setRawText)(text);
        return;
      }
    } catch {
      // Permissão negada ou API indisponível — cai no fallback abaixo.
    }
    textareaRef.current?.focus();
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (onFileSelect) onFileSelect(file);
      else void setFile(file);
    }
    event.target.value = '';
  }

  // A caixa inteira (textarea + rodapé de upload) é a zona de soltura, então o
  // arrasto só é interceptado quando traz arquivos — largar texto dentro da
  // textarea continua funcionando como antes.
  function isFileDrag(event: DragEvent<HTMLDivElement>) {
    const types = event.dataTransfer?.types;
    return !types || Array.from(types).includes('Files');
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      if (onFileSelect) onFileSelect(file);
      else void setFile(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Passar de um filho para outro dispara dragleave no container; sem esta
    // checagem o destaque piscaria ao cruzar textarea → rodapé.
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
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
          <div className="flex items-center gap-2">
            <Copy className="size-4 text-foreground shrink-0" aria-hidden />
            <h2 className="text-lg font-bold text-foreground">Cole ou envie seus dados</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cole uma tabela copiada do DataSUS/TABNET, digite valores separados por <code>;</code> ou envie um
            arquivo CSV, TSV, TXT ou XLSX. Detectamos as colunas automaticamente.
          </p>
        </div>
      ) : null}


      {/* Colar e enviar arquivo moram na MESMA caixa tracejada: a textarea é o
          corpo, o rodapé é o atalho de upload e a borda pontilhada envolve os
          dois. Soltar um arquivo em qualquer ponto da caixa importa os dados. */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        data-dropzone="true"
        data-drag-over={isDragOver ? 'true' : undefined}
        className={cn(
          'overflow-hidden rounded-lg border-2 border-dashed transition-all duration-300',
          status === 'loaded'
            ? 'animate-pulse-input-green border-emerald-500/50 bg-emerald-500/[0.02]'
            : status === 'error'
            ? 'animate-pulse-input-red border-red-500/50 bg-red-500/[0.02]'
            : 'border-border bg-background hover:border-white/40',
          isDragOver &&
            'border-primary bg-primary/10 shadow-[0_0_24px_rgba(32,153,120,0.35),inset_0_0_16px_rgba(32,153,120,0.12)]',
        )}
      >
        <div className="relative">
          <textarea
            ref={textareaRef}
            aria-label="Cole aqui os dados copiados do DataSUS/TABNET"
            value={rawText}
            onChange={handleTextareaChange}
            onPaste={handleTextareaPaste}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            rows={10}
            className="block w-full resize-y border-0 bg-transparent px-3 py-2 text-foreground outline-none"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-data)',
              lineHeight: 'var(--text-data--line-height)',
            }}
          />

          {/* Permanece montado mesmo escondido: alternar opacidade (e não
              desmontar) mantém os botões consultáveis por nome acessível. */}
          <div
            data-editing={isEditing ? 'true' : undefined}
            className={cn(
              'pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200',
              isEditing ? 'opacity-0' : 'opacity-100',
            )}
          >
            <div
              role="group"
              aria-label="Ações da tabela"
              className={cn(
                'flex flex-wrap items-center justify-center gap-2',
                isEditing ? 'pointer-events-none' : 'pointer-events-auto',
              )}
            >
              <TableActionButton
                icon={<Copy />}
                label="Colar dados"
                onClick={handlePasteClick}
              />
              {onClear ? (
                <TableActionButton
                  icon={<Eraser />}
                  label="Apagar"
                  onClick={onClear}
                />
              ) : null}
              {onUseExample ? (
                <TableActionButton
                  icon={<FileText />}
                  label="Usar exemplo"
                  onClick={onUseExample}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* A conferência acontece aqui dentro, colada ao texto que a gerou: sem
            isto os dados só viravam tabela no passo seguinte, e era preciso
            confiar na leitura do parser sem ver nada. Enquanto analisa ou dá
            erro não aparece — o aviso abaixo já diz o que houve. */}
        {loadedOk && headers.length ? (
          <div className="border-t-2 border-dashed border-inherit">
            <PastePreviewTable headers={headers} bodyRows={bodyRows} />
          </div>
        ) : null}

        {/* Divisória pontilhada: separa o corpo do rodapé sem quebrar a caixa
            em dois cartões. `border-inherit` acompanha a cor de cada estado. */}
        <label
          className={cn(
            'group/upload flex cursor-pointer flex-col items-center justify-center gap-1.5 border-t-2 border-dashed border-inherit px-4 py-4 text-center text-sm transition-colors duration-300',
            isDragOver ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Upload
            className={cn(
              'h-5 w-5 transition-all duration-300 group-hover/upload:scale-105',
              isDragOver ? 'text-primary' : 'text-muted-foreground/70 group-hover/upload:text-white',
            )}
          />
          <span>Arraste um arquivo CSV, TSV, TXT ou XLSX aqui ou clique para selecionar</span>
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileInputChange}
            className="sr-only"
            aria-label="Selecionar arquivo de dados (.csv, .txt, .tsv, .xlsx)"
          />
        </label>
      </div>

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
          onClear={onClear}
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
