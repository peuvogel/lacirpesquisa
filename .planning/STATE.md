---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: Plan 01-04 executed and committed — chart theme, ChartCanvas lifecycle wrapper, PNG export hook (UI-04), pt-BR format helpers all green
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-07-25T17:27:26.705Z"
last_activity: 2026-07-25 — Plan 01-04 executed (chartTheme/ChartCanvas/useChartExport/format.ts)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 12
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25)

**Core value:** Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.
**Current focus:** Phase 1 — In progress (2/12 plans complete)

## Current Position

Phase: 1 of 6 (Redesign / base React shell)
Plan: 01-01 and 01-04 complete (12 plans total, wave-based execution) — 01-02/01-03/01-05+ still pending
Status: Plan 01-04 executed and committed — chart theme, ChartCanvas lifecycle wrapper, PNG export hook (UI-04), pt-BR format helpers all green
Last activity: 2026-07-25 — Plan 01-04 executed (chartTheme/ChartCanvas/useChartExport/format.ts)

Progress: [██░░░░░░░░] 17%

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-07-25T17:27:26.703Z
Stopped at: Completed 01-02-PLAN.md
Resume file: None

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 01 P04 | 15 min | 3 tasks | 7 files |
| Phase 01 P02 | 40min | 2 tasks | 3 files |
