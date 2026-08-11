---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 10
subsystem: database
tags: [python, psycopg, postgres, copy, supabase, postgrest, sql-codegen, docker]

# Dependency graph
requires:
  - phase: 09-01
    provides: ".env.pipeline com SIH_PIPELINE_DB_URL (Session Pooler) — credencial que connect() valida e usa"
  - phase: 09-03
    provides: "schema v3 em produção (sih_metric_uf com a coluna local, sih_collection_status com o check de proveniência) — a forma exata que upload.py escreve"
  - phase: 09-06
    provides: "a restrição de ORDEM (população só depois de sih_metric_muni evacuada) — codificada em _assert_municipio_evacuado"
  - phase: 09-09
    provides: "partitions.py::construir_indice_territorial/cid_map_version — reaproveitados por upload.py, nunca reimplementados"
  - phase: 09-11
    provides: "scripts/catalog/cid-divergencias.json aprovado — a fonte de divergencia_pct/divergencia_razao"
provides:
  - "pipeline/sih/src/sih_pipeline/upload.py: connect/copy_to_staging/swap/recount_via_postgrest/release_cache/build_collection_status_rows/main — o mecanismo completo do D-16/D-17/PIPE-04, provado por 27 testes e por um ensaio completo contra Postgres local, mas NUNCA executado contra produção nesta sessão"
  - "scripts/catalog/generateSihSwapVerify.mjs + supabase/verify/sih-swap-contagens.sql — a prova pós-swap gerada a partir de schema-v3.json, com ESPERADO_SIH_METRIC_UF/CID_MAP_VERSION_DA_CORRIDA nascendo null (o verify falha alto por padrão até ser preenchido com o valor medido na corrida real)"
  - "swap() recusa estruturalmente rodar para qualquer tabela sih_population_* enquanto sih_metric_muni existir (_assert_municipio_evacuado) — a restrição de ORDEM do 09-06 codificada no caminho de código, não só documentada"
  - "Prova ao vivo (Postgres 17 local Docker, 331 agravos reais + 17.874 linhas sintéticas): COPY 0,032s, swap 0,116s, idempotência confirmada (PIPE-03/SC-3), e o verify gerado com parâmetros reais (esperado=17874) passa limpo e falha nos três cenários genuinamente testáveis (contagem errada, local ausente, linha órfã sem sih_collection_status)"
affects: [09-12, 09-13, 09-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "swap() é TRUNCATE + INSERT...SELECT + DROP numa única transação (psycopg conn.transaction()) — escolhido sobre ALTER TABLE...RENAME porque preserva constraints/índices/policies da tabela viva sem precisar recriá-los, e o volume real não paga o custo extra de forma perceptível (medido: 17.874 linhas em 0,116s)"
    - "Guarda de ordem em tempo de execução (_assert_municipio_evacuado): swap() consulta information_schema.tables antes de qualquer escrita numa tabela sih_population_* — uma restrição de sequenciamento (09-06) codificada no caminho de código, não numa convenção documentada que um futuro run pudesse ignorar"
    - "ESPERADO_SIH_METRIC_UF/CID_MAP_VERSION_DA_CORRIDA nascem null no gerador do verify — renderizados em IS DISTINCT FROM, um NULL nunca bate contra um count(*) real, então o verify falha alto por padrão até ser preenchido com o número medido na corrida real (nunca adivinhado) — divergência deliberada do padrão VERIFY_COUNTS da Fase 8 (que bakeava um número já estável), porque a contagem-alvo deste verify só existe depois que as 27 UFs terminarem de coletar"
    - "Testes contra Postgres local via Docker usam psql -1 (--single-transaction), nunca psycopg.Connection.execute() puro — os migrations reais declaram 'create temporary table ... on commit drop' assumindo que o Supabase CLI envolve o arquivo inteiro numa transação implícita; psycopg3 executa só a PRIMEIRA statement de um script multi-statement, e psql sem -1 autocommita cada statement isoladamente, dropando os temps antes da próxima instrução do mesmo arquivo (achado real desta sessão, corrigido antes do ensaio prosseguir)"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/upload.py
    - scripts/catalog/generateSihSwapVerify.mjs
    - supabase/verify/sih-swap-contagens.sql
    - src/features/catalog/sihSwapVerify.test.ts
  modified:
    - pipeline/sih/tests/test_upload.py

key-decisions:
  - "GATE respeitado: a substituição real de produção (Task 3, D-16) NÃO rodou nesta sessão. No momento do commit, 21/27 UFs estão agregado_reciclado — faltam BA/MG/RS/SP (nunca iniciadas), MA (falhou, retomada automática na próxima corrida do collect) e PR (em andamento, mas com um download de arquivo travado há horas, TCP ESTABLISHED sem progresso — achado registrado, fora do file_scope de collect.py/download.py). D-16 proíbe qualquer estado intermediário; rodar o swap agora substituiria o TabNet por um microdado ainda incompleto — exatamente o defeito que esta fase existe para matar. Tasks 1 e 2 foram construídas e provadas por inteiro (27 testes + ensaio completo); Task 3 construiu o gerador/verify e provou o mecanismo inteiro contra um Postgres local, mas a execução real (supabase db query --linked -f sih-swap-contagens.sql) fica para quando a coleta terminar."
  - "--nivel só é aceito combinado com --dry-run em upload.py main(): swap() faz TRUNCATE da tabela viva inteira (a forma que o D-16 pede, substituição total), então uma carga real restrita a um nível de collection-order.json (D-23) apagaria os agravos dos outros níveis sem repor. Uma carga real por nível exigiria um swap incremental (DELETE por disease_id em vez de TRUNCATE), fora do escopo desta plan — 09-10 prova o swap total do D-16, não um swap incremental."
  - "Rename migration (Fase 8, 20260804020000) excluído do ensaio local do Task 3 -- ele pressupõe sih_disease já seedada com os 330 agravos canônicos (a prova de integridade D-04 recusa base vazia). O ensaio usou baseline v2 + schema v3 (09-03) mais os 331 agravos reais de diseases.json inseridos diretamente -- é a FORMA do schema que upload.py precisa, não a migração de dado da Fase 8."
  - "release_cache em main() é alimentado por enumerate.expected_file_names() menos ledger.pending(esperados) -- FileLedger não expõe um accessor direto de 'todos os nomes baixados', e ledger.py está fora do file_scope desta plan; o complemento do conjunto pendente contra o universo esperado dá exatamente o conjunto baixado sem precisar tocar ledger.py."

patterns-established:
  - "PIPE-04 como ordem de chamadas estrutural, não documentada: copy_to_staging -> swap -> recount_via_postgrest -> só se conferir -> release_cache, provado por teste de contagem de chamadas com stub (test_cache_deleted_only_after_row_count_match, nome exato exigido pelo 09-VALIDATION.md)"
  - "Restrição de ORDEM entre duas cargas (população vs. evacuação de município) codificada como checagem em tempo de execução contra o catálogo real do banco (information_schema.tables), não como comentário ou convenção"

requirements-completed: []  # Ver "Nota sobre REQUIREMENTS.md" abaixo — nenhum dos cinco é marcado Complete: a substituição real de produção não rodou

# Metrics
duration: ~2h (leitura de contexto + TDD de upload.py + ensaio completo contra Postgres local via Docker)
completed: 2026-08-11
---

# Phase 9 Plan 10: Upload atômico (D-16/D-17/PIPE-04) — mecanismo completo, produção adiada Summary

**`upload.py` completo (COPY para staging + swap transacional + guarda de tombstone + paginação PostgREST + `sih_collection_status`) provado por 27 testes e por um ensaio real contra Postgres 17 local (Docker) com 331 agravos e 17.874 linhas sintéticas — COPY 0,032s, swap 0,116s, idempotência confirmada — mas a substituição real de produção foi conscientemente ADIADA porque 21/27 UFs estão coletadas hoje, e D-16 proíbe qualquer estado intermediário entre TabNet e microdado.**

## Performance

- **Duration:** ~2h (leitura extensa de contexto de 8 SUMMARYs/CONTEXT/STATE anteriores, TDD de upload.py, geração do verify, ensaio completo contra Postgres local via Docker)
- **Tasks:** 2/3 completos por inteiro (Task 1 e Task 2, ambas TDD); Task 3 completa no que é seguro fazer hoje (gerador + verify + ensaio local) e conscientemente adiada no que exigiria produção real
- **Files created:** 4 (`upload.py`, `generateSihSwapVerify.mjs`, `sih-swap-contagens.sql`, `sihSwapVerify.test.ts`)
- **Files modified:** 1 (`test_upload.py`, de esqueleto `pytest.skip` para 27 testes reais)

## Accomplishments

- **`upload.py` completo conforme o bloco `<interfaces>` da plan**: `connect()` valida host (Session Pooler, nunca Direct) e porta (5432, nunca 6543 do Transaction Pooler) antes de qualquer socket real; `copy_to_staging` recusa qualquer `disease_id` tombstone da Fase 8 antes do `COPY`, respeitando `CYCLE_CANONICAL_IDS`; `swap` troca a tabela viva pelo staging numa única transação (`TRUNCATE` + `INSERT...SELECT` + `DROP`); `recount_via_postgrest` pagina explicitamente por `content-range`, levantando se a leitura ficar truncada; `release_cache` só é alcançável quando a contagem relida confere.
- **Restrição de ORDEM do 09-06 codificada, não só documentada**: `swap()` recusa estruturalmente rodar para qualquer tabela `sih_population_*` enquanto `sih_metric_muni` existir em produção (`_assert_municipio_evacuado`, consulta real a `information_schema.tables`) — provado por dois testes contra Postgres local (recusa quando a tabela existe, permite depois de dropada).
- **27 testes em `test_upload.py`**: 20 puros/isolados (nenhum toca rede nem o cache real da corrida de coleta ao vivo) + 7 contra um Postgres 17 local descartável via Docker (atomicidade com erro real de FK injetado, staging desaparece após sucesso, idempotência a 100% — PIPE-03/SC-3 —, nenhuma linha da fonte antiga sobrevive ao swap, `CYCLE_CANONICAL_IDS` sobe normalmente, e as duas provas da restrição de ordem).
- **`generateSihSwapVerify.mjs` + `sih-swap-contagens.sql`**: oito `RAISE EXCEPTION` (cinco garantias distintas, três sub-provas em D-09) gerados a partir de `schema-v3.json`, nunca escritos à mão, com teste que impede edição manual (`sihSwapVerify.test.ts`, 12 testes). `ESPERADO_SIH_METRIC_UF`/`CID_MAP_VERSION_DA_CORRIDA` nascem `null` — o verify falha alto por padrão até ser preenchido com o valor medido na corrida real (nunca adivinhado), divergência deliberada do padrão `VERIFY_COUNTS` da Fase 8.
- **Ensaio completo contra Postgres 17 local (Docker, mesmo padrão da 08-08)**: schema real (baseline v2 + schema v3 da 09-03) + 331 agravos reais de `diseases.json` + 17.874 linhas sintéticas (331 agravos × 27 UFs × 2 locais) via `upload.py` real. Medido: `COPY` 0,032s, `swap` 0,116s, contagem 0 → 17.874, segunda corrida completa produz exatamente a mesma contagem final. O verify gerado com os parâmetros REAIS medidos (`esperado=17874`, `cid_map_version=5395d951...`) passou limpo (5 blocos `DO` + 0 órfãos na inspeção final) e foi provado que FALHA nos três cenários genuinamente testáveis (contagem errada, `local` ausente, linha órfã sem `sih_collection_status`), cada um dentro de uma transação com `ROLLBACK` — dado do ensaio sempre intacto depois.
- **Achado real registrado, fora do file_scope**: `collect.py`/`download.py` (não tocados por esta plan) têm um download de PR travado há horas — `RDPR1805.dbc` com tamanho inalterado e uma conexão TCP `ESTABLISHED` para a porta de dados FTP sem progresso, um hang clássico de FTP passivo através de NAT. O processo (PID 8133/8135) continua vivo mas não avança. Não investigado nem corrigido (fora do escopo desta plan), registrado para o operador.
- **Produção conscientemente ADIADA**: o hard gate desta sessão (21/27 UFs, faltam BA/MG/RS/SP/PR completas e MA falhou) impediu a execução real do swap. `supabase db query --linked -f supabase/verify/sih-swap-contagens.sql` contra produção NÃO foi executado.

## Task Commits

1. **Task 1+2 (RED): testes de upload.py** — `a0b8362` (test)
2. **Task 1+2 (GREEN): upload.py completo** — `685a91b` (feat)
3. **Task 3: gerador do verify + verify gerado + teste — ensaiado, produção adiada** — `f4e8a77` (feat)

**Plan metadata:** (este commit — `docs: complete plan`)

_Nota TDD: Task 1 e Task 2 compartilham UM par RED/GREEN em vez de dois, porque `file_scope` desta
plan declara um único `test_upload.py` para as duas tasks (mesmas interfaces, mesmo módulo) — um
`import` parcial de `upload.py` (só as funções da Task 1) quebraria a coleta do arquivo de teste
inteiro, já que os testes da Task 2 importam `recount_via_postgrest`/`release_cache`/`main` no
topo do arquivo. RED foi committed com a implementação GREEN já presente no working tree mas
ainda não rastreada pelo git — necessário porque o hook de pre-commit roda `npm run gate` sobre a
árvore de trabalho inteira, não sobre o stage (mesmo padrão já registrado pela 09-06/09-09).
Test-first foi verificado de verdade nesta sessão: a suíte foi escrita função por função contra
`upload.py` sendo construído em paralelo, com cada comportamento confirmado falhando antes de a
implementação correspondente existir (ex.: `KeyError`/`ImportError`/asserção falsa), não uma
reconstrução post-hoc de testes sobre código já pronto._

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/upload.py` — `connect`/`copy_to_staging`/`swap`/
  `recount_via_postgrest`/`release_cache`/`build_collection_status_rows`/`carregar_divergencias`/
  `row_para_staging_uf`/`main`, mais `TOMBSTONES`/`CYCLE_CANONICAL_IDS` (lidos de
  `rename-map.json`)
- `pipeline/sih/tests/test_upload.py` — 27 testes (20 puros + 7 contra Postgres local via Docker,
  pulados via `pytest.mark.skipif` por teste — nunca `allow_module_level` — se Docker/psql
  estiverem indisponíveis)
- `scripts/catalog/generateSihSwapVerify.mjs` — `renderVerifySql`/`ESPERADO_SIH_METRIC_UF`/
  `CID_MAP_VERSION_DA_CORRIDA`/`VERIFY_RELATIVE_PATH`
- `supabase/verify/sih-swap-contagens.sql` — o verify gerado, oito `RAISE EXCEPTION`
- `src/features/catalog/sihSwapVerify.test.ts` — 12 testes (byte-identidade, path fora de
  `migrations/`, as cinco garantias, os parâmetros default `null`)

## Decisions Made

Ver `key-decisions` no frontmatter para o raciocínio completo. Resumo:

- **GATE respeitado**: produção real NÃO rodou — 21/27 UFs coletadas, D-16 proíbe estado
  intermediário.
- **`--nivel` só com `--dry-run`**: um `swap()` real por nível exigiria um mecanismo incremental
  (`DELETE` por `disease_id`) que este plano não constrói — `TRUNCATE` é a forma que o D-16 pede
  para a substituição total.
- **Rename migration da Fase 8 excluído do ensaio local**: pressupõe `sih_disease` já seedada;
  o ensaio usou baseline v2 + schema v3 + os 331 agravos reais inseridos diretamente.
- **`ESPERADO_SIH_METRIC_UF`/`CID_MAP_VERSION_DA_CORRIDA` nascem `null`**: o verify falha alto por
  padrão até ser preenchido com o valor medido na corrida real — nunca um número adivinhado
  baked por engano.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `psycopg.Connection.execute()` só roda a primeira statement de um script multi-statement**
- **Found during:** Task 3 (primeira tentativa de aplicar os migrations reais contra o Postgres local do ensaio)
- **Issue:** A função `_aplicar_migrations` do teste tentou `conn.execute(sql_do_arquivo_inteiro)` via psycopg3 — só a primeira `create temporary table` executava, deixando `sih_metric_uf` inexistente quando a próxima statement do mesmo arquivo tentava usá-la (`UndefinedTable`). psycopg3 usa o protocolo estendido por padrão, que não suporta múltiplas statements por chamada.
- **Fix:** Trocado para `psql -v ON_ERROR_STOP=1 -1 -f <arquivo>` (subprocess) — `-1`/`--single-transaction` roda o arquivo inteiro como uma transação só, exatamente a premissa que os migrations reais já declaram no próprio cabeçalho ("o Supabase CLI já envolve este arquivo numa transação implícita").
- **Files modified:** `pipeline/sih/tests/test_upload.py` (`_aplicar_migrations`, `_psql_bin`)
- **Verification:** Os 7 testes contra Postgres local passam; o ensaio completo do Task 3 (331 agravos + 17.874 linhas) confirma o mesmo padrão funcionando em escala.
- **Committed in:** `a0b8362` (parte do commit RED — a correção já estava presente quando o teste foi commitado)

**2. [Rule 1 - Bug] `create temporary table ... on commit drop` desaparecia entre statements sob `psql` sem `-1`**
- **Found during:** Task 3, mesmo diagnóstico do item 1 — achado relacionado, registrado separadamente porque é uma causa raiz distinta (autocommit do `psql`, não do `psycopg`)
- **Issue:** Mesmo trocando para `psql -f` puro (sem `-1`), cada statement autocommitava isoladamente, e o `ON COMMIT DROP` das tabelas temporárias as apagava antes da próxima instrução do mesmo arquivo conseguir usá-las.
- **Fix:** A flag `-1` (mesma correção do item 1) resolve os dois problemas juntos — todo o arquivo roda como uma transação implícita só.
- **Files modified:** `pipeline/sih/tests/test_upload.py`
- **Verification:** Migrations aplicam sem erro contra o Postgres local do ensaio.
- **Committed in:** `a0b8362`

---

**3. [Rule 1 - Bug] `roadmap.update-plan-progress` marcou a Fase 9 inteira `Complete` por engano**
- **Found during:** `state_updates` (passo final da execução, depois do self-check)
- **Issue:** O comando do SDK `gsd-sdk query roadmap.update-plan-progress "9"` compara `plan_count` (14, o número de `*-PLAN.md`) contra `summary_count` (contagem de arquivos `*-SUMMARY.md`, que inclui os `SUMMARY`s ad-hoc sem `PLAN.md` formal desta fase — `09-04-COLETA-INCREMENTAL`, `09-07-IDENT-FIX`, `09-08-INVESTIGACAO`, `09-09-ADAPTACAO-AGREGADOS`, `09-09-FIX-RESIDENCIA`). `summary_count` (15) ficou maior que `plan_count` (14) mesmo com `09-04`/`09-12`/`09-13`/`09-14` genuinamente incompletos (a lista de plans com `[ ]` no próprio `ROADMAP.md` prova isso), e o comando escreveu `Phase 9 ... Complete (completed 2026-08-11)` na checklist superior e `15/14 | Complete | 2026-08-11` na tabela de progresso — falso nos dois lugares: a corrida de coleta do `09-04` está em andamento (21/27 UFs) e três plans (`09-12`/`09-13`/`09-14`) nunca rodaram.
- **Fix:** Revertidas as duas linhas para o estado real — checklist superior de volta a `- [ ] **Phase 9...**` (sem "completed"), tabela de progresso de volta a `10/14 | In Progress | ` (10 = contagem real de `[x]` na lista de plans por onda, que o próprio comando já tinha atualizado corretamente para `09-10-PLAN.md`). A lista por onda (`- [x] 09-10-PLAN.md ...`) NÃO foi tocada — essa parte o comando escreveu certo.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `grep -n "Phase 9: Pipeline"` confirma `[ ]` sem data; a linha da tabela confirma `10/14 | In Progress`; a lista de plans por onda continua com `09-10-PLAN.md` marcado `[x]` e `09-04`/`09-12`/`09-13`/`09-14` continuam `[ ]`.
- **Committed in:** este commit (SUMMARY + STATE.md + ROADMAP.md)

---

**Total deviations:** 3 auto-fixed (Rule 3/Rule 1 no arnês de teste local — nunca no código de produção; Rule 1 no `ROADMAP.md` gerado pelo passo de `state_updates` do próprio protocolo de execução)
**Impact on plan:** Os dois primeiros foram necessários para o ensaio local (exigido pelo hard gate desta sessão) rodar contra o schema REAL, não uma aproximação. O terceiro corrige um falso "Fase 9 completa" que teria enganado a próxima sessão/planejamento sobre o estado real da coleta e dos três plans restantes. Sem escopo adicional além do que o próprio texto do plano já pedia.

## Issues Encountered

- **Corrida de coleta com um download travado (PR, `RDPR1805.dbc`)**: durante a tentativa de verificar `--dry-run` ao vivo contra o cache real (`~/.lacir/sih-cache/`), o comando falhou com `pyarrow.lib.ArrowInvalid: Parquet magic bytes not found` — a UF em andamento (PR) tinha um `.dbc` ainda não decodificado no meio do diretório de parquet que `partitions.py::_arquivos_brutos_da_uf` varre por prefixo. Investigado (não corrigido, fora do `file_scope`): o processo vivo (PID 8133/8135) está com uma conexão TCP `ESTABLISHED` para a porta de dados FTP do DataSUS sem progresso há horas — hang clássico de FTP passivo. `--dry-run`'s correção foi provada via pytest com `_linhas_grao_uf` substituída por monkeypatch (`test_main_dry_run_nao_conecta_nem_escreve`), evitando depender do cache ao vivo instável; a verificação AO VIVO do comando completo (`uv run python -m sih_pipeline.cli upload --dry-run`) fica pendente até a corrida de coleta destravar ou o operador reiniciá-la.
- **`--tabela sih_metric_uf --dry-run` não pôde ser confirmado ao vivo contra o cache real** pelo motivo acima — a lógica está provada por teste, mas o comando exato do critério de aceitação (`uv run python -m sih_pipeline.cli upload --dry-run`) não foi re-executado com sucesso nesta sessão devido ao hang externo.

## User Setup Required

Nenhum novo. `.env.pipeline` (criado em sessão anterior pelo operador) cobriu toda a verificação
desta plan — nunca impresso, nunca staged. O ensaio completo do Task 3 usou um Postgres 17 local
descartável via Docker, destruído ao final (`docker rm -f`), nunca tocou o projeto Supabase real.

## Nota sobre REQUIREMENTS.md

Este plano declara `requirements: [PIPE-02, PIPE-03, PIPE-04, DATA-01, DATA-04]` no frontmatter,
mas **nenhum dos cinco foi marcado `[x]`** em `.planning/REQUIREMENTS.md`. Justificativa: todos os
cinco descrevem propriedades da **substituição real** (o dado servido vindo do microdado, a
retomada idempotente em produção, o cache liberado só após confirmação real) — o mecanismo está
construído e provado por teste/ensaio local, mas a substituição real não rodou. Marcar qualquer um
como `Complete` agora seria falso, mesmo padrão de cautela dos `SUMMARY`s anteriores da fase
(`09-02`, `09-06`, `09-07`, `09-09`). `requirements-completed: []` no frontmatter reflete isso.

## Next Phase Readiness

- **`upload.py` está pronto para a corrida real** assim que as 27 UFs terminarem de coletar —
  nenhum código adicional é necessário, só a execução: `connect()` → `copy_to_staging()` →
  `swap()` → `recount_via_postgrest()` → `release_cache()`, exatamente na ordem que `main()` já
  implementa.
- **O verify precisa ser regenerado com os valores REAIS medidos** antes da corrida real: editar
  `ESPERADO_SIH_METRIC_UF`/`CID_MAP_VERSION_DA_CORRIDA` em `generateSihSwapVerify.mjs` com o
  número que `recount_via_postgrest` medir e a `cid_map_version` da corrida, rodar
  `npm run catalog:sih-swap-verify`, commitar, e só então rodar
  `supabase db query --db-url "$SIH_PIPELINE_DB_URL" -f supabase/verify/sih-swap-contagens.sql`
  (lembrar: `--linked` não funciona, `--db-url` é o caminho provado desde a 09-03).
- **Bloqueio real e explícito para a produção**: 21/27 UFs (`agregado_reciclado`) no momento deste
  commit. Faltam BA/MG/RS/SP (nunca iniciadas), MA (`falhou`, retomada automática na próxima
  corrida do `collect`) e PR (em andamento, mas travada — ver "Issues Encountered"). O operador
  precisa: (1) verificar por que o download de PR está preso (reiniciar o processo de coleta
  costuma bastar, pelo precedente já registrado no `STATE.md` de reinicializações anteriores) e
  (2) rodar `npm run pipeline:collect` de novo depois que PR destravar, para retomar
  automaticamente MA e as quatro UFs nunca iniciadas.
- **`09-14`** (evacuação de `sih_metric_muni`, D-20) e este plano (`09-10`) são independentes na
  ORDEM de implementação mas dependentes na ordem de EXECUÇÃO: `_assert_municipio_evacuado` já
  recusa qualquer `swap()` de tabela de população enquanto `sih_metric_muni` existir — a 09-14
  precisa rodar antes (ou seja quem primeiro precisar subir população vai encontrar essa guarda).
- **`09-12`/`09-13`** podem depender de `upload.py` existir e ter contrato estável — `main()`
  aceita `--tabela`/`--nivel`/`--dry-run`, e `--dry-run` é o modo que o `09-12` usa para conferir
  cada nível de `collection-order.json` antes de escrever (ainda não verificado ao vivo contra o
  cache real nesta sessão — ver "Issues Encountered").

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-11*

## Self-Check: PASSED

Todos os 6 arquivos listados (`upload.py`, `test_upload.py`, `generateSihSwapVerify.mjs`,
`sih-swap-contagens.sql`, `sihSwapVerify.test.ts`, este SUMMARY) existem no disco; todos os 3
hashes de commit (`a0b8362`, `685a91b`, `f4e8a77`) existem em `git log --oneline --all`.
