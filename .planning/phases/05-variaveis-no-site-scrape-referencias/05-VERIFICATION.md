---
phase: 5
slug: variaveis-no-site-scrape-referencias
verdict: PASS
automated: PASS
human_ux: human_needed
verified: 2026-07-25
plan: 05-07
suite:
  files: 90
  tests: 652
---

# Phase 5 — Goal-Backward Verification

**Verdict:** PASS (automated gate) — classroom UAT **deferred** (`human_needed`)

---

## Automated Gate Output

| Command | Result | Detail |
|---------|--------|--------|
| `npm run catalog:validate` | ✅ PASS | provenance gate passed (`public/data/catalog`) |
| `npm run test:run` | ✅ PASS | **90** files, **652** tests |
| `npm run typecheck` | ✅ PASS | exit 0 |
| `npm run build` | ✅ PASS | `tsc -b && vite build` exit 0 |

### Grep / structural gates

| Gate | Result | Evidence |
|------|--------|----------|
| No runtime fetch to DATASUS/IBGE under `src/` | ✅ PASS | `loadCatalog.ts` only fetches `/data/catalog/*`; FORBIDDEN_HOST guard; no `fetch(` to tabnet/sidra/servicodados |
| Hosts in `src/` are citation/test/comment only | ✅ PASS | Provenance URLs in fixtures + `PortalDatasusLink` didactic link; comment in `brazilUfPaths.ts`; `mockCollectionLinks` display URLs |
| `PlaceholderShell` not used by Variáveis | ✅ PASS | `router.tsx` → `VariaveisPage`; Meta-análise still uses PlaceholderShell |
| Mapas pack values ≠ didactic mock weight | ✅ PASS | `ChoroplethLegend.test.tsx` asserts `mock.internacoes` alias → SP > 0 and ≠ 898000 |
| No `provenance: 'mock'` for catalog Mapas path | ✅ PASS | no `provenance: 'mock'` literals under `src/routes/mapas` |
| No "Em breve" on `/variaveis` | ✅ PASS | `VariaveisPage.test.tsx` asserts heading absent |

---

## Goal-Backward Truths (ROADMAP Phase 5)

| # | ROADMAP Success Criterion | Evidence | Status |
|---|---------------------------|----------|--------|
| 1 | Search/browse panel classified by type | `VariaveisPage.test.tsx` filters/search; `filterCatalog.test.ts`; 32 catalog entries with `variableType` | ✅ PASS |
| 2 | Every entry shows mandatory provenance | `catalog:validate` fail-closed; `VariableDetailPanel` + `VariaveisPage.test.tsx` provenance fields; `validateCatalogEntry.test.ts` | ✅ PASS |
| 3 | Suggested statistical test hint by type | `suggestTestForVariable.test.ts`; SuggestedTestCard in detail panel tests | ✅ PASS |
| 4 | Load curated datasets into Estatística/Mapas in-app | `buildSessionDataset.test.ts`; `VariaveisPage.test.tsx` handoff; `MapasPage.test.tsx` catalogVariableIds | ✅ auto / ⏳ human classroom flow |
| 5 | Versioned offline pipeline (build-time assets) | `scripts/catalog/*`; committed `public/data/catalog/{manifest,variables,packs/*}`; `loadCatalog.test.ts` offline gate | ✅ PASS |

---

## Requirement Coverage (CAT-01…CAT-05)

| Requirement | Plans | Primary Test Evidence | Status |
|-------------|-------|----------------------|--------|
| CAT-01 | 05-03, 05-04 | `filterCatalog.test.ts`, `VariaveisPage.test.tsx` | ✅ PASS |
| CAT-02 | 05-02, 05-04 | `npm run catalog:validate`, `validateCatalogEntry.test.ts`, detail panel RTL | ✅ PASS |
| CAT-03 | 05-03, 05-04 | `suggestTestForVariable.test.ts`, SuggestedTestCard RTL | ✅ PASS |
| CAT-04 | 05-03, 05-05, 05-06 | `buildSessionDataset.test.ts`, `catalogAnalysisData.test.ts`, handoff RTL | ✅ auto / ⏳ human UAT |
| CAT-05 | 05-01, 05-02 | `catalog:build` assets, `loadCatalog.test.ts`, pretest → `catalog:validate` | ✅ PASS |

**Catalog inventory (gate time):** 2 packs (`sih.embolia_trombose_uf`, `sih.amputacao_mmii_uf`), **32** variables (**14** loadable / **18** reference-only).

---

## Locked Decisions Audit (D-01…D-19)

| ID | Decision | Audit | Status |
|----|----------|-------|--------|
| D-01 | Ingest from `trabalhos datasus/` as SoT | `scripts/catalog/build.mjs` + packs from coletas | ✅ PASS |
| D-02 | No mock numerics for pack variables | `catalogAnalysisData` + Choropleth SP≠898000 | ✅ PASS |
| D-03 | Regenerate path without mandatory re-scrape | `npm run catalog:build` documented in RESEARCH/summaries | ✅ PASS |
| D-04 | Loadable metrics + curated reference slice | 14 loadable + 18 reference | ✅ PASS |
| D-05 | Mandatory provenance fields | validate schema + UI block | ✅ PASS |
| D-06 | UI never shows orphan; validate fails closed | `catalog:validate` + incomplete EmptyState | ✅ PASS |
| D-07 | Retire `provenance: 'mock'` for catalog Mapas | no mock provenance literals in mapas routes | ✅ PASS |
| D-08 | Pipeline → `public/data/catalog/` | committed manifest/variables/packs | ✅ PASS |
| D-09 | Zero runtime DATASUS/IBGE network | loadCatalog path + host forbid | ✅ PASS |
| D-10 | `catalog:build` / `catalog:validate` + pretest | `package.json` scripts | ✅ PASS |
| D-11 | Real Variáveis page (not PlaceholderShell) | `VariaveisPage.tsx` | ✅ PASS |
| D-12 | Dark/teal list+detail composition | RTL structure; visual human_needed | ✅ auto / ⏳ human |
| D-13 | `suggestTestForVariable` + hint card | unit + RTL | ✅ PASS |
| D-14 | Carregar na Estatística → SessionDataset | `buildSessionDataset` + navigate tests | ✅ PASS |
| D-15 | Usar no mapa → catalog variable IDs | `MapasPage` APPLY_CATALOG_VARIABLE_IDS | ✅ PASS |
| D-16 | Multi-select same-pack / key match | `assertCompatibleSelection` tests | ✅ PASS |
| D-17 | UF×ano grain for v1 packs | pack schemas / buildSessionDataset | ✅ PASS |
| D-18 | `catalogAnalysisData` replaces mock metrics | alias + pack series tests | ✅ PASS |
| D-19 | Years from pack intersection / non-null | `catalogAnalysisData` year helper tests | ✅ PASS |

**Locked decisions:** 19/19 covered by automated evidence (D-12 visual tone remains human_needed).

### Deferred Ideas (CONTEXT — not phase blockers)

| Idea | Disposition |
|------|-------------|
| Continuous CI scrape refresh of all TABNET forms | deferred-with-reason (REQUIREMENTS v2 OOS) |
| Full município-level packs in-app | deferred-with-reason (raw HTML offline tools only) |
| Live OpenDataSUS API from browser | deferred-with-reason (contradicts D-09) |
| Auto-join arbitrary cross-source indicators | deferred-with-reason (D-16 key-match only) |

---

## Human UAT — Variáveis classroom flow

**Status:** `human_needed` (blocking checkpoint Task 2 — not auto-approved)

| # | Step | Expected | Status |
|---|------|----------|--------|
| 1 | `npm run dev` → `/variaveis` | Real catalog UI, no Em breve | ⏳ human_needed |
| 2 | Search/filter loadable vascular var | Provenance: sistema, tabela/indicador, período, URL, notas | ⏳ human_needed |
| 3 | Detail panel | SuggestedTestCard visible | ⏳ human_needed |
| 4 | Multi-select 2 embolia metrics → Carregar na Estatística | Catálogo sourceLabel; no TABNET visit | ⏳ human_needed |
| 5 | Usar no mapa | Choropleth from real series (SP not tiny didactic weight) | ⏳ human_needed |
| 6 | Reference-only entries | Browseable, not loadable, clear UX | ⏳ human_needed |

**Resume signal:** type `approved` or list issues.

### Acceptance criteria (pending human)

- [ ] Provenance always visible for selected variables
- [ ] Estatística load works offline from catalog packs
- [ ] Mapas reflects catalog values for aliased/loadable vars
- [ ] No Em breve on `/variaveis`

---

## Threat mitigations (05-07 register)

| Threat | Disposition | Evidence |
|--------|-------------|----------|
| T-05-14 Spoofing (shipped catalog) | mitigate | `catalog:validate` in gate + pretest |
| T-05-15 Live scrape disclosure | mitigate | grep/loadCatalog host forbid |
| T-05-SC npm installs | accept | No new packages in 05-07 |

---

## Plans Executed

| Plan | Summary | Role |
|------|---------|------|
| 05-01 | Packs + reference-seed → `public/data/catalog` | CAT-05 assets |
| 05-02 | Types + fail-closed validate + pretest | CAT-02/05 gate |
| 05-03 | loadCatalog / filter / suggest / buildSession | CAT-01/03/04 modules |
| 05-04 | Variáveis UI | CAT-01/02/03 UX |
| 05-05 | Mapas catalogAnalysisData swap | CAT-02/04 Mapas |
| 05-06 | Estatística + Mapas handoff | CAT-04 load |
| 05-07 | Phase gate (this doc) | Full suite + audit |

---

*Phase: 05-variaveis-no-site-scrape-referencias*
*Verified: 2026-07-25*
