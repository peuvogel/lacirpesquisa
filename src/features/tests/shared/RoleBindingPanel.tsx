import { useMemo } from 'react';
import { History, Info } from 'lucide-react';

import { deriveRecognizedColumnsFromDocument } from '@/shared/data-input/analysisTable';
import {
  clearTableRoleBindings,
  setTableRoleBinding,
  type TableDocument,
} from '@/shared/data-input/tableDocument';
import type { TabularInputOptions } from '@/shared/data-input/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { roleExample, roleHelp, roleLabel } from './roleHelp';

function columnLabel(header: string, index: number): string {
  return `${header || `Coluna ${index + 1}`} · coluna ${index + 1}`;
}

export interface RoleBindingPanelProps {
  document?: TableDocument;
  testId?: string;
  tabularOptions?: TabularInputOptions;
  onDocumentChange?: (document: TableDocument) => void;
}

/**
 * Escolha de qual coluna cumpre cada papel da análise, ao lado do nível de
 * significância. Os vínculos são por teste (`document.bindings[testId]`), ao
 * contrário de colunas, tipos e interruptores, que são da tabela inteira.
 */
export function RoleBindingPanel({
  document,
  testId,
  tabularOptions,
  onDocumentChange,
}: RoleBindingPanelProps) {
  const bindingKeys = useMemo(() => {
    if (!document || !testId || !tabularOptions) return [];
    return [...new Set([
      ...(tabularOptions.requiredKeys ?? []),
      ...Object.keys(tabularOptions.aliases ?? {}),
      ...(tabularOptions.numericKeys ?? []),
      ...(tabularOptions.temporalKeys ?? []),
    ])];
  }, [document, tabularOptions, testId]);

  const recognizedColumns = useMemo(
    () => (document && testId && tabularOptions
      ? deriveRecognizedColumnsFromDocument(document, testId, tabularOptions)
      : {}),
    [document, tabularOptions, testId],
  );

  if (!bindingKeys.length || !document || !testId) return null;

  const requiredBindingKeys = new Set(tabularOptions?.requiredKeys ?? []);
  const explicitBindings = document.bindings[testId] ?? {};
  const headers = document.columns.map((column) => column.name);

  const hasExplicitBindings = Object.keys(explicitBindings).length > 0;

  function handleBindingChange(role: string, columnId: string) {
    if (!document || !testId) return;
    const next = setTableRoleBinding(document, testId, role, columnId || null);
    if (next !== document) onDocumentChange?.(next);
  }

  function handleRestoreDefaults() {
    if (!document || !testId) return;
    const next = clearTableRoleBindings(document, testId);
    if (next !== document) onDocumentChange?.(next);
  }

  return (
    <section
      aria-label="Vinculações para esta análise"
      className="rounded-lg border border-border p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">Papéis desta análise</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha qual coluna representa cada papel. Isso é independente do tipo dos dados.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
        {/* Sempre montado, só desabilitado enquanto nada foi escolhido à mão —
            aparecer e sumir empurraria o cabeçalho. Mesmo idioma do
            "Redefinir tipos" da prévia. */}
        <button
          type="button"
          onClick={handleRestoreDefaults}
          disabled={!hasExplicitBindings}
          aria-label="Restaurar papéis para a detecção automática"
          title="Devolve todos os papéis à detecção automática"
          className="inline-flex shrink-0 items-center gap-1.5 bg-transparent text-xs font-bold text-muted-foreground transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <History className="size-3.5" aria-hidden />
          Restaurar padrão
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="O que significa cada papel"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-transparent text-white transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <p className="text-sm font-bold text-foreground">O que significa cada papel</p>
            <dl className="mt-2 space-y-2">
              {bindingKeys.map((role) => {
                const example = roleExample(testId, role);
                return (
                  <div key={role}>
                    <dt className="text-xs font-bold text-foreground">{roleLabel(role)}</dt>
                    {/* Definição e exemplo em elementos separados: o exemplo é
                        o que tira a dúvida, mas cada um tem de continuar
                        consultável pelo seu próprio texto. */}
                    <dd className="text-xs text-muted-foreground">
                      <span className="block">{roleHelp(testId, role)}</span>
                      {example ? (
                        <span className="mt-0.5 block font-mono text-[0.6875rem] text-muted-foreground/80">
                          {example}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </PopoverContent>
        </Popover>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {bindingKeys.map((role) => {
          const selectedIndex = recognizedColumns[role];
          const selectedId = selectedIndex === undefined
            ? ''
            : document.columns[selectedIndex]?.id ?? String(selectedIndex);
          const usedIndexes = new Set(
            Object.entries(explicitBindings)
              .filter(([boundRole]) => boundRole !== role)
              .map(([, columnId]) => columnId === null
                ? -1
                : document.columns.findIndex((column) => column.id === columnId))
              .filter((index): index is number => index !== undefined && index >= 0),
          );
          return (
            <label key={role} className="flex flex-col gap-1 text-xs font-bold text-foreground">
              <span>
                {roleLabel(role)}
                {requiredBindingKeys.has(role) ? ' (obrigatório)' : ' (opcional)'}
              </span>
              <select
                aria-label={`Vincular ${roleLabel(role)}`}
                value={selectedId}
                onChange={(event) => handleBindingChange(role, event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-normal"
              >
                <option value="">Não selecionada</option>
                {headers.map((header, index) => {
                  const id = document.columns[index]?.id ?? String(index);
                  return (
                    <option key={id} value={id} disabled={usedIndexes.has(index)}>
                      {columnLabel(header, index)}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}
