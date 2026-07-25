---
phase: 1
slug: redesign-base-react-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react + jsdom (Wave 0 install — none exists today) |
| **Config file** | `vitest.config.ts` or `vite.config.ts` `test` block — Wave 0 |
| **Quick run command** | `npx vitest run <changed-area>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15–45 seconds after Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run targeted `vitest run <area>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green + manual pass of 6 roadmap success criteria
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | — | — | Install vitest/RTL | infra | — | ❌ W0 | ⬜ pending |
| TBD | — | — | UI-01 | T-XSS | JSX text only, no version badge | unit | `vitest run src/app/Header.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | UI-02 | — | Flow step gating | unit | `vitest run src/shared/flow/FlowSteps.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | UI-03 | T-XSS / T-DoS-xlsx | Parser regression on TABNET fixtures | unit | `vitest run src/shared/data-input/parseTabular.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | UI-04 | — | Export calls toDataURL | unit | `vitest run src/shared/charts/useChartExport.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | UI-05 | — | beforeunload only when hasData | unit | `vitest run src/shared/hooks/useLeaveWarning.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | UI-06 | — | Non-empty PT interpretation | unit | `vitest run src/routes/estatistica/demo/TesteDemo.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | UX-01 | — | Modal roadmap; em breve non-nav | unit | `vitest run src/routes/estatistica/QualTesteModal.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | MAP mock | — | UF intersection/partials | unit | `vitest run src/routes/mapas/computeVariableIntersection.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*  
*Task IDs filled by planner when PLAN.md waves exist.*

---

## Wave 0 Requirements

- [ ] Install `vitest` + `@testing-library/react` + `jsdom` (or `happy-dom`)
- [ ] `vitest.config.ts` (or vite `test` block) + `src/test/setup.ts` (jest-dom, canvas stub)
- [ ] Fixture file with 2–3 messy DataSUS/TABNET paste samples for parser regression
- [ ] Stub test files listed in the map above

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real PNG download with chart pixels | UI-04 | jsdom canvas stub ≠ real image | Run stub test → Export PNG → open file |
| Full paste→preview→confirm with messy TABNET dump | UI-03 | Covered by unit fixtures; one live smoke | Paste real TABNET dump in UI once |
| Mapas hover/select UX feel | MAP mock | Visual/interaction | Hover UF, multi-select, check panel alerts |
| Leave prompt on Estatística with data | UI-05 | Browser dialog | Input data → try close tab → confirm prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter after plans land

**Approval:** pending
