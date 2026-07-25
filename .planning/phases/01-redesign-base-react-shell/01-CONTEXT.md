# Phase 1: Redesign / base React shell - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the LACIR portal React shell (dark + teal accents): global header/nav, route shells for Estatística / Meta-análise / Variáveis / Mapas, shared Dados→Configurar→Resultados flow with highly tolerant paste + DataSUS wizard, PNG export pattern, conditional leave-page warning, didactic interpretation slot, “qual teste?” modal wizard, and a demo stub test. Mapas in this phase is a **faithful interactive shell with mock data** (hover/select UFs, variable panel, iniciar-pesquisa stub)—full data wiring is Phase 4. Statistical engines stay ported from JASP/MVP later; this phase focuses on didactic UI structure.

**Requirements touched:** UI-01, UI-02, UI-03, UI-04, UI-05 (revised), UI-06, UX-01 — plus shell scaffolding for later MAP/CAT/META routes.

</domain>

<decisions>
## Implementation Decisions

### Portal IA & header
- **D-01:** Product is a **LACIR site shell**, not a single-purpose bioestat app. Header: **Logo + nome · Estatística · Meta-análise · Variáveis · Mapas**.
- **D-02:** No `v1.0 · Beta` (or similar) badge in the header.
- **D-03:** **Portal DATASUS** link lives **inside Estatística**, not in the global header.
- **D-04:** Landing route = **Estatística**.
- **D-05:** Inside Estatística, tests use a **collapsible left sidebar** (MVP pattern, collapses on small screens).

### Route shells (Phase 1 fidelity)
- **D-06:** All four nav routes get a **real layout shell** in Phase 1. Estatística is interactive (flow + demo). Meta / Variáveis / Mapas use real structure; Mapas specifically uses **faithful mock interaction** (see Mapas). Content backends fill in later phases.
- **D-07:** UI-01 wording shifts from “top tabs Testes|Mapas|Catálogo|Meta” to **header nav items** as in D-01 (Catálogo → **Variáveis**).

### Paste / DataSUS input
- **D-08:** Shared input = textarea + file upload + **ported/expanded DataSUS wizard** (`tabular-data-input`, `datasus-importer`, `datasus-wizard`).
- **D-09:** **Maximum format tolerance** — including raw copy-paste of DataSUS/TABNET tables (`;`, pt-BR decimal comma, tabs, messy dumps).
- **D-10:** UX after paste: **auto-detect as much as possible → column preview → user confirm/adjust → continue**.

### Demo flow (Dados → Configurar → Resultados)
- **D-11:** Phase 1 ships a **didactic stub** (“Teste demo”) with sample data, simple chart, PNG export, and brief PT interpretation — proves the shell before Phase 2 migration.
- **D-12:** Interpretation slot (UI-06) and PNG export (UI-04) are part of the shared results pattern used by the stub.

### “Qual teste usar?” (UX-01)
- **D-13:** Prominent button in Estatística opens a **modal** with a short decision tree (data type → study design → recommended test).
- **D-14:** Wizard can surface the **full roadmap of tests**; unavailable ones show **“em breve”** and are not navigable; only available modules (demo now; migrated later) are clickable.

### Visual tone
- **D-15:** **Balanced** cult-ui: subtle texture/motion on header or area entry; data-work areas stay clean/readable.
- **D-16:** Accent = **clinical teal** (~`#10b981`), not purple leftover from old Tailwind scaffold. Preserve LACIR logo as-is.

### Session / leave warning (UI-05 revised)
- **D-17:** **No persistent “refresh loses work” banner.**
- **D-18:** Use `beforeunload` (or equivalent) **only on Estatística**, and **only if the user has already inputted data**.

### Mapas shell (Phase 1 mock; full data Phase 4)
- **D-19:** Mapas is **coupled to research/estatística** but Estatística remains usable **standalone** (paste without Mapas).
- **D-20:** Hover UF → side panel lists variables available for that location.
- **D-21:** Click UF → UF stays **selected/locked**; variable list stays for that selection.
- **D-22:** Multi-select UFs → panel shows **intersection first** (vars in all selected UFs); vars missing in some UFs appear **at the end** with alert (“não existe em BA, PE…”).
- **D-23:** Multi-select variables from the list.
- **D-24:** **Iniciar pesquisa** → didactic next step: which researches/tests are possible → official collection links per variable → user pastes into a modal → continues toward a test. Phase 1: stub this flow with mock data; Phase 4 wires real catalog/geo.

### Claude's Discretion
- Exact teal token values / WCAG tweaks after sampling logo.
- Which cult-ui components (keep few; header/entry only).
- Demo stub chart type (keep Chart.js consistent with MVP).
- Router choice (e.g. react-router hash/history) as long as header nav matches D-01.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/PROJECT.md` — milestone goals, JASP/MVP port stance, constraints
- `.planning/REQUIREMENTS.md` — UI-01..06, UX-01 (note UI-01/UI-05 wording updates from this context)
- `.planning/ROADMAP.md` — Phase 1 goal & success criteria
- `.planning/research/SUMMARY.md` — stack/architecture/pitfalls summary
- `.planning/research/STACK.md` — React/Vite/TW/shadcn/cult-ui recommendations
- `.planning/research/ARCHITECTURE.md` — module boundaries (adapt tabs → header routes)

### Brand / existing UI
- `logo lacir.png` — preserve logo
- `index.html` — current shell structure (to replace)
- `assets/css/styles.css` — legacy styles (do not treat purple Tailwind scaffold as brand)

### Reusable MVP engines (port, don’t reinvent)
- `assets/js/app.js` — Stats helpers, module loader patterns
- `assets/js/tabular-data-input.js` — robust paste/parse
- `assets/js/datasus-importer.js` — TABNET dump ingest
- `assets/js/datasus-normalizer.js` — column classification
- `assets/js/datasus-wizard.js` — multi-step DataSUS UX
- `assets/js/chart-manager.js` — Chart.js + PNG export
- `tests-manifest.json` — test registry shape (evolve to static React registry)

### Later-phase oracle (do not embed)
- `jasp-desktop-development/` — JASP reference for numeric behavior (engines in later phases)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **tabular-data-input + datasus-***: best paste/wizard stack to port into shared React hooks/components
- **chart-manager / Chart.js**: keep for demo PNG export and later tests
- **Stats in app.js**: leave pure math for Phase 2+; Phase 1 stub can fake or use minimal numbers
- **logo lacir.png**: header brand mark

### Established Patterns
- Modular test folders under `tests/` with `renderTestModule` — replace with React feature modules + registry
- Shared session via `window.__LACIR_SHARED__` — replace with in-memory React context/store (no persistence)

### Integration Points
- Header nav mounts four route layouts
- Estatística hosts sidebar + shared flow + wizard modal + DataSUS link
- Mapas mock UI should expose the same “iniciar pesquisa → modal paste → teste” handoff shape future phases will wire

</code_context>

<specifics>
## Specific Ideas

- User described Mapas as a research launcher: hover → variables; multi-UF intersection + partials with alerts; multi-var select; iniciar pesquisa with didactic collection links and paste modal.
- Estatística must remain available without using Mapas (“não necessariamente tem que pegar os dados da plataforma”).
- Maximum paste tolerance explicitly includes “só copia a tabela do DataSUS e cola”.

</specifics>

<deferred>
## Deferred Ideas

- Additional LACIR header areas beyond the four (Pesquisa, Extensão, etc.) — future milestone
- Full Mapas catalog/geo data, real variable availability per UF, real iniciar-pesquisa — **Phase 4** (shell/mock in Phase 1)
- Real test migrations — **Phase 2**; new tests — **Phase 3**; Variáveis catalog data — **Phase 5**; Meta-análise — **Phase 6**
- Update REQUIREMENTS UI-01 (header nav) and UI-05 (beforeunload conditional) during plan-phase
- Persistent refresh banner — **rejected** by user

</deferred>

---

*Phase: 1-Redesign / base React shell*
*Context gathered: 2026-07-25*
