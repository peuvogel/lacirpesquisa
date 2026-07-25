---
phase: 4
slug: mapas-como-interface-estatistica
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
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
| 04-01-* | 01 | 0 | MAP-05 | unit | `npm run test:run -- src/geo/` | ❌ W0 | ⬜ |
| 04-02-* | 02 | 1 | MAP-01 | unit+RTL | `npm run test:run -- src/routes/mapas/` | ❌ | ⬜ |
| 04-03-* | 03 | 2 | MAP-02 | unit | `npm run test:run -- src/geo/matchTerritoryLabels` | ❌ | ⬜ |
| 04-04-* | 04 | 3 | MAP-07/08/10 | RTL | `npm run test:run -- GroupBar SelectionSummary` | ❌ | ⬜ |
| 04-05-* | 05 | 4 | MAP-03/04/05 | unit+RTL | `npm run test:run -- src/geo/ src/routes/mapas/` | ❌ | ⬜ |
| 04-06-* | 06 | 5 | MAP-06 | unit+RTL | `npm run test:run -- mapAnalysisState GroupConfig` | ❌ | ⬜ |
| 04-07-* | 07 | 6 | MAP-09 | integration | `npm run test:run -- ReviewAnalysis EstatisticaPage` | ❌ | ⬜ |
| 04-08-* | 08 | 7 | MAP-01…10 | full suite | `npm run test:run` | ❌ | ⬜ |

---

## Wave 0 Requirements

- [ ] `scripts/fetch-geo-assets.mjs` (+ simplified sample TopoJSON fixtures for CI)
- [ ] `src/geo/types.ts`, `territoryCatalog.ts`, `matchTerritoryLabels.ts` stubs/tests
- [ ] `mapAnalysisState` types + SessionProvider extension tests
- [ ] Fixture TopoJSON for ≥1 UF (e.g. BA or SP) committed for offline tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glow + drag-to-group feel | MAP-07/10 | Motion/DnD UX | Select 3 UFs, drag to Group zone, rename |
| Drill-down visual choropleth | MAP-03 | Canvas quality | Drill BA → municípios, check legend |
| Review copy for lay audience | MAP-10 | Teaching tone | Read summary + review dialog PT |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 deps
- [ ] Sampling continuity OK
- [ ] `nyquist_compliant: true` when Wave 0 done

**Approval:** pending
