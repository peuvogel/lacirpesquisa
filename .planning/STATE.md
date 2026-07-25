---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: Plan 01-11 executed — Iniciar pesquisa stub, collection links, paste handoff
stopped_at: Completed 01-11-PLAN.md
last_updated: "2026-07-25T18:29:00.000Z"
last_activity: 2026-07-25 — Plan 01-11 executed (IniciarPesquisaModal, suggestResearchForSelection)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 12
  completed_plans: 11
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25)

**Core value:** Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.
**Current focus:** Phase 1 — In progress (11/12 plans complete)

## Current Position

Phase: 1 of 6 (Redesign / base React shell)
Plan: 01-01 through 01-11 complete (12 plans total) — 01-12 pending
Status: Plan 01-11 executed — Iniciar pesquisa stub, collection links, paste handoff
Last activity: 2026-07-25 — Plan 01-11 executed (IniciarPesquisaModal, suggestResearchForSelection)

Progress: [█████████░] 92%

## Accumulated Context

### Decisions

- Portal LACIR: header Estatística | Meta-análise | Variáveis | Mapas
- Mapas = research launcher (hover/multi-UF/vars/iniciar pesquisa); Estatística standalone
- Paste máximo + auto-detect → preview → confirm
- Stub Teste demo na Fase 1; wizard modal; visual equilibrado teal
- beforeunload só em Estatística com dados; sem banner
- Não reinventar engines (JASP + MVP)
- [Phase 1]: shadcn primitives generated on Radix (not Base UI) to match UI-SPEC accessibility assumptions
- [Phase 1]: @vitejs/plugin-react@^6.0 used instead of plan's ^4.5 pin — required for vite@^8.1 peer compatibility
- [Phase 1]: chartTheme.ts retints only COLORS.primary and COLORS.background to teal per D-16/UI-SPEC; all other v1.0 chart rgba literals ported unchanged
- [Phase 1]: ChartCanvas owns Chart.js instance via one useEffect (destroy-before-recreate, destroy-on-unmount), replacing the legacy global Map registry
- [Phase 01]: theme.css is the single source for LACIR tokens; shadcn --color-accent/--color-border/--color-destructive remap removed from index.css to avoid circular refs / silent teal override
- [Phase 01]: :root carries dark values directly (app never toggles .dark class); shadcn primitives would otherwise render light-mode OKLCH grays
- [Phase 01]: parseTabular.ts/datasusImporter.ts/datasusNormalizer.ts ported byte-for-byte to TS with differential parity suites against assets/js/*.js over 3 hand-authored TABNET fixtures
- [Phase 01]: datasus-importer.js's splitDelimitedLine and tabular-data-input.js's splitDelimitedLine kept as two separate, undeduplicated implementations (tuned for different input shapes)
- [Phase 01]: TABNET fixtures hand-authored (no raw messy export found under trabalhos datasus/ — all pre-cleaned by coleta_* scripts)
- [Phase 01]: normalizer's Phase 2+ stat-derivation functions (deriveIndependentTTest/derivePairedTTest/deriveCorrelationPairs/derivePraisSeries) ported and typed but numerically unverified — Phase 2 parity work still needed
- [Phase 01]: SessionProvider derives hasData every render (never stored as its own state) so it can't go stale for the 01-07 leave-warning
- [Phase 01]: added src/app/RouteError.tsx as the router's errorElement (T-01-ROUTE mitigation) — catches both render errors and unmatched paths
- [Phase 01]: deleted src/App.tsx and src/test/smoke.test.tsx — router.test.tsx is now the sole boot-level test
- [Phase 01]: useTabularInput reshapes RecognizedColumn objects to Record<string, number> (index-only); error shape passes through unreshaped per 01-PATTERNS.md
- [Phase 01]: ColumnPreviewTable auto-detects column role from actual cell values, not from recognizedColumns/domain aliases, to stay generic across future test modules
- [Phase 01]: TabularInputPanel textarea stays enabled during parsing (deviates from literal UI-SPEC disabled-while-parsing); inline status indicator lives in preview area instead
- [Phase 01]: TEST_REGISTRY is the single source of truth for sidebar and modal — Prevents Pitfall 4 drift between sidebar and modal roadmap
- [Phase ?]: TEST_REGISTRY is the single source of truth for sidebar and modal — Prevents Pitfall 4 drift between sidebar and modal roadmap
- [Phase 01]: IBGE Malhas SVG committed as sanitized brazilUfPaths data; cartogram fallback not needed
- [Phase 01]: Step 4 variable types editable per column (D-08 expanded) — React port improves on legacy read-only type summary
- [Phase 01]: useDatasusWizard publishes DatasusSession via onSessionChange; no window.__LACIR_SHARED__ writes (01-10 wires SessionProvider)
- [Phase 01]: TabularInputPanel showPreview=false defers ColumnPreviewTable to Configurar in TesteDemo flow
- [Phase 01]: ResultsPanel is the Phase 2/3 reusable Resultados shell (metrics, chart, interpretation, PNG)
- [Phase 01]: Teste demo stub uses honest descriptive stats only — buildDemoInterpretation disclaims significance testing
- [Phase 01]: MAPAS_TABULAR_OPTIONS uses broad territorio/medida aliases so junk paste errors while typical TABNET tables still load
- [Phase 01]: Iniciar pesquisa continue requires loaded paste with ≥2 columns and ≥1 data row — not loaded status alone

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-07-25T18:29:00.000Z
Stopped at: Completed 01-11-PLAN.md
Resume file: None

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 01 P03 | ~10 min | 3 tasks | 12 files |
| Phase 01 P04 | 15 min | 3 tasks | 7 files |
| Phase 01 P02 | 40min | 2 tasks | 3 files |
| Phase 01 P05 | ~30 min | 3 tasks | 16 files |
| Phase 01 P06 | 25min | 3 tasks | 8 files |
| Phase 01-redesign-base-react-shell P07 | 25min | 3 tasks | 9 files |
| Phase 01-redesign-base-react-shell P08 | 25min | 3 tasks | 8 files |
| Phase 01-redesign-base-react-shell P09 | 25min | 3 tasks | 11 files |
| Phase 01-redesign-base-react-shell P10 | 25min | 3 tasks | 12 files |
| Phase 01-redesign-base-react-shell P11 | 25min | 2 tasks | 6 files |
