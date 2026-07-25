---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Suite estatística + mapas DataSUS
status: planning
last_updated: "2026-07-25T15:09:00.000Z"
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
**Current focus:** Phase 1 — Redesign / base React shell

## Current Position

Phase: 1 of 6 (Redesign / base React shell)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-07-25 — Roadmap created (6 phases, 29/29 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

- Reescrever em React + Vite + Tailwind + shadcn/cult-ui
- Mapas 100% client-side (GeoJSON)
- Meta-análise por último; incluir qui-quadrado; mapas com municípios/meso/regiões de saúde
- Sem backend/login neste milestone
- **Não reinventar engines:** portar/adaptar lógica do JASP (`jasp-desktop-development/`) + MVP `tests/`; foco do trabalho = interface didática
- Build order travado: shell → migrar testes → testes novos/GLM → mapas → catálogo → meta-análise (ROADMAP.md)
- UX-01 (árvore de decisão) mapeado na Fase 1; UX-02 (nudges de premissas) mapeado na Fase 3

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-07-25
Stopped at: ROADMAP.md created — ready for `/gsd:plan-phase 1`
Resume file: None
