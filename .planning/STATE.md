---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: milestone
status: executing
stopped_at: "Fase 09 Plano 09 completo: partitions.py (produtor colunar+gzip das particoes de municipio, D-20/D-21), bucket sih-municipio criado e auditado ao vivo (leitura anonima comprovada, escrita anonima recusada, teto de 50 MB confirmado), loadMunicipioPartition.ts (consumidor TS com DecompressionStream nativo e cache por promessa). Checkpoint D-21 respondido pelo operador -- manter-por-uf confirmado, com item de acompanhamento registrado para remedir SP apos a corrida completa do 09-04."
last_updated: "2026-08-10T15:13:46.457Z"
last_activity: 2026-08-10
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 31
  completed_plans: 25
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-25)

**Core value:** Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.
**Current focus:** Phase 09 — pipeline-confi-vel-coleta-completa

## Current Position

Phase: 09 (pipeline-confi-vel-coleta-completa) — EXECUTING
Plan: 11 of 14 (09-09 completo — partitions.py, bucket sih-municipio criado e auditado, loadMunicipioPartition.ts; checkpoint D-21 respondido pelo operador -- manter-por-uf confirmado. 09-01/09-03/09-04 permanecem pausados em bloqueio/checkpoint)
Status: Ready to execute
Last activity: 2026-08-10

### Bloqueios abertos

- **09-04 Task 3 (disco):** a corrida completa de ~10 GB (todas as 331 agravos x 27 UF x 2013-2025) ainda nao foi disparada. Disco verificado em 09-07 com ~7,3 GB livres — folga maior que o ~1,7 GB registrado antes, mas ainda abaixo dos ~12-15 GB estimados para a corrida inteira; resolver com volume externo via `SIH_PIPELINE_CACHE_DIR` ou liberar mais espaco antes de disparar. NAO bloqueou 09-07: a plan baixou so os 12 arquivos de AC/2019 (~3 MB) via `cli.py download --only`, suficientes para a fixture de gate. Bloqueia DATA-01/DATA-02 (coleta de fato dos 331 agravos) e a corrida real que 09-08/09-11/09-12 vao precisar.
- **`supabase ... --linked` nos planos 09-10 (4x), 09-12 (1x), 09-14 (6x):** exigem SUPABASE_ACCESS_TOKEN, que nao existe. Contorno provado: trocar por `--db-url "$SIH_PIPELINE_DB_URL"` (funciona em db push, db query e db dump). Alternativa: operador gera Personal Access Token.
- **`psql` fora do PATH default:** exige `export PATH="$(brew --prefix libpq)/bin:$PATH"`. Necessario em 09-10 e 09-14.
- **RESTRICAO DE ORDEM PARA O 09-10 (nao e bloqueio de capacidade, registrada pelo 09-06):** o dimensionamento real da populacao (D-24) mediu ~146 MB para as 4 tabelas `sih_population_*` (13 anos, medido via carga real num Postgres local com o schema da 09-03 -- nao a projecao conservadora de ~420 MB). O operador confirmou `popsvs-no-banco` (2026-08-10): as 4 tabelas vao para o Postgres, sem desvio do D-24. Mas o espaco ja ocupado hoje (327 MB, medido) inclui 319 MB de `sih_metric_muni` -- dado TabNet legado que D-16/D-20 ja decidiram evacuar para o Storage no proprio 09-10. **Se o `COPY` da populacao rodar ANTES de o 09-10 evacuar `sih_metric_muni`, o combinado mede ~472 MB contra o teto de 500 MB -- margem de so ~28 MB (ou ~4,5 MB em bytes decimais).** O 09-10 precisa evacuar o grao municipio (D-20) antes, ou na mesma transacao, de subir a populacao. Ver `pipeline/sih/reports/populacao-dimensionamento.md` §5-6 e `09-06-SUMMARY.md` §"Next Phase Readiness" para a medicao completa.
- **SC-7 NAO FECHADO (09-08):** 33/98 exato, 7/98 explicado, **58/98 inexplicado**, `ReconciliationResult.ok = False`. O SC-7 do ROADMAP (linha 144) exige exato OU razao escrita por categoria divergente, sem banda de tolerancia (D-02) — logo o criterio NAO esta atendido hoje. A hipotese central do 09-RESEARCH (faixa CID larga absorvendo faixa estreita) foi **testada e descartada por medicao** nas 7 categorias de maior delta: toda faixa declarada e exatamente a faixa oficial da Lista Morb. A causa provavel restante e competencia de processamento (`ANO_CMPT`) vs data de internacao (`DT_INTER`), ja medida pelo spike: reagregar por `DT_INTER` leva o vies de +4,14% para +3,45% — **reduz mas nao zera**. Nenhum mecanismo conhecido fecha o SC-7 em zero inexplicados, e nenhum plano da fase tem no escopo mexer em `aggregate.py` (dono: 09-07) nem baixar 2020. DECISAO DO OPERADOR (2026-08-10): seguir para 09-06/09-09 e decidir o residuo no checkpoint clinico em lote do **09-11**. Sobreposicoes residuais abertas para aquele checkpoint: `9 A19 <-> 14 A19` e `77 P35-P37 <-> 274 P35-P37`.

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
- [Phase ?]: [Phase 08-09]: Alias match computed once per query inside useMemo (never per-disease inside DISEASES.filter), unioned with diseaseMatches' id/CID pool without duplicating
- [Phase ?]: [Phase 08-09]: D-18 strip is role=status, strictly above the disease list, never a per-row badge — deliberate exemption from the 'no avc text outside search field' test, scoped to the list container
- [Phase ?]: [Phase 08-09]: Variaveis search DOES get the alias layer (withDiseaseAliases matches CatalogEntry.packId to DiseaseDef.packId) — two AVC codes + TVP have physical packs, so post-canonization search for avc would otherwise silently return zero on this second screen
- [Phase ?]: [Phase 08-09]: noTombstoneLiterals.test.ts allowlist extended 5->7 paths (MeasureDiseasePicker.test.tsx, VariaveisPage.test.tsx) — same class of exclusion as diseaseAliases.test.ts (08-07): alias terms typed as search queries, never disease ids
- [Phase ?]: [Phase 08-10]: supabase db query --linked -f used instead of the dashboard SQL Editor for contagens.sql — non-interactive agent has no browser/db password; same single-execution, read-only semantics via the CLI's own Management-API session
- [Phase ?]: [Phase 08-10]: Production migration applied (supabase db push, 46.6s wall vs rehearsal's 3.674s SQL-only time) — 21 disease ids renamed, code-330 inserted, live verified 331/30313/1099403 (PostgREST), TAX-06 set-identity confirmed byte-for-byte against seed SQL. TAX-03/TAX-04 closed.
- [Phase 09-02]: pysus pinado exatamente em 1.0.1 (nunca >=/~=) — a 2.x devolve arquivos RJ/SP sob o nome do grupo RD pedido, defeito medido no spike 2026-08-04
- [Phase 09-02]: cli.py (despachante dos subcomandos pipeline:*) tem dono único: plano 09-04 — nenhum outro plano da fase o edita
- [Phase 09-02]: astral-sh/setup-uv pinado por SHA de commit (c771a70e6277c0a99b617c7a806ffedaca235ff9, tag v9.0.0) resolvido ao vivo via gh api, não hardcoded
- [Phase 09-07]: MORTE chega como string (nao Int64 como o RESEARCH assumiu) -- medido ao vivo em RDAC1901.parquet; _cast_morte() verifica o tipo real e levanta TypeError para tipo inesperado
- [Phase 09-07]: build_index (matcher.py) agrupa tokens por letra inicial do CID, provado identico a varredura linear do spike por teste dedicado -- real speedup sem mudar semantica de primeira-correspondencia
- [Phase 09-07]: disease_id resolvido de diseases.json por tabnetCode (dict), nunca slugify(label) local -- evita reintroduzir defeito de ids da Fase 8
- [Phase ?]: [Phase 09-08] Row.territorio_codigo no grao UF e codigo IBGE numerico (12); oraculo chaveia por sigla (AC) -- reconcile.py traduz via codigos.UF_POR_CODIGO antes de comparar, achado ao vivo na primeira medicao (todos os 98 pares apareciam ausentes ate o fix)
- [Phase ?]: [Phase 09-08] Correcao em cadeia de 3 codigos (14->A19, 74->B90, 75->B91) para resolver a colisao estrutural 75/76 sem criar colisao nova com 74 -- decidido apos medir que a correcao isolada de 75 colidiria com o valor atual de 74
- [Phase ?]: [Phase 09-08] Hipotese faixa larga absorve faixa estreita testada e DESCARTADA por medicao nas sete categorias de maior delta absoluto em AC/2019 -- todas as faixas CID declaradas ja sao as oficiais e completas da Lista Morb, sem sobreposicao
- [Phase ?]: [Phase 09-08] 58/98 pares deixados honestamente inexplicado, nao convertidos em divergencia de lote sem verificacao individual -- residue hidden by tuning e o que o D-02 existe para proibir
- [Phase 09-06]: Decisao do operador: popsvs-no-banco -- as 4 tabelas sih_population_* vao para o Postgres (D-24 como escrito), decidido pela medicao real de ~146 MB (nao a projecao conservadora de ~420 MB) — Restricao de ORDEM registrada para o 09-10: evacuar sih_metric_muni (D-20) antes ou junto de subir a populacao, senao o combinado mede ~472 MB contra o teto de 500 MB
- [Phase 09-06]: Decisao do operador: POPSVS confirmado como fonte unica do denominador -- Assumption A3 do RESEARCH (confianca MEDIUM) resolvida por julgamento de dominio (liga academica de cirurgia vascular) — TabNet usa POPSVS nos modulos epidemiologicos (projecao intercensitaria por componentes, com faixa etaria/sexo) e POPTCU so no repasse fiscal (sem esse recorte) -- divergencia medida (AC/2019 -2,72%, Brasil/2019 -1,07%) e a diferenca metodologica esperada, nao um risco de escolha errada
- [Phase 09-09]: Decisao do operador (D-21, 2026-08-10): manter-por-uf -- 27 particoes, uma por UF, zero desvio. SP (maior UF projetada) cabe com folga de 2,4x no teto de 50 MB/objeto confirmado ao vivo (tentativa real de elevar para 100 MB rejeitada pela plataforma, 413 EntityTooLarge)
- [Phase 09-09]: Item de acompanhamento registrado -- decisao manter-por-uf se apoiou em medicao real so do AC (14/156 arquivos-mes) e projecao rotulada para as 26 UFs restantes; SP precisa ser remedida de verdade apos a corrida completa do 09-04, sugerido o 09-12 (auditoria de cobertura) como dono
- [Phase 09-09]: Bucket sih-municipio auditado -- RLS habilitado com zero policies em storage.objects (default-deny confirmado por pg_policies E por tentativa real de escrita anonima recusada); leitura anonima funciona pelo caminho separado do endpoint publico do bucket, nao por RLS de objects

### Pending Todos

None yet.

### Blockers/Concerns

- [09-01] Bloqueado em checkpoint humano: Task 1 (credencial Postgres D-17, Session Pooler) exige que o operador crie `.env.pipeline` fora do agente — `.gitignore` já cobre o arquivo (commit 1817b1b). Task 2 (ordem de coleta D-23) é `checkpoint:decision` e só roda depois.
- [09-03] Task 3 (aplicar supabase db push --linked em producao) bloqueada: SUPABASE_ACCESS_TOKEN nao disponivel (nem env var, nem ~/.supabase/access-token, nem .env.pipeline — mesma credencial D-17 que bloqueia 09-01 Task 1). Tasks 1-2 completas e commitadas (882221c, 03abaf5); Task 3 aguarda o operador criar .env.pipeline com o token.
- [09-09] RESOLVIDO 2026-08-10: checkpoint D-21 respondido pelo operador -- `manter-por-uf` confirmado (27 particoes, uma por UF, zero desvio). Item de acompanhamento registrado para o futuro (nao bloqueia nada hoje): a decisao se apoiou em MEDICAO real so para o AC (66.109 B comprimidos, 14/156 arquivos-mes locais disponiveis) e em PROJECAO rotulada para as 26 UFs restantes (metodo ponderado pela distribuicao real do sih_metric_muni legado por UF -- 139,0 MB total projetado, SP=maior com 15,2-20,5 MB, 2,4x-3,3x abaixo do teto de 50 MB/objeto confirmado AO VIVO). **Depois que a corrida completa do 09-04 rodar, a particao de SP (e idealmente MG/BA/RS/PR) precisa ser MEDIDA de verdade e conferida contra o teto de 50 MB** -- sugerido o 09-12 (auditoria de cobertura) como dono natural dessa verificacao; nenhum plano da fase tem isso no escopo declarado hoje. Ver pipeline/sih/reports/particoes-dimensionamento.md §9 e 09-09-SUMMARY.md §"Next Phase Readiness".

## Session Continuity

Last session: 2026-08-10T15:12:49.407Z
Stopped at: Fase 09 Plano 09 completo: partitions.py (produtor colunar+gzip das particoes de municipio, D-20/D-21), bucket sih-municipio criado e auditado ao vivo (leitura anonima comprovada, escrita anonima recusada, teto de 50 MB confirmado), loadMunicipioPartition.ts (consumidor TS com DecompressionStream nativo e cache por promessa). Checkpoint D-21 respondido pelo operador -- manter-por-uf confirmado, com item de acompanhamento registrado para remedir SP apos a corrida completa do 09-04.
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
| Phase 08-taxonomia-can-nica-integridade P09 | ~20min | 3 tasks | 7 files |
| Phase 08-taxonomia-can-nica-integridade P10 | ~15min (continuation session) | 4 tasks | 2 files |
| Phase 09-pipeline-confi-vel-coleta-completa P02 | ~12min | 3 tasks | 20 files |
| Phase 09-pipeline-confi-vel-coleta-completa P07 | 35min | 3 tasks | 9 files |
| Phase 09 P08 | ~45min | 3 tasks | 6 files |
| Phase 09-pipeline-confi-vel-coleta-completa P06 | ~55min | 2 tasks | 4 files |
| Phase 09-pipeline-confi-vel-coleta-completa P09 | ~25min ativos | 3 tasks | 6 files |
