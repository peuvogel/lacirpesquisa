import { useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FilterCheck } from '@/components/ui/filterCheck/FilterCheck';
import { cn } from '@/lib/utils';
import { AlphaSelector, type AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { RoleBindingPanel } from '@/features/tests/shared/RoleBindingPanel';
import { DidacticCards } from '@/features/tests/shared/DidacticCards';
import { SoftResetAlert } from '@/features/tests/shared/SoftResetAlert';
import { ModeChoiceCard } from '@/features/tests/shared/ModeChoiceCard';
import { ColumnPreviewTable } from '@/routes/estatistica/ColumnPreviewTable';
import { hasBlockingIssues, type AnalysisIssue } from '@/shared/data-input/analysisIssues';
import type { PreparedGroupedSamples } from '@/shared/data-input/groupedSamples';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { ImportWarning } from '@/shared/data-input/types';
import {
  didacticCards,
  getMannWhitneyTabularOptions,
  MANN_WHITNEY_FORMAT_OPTIONS,
  type MannWhitneyFormat,
} from './mannWhitneyConfig';

export interface MannWhitneyLoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

export interface MannWhitneyConfigPanelProps {
  loadedInput: MannWhitneyLoadedInput;
  alpha: AlphaValue;
  onAlphaChange: (value: AlphaValue) => void;
  showSoftReset: boolean;
  format: MannWhitneyFormat;
  onFormatChange: (format: MannWhitneyFormat) => void;
  preparation: PreparedGroupedSamples | null;
  independenceConfirmed: boolean;
  onIndependenceConfirmedChange: (confirmed: boolean) => void;
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

export function MannWhitneyConfigPanel({
  loadedInput,
  alpha,
  onAlphaChange,
  showSoftReset,
  format,
  onFormatChange,
  preparation,
  independenceConfirmed,
  onIndependenceConfirmedChange,
  onRoleAdjust,
  onConfirm,
  document,
  testId,
  onDocumentChange,
  onUndo,
  importWarnings,
}: MannWhitneyConfigPanelProps) {
  const independenceRef = useRef<HTMLLabelElement>(null);
  const [independencePending, setIndependencePending] = useState(false);

  /**
   * "Analisar dados" sem a confirmação de independência não avança: em vez de
   * falhar em silêncio, traz a caixa de volta à tela e a marca em vermelho.
   */
  function handleConfirm(confirmed: { headers: string[]; rows: string[][]; recognizedColumns: Record<string, number> }) {
    if (!independenceConfirmed) {
      setIndependencePending(true);
      const independenceControl = independenceRef.current;
      if (typeof independenceControl?.scrollIntoView === 'function') {
        independenceControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setIndependencePending(false);
    onConfirm(confirmed);
  }

  const issues: AnalysisIssue[] = [
    ...(preparation?.issues ?? []),
    ...(!independenceConfirmed ? [{
      code: 'independence_not_confirmed',
      severity: 'error' as const,
      message: 'Confirme que os grupos são independentes e que cada unidade aparece uma única vez.',
      hint: 'Se as medidas são pareadas ou repetidas, Mann–Whitney não é o teste apropriado.',
    }] : []),
  ];
  return (
    <div className="space-y-4">
      {showSoftReset ? <SoftResetAlert /> : null}
      <ModeChoiceCard
        groupLabel="Formato dos grupos"
        options={[...MANN_WHITNEY_FORMAT_OPTIONS]}
        value={format}
        onChange={(value) => onFormatChange(value as MannWhitneyFormat)}
      />
      <p className="text-sm text-muted-foreground">
        {format === 'wide'
          ? 'Escolha abaixo Grupo A = Bahia e Grupo B = Pernambuco, por exemplo. As duas colunas devem conter o mesmo desfecho numérico, como dias de internação. Mês/ano é contexto, não um dos grupos; totais não são observações.'
          : 'Vincule Desfecho à coluna numérica (ex.: Dias) e Grupo à coluna Estado/UF, cujas células contêm Bahia e Pernambuco. Escolha a coluna que identifica os estados, não um estado isolado. Se cada estado já está em sua própria coluna numérica, use “Uma coluna por grupo”.'}
      </p>
      <p className="text-sm text-muted-foreground">
        Valores mensais agregados dos mesmos estados podem ser pareados ou dependentes no tempo.
        Confirme abaixo a independência apenas se ela corresponde ao desenho dos seus dados.
      </p>
      {/* Significância e papéis lado a lado: as duas escolhas que governam a
          análise, agora fora da tabela. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlphaSelector value={alpha} onChange={onAlphaChange} />
        <RoleBindingPanel
          document={document}
          testId={testId}
          tabularOptions={getMannWhitneyTabularOptions(format)}
          onDocumentChange={onDocumentChange}
        />
      </div>
      <DidacticCards cards={didacticCards} />
      <label
        ref={independenceRef}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
          independencePending
            ? 'animate-shake-lock border-destructive/60 text-destructive'
            : 'border-border text-foreground hover:border-border-strong',
        )}
      >
        <input
          type="checkbox"
          checked={independenceConfirmed}
          onChange={(event) => {
            setIndependencePending(false);
            onIndependenceConfirmedChange(event.target.checked);
          }}
          className="peer sr-only"
        />
        <FilterCheck
          checked={independenceConfirmed}
          invalid={independencePending}
          className="mt-0.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--color-accent)]"
        />
        <span>
          Confirmo que os dois grupos são independentes e que cada unidade aparece uma única vez.
        </span>
      </label>
      {preparation ? (
        <section aria-label="Prévia dos grupos" className="rounded-lg border border-border p-4">
          <h2 className="text-base font-bold text-foreground">Grupos encontrados</h2>
          {preparation.groups.length ? (
            <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
              {preparation.groups.slice(0, 20).map((group, index) => (
                <div
                  key={`${group.columnId ?? 'grupo'}-${index}-${group.label}`}
                  className="flex items-baseline justify-between gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <dt className="truncate text-base font-bold text-foreground">{group.label}</dt>
                  <dd
                    className="shrink-0 text-base text-muted-foreground"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    n = {group.values.length}
                  </dd>
                </div>
              ))}
              {preparation.groups.length > 20 ? (
                <div className="px-2 py-1.5 text-base text-muted-foreground">
                  e mais {preparation.groups.length - 20} grupo(s)
                </div>
              ) : null}
            </dl>
          ) : <p className="mt-3 text-base text-muted-foreground">Nenhum grupo válido enquanto os papéis não estiverem vinculados.</p>}
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            {preparation.invalidRowCount} linha(s) com ausência ou valor inválido.
            {preparation.invalidRowNumbers.length
              ? ` Linhas: ${preparation.invalidRowNumbers.slice(0, 20).join(', ')}${preparation.invalidRowNumbers.length > 20 ? '…' : ''}.`
              : ''}
          </p>
        </section>
      ) : null}
      <MannWhitneyIssueList issues={issues} />
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
        <p className="text-sm text-muted-foreground">Fonte: {loadedInput.sourceLabel}.</p>
        <ColumnPreviewTable
          headers={loadedInput.headers}
          bodyRows={loadedInput.rows}
          recognizedColumns={loadedInput.recognizedColumns}
          tabularOptions={getMannWhitneyTabularOptions(format)}
          confirmMode={format === 'wide' ? 'independent-columns' : 'numeric-required'}
          onRoleAdjust={onRoleAdjust}
          onUndo={onUndo}
          onConfirm={handleConfirm}
          confirmDisabled={hasBlockingIssues(
            issues.filter((issue) => issue.code !== 'independence_not_confirmed'),
          )}
          document={document}
          testId={testId}
          onDocumentChange={onDocumentChange}
          importWarnings={importWarnings}
        />
      </div>
    </div>
  );
}

export function MannWhitneyIssueList({ issues }: { issues: AnalysisIssue[] }) {
  if (!issues.length) return null;
  return (
    <div aria-label="Pendências da análise" className="space-y-2">
      {issues.map((issue, index) => (
        <Alert key={`${issue.code}-${index}`} variant={issue.severity === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{issue.severity === 'error' ? 'Corrija antes de analisar' : 'Revise antes de interpretar'}</AlertTitle>
          <AlertDescription>
            {issue.message}
            {issue.hint ? <p className="mt-1">{issue.hint}</p> : null}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export function MannWhitneyValidationAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="border-l-4">
      <AlertTitle className="text-base font-bold">Não foi possível analisar com Mann–Whitney.</AlertTitle>
      <AlertDescription className="text-base">{message}</AlertDescription>
    </Alert>
  );
}
