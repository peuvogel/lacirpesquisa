---
phase: 1
slug: redesign-base-react-shell
status: aligned-with-plans
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-25
updated: 2026-07-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `01-RESEARCH.md` § Validation Architecture; task IDs filled in from the 12 plans created 2026-07-25.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react + jsdom (installed by plan 01-01, Task 2 — none exists today) |
| **Config file** | `vite.config.ts` `test` block + `src/test/setup.ts` (plan 01-01, Task 2) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm run test:run` |
| **Type gate** | `npm run typecheck` |
| **Estimated runtime** | ~15–45 seconds after plan 01-01 |

`vite.config.ts` scopes vitest to `src/**/*.{test,spec}.{ts,tsx}` so the legacy `tests/` directory (v1.0 test *modules*, not test files) is never scanned. No watch-mode flag appears in any plan's verify command.

---

## Sampling Rate

- **After every task commit:** targeted `npx vitest run <area>`
- **After every plan wave:** `npm run test:run`
- **Before `/gsd:verify-work`:** full suite green + manual pass of the 6 roadmap success criteria
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | — | T-01-SC | Package legitimacy gate before any install | checkpoint | `test ! -d node_modules/react` | n/a | ⬜ pending |
| 01-01-T2 | 01 | 1 | UI-01 | T-01-CDN | Harness installed; no CDN importmap | infra | `npx vitest run src/test/smoke.test.tsx` | ❌ creates | ⬜ pending |
| 01-01-T3 | 01 | 1 | UI-01 | T-01-SC2 | shadcn primitives reviewed; purple scaffold deleted | unit | `npx vitest run src/components/ui/primitives.test.tsx` | ❌ creates | ⬜ pending |
| 01-02-T1 | 02 | 2 | UI-01 | T-01-CSS | Token layer, no legacy hex | build | `npm run build` + hex absence gate | ❌ creates | ⬜ pending |
| 01-02-T2 | 02 | 2 | UI-01 | T-01-SC3 | First-party accents, no cult-ui | unit | `npx vitest run src/app/theme.contract.test.ts` | ❌ creates | ⬜ pending |
| 01-03-T1 | 03 | 2 | UI-03 | T-01-XSS | Adapter port, no escapeHtml | unit | `npx vitest run src/shared/data-input/legacyAdapters.test.ts` | ❌ creates | ⬜ pending |
| 01-03-T2 | 03 | 2 | UI-03 | T-01-DoS | Parser parity + XLSX error state | unit (differential) | `npx vitest run src/shared/data-input/parseTabular.test.ts` | ❌ creates | ⬜ pending |
| 01-03-T3 | 03 | 2 | UI-03 | T-01-XSS | DataSUS parse/normalize parity | unit (differential) | `npx vitest run src/shared/data-input/datasusImporter.test.ts` | ❌ creates | ⬜ pending |
| 01-04-T1 | 04 | 2 | UI-04 | — | pt-BR formatting parity | unit | `npx vitest run src/shared/format.test.ts` | ❌ creates | ⬜ pending |
| 01-04-T2 | 04 | 2 | UI-04 | T-01-CDN | Chart.js from npm; destroy-before-recreate | unit | `npx vitest run src/shared/charts/ChartCanvas.test.tsx` | ❌ creates | ⬜ pending |
| 01-04-T3 | 04 | 2 | UI-04 | T-01-DL | Export calls toDataURL, cleans up anchor | unit | `npx vitest run src/shared/charts/useChartExport.test.ts` | ❌ creates | ⬜ pending |
| 01-05-T1 | 05 | 3 | UI-01 | T-01-PRIV | No storage APIs; derived hasData | unit | `npx vitest run src/shared/session/SessionProvider.test.tsx` | ❌ creates | ⬜ pending |
| 01-05-T2 | 05 | 3 | UI-01 | T-01-XSS3 | 4 nav labels; no badge; no DATASUS link | unit (RTL) | `npx vitest run src/app/Header.test.tsx` | ❌ creates | ⬜ pending |
| 01-05-T3 | 05 | 3 | UI-01 | T-01-ROUTE | Four route shells + error element | unit (RTL) | `npx vitest run src/app/router.test.tsx` | ❌ creates | ⬜ pending |
| 01-06-T1 | 06 | 3 | UI-02 | — | Step gating + stepper a11y | unit | `npx vitest run src/shared/flow/FlowSteps.test.tsx` | ❌ creates | ⬜ pending |
| 01-06-T2 | 06 | 3 | UI-03 | T-01-DoS | File path try/catch; stale-result guard | unit (renderHook) | `npx vitest run src/shared/data-input/useTabularInput.test.ts` | ❌ creates | ⬜ pending |
| 01-06-T3 | 06 | 3 | UI-03 | T-01-XSS | Pasted payload renders inert (DOM-level) | unit (RTL) | `npx vitest run src/routes/estatistica/TabularInputPanel.test.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx` | ❌ creates | ⬜ pending |
| 01-07-T1 | 07 | 4 | UX-01 | T-01-DRIFT | Single registry; one available entry | unit | `npx vitest run src/features/tests/registry.test.ts` | ❌ creates | ⬜ pending |
| 01-07-T2 | 07 | 4 | UI-01 | T-01-TAB | DATASUS link noopener; em-breve inert | unit (RTL) | `npx vitest run src/routes/estatistica/Sidebar.test.tsx` | ❌ creates | ⬜ pending |
| 01-07-T3 | 07 | 4 | UX-01 | T-01-NAV | Modal roadmap; em breve non-navigable | unit (RTL) | `npx vitest run src/routes/estatistica/QualTesteModal.test.tsx` | ❌ creates | ⬜ pending |
| 01-08-T1 | 08 | 4 | UI-03 | T-01-STATE | State machine port; confirm invalidation | unit (renderHook) | `npx vitest run src/shared/data-input/useDatasusWizard.test.ts` | ❌ creates | ⬜ pending |
| 01-08-T2 | 08 | 4 | UI-02 | T-01-XSS | Steps 1–3 in JSX, no innerHTML | types/build | `npm run typecheck && npm run build` + innerHTML absence gate | n/a | ⬜ pending |
| 01-08-T3 | 08 | 4 | UI-02, UI-03 | T-01-XSS | Six-step flow; script payload inert | unit (RTL) | `npx vitest run src/routes/estatistica/datasus/DatasusWizardPanel.test.tsx` | ❌ creates | ⬜ pending |
| 01-09-T1 | 09 | 4 | UI-01 | T-01-SVG | Sanitized geometry; keyboard operable | unit (RTL) | `npx vitest run src/routes/mapas/BrazilMockMap.test.tsx` | ❌ creates | ⬜ pending |
| 01-09-T2 | 09 | 4 | UI-01 (SC-6) | T-01-MOCK | UF intersection/partials | unit | `npx vitest run src/routes/mapas/computeVariableIntersection.test.ts` | ❌ creates | ⬜ pending |
| 01-09-T3 | 09 | 4 | UI-01 (SC-6) | T-01-MOCK | Locked selection beats hover; gap alerts | unit (RTL) | `npx vitest run src/routes/mapas/VariablePanel.test.tsx` | ❌ creates | ⬜ pending |
| 01-10-T1 | 10 | 5 | UI-06 | T-01-STAT | No inferential claims in stub text | unit | `npx vitest run src/routes/estatistica/demo/demoStats.test.ts` | ❌ creates | ⬜ pending |
| 01-10-T2 | 10 | 5 | UI-04, UI-06 | T-01-XSS | Interpretation renders inert; export filename | unit (RTL) | `npx vitest run src/routes/estatistica/ResultsPanel.test.tsx` | ❌ creates | ⬜ pending |
| 01-10-T3 | 10 | 5 | UI-02 | T-01-DoS | Step gating end-to-end; single dataset path | unit (RTL) | `npx vitest run src/routes/estatistica/demo/TesteDemo.test.tsx` | ❌ creates | ⬜ pending |
| 01-11-T1 | 11 | 5 | UI-01 | T-01-MOCK | Suggestions resolve to real registry ids | unit | `npx vitest run src/routes/mapas/suggestResearchForSelection.test.ts` | ❌ creates | ⬜ pending |
| 01-11-T2 | 11 | 5 | UI-03 | T-01-TAB, T-01-URL | Links noopener; static URL map | unit (RTL) | `npx vitest run src/routes/mapas/IniciarPesquisaModal.test.tsx` | ❌ creates | ⬜ pending |
| 01-12-T1 | 12 | 6 | UI-05 | T-01-STALE | Listener gated on current hasData; no leak | unit (renderHook) | `npx vitest run src/shared/hooks/useLeaveWarning.test.ts` | ❌ creates | ⬜ pending |
| 01-12-T2 | 12 | 6 | UI-05 | T-01-NAG, T-01-LOSS | Route-scoped guard; confirmed clear | unit (RTL) | `npx vitest run src/routes/estatistica/ClearDataButton.test.tsx` | ❌ creates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*"File Exists → creates" means the task itself authors the test file (Nyquist Wave 0 dependency satisfied by plan 01-01's harness).*

---

## Requirement → Coverage

| Requirement | Covering tasks |
|-------------|----------------|
| UI-01 | 01-01-T2, 01-01-T3, 01-02-T1, 01-02-T2, 01-05-T1, 01-05-T2, 01-05-T3, 01-07-T2, 01-09-T1 |
| UI-02 | 01-06-T1, 01-08-T2, 01-08-T3, 01-10-T3 |
| UI-03 | 01-03-T1, 01-03-T2, 01-03-T3, 01-06-T2, 01-06-T3, 01-08-T1, 01-08-T3, 01-11-T2 |
| UI-04 | 01-04-T1, 01-04-T2, 01-04-T3, 01-10-T2 |
| UI-05 | 01-12-T1, 01-12-T2 |
| UI-06 | 01-10-T1, 01-10-T2 |
| UX-01 | 01-07-T1, 01-07-T3 |
| Mapas mock (ROADMAP SC-6) | 01-09-T1, 01-09-T2, 01-09-T3, 01-11-T1, 01-11-T2 |

---

## Wave 0 Requirements

All satisfied by plan 01-01 (wave 1) before any test-authoring task runs:

- [ ] Install `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event` + `jsdom` (01-01-T2)
- [ ] `vite.config.ts` `test` block scoped to `src/**` + `src/test/setup.ts` with jest-dom matchers and `getContext`/`toDataURL` canvas stubs (01-01-T2)
- [ ] `npm run test:run` / `typecheck` scripts, with no watch-mode flag in any verify (01-01-T2)
- [ ] Fixture files with 3 messy DataSUS/TABNET paste samples for parser regression (01-03-T1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Where checked |
|----------|-------------|------------|---------------|
| Real PNG download with chart pixels | UI-04 | jsdom canvas stub ≠ real image | 01-04-T3 and 01-10-T3 `<human-check>` |
| Full paste→preview→confirm with a real TABNET dump | UI-03 | Unit fixtures cover parsing; one live smoke needed | 01-06-T3 `<human-check>` |
| Six-step DataSUS assistant over a real multi-source export | UI-02/UI-03 | Interaction feel and parity with v1.0 | 01-08-T3 `<human-check>` |
| Mapas hover/lock/multi-select feel | SC-6 | Visual/interaction | 01-09-T3 `<human-check>` |
| Mapas → paste → Estatística handoff | SC-6 | Cross-route navigation + hydration | 01-11-T2 `<human-check>` |
| Leave prompt matrix (data/no-data × Estatística/other route) | UI-05 | Native browser dialog | 01-12-T2 `<human-check>` |
| Dark+teal look, active nav underline, route fade | UI-01 | Visual judgment | 01-05-T3 `<human-check>` |
| Sidebar collapse below 980px | UI-01/D-05 | Responsive visual | 01-07-T2 `<human-check>` |

`workflow.human_verify_mode` is `end-of-phase`, so these are `<verify><human-check>` items inside their tasks rather than blocking checkpoints. The one exception is 01-01-T1, the package legitimacy gate, which is a blocking human checkpoint because legitimacy gates are never auto-approvable.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency satisfied by plan 01-01
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all MISSING references (harness in 01-01, fixtures in 01-03)
- [x] No watch-mode flags (`npx vitest run` / `npm run test:run` only)
- [x] Feedback latency < 45s (targeted runs per task)
- [x] `nyquist_compliant: true` set after plans landed

**Approval:** aligned with the 12 plans created 2026-07-25
