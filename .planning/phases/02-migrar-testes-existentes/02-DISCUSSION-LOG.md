# Phase 2: Migrar testes existentes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 2-Migrar testes existentes
**Areas discussed:** Shell vs legacy UI, Parity bar, t-Student modes, Fate of Teste demo

---

## Shell vs legacy UI

| Option | Description | Selected |
|--------|-------------|----------|
| Shared shell | Dados→Configurar→Resultados + ResultsPanel; legacy = math/interpretation | ✓ |
| Faithful legacy port | Recreate guided multi-panel wizards from module.js | |
| You decide | | |

**User's choice:** Shared shell

| Option | Description | Selected |
|--------|-------------|----------|
| Full legacy knobs | α, question, mode/method, DataSUS derive options | ✓ |
| Core knobs only | Mode/roles; α fixed 0.05 | |
| You decide | | |

**User's choice:** Full legacy knobs

| Option | Description | Selected |
|--------|-------------|----------|
| Both didactic cards + Usar exemplo | Cards in Configurar; exemplo on Dados | ✓ |
| Example only | | |
| Cards only | | |
| You decide | | |

**User's choice:** Both in-flow

| Option | Description | Selected |
|--------|-------------|----------|
| Same chart kinds + teal | | |
| Pixel-faithful / richer visuals | | ✓ (expanded) |
| You decide | | |

**User's choice:** Freeform on option 2 — wants diverse, highly customizable, professional charts

| Option | Description | Selected |
|--------|-------------|----------|
| Per-test chart suite | Switchable variants + sensible controls | |
| Deep customize now | Chart type, axes, annotations, themes beyond brand | ✓ |
| You decide Phase 2 cut | | |

**User's choice:** Deep customize now
**Notes:** Scope expansion accepted inside Phase 2 for migrated tests; demo stays simple (decided later).

---

## Parity bar

| Option | Description | Selected |
|--------|-------------|----------|
| Numbers + interpretation | Charts may be richer if values correct | ✓ |
| Full visual + numeric twin | | |
| JASP as second oracle | | |

**User's choice:** Numbers + interpretation

| Option | Description | Selected |
|--------|-------------|----------|
| Display-rounded | Compare as shown in UI | ✓ |
| Raw float / near-exact | | |
| You decide | | |

**User's choice:** Display-rounded

| Option | Description | Selected |
|--------|-------------|----------|
| Legacy examples + one TABNET case | Differential vs tests/*/module.js | ✓ |
| Examples only | | |
| Broad edge suite | | |

**User's choice:** Examples + one TABNET-style fixture

| Option | Description | Selected |
|--------|-------------|----------|
| Same conclusion + key numbers | Light wording cleanup OK | ✓ |
| Byte-identical paragraph | | |
| You decide | | |

**User's choice:** Same conclusion + key numbers

---

## t-Student modes

| Option | Description | Selected |
|--------|-------------|----------|
| One sidebar entry + Configurar choice | | ✓ |
| Two sidebar entries | | |
| You decide | | |

**User's choice:** One entry + Configurar choice cards

| Option | Description | Selected |
|--------|-------------|----------|
| Default t independente | | ✓ |
| Default t pareado | | |
| Force choice (no default) | | |

**User's choice:** Default t independente

| Option | Description | Selected |
|--------|-------------|----------|
| Keep data; reset mode-specific config + results | | ✓ |
| Hard reset all | | |
| Keep everything | | |

**User's choice:** Soft reset on mode switch

| Option | Description | Selected |
|--------|-------------|----------|
| Label t independente (Welch) | Always Welch; no variance toggle | ✓ |
| Silent Welch | | |
| User Welch vs equal-variance toggle | | |

**User's choice:** Label clearly (Welch)

---

## Fate of Teste demo

| Option | Description | Selected |
|--------|-------------|----------|
| Keep available under Demonstração | | ✓ |
| Hide from sidebar; keep route | | |
| Remove entirely | | |

**User's choice:** Keep available

| Option | Description | Selected |
|--------|-------------|----------|
| Default landing = Teste demo | | ✓ |
| Default = t de Student | | |
| None selected | | |

**User's choice:** Land on Teste demo

| Option | Description | Selected |
|--------|-------------|----------|
| Wizard lists demo as demonstração | | ✓ |
| Omit demo from wizard | | |
| Same as any available test | | |

**User's choice:** Still listed, clearly demonstração

| Option | Description | Selected |
|--------|-------------|----------|
| Demo charts stay simple | Deep customize only on real tests | ✓ |
| Same chart power everywhere | | |
| You decide | | |

**User's choice:** Keep demo charts simple

---

## Claude's Discretion

- Correlação: one registry entry + Pearson/Spearman in Configurar (not discussed explicitly; locked as discretion mirroring t-Student)
- Prais Configurar layout details
- Chart library choice for deep customize surface
- Engine wiring: wrap `module.js` vs verify `derive*` first

## Deferred Ideas

- Equal-variance Student toggle
- JASP as mandatory acceptance oracle
- Broad edge-case fixture library
- Removing Teste demo
- Phase 3+ new tests / maps / catalog / meta-análise
