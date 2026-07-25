# Phase 1: Redesign / base React shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 1-Redesign / base React shell
**Areas discussed:** Layout do shell, Abas futuras / rotas, Paste + DataSUS wizard, Demo do fluxo, Wizard qual teste, Tom visual cult-ui, Mapas research pipeline

---

## Layout do shell

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar fixa | MVP-like fixed left nav | |
| Cards no conteúdo | Tests as cards | |
| Sidebar colapsável | MVP + collapse on small screens | ✓ |
| You decide | | |

**User's choice:** Sidebar colapsável; then freeform: full LACIR portal header; Estatística nav item; DataSUS inside Estatística; remove v1.0/Beta.

| Option | Description | Selected |
|--------|-------------|----------|
| Só logo + Estatística | No ghost links | (superseded) |
| Header full set | Evolved via freeform | ✓ |

**Final header:** Logo+nome · Estatística · Meta-análise · Variáveis · Mapas

**Notes:** Mapas coupled to research; Estatística standalone. Catálogo renamed Variáveis.

---

## Abas futuras / rotas

| Option | Description | Selected |
|--------|-------------|----------|
| Estatística only + em breve pages | | |
| All routes real layout + placeholder | | ✓ |
| Only Estatística navigable | | |
| You decide | | |

**Landing:** Estatística

---

## Paste + DataSUS wizard

| Option | Description | Selected |
|--------|-------------|----------|
| Textarea+CSV simple | | |
| Textarea+upload+DataSUS wizard | Max format tolerance | ✓ |
| Textarea only | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect → preview → confirm | | ✓ |
| Explicit step wizard | | |
| You decide | | |

**Notes:** Must tolerate raw DataSUS table copy-paste.

---

## Demo do fluxo

| Option | Description | Selected |
|--------|-------------|----------|
| Stub Teste demo | | ✓ |
| Advance one real test | | |
| Empty UI until Phase 2 | | |
| You decide | | |

---

## Wizard qual teste

| Option | Description | Selected |
|--------|-------------|----------|
| Modal + short tree | | ✓ |
| Permanent side panel | | |
| Dedicated route | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full roadmap + em breve | | ✓ |
| Only available tests | | |
| You decide | | |

---

## Tom visual cult-ui

| Option | Description | Selected |
|--------|-------------|----------|
| Sóbrio médico | | |
| Equilibrado | Subtle motion/texture; clean data areas | ✓ |
| Mais cult-ui | | |
| You decide | | |

**Green:** Clinical teal (~#10b981)

**Refresh warning:** No persistent banner. `beforeunload` only on Estatística if data already inputted.

---

## Mapas research pipeline

**User clarification:** Hover → vars for location; click locks UF; multi-UF → intersection first, partials at end with alerts; multi-var select; Iniciar pesquisa → possible tests + collection links + paste modal → continue. Estatística optional path.

| Option | Phase 1 fidelity | Selected |
|--------|------------------|----------|
| Faithful layout + mock + stub Iniciar pesquisa | | ✓ |
| Static wireframe only | | |

---

## Claude's Discretion

- Exact teal tokens / cult-ui component picks
- Demo chart specifics
- Router implementation details

## Deferred Ideas

- Extra LACIR header areas
- Full Mapas data (Phase 4)
- REQUIREMENTS UI-01 / UI-05 wording sync in plan-phase
