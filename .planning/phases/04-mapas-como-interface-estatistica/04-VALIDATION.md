---
phase: 4
slug: mapas-como-interface-estatistica
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-25
verified: 2026-07-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + @testing-library/react 16.3.2 |
| **Config file** | `vite.config.ts` (`test` block) |
| **Quick run command** | `npm run test:run -- src/routes/mapas/ src/geo/` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~20–60 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run test:run -- src/routes/mapas/ src/geo/`
- **After every plan wave:** `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-* | 01 | 0 | MAP-05 | unit | `npm run test:run -- src/geo/` | ✅ | ✅ |
| 04-02-* | 02 | 1 | MAP-01 | unit+RTL | `npm run test:run -- src/routes/mapas/` | ✅ | ✅ |
| 04-03-* | 03 | 2 | MAP-02 | unit | `npm run test:run -- src/geo/matchTerritoryLabels` | ✅ | ✅ |
| 04-04-* | 04 | 3 | MAP-07/08/10 | RTL | `npm run test:run -- GroupBar SelectionSummary` | ✅ | ✅ |
| 04-05-* | 05 | 4 | MAP-03/04/05 | unit+RTL | `npm run test:run -- src/geo/ src/routes/mapas/` | ✅ | ✅ |
| 04-06-* | 06 | 5 | MAP-06 | unit+RTL | `npm run test:run -- mapAnalysisState GroupConfig` | ✅ | ✅ |
| 04-07-* | 07 | 6 | MAP-09 | integration | `npm run test:run -- ReviewAnalysis EstatisticaPage` | ✅ | ✅ |
| 04-08-* | 08 | 7 | MAP-01…10 | full suite | `npm run test:run` | ✅ | ✅ |

---

## Wave 0 Requirements

- [x] `scripts/fetch-geo-assets.mjs` (+ simplified sample TopoJSON fixtures for CI)
- [x] `src/geo/types.ts`, `territoryCatalog.ts`, `matchTerritoryLabels.ts` stubs/tests
- [x] `mapAnalysisState` types + SessionProvider extension tests
- [x] Fixture TopoJSON for ≥1 UF (e.g. BA or SP) committed for offline tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Glow + drag-to-group feel | MAP-07/10 | Motion/DnD UX | Select 3 UFs, drag to Group zone, rename | ⏳ human_needed |
| Drill-down visual choropleth | MAP-03 | Canvas quality | Drill BA → municípios, check legend | ⏳ human_needed |
| Review copy for lay audience | MAP-10 | Teaching tone | Read summary + review dialog PT | ⏳ human_needed |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 deps
- [x] Sampling continuity OK
- [x] `nyquist_compliant: true` when Wave 0 done

**Approval:** automated gate passed 2026-07-25 — human UX spot-check deferred (see 04-VERIFICATION.md Human Notes)

---

## Gate Run Output (2026-07-25)

```
npm run test:run -- src/geo/          → 5 files, 46 tests PASS
npm run test:run -- src/routes/mapas/ → 15 files, 115 tests PASS
npm run test:run                      → 83 files, 595 tests PASS
npm run typecheck                     → exit 0
npm run build                         → exit 0
```
