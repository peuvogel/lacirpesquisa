---
phase: 5
slug: variaveis-no-site-scrape-referencias
status: signed_off_automated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-25
updated: 2026-07-25
gate_plan: 05-07
suite_files: 90
suite_tests: 652
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Wave 6 (05-07) signed off automated paths; classroom UAT remains `human_needed`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react |
| **Config file** | `vite.config.ts` (`test` block) |
| **Quick run command** | `npm run catalog:validate && npm run test:run -- src/features/catalog/ src/routes/variaveis/` |
| **Full suite command** | `npm run catalog:validate && npm run test:run && npm run typecheck && npm run build` |
| **Estimated runtime** | ~30–90 seconds (full suite ~35s + typecheck/build) |
| **Gate result (05-07)** | ✅ catalog:validate · ✅ 90 files / 652 tests · ✅ typecheck · ✅ build |

---

## Sampling Rate

- **After every task commit:** targeted tests for touched modules + `catalog:validate` when assets/schema change
- **After every plan wave:** `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite green + `catalog:validate` pass + human UAT notes
- **Max feedback latency:** 120 seconds

---

## Phase Requirements → Test Map (Nyquist)

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| CAT-01 | Filters/search return typed entries | component | `npm run test:run -- src/routes/variaveis/VariaveisPage.test.tsx` | ✅ | ✅ covered |
| CAT-02 | Missing officialUrl fails validate; UI shows provenance | unit + CLI + component | `npm run catalog:validate` + `validateCatalogEntry.test.ts` + detail RTL | ✅ | ✅ covered |
| CAT-03 | `suggestTestForVariable` maps types → registry ids | unit + component | `suggestTestForVariable.test.ts` + Variáveis detail | ✅ | ✅ covered |
| CAT-04 | SessionDataset + Mapas pack metrics (SP real series) | unit + RTL | `buildSessionDataset.test.ts` + `catalogAnalysisData.test.ts` + handoff tests | ✅ | ✅ covered (UAT human_needed) |
| CAT-05 | Manifest/packs present; no network in loadCatalog | unit + script | `catalog:validate` + `loadCatalog.test.ts` | ✅ | ✅ covered |
| D-19 | Rate var year list excludes null years | unit | `catalogAnalysisData.test.ts` | ✅ | ✅ covered |
| D-07 | Mapas provenance not `'mock'` for catalog vars | unit + grep | Mapas tests + no `provenance: 'mock'` in `src/routes/mapas` | ✅ | ✅ covered |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | CAT-05 | script/assert | `npm run catalog:build` + pack row counts | ✅ | ✅ |
| 05-02-* | 02 | 2 | CAT-02/05 | unit+CLI | `npm run catalog:validate` | ✅ | ✅ |
| 05-03-* | 03 | 3 | CAT-01/03/04 | unit TDD | `npm run test:run -- src/features/catalog/` | ✅ | ✅ |
| 05-04-* | 04 | 4 | CAT-01/02/03 | RTL | `npm run test:run -- src/routes/variaveis/` | ✅ | ✅ |
| 05-05-* | 05 | 4 | CAT-02/04 | unit+RTL | `npm run test:run -- src/features/catalog/catalogAnalysisData.test.ts src/routes/mapas/` | ✅ | ✅ |
| 05-06-* | 06 | 5 | CAT-04 | RTL/integration | `npm run test:run -- src/routes/variaveis/VariaveisPage.test.tsx src/routes/mapas/MapasPage.test.tsx` | ✅ | ✅ |
| 05-07-* | 07 | 6 | CAT-01…05 | full suite | `npm run catalog:validate && npm run test:run && npm run typecheck && npm run build` | ✅ | ✅ |

---

## Wave 0 / Wave 1 Prerequisites

- [x] `scripts/catalog/build.mjs` + columnMap + reference-seed
- [x] Committed `public/data/catalog/{manifest,variables,packs/*}`
- [x] Schema types + `catalog:validate` fail-closed on orphan provenance
- [x] Coleta scripts use repo-relative `BASE_DIR`

**Wave 0 gaps:** closed (all RESEARCH Wave 0 items now exist on disk).

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

- [x] All tasks have automated verify
- [x] Sampling continuity OK
- [x] `nyquist_compliant: true` after Wave 1–2 assets exist
- [x] Full gate green at 05-07 (`catalog:validate` + 652 tests + typecheck + build)
- [ ] Human classroom UAT approved (Task 2 checkpoint)

**Approval:** automated paths signed off 2026-07-25 (05-07). Human UAT: `human_needed`.

---

*Phase: 05-variaveis-no-site-scrape-referencias*
