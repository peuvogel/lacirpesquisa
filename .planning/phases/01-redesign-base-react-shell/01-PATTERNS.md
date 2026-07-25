# Phase 1: Redesign / base React shell - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 30 (new React shell files, mapped against the existing vanilla-JS MVP)
**Analogs found:** 30 / 30 (all files have at least a role-match analog; the codebase is 100% vanilla JS/HTML/CSS today — there is no existing React code — so "analog" here means "vanilla-JS source to port logic from," not "existing React component to copy structurally")

**Important framing note:** This is a **re-platform phase**, not a greenfield feature. Every new file in `src/` either (a) ports pure logic unchanged from an existing `assets/js/*.js` module, or (b) is a brand-new React wrapper with no vanilla-JS equivalent (routing, hooks, shadcn UI). The tables below reflect that split explicitly via the "Port Type" column.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality | Port Type |
|---|---|---|---|---|---|
| `src/main.tsx` | provider/bootstrap | request-response | `index.html` (bottom `<script type="module">` + `bootstrap()` in `assets/js/app.js:831-854`) | role-match | new wrapper |
| `src/app/router.tsx` | route | request-response | none (no router exists today; `app.js` `loadTest()`/manifest is the closest "route switch" concept) | no-analog | new |
| `src/app/AppShell.tsx` | component (shell) | request-response | `index.html:26-88` (`<header>` + `.page-shell` wrapper) | exact (structural) | port markup/CSS intent, new JSX |
| `src/app/Header.tsx` | component | request-response | `index.html:29-52` (`.lacir-header`) + `styles.css:44-159` | exact | port visual pattern, new JSX (drop badge/version per D-02) |
| `src/app/theme.css` | config | — | `assets/css/styles.css:1-30` (`:root` design tokens) | exact | port token *names/intent*, new values (teal not green) |
| `src/routes/estatistica/EstatisticaPage.tsx` | component (page) | request-response | `index.html:55-88` (`.page-shell` sidebar+main) + `app.js` bootstrap/loadTest orchestration | exact (structural) | new wrapper around ported hooks |
| `src/routes/estatistica/Sidebar.tsx` | component | CRUD (list render) | `index.html:56-70` (`<aside class="sidebar">`) + `app.js:731-745` (`renderNav`) | exact | port render logic → JSX, port CSS classes |
| `src/routes/estatistica/QualTesteModal.tsx` | component (modal) | event-driven | none direct; closest UX ancestor is `renderNav`'s list-of-tests pattern + `tests-manifest.json` shape | role-match | new (shadcn `Dialog`) |
| `src/routes/estatistica/demo/TesteDemo.tsx` | component (feature) | request-response | `tests/t-student/module.js` (`renderTestModule` export, full test module shape) | role-match | new JSX, reuses `Stats`-lite formatting |
| `src/routes/estatistica/demo/demoData.ts` | config/fixture | — | `tests/t-student/templates/modelo-t-student-exemplo.csv` (sample dataset convention) | role-match | new fixture |
| `src/routes/meta-analise/MetaAnalisePage.tsx` | component (placeholder) | request-response | `index.html` `.empty-state` block (`index.html:82-85`) | role-match | new (reuses `EmptyState`) |
| `src/routes/variaveis/VariaveisPage.tsx` | component (placeholder) | request-response | same as above | role-match | new (reuses `EmptyState`) |
| `src/routes/mapas/MapasPage.tsx` | component (page) | event-driven | none (no map UI exists in MVP) | no-analog | new |
| `src/routes/mapas/BrazilMockMap.tsx` | component | event-driven | none (closest interaction-pattern analog is `datasus-wizard.js`'s `data-source-id` click delegation, `datasus-wizard.js:434-440`) | no-analog (interaction-pattern analog only) | new |
| `src/routes/mapas/VariablePanel.tsx` | component | transform | none (closest analog is `mappingTableHtml` render-a-derived-list-from-state pattern, `datasus-wizard.js:136-181`) | no-analog (pattern analog only) | new |
| `src/routes/mapas/computeVariableIntersection.ts` | utility | transform | none (pure new logic, spec'd fully in RESEARCH.md Code Examples) | no-analog | new |
| `src/routes/mapas/mockVariablesByUF.ts` | config/fixture | — | none | no-analog | new fixture |
| `src/routes/mapas/IniciarPesquisaModal.tsx` | component (modal) | event-driven | `datasus-wizard.js`'s paste-into-step pattern (`datasus-wizard.js:406-432`, the paste-zone step) | role-match (interaction shape only) | new (shadcn `Dialog`) |
| `src/features/tests/registry.ts` | config | — | `tests-manifest.json` (registry shape: id/title/subtitle/path) | exact (shape), evolved | port shape, add `status` field, drop `path`/dynamic-import fields |
| `src/shared/data-input/parseTabular.ts` | utility | transform | `assets/js/tabular-data-input.js` (**entire file**, all exports) | exact | **port verbatim + types**, no logic changes |
| `src/shared/data-input/datasusImporter.ts` | utility | transform | `assets/js/datasus-importer.js` (**entire file**) | exact | **port verbatim + types** |
| `src/shared/data-input/datasusNormalizer.ts` | utility | transform | `assets/js/datasus-normalizer.js` (**entire file**) | exact | **port verbatim + types** |
| `src/shared/data-input/useTabularInput.ts` | hook | transform | `readTabularPasteState`/`readTabularFileState` call sites in `tests/t-student/module.js` and equivalent usage pattern implied by `tabular-data-input.js:685-777` | exact (new hook wrapping ported functions) | new hook, ported core |
| `src/shared/data-input/useDatasusWizard.ts` | hook | event-driven (state machine) | `assets/js/datasus-wizard.js` `createDatasusWizard()` — **state slice only** (`state` object, `reparseSource`, `setSourceNormalized`, `buildSession`, `addFiles`, `addTextSources`) | exact (state machine), NOT the `render()`/innerHTML half | port state logic, new JSX render |
| `src/shared/charts/chartTheme.ts` | config | — | `assets/js/chart-manager.js:36-89` (`COLORS`, `BASE_OPTS`) | exact | port verbatim, retint to teal/dark tokens |
| `src/shared/charts/ChartCanvas.tsx` | component | streaming (canvas lifecycle) | `assets/js/chart-manager.js:94-105` (`registry` Map + `destroyChart`/`register`) + any one `renderXChart` factory (e.g. `renderTStudentDiffChart`, lines 525-589) | exact (lifecycle pattern) | new `useEffect`-based wrapper, ported factory body |
| `src/shared/charts/useChartExport.ts` | hook | file-I/O | `assets/js/chart-manager.js:138-147` (`exportCanvas`) | exact | port verbatim into a hook |
| `src/shared/session/SessionProvider.tsx` | provider | event-driven | `assets/js/app.js:6-10` (`window.__LACIR_SHARED__` init) + `datasus-wizard.js:220-230` (`syncSharedStore`) | exact (shape/intent) | new (React Context replaces global) |
| `src/shared/hooks/useLeaveWarning.ts` | hook | event-driven | none in MVP (no `beforeunload` exists today) — fully spec'd in RESEARCH.md Pattern 5 | no-analog | new |
| `src/shared/flow/FlowSteps.tsx` | component | request-response | none direct; closest conceptual analog is the DataSUS wizard's "Passo N de 6" step chips (`datasus-wizard.js:276-404`, `<span class="small-chip info">Passo N</span>` markers) | role-match (stepper concept only) | new |
| `src/shared/format.ts` | utility | transform | `assets/js/app.js:85-107` (`fmtNumber`, `fmtP`, `fmtSigned`) | exact | port verbatim + types |
| `src/lib/utils.ts` (`cn()`) | utility | transform | `assets/js/app.js:25-42` (`utils.escapeHtml`/`clearElement`/`showError` — same "small shared helper object" role, different concern) | role-match | new (shadcn standard `clsx`+`tailwind-merge`) |

## Pattern Assignments

### `src/shared/data-input/parseTabular.ts` (utility, transform)

**Analog:** `assets/js/tabular-data-input.js` (777 lines, port in full — this is the single highest-value port in the phase)

**Exports to port unchanged, with types added** (full file, key excerpts below):

**Delimiter/decimal-comma tolerance core** (lines 26-123):
```javascript
function structuralCommaCount(line) {
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== ',') continue;
    if (/\d/.test(line[index - 1] || '') && /\d/.test(line[index + 1] || '')) continue;
    count += 1;
  }
  return count;
}

export function splitDelimitedLine(line, delimiter) { /* quote-aware, digit-adjacent-comma-aware split */ }
export function detectDelimiter(lines) { /* scores ';' vs '\t' vs structural ',' across first 10 lines */ }
export function normalizeNumericSource(raw) { /* pt-BR decimal-comma vs thousands-separator disambiguation */ }
```
*Why this exact excerpt:* `structuralCommaCount`/`normalizeNumericSource` are the two functions RESEARCH.md Pitfall 3 explicitly warns against "improving" — the digit-adjacency check is the load-bearing logic for D-09's "maximum tolerance."

**Entry points the hook calls** (lines 685-777):
```javascript
export async function readTabularFileState(file, utils, stats, options = {}) { /* ... */ }
export function readTabularPasteState(text, stats, options = {}) { /* ... */ }
```
Both return the same discriminated shape: `{ status: 'loaded'|'error', headers, bodyRows, recognizedColumns, errors/details, ... }` — this shape is exactly what `useTabularInput`'s state should be typed as.

**XLSX zero-dependency reader** (lines 370-527): `unzipDeflateRaw`, `findEndOfCentralDirectory`, `unzipXlsxEntries`, `readWorkbookSheets` — port verbatim, do not replace with an `xlsx` npm package (RESEARCH.md Don't Hand-Roll table).

---

### `src/shared/data-input/datasusImporter.ts` / `datasusNormalizer.ts` (utility, transform)

**Analog:** `assets/js/datasus-importer.js` (534 lines) + `assets/js/datasus-normalizer.js` (864 lines) — both referenced by `import` at the top of `datasus-wizard.js:1-2`:
```javascript
import { parseDatasusText } from './datasus-importer.js';
import { normalizeDatasusSource, suggestTestsForSources } from './datasus-normalizer.js';
```
Port both files verbatim + types, preserving this same two-module split (importer = header-detection/parsing, normalizer = column-role → canonical-row transform + test suggestions). Not read in full line-by-line here since neither file's internals are directly quoted in any new-file's plan action beyond "port unchanged" — the planner should treat both as black-box ports per RESEARCH.md Pitfall 3's "treat as a black box with known-good behavior" guidance, verified by feeding them the same real captured TABNET fixtures Wave 0 will add.

---

### `src/shared/data-input/useDatasusWizard.ts` (hook, event-driven state machine)

**Analog:** `assets/js/datasus-wizard.js` `createDatasusWizard()` — **extract the state half, discard the render half**

**State shape + mutation functions to port as the hook's internals** (lines 198-230, 523-646):
```javascript
const state = {
  nextId: 1,
  sources: [],
  activeSourceId: '',
  statusTone: 'status',
  statusMessage: 'Importe um ou mais arquivos DATASUS para iniciar o assistente.'
};

function activeSource() {
  return state.sources.find(source => source.id === state.activeSourceId) || state.sources[0] || null;
}

function reparseSource(source, utils, stats, headerRowIndex = null) {
  source.parsed = parseDatasusText({ text: source.rawText, fileName: source.fileName, utils, stats, headerRowIndex });
  source.mapping = clonePlain(source.parsed.initialMapping);
  source.confirmed = false;
  setSourceNormalized(source, utils, stats);
}
```
```javascript
// Public state-transition actions to re-expose as hook return values
async function addFiles(files) { /* lines 523-585 */ }
async function addTextSources(textSources, successMessage) { /* lines 587-626 */ }
function buildSession(state) { /* lines 52-67 — the one function every consumer reads */ }
```

**Session sync pattern (React Context replacement for `window.__LACIR_SHARED__`)** (lines 220-234):
```javascript
function syncSharedStore() {
  if (!shared) return;
  if (!shared.datasus) shared.datasus = {};
  const session = buildSession(state);
  if (session.confirmedSources.length) {
    shared.datasus.lastSession = clonePlain(session);
  } else if (!state.sources.length) {
    shared.datasus.lastSession = null;
  }
}
function notify() {
  syncSharedStore();
  onSessionChange(buildSession(state));
}
```
**Do NOT port:** `render()` (lines 237-521) — this builds one giant `innerHTML` string with `data-action` delegated listeners (`root.querySelectorAll('[data-action="column-role"]')`, lines 476-497, etc.). This is exactly RESEARCH.md Pitfall 1's warning. Every `Passo N` section (lines 272-405) should become new JSX per step, using the same copy/labels (`"Passo 1"`.."Passo 6"`, "Confirmar a linha de cabeçalho", "Mapear os papéis das colunas", etc.) but React `onChange`/`onClick` handlers instead of `data-action` + `querySelectorAll` + manual `addEventListener`.

---

### `src/shared/charts/ChartCanvas.tsx` + `chartTheme.ts` (component + config, streaming/canvas lifecycle)

**Analog:** `assets/js/chart-manager.js`

**Instance lifecycle to replace with `useEffect`** (lines 91-105):
```javascript
const registry = new Map();
function destroyChart(id) {
  const existing = registry.get(id);
  if (existing) {
    existing.destroy();
    registry.delete(id);
  }
}
function register(id, instance) {
  registry.set(id, instance);
  return instance;
}
```
React equivalent: `ChartCanvas` keys the Chart.js instance to a `useRef`, calls `.destroy()` in the `useEffect` cleanup function instead of a manual `Map` keyed by DOM id — same guarantee ("always destroy before re-create"), simpler because React's lifecycle already tracks mount/unmount per component instance.

**Theme tokens to port, retinted teal** (lines 36-89):
```javascript
const COLORS = {
  primary: '#22c55e', // → retint to teal #10b981 per D-16
  grid: 'rgba(255,255,255,0.07)',
  tick: 'rgba(255,255,255,0.45)',
  label: 'rgba(255,255,255,0.65)',
  background: '#0f1117' // → align with UI-SPEC #0a0f0d
};
const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: { legend: { /* ... */ }, tooltip: { /* ... */ } },
  scales: { x: { /* ... */ }, y: { /* ... */ } }
};
```
**One representative chart factory to model `ChartCanvas`'s Chart.js-instantiation shape on** (lines 525-589, `renderTStudentDiffChart` — chosen because it's the shortest complete factory and directly usable for the demo stub's simple result chart):
```javascript
export function renderTStudentDiffChart(canvasId, result, labels, utils) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const chart = new Chart(canvas, { type: 'scatter', data: { /* ... */ }, options: { ...BASE_OPTS, /* ... */ } });
  return register(canvasId, chart);
}
```
Port this as the body of `ChartCanvas`'s `useEffect`, replacing `document.getElementById(canvasId)` with the component's own `canvasRef.current` (no DOM id needed once React owns the ref).

**Critical bug fix during port (not a behavior change, a correctness fix):** delete the CDN import at the top of the file —
```javascript
import { Chart, ScatterController, /* ... */ } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/+esm';
```
— and replace with `import { Chart, ... } from 'chart.js'` per RESEARCH.md Pitfall 6. Same fix applies to the `<script type="importmap">` block in `index.html:16-23`, which must not survive into the new Vite `index.html`.

---

### `src/shared/charts/useChartExport.ts` (hook, file-I/O)

**Analog:** `assets/js/chart-manager.js:138-147` (`exportCanvas`) — port verbatim into a hook body, already framework-agnostic:
```javascript
export function exportCanvas(canvasId, filename = 'grafico-lacirstat.png') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png', 1.0);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
```
The only change: swap `document.getElementById(canvasId)` for a `canvasRef.current` passed into the hook (already the exact shape RESEARCH.md's Pattern 4 code example specifies).

---

### `src/shared/format.ts` (utility, transform)

**Analog:** `assets/js/app.js:85-107` (`utils.fmtNumber`, `utils.fmtP`, `utils.fmtSigned`) — port verbatim:
```javascript
fmtNumber(value, digits = 3) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
},
fmtSigned(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return sign + Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
```
Export as standalone functions (`export function fmtNumber(...)`) rather than an object-of-methods, matching idiomatic TS module style; behavior identical.

---

### `src/routes/estatistica/Sidebar.tsx` (component, CRUD list render)

**Analog:** `assets/js/app.js:731-745` (`renderNav`) + `index.html:56-70` (`.sidebar`/`.nav-card` markup) + `styles.css:548-573` (`.test-link`/`.test-link.active`/`.test-link-title`)

**Render-a-list-from-registry pattern to re-express in JSX:**
```javascript
function renderNav(manifest) {
  utils.clearElement(navEl);
  manifest.forEach(item => {
    const button = document.createElement('button');
    button.className = 'test-link';
    button.dataset.testId = item.id;
    button.innerHTML = `
      <span class="test-link-title">${utils.escapeHtml(item.title)}</span>
      <span class="test-link-subtitle">${utils.escapeHtml(item.subtitle || '')}</span>
    `;
    button.addEventListener('click', () => loadTest(item.id));
    navEl.appendChild(button);
  });
}
```
React equivalent: `TEST_REGISTRY.map(item => <SidebarTestLink key={item.id} {...item} active={item.id === activeId} onSelect={...} />)`. Active-state toggling (`app.js:725-729`, `setActiveNav`) becomes a plain `className` conditional instead of `classList.toggle`.

**CSS states to carry over as Tailwind/CSS-module equivalents** (`styles.css:549-573`):
```css
.test-link:hover { transform: translateX(3px); background: rgba(34,197,94,0.06); color: var(--text); border-color: var(--border); }
.test-link.active { border: 1px solid rgba(34,197,94,0.28); background: rgba(34,197,94,0.10); color: var(--green-light); box-shadow: inset 4px 0 0 var(--green); }
```
Retint `rgba(34,197,94,*)` → teal `#10b981` equivalents per D-16/UI-SPEC Color section; `box-shadow: inset 4px 0 0 var(--green)` → same technique with teal, used for `disponível` active row indication.

**Collapsible breakpoint reference (D-05):** legacy `.page-shell` collapses at `980px` (`styles.css:1172-1174`, `.page-shell { grid-template-columns: 1fr; }`) — UI-SPEC/RESEARCH.md both cite this as the breakpoint to preserve; implement as a custom `<aside>` + Tailwind responsive class or `Sheet` overlay below this width, per RESEARCH.md Open Question 2's recommendation (custom collapsible, not a full shadcn sidebar block).

---

### `src/app/Header.tsx` (component)

**Analog:** `index.html:29-52` (`.lacir-header` markup) + `styles.css:44-159`

**Structure to port (logo lockup + right-side actions), stripped of badge/version per D-02/D-03:**
```html
<header class="lacir-header">
  <div class="lacir-header-inner">
    <a href="/" class="lacir-logo">
      <img src="./logo lacir.png" alt="Logo LACIR" style="height: 32px; width: auto; object-fit: contain;" />
      <div class="lacir-logo-text">
        <span class="lacir-logo-name">LACIR</span>
        <span class="lacir-logo-sub">Bioestatística</span>
      </div>
    </a>
    <div class="lacir-header-right">
      <a href="..." class="lacir-header-btn">Portal DATASUS ↗</a>
      <span class="lacir-header-version">v1.0 · Beta</span> <!-- DELETE per D-02 -->
    </div>
  </div>
</header>
```
**Do not** carry the `Portal DATASUS` link or `.lacir-header-version` badge into the new `Header.tsx` — D-03 moves the DATASUS link inside `EstatisticaPage`, D-02 removes the badge entirely. Only the logo lockup + sticky/blur header chrome ports; the 4 `NavLink`s are new (RESEARCH.md Code Examples already provides the exact JSX for this, `router.tsx`/`Header.tsx` example).

**Sticky/blur chrome to port verbatim, retinted** (`styles.css:44-54`):
```css
.lacir-header {
  position: sticky; top: 0; z-index: 100; width: 100%;
  background: rgba(9, 9, 11, 0.75);
  border-bottom: 1px solid var(--border-strong);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```
UI-SPEC's `AppHeader` entry explicitly cites this exact `backdrop-filter` value as "carried from legacy `.lacir-header`."

---

### `src/app/theme.css` (config)

**Analog:** `assets/css/styles.css:1-30` (`:root` token block)

**Token-naming pattern to port (names/roles, not the green values):**
```css
:root {
  --bg: #09090b;
  --green: #22c55e;
  --green-soft: rgba(34, 197, 94, 0.15);
  --danger: #ef4444;
  --warning: #f59e0b;
  --radius-xl: 22px;
  --radius-lg: 16px;
  --radius-md: 12px;
}
```
Port the *shape* of this token system (a small flat set of semantic CSS custom properties) into Tailwind v4's `@theme` block, per RESEARCH.md's Tailwind v4 code example — but replace every `--green*` value with the new teal (`#10b981`) triad from UI-SPEC's Color section, and replace `--radius-xl/-lg/-md` (22/16/12) with UI-SPEC's declared 16/12/8 scale (UI-SPEC Spacing Scale: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`) — note the legacy `-xl`/`-lg`/`-md` names don't map 1:1 to the new `-lg`/`-md`/`-sm` names; the planner should treat this as "same pattern, renumbered scale," not a literal value copy. **Danger/warning hex values (`#ef4444`/`#f59e0b`) are identical between legacy CSS and the new UI-SPEC — port these two verbatim, unchanged.**

---

## Shared Patterns

### XSS-safe rendering (React JSX escaping replaces manual `escapeHtml`)
**Source:** `assets/js/app.js:29-36` (`utils.escapeHtml`) — used in nearly every `innerHTML` call across `app.js`, `datasus-wizard.js`, `tabular-data-input.js`'s `renderPreviewTable`.
**Apply to:** Every new component that renders pasted/parsed user data (`ColumnPreviewTable`, `DatasusWizardPanel`, error `Alert`s). **Do not port `escapeHtml` into any `.tsx` file** — its entire purpose (preventing `<`/`>`/`&` from being interpreted as HTML) is subsumed by JSX's default text-child escaping. Any new file that imports/reimplements `escapeHtml` or builds HTML strings is a signal something went wrong in the port (RESEARCH.md Pitfall 1's "warning signs").

### Friendly parse-error shape
**Source:** `assets/js/tabular-data-input.js:329-345` (`buildTabularRecognitionError`) — returns `{ message, details: string[] }`.
**Apply to:** `ColumnPreviewTable`'s error state and `Alert` component — this exact `{ message, details }` shape should flow straight into `useTabularInput`'s `error` state and be rendered as UI-SPEC's "Ver detalhes" expandable list, with zero reshaping needed.

### Status-tone banner (status/success/error/warning coloring)
**Source:** `assets/js/datasus-wizard.js:34-38` (`formatToneClass`):
```javascript
function formatToneClass(tone) {
  if (tone === 'error') return 'error-box';
  if (tone === 'success') return 'success-box';
  return 'status-bar';
}
```
**Apply to:** Any shared status/alert component that needs tone-based styling (`Alert`, DataSUS wizard status line, Mapas partial-variable note) — same 3-tone (`status`/`success`/`error`) switch pattern, mapped to shadcn `Alert` variant props instead of CSS class names.

### Chart.js instance registry → per-component `useEffect` lifecycle
**Source:** `assets/js/chart-manager.js:91-105` (global `Map`-based `registry`/`destroyChart`/`register`).
**Apply to:** `ChartCanvas` (only one chart component needed in Phase 1, but this is the pattern all future Phase 2/3 test charts reuse) — collapse the global `Map` into one `useRef<Chart | null>` per `ChartCanvas` instance, destroy-then-recreate inside a single `useEffect` keyed on the chart's data/type props.

### pt-BR number formatting
**Source:** `assets/js/app.js:85-107` (`fmtNumber`/`fmtP`/`fmtSigned`, all built on `Number.prototype.toLocaleString('pt-BR', ...)`).
**Apply to:** `format.ts` (verbatim port), then reused by `TesteDemo`'s metric cards and any future migrated test's numeric display — this is the one formatting convention every result screen in the app must share.

### Registry-driven list rendering (single source of truth)
**Source:** `tests-manifest.json` (id/title/subtitle/path shape) + `app.js:562-600` (`createRegisteredTest`/`registerModules`).
**Apply to:** `features/tests/registry.ts` must be the only place `id`/`title`/`status` string literals for a test are declared; both `Sidebar.tsx` and `QualTesteModal.tsx` import from it (RESEARCH.md Pitfall 4 / Anti-Patterns section — this is the exact drift bug the old manifest/nav split could have caused and the new registry must prevent structurally).

## No Analog Found

Files with no close vanilla-JS or existing-pattern match — planner should rely on RESEARCH.md's Code Examples / Architecture Patterns sections instead, since these are genuinely new capabilities introduced this phase:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/app/router.tsx` | route | request-response | No router exists in the MVP (single-page manifest+innerHTML swap, not URL-based routing) |
| `src/routes/mapas/BrazilMockMap.tsx` | component | event-driven | No geo/map UI exists anywhere in the current codebase; fully spec'd fresh in RESEARCH.md Pattern 6 |
| `src/routes/mapas/VariablePanel.tsx` | component | transform | No per-region variable-availability UI exists; closest is DataSUS wizard's derived-table render, but domain is unrelated |
| `src/routes/mapas/computeVariableIntersection.ts` | utility | transform | Pure new set-intersection logic; RESEARCH.md Code Examples already provides a complete reference implementation to adapt directly |
| `src/routes/mapas/mockVariablesByUF.ts` | fixture | — | New hand-authored mock fixture, explicitly not derived from any existing `trabalhos datasus/build/*` data (RESEARCH.md Anti-Patterns) |
| `src/shared/hooks/useLeaveWarning.ts` | hook | event-driven | No `beforeunload` handling exists in the MVP at all; net-new browser API usage, fully spec'd in RESEARCH.md Pattern 5 |
| `src/shared/flow/FlowSteps.tsx` | component | request-response | No 3-step Dados/Configurar/Resultados stepper shell exists; each MVP test module (`t-student/module.js`, etc.) inlines its own single-page flow instead of a shared step shell |
| `src/lib/utils.ts` (`cn()`) | utility | transform | shadcn/cva/tailwind-merge convention, no vanilla-JS equivalent needed (Tailwind wasn't actually used for styling — legacy CSS is hand-written, not utility classes) |

## Metadata

**Analog search scope:** `assets/js/*.js` (all 8 files), `assets/css/styles.css`, `index.html`, `tests-manifest.json`, `tests/t-student/module.js` (sample test module), `.planning/phases/01-redesign-base-react-shell/01-{CONTEXT,RESEARCH,UI-SPEC}.md`
**Files scanned:** 8 JS modules (5,841 total lines), 1 CSS file (1,183 lines), `index.html`, `tests-manifest.json`, 1 representative test module
**Pattern extraction date:** 2026-07-25
