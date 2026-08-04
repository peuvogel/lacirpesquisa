---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: milestone
status: executing
stopped_at: Completed 08-08-PLAN.md
last_updated: "2026-08-04T12:04:58.257Z"
last_activity: 2026-08-04
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 17
  completed_plans: 15
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25)

**Core value:** Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.
**Current focus:** Phase 08 — taxonomia-can-nica-integridade

## Current Position

Phase: 08 (taxonomia-can-nica-integridade) — EXECUTING
Plan: 9 of 10
Status: Ready to execute
Last activity: 2026-08-04

## Accumulated Context

### Decisions

- Portal LACIR: header Estatística | Meta-análise | Variáveis | Mapas
- **PIVOT 2026-07-25:** Mapas = interface de análise estatística (temporalidade, presets regionais N/NE/CO/SE/S, macrorregiões de saúde, multi-doença, UX didática) — supersedes “research launcher only”
- **PIVOT 2026-07-25:** Variáveis scrapadas/curadas no site via pipeline versionado; análise sem sites externos na aula; **referência/proveniência obrigatória** em toda variável (nunca dado órfão)
- **PIVOT 2026-07-25:** Scrape offline/build-time (assets), não runtime TABNET ao vivo — evita ToS/instabilidade em aula
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
- [Phase 01]: parseTabular.ts/datasusImporter.ts/datasusNormalizer.ts ported byte-for-byte to TS with differential parity suites against assets/js/*.js over 3 hand-authored TABNET fixtures
- [Phase 01]: datasus-importer.js's splitDelimitedLine and tabular-data-input.js's splitDelimitedLine kept as two separate, undeduplicated implementations (tuned for different input shapes)
- [Phase 01]: TABNET fixtures hand-authored (no raw messy export found under trabalhos datasus/ — all pre-cleaned by coleta_* scripts)
- [Phase 01]: normalizer's Phase 2+ stat-derivation functions (deriveIndependentTTest/derivePairedTTest/deriveCorrelationPairs/derivePraisSeries) ported and typed but numerically unverified — Phase 2 parity work still needed
- [Phase 01]: SessionProvider derives hasData every render (never stored as its own state) so it can't go stale for the 01-07 leave-warning
- [Phase 01]: added src/app/RouteError.tsx as the router's errorElement (T-01-ROUTE mitigation) — catches both render errors and unmatched paths
- [Phase 01]: deleted src/App.tsx and src/test/smoke.test.tsx — router.test.tsx is now the sole boot-level test
- [Phase 01]: useTabularInput reshapes RecognizedColumn objects to Record<string, number> (index-only); error shape passes through unreshaped per 01-PATTERNS.md
- [Phase 01]: ColumnPreviewTable auto-detects column role from actual cell values, not from recognizedColumns/domain aliases, to stay generic across future test modules
- [Phase 01]: TabularInputPanel textarea stays enabled during parsing (deviates from literal UI-SPEC disabled-while-parsing); inline status indicator lives in preview area instead
- [Phase 01]: TEST_REGISTRY is the single source of truth for sidebar and modal — Prevents Pitfall 4 drift between sidebar and modal roadmap
- [Phase ?]: TEST_REGISTRY is the single source of truth for sidebar and modal — Prevents Pitfall 4 drift between sidebar and modal roadmap
- [Phase 01]: IBGE Malhas SVG committed as sanitized brazilUfPaths data; cartogram fallback not needed
- [Phase 01]: Step 4 variable types editable per column (D-08 expanded) — React port improves on legacy read-only type summary
- [Phase 01]: useDatasusWizard publishes DatasusSession via onSessionChange; no window.__LACIR_SHARED__ writes (01-10 wires SessionProvider)
- [Phase 01]: TabularInputPanel showPreview=false defers ColumnPreviewTable to Configurar in TesteDemo flow
- [Phase 01]: ResultsPanel is the Phase 2/3 reusable Resultados shell (metrics, chart, interpretation, PNG)
- [Phase 01]: Teste demo stub uses honest descriptive stats only — buildDemoInterpretation disclaims significance testing
- [Phase 01]: MAPAS_TABULAR_OPTIONS uses broad territorio/medida aliases so junk paste errors while typical TABNET tables still load
- [Phase 01]: Iniciar pesquisa continue requires loaded paste with ≥2 columns and ≥1 data row — not loaded status alone
- [Phase 01]: beforeunload only via useLeaveWarning(hasData) with [hasData] deps — no useBlocker
- [Phase 01]: LeaveWarningGuard structural route scoping instead of route-name conditionals
- [Phase 01]: ClearDataButton onCleared resets TesteDemo tabular input and returns flow to Dados
- [Phase 02-migrar-testes-existentes]: Chart factories return pure ChartData+Options; no imperative Chart() in factories
- [Phase 02-migrar-testes-existentes]: Theme variant merge preserves scale title config via spread-before-grid override
- [Phase 02-migrar-testes-existentes]: Demo stays on plain ResultsPanel; ResultsPanelWithCustomizer for migrated tests only (D-06)
- [Phase 03-testes-classicos-glm-novos]: All ten registry entries available — zero em-breve; Wave B GLM trio flipped in 03-09
- [Phase 03-testes-classicos-glm-novos]: Poisson→NB handoff wired in EstatisticaPage via onCrossTestHandoff + recognizedColumns (D-20)
- [Phase 03-testes-classicos-glm-novos]: Mapas 3-UF handoff now routes to anova-tukey since ANOVA is available
- [Phase 04-mapas-como-interface-estatistica]: Phase 4 automated gate PASS (595 tests); human didactic UX deferred to human_needed
- [Phase 05]: Package-first from existing coleta CSVs; regenerate optional after BASE_DIR port
- [Phase 05]: Shared CNES/pop catalog ids emit once with packId=sih.embolia_trombose_uf; amputação pack still carries join columns
- [Phase 05]: mock.taxa_mortalidade not aliased (infantil ≠ hospital); mock.amputacoes/internacoes/obitos aliased
- [Phase 05]: Pure validation lives in validate.mjs (exported) so CLI and vitest share one rule set
- [Phase 05]: Shared CNES/pop metrics fail closed on divergence across packs (RESEARCH A2)
- [Phase 05]: test:run explicitly chains catalog:validate; pretest covers npm test / vitest interactive
- [Phase 05]: loadCatalog uses same-origin fetch('/data/catalog/...') with in-memory cache
- [Phase 05]: buildSessionDataset left-joins onto first pack; assertCompatibleSelection enforces uf_codigo+ano
- [Phase 05]: Zero new npm dependencies for catalog feature modules (05-03)
- [Phase ?]: Enabled Estatística load in 05-04 (D-14); Mapas button stays disabled until 05-06
- [Phase ?]: Multi-select checkboxes drive load when checked; otherwise selected loadable row is the load target
- [Phase ?]: hasCompleteProvenance blocks incomplete orphans in the detail panel (T-05-09)
- [Phase ?]: Mapas metrics from catalogAnalysisData packs; alias mock.amputacoes/internacoes/obitos only
- [Phase ?]: Default Mapas year = latest non-null; exclude nullYears from pickers (D-19)
- [Phase 05]: Estatística navigate stays on '/' with state.activeTestId (no /estatistica route) — Router only exposes Estatística at /; matches ReviewAnalysisDialog
- [Phase 05]: Mapas handoff APPLY_CATALOG_VARIABLE_IDS once then clear location.state; empty-UF shows full catalog checkboxes — Prevents re-apply loops and makes D-15 selection visible without UF preset
- [Phase 05]: MAX_LOADABLE_SELECTION=12 for Variáveis multi-select (T-05-13) — Discretionary classroom bound from plan threat model
- [Phase 05]: Phase 5 gate: automated PASS; human classroom UAT remains human_needed
- [Phase 05]: 05-07 typecheck fixes: Dispatch mock cast + drop import.meta.env.DEV
- [Phase 07-01]: TestId derivado de TEST_REGISTRY via as const satisfies + isTestAvailable como type guard (id is TestId) — elimina classe de bug de tipo solto sem mudar comportamento runtime
- [Phase 07-01]: TEST_ICONS exaustivo por TestId + iconFor(id) com cast controlado — ícone faltante em novo teste vira erro de compilação, fallback FlaskConical continua testado em runtime (QA-04)
- [Phase 07-01]: registry.test.ts widened com as TestStatus no teste de em-breve — TS2367 surgiu do as const satisfies da própria Task 1, corrigido inline
- [Phase 07]: D-06/D-07 implementadas: runToResultados(user) com 2 passos no corpo (click + findByRole('region')), export nomeado em src/test/flowHelpers.ts
- [Phase 07]: D-08 (canvas) implementada: proto.getContext/proto.toDataURL substituídos incondicionalmente em src/test/setup.ts, sem sondar o método real — 190 avisos de HTMLCanvasElement viraram 0
- [Phase 07-03]: layout="stepper" e toda a API morta (onStepChange, FLOW_STEP_LABELS, effectiveCanAdvance, import de Check) removidos de FlowSteps.tsx e dos 11 call sites que a referenciavam — D-01/D-02: guarda contra recorrência é a ausência estrutural da API, não uma convenção documentada
- [Phase 07-03]: FlowSteps.test.tsx reescrito: 5 casos vivos cobrindo só o layout scroll, contra os 2 que existiam antes do stepper sair — D-03: cobertura líquida não pode cair ao remover os 5 testes de stepper
- [Phase 07-04]: D-06/D-07 aplicadas nos 12 casos de AnovaTukey/KruskalDunn/Logistica/BinomialNegativa: click 'Configurar' + aria-current='step' saíram, runToResultados(user) entrou
- [Phase 07-04]: within(resultados) usado para escopar asserção 'θ (dispersão)' em BinomialNegativaTest — layout scroll mantém Dados e configuração montada ao lado de Resultados, gerando ambiguidade de texto que o stepper antigo nunca expunha
- [Phase 07-06]: D-09/D-12 implementadas: router.test.tsx desdobrado em dois casos independentes — rota via #lacir-test-module-mount + botão 'Qual teste usar?' (D-04), teste ativo padrão via data-active-test-id/heading 't de Student' (D-10)
- [Phase 07-06]: D-08 fechada por medição: 0 avisos de act() e 0 de canvas já estavam presentes antes da Task 2 — nenhum arquivo além de router.test.tsx precisou de mudança nesta plan
- [Phase 08-01]: HTML snapshot read/written as latin1 (ISO-8859-1) throughout — utf8 would silently corrupt every accented label
- [Phase 08-01]: invariante C sha256 computed over the raw HTML buffer (bytes as written to disk), not the decoded string
- [Phase 08-01]: parseListaMorbOptions() applies zero filtering — returns all 334 raw options in document order; partitioning is the generator's job (future plan), not the parser's
- [Phase 08-01]: lista-morb-cid.json re-key done by a disposable conversion script run outside the repo, never left behind, with a multiset-of-values-unchanged assertion before writing
- [Phase 08-01]: code 330's CID range (W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89) sourced from RESEARCH 1.3/mxcid10lm.htm item 1.103, added as lista-morb-cid.json's only new key
- [Phase 08-02]: sync-lista-morb.mjs rewritten as pure CLI-plus-export module: KNOWN_BY_CODE and label-based filtering removed, id is always slugify(label, code), exclusions are code-only (D-25) — Removes the root cause of the 21-id corruption and the sibling bug that dropped code 330 by matching against the label
- [Phase 08-02]: rename-map.json computed from the diff between the frozen pre-migration fixture and the canonical regeneration (D-12), never transcribed from the ground-truth note — 21 renames, 1 addition (code 330), 0 removals — matches the ground-truth note's amended 21-row table exactly, proving the computed-not-transcribed discipline
- [Phase 08-02]: Rule 1 fix: decodeEntities() in listaMorbSource.mjs (08-01) rewritten from a 9-entity case-insensitive chain to an 18-letter case-sensitive named-entity table; committed extract re-derived from the unchanged HTML — The incomplete decoder silently corrupted ~59 labels with literal &ocirc;/&ecirc;/&acirc;/&uuml;/&agrave; fragments, inflating the diff-computed rename map from 21 to 76 spurious entries; caught by cross-checking against the ground-truth note before commit
- [Phase 08]: [Phase 08-03]: Invariants A/B/D/D2 written as pure functions in validate.mjs, none wired into main() yet — checkSlugConsistency's allowlist is a required parameter derived from extra-diseases.json's reason field by the caller, never a literal inside validate.mjs; checkColumnMapKeys duplicates the standard-column shape by hand instead of importing syncColumnMap.mjs, which has unconditional top-level disk reads — D-24 requires renaming and invariants to land in the same commit (08-06); this plan proves the invariants work via a frozen pre-migration fixture without touching the live taxonomy
- [Phase ?]: [Phase 08-04]: applyRenameMap.mjs code-source substitution uses one combined regex.exec pass (not sequential per-rename replace) because a sequential loop lets one rename cycle's freshly-written canonical text get re-matched by the other cycle's rename (186/187, 173/182)
- [Phase ?]: [Phase 08-04]: renameMap.test.ts and tombstones.test.ts excluded from applyRenameMap.mjs's rename-engine scope — both assert historical facts about rename-map.json's own immutable content (which old ids exist, which two are cycles), so rewriting their literals would make a currently-true assertion false once --apply runs in 08-06
- [Phase ?]: [Phase 08-04]: sobras (leftover-tombstone) count after simulating a rewrite excludes ids that are simultaneously a tombstone and the canonical target of a different rename (hemorroidas, embolia_pulmonar) — their correct post-rename reappearance is not a leftover
- [Phase 08-05]: supabase db pull failed on a pre-existing untracked remote migration entry; used the plan's documented fallback (db dump -s public + migration repair --status applied) to capture the real production schema as baseline without touching data
- [Phase 08-05]: supabase/config.toml does not receive the linked project ref from supabase link in CLI 2.90.0 (it lives in gitignored supabase/.temp/project-ref) — added a documentation comment citing the ref instead
- [Phase 08-05]: Rename migration up/down/verify SQL generated purely from rename-map.json + metricless-diseases.json (never hand-transcribed); shared __rename_map temp table reused by both directions, with movement direction expressed by which column each pass matches/sets
- [Phase 08-06]: git mv given repo-relative paths (not absolute) in applyRenameMap.mjs — absolute paths under this project's accented directory name hit a macOS/APFS NFC/NFD Unicode normalization mismatch against git's toplevel string comparison
- [Phase 08-06]: assertNotTombstone in paths.mjs's PACK_SOURCES loop skips CYCLE_CANONICAL_IDS (hemorroidas, embolia_pulmonar) — these are today's legitimate canonical ids for a different tabnetCode, not leftovers; assertNotTombstone itself keeps throwing unconditionally for untrusted write-path callers
- [Phase 08-06]: Invariant F (noTombstoneLiterals.test.ts) unions its 3 declared allowlist paths with applyRenameMap.mjs's exported SCOPE_EXCLUDE_RELATIVE_PATHS (renameMap.test.ts, tombstones.test.ts) instead of hand-retranscribing — both retain old-id literals as historical-fact assertions about rename-map.json's own immutable content
- [Phase 08-07]: ait remapped from tabnetCode 180 (I65-I69) to tabnetCode 150 (G45, exact ICD-10 category) — Task 3 human checkpoint caught a real clinical mis-mapping, not a rubber-stamp
- [Phase 08-07]: avc broadened from 3 to 4 categories (177+178+179+180) — deliberate scope decision so the acronym search surfaces the whole cerebrovascular panorama, not just the three acute-event forms
- [Phase 08-08]: Migration rehearsal (08-08) passed completely against full production-volume Postgres (330/30313/1099403 rows): up 3.674s, D-04 integrity proof passed, verify 331/30313/1099403, down 3.921s, byte-identical reversibility diff (D-03). Per-id row counts for the 21 renames matched planning estimate exactly (4,195 uf / 200,636 muni). Unblocks 08-10 production apply.
- [Phase 08-08]: docker run used public.ecr.aws/supabase/postgres:17.6.1.147 (full registry path) instead of the plan's literal short tag supabase/postgres:17.6.1.147 — the short tag was not cached locally; the full path is the same image the Supabase CLI itself pulled in 08-05 (same IMAGE ID).

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-08-04T12:04:58.254Z
Stopped at: Completed 08-08-PLAN.md
Resume file: None

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 01 P03 | ~10 min | 3 tasks | 12 files |
| Phase 01 P04 | 15 min | 3 tasks | 7 files |
| Phase 01 P02 | 40min | 2 tasks | 3 files |
| Phase 01 P05 | ~30 min | 3 tasks | 16 files |
| Phase 01 P06 | 25min | 3 tasks | 8 files |
| Phase 01-redesign-base-react-shell P07 | 25min | 3 tasks | 9 files |
| Phase 01-redesign-base-react-shell P08 | 25min | 3 tasks | 8 files |
| Phase 01-redesign-base-react-shell P09 | 25min | 3 tasks | 11 files |
| Phase 01-redesign-base-react-shell P10 | 25min | 3 tasks | 12 files |
| Phase 01-redesign-base-react-shell P11 | 25min | 2 tasks | 6 files |
| Phase 01-redesign-base-react-shell P12 | 12min | 2 tasks | 7 files |
| Phase 02-migrar-testes-existentes P02 | 3min | 3 tasks | 21 files |
| Phase 02-migrar-testes-existentes P06 | 8min | 3 tasks | 14 files |
| Phase 03-testes-classicos-glm-novos P09 | 3min | 2 tasks | 10 files |
| Phase 04-mapas-como-interface-estatistica P08 | 12min | 3 tasks | 3 files |
| Phase 05 P01 | 2min | 2 tasks | 13 files |
| Phase 05 P02 | 1min | 2 tasks | 4 files |
| Phase 05 P03 | 2min | 3 tasks | 8 files |
| Phase 05 P04 | 3min | 2 tasks | 6 files |
| Phase 05 P05 | 4min | 2 tasks | 21 files |
| Phase 05 P06 | 2min | 2 tasks | 9 files |
| Phase 05 P07 | 4min | 2 tasks | 5 files |
| Phase 07 P01 | 12min | 3 tasks | 5 files |
| Phase 07 P02 | ~7min | 2 tasks | 3 files |
| Phase 07-baseline-verde P03 | 15min | 2 tasks | 13 files |
| Phase 07-baseline-verde P04 | ~8min | 2 tasks | 4 files |
| Phase 07-baseline-verde P06 | ~8min | 2 tasks | 1 files |
| Phase 08 P01 | 15min | 3 tasks | 13 files |
| Phase 08 P02 | ~5min (continuation) + ~15min (Task 1, prior session) | 3 tasks | 8 files |
| Phase 08 P03 | ~10min | 2 tasks | 2 files |
| Phase 08-taxonomia-can-nica-integridade P04 | ~25min | 3 tasks | 6 files |
| Phase 08-taxonomia-can-nica-integridade P05 | ~25min | 3 tasks | 11 files |
| Phase 08-taxonomia-can-nica-integridade P06 | ~55min | 1 tasks | 51 files |
| Phase 08 P07 | ~15min (continuation) + prior sessions | 3 tasks | 4 files |
| Phase 08-taxonomia-can-nica-integridade P08 | ~48min | 3 tasks | 1 files |
