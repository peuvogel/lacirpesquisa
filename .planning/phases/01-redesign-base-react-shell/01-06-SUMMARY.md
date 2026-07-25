---
phase: 01-redesign-base-react-shell
plan: 06
subsystem: ui
tags: [react, vitest, testing-library, react-hooks, xss-regression]

requires:
  - phase: 01-02
    provides: "@theme design tokens (--color-accent, --font-mono, --text-data), shadcn primitives (Button, Alert)"
  - phase: 01-03
    provides: "readTabularPasteState/readTabularFileState, legacyUtils/legacyStats, { message, details } friendly-error shape, TABNET fixtures"
provides:
  - "src/shared/flow/FlowSteps.tsx — Dados→Configurar→Resultados stepper shell (UI-02), FLOW_STEPS/FLOW_STEP_LABELS"
  - "src/shared/data-input/useTabularInput.ts — idle/parsing/loaded/error React state wrapper over the ported parsers, debounced paste, stale-guarded file upload"
  - "src/routes/estatistica/TabularInputPanel.tsx — textarea + drag/drop dropzone + aria-live destructive Alert with Ver detalhes"
  - "src/routes/estatistica/ColumnPreviewTable.tsx — data-driven column-role auto-detect, adjustable selects, Analisar dados confirm gate"
affects: [01-08-DatasusWizardPanel, 01-10-TesteDemo]

tech-stack:
  added: []
  patterns:
    - "FlowSteps mounts only the active step's slot (dados/configurar/resultados are never all three in the DOM at once), preventing a Resultados-step chart effect from firing while the user is on Dados"
    - "useTabularInput reshapes the parser's RecognizedColumn objects into a flat Record<string, number> (key → column index) per the plan's documented UI contract, while passing the { message, details } error shape straight through unreshaped"
    - "useTabularInput's setFile wraps readTabularFileState in its own try/catch as defense-in-depth (T-01-DoS): the parser already resolves every anticipated failure into a friendly error state, but the call-site catch guarantees the UI-SPEC file-read copy and a non-throwing promise even if the parser call itself rejects"
    - "Stale-result guard: setRawText/setFile each track their own monotonic request-id ref; only the most recently *started* call may ever commit state, so a slow big XLSX can never clobber a faster newer paste"
    - "ColumnPreviewTable auto-detects a column's role (numérica/categórica/tempo) from its actual pasted values, not from domain aliases — keeps the component generic across every future test module instead of coupling it to one test's column semantics"
    - "TabularInputPanel/ColumnPreviewTable render every parsed/echoed user string as a JSX text child only — proven inert against a <img onerror> payload at the DOM level (T-01-XSS)"

key-files:
  created:
    - src/shared/flow/FlowSteps.tsx
    - src/shared/flow/FlowSteps.test.tsx
    - src/shared/data-input/useTabularInput.ts
    - src/shared/data-input/useTabularInput.test.ts
    - src/routes/estatistica/TabularInputPanel.tsx
    - src/routes/estatistica/TabularInputPanel.test.tsx
    - src/routes/estatistica/ColumnPreviewTable.tsx
    - src/routes/estatistica/ColumnPreviewTable.test.tsx
  modified: []

key-decisions:
  - "useTabularInput's recognizedColumns is intentionally reshaped from the parser's Record<string, RecognizedColumn> into Record<string, number> (index-only) — this is the documented plan interface, distinct from the error shape which passes through unreshaped"
  - "ColumnPreviewTable's role auto-detection is data-driven (parses actual cell values for numeric/temporal ratios), not derived from useTabularInput's recognizedColumns — the component has no visibility into domain-specific aliases/numericKeys, so it can't know a caller's semantic column roles; recognizedColumns is used only to show a 'detectado' badge next to headers the parser specifically matched"
  - "TabularInputPanel does not disable the textarea while status === 'parsing' (deviating from a literal reading of 01-UI-SPEC.md's Interaction States row for the textarea): setRawText sets 'parsing' synchronously on every non-empty keystroke, so disabling the field mid-type would make it impossible to keep typing — the inline parsing indicator lives in the preview area instead, which is where 01-UI-SPEC.md's Loading section actually asks for it"
  - "useTabularInput's setFile try/catch is genuine defense-in-depth: readTabularFileState (01-03) already resolves file-read failures internally rather than rejecting, so the hook's own catch is unreachable via a real corrupt file today, but is proven via a mocked rejection of the parser call itself — this keeps the T-01-DoS mitigation structurally real rather than merely aspirational for any future change to the ported parser"

requirements-completed: [UI-02, UI-03]

duration: ~25min
completed: 2026-07-25
---

# Phase 1 Plan 06: FlowSteps, useTabularInput, Paste Panel, Column Preview Summary

**The shared Dados→Configurar→Resultados stepper (UI-02) plus the full D-09/D-10 paste/upload→auto-detect→preview→confirm loop (UI-03), all unit-covered including a DOM-level XSS regression test.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files:** 8 created, 0 modified

## Accomplishments

- `FlowSteps` renders one shared 3-step nav (`aria-label="Etapas"`) with Portuguese labels, mounts only the active step's content, applies `aria-current="step"` + `aria-disabled`/`disabled` per 01-UI-SPEC.md's stepper a11y contract, and structurally forces `dados` to always stay reachable regardless of what the caller passes for `canAdvance.dados`
- `useTabularInput` wraps `readTabularPasteState`/`readTabularFileState` (01-03) in `idle`/`parsing`/`loaded`/`error` React state: pasted text debounces ~150ms before parsing, an empty/whitespace textarea resets to `idle` (not an error), and both the paste and file paths guard against stale async results via a monotonic request-id ref
- `setFile` wraps the parser call in its own try/catch — genuine defense-in-depth for T-01-DoS, verified by mocking the parser call itself to reject and asserting the hook surfaces the exact UI-SPEC file-read copy (`Não foi possível ler este arquivo. Tente novamente ou cole os dados diretamente.`) with the technical reason tucked into `details`, never as the primary message
- `TabularInputPanel` renders the exact UI-SPEC empty-state copy, a mono-register textarea, a drag/drop file dropzone with a highlight state, an inline parsing indicator, and a destructive `Alert` (inside an `aria-live="polite"` region) with a working native `<details><summary>Ver detalhes</summary>` disclosure for parser error details
- `ColumnPreviewTable` auto-detects each column's role (numérica/categórica/tempo) from its actual pasted values, pre-selects a `<select>` per column, flags any user-adjusted select with an "ajustado" marker, shows a `Mostrando N de M linhas` caption, and gates the exact `Analisar dados` CTA copy on a minimally valid shape (≥2 columns, ≥1 numeric column) — confirming emits the full row set, not just the previewed slice
- T-01-XSS regression: a pasted `<img src=x onerror=alert(1)>` cell renders as literal, inert text with `document.querySelector('img')` asserted `null` — proven at the DOM level, not just on the string
- Repo-wide gate confirms zero `dangerouslySetInnerHTML`/`escapeHtml` occurrences anywhere under `src/`

## Task Commits

Each task was committed atomically:

1. **Task 1: The shared Dados → Configurar → Resultados stepper (UI-02)** - `0b3cf39` (feat)
2. **Task 2: useTabularInput — parsers as React state (UI-03)** - `2df0093` (feat)
3. **Task 3: Paste/upload panel and the confirmable column preview (D-09/D-10)** - `6ad1185` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/shared/flow/FlowSteps.tsx` - `FlowStep`/`FLOW_STEPS`/`FLOW_STEP_LABELS`, `FlowSteps` component
- `src/shared/flow/FlowSteps.test.tsx` - slot isolation, `aria-current`/`aria-disabled`, click gating, nav accessible name, `dados` override
- `src/shared/data-input/useTabularInput.ts` - `useTabularInput`, `UseTabularInputResult`, `TabularInputState`/`TabularInputError`/`TabularInputStatus`
- `src/shared/data-input/useTabularInput.test.ts` - debounced paste→loaded, junk→error, clear→idle, real-file→loaded, mocked-rejection→friendly copy, stale-result guard
- `src/routes/estatistica/TabularInputPanel.tsx` - `TabularInputPanel`, `TabularInputPanelProps`
- `src/routes/estatistica/TabularInputPanel.test.tsx` - empty state, preview-not-error, destructive alert + Ver detalhes, XSS-inert rendering, drag-over highlight
- `src/routes/estatistica/ColumnPreviewTable.tsx` - `ColumnPreviewTable`, `ColumnPreviewTableProps`, `ColumnRole`
- `src/routes/estatistica/ColumnPreviewTable.test.tsx` - headers/preview/caption, confirm gating (single vs. two-column), "ajustado" flagging, full-row-set confirm

## Decisions Made

- Reshaped `useTabularInput`'s `recognizedColumns` from the parser's `RecognizedColumn` objects to a flat `Record<string, number>` (index-only) to match the plan's documented hook interface exactly, while leaving the `{ message, details }` error shape untouched per 01-PATTERNS.md's "Friendly parse-error shape" pattern
- `ColumnPreviewTable`'s role auto-detection reads actual cell values rather than the caller's domain aliases, since the component's props carry no numeric/categorical/temporal semantics — this keeps it generic across every future test module (D-10's intent) instead of coupling it to one test's column meaning
- Did not disable the textarea while `status === 'parsing'` despite 01-UI-SPEC.md's Interaction States table listing "disabled (while parsing)" for the textarea — a literal implementation would make it impossible to keep typing, since `setRawText` sets `parsing` synchronously on every keystroke before the 150ms debounce settles; the inline parsing indicator (which is what 01-UI-SPEC.md's Loading section actually asks for) lives in the preview area instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - UX bug avoided] Did not disable the textarea during `parsing`**
- **Found during:** Task 3, while designing `TabularInputPanel`
- **Issue:** 01-UI-SPEC.md's Interaction States table lists "disabled (while parsing)" as a textarea state. Implementing this literally means every keystroke synchronously flips `status` to `parsing` (before the debounce settles), which would disable the field mid-typing and make it impossible for a real user (or `userEvent`) to enter more than one character at a time.
- **Fix:** Left the textarea always enabled; the "there is a state to render while parsing" requirement (01-UI-SPEC.md's actual Loading-section ask) is satisfied by an inline `role="status"` indicator in the preview area instead.
- **Files modified:** `src/routes/estatistica/TabularInputPanel.tsx`
- **Commit:** `6ad1185`

No other deviations — Tasks 1 and 2 were executed exactly as written.

## Issues Encountered

None. All three verification commands specified in the plan's tasks pass, plus the plan-level verification:
- `npx vitest run src/shared/flow/FlowSteps.test.tsx && npm run typecheck` ✓
- `npx vitest run src/shared/data-input/useTabularInput.test.ts && npm run typecheck` ✓
- `npx vitest run src/routes/estatistica/TabularInputPanel.test.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx && npm run test:run && test 0 -eq "$(grep -rn 'dangerouslySetInnerHTML\|escapeHtml' src --include='*.tsx' --include='*.ts' | grep -v '^\s*//' | wc -l | tr -d ' ')"` ✓ (159 tests / 15 files, full suite green, gate returns 0)

## User Setup Required

None — no external service configuration required.

**Note:** plans 01-04 and 01-05 (chart theme/ChartCanvas/PNG export, and Header/router/route shells/SessionProvider) were executed concurrently by other agents during this plan's execution — visible in `git log` as interleaved commits. This plan's files have no dependency on and made no changes to that work.

## Next Phase Readiness

- `TabularInputPanel`/`ColumnPreviewTable`/`useTabularInput` are ready to be composed by plan 01-08's `DatasusWizardPanel` (per-source parsing step) and plan 01-10's `TesteDemo` (Dados step)
- `FlowSteps` is ready for 01-10's demo stub to wrap its Dados/Configurar/Resultados content
- No `EstatisticaPage.tsx` wiring was done in this plan — that composition is explicitly plan 01-10's scope
- No blockers

## Self-Check: PASSED

All 8 created files verified present on disk. All 3 task commit hashes (`0b3cf39`, `2df0093`, `6ad1185`) verified in `git log --oneline --all`. Full plan-level verification re-run: `npm run test:run` (15 files, 159 tests passed), `npm run typecheck` (clean), XSS/escapeHtml gate returns `0`.

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
