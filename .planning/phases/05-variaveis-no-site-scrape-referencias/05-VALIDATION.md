---
phase: 5
slug: variaveis-no-site-scrape-referencias
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-25
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react |
| **Config file** | `vite.config.ts` (`test` block) |
| **Quick run command** | `npm run catalog:validate && npm run test:run -- src/features/catalog/ src/routes/variaveis/` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30–90 seconds |

---

## Sampling Rate

- **After every task commit:** targeted tests for touched modules + `catalog:validate` when assets/schema change
- **After every plan wave:** `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite green + `catalog:validate` pass
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | CAT-05 | script/assert | `npm run catalog:build` + pack row counts | ⏳ | ⏳ |
| 05-02-* | 02 | 2 | CAT-02/05 | unit+CLI | `npm run catalog:validate` | ⏳ | ⏳ |
| 05-03-* | 03 | 3 | CAT-01/03/04 | unit TDD | `npm run test:run -- src/features/catalog/` | ⏳ | ⏳ |
| 05-04-* | 04 | 4 | CAT-01/02/03 | RTL | `npm run test:run -- src/routes/variaveis/` | ⏳ | ⏳ |
| 05-05-* | 05 | 4 | CAT-02/04 | unit+RTL | `npm run test:run -- catalogAnalysisData MapasPage` | ⏳ | ⏳ |
| 05-06-* | 06 | 5 | CAT-04 | RTL/integration | `npm run test:run -- VariaveisPage EstatisticaPage` | ⏳ | ⏳ |
| 05-07-* | 07 | 6 | CAT-01…05 | full suite | `npm run catalog:validate && npm run test:run` | ⏳ | ⏳ |

---

## Wave 0 / Wave 1 Prerequisites

- [ ] `scripts/catalog/build.mjs` + columnMap + reference-seed
- [ ] Committed `public/data/catalog/{manifest,variables,packs/*}`
- [ ] Schema types + `catalog:validate` fail-closed on orphan provenance
- [ ] Coleta scripts use repo-relative `BASE_DIR`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Provenance readability in class | CAT-02 | Teaching tone | Open `/variaveis`, pick loadable + reference entry, read provenance block | ⏳ human_needed |
| Mapas choropleth with real pack values | CAT-04 | Visual | Load amputações / embolia internações, check SP vs RO magnitude | ⏳ human_needed |
| Load → Estatística session | CAT-04 | End-to-end feel | Multi-select metrics → Carregar → table appears in Estatística | ⏳ human_needed |

---

## Locked resolutions (from RESEARCH)

- Mapas default year = latest non-null for active variable
- Commit catalog assets in git
- `catalog:validate` in `pretest`

---

## Validation Sign-Off

- [ ] All tasks have automated verify
- [ ] Sampling continuity OK
- [ ] `nyquist_compliant: true` after Wave 1–2 assets exist

**Approval:** pending execution

---

*Phase: 05-variaveis-no-site-scrape-referencias*
