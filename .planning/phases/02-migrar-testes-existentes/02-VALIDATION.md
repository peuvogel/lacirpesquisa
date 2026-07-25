---
phase: 2
slug: migrar-testes-existentes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 + @testing-library/react ^16.3.2 |
| **Config file** | `vite.config.ts` (`test` block) |
| **Quick run command** | `npm run test:run -- src/features/tests/<module>/<engine>.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30–90 seconds (grows with differential suites) |

---

## Sampling Rate

- **After every task commit:** Run the touched engine/RTL file (`npm run test:run -- <path>`)
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual PNG spot-check after ChartCustomizer changes
- **Max feedback latency:** 90 seconds for full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-W0-stats | 01 | 0 | TEST-01–03 | T-02-01 | Interpretation as plain strings only | unit/differential | `npm run test:run -- src/shared/stats/statsEngine.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-derive | 01 | 0 | TEST-01–03 | — | N/A | unit/differential | `npm run test:run -- src/shared/data-input/datasusNormalizer.derive.test.ts` | ❌ W0 | ⬜ pending |
| 02-t-engine | TBD | TBD | TEST-01 | — | N/A | unit/differential | `npm run test:run -- src/features/tests/t-student/tStudentEngine.test.ts` | ❌ W0 | ⬜ pending |
| 02-t-flow | TBD | TBD | TEST-01 | T-02-01 | No HTML from paste in results | RTL | `npm run test:run -- src/features/tests/t-student/TStudentTest.test.tsx` | ❌ W0 | ⬜ pending |
| 02-c-engine | TBD | TBD | TEST-02 | — | N/A | unit/differential | `npm run test:run -- src/features/tests/correlacao/correlacaoEngine.test.ts` | ❌ W0 | ⬜ pending |
| 02-p-engine | TBD | TBD | TEST-03 | — | N/A | unit/differential | `npm run test:run -- src/features/tests/prais-winsten/praisEngine.test.ts` | ❌ W0 | ⬜ pending |
| 02-registry | TBD | TBD | TEST-01–03 | — | N/A | unit | `npm run test:run -- src/features/tests/registry.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*  
*Planner must expand Task IDs to match final PLAN.md numbering and keep sampling continuity (no 3 consecutive tasks without automated verify).*

---

## Wave 0 Requirements

- [ ] `src/shared/stats/statsEngine.ts` + `statsEngine.test.ts` — full Stats port + legacy parity
- [ ] `src/shared/data-input/datasusNormalizer.derive.test.ts` — derive* numeric verification
- [ ] `src/test/fixtures/tests/t-student-exemplo.txt` — from config.json exampleText / templates
- [ ] `src/test/fixtures/tests/correlacao-exemplo.txt` — from config.json examples
- [ ] `src/test/fixtures/tests/prais-exemplo.txt` — from config.json exampleRows
- [ ] One TABNET fixture per test (extend `src/test/fixtures/tabnet/` or test-specific derive inputs)
- [ ] Stubs for `src/shared/charts/chartFactories/*`, `ChartCustomizer.tsx`, feature modules under `src/features/tests/{t-student,correlacao,prais-winsten}/`
- [ ] `chartjs-plugin-annotation` install (human-verify if needed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PNG export after ChartCustomizer changes | TEST-01–03 / UI-04 | Canvas pixels / download not reliable in jsdom | Run each migrated test → customize chart → Baixar gráfico (PNG) → open file (non-blank, dark bg, series visible) |
| Didactic cards + Usar exemplo feel | TEST-01–03 | Teaching UX judgment | Open each test → Usar exemplo → Configurar cards → Resultados interpretation reads naturally |
| Qual teste usar? demo labeling | UX-01 / D-17 | Visual chip copy | Open modal — demo labeled demonstração; three tests Disponíveis |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills task map

**Approval:** pending
