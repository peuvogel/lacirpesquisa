# Mapas: pergunta progressiva e publicação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Every behavior change starts with an observed failing test.

**Goal:** Fazer `/mapas` começar pela população no mapa real, atribuir territórios diretamente ao conjunto ativo, estruturar uma pergunta progressiva e levar o usuário aos dados/testes automáticos por uma lista compacta de variáveis; depois publicar uma versão restaurável no GitHub Pages.

**Architecture:** `MapAnalysisState` continua sendo a fonte de verdade territorial. Novas ações atômicas atribuem/removem territórios do grupo ativo; `MapQuestionDraft` mantém apenas eixo/objetivo de apresentação. Um construtor da pergunta em `src/routes/mapas` produz o `ResearchDesign` já consumido pelo workspace estatístico. A única extensão compartilhada de UI é um render hook opt-in para Mapas fornecer sua lista compacta de variáveis, preservando o default de `/variaveis`. O backend e Estatística não mudam.

**Tech Stack:** React 19, TypeScript, React Router, Vite 8, Tailwind, Vitest/Testing Library, Supabase client/repository existente, Chart.js e motores estatísticos existentes, GitHub Actions/Pages.

## Global Constraints

- Worktree: `/Users/pedroalmeida/Desktop/Bioestatística LACIR/.worktrees/guided-variables-technical` (o nome real contém acento Unicode; usar o caminho do shell já aberto).
- Branch: `codex/map-question-flow`; ponto de restauração: `restore/pre-mapas-question-flow-2026-08-20` em `7a8d8d0`.
- Alterar a experiência de produto somente em Mapas. Não mudar a tela Estatística, backend, schema Supabase ou pipeline.
- Permitir pequenas alterações globais exclusivamente para o build/roteamento do GitHub Pages e uma extensão opt-in do workspace guiado que não altere `/variaveis`.
- Reutilizar `BrazilMapCanvas`; não criar outro SVG/mapa.
- Nunca inferir comparação por doença a partir de dados colapsados; falhar fechado e explicar.
- Metadado de catálogo não torna exposição analisável sem dado/junção real.
- Ausência nunca vira zero; revisão, zero confirmado e sem dados continuam distintos.
- Nenhuma fixture ou fallback silencioso em produção.
- Não publicar antes do gate integral e smoke visual real.

---

## Task 1: Contrato de atribuição direta de territórios

**Files:**
- Modify: `src/routes/mapas/mapAnalysisState.ts`
- Modify: `src/routes/mapas/mapAnalysisState.test.ts`

**Interfaces:**
- Add action `ASSIGN_TERRITORIES_TO_ACTIVE` with `territories` and optional first-group name.
- Add action `REMOVE_TERRITORIES_FROM_GROUP`.
- Add pure helper `territoryOwner(state, territory)`.

- [ ] Write RED tests proving:
  - first assignment creates `População selecionada` and activates it;
  - subsequent assignment merges without duplicates;
  - removal only affects the addressed group;
  - an assigned territory is never silently moved between groups;
  - disease/time seeds still propagate to an explicitly created comparator;
  - legacy session normalization remains valid.
- [ ] Run `npm test -- --run src/routes/mapas/mapAnalysisState.test.ts` and observe the missing actions/helpers fail.
- [ ] Implement the smallest reducer/helper change.
- [ ] Re-run focused tests and `npm run typecheck`.
- [ ] Commit: `feat(maps): add direct territory assignment contract`.

## Task 2: Substituir a cesta de grupos por população ativa

**Files:**
- Create: `src/routes/mapas/PopulationGroupBar.tsx`
- Create: `src/routes/mapas/PopulationGroupBar.test.tsx`
- Modify: `src/routes/mapas/MapasPage.tsx`
- Modify: `src/routes/mapas/MapasPage.test.tsx`
- Modify only if needed: `src/routes/mapas/PresetTerritoryCarousel.tsx`

**Behavior:**
- A first map click assigns immediately.
- The active chip states “Clique no mapa para adicionar à …”.
- `Adicionar comparador` creates and activates an empty comparator.
- Clicking a territory in the active population removes it; clicking one owned by another population activates its owner without moving it.
- Region/meso/macro/paste actions assign directly to the active population.
- Existing territorial presets continue to work.
- Old staging CTA, mandatory drag and right-click pill disappear from the normal path.

- [ ] Write RED component/integration tests for all behaviors above, including keyboard labels and colors with text.
- [ ] Run Mapas-focused suite and observe failures against the old “Adicionar grupo” workflow.
- [ ] Implement `PopulationGroupBar` using `GroupChip`/palette where useful and wire `BrazilMapCanvas` unchanged.
- [ ] Remove unreachable staging state/handlers from `MapasPage` only after tests prove the replacement.
- [ ] Verify map drill and preset tests, then `npm run typecheck`.
- [ ] Commit: `feat(maps): paint active populations on the map`.

## Task 3: Construtor progressivo da pergunta

**Files:**
- Create: `src/routes/mapas/mapQuestionDraft.ts`
- Create: `src/routes/mapas/mapQuestionDraft.test.ts`
- Create: `src/routes/mapas/MapQuestionBuilder.tsx`
- Create: `src/routes/mapas/MapQuestionBuilder.test.tsx`
- Modify: `src/routes/mapas/SharedDiseasePanel.tsx`
- Modify: `src/routes/mapas/SharedDiseasePanel.test.tsx`
- Modify: `src/routes/mapas/MapasPage.tsx`
- Modify: `src/routes/mapas/MapasPage.test.tsx`

**Interfaces:**

```ts
export type ComparisonAxis = 'none' | 'place' | 'period' | 'disease' | 'exposure';
export interface MapQuestionDraft {
  comparisonAxis: ComparisonAxis;
  objective: ResearchGoal | null;
}
export function validateMapQuestion(state, draft): MapQuestionValidation;
export function buildQuestionSentence(state, draft): string;
```

**Behavior:**
- The builder unlocks only after a population exists.
- Disease selector is search-first: selected diseases remain visible; without query, show a short curated/available subset rather than all 331 rows.
- Axis cards are `Sem comparação`, `Lugar`, `Período`, `Doença`, `Exposição`.
- Only one axis can be active.
- Place requires comparator; period invokes existing period controls; disease/exposure show honest capability status and never enable an unsupported inferential run.
- Objective cards appear after axis: Descrever, Comparar/relacionar, Ambos; impossible objective/axis pairs are disabled with reason.
- A natural-language sentence updates from the actual map state.
- Start analysis is enabled only when both research design and question validation are safe.

- [ ] Write RED pure tests for axis invariants and example question sentences.
- [ ] Write RED UI tests for progressive reveal, one-axis selection, search-first disease list, comparator CTA and unsupported-axis explanations.
- [ ] Observe RED before production edits.
- [ ] Implement pure model then UI.
- [ ] Ensure changing axis/objective invalidates any unlocked result.
- [ ] Run focused tests and typecheck.
- [ ] Commit: `feat(maps): build the research question progressively`.

## Task 4: Lista compacta e filtrável de variáveis exclusiva de Mapas

**Files:**
- Create: `src/routes/mapas/MapVariableList.tsx`
- Create: `src/routes/mapas/MapVariableList.test.tsx`
- Modify minimally: `src/routes/variaveis/GuidedAnalysisWorkspace.tsx`
- Modify minimally: `src/routes/variaveis/GuidedResearchFlow.tsx`
- Modify tests: `src/routes/variaveis/GuidedAnalysisWorkspace.test.tsx`
- Modify: `src/routes/mapas/MapasPage.tsx`

**Shared opt-in contract:**

```ts
type VariableSelectorRenderer = (props: GuidedVariableSelectorProps) => ReactNode;

<GuidedAnalysisWorkspace
  design={design}
  embedded
  initialGoal={draft.objective}
  renderVariableSelector={(props) => <MapVariableList {...props} />}
/>
```

Default props stay undefined, so `/variaveis` renders exactly its existing selector and objective step.

**Behavior:**
- One list, not four columns.
- Search by short label.
- Filters: role, variable type and availability.
- Row: checkbox, label, type, availability only.
- `Fonte e método` remains collapsed.
- Partial stays enabled with concise reason; none is disabled.
- Selected rows stay discoverable when filters change.
- Objective chosen in the question builder seeds the guided flow; the user is not asked twice.

- [ ] Write RED tests for search/filter/selection/availability and for default `/variaveis` preservation.
- [ ] Observe RED.
- [ ] Implement map component and smallest shared renderer/initial-goal hook.
- [ ] Run Mapas + Variables focused suites and typecheck.
- [ ] Commit: `feat(maps): simplify variables for the question flow`.

## Task 5: Teste automático explicado dentro da pergunta

**Files:**
- Create: `src/routes/mapas/MapTestRecommendation.tsx`
- Create: `src/routes/mapas/MapTestRecommendation.test.tsx`
- Modify minimally: `src/routes/variaveis/GuidedResearchFlow.tsx`
- Modify minimally: `src/routes/variaveis/EligibleTestsSection.tsx`
- Modify related tests in `src/routes/variaveis`
- Modify: `src/routes/mapas/MapasPage.test.tsx`

**Behavior:**
- Mapas shows “Teste escolhido pelo sistema” only after real profiles/diagnostics exist.
- Principal and valid sensitivity alternatives remain selectable when the engine returns both.
- Ineligible tests do not render as executable choices.
- Explanation references question shape, group count, variable type and normality/assumptions actually used.
- Prais–Winsten appears only for Descrever/Ambos and remains separate per group.
- The existing results, normality charts, result maps, missing-data review and interpretation continue below on `/mapas`.

- [ ] Write RED tests for two groups/t-vs-Mann, four groups/ANOVA-vs-Kruskal, correlation roles, Prais and unsupported disease/exposure axis.
- [ ] Observe RED.
- [ ] Implement only presentation/selection integration; do not change eligibility math.
- [ ] Run focused tests, concurrency tests and typecheck.
- [ ] Commit: `feat(maps): explain automatic test recommendations`.

## Task 6: Acessibilidade, responsividade e regressão visual

**Files:**
- Modify only Mapas components/styles/tests created above.

- [ ] Add RED tests for a single h1, ordered headings, focus on newly opened step, `prefers-reduced-motion`, keyboard operation and no nested landmarks.
- [ ] Implement minimum fixes.
- [ ] Run all `src/routes/mapas` tests and map-adjacent guided tests.
- [ ] Run `npm run typecheck` and `git diff --check restore/pre-mapas-question-flow-2026-08-20`.
- [ ] Start local dev server and visually smoke desktop/tablet/mobile using the in-app browser:
  - first direct selection;
  - comparator;
  - disease search;
  - period and objective;
  - compact variables;
  - distribution/test/results;
  - console free of new errors.
- [ ] Commit: `fix(maps): polish progressive question flow`.

## Task 7: GitHub Pages sem alterar o produto fora de Mapas

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`
- Create: `.github/workflows/pages.yml`
- Modify only if required: `vite.config.ts` or `package.json`

**Behavior:**
- Router uses `import.meta.env.BASE_URL` as basename.
- Local dev remains at `/`; Pages build uses `/lacirpesquisa/`.
- Workflow builds `dist`, copies `index.html` to `404.html` for direct SPA routes, uploads and deploys with official Pages actions.
- Node 22+ is used, consistent with current Supabase client support.
- Supabase URL/anon key come from GitHub secrets and never enter Git history/log output.

- [ ] Write RED router test for a non-root basename or add a build assertion that fails before config.
- [ ] Observe RED.
- [ ] Implement basename and Pages workflow with pinned official action SHAs.
- [ ] Run router tests, typecheck and a Pages-base production build.
- [ ] Commit: `ci(pages): publish the map analysis app`.

## Task 8: Verificação integral, revisão e publicação restaurável

- [ ] Run fresh `npm run gate` and capture exact Python/Vitest/build counts.
- [ ] Run a separate `npm run typecheck` and `git diff --check`.
- [ ] Request independent code/spec review; fix every Critical/Important via RED→GREEN.
- [ ] Re-run the full gate after the last fix.
- [ ] Add remote `origin` for `https://github.com/peuvogel/lacirpesquisa.git` if absent.
- [ ] Push `restore/pre-mapas-question-flow-2026-08-20` first.
- [ ] Push the implementation branch as the repository default branch (use `main` for the public repo without rewriting the local restore reference).
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repository secrets by reading local env without printing them.
- [ ] Enable GitHub Pages with workflow source and wait for deployment success.
- [ ] Open `https://peuvogel.github.io/lacirpesquisa/mapas` and smoke the published app, including Supabase data loading and browser console.
- [ ] Verify the restore branch exists remotely and document the exact restore command.

## Final Acceptance Gate

- Direct map assignment works for UF and municipality paths.
- `População selecionada` exists before any comparator.
- No old mandatory `Adicionar grupo` step remains in the normal flow.
- Question precedes variables/tests.
- One comparison axis is enforced.
- Compact variable list is searchable/filterable and availability-safe.
- Automatic tests remain fail-closed and explained.
- Existing data/profile/results maps remain functional on `/mapas`.
- No visible change in Estatística or direct `/variaveis` behavior.
- Full gate/build pass after final review.
- GitHub Pages link works and restore branch is remotely available.

