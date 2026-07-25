---
phase: 3
slug: testes-classicos-glm-novos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 + @testing-library/react ^16.3.2 |
| **Config file** | `vite.config.ts` (`test` block) |
| **Quick run command** | `npm run test:run -- src/shared/stats/` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30–90 seconds |

---

## Sampling Rate

- **After every task commit:** Run touched `*Engine.test.ts` / `glmEngine.test.ts`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-* | 01 | 0 | TEST-04…09 | T-03-deps | No postinstall surprise; client-only | unit/golden | `npm run test:run -- src/shared/stats/` | ❌ W0 | ⬜ pending |
| 03-02-* | 02 | A | TEST-04 | — | N/A | unit+RTL | `npm run test:run -- qui-quadrado` | ❌ | ⬜ pending |
| 03-03-* | 03 | A | TEST-05 | — | N/A | unit+RTL | `npm run test:run -- anova-tukey` | ❌ | ⬜ pending |
| 03-04-* | 04 | A | TEST-06 | — | N/A | unit+RTL | `npm run test:run -- kruskal-dunn` | ❌ | ⬜ pending |
| 03-05-* | 05 | A | UX-02 | — | N/A | RTL | `npm run test:run -- AssumptionNudgeStrip registry` | ❌ | ⬜ pending |
| 03-06-* | 06 | B | TEST-07 | — | N/A | unit+RTL | `npm run test:run -- poisson glmEngine` | ❌ | ⬜ pending |
| 03-07-* | 07 | B | TEST-08 | — | N/A | unit+RTL | `npm run test:run -- binomial-negativa` | ❌ | ⬜ pending |
| 03-08-* | 08 | B | TEST-09 | — | N/A | unit+RTL | `npm run test:run -- logistica` | ❌ | ⬜ pending |
| 03-09-* | 09 | B | TEST-04…09, UX-02 | — | N/A | full suite | `npm run test:run` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/stats/glmEngine.ts` + `glmEngine.test.ts` — Poisson/NB/Logistic
- [ ] `statsEngine.ts` extensions + tests — χ², ANOVA, Kruskal, Tukey, Dunn
- [ ] `src/test/fixtures/jasp/*.golden.json` — ≥1 fixture per test family
- [ ] `scripts/oracle/generate-phase3-fixtures.R` — dev regeneration (optional if R unavailable; textbook fixtures OK)
- [ ] `src/features/tests/shared/AssumptionNudgeStrip.tsx`
- [ ] `jstat`, `ml-matrix` install + human-verify checkpoint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart PNG after customize | TEST-04…09 | Canvas/jsdom | Customize one chart per family → Baixar PNG → open file |
| Didactic nudge copy quality | UX-02 | Teaching tone | Read Pressupostos strip on sparse χ² and overdispersed Poisson |
| Poisson→NB handoff UX | D-20 / TEST-07–08 | Cross-route flow | Trigger overdispersion CTA → land on NB with same columns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
