# Importação fluida e períodos temporais confiáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconhecer corretamente períodos semestrais e outros calendários no Prais–Winsten, tornar todos os dados importados visíveis e levar diagnósticos acionáveis de colagem/XLSX até a interface dos dez testes.

**Architecture:** Adicionar um reconhecedor temporal puro e orientado pela coluna, mantendo os rótulos separados das coordenadas do modelo. Reforçar o importador compartilhado com matriz retangular e um resumo tipado, persistido no `TableDocument`; integrar somente a semântica temporal ao Prais–Winsten e validar os dez módulos por uma matriz comum.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Testing Library, Vite 8, leitor OOXML local existente, Chart.js 4.

**Spec:** `docs/superpowers/specs/2026-08-31-importacao-periodos-confiaveis-design.md`

## Global Constraints

- Toda mudança deve aparecer na pasta principal por `npm run dev`.
- Não fazer push, não abrir pull request e não publicar no GitHub Pages.
- Não imputar períodos ou valores ausentes e não transformar ausência em zero.
- Não executar Prais–Winsten sobre intervalos realmente irregulares como se fossem regulares.
- CSV, TSV, TXT e XLSX continuam suportados; `.xls` deve ser rejeitado com orientação para conversão.
- Fórmulas XLSX nunca são executadas; somente valores em cache podem ser usados.
- Preservar os limites atuais: arquivo 10 MiB, texto colado 5.000.000 caracteres, 10.000 linhas, 128 colunas e 200.000 células; XLSX até 32 abas, 2.048 entradas ZIP, 16 MiB por entrada e 64 MiB no total.
- Manter escolha explícita de tipo/papel acima de qualquer sugestão automática.
- Alterações de cálculo estatístico exigem regressão numérica que demonstre o defeito; não reformular motores por conveniência.
- Todo comportamento ausente começa por teste vermelho; caracterizações de comportamento já correto podem começar verdes e devem ser identificadas como auditoria.

---

## File Structure

### Novos arquivos

- `src/shared/data-input/temporalPeriods.ts`: reconhecimento de tokens e colunas temporais, índices regulares, coordenadas e diagnósticos.
- `src/shared/data-input/temporalPeriods.test.ts`: matriz pura de formatos, ambiguidades, lacunas, duplicidades e escala.
- `src/shared/data-input/importDiagnostics.ts`: normalização retangular e construção/validação do resumo de importação.
- `src/shared/data-input/importDiagnostics.test.ts`: linhas largas/curtas, cabeçalhos sintetizados, duplicados e metadados.
- `src/routes/estatistica/ImportSummary.tsx`: apresentação compacta e acessível do resumo persistido.
- `src/routes/estatistica/ImportSummary.test.tsx`: informações, avisos e detalhes acessíveis.
- `src/shared/data-input/tabularContractMatrix.test.ts`: contratos de colagem e papéis para os dez testes.

### Arquivos centrais modificados

- `src/shared/data-input/types.ts`: `temporalKeys`, diagnósticos e resumo carregado.
- `src/shared/data-input/parseTabular.ts`: validação temporal, matriz retangular, resumo e extensão de arquivo.
- `src/shared/data-input/tableDocument.ts`: resumo opcional e detecção temporal compartilhada.
- `src/shared/data-input/analysisTable.ts`: validação de papéis temporais.
- `src/shared/data-input/useTabularInput.ts`: propagação e limpeza do resumo.
- `src/shared/data-input/useAnalysisTable.ts`: inclusão do resumo no documento editável.
- `src/shared/data-input/xlsxReader.ts`: sistema 1900/1904, estilos de data e conversão conservadora.
- `src/shared/session/sessionStorage.ts`: validação estrita do novo campo persistido.
- `src/routes/estatistica/ColumnPreviewTable.tsx`: resumo, avisos consolidados e classificação temporal.
- `src/routes/estatistica/TabularInputPanel.tsx`: mensagem de formatos aceitos e estado reconhecido.
- `src/features/tests/prais-winsten/praisConfig.ts`: aliases e `temporalKeys`.
- `src/features/tests/prais-winsten/praisEngine.ts`: resolução por coluna, diagnósticos e base do efeito.
- `src/features/tests/prais-winsten/PraisWinstenConfigPanel.tsx`: periodicidade detectada e seletor.
- `src/features/tests/prais-winsten/PraisWinstenTest.tsx`: estado/invalidação da interpretação temporal.
- `src/features/tests/prais-winsten/praisInterpretation.ts`: frequência e unidade corretas.

---

### Task 1: Reconhecedor temporal puro

**Files:**
- Create: `src/shared/data-input/temporalPeriods.ts`
- Create: `src/shared/data-input/temporalPeriods.test.ts`

**Interfaces:**
- Consumes: apenas strings e a escolha opcional do usuário.
- Produces:

```ts
export type TemporalMode =
  | 'auto' | 'annual' | 'semiannual' | 'quarterly'
  | 'monthly' | 'dates' | 'numeric' | 'order';

export type TemporalFrequency =
  | 'annual' | 'semiannual' | 'quarterly'
  | 'monthly' | 'daily' | 'numeric' | 'order';

export interface ResolvedTemporalValue {
  raw: string;
  label: string;
  canonicalLabel: string;
  periodIndex: number;
  coordinate: number;
  rowNumber: number;
}

export interface TemporalIssue {
  code: 'ambiguous_frequency' | 'invalid_token' | 'mixed_frequency'
    | 'duplicate_period' | 'missing_period' | 'reordered';
  severity: 'error' | 'warning';
  message: string;
  rowNumbers?: number[];
}

export interface TemporalColumnResolution {
  status: 'resolved' | 'ambiguous' | 'invalid';
  mode: TemporalMode;
  frequency: TemporalFrequency | null;
  frequencyLabel: string;
  effectBasis: 'annualized' | 'numeric-unit' | 'observed-interval';
  values: Array<ResolvedTemporalValue | null>;
  issues: TemporalIssue[];
}

export function detectTemporalColumn(
  rawValues: readonly string[],
  header: string,
  mode?: TemporalMode,
): TemporalColumnResolution;

export function isSupportedTemporalToken(raw: string): boolean;
```

- [ ] **Step 1: Write failing semester and rollover tests**

```ts
import { describe, expect, it } from 'vitest';
import { detectTemporalColumn } from './temporalPeriods';

const semesters = [
  '2021.1', '2021.2', '2022.1', '2022.2',
  '2023.1', '2023.2', '2024.1', '2024.2',
  '2025.1', '2025.2', '2026.1', '2026.2',
];

describe('detectTemporalColumn', () => {
  it('detects decimal-looking semester labels across year rollover', () => {
    const result = detectTemporalColumn(semesters, 'Semestre');
    expect(result.status).toBe('resolved');
    expect(result.frequency).toBe('semiannual');
    expect(result.effectBasis).toBe('annualized');
    expect(result.values.map((item) => item?.periodIndex)).toEqual(
      Array.from({ length: 12 }, (_, index) => 4042 + index),
    );
    expect(result.values[1]?.coordinate).toBe(2021.5);
    expect(result.values[2]?.coordinate).toBe(2022);
    expect(result.issues).toEqual([]);
  });

  it('keeps a lone generic decimal series ambiguous', () => {
    const result = detectTemporalColumn(['2021.1', '2022.1'], 'Tempo');
    expect(result.status).toBe('ambiguous');
    expect(result.issues[0]?.code).toBe('ambiguous_frequency');
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npm exec vitest run -- src/shared/data-input/temporalPeriods.test.ts`

Expected: FAIL because `./temporalPeriods` does not exist.

- [ ] **Step 3: Add format, gap and override tests**

```ts
it.each([
  [['2022', '2023'], 'Ano', 'annual'],
  [['2024-S1', '2024-S2'], 'Semestre', 'semiannual'],
  [['T1 2024', '2024-T2'], 'Trimestre', 'quarterly'],
  [['2024-01', '02/2024'], 'Mês', 'monthly'],
  [['2024-01-01', '02/01/2024'], 'Data', 'daily'],
] as const)('recognizes %j as %s', (tokens, header, frequency) => {
  const result = detectTemporalColumn(tokens, header);
  expect(result.status).toBe('resolved');
  expect(result.frequency).toBe(frequency);
});

it('reports an exact missing semester', () => {
  const result = detectTemporalColumn(['2023.1', '2024.1', '2024.2'], 'Semestre');
  expect(result.issues).toContainEqual(expect.objectContaining({
    code: 'missing_period',
    message: expect.stringContaining('2023.2'),
  }));
});

it('reports duplicate rows and mixed frequencies', () => {
  expect(detectTemporalColumn(['2024-S1', '2024-S1'], 'Semestre').issues[0])
    .toMatchObject({ code: 'duplicate_period', rowNumbers: [1, 2] });
  expect(detectTemporalColumn(['2024-S1', '2024-Q2'], 'Período').issues)
    .toContainEqual(expect.objectContaining({ code: 'mixed_frequency' }));
});

it('uses original order only after an explicit order override', () => {
  const result = detectTemporalColumn(['onda B', 'onda A'], 'Onda', 'order');
  expect(result.values.map((item) => item?.coordinate)).toEqual([0, 1]);
  expect(result.values.map((item) => item?.label)).toEqual(['onda B', 'onda A']);
  expect(result.effectBasis).toBe('observed-interval');
});

it('recognizes consecutive month-end dates as monthly cadence', () => {
  const result = detectTemporalColumn(
    ['2024-01-31', '2024-02-29', '2024-03-31'],
    'Data',
  );
  expect(result.frequency).toBe('monthly');
  expect(result.issues).toEqual([]);
});
```

- [ ] **Step 4: Implement the pure recognizer**

Use anchored patterns and calendar validation; do not call `Date.parse` on
locale-dependent text. Encode periods with these primitives:

```ts
const FREQUENCY_STEPS_PER_YEAR = {
  annual: 1,
  semiannual: 2,
  quarterly: 4,
  monthly: 12,
} as const;

function calendarValue(
  raw: string,
  rowNumber: number,
  frequency: keyof typeof FREQUENCY_STEPS_PER_YEAR,
  year: number,
  slot: number,
  label: string,
): ResolvedTemporalValue {
  const steps = FREQUENCY_STEPS_PER_YEAR[frequency];
  return {
    raw,
    label: raw.trim(),
    canonicalLabel: label,
    periodIndex: year * steps + slot - 1,
    coordinate: year + (slot - 1) / steps,
    rowNumber,
  };
}

function utcDayIndex(year: number, month: number, day: number): number {
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return Number.NaN;
  return Math.floor(timestamp / 86_400_000);
}
```

Recognition order in `auto` must be semantic year/semester/quarter/month/date
before generic numeric. For `YYYY.[1-2]`, choose semester only when the header is
semester-like or the complete column contains a `.2 → next-year .1` rollover;
for `YYYY.[1-4]`, choose quarter only with a quarter-like header. Full dates with
successive months and equal day-of-month or all month-end resolve as monthly;
otherwise use integer UTC days. Build duplicate/missing/reordered issues from
`periodIndex`. For daily dates, set `coordinate = periodIndex / 365.2425`; for
numeric mode, keep the parsed number as `coordinate`. Annual/semestral/trimestral/
mensal require index steps of 1. Daily and numeric sequences infer the smallest
positive step and require every later step to match it, so a weekly series remains
valid while a skipped week is identified. Return `ambiguous` instead of guessing
when more than one interpretation remains possible.

- [ ] **Step 5: Run temporal tests**

Run: `npm exec vitest run -- src/shared/data-input/temporalPeriods.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the temporal core**

```bash
git add src/shared/data-input/temporalPeriods.ts src/shared/data-input/temporalPeriods.test.ts
git commit -m "feat: recognize semantic temporal periods"
```

---

### Task 2: Integrate temporal roles and Prais dataset validation

**Files:**
- Modify: `src/shared/data-input/types.ts`
- Modify: `src/shared/data-input/parseTabular.ts`
- Modify: `src/shared/data-input/tableDocument.ts`
- Modify: `src/shared/data-input/analysisTable.ts`
- Modify: `src/routes/estatistica/ColumnPreviewTable.tsx`
- Modify: `src/routes/estatistica/ColumnPreviewTable.test.tsx`
- Modify: `src/features/tests/prais-winsten/praisConfig.ts`
- Modify: `src/features/tests/prais-winsten/praisEngine.ts`
- Modify: `src/features/tests/prais-winsten/praisEngine.test.ts`
- Modify: `src/shared/data-input/analysisTable.test.ts`
- Modify: `src/shared/data-input/tableDocument.test.ts`

**Interfaces:**
- Consumes: `detectTemporalColumn`, `isSupportedTemporalToken`, `TemporalMode` from Task 1.
- Produces:

```ts
export interface TabularInputOptions {
  aliases?: Record<string, string[]>;
  requiredKeys?: string[];
  numericKeys?: string[];
  temporalKeys?: string[];
  expectedFormatLabel?: string;
  positionFallback?: PositionFallbackOptions | null;
}

export interface PraisBuiltDataset {
  time: number[];
  values: number[];
  orderedRows: PraisSeriesRow[];
  validCount: number;
  periodLabel: string;
  timeHeaderLabel: string;
  yHeaderLabel: string;
  idHeaderLabel: string;
  uniqueIds: string[];
  reordered: boolean;
  errors: string[];
  temporal: TemporalColumnResolution;
  issues: AnalysisIssue[];
  frequencyLabel: string;
  effectBasisLabel: string;
}

export function validateSeriesIssues(dataset: PraisBuiltDataset): AnalysisIssue[];
```

- [ ] **Step 1: Write the exact pasted-table regression**

Add to `praisEngine.test.ts`:

```ts
const pastedSemesters = `Semestre\tN de inscritos
2021.1\t90
2021.2\t92
2022.1\t93
2022.2\t95
2023.1\t95
2023.2\t97
2024.1\t98
2024.2\t100
2025.1\t102
2025.2\t105
2026.1\t108
2026.2\t114`;

it('builds the user semester paste as twelve regular observations', () => {
  const parsed = readTabularPasteState(pastedSemesters, legacyStats, TABULAR_OPTIONS);
  expect(parsed.status).toBe('loaded');
  if (parsed.status !== 'loaded') return;
  const dataset = buildDatasetFromConfirmed({
    headers: parsed.headers,
    rows: parsed.bodyRows,
    recognizedColumns: Object.fromEntries(
      Object.entries(parsed.recognizedColumns).map(([key, value]) => [key, value.index]),
    ),
    temporalMode: 'auto',
  });
  expect(dataset.validCount).toBe(12);
  expect(dataset.frequencyLabel).toBe('Semestral');
  expect(dataset.time.slice(0, 3)).toEqual([2021, 2021.5, 2022]);
  expect(validateSeriesIssues(dataset).filter((issue) => issue.severity === 'error')).toEqual([]);
});
```

- [ ] **Step 2: Verify the current false-irregularity failure**

Run: `npm exec vitest run -- src/features/tests/prais-winsten/praisEngine.test.ts -t "user semester"`

Expected: FAIL because `temporalMode`/semantic resolution is absent or because
the current validator emits the irregular-interval error.

- [ ] **Step 3: Add temporal role validation regressions**

```ts
it('classifies semantic semester labels as temporal, not numeric', () => {
  const document = createTableDocument(
    ['Semestre', 'Valor'],
    [['2024-S1', '10'], ['2024-S2', '11']],
    'colado',
    () => 'doc-time',
  );
  expect(document.columns.map((column) => column.type)).toEqual(['tempo', 'numerica']);
});
```

In `analysisTable.test.ts`, assert that a `temporalKeys: ['tempo']` role accepts
`2024-S1`/`2024-S2`, while `2024-X9` appears in `validity.invalid`.

- [ ] **Step 4: Implement `temporalKeys` in shared type checks**

Update `cellMatchesExpectedType`, `tableValiditySummary`, and both column-type
suggesters to use the same predicate:

```ts
function valueMatchesRole(
  value: string,
  key: string,
  numericKeys: readonly string[],
  temporalKeys: readonly string[],
): boolean {
  if (!value.trim()) return false;
  if (temporalKeys.includes(key)) return isSupportedTemporalToken(value);
  if (numericKeys.includes(key)) return parseNumber(value) !== null;
  return true;
}
```

Pass `temporalKeys` through positional fallback compatibility and validity. In
`praisConfig.ts`, add aliases `semestre`, `semester`, `trimestre`, `quarter`,
`mes`, `mês`, `data`; change `numericKeys` to `['variavel_y']` and add
`temporalKeys: ['tempo']`.

Preserve the existing fifth `resolved` parameter and append temporal keys, so a
mapping cannot be mistaken for a list of keys:

```ts
export function tableValiditySummary(
  document: TableDocument,
  testId: string,
  requiredKeys: readonly string[],
  numericKeys: readonly string[] = [],
  resolved?: Record<string, number>,
  temporalKeys: readonly string[] = [],
): TableValiditySummary;
```

- [ ] **Step 5: Integrate column resolution into Prais**

Extend `BuildDatasetInput` with `temporalMode?: TemporalMode`. Resolve all time
cells once, align `temporal.values[rowIndex]` with each source row, preserve raw
labels, and use `coordinate` for the model. Map temporal issues and invalid
desfecho rows to `AnalysisIssue`:

```ts
const temporal = detectTemporalColumn(
  rows.map((row) => normalizeSpaces(row[timeIndex!] ?? '')),
  dataset.timeHeaderLabel,
  input.temporalMode ?? 'auto',
);

const issues: AnalysisIssue[] = temporal.issues.map((issue) => ({
  code: `temporal_${issue.code}`,
  severity: issue.severity,
  message: issue.message,
  rowNumbers: issue.rowNumbers,
  hint: issue.severity === 'error'
    ? 'Corrija os períodos ou escolha explicitamente a periodicidade antes de analisar.'
    : undefined,
}));
```

Add `timePeriodIndex: number` to `PraisSeriesRow`. After excluding an invalid
desfecho, validate gaps over the remaining ordered rows' `timePeriodIndex`, not
over the unfiltered column. Numeric mode normalizes a regular numeric sequence to
integer period indexes while preserving the raw numeric coordinate.

`validateSeriesIssues` must add minimum length, series cap, negative values and
invalid/missing outcome issues, but must use temporal `periodIndex` for gaps.
Keep `validateSeries(dataset): string[]` as a compatibility adapter that returns
only blocking messages; migrate UI callers later to the structured function.

- [ ] **Step 6: Run focused shared and Prais tests**

Run:

```bash
npm exec vitest run -- \
  src/shared/data-input/temporalPeriods.test.ts \
  src/shared/data-input/tableDocument.test.ts \
  src/shared/data-input/analysisTable.test.ts \
  src/features/tests/prais-winsten/praisEngine.test.ts
```

Expected: PASS, including the exact 12-semester regression and the existing true
gap rejection.

- [ ] **Step 7: Commit role and engine integration**

```bash
git add src/shared/data-input/types.ts src/shared/data-input/parseTabular.ts \
  src/shared/data-input/tableDocument.ts src/shared/data-input/analysisTable.ts \
  src/shared/data-input/tableDocument.test.ts src/shared/data-input/analysisTable.test.ts \
  src/routes/estatistica/ColumnPreviewTable.tsx \
  src/routes/estatistica/ColumnPreviewTable.test.tsx \
  src/features/tests/prais-winsten/praisConfig.ts \
  src/features/tests/prais-winsten/praisEngine.ts \
  src/features/tests/prais-winsten/praisEngine.test.ts
git commit -m "fix: analyze regular semester series"
```

---

### Task 3: Add visible periodicity control and correct effect labels

**Files:**
- Modify: `src/features/tests/prais-winsten/PraisWinstenConfigPanel.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.tsx`
- Modify: `src/features/tests/prais-winsten/praisEngine.ts`
- Modify: `src/features/tests/prais-winsten/praisInterpretation.ts`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx`
- Modify: `src/features/tests/prais-winsten/praisInterpretation.test.ts`

**Interfaces:**
- Consumes: `TemporalMode`, `TemporalColumnResolution`, and
  `validateSeriesIssues` from Tasks 1–2.
- Produces: controlled selector `Interpretar períodos como`, structured validation
  alert, and effect text tied to `effectBasis`.

- [ ] **Step 1: Write the end-to-end component regression**

Add this regression to `PraisWinstenTest.test.tsx` (and import `fireEvent` from
Testing Library):

```tsx
const pastedSemesters = `Semestre\tN de inscritos
2021.1\t90
2021.2\t92
2022.1\t93
2022.2\t95
2023.1\t95
2023.2\t97
2024.1\t98
2024.2\t100
2025.1\t102
2025.2\t105
2026.1\t108
2026.2\t114`;

it('detects pasted semesters, exposes an override and reaches results', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPraisWinsten();
  fireEvent.change(
    screen.getByLabelText('Cole aqui os dados copiados do DataSUS/TABNET'),
    { target: { value: pastedSemesters } },
  );
  await vi.advanceTimersByTimeAsync(200);

  expect(await screen.findByText(/Periodicidade detectada: Semestral/i)).toBeInTheDocument();
  expect(screen.getByLabelText('Interpretar períodos como')).toHaveValue('auto');
  expect(screen.getByText(/efeito anualizado/i)).toBeInTheDocument();

  await runToResultados(user);
  expect(screen.queryByText(/intervalos irregulares/i)).not.toBeInTheDocument();
  expect(screen.getAllByText(/Semestral/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/2021\.1 a 2026\.2/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify the missing-control failure**

Run: `npm exec vitest run -- src/features/tests/prais-winsten/PraisWinstenTest.test.tsx -t "detects pasted semesters"`

Expected: FAIL because the periodicity selector/status is absent.

- [ ] **Step 3: Implement controlled periodicity UI**

Add props:

```ts
temporalMode: TemporalMode;
onTemporalModeChange: (mode: TemporalMode) => void;
```

Render this accessible control before `SeriesPreviewTable`:

```tsx
<section aria-label="Configuração temporal" className="rounded-lg border border-border p-3">
  <p className="text-sm font-bold text-foreground">
    Periodicidade detectada: {previewDataset.frequencyLabel || 'não definida'}
  </p>
  <p className="mt-1 text-xs text-muted-foreground">{previewDataset.effectBasisLabel}</p>
  <label className="mt-3 flex max-w-sm flex-col gap-1 text-sm font-bold">
    Interpretar períodos como
    <select
      value={temporalMode}
      onChange={(event) => onTemporalModeChange(event.target.value as TemporalMode)}
      className="rounded-md border border-border bg-background px-2 py-1.5 font-normal"
    >
      <option value="auto">Automático</option>
      <option value="annual">Anual</option>
      <option value="semiannual">Semestral</option>
      <option value="quarterly">Trimestral</option>
      <option value="monthly">Mensal</option>
      <option value="dates">Datas</option>
      <option value="numeric">Valores numéricos</option>
      <option value="order">Ordem das linhas</option>
    </select>
  </label>
</section>
```

In `PraisWinstenTest`, keep `temporalMode` state. Its setter must clear
`confirmedDataset`, set `showSoftReset`, and return from Resultados to Configurar.
Pass the chosen mode to both preview and confirmed dataset builders.

- [ ] **Step 4: Render all structured temporal errors**

Change `PraisWinstenValidationAlert` to receive `issues: AnalysisIssue[]`. Show the
first blocking message as the main paragraph, other messages and row numbers in
`<details>`, and warnings separately without destructive styling. Do not collapse
`missing_period`, `duplicate_period`, `mixed_frequency`, and `invalid_token` back
into the generic old sentence. `PraisWinstenTest` computes issues once: any error
renders the blocking alert; warning-only issues render a non-destructive list
immediately above the result panel, so reordered or edge-excluded rows remain
visible after a successful analysis.

- [ ] **Step 5: Make metric and interpretation units explicit**

Add and reuse:

```ts
function effectUnit(dataset: PraisBuiltDataset): string {
  if (dataset.temporal.effectBasis === 'annualized') return 'por ano (anualizada)';
  if (dataset.temporal.effectBasis === 'numeric-unit') return 'por unidade temporal informada';
  return 'por intervalo observado';
}
```

Use the helper in β hints, APC/change labels and interpretation. Add a metric
`Base temporal` with frequency and effect basis. Preserve the existing numeric
values for annual examples.

- [ ] **Step 6: Add interpretation unit tests**

Assert that a semiannual calendar result contains `anualizada`, while an explicit
`order` result contains `por intervalo observado` and does not contain
`mudança anual`.

- [ ] **Step 7: Run Prais UI, engine, chart and interpretation tests**

Run: `npm exec vitest run -- src/features/tests/prais-winsten`

Expected: PASS.

- [ ] **Step 8: Commit the visible temporal flow**

```bash
git add src/features/tests/prais-winsten
git commit -m "feat: expose Prais temporal frequency"
```

---

### Task 4: Normalize imported matrices and retain import diagnostics

**Files:**
- Create: `src/shared/data-input/importDiagnostics.ts`
- Create: `src/shared/data-input/importDiagnostics.test.ts`
- Modify: `src/shared/data-input/types.ts`
- Modify: `src/shared/data-input/parseTabular.ts`
- Modify: `src/shared/data-input/parseTabular.test.ts`

**Interfaces:**
- Consumes: `TabularCandidate` and parser metadata.
- Produces:

```ts
export interface ImportDiagnostic {
  code: 'duplicate_headers' | 'short_rows' | 'extra_cells'
    | 'positional_mapping' | 'decimal_comma' | 'excel_dates_converted'
    | 'possible_excel_serial' | 'mixed_numeric_format' | 'missing_tokens';
  severity: 'info' | 'warning';
  message: string;
  rowNumbers?: number[];
}

export interface TabularImportSummary {
  sourceType: 'paste' | 'file';
  fileName: string;
  tableName: string;
  sheetNames: string[];
  formatLabel: string;
  delimiter: string;
  rowCount: number;
  columnCount: number;
  headerRowNumber: number;
  recognitionMode: 'aliases' | 'position' | 'unmapped';
  recognitionDetails: string[];
  diagnostics: ImportDiagnostic[];
  importWarnings: ImportWarning[];
}

export function normalizeImportedMatrix(
  headers: readonly string[],
  bodyRows: readonly (readonly string[])[],
): { headers: string[]; bodyRows: string[][]; diagnostics: ImportDiagnostic[] };
```

- [ ] **Step 1: Write failing ragged-table tests**

```ts
it('makes every imported cell visible with synthesized headers', () => {
  const result = normalizeImportedMatrix(
    ['A', 'B'],
    [['1', '2', 'extra'], ['3']],
  );
  expect(result.headers).toEqual(['A', 'B', 'Coluna 3']);
  expect(result.bodyRows).toEqual([['1', '2', 'extra'], ['3', '', '']]);
  expect(result.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'extra_cells', rowNumbers: [1] }),
    expect.objectContaining({ code: 'short_rows', rowNumbers: [2] }),
  ]));
});
```

Add a parser-level test that pastes `A;B\n1;2;extra\n3` and verifies the loaded
headers/body use the rectangular result instead of hiding `extra`.

Also load `desfecho;grupo\n1,25;A\n2.3;B\nNA;A` with the ANOVA options and assert
the summary contains `mixed_numeric_format` and `missing_tokens`, restricted to
the recognized numeric `desfecho` column.

- [ ] **Step 2: Run and verify failure**

Run: `npm exec vitest run -- src/shared/data-input/importDiagnostics.test.ts src/shared/data-input/parseTabular.test.ts -t "imported cell|extra"`

Expected: FAIL because normalization/diagnostics do not exist and the third cell
has no header.

- [ ] **Step 3: Implement matrix normalization**

Use the maximum of header/body widths, validate it before allocation, synthesize
only missing header positions, and pad without mutating inputs:

```ts
export function normalizeImportedMatrix(headers, bodyRows) {
  const width = Math.max(headers.length, ...bodyRows.map((row) => row.length));
  validateImportLimit('columns', width);
  validateTableSize(bodyRows.length, width);
  const widerRows = bodyRows
    .map((row, index) => ({ width: row.length, rowNumber: index + 1 }))
    .filter((item) => item.width > headers.length);
  const shorterRows = bodyRows
    .map((row, index) => ({ width: row.length, rowNumber: index + 1 }))
    .filter((item) => item.width < width);
  const diagnostics: ImportDiagnostic[] = [
    ...(widerRows.length ? [{
      code: 'extra_cells' as const,
      severity: 'warning' as const,
      message: `${widerRows.length} linha(s) tinham células além do cabeçalho; elas foram tornadas visíveis.`,
      rowNumbers: widerRows.slice(0, 100).map((item) => item.rowNumber),
    }] : []),
    ...(shorterRows.length ? [{
      code: 'short_rows' as const,
      severity: 'warning' as const,
      message: `${shorterRows.length} linha(s) tinham menos células e foram completadas como ausentes.`,
      rowNumbers: shorterRows.slice(0, 100).map((item) => item.rowNumber),
    }] : []),
  ];
  const normalizedHeaders = Array.from({ length: width }, (_, index) =>
    String(headers[index] ?? '').trim() || `Coluna ${index + 1}`);
  const normalizedRows = bodyRows.map((row) =>
    Array.from({ length: width }, (_, index) => String(row[index] ?? '')));
  return { headers: normalizedHeaders, bodyRows: normalizedRows, diagnostics };
}
```

- [ ] **Step 4: Build a summary in `buildLoadedTabularState`**

Normalize the candidate before returning it. Combine structural diagnostics with
duplicate-header, positional-recognition and decimal-comma diagnostics. Add
`summary: TabularImportSummary` to `TabularLoadedState`, while retaining existing
flat properties during this migration.

For indexes bound to `numericKeys` or `temporalKeys`, scan non-empty raw cells:
emit `mixed_numeric_format` when valid values mix decimal comma and decimal point;
emit `missing_tokens` for case-insensitive `NA`, `N/A`, `NULL`, `-` or `—`. Do not
apply this scan to categorical columns, where those strings may be real labels.

Duplicate headers must identify both labels/column numbers; automatic mappings
keep the first match but the warning explains that choice and the editor still
shows both stable columns.

- [ ] **Step 5: Run parser and limit regressions**

Run:

```bash
npm exec vitest run -- \
  src/shared/data-input/importDiagnostics.test.ts \
  src/shared/data-input/parseTabular.test.ts \
  src/shared/data-input/importLimits.test.ts
```

Expected: PASS. Existing quoted-cell, decimal-comma, row/column/cell limit and
legacy fixture tests remain green.

- [ ] **Step 6: Commit rectangular import and diagnostics**

```bash
git add src/shared/data-input/importDiagnostics.ts \
  src/shared/data-input/importDiagnostics.test.ts \
  src/shared/data-input/types.ts src/shared/data-input/parseTabular.ts \
  src/shared/data-input/parseTabular.test.ts
git commit -m "fix: surface all imported table cells"
```

---

### Task 5: Persist and display the import summary

**Files:**
- Create: `src/routes/estatistica/ImportSummary.tsx`
- Create: `src/routes/estatistica/ImportSummary.test.tsx`
- Modify: `src/shared/data-input/useTabularInput.ts`
- Modify: `src/shared/data-input/useTabularInput.test.ts`
- Modify: `src/shared/data-input/tableDocument.ts`
- Modify: `src/shared/data-input/tableDocument.test.ts`
- Modify: `src/shared/data-input/useAnalysisTable.ts`
- Modify: `src/shared/data-input/useAnalysisTable.test.tsx`
- Modify: `src/shared/session/sessionStorage.ts`
- Modify: `src/shared/session/sessionStorage.test.ts`
- Modify: `src/routes/estatistica/ColumnPreviewTable.tsx`
- Modify: `src/routes/estatistica/ColumnPreviewTable.test.tsx`
- Modify: `src/routes/estatistica/TabularInputPanel.tsx`
- Modify: `src/routes/estatistica/TabularInputPanel.test.tsx`

**Interfaces:**
- Consumes: `TabularImportSummary` from Task 4.
- Produces: `TabularInputState.importSummary`, `TableDocument.importSummary?`, and
  a shared visual summary.

- [ ] **Step 1: Write propagation and reset tests**

In `useTabularInput.test.ts`, extend `makeLoadedState` with a real summary and
assert:

```ts
expect(result.current.importSummary).toMatchObject({
  fileName: 'dados.csv',
  tableName: 'Tabela',
  rowCount: 1,
  columnCount: 2,
});
act(() => result.current.setRawText(''));
expect(result.current.importSummary).toBeNull();
```

In `useAnalysisTable.test.tsx`, upload/paste a ragged table and assert
`result.current.table?.importSummary?.diagnostics` contains `extra_cells`.

- [ ] **Step 2: Run and verify the missing-state failure**

Run: `npm exec vitest run -- src/shared/data-input/useTabularInput.test.ts src/shared/data-input/useAnalysisTable.test.tsx -t "summary|ragged"`

Expected: FAIL because the hook/document does not carry `importSummary`.

- [ ] **Step 3: Propagate summary into `TableDocument`**

Add:

```ts
export interface TableDocument {
  id: string;
  revision: number;
  columns: TableColumn[];
  rows: string[][];
  bindings: Record<string, TableRoleBindings>;
  sourceLabel: string;
  importSummary?: TabularImportSummary;
}

export function createTableDocument(
  headers: readonly string[],
  rows: readonly string[][],
  sourceLabel: string,
  idFactory: TableDocumentIdFactory = defaultDocumentId,
  importSummary?: TabularImportSummary,
): TableDocument;
```

`useTabularInput` sets the summary only for the winning request and resets it on
idle/error/new parsing. `useAnalysisTable.replaceTable` accepts an optional
summary after `sourceLabel` and passes it as the fifth argument to
`createTableDocument`. Edits preserve the summary because `revise` spreads the
existing document.

- [ ] **Step 4: Validate and round-trip the optional persisted field**

Allow `importSummary` in `isStrictTableDocument` without rejecting older version-1
snapshots that lack it. Validate exact keys, bounded strings/arrays, allowed
severity/code unions, finite counts, row numbers between 1 and 10.000, and
`importWarnings` coordinates within import limits. Add a storage round-trip test
whose summary includes one structural and one XLSX warning.

- [ ] **Step 5: Write the accessible summary component test**

```tsx
const summaryWithWarnings: TabularImportSummary = {
  sourceType: 'file',
  fileName: 'dados.xlsx',
  tableName: 'Dados',
  sheetNames: ['Dados', 'Notas'],
  formatLabel: 'XLSX',
  delimiter: '',
  rowCount: 12,
  columnCount: 3,
  headerRowNumber: 1,
  recognitionMode: 'aliases',
  recognitionDetails: [],
  diagnostics: [{
    code: 'duplicate_headers',
    severity: 'warning',
    message: 'Foram encontrados cabeçalhos duplicados.',
  }],
  importWarnings: [],
};

render(<ImportSummary summary={summaryWithWarnings} />);
expect(screen.getByRole('region', { name: 'Resumo da importação' }))
  .toHaveTextContent('dados.xlsx');
expect(screen.getByText(/Aba Dados/i)).toBeInTheDocument();
expect(screen.getByText(/12 linhas.*3 colunas/i)).toBeInTheDocument();
await user.click(screen.getByText('Ver avisos da importação'));
expect(screen.getByText(/cabeçalhos duplicados/i)).toBeInTheDocument();
```

- [ ] **Step 6: Implement compact UI and consolidate warnings**

`ImportSummary` renders source, sheet, dimensions, format/separator and mapping
mode in one compact line. Only render the disclosure when diagnostics or XLSX
warnings exist; use text/icon in addition to color. `ColumnPreviewTable` reads
`document.importSummary` and falls back to its legacy `importWarnings` prop, so no
ten-module prop migration is required. Avoid showing each converted Excel date as
one list item; use its aggregate diagnostic.

Update upload copy to `CSV, TSV, TXT ou XLSX`. Keep the current `accept` value and
drag/drop behavior.

- [ ] **Step 7: Run state, storage and UI tests**

Run:

```bash
npm exec vitest run -- \
  src/shared/data-input/useTabularInput.test.ts \
  src/shared/data-input/useAnalysisTable.test.tsx \
  src/shared/data-input/tableDocument.test.ts \
  src/shared/session/sessionStorage.test.ts \
  src/routes/estatistica/ImportSummary.test.tsx \
  src/routes/estatistica/ColumnPreviewTable.test.tsx \
  src/routes/estatistica/TabularInputPanel.test.tsx
```

Expected: PASS, including stale-file/paste races and IndexedDB strict validation.

- [ ] **Step 8: Commit summary persistence and presentation**

```bash
git add src/shared/data-input/useTabularInput.ts src/shared/data-input/useTabularInput.test.ts \
  src/shared/data-input/tableDocument.ts src/shared/data-input/tableDocument.test.ts \
  src/shared/data-input/useAnalysisTable.ts src/shared/data-input/useAnalysisTable.test.tsx \
  src/shared/session/sessionStorage.ts src/shared/session/sessionStorage.test.ts \
  src/routes/estatistica/ImportSummary.tsx src/routes/estatistica/ImportSummary.test.tsx \
  src/routes/estatistica/ColumnPreviewTable.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx \
  src/routes/estatistica/TabularInputPanel.tsx src/routes/estatistica/TabularInputPanel.test.tsx
git commit -m "feat: show import provenance and warnings"
```

---

### Task 6: Decode styled XLSX dates and reject unsupported files

**Files:**
- Modify: `src/shared/data-input/xlsxReader.ts`
- Modify: `src/shared/data-input/xlsxReader.test.ts`
- Modify: `src/shared/data-input/parseTabular.ts`
- Modify: `src/shared/data-input/parseTabular.test.ts`
- Modify: `src/shared/data-input/types.ts`

**Interfaces:**
- Consumes: `ImportDiagnostic`, `WorkbookTable` summary path from Task 4.
- Produces a conservative internal date context:

```ts
interface XlsxDateContext {
  date1904: boolean;
  dateStyleIndexes: ReadonlySet<number>;
}

// Extend the existing table contract without removing its current fields.
export interface WorkbookTable {
  name: string;
  rows: string[][];
  delimiter?: string;
  formatLabel?: string;
  importWarnings?: ImportWarning[];
  importDiagnostics?: ImportDiagnostic[];
}
```

- [ ] **Step 1: Add stored-XLSX date fixtures**

Extend the local ZIP helper in `xlsxReader.test.ts` with a styles relationship and
these XML parts:

```ts
const styles = '<styleSheet><cellXfs count="2">'
  + '<xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/>'
  + '</cellXfs></styleSheet>';

const datedSheet = '<worksheet><sheetData>'
  + '<row r="1"><c r="A1" t="inlineStr"><is><t>Data</t></is></c></row>'
  + '<row r="2"><c r="A2" s="1"><v>45292</v></c></row>'
  + '</sheetData></worksheet>';
```

Assert system 1900 converts `45292` to `2024-01-01`. Add `workbookPr
date1904="1"` with serial `1` and expect `1904-01-02`. Add serial 60 under system
1900 and expect a warning rather than fabricated `1900-02-29`.

- [ ] **Step 2: Run and verify raw-serial failure**

Run: `npm exec vitest run -- src/shared/data-input/xlsxReader.test.ts -t "styled date|1904|serial 60"`

Expected: FAIL because styled numeric cells remain raw numbers.

- [ ] **Step 3: Parse date systems and date styles conservatively**

Read `workbookPr@date1904`. Resolve the workbook relationship whose type ends in
`/styles`; only read that part if present. Treat built-in number formats 14–22 and
45–47 as date/time. For custom `numFmt`, remove quoted literals, escaped
characters and color/condition brackets, then require a calendar token containing
year or day; do not classify plain numeric, scientific, percentage or duration-only
`[h]:mm` formats as dates.

Map each `cellXfs/xf` position to its `numFmtId`, producing
`dateStyleIndexes: Set<number>`.

- [ ] **Step 4: Convert safe integer serials without local timezone**

```ts
function excelSerialToIso(serial: number, date1904: boolean): string | null {
  if (!Number.isInteger(serial) || serial < 0) return null;
  if (!date1904 && serial === 60) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const adjusted = date1904 ? serial : serial - (serial > 60 ? 1 : 0);
  const date = new Date(epoch + adjusted * 86_400_000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}
```

In `readWorksheet`, only convert a numeric cell when its style index is in the
date set. Aggregate conversions into one `excel_dates_converted` info diagnostic.
For a styled value that cannot convert, leave it empty only when it is impossible
as a calendar date and emit `unusable-cell`; otherwise preserve raw numeric data.
Do not change formula cache rules.

- [ ] **Step 5: Add unsupported-extension and serial-ambiguity tests**

```ts
it('rejects legacy xls before reading binary contents', async () => {
  const legacy = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], 'dados.xls');
  const read = vi.spyOn(legacy, 'arrayBuffer');
  await expect(readWorkbookTablesFromFile(legacy, legacyUtils))
    .rejects.toThrow(/\.xls.*\.xlsx|CSV/i);
  expect(read).not.toHaveBeenCalled();
});
```

Add a parser test where an unstyled numeric column named `Data` contains 45292,
45293. It remains numeric and receives `possible_excel_serial`; no automatic ISO
conversion occurs.

- [ ] **Step 6: Implement extension gate and possible-serial diagnostic**

Before file IO, allow only `csv`, `txt`, `tsv`, `xlsx`; error text:
`Formato .xls não suportado. Salve o arquivo como .xlsx ou CSV e tente novamente.`
For other extensions, use the same structure with the actual suffix.

Detect possible serials only when the bound/suggested column is temporal, values
are integers in 20.000–80.000, and no XLSX date conversion metadata exists. The
warning instructs the user to confirm **Datas** or correct the Excel formatting.

- [ ] **Step 7: Run XLSX, parser and security regressions**

Run:

```bash
npm exec vitest run -- \
  src/shared/data-input/xlsxReader.test.ts \
  src/shared/data-input/parseTabular.test.ts \
  src/shared/data-input/importLimits.test.ts
```

Expected: PASS, including CRC, ZIP expansion, DTD/entity, external relationship,
formula-cache and cumulative workbook limits.

- [ ] **Step 8: Commit XLSX date support**

```bash
git add src/shared/data-input/xlsxReader.ts src/shared/data-input/xlsxReader.test.ts \
  src/shared/data-input/parseTabular.ts src/shared/data-input/parseTabular.test.ts \
  src/shared/data-input/types.ts
git commit -m "feat: read styled dates from xlsx"
```

---

### Task 7: Audit and lock the ten-test import contract

**Files:**
- Create: `src/shared/data-input/tabularContractMatrix.test.ts`
- Modify only after a failing matrix case is reproduced in the nearest focused
  test: `src/features/tests/*/*Config.ts`, `src/shared/data-input/parseTabular.ts`,
  `src/shared/data-input/analysisTable.ts`, or the corresponding `*Engine.ts`.

**Interfaces:**
- Consumes: every exported `TABULAR_OPTIONS`, `readTabularPasteState`,
  `createTableDocument`, `deriveRecognizedColumnsFromDocument`, and
  `tableValiditySummary`.
- Produces: a permanent characterization matrix; it does not create a runtime API.

- [ ] **Step 1: Add the delimiter/role matrix**

Define cases for t de Student, Mann–Whitney long and wide, correlação,
Prais–Winsten, Qui-quadrado, ANOVA/Tukey, Kruskal/Dunn, Poisson, binomial
negativa and logística. Each case contains canonical headers, two or more valid
rows, expected required keys and its options. Then run each through `;`, tab and
comma delimiters:

```ts
import { TABULAR_OPTIONS as tOptions } from '@/features/tests/t-student/tStudentConfig';
import {
  LONG_TABULAR_OPTIONS as mannLongOptions,
  WIDE_TABULAR_OPTIONS as mannWideOptions,
} from '@/features/tests/mann-whitney/mannWhitneyConfig';
import { TABULAR_OPTIONS as correlationOptions } from '@/features/tests/correlacao/correlacaoConfig';
import { TABULAR_OPTIONS as praisOptions } from '@/features/tests/prais-winsten/praisConfig';
import { TABULAR_OPTIONS as chiOptions } from '@/features/tests/qui-quadrado/quiQuadradoConfig';
import { TABULAR_OPTIONS as anovaOptions } from '@/features/tests/anova-tukey/anovaConfig';
import { TABULAR_OPTIONS as kruskalOptions } from '@/features/tests/kruskal-dunn/kruskalConfig';
import { TABULAR_OPTIONS as poissonOptions } from '@/features/tests/poisson/poissonConfig';
import { TABULAR_OPTIONS as negativeBinomialOptions } from '@/features/tests/binomial-negativa/binomialNegativaConfig';
import { TABULAR_OPTIONS as logisticOptions } from '@/features/tests/logistica/logisticaConfig';

const contractCases = [
  {
    id: 't-student', options: tOptions,
    headers: ['unidade', 'grupo_a', 'grupo_b'],
    rows: [['BA', '1.1', '2.1'], ['SE', '1.2', '2.2'], ['AL', '1.3', '2.3']],
    requiredKeys: ['grupo_a', 'grupo_b'],
  },
  {
    id: 'mann-long', options: mannLongOptions,
    headers: ['desfecho', 'grupo'],
    rows: [['1.1', 'A'], ['1.2', 'A'], ['2.1', 'B'], ['2.2', 'B']],
    requiredKeys: ['desfecho', 'grupo'],
  },
  {
    id: 'mann-wide', options: mannWideOptions,
    headers: ['grupo_a', 'grupo_b'],
    rows: [['1.1', '2.1'], ['1.2', '2.2'], ['1.3', '2.3']],
    requiredKeys: ['grupo_a', 'grupo_b'],
  },
  {
    id: 'correlacao', options: correlationOptions,
    headers: ['id', 'variavel_x', 'variavel_y'],
    rows: [['A', '1.1', '2.1'], ['B', '1.2', '2.2'], ['C', '1.3', '2.3']],
    requiredKeys: ['variavel_x', 'variavel_y'],
  },
  {
    id: 'prais-winsten', options: praisOptions,
    headers: ['Semestre', 'N de inscritos'],
    rows: [['2021.1', '90'], ['2021.2', '92'], ['2022.1', '93']],
    requiredKeys: ['tempo', 'variavel_y'],
  },
  {
    id: 'qui-quadrado', options: chiOptions,
    headers: ['categoria_a', 'categoria_b'],
    rows: [['A', 'Sim'], ['A', 'Não'], ['B', 'Sim'], ['B', 'Não']],
    requiredKeys: ['categoria_a', 'categoria_b'],
  },
  {
    id: 'anova-tukey', options: anovaOptions,
    headers: ['desfecho', 'grupo'],
    rows: [['1.1', 'A'], ['1.2', 'A'], ['2.1', 'B'], ['2.2', 'B']],
    requiredKeys: ['desfecho', 'grupo'],
  },
  {
    id: 'kruskal-dunn', options: kruskalOptions,
    headers: ['desfecho', 'grupo'],
    rows: [['1.1', 'A'], ['1.2', 'A'], ['2.1', 'B'], ['2.2', 'B']],
    requiredKeys: ['desfecho', 'grupo'],
  },
  {
    id: 'poisson', options: poissonOptions,
    headers: ['contagem', 'preditor'],
    rows: [['1', '1.1'], ['2', '1.2'], ['3', '1.3']],
    requiredKeys: ['contagem', 'preditor'],
  },
  {
    id: 'binomial-negativa', options: negativeBinomialOptions,
    headers: ['contagem', 'preditor'],
    rows: [['3', '1.1'], ['8', '1.2'], ['15', '1.3']],
    requiredKeys: ['contagem', 'preditor'],
  },
  {
    id: 'logistica', options: logisticOptions,
    headers: ['desfecho_binario', 'preditor'],
    rows: [['0', '1.1'], ['1', '1.2'], ['0', '1.3'], ['1', '1.4']],
    requiredKeys: ['desfecho_binario', 'preditor'],
  },
] satisfies Array<{
  id: string;
  options: TabularInputOptions;
  headers: string[];
  rows: string[][];
  requiredKeys: string[];
}>;

it.each(contractCases)('$id recognizes required roles across common delimiters', ({
  options, headers, rows, requiredKeys,
}) => {
  for (const delimiter of [';', '\t', ',']) {
    const text = [headers, ...rows].map((row) => row.join(delimiter)).join('\n');
    const loaded = readTabularPasteState(text, legacyStats, options);
    expect(loaded.status, `${delimiter} should load`).toBe('loaded');
    if (loaded.status !== 'loaded') continue;
    expect(requiredKeys.every((key) => loaded.recognizedColumns[key])).toBe(true);
  }
});

it('preserves decimal commas with semicolon and tab separators', () => {
  for (const delimiter of [';', '\t']) {
    const loaded = readTabularPasteState(
      ['desfecho', '1,25', '2,50'].map((value, index) =>
        index === 0 ? `desfecho${delimiter}grupo` : `${value}${delimiter}${index === 1 ? 'A' : 'B'}`)
        .join('\n'),
      legacyStats,
      anovaOptions,
    );
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') expect(loaded.decimalCommaDetected).toBe(true);
  }
});
```

Use decimal points in the comma-delimited fixtures and include a separate
semicolon/tab case with decimal commas. Include `Semestre / N de inscritos` as
the Prais case and both Mann–Whitney shapes.

- [ ] **Step 2: Add malformed-row preflight characterizations**

For each case, create a document from the loaded table, derive roles, replace one
required value with `''`, and assert `tableValiditySummary` lists that row as
incomplete. Replace a numeric required value with `não-numérico` and assert it is
invalid. For Prais, use `2024-X9` and assert invalid temporal data. For independent
wide groups, assert a valid value in the other group remains present in the
engine-specific sample preparation; the warning must not claim both values were
discarded.

- [ ] **Step 3: Run the matrix as an audit**

Run: `npm exec vitest run -- src/shared/data-input/tabularContractMatrix.test.ts`

Expected: standard characterization cases should pass. The new semester,
temporal-invalid, diagnostics and rectangularity expectations must pass because
Tasks 1–6 implemented them. If any standard case fails, reproduce it in the
nearest focused parser/config test before changing runtime code; never loosen a
domain validator merely to make the matrix green.

- [ ] **Step 4: Run every statistical engine and component suite**

Run: `npm exec vitest run -- src/features/tests src/shared/data-input src/routes/estatistica`

Expected: PASS. Inspect output for unhandled rejections, React act warnings,
non-finite values, timeouts and skipped tests; the single existing intentional
pipeline skip is outside this Vitest command.

- [ ] **Step 5: Commit the cross-module audit**

```bash
git add src/shared/data-input/tabularContractMatrix.test.ts
git commit -m "test: audit tabular input across statistical tests"
```

If a characterized failure required runtime changes, stage only its focused test
and smallest source fix in the same commit. Do not stage unrelated user work.

---

### Task 8: Full gate and local browser acceptance

**Files:**
- Modify only for failures demonstrated by this task: the smallest affected
  source and focused test file.

**Interfaces:**
- Consumes the complete feature.
- Produces a clean local branch whose current working tree is what `npm run dev`
  serves.

- [ ] **Step 1: Run static and focused verification**

Run:

```bash
npm run typecheck
npm exec vitest run -- \
  src/shared/data-input/temporalPeriods.test.ts \
  src/shared/data-input/importDiagnostics.test.ts \
  src/shared/data-input/tabularContractMatrix.test.ts \
  src/features/tests/prais-winsten \
  src/shared/data-input/xlsxReader.test.ts
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run the repository gate**

Run: `npm run gate`

Expected: catalog validation, Python pipeline tests, all Vitest files, TypeScript
build and Vite build pass. The known pipeline fixture may print its intentional
corrupt-DBC diagnostic; it is acceptable only when pytest exits zero. Record any
build bundle warning accurately rather than calling it a failure.

- [ ] **Step 3: Start the actual local application**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite serves the workspace root. Do not use a stale preview or the
GitHub Pages URL.

- [ ] **Step 4: Verify the user semester flow in a real browser**

Using the browser-control skill, open the local Estatística page, select
Prais–Winsten in the sidebar, paste exactly:

```text
Semestre	N de inscritos
2021.1	90
2021.2	92
2022.1	93
2022.2	95
2023.1	95
2023.2	97
2024.1	98
2024.2	100
2025.1	102
2025.2	105
2026.1	108
2026.2	114
```

Verify at 1440×1000 and 390×844:

- data status and compact import summary appear;
- `Semestre` is bound to tempo and the table remains fully editable;
- `Periodicidade detectada: Semestral` and `efeito anualizado` appear;
- `Analisar dados` reaches metrics, interpretation, trend and residual charts;
- no irregular-interval alert appears;
- metric shows 12 points and period 2021.1–2026.2;
- no horizontal overflow or clipped selector/details appears.

- [ ] **Step 5: Verify correction and error paths**

In the same local browser:

1. Remove `2023.2`; assert the message names that missing period and blocks.
2. Duplicate `2024.1`; assert the message identifies duplicate rows.
3. Restore data, choose **Ordem das linhas**; assert the effect says `por intervalo
   observado`, not annual.
4. Paste a row with a third extra cell; assert `Coluna 3` is visible and warned.
5. Upload `src/test/fixtures/tests/prais-exemplo.txt`; assert the summary identifies
   the filename and the annual example still reaches results. The `.xls` rejection
   is covered by the no-file-IO automated regression in Task 6.

- [ ] **Step 6: Inspect browser/runtime failures**

Confirm there are no uncaught console errors, unhandled promise rejections,
failed local assets, hydration warnings or raw data dumps. Chart.js tooltips,
editing, copying results and the sticky sidebar must remain usable.

- [ ] **Step 7: Commit only demonstrated final fixes**

If Steps 1–6 required a fix, write its focused failing regression first, rerun the
focused command, then:

```bash
git diff --name-only
git add -u
git diff --cached --check
git commit -m "fix: close import acceptance regression"
```

If no fix was needed, do not create an empty commit.

- [ ] **Step 8: Confirm final repository state**

Run:

```bash
git status --short --branch
git log -8 --oneline
```

Expected: branch `codex/results-interactions`, no unintended files, no push or
deployment, and the latest local commits correspond to the tasks above.
