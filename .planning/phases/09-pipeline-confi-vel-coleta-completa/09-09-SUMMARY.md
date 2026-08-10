---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 09
subsystem: infra
tags: [python, gzip, json-colunar, supabase-storage, rls, typescript, decompressionstream]

# Dependency graph
requires:
  - phase: 09-01
    provides: "scripts/catalog/collection-order.json (D-23) -- não consumido diretamente por esta plan, mas parte da ordem de dependência declarada"
  - phase: 09-06
    provides: "decisão do operador (popsvs-no-banco confirmado) -- absorvida antes de travar o formato de partição, exatamente como a plan exigia; a família v1/pop/ não é gerada"
  - phase: 09-07
    provides: "aggregate.py (Row, aggregate_years, GRAO_MUNICIPIO) e codigos.py (uf_de_municipio, UF_POR_CODIGO) -- a entrada de dados de partitions.py"
provides:
  - "partitions.py: build_partition/write_partition/upload_partition/cid_map_version/main -- produtor das 27 partições JSON colunar+gzip por UF, formato travado sobre medição real"
  - "Bucket sih-municipio criado e auditado: leitura anônima comprovada (GET 200, bytes idênticos), escrita anônima recusada (POST/PUT/DELETE, RLS default-deny confirmado por pg_policies + tentativa real), teto de 50 MB/objeto confirmado ao vivo"
  - "pipeline/sih/reports/particoes-dimensionamento.md: medição real do AC + projeção rotulada das 26 UFs restantes (corpus completo não baixado) + decisão do operador datada (manter-por-uf)"
  - "loadMunicipioPartition.ts: consumidor TypeScript com guarda de origem, DecompressionStream nativo, cache em memória por promessa"
affects: [09-10, 09-11, 09-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON colunar (arrays paralelos, uma lista por coluna) em vez de array de objetos -- evita repetir 9 nomes de coluna por linha; produtor Python e consumidor TypeScript compartilham a mesma fixture real (particao_exemplo.json.gz) para provar que os dois lados leem o mesmo byte"
    - "gzip determinístico (mtime=0) no produtor -- upload como blob opaco (content-type: application/octet-stream), nunca dependendo do cabeçalho de compressão do servidor (RESEARCH Pitfall 11, issue supabase-js#1883 aberta); DecompressionStream nativo no cliente, zero dependência npm"
    - "Cache em memória guardando a PROMESSA, não o valor (loadMunicipioPartition.ts) -- drills concorrentes na mesma UF compartilham um único fetch (T-09-35)"
    - "Sigla de UF validada por regex [A-Z]{2} antes de qualquer construção de URL -- fecha por construção qualquer tentativa de path traversal via o parâmetro uf (ASVS V13, T-09-34), reforçado pelo mesmo FORBIDDEN_HOST de loadCatalog.ts"
    - "Medição real limitada ao dado disponível (AC, 14/156 arquivos-mês locais) + projeção EXPLICITAMENTE ROTULADA (método ponderado pela distribuição real por UF do sih_metric_muni legado) para as 26 UFs sem corpus baixado -- nunca apresentada como medição"
    - "Auditoria de bucket Storage provada por dois caminhos independentes: consulta direta a pg_policies (zero policies) E tentativa real de escrita anônima (recusada) -- nenhuma prova sozinha bastaria"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/partitions.py
    - pipeline/sih/tests/test_partitions.py
    - pipeline/sih/tests/fixtures/particao_exemplo.json.gz
    - pipeline/sih/reports/particoes-dimensionamento.md
    - src/features/catalog/loadMunicipioPartition.ts
    - src/features/catalog/loadMunicipioPartition.test.ts
  modified: []

key-decisions:
  - "Decisão do operador (formato de partição, 2026-08-10): manter-por-uf -- 27 partições, uma por UF, o D-21 como escrito, zero desvio. Razões: SP (maior UF projetada) cabe com folga de 2,4x no teto de 50 MB/objeto confirmado AO VIVO (tentativa real de elevar para 100 MB rejeitada pela plataforma, 413 EntityTooLarge); egresso de 30 alunos baixando SP numa aula = 12% do teto mensal de 5 GB; preserva a série temporal municipal como 1 download (uf-por-ano quebraria isso)"
  - "Ressalva registrada explicitamente: a decisão foi tomada sobre PROJEÇÃO (método ponderado pela distribuição real do sih_metric_muni legado por UF), não medição direta, para 26 das 27 UFs -- só o AC tem dado local hoje (14 de 4.212 arquivos esperados, 0,33%). Item de acompanhamento: SP (e as demais UFs grandes) precisa ser MEDIDA de verdade depois da corrida completa do 09-04, e o 09-12 (auditoria de cobertura) é o candidato natural para essa verificação -- nenhum plano da fase tem isso no escopo hoje"
  - "Teto de 50 MB por objeto confirmado ao vivo contra o projeto real (não só citado do RESEARCH): tentativa de PUT elevando file_size_limit para 100 MB foi rejeitada pela própria plataforma Supabase (413 EntityTooLarge), e o bucket permaneceu em 52.428.800 B"
  - "Recusa de escrita anônima comprovada, mas com desvio honesto no código HTTP de transporte: POST/PUT/DELETE anônimos devolvem HTTP 400 de TRANSPORTE (confirmado com curl -v), não 401/403 como o critério de aceitação antecipava -- o corpo da resposta carrega '\"statusCode\":\"403\"'/'AccessDenied', convenção conhecida de como a API de Storage do Supabase envelopa erros de RLS. A substância da recusa é real e comprovada (nada foi escrito, listagem via service_role confirma) -- só a forma exata do código diverge do esperado"
  - "Auditoria de RLS: zero policies em storage.objects (qualquer role, qualquer comando), RLS habilitado (relrowsecurity=t), anon/authenticated com rolbypassrls=false, service_role com rolbypassrls=true -- é assim que upload_partition (via API de Storage autenticada) escreve mesmo sem nenhuma policy de insert, e é assim que anon fica em default-deny total pela via de tabela crua (a leitura pública passa pelo caminho separado do bucket 'public', não por RLS de objects)"

patterns-established:
  - "Produtor Python e consumidor TypeScript provados contra o mesmo byte (particao_exemplo.json.gz commitada e lida pelos dois lados) -- evita a classe de bug onde formato diverge silenciosamente entre as duas linguagens"
  - "Extrapolação sempre rotulada (MEDIDO vs PROJETADO/CALCULADO) quando o corpus completo não está disponível -- nunca apresentar projeção como medição, mesmo sob pressão de um critério de aceitação escrito assumindo dado completo"

requirements-completed: []  # DATA-02/PIPE-05 permanecem Pending -- ver "Nota sobre REQUIREMENTS.md" abaixo

# Metrics
duration: ~25min de trabalho ativo (mais ~3h40min de pausa aguardando a resposta do checkpoint D-21, fora do tempo de execução)
completed: 2026-08-10
---

# Phase 09 Plan 09: Partições de município no Storage — produtor, bucket auditado, consumidor Summary

**27 partições JSON colunar+gzip por UF, formato travado sobre medição real do AC (66.109 B comprimidos) e projeção rotulada das 26 UFs restantes (139 MB total, SP 15,2–20,5 MB), bucket `sih-municipio` criado com leitura anônima comprovada e escrita anônima recusada (RLS default-deny confirmado por `pg_policies` E por tentativa real), e consumidor TypeScript com `DecompressionStream` nativo no mesmo padrão de `loadCatalog.ts` — decisão do operador: `manter-por-uf`, o D-21 como escrito.**

## Performance

- **Duration:** ~25 min de trabalho ativo (Task 1 + medição real da Task 2, depois Task 2 fechamento + Task 3, após o checkpoint ser respondido) — mais uma pausa de ~3h40min aguardando a resposta do operador ao checkpoint `D-21`, que não conta como tempo de execução
- **Tasks:** 3/3 completos (Task 2 é `checkpoint:decision`, resolvida pelo operador)
- **Files modified:** 6 (`partitions.py`, `test_partitions.py`, `particao_exemplo.json.gz`, `particoes-dimensionamento.md`, `loadMunicipioPartition.ts`, `loadMunicipioPartition.test.ts`) + `STATE.md`

## Accomplishments

- `partitions.py`: `build_partition`/`write_partition`/`upload_partition`/`cid_map_version`/`main` — JSON colunar por UF (`disease_id`, `municipio_codigo`, `ano`, `local`, `internacoes`, `obitos`, `valor_total`, `dias_permanencia`, `taxa_mortalidade`), gzip determinístico, upload como blob opaco autenticado com `service_role`, 14 testes sobre a fixture real de AC/2019 (mesma do 09-07/09-08)
- Achado real durante o TDD: `MUNIC_RES` de um paciente internado no AC pode apontar para outra UF (D-09) — "grão município" sozinho não bastava para "só do AC"; `build_partition` valida e rejeita linhas de UF diferente, e a fixture de teste foi corrigida para agrupar de fato por UF (não só por grão) antes de montar a partição do AC
- **Medição real (Task 2):** AC medido de verdade via `partitions.py --uf AC --upload` sobre os 14 arquivos locais disponíveis (14/156 arquivos-mês do AC, 0,33% do corpus nacional) — 5.933 linhas, 281/331 `disease_id` distintos, 66.109 B comprimidos (11,6% de razão de compressão)
- **Bucket `sih-municipio` criado e auditado ao vivo:** `public=true`, `file_size_limit=52.428.800` (50 MB — confirmado como teto real da plataforma por uma tentativa de aumento REJEITADA, `413 EntityTooLarge`); `GET` anônimo real devolve HTTP 200 com bytes idênticos byte a byte ao arquivo local; `POST`/`PUT`/`DELETE` anônimos são recusados (corpo `403`/`AccessDenied`, nada escrito — confirmado por listagem via `service_role`), com o desvio honesto de que o transporte HTTP observado é 400, não 401/403; `pg_policies` mostra zero policies para `storage.objects`, RLS habilitado, `anon`/`authenticated` sem `bypassrls`
- **Projeção rotulada das 26 UFs sem dado local:** dois métodos calculados (ingênuo por fração do ledger, 18,97 MB total — subestima por assumir uniformidade; ponderado pela distribuição real de linhas do `sih_metric_muni` legado por UF, 139,0 MB total, SP como maior UF projetada em 15,2–20,5 MB) — nunca apresentados como medição
- **Tempo de parede medido de verdade:** `fetch`+`DecompressionStream`+`JSON.parse` (mesma API do browser, rodando em Node) contra um arquivo real de 15,24 MB (calibração de SP via gzip real sobre dado replicado), sob 3 taxas de rede simuladas — 1,7 s (piso de CPU), 13,3 s (10 Mbps), 32,9 s (4 Mbps)
- **Checkpoint respondido pelo operador:** `manter-por-uf` confirmado, com ressalva explícita de que a decisão se apoia em projeção para 26/27 UFs, e um item de acompanhamento registrado (remedir SP após a corrida completa do 09-04, sugerido para o 09-12)
- `loadMunicipioPartition.ts`: guarda de origem (sigla `[A-Z]{2}`, `VITE_SUPABASE_URL` configurada, `FORBIDDEN_HOST` de DATASUS/IBGE) rodando inteiramente antes de qualquer `fetch`; `DecompressionStream('gzip')` nativo, zero dependência npm nova; cache em memória guardando a promessa (drills concorrentes na mesma UF compartilham um único `fetch`, T-09-35); 10 testes, todos contra a mesma fixture real que o produtor Python usa

## Task Commits

1. **Task 1 (RED): teste falho do produtor de partições** - `cae15ae` (test)
1. **Task 1 (GREEN): partitions.py + fixture** - `e61bef7` (feat)
2. **Task 2: dimensionamento real medido, checkpoint apresentado** - `a3f8b8b` (docs)
2. **Task 2: decisão do operador registrada no relatório** - `abb35d2` (docs)
3. **Task 3 (RED): teste falho do consumidor loadMunicipioPartition** - `2df231d` (test)
3. **Task 3 (GREEN): loadMunicipioPartition.ts** - `40fd26e` (feat)

**STATE.md (posição/bloqueio durante a pausa do checkpoint):** `909d464` (docs)

**Plan metadata:** (este commit — `docs: complete plan`)

_Nota TDD: cada RED (`cae15ae`, `2df231d`) foi commitado com a implementação GREEN já presente no working tree mas ainda não rastreada pelo git — necessário porque o pre-commit hook roda `npm run gate` (suíte inteira) mesmo em commits só de teste. Mesmo padrão já usado nas 09-06/09-07._

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/partitions.py` — `BUCKET`/`PARTITION_PREFIX`/`build_partition`/`write_partition`/`upload_partition`/`cid_map_version`/`main`
- `pipeline/sih/tests/test_partitions.py` — 14 testes
- `pipeline/sih/tests/fixtures/particao_exemplo.json.gz` — fixture real de AC (4.026 linhas), compartilhada com o teste TypeScript
- `pipeline/sih/reports/particoes-dimensionamento.md` — medição real + projeção rotulada + auditoria do bucket + decisão do operador datada
- `src/features/catalog/loadMunicipioPartition.ts` — `loadMunicipioPartition`/`clearPartitionCache`
- `src/features/catalog/loadMunicipioPartition.test.ts` — 10 testes

## Decisions Made

- **Decisão do operador (formato de partição, 2026-08-10): `manter-por-uf`.** Ver `key-decisions` no frontmatter para o raciocínio completo. Zero desvio do D-21 como escrito — `partitions.py` e `loadMunicipioPartition.ts` não precisaram de nenhuma mudança de formato depois da decisão.
- **Teto de 50 MB por objeto confirmado ao vivo**, não só citado de documentação de terceiros — a tentativa real de elevar o bucket para 100 MB foi rejeitada pela própria plataforma.
- **Projeção sempre rotulada**: quando o corpus completo não estava disponível (26/27 UFs), a medição foi substituída por um método de extrapolação explícito e documentado, nunca apresentada como se fosse medição — mesmo sob a pressão do texto literal do critério de aceitação, que foi escrito assumindo que o corpus completo já estaria disponível nesta sessão.
- **`build_partition` valida grão E UF de cada linha antes de aceitar**, rejeitando com `ValueError` qualquer linha fora do escopo pedido — achado real durante o TDD (MUNIC_RES cruza UF), não uma hipótese.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste assumia que "grão município" bastava para "só do AC" — MUNIC_RES cruza UF**
- **Found during:** Task 1 (primeira execução dos testes de `build_partition`)
- **Issue:** A fixture de teste inicial filtrava só por `grao == "municipio"`, mas isso inclui linhas de residência (`local="residencia"`) cujo `MUNIC_RES` aponta para município de OUTRA UF (D-09: paciente internado no AC pode residir em outro estado) — `build_partition("AC", ...)` rejeitava essas linhas corretamente, mas o teste que as incluía sem filtrar por UF real estava errado, não o produtor.
- **Fix:** A fixture de teste passou a usar a própria função `_linhas_municipio_por_uf` de `partitions.py` para agrupar por sigla de UF de fato, e o teste de "linha de outra UF injetada" foi ajustado para usar um município real de SP como caso negativo isolado.
- **Files modified:** `pipeline/sih/tests/test_partitions.py`
- **Verification:** 14 testes verdes; a suíte completa (`uv run pytest -q`) permanece verde.
- **Committed in:** `e61bef7` (Task 1 commit)

**2. [Rule 1 - Bug] `loadMunicipioPartition` síncrono expondo `throw` em vez de rejeição de promessa**
- **Found during:** Task 3 (testes de guarda de origem — 3 de 10 testes falhavam com exceção não tratada em vez de rejeição)
- **Issue:** A função original não era `async`; um `throw` síncrono da guarda (sigla inválida, env ausente, host proibido) escapava como exceção síncrona em vez de rejeitar a `Promise<MunicipioPartition>` que o tipo de retorno promete — quebrando o contrato que qualquer chamador (`await`/`.catch()`) esperaria.
- **Fix:** `loadMunicipioPartition` marcada `async` — qualquer `throw` síncrono no corpo agora vira `Promise.reject` automaticamente, consistente com o tipo de retorno declarado.
- **Files modified:** `src/features/catalog/loadMunicipioPartition.ts`
- **Verification:** 10/10 testes verdes; `npm run typecheck` limpo.
- **Committed in:** `40fd26e` (Task 3 commit)

**3. [Rule 1 - Bug] `Blob` do polyfill jsdom corrompe bytes binários de gzip em teste**
- **Found during:** Task 3 (5 de 10 testes falhando com `Z_DATA_ERROR: incorrect header check` ao tentar descomprimir)
- **Issue:** Construir o corpo mockado da resposta HTTP via `new Blob([bytes])` (necessário para satisfazer o tipo `BodyInit` do TypeScript, que rejeita `Uint8Array<ArrayBufferLike>` diretamente) corrompia os bytes binários do gzip no ambiente de teste jsdom — bug conhecido de polyfills de `Blob` fora do browser real.
- **Fix:** Trocado para `ArrayBuffer` puro (`new Uint8Array(buffer).buffer as ArrayBuffer`), que satisfaz o tipo sem passar pelo `Blob` — preserva os bytes exatos.
- **Files modified:** `src/features/catalog/loadMunicipioPartition.test.ts`
- **Verification:** 10/10 testes verdes; a fixture real (`particao_exemplo.json.gz`) é lida corretamente pelo `DecompressionStream` real.
- **Committed in:** `2df231d` (Task 3 RED commit — a correção já estava presente quando o teste foi commitado)

---

**Total deviations:** 3 auto-fixed (2 bugs de teste, 1 bug de contrato assíncrono — nenhum de escopo além do que o próprio texto do plano já pedia: "erro explícito", "provado contra o mesmo byte")
**Impact on plan:** Todos os três ajustes foram necessários para que os testes provassem o comportamento real, não uma versão idealizada dele. Sem escopo adicional.

## Issues Encountered

- **Corpus completo do 09-04 continua bloqueado por disco** — a medição da Task 2 só pôde usar dado real do AC (14/156 arquivos-mês). Documentado extensivamente no relatório, com o método de projeção rotulado e uma ressalva explícita registrada pelo operador (ver `key-decisions`).
- **Convenção de erro HTTP da API de Storage do Supabase**: escrita anônima recusada retorna transporte HTTP 400 (não 401/403 como o critério de aceitação antecipava), com o código semântico real (`403`/`AccessDenied`) só dentro do corpo JSON. Registrado como achado, não como bug a corrigir — é comportamento da plataforma, não do código desta plan.

## User Setup Required

None — o bucket `sih-municipio` foi criado usando a `service_role` já disponível em `.env.pipeline` (criado em sessão anterior pelo operador). A leitura anônima foi testada com a chave `anon` já existente em `.env.local`.

## Nota sobre REQUIREMENTS.md

Este plano declara `requirements: [DATA-02, PIPE-05]` no frontmatter, mas **nenhum dos dois foi
marcado `[x]`** em `.planning/REQUIREMENTS.md`. Justificativa:

- **DATA-02** ("as 4 medidas estão coletadas para os 330 agravos no grão município"): é sobre a
  coleta de fato ter rodado para todos os agravos e municípios — esta plan construiu o MECANISMO
  (produtor de partição, bucket, consumidor), não a coleta em si, que continua bloqueada pela
  corrida completa do 09-04 (disco) e pela reconciliação SC-7 (09-08/09-11), como já registrado
  nos SUMMARYs anteriores da fase.
- **PIPE-05** ("o operador consegue verificar que uma coleta capturou o que afirma ter
  capturado"): é sobre uma ferramenta de auditoria de cobertura, que pertence ao `09-12` — esta
  plan não constrói essa ferramenta, só o mecanismo de serviço do dado que ela viria a auditar.

Marcar qualquer um dos dois como `Complete` agora seria falso — mesmo padrão de cautela dos
SUMMARYs anteriores (`09-02`, `09-06`, `09-07`). `requirements-completed: []` no frontmatter
reflete isso.

## Next Phase Readiness

- `partitions.py` pronto para uso pelo `09-10` (upload) — `main(argv)` já acende o subcomando
  `partitions` do `cli.py` (`--uf`, `--todas`, `--upload`); `cid_map_version()` está exposta para
  `upload.py` gravar exatamente o mesmo valor em `sih_collection_status.cid_map_version`
- Bucket `sih-municipio` existe em produção, auditado, pronto para receber as 27 partições reais
  quando a corrida completa do 09-04 terminar
- `loadMunicipioPartition.ts` pronto para consumo pela Fase 10 (mapa ao vivo) — mesmo padrão de
  `loadCatalog.ts`, zero dependência npm nova
- **Item de acompanhamento explícito para o `09-12` (auditoria de cobertura):** depois da corrida
  completa do 09-04, medir de verdade a partição de SP (e idealmente MG/BA/RS/PR, as próximas
  maiores) e conferir contra o teto de 50 MB/objeto — a decisão `manter-por-uf` foi tomada sobre
  projeção para 26/27 UFs, com folga de 2,4x, mas a confirmação real é barata e o custo de
  descobrir tarde é alto (formato já travado, consumidor já escrito). Nenhum plano da fase tem
  isso no escopo declarado hoje.
- Bloqueio de disco do `09-04` (corrida completa de ~10 GB) permanece aberto — não impediu esta
  plan, que só precisava do dado real do AC já disponível

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-10*

## Self-Check: PASSED

Todos os 6 arquivos de código/dado listados em Files Created/Modified existem no disco; todos os
7 hashes de commit (`cae15ae`, `e61bef7`, `a3f8b8b`, `abb35d2`, `2df231d`, `40fd26e`, `909d464`)
existem em `git log --oneline --all`.
