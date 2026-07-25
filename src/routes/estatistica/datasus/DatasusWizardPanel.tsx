import { useRef, type ChangeEvent, type ClipboardEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DATASUS_COLUMN_ROLES,
  DATASUS_VARIABLE_TYPES,
  headerSelectOptions,
  useDatasusWizard,
  type DatasusSession,
} from '@/shared/data-input/useDatasusWizard';
import { DatasusMappingTable } from './DatasusMappingTable';
import { DatasusNormalizedPreview } from './DatasusNormalizedPreview';
import { DatasusSourceCards } from './DatasusSourceCards';

const TITLE = 'Camada Universal DATASUS';
const DESCRIPTION =
  'Importe, revise, corrija e confirme uma base padronizada antes de enviar os dados ao teste.';

const STEPS = [
  { heading: 'Confirmar a linha de cabeçalho' },
  { heading: 'Confirmar o tipo da base' },
  { heading: 'Mapear os papéis das colunas' },
  { heading: 'Confirmar tipos de variável' },
  { heading: 'Pré-visualizar a base normalizada' },
  { heading: 'Confirmar e enviar para a análise' },
] as const;

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-data)',
  lineHeight: 'var(--text-data--line-height)',
} as const;

function roleLabel(role: string): string {
  return DATASUS_COLUMN_ROLES.find((option) => option.value === role)?.label ?? role;
}

function typeLabel(value: string): string {
  return DATASUS_VARIABLE_TYPES.find((option) => option.value === value)?.label ?? value;
}

function statusAlertVariant(tone: 'status' | 'success' | 'error'): 'default' | 'destructive' {
  return tone === 'error' ? 'destructive' : 'default';
}

export interface DatasusWizardPanelProps {
  onSessionChange?: (session: DatasusSession) => void;
}

export function DatasusWizardPanel({ onSessionChange }: DatasusWizardPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wizard = useDatasusWizard({ onSessionChange });
  const { activeSource, sources, status } = wizard;

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const rawText = event.clipboardData.getData('text');
    if (!rawText.trim()) return;
    void wizard.addTextSources(
      [{ rawText, fileName: 'tabela-colada-datasus.tsv', sourceKind: 'paste' }],
      'Tabela DATASUS lida com sucesso. Revise as colunas abaixo.',
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files?.length) void wizard.addFiles(files);
    event.target.value = '';
  }

  if (!activeSource) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">{TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTION}</p>
        </div>

        <Alert variant={statusAlertVariant(status.tone)}>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>

        <div
          role="textbox"
          tabIndex={0}
          aria-label="Cole a tabela do DATASUS aqui"
          onPaste={handlePaste}
          className="flex cursor-text flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center"
        >
          <span aria-hidden className="text-2xl">
            ✨
          </span>
          <h3 className="text-base font-bold text-foreground">Cole a tabela do DATASUS aqui</h3>
          <p className="text-sm text-muted-foreground">
            Selecione as células no TabNet, pressione <strong>Ctrl + C</strong> e em seguida{' '}
            <strong>Ctrl + V</strong> aqui
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Enviar arquivo DATASUS
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="sr-only"
            aria-label="Selecionar arquivo DATASUS"
            onChange={handleFileChange}
          />
          {sources.length ? (
            <Button type="button" variant="ghost" onClick={() => wizard.reset()}>
              Limpar fluxo
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const parsed = activeSource.parsed?.ok ? activeSource.parsed : null;
  const headerOptions = headerSelectOptions(activeSource);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">{TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTION}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Adicionar arquivo
          </Button>
          <Button type="button" variant="ghost" onClick={() => wizard.reset()}>
            Limpar fluxo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.tsv"
            multiple
            className="sr-only"
            aria-label="Selecionar arquivo DATASUS"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <Alert variant={statusAlertVariant(status.tone)}>
        <AlertDescription>{status.message}</AlertDescription>
      </Alert>

      <DatasusSourceCards
        sources={sources}
        activeSourceId={wizard.activeSourceId}
        onSelect={wizard.selectSource}
        onRemove={wizard.removeSource}
      />

      <div
        role="textbox"
        tabIndex={0}
        aria-label="Colar outra tabela DATASUS"
        onPaste={handlePaste}
        className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
      >
        Cole outra tabela aqui (Ctrl+V) para adicionar uma fonte
      </div>

      <div className="space-y-6">
        {/* Passo 1 */}
        <section className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Passo 1 de 6</span>
            <h3 className="text-base font-bold text-foreground">{STEPS[0].heading}</h3>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="datasus-header-select" className="text-sm font-bold">
                Linha do cabeçalho real
              </label>
              <select
                id="datasus-header-select"
                value={parsed?.headerRowIndex ?? 0}
                onChange={(event) => wizard.setHeaderRow(activeSource.id, Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                {headerOptions.map((option) => (
                  <option key={option.rowIndex} value={option.rowIndex}>
                    Linha {option.rowIndex + 1} - {option.preview.slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-sm font-bold">Diagnóstico automático</span>
              <p className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-muted-foreground">
                {parsed?.diagnosis.summaryText}
              </p>
            </div>
          </div>
          {parsed ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm" style={monoStyle}>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-bold">Linha</th>
                    <th className="px-3 py-2 font-bold">Conteúdo</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.lines.map((line) => (
                    <tr key={line.index} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">Linha {line.index + 1}</td>
                      <td className="px-3 py-2">{line.clean || line.raw || '(vazia)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* Passo 2 */}
        <section className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Passo 2 de 6</span>
            <h3 className="text-base font-bold text-foreground">{STEPS[1].heading}</h3>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="datasus-format-select" className="text-sm font-bold">
                Formato
              </label>
              <select
                id="datasus-format-select"
                value={activeSource.mapping?.formatType ?? 'wide'}
                onChange={(event) => wizard.setFormat(activeSource.id, event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="wide">wide</option>
                <option value="long">long</option>
                <option value="hybrid">Não tenho certeza / híbrida</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                O formato orienta como categorias, tempo e medidas são interpretados na normalização.
              </p>
            </div>
            <div>
              <span className="text-sm font-bold">Resumo rápido</span>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-secondary px-2 py-0.5">Colunas: {parsed?.headers.length ?? 0}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                  Linhas de dados: {parsed?.bodyRows.length ?? 0}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    parsed?.diagnosis.hasTotalColumn ? 'bg-destructive/15 text-destructive' : 'bg-secondary',
                  )}
                >
                  Total: {parsed?.diagnosis.hasTotalColumn ? 'sim' : 'não'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Passo 3 */}
        <section className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Passo 3 de 6</span>
            <h3 className="text-base font-bold text-foreground">{STEPS[2].heading}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Defina a dimensão principal, as colunas temporais, medidas, totais e o que deve ser ignorado.
          </p>
          <div className="mt-4">
            <DatasusMappingTable
              source={activeSource}
              onRoleChange={(columnIndex, role) => wizard.setColumnRole(activeSource.id, columnIndex, role)}
            />
          </div>
        </section>

        {/* Passo 4 */}
        <section className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Passo 4 de 6</span>
            <h3 className="text-base font-bold text-foreground">{STEPS[3].heading}</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(activeSource.mapping?.columns ?? [])
              .filter((column) => column.role !== 'ignore')
              .map((column) => (
                <div key={column.index} className="rounded-lg border border-border bg-background px-3 py-2">
                  <h4 className="text-sm font-bold text-foreground">{column.header}</h4>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(column.role)} · {typeLabel(column.variableType)}
                  </p>
                  <label className="sr-only" htmlFor={`type-${activeSource.id}-${column.index}`}>
                    Tipo da coluna {column.header}
                  </label>
                  <select
                    id={`type-${activeSource.id}-${column.index}`}
                    aria-label={`Tipo da coluna ${column.header}`}
                    value={column.variableType}
                    onChange={(event) =>
                      wizard.setColumnType(activeSource.id, column.index, event.target.value)
                    }
                    className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    {DATASUS_VARIABLE_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </section>

        {/* Passo 5 */}
        <section className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Passo 5 de 6</span>
            <h3 className="text-base font-bold text-foreground">{STEPS[4].heading}</h3>
          </div>
          <div className="mt-4">
            <DatasusNormalizedPreview source={activeSource} />
          </div>
          {wizard.session.suggestions.length > 0 ? (
            <Alert className="mt-4">
              <AlertDescription>
                <strong className="block font-bold">Orientação metodológica</strong>
                <ul className="mt-1 list-disc pl-4">
                  {wizard.session.suggestions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </section>

        {/* Passo 6 */}
        <section className="rounded-lg border border-border bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Passo 6 de 6</span>
            <h3 className="text-base font-bold text-foreground">{STEPS[5].heading}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A confirmação trava esta versão da base como entrada confiável para o módulo atual e para outros módulos
            que usem a última sessão DATASUS.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              disabled={!activeSource.normalized?.ok}
              onClick={() => wizard.confirmSource(activeSource.id)}
            >
              Confirmar base normalizada
            </Button>
          </div>
          <div aria-live="polite" className="mt-4">
            <Alert variant={activeSource.confirmed ? 'default' : 'default'}>
              <AlertDescription>
                {activeSource.confirmed
                  ? 'Base confirmada. Os testes já podem consumi-la.'
                  : 'Base ainda não confirmada. Revise o mapeamento antes de prosseguir.'}
              </AlertDescription>
            </Alert>
          </div>
        </section>
      </div>
    </div>
  );
}
