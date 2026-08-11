---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 09-ADAPTACAO-AGREGADOS
subsystem: infra
tags: [pyarrow, pipeline, parquet, agregacao, storage]

# Dependency graph
requires:
  - phase: 09-04-COLETA-INCREMENTAL
    provides: "collect.py -- laço incremental por UF, cache_path('agregados/{uf}.parquet') como
      novo insumo durável, handoff aberto explicitamente para partitions.py/reconcile.py"
  - phase: 09-09
    provides: "partitions.py original (build_partition/write_partition/upload_partition,
      formato manter-por-uf travado pelo operador, D-20/D-21)"
  - phase: 09-08
    provides: "reconcile.py original (compare/main, gate SC-7)"
provides:
  - "partitions.py::linhas_da_uf(uf, index) -- prioriza cache_path('agregados/{uf}.parquet')
    (rápido, pequeno, sobrevive à reciclagem), cai para parquet bruto isolado a essa UF (nunca
    cache_path('parquet') inteira) só quando o agregado ainda não existe"
  - "partitions.py::_linhas_do_agregado_persistido -- valida o schema do agregado contra
    Row._fields, levanta ValueError nomeado em vez de coagir por posição numa divergência real"
  - "reconcile.py::main() adaptado -- mesma priorização, por UF que o oráculo realmente precisa"
  - "prova byte-idêntica (fixture AC + dado real de produção SP/2019) entre partição-de-agregado
    e partição-de-bruto"
affects: [09-10-upload-postgres, 09-12-audit, 09-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sourcing com prioridade + fallback isolado por UF (agregado persistido > parquet bruto
      isolado a essa UF via diretório temporário de symlinks) -- nunca a pasta cache_path
      ('parquet') inteira, que pode ter sobras de outras UFs ainda não recicladas"
    - "UF sem nenhuma fonte de dado é estado NORMAL (mensagem clara, 'pulando'), nunca erro --
      mesma disciplina que collect.py já usa para 'nunca_iniciado'"
    - "schema do agregado persistido validado contra Row._fields (fonte única, nunca um literal
      solto duplicado) antes de reconstruir Row -- divergência levanta, nunca coage por posição"
    - "função de sourcing exposta sem '_' inicial (linhas_da_uf) especificamente para ser
      reaproveitada por outro módulo consumidor (reconcile.py), diferente dos helpers internos"

key-files:
  created:
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-09-ADAPTACAO-AGREGADOS-SUMMARY.md
  modified:
    - pipeline/sih/src/sih_pipeline/partitions.py
    - pipeline/sih/tests/test_partitions.py
    - pipeline/sih/src/sih_pipeline/reconcile.py
    - pipeline/sih/tests/test_reconcile.py

key-decisions:
  - "Fallback bruto sempre ISOLADO à UF pedida (diretório temporário de symlinks, mesmo princípio
    de collect.py:_aggregate_uf, reimplementado sem importar o módulo vivo) -- nunca
    cache_path('parquet') inteira. Necessário para o teste byte-idêntico ser válido: as duas
    fontes (agregado persistido, bruto isolado) precisam derivar da MESMA população de registros
    para a comparação provar algo real, não uma coincidência de cache vazio."
  - "linhas_da_uf exposta sem '_' inicial (ao contrário dos três helpers que a compõem) porque
    reconcile.py precisa importá-la -- é a única função de sourcing desta adaptação com consumidor
    fora do próprio módulo."
  - "reconcile.py adaptado além do pedido mínimo: auditoria confirmou que main() tinha o MESMO
    defeito de partitions.py (leitura direta de cache_path('parquet')), e é um subcomando
    realmente usado em produção (pipeline:reconcile, usado na confirmação de SP/2019 do 09-11) --
    não seria honesto documentar 'fica pra depois' quando a correção era direta e do mesmo
    tamanho da de partitions.py."
  - "aggregate.py NÃO foi tocado apesar de ter o mesmo defeito (main()/--dry-run lê
    cache_path('parquet') direto) -- fora do file_scope desta adaptação (módulo com dono
    declarado, 09-07). Registrado como achado residual abaixo, não corrigido."

patterns-established:
  - "Pattern: uma função de sourcing por UF (prioridade + fallback isolado) é o ponto único que
    resolve 'de onde vêm as Row desta UF' -- qualquer consumidor futuro (upload.py do 09-10,
    audit.py do 09-12) importa linhas_da_uf em vez de reimplementar a priorização."

requirements-completed: []

# Metrics
duration: ~2h (sessão ativa, incluindo uma interrupção por reinício da máquina do operador no
  meio da execução -- os dois commits já feitos sobreviveram, árvore ficou limpa)
completed: 2026-08-11
---

# Phase 9 Plan 09-ADAPTACAO-AGREGADOS: Consumidores agora leem o agregado persistido, não o parquet reciclado Summary

**`partitions.py`/`reconcile.py` fecham o handoff aberto pelo 09-04-COLETA-INCREMENTAL: `linhas_da_uf(uf, index)` prioriza `cache_path("agregados/{uf}.parquet")` e cai para parquet bruto — sempre isolado à UF pedida — só quando o agregado ainda não existe, provado byte-idêntico entre as duas fontes contra a fixture congelada de AC E contra dado real de produção (SP/2019, 12 arquivos, 136.686 linhas de grão município, payload JSON de 13,49 MB / gzip de 1,58 MB idênticos byte a byte nos dois caminhos).**

## Contexto: por que este trabalho existe

`collect.py` (09-04-COLETA-INCREMENTAL, ad-hoc, 2026-08-10/11) passou a processar as 27 UFs uma
de cada vez: baixa, agrega, persiste o agregado pequeno em
`cache_path("agregados/{uf}.parquet")`, recicla (apaga) o parquet bruto daquela UF. Isso resolveu
o bloqueio de disco do 09-04 Task 3 (pico de disco caiu de ~10-13 GB para o tamanho da maior UF
sozinha), mas abriu um handoff explícito, documentado na docstring do próprio `collect.py` e em
"Bloqueios abertos" do `STATE.md`: `partitions.py` e `reconcile.py` continuavam lendo
`cache_path("parquet")` — o BRUTO — direto. Depois que `collect.py` reciclasse uma UF, essas duas
CLIs encontrariam "nada a processar" para ela, quebrando o insumo que o `09-10` (upload) precisa.
Não havia `PLAN.md` formal para este trabalho — o brief operacional do usuário foi o spec.

## Performance

- **Duração (sessão ativa):** ~2h, incluindo uma interrupção real por reinício da máquina do
  operador no meio da execução (os dois commits já feitos até aquele ponto sobreviveram intactos;
  a árvore de trabalho ficou limpa; a corrida de coleta foi religada pelo operador e retomou
  sozinha, idempotente, pulando as UFs já concluídas)
- **Commits:** 2 (feat `partitions.py`+testes, feat `reconcile.py`+testes)
- **Arquivos modificados:** 4 (2 de código, 2 de teste)
- **Testes novos:** 15 (9 em `test_partitions.py`, 6 em `test_reconcile.py`) — suíte completa do
  pipeline foi de 98 para 113 testes, todos verdes

## Accomplishments

- **`partitions.py::linhas_da_uf(uf, index) -> tuple[list[Row], str]`** — a função central desta
  adaptação. Prioriza `cache_path("agregados/{uf}.parquet")` (lido e reconstruído em `list[Row]`,
  schema validado contra `Row._fields`); cai para o parquet bruto — sempre isolado a essa UF via
  diretório temporário de symlinks (mesmo princípio de `collect.py:_aggregate_uf`, reimplementado
  sem importar o módulo vivo) — só quando o agregado ainda não existe. UF sem nenhuma das duas
  fontes devolve lista vazia com rótulo `"bruto"` — estado normal, tratado no chamador (`main()`)
  como mensagem clara + "pulando", nunca crash nem partição vazia silenciosa.
- **Prova byte-idêntica, dupla:**
  1. Automatizada (`test_particao_de_agregado_e_de_parquet_bruto_sao_byte_identicas`, sobre a
     fixture real de AC/2019 já commitada, `tmp_path` isolado): payload de `build_partition`,
     corpo JSON serializado e bytes gzip finais são idênticos entre as duas fontes.
  2. **Ao vivo, contra dado real de produção** (SP/2019, os 12 arquivos brutos ainda em
     `~/.lacir/sih-cache/parquet/` — não reciclados, SP é a última UF na ordem `UF_ORDER`):
     copiados (LEITURA apenas) para um cache falso em `tmp`, nunca escrevendo em
     `~/.lacir/sih-cache/`. Resultado medido: **152.808 linhas agregadas** (todos os graus),
     **136.686 linhas de grão município** para SP, payload JSON de **13.485.538 bytes** e gzip de
     **1.584.647 bytes** — idênticos byte a byte entre a fonte "bruto isolado" e a fonte
     "agregado sintetizado a partir das mesmas linhas". Confirmado depois: nada foi escrito no
     cache real (`ls ~/.lacir/sih-cache/parquet/RDSP*` continua com 12 arquivos, `agregados/`
     continua só com as 5 UFs reais da corrida).
- **Achado real documentado, não corrigido (fora do escopo — `collect.py` é módulo vivo em
  produção):** o isolamento por UF de `collect.py` captura cada hospitalização pela UF onde ela
  OCORREU; uma linha de grão-município `local=residencia` cujo `MUNIC_RES` aponta para OUTRA UF
  fica presa no agregado da UF de ocorrência, nunca chega à partição da UF de residência (que só
  lê seu próprio `agregados/{uf}.parquet`). Medido ao vivo (parquet bruto real, antes da
  reciclagem): SP tem 192 registros de residência do AC presos no bruto de SP; AC tinha 11
  registros de residência de SP presos no próprio bruto — fração pequena (SP: 192/2.606.482;
  AC: 11/53.381) mas real. Característica arquitetural do isolamento por UF do
  09-04-COLETA-INCREMENTAL, não uma regressão desta adaptação (a leitura antiga só captava isso
  quando as 27 UFs estavam simultaneamente em cache, o que o disco do operador nunca permitiu —
  a própria razão de `collect.py` existir). Documentado na docstring do módulo para decisão
  futura.
- **`reconcile.py::main()` adaptado** com a mesma priorização — auditoria (item explícito do
  brief) encontrou que `main()` (o subcomando `pipeline:reconcile`, realmente usado em produção:
  a confirmação de SP/2019 do 09-11 rodou por ele) tinha o MESMO defeito de `partitions.py`. Agora
  resolve, por UF que o oráculo (filtrado por `--uf`, se dado) realmente precisa, via
  `partitions.linhas_da_uf`. UF sem dado vira aviso em `stderr` e é pulada; se nenhuma UF
  necessária tiver dado, a função avisa e devolve 0 sem fingir ter comparado algo.
- **Gate permanente verificado, não assumido:** `test_reconcile_gate.py` chama
  `aggregate_parquet_dir` direto sobre a fixture congelada (`tests/fixtures/rdac_2019.parquet`),
  nunca passa por `main()` nem por `cache_path("parquet")` — permanece **byte-idêntico**
  (`exato=34, explicado=61, inexplicado=3`, `result.ok=False` de propósito), confirmado pela
  suíte completa (`uv run pytest -q`, 113 testes verdes) e por `npm run gate` (784 testes
  JS/TS + 113 Python + build).
- **Auditoria de "outros consumidores de `cache_path('parquet')`" completa:**
  - `partitions.py` — adaptado (esta plan).
  - `reconcile.py` — adaptado (esta plan, ver acima).
  - `cli.py` — auditado, **sem nenhuma referência a `cache_path`/`parquet`** (é um despachante
    puro e preguiçoso, `resolver(nome)` só importa o módulo dono e devolve `main`) — confirmado
    fine as-is, nenhuma mudança necessária.
  - `aggregate.py` (`main()`, `--uf/--ano/--dry-run`) — **tem o MESMO defeito** (lê
    `cache_path("parquet")` direto), confirmado por grep, mas está **fora do file_scope** desta
    adaptação (dono declarado: 09-07; `collect.py`/`aggregate.py`/`download.py`/`ledger.py`
    listados como intocáveis no brief). Registrado como achado residual, não corrigido —
    ver "Issues Encountered".
  - `collect.py` — não é um consumidor no sentido desta adaptação (é o produtor do agregado);
    módulo vivo, intocado por instrução explícita.
  - `upload.py` (09-10) e `audit.py` (09-12) — **não existem ainda** (`ls
    src/sih_pipeline/` confirma). Nada a adaptar; a razão de esta plan existir é justamente
    preparar `partitions.py`/`reconcile.py` para que, quando esses módulos futuros forem
    escritos, o padrão `linhas_da_uf` já esteja pronto para ser reaproveitado.
- **Nota sobre `IDENT='1'` (09-07, commit `53b7323`):** `aggregate.py` já filtra
  `IDENT != '1'` (renovação de AIH de longa permanência) ANTES de qualquer linha virar `Row`. Os
  agregados persistidos por `collect.py` (via `aggregate_years`) já refletem esse filtro. Nem
  `partitions.py` nem `reconcile.py` reaplicam qualquer filtro de `IDENT` a jusante — as `Row`
  lidas de `cache_path("agregados/{uf}.parquet")` são consumidas exatamente como persistidas,
  sem transformação adicional. Uma segunda filtragem downstream seria bug silencioso (dupla
  exclusão do mesmo campo); confirmado por leitura de código que isso não acontece em nenhum dos
  dois módulos adaptados.

## Task Commits

1. **`partitions.py::linhas_da_uf` + 9 testes (byte-idêntico, schema, UF sem dado, `--todas`
   misto)** — `3a13002` (feat)
2. **`reconcile.py::main()` adaptado + 6 testes** — `87dfdcc` (feat)

**Plan metadata:** este commit (SUMMARY + STATE.md)

_Nota: sem gate RED/GREEN separado — esta adaptação não é um plano `type: tdd` formal (o brief a
descreve como "priority=high", não como gate obrigatório); os testes foram escritos e
verificados ANTES de cada commit (implementação + teste no mesmo commit, ambos verdes), mesmo
padrão usado pela 09-04-COLETA-INCREMENTAL para trabalho ad-hoc sem `PLAN.md` formal._

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/partitions.py` — `linhas_da_uf`, `_linhas_do_agregado_persistido`,
  `_arquivos_brutos_da_uf`, `_linhas_do_parquet_bruto_isolado`, `main()` reescrito para usar as
  novas funções em vez de agregar `cache_path("parquet")` inteira de uma vez
- `pipeline/sih/tests/test_partitions.py` — 9 testes novos (23 no total)
- `pipeline/sih/src/sih_pipeline/reconcile.py` — `main()` reescrito para resolver linhas por UF
  necessária via `partitions.linhas_da_uf`
- `pipeline/sih/tests/test_reconcile.py` — 6 testes novos (16 no total)
- `.planning/phases/09-pipeline-confi-vel-coleta-completa/09-09-ADAPTACAO-AGREGADOS-SUMMARY.md`
  (este arquivo)

## Decisions Made

Ver `key-decisions` no frontmatter para o raciocínio completo. Resumo:

1. **Fallback bruto sempre isolado à UF pedida**, nunca `cache_path("parquet")` inteira — condição
   necessária para o teste byte-idêntico provar algo real (as duas fontes precisam derivar da
   MESMA população de registros).
2. **`linhas_da_uf` exposta sem `_` inicial** porque `reconcile.py` a importa — único ponto de
   sourcing compartilhado entre módulos nesta adaptação.
3. **`reconcile.py` adaptado além do mínimo pedido** — auditoria encontrou o mesmo defeito real,
   com uso de produção documentado (confirmação de SP/2019 do 09-11); corrigir foi mais honesto
   que documentar como pendência.
4. **`aggregate.py` intencionalmente NÃO tocado** apesar do mesmo defeito — fora do file_scope,
   módulo com dono declarado (09-07). Achado residual registrado, não corrigido.

## Deviations from Plan

Não havia `PLAN.md` formal (o brief operacional era o spec) — nenhum desvio das regras 1-3
(bug/funcionalidade crítica/bloqueio) foi necessário. A extensão a `reconcile.py` (item 4 acima)
não é um desvio no sentido das Rules 1-4: o próprio brief already pedia explicitamente "audit for
them (reconcile.py, the CLIs, anything else) and adapt or explicitly document why a given one is
fine as-is" — adaptar `reconcile.py` é execução do escopo declarado, não um acréscimo.

None dos Rules 1-4 foi acionado além disso — plano executado como o brief descreveu.

## Issues Encountered

- **Reinício da máquina do operador no meio da execução.** Interrompeu a sessão depois do segundo
  commit (`87dfdcc`). Nada foi perdido: os dois commits já feitos sobreviveram intactos, a árvore
  de trabalho estava limpa (nenhuma mudança não commitada), e a corrida de coleta em segundo plano
  foi religada pelo operador — retomou sozinha (idempotente, `CollectLedger` preservado em
  `~/.lacir/sih-cache/agregados/collect_state.json`), pulando as 5 UFs já `agregado_reciclado`
  (AC, AP, DF, RR, SE) e seguindo para as restantes (AL em andamento no momento deste registro).
  PID do processo de coleta mudou (era 49618 antes do reinício, é 8135 depois) — comportamento
  esperado de um processo relançado, não um problema.
- **`aggregate.py` tem o mesmo defeito, mas está fora do escopo desta adaptação.** `main()`
  (`--uf`/`--ano`/`--dry-run`, subcomando `pipeline:aggregate`) lê `cache_path("parquet")` direto,
  igual `partitions.py`/`reconcile.py` liam antes desta adaptação — confirmado por grep
  (`cache_path("parquet")` aparece em `aggregate.py:261`). Mas `aggregate.py` está explicitamente
  listado como intocável no brief (dono declarado: 09-07, mesma lista de `collect.py`/
  `download.py`/`ledger.py`). **Achado residual, não bloqueante para o 09-10** (que consome
  `partitions.py`, não `aggregate.py` diretamente) — registrado aqui para quem continuar a fase:
  o mesmo padrão `linhas_da_uf` (ou uma função equivalente, se `aggregate.py --uf` precisar de
  todos os graus, não só `GRAO_MUNICIPIO`) resolveria, se um plano futuro decidir que a
  utilidade ad-hoc de `aggregate.py --uf SIGLA` precisa continuar funcionando depois que a corrida
  reciclar aquela UF.

## User Setup Required

None — nenhuma configuração de serviço externo. Toda a verificação rodou sobre a fixture
committed e sobre uma cópia de leitura (nunca escrita) do cache real em um diretório temporário.

## Next Phase Readiness

- **O handoff aberto pelo 09-04-COLETA-INCREMENTAL está fechado**: `partitions.py`/`reconcile.py`
  agora leem `cache_path("agregados/{uf}.parquet")` quando existe, com fallback correto e provado
  para UFs ainda não recicladas. O `09-10` (upload) pode depender de `partitions.py` produzir
  partições corretas para qualquer UF, independente de seu parquet bruto ainda existir ou já ter
  sido reciclado.
- **Corrida de coleta continua em andamento** (religada pelo operador após o reinício, PID 8135
  no momento deste registro): 5 UFs completas e recicladas (AC, AP, DF, RR, SE), AL em andamento.
  Disco livre medido em 16 GB (subiu de 8,4 GB no início da 09-04-COLETA-INCREMENTAL — a
  reciclagem está funcionando e o reinício também liberou temporários do sistema).
- **Achado da residência cross-UF (ver Accomplishments) fica como item de acompanhamento**, não
  bloqueante: se a completude nacional de residência cross-UF for exigida por um plano futuro
  (ex.: 09-12 auditoria de cobertura), a solução precisaria rodar DEPOIS que as 27 UFs
  completarem a coleta, reagregando `agregados/*.parquet` inteiro e regrupando por UF derivada de
  verdade — não é algo que `linhas_da_uf` (por design, um-UF-por-vez) resolve sozinho.
- **`aggregate.py` tem o mesmo defeito, não corrigido** (ver Issues Encountered) — residual para
  um plano futuro decidir se `aggregate.py --uf` precisa continuar funcionando pós-reciclagem.
- **PID do processo de coleta:** 8135 (verificado vivo ao final desta sessão, depois do
  reinício da máquina do operador).

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `pipeline/sih/src/sih_pipeline/partitions.py` (com `linhas_da_uf`)
- FOUND: `pipeline/sih/src/sih_pipeline/reconcile.py` (com `main()` adaptado)
- FOUND: `pipeline/sih/tests/test_partitions.py` (23 testes)
- FOUND: `pipeline/sih/tests/test_reconcile.py` (16 testes)
- FOUND commit `3a13002` (feat: partitions.py + testes)
- FOUND commit `87dfdcc` (feat: reconcile.py + testes)
- CONFIRMADO ao vivo: `uv run pytest -q` (113 testes) e `npm run gate` (784 JS/TS + 113 Python +
  build) verdes nesta sessão
- CONFIRMADO ao vivo: prova byte-idêntica contra dado real de SP/2019 (leitura apenas,
  `~/.lacir/sih-cache/` inalterado — `ls RDSP*` continua 12 arquivos, `agregados/` continua só
  as 5 UFs reais)
- CONFIRMADO ao vivo: processo de coleta (PID 8135) vivo ao final desta sessão
