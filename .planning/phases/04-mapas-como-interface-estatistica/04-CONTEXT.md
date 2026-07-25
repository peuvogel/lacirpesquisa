# Phase 4: Mapas como interface estatística - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Evolve the Phase 1 Mapas mock into a **didactic statistical-analysis workspace**: ligantes select territories on a single fluid map screen, form **named analysis groups**, configure **time** (point or range) and **diseases/variables** per group, see choropleths offline from bundled geo assets (UF → município, mesorregião, macrorregião de saúde), then **review a suggested test** (editable) and hand off an assembled table into Estatística.

**Requirements:** MAP-01 … MAP-10.

**Out of scope:** Full Phase 5 scrape/catalog pipeline as the sole data source (Phase 4 ships hybrid mocks + optional paste); census-sector maps; advanced map animation beyond didactic time compare; runtime IBGE/map APIs; login/backend; meta-análise (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Fluxo didático — tela única fluida (MAP-10)
- **D-01:** **Single-screen Mapas workspace** (not a rigid multi-step stepper). Exploration stays fluid for lay capacitação audiences.
- **D-02:** Persistent **selection summary** always visible (território × grupos × tempo × agravos/variáveis) in plain PT.
- **D-03:** Progressive disclosure: map first → form groups → per-group panel (time → diseases/variables) → “Revisar e analisar” before leaving Mapas.

### Criação de grupos (MAP-07 / interação)
- **D-04:** Multi-select UFs (and later other geographies) with **glowing/highlighted borders** when selected and when they can join a group.
- **D-05:** Create a group by **dragging** selected units into a top drop zone (“Grupo 1” / “Criar grupo”) **and** by an explicit primary action (button). Optional context-menu “Criar grupo” as secondary shortcut — not the only path (browser UX / discoverability).
- **D-06:** Groups are **renamable**. Multiple groups allowed; each group keeps its own time + variable configuration.
- **D-07:** Regional **presets** (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) one-click create/fill a group; **macrorregiões de saúde** are first-class selectable geographies for grouping (MAP-08), not only UF presets.
- **D-08:** Map click selection and group membership stay in sync (selecting a preset/group highlights members on the map).

### Painel por grupo — tempo e variáveis (MAP-06 / MAP-09)
- **D-09:** Opening/creating a group opens a **panel** (side or overlay) scoped to that group.
- **D-10:** **Temporalidade:** user chooses **fixed time point** *or* **period range** (start–end). Comparison of two periods is supported as a didactic mode within the same panel (e.g. período A vs B) when data allows — not a separate product area.
- **D-11:** After time is set, user selects **one or more diseases/agravos/variables** for that group’s analysis.
- **D-12:** Copy and empty states stay capacitação-friendly: short PT hints, no stats jargon without explanation.

### Dados nesta fase (híbrido com Fase 5) — decisão 2C
- **D-13:** Phase 4 ships **hybrid data**: (1) **bundled didactic mocks** so the map works in class with zero external sites; (2) **optional paste/upload** of TABNET-style tables to drive choropleths and handoff tables.
- **D-14:** Phase 5 curated scrape catalog **enhances** Mapas later; do not block Phase 4 on the full catalog. Mock variable IDs/labels should be designed so Phase 5 can swap/enrich sources without rewriting the group UX.
- **D-15:** Every plotted/selected variable shown in UI carries **provenance when known** (even mocks: label “exemplo didático” / fonte fictícia). Real paste shows user-sourced note. Full mandatory provenance catalog remains Phase 5 (CAT-*).

### Geo / drill-down offline (MAP-01…05) — decisão 3C
- **D-16:** **Full MAP-03 ladder in Phase 4:** Brazil choropleth by UF with legend → drill into a UF → view **município**, **mesorregião**, and **região/macrorregião de saúde** choropleths.
- **D-17:** **MAP-05:** All geometries from **bundled static assets** (GeoJSON/SVG as appropriate). No runtime map tile server or IBGE API calls.
- **D-18:** **MAP-02 / MAP-04:** Paste territory labels as UF name or sigla; municipality matching **scoped by selected UF** with a **matched/unmatched report**.
- **D-19:** Planner/researcher must address **bundle size** (lazy-load per-UF município assets; do not ship all Brazil municipalities in the initial Mapas chunk). Prefer IBGE-compatible codes for join keys.

### Handoff → Estatística (MAP-09) — decisão 6C
- **D-20:** “Analisar” opens a **review step** that: (1) shows the selection summary; (2) **suggests a statistical test** from the selection shape (reuse/extend `suggestResearchForSelection` / registry heuristics); (3) lets the user **change the test** before continuing.
- **D-21:** Confirm navigates to Estatística with **assembled tabular dataset** in session + `activeTestId` (+ recognized column roles when inferable) — not only UF list stubs.
- **D-22:** Replace/upgrade the Phase 1 `IniciarPesquisaModal` stub flow to this review+handoff; keep official collection links as secondary help, not the primary path.

### Claude's Discretion
- Exact drag-and-drop library vs HTML5 DnD; glow/highlight CSS motion (keep subtle, brand teal, no purple glow spam).
- Panel layout (drawer vs split) and mobile breakpoints — prefer desktop-first capacitação, usable tablet.
- Choropleth color scales and legend placement — white/publication export later if needed; on-screen dark+teal shell.
- Which mock diseases ship in Wave 1 vs later waves inside Phase 4.
- Precise suggestion rules for test pick (mirror existing UF-count heuristics, extend for groups/time/multi-var).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/PROJECT.md` — Mapas = statistical interface pivot; client-side GeoJSON
- `.planning/REQUIREMENTS.md` — MAP-01 … MAP-10
- `.planning/ROADMAP.md` — Phase 4 goal & success criteria
- `.planning/notes/2026-07-25-pivot-scrape-mapa-analise.md` — pivot locked decisions
- `.planning/STATE.md` — PIVOT bullets for Mapas / scrape boundary with Phase 5
- `.planning/phases/01-redesign-base-react-shell/01-CONTEXT.md` — Mapas mock IA, handoff stub
- `.planning/phases/03-testes-classicos-glm-novos/03-CONTEXT.md` — available tests for suggestions/handoff

### Existing Mapas / session code
- `src/routes/mapas/MapasPage.tsx` — current selection shell
- `src/routes/mapas/BrazilMockMap.tsx` + `brazilUfPaths.ts` + `ufCodes.ts` — UF SVG mock
- `src/routes/mapas/VariablePanel.tsx` + `mockVariablesByUF.ts` — mock intersection panel
- `src/routes/mapas/IniciarPesquisaModal.tsx` + `suggestResearchForSelection.ts` — stub handoff to upgrade
- `src/shared/session/SessionProvider.tsx` — `mapSelection` / dataset session
- `src/routes/estatistica/EstatisticaPage.tsx` — handoff `activeTestId` + `recognizedColumns`

### Data / research artifacts (geo & variables)
- `trabalhos datasus/GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md` — public-health variable mapping research
- Phase 5 will own scrape pipeline; Phase 4 only consumes mocks + paste

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- UF path map + sigla codes already power hover/select
- Variable intersection/partial logic for multi-UF selection
- Suggest-test heuristics by UF count (t-student / correlação / anova)
- Session + navigate handoff pattern proven in Phase 2/3

### Established Patterns
- Dark + teal shell; Mapas is a top-level route
- Estatística owns FlowSteps analysis; Mapas should assemble data then hand off
- Client-only; leave-warning when session has data

### Integration Points
- Upgrade `mapSelection` session shape to groups × time × variables
- Handoff must publish `setDataset` (or equivalent) with real rows, not only suggestions
- Registry now has 10 available tests — suggestion engine should use them

</code_context>

<specifics>
## Specific Ideas

User vision (verbatim intent):
- Single map screen; selected state borders **shine** to show they can form a group.
- Multi-select → **right-click or drag** into a top **Group 1 / Create group** field; groups **renamable**.
- Creating a group opens a panel: choose **time** (fixed or period) then **diseases/variables**.
- Must feel **dynamic, fluid, very didactic** for lay trainees in capacitação.

Locked answers:
- Data: **2C** hybrid mocks + optional paste
- Geo: **3C** full drill-down município + meso + macrorregião
- Handoff: **6C** suggest test + allow change, then go to Estatística

</specifics>

<deferred>
## Deferred Ideas

- Phase 5: replace/enrich mocks with versioned scraped catalog + mandatory rich provenance (CAT-*)
- Census tracts / advanced animated cartography
- Cloud save of named map projects
- Touch-first redesign beyond tablet-usable desktop layout

None of the above block Phase 4 planning.

</deferred>

---

*Phase: 4-Mapas como interface estatística*
*Context gathered: 2026-07-25*
