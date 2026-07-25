# Phase 3: Testes clássicos + GLM novos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 3-Testes clássicos + GLM novos
**Areas discussed:** Ordem de entrega, Nudges de pressupostos, Entrada/Configurar, Pós-hoc e tabelas, Motor numérico
**Mode:** User selected all areas and deferred decisions to Claude (didactic + JASP reuse + economy)

---

## Ordem de entrega

| Option | Description | Selected |
|--------|-------------|----------|
| Uma onda só | Seis testes em paralelo sem ordem didática | |
| Duas ondas (clássicos → GLM) | Wave A frequencies/groups, Wave B GLM | ✓ |
| Seis ondas isoladas | Um teste por plan isolado | |

**User's choice:** Claude decide (economia + didática)
**Notes:** Wave A then B matches capacitação and unlocks usable tests earlier.

---

## Nudges de pressupostos (UX-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Soft nudge strip | Avisos sem bloquear resultado | ✓ |
| Hard gate | Bloqueia análise se pressuposto falha | |
| Painel modal só | Pressupostos só em modal separado | |

**User's choice:** Claude decide
**Notes:** Soft strip + type/distribution-aware tips; cross-link Poisson→NB and ANOVA→Kruskal.

---

## Entrada de dados / Configurar

| Option | Description | Selected |
|--------|-------------|----------|
| Colunas longas + roles | Crosstab/GLM a partir do paste (padrão Phase 1–2) | ✓ |
| Só matriz de contingência | χ² exige tabela agregada | |
| Wizard GLM completo | Interações, offsets, stepwise | |

**User's choice:** Claude decide
**Notes:** Didactic subset: main effects only; χ² from two categoricals.

---

## Pós-hoc e tabelas

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela pairwise + heatmap se ≤6 grupos | Primário tabela; heatmap opcional | ✓ |
| Só heatmap | | |
| Só lista longa sem estrutura | | |

**User's choice:** Claude decide

---

## Motor numérico

| Option | Description | Selected |
|--------|-------------|----------|
| TS port + oráculo JASP (sem R no browser) | Extender statsEngine; golden vs JASP | ✓ |
| Embutir R/WASM | | |
| Lib estatística pesada por padrão | | |

**User's choice:** Claude decide — “se JASP já tem, pegue dele”; economia máxima
**Notes:** Modules referenced: jaspFrequencies, jaspAnova, jaspRegression.

---

## Claude's Discretion

All five areas — user explicitly asked Claude to choose the best didactic/economical path.

## Deferred Ideas

- Fisher exact as full module; GLM interactions; multi-way ANOVA; Bayesian options
