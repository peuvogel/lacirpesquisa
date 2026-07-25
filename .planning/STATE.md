---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Suite estatística + mapas DataSUS
status: discussing
last_updated: "2026-07-25T15:15:00.000Z"
last_activity: 2026-07-25
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25)

**Core value:** Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.
**Current focus:** Phase 1 — Redesign / base React shell (discussing)

## Current Position

Phase: 1 of 6 (Redesign / base React shell)
Plan: — (discussing before plan)
Status: Discussing phase 1
Last activity: 2026-07-25 — Starting /gsd-discuss-phase 1

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

- Reescrever em React + Vite + Tailwind + shadcn/cult-ui
- Mapas 100% client-side (GeoJSON / TopoJSON estático)
- Meta-análise por último; incluir qui-quadrado; mapas com municípios/meso/regiões de saúde
- Sem backend/login neste milestone
- Não reinventar engines: portar/adaptar lógica do JASP (`jasp-desktop-development/`) + MVP `tests/`; foco = interface didática
- Build order: shell → migrar testes → testes novos/GLM → mapas → catálogo → meta-análise
- UX-01 (árvore de decisão) na Fase 1; UX-02 (nudges de premissas) na Fase 3

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-07-25
Stopped at: Entering discuss-phase 1
Resume file: None
