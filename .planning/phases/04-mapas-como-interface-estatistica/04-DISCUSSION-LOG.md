# Phase 4: Mapas como interface estatística - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 4-Mapas como interface estatística
**Areas discussed:** Fluxo didático, Dados vs Fase 5, Geo/drill-down, Temporalidade (via painel), Grupos/seleção, Handoff → testes

---

## Fluxo didático

| Option | Description | Selected |
|--------|-------------|----------|
| A Stepper rígido | Território→Tempo→Agravos→Teste | |
| B Tela única estática | Painéis laterais sem gestos de grupo | |
| C / User vision | Tela única fluida + grupos por glow/drag + painel por grupo | ✓ |

**User's choice:** Detailed freeform vision (single screen, glowing borders, drag-to-group / create group, rename, panel for time then diseases). Hybrid “revisar” before analyze captured as D-03/D-20.
**Notes:** Audience = lay capacitação; maximize didactics and fluidity.

---

## Dados nesta fase vs Fase 5

| Option | Description | Selected |
|--------|-------------|----------|
| A Paste-only | | |
| B Mock-only until Phase 5 | | |
| C Hybrid mocks + optional paste | | ✓ |

**User's choice:** 2C

---

## Geo / drill-down

| Option | Description | Selected |
|--------|-------------|----------|
| A UF + macrorregiões only | | |
| B UF → município + macrorregiões | | |
| C Full MAP-03 (município + meso + macrorregião) | | ✓ |

**User's choice:** 3C

---

## Temporalidade

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed only | | |
| Range only | | |
| Fixed **or** period (+ compare when useful) | Embedded in group panel per user vision | ✓ |

**User's choice:** Described in freeform (fixed time or period); locked as D-10.

---

## Grupos e seleção

| Option | Description | Selected |
|--------|-------------|----------|
| Presets only | | |
| User vision (glow + drag zone + rename + presets/macros) | | ✓ |

**User's choice:** Freeform; presets N/NE/CO/SE/S + macrorregiões remain requirements.

---

## Handoff → testes

| Option | Description | Selected |
|--------|-------------|----------|
| A Suggest + go | | |
| B Choose test only on Mapas | | |
| C Suggest + allow change + assembled table handoff | | ✓ |

**User's choice:** 6C

---

## Claude's Discretion

- DnD vs buttons primacy; glow motion; panel chrome; lazy geo chunking; mock disease set; suggestion rule details.

## Deferred Ideas

- Phase 5 catalog replacement of mocks; census tracts; cloud projects
