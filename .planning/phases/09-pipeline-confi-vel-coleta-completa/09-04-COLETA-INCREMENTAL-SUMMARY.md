---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-COLETA-INCREMENTAL
subsystem: infra
tags: [pyarrow, pysus, disco, resumabilidade, ledger]

# Dependency graph
requires:
  - phase: 09-04 (Tasks 1-2)
    provides: enumerate.py (janela D-11, 4.212 arquivos esperados), ledger.py (FileLedger,
      retomada idempotente por arquivo), download.py (download_all, isolamento de falha PIPE-06)
  - phase: 09-07
    provides: aggregate.py (aggregate_years/aggregate_parquet_dir, filtro IDENT='1')
provides:
  - "collect.py: laço incremental por UF que baixa, agrega, persiste e recicla o parquet bruto
    de uma UF por vez -- pico de disco vira o tamanho da maior UF sozinha (~1,9 GB), não os
    ~10-13 GB da corrida inteira"
  - "CollectLedger: estado explícito por UF (nunca_iniciado / baixado_pendente_agregacao /
    agregado_reciclado / falhou), ortogonal ao FileLedger -- resolve a ambiguidade que a
    reciclagem introduziria se só existisse o status 'baixado' de arquivo"
  - "cache_path('agregados/{uf}.parquet') -- o novo insumo durável (linhas já agregadas) que
    substitui o parquet bruto como fonte para os consumidores futuros (09-09/09-10)"
  - "subcomando 'collect' aceso no cli.py e no package.json (pipeline:collect)"
  - "a corrida real de coleta rodando em segundo plano, desde esta plan, processando as 27 UFs
    menor->maior"
affects: [09-09-particoes-storage, 09-10-upload-postgres, 09-13-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "camada de estado nova e ortogonal em vez de sobrecarregar um status existente com um
      segundo significado (CollectLedger vs. FileLedger.STATUS_BAIXADO)"
    - "isolamento de falha em duas granularidades: por arquivo (PIPE-06, 09-04) e por UF (esta
      plan), a segunda delegando para a primeira sem duplicar lógica"
    - "diretório temporário de symlinks para dar a uma função existente (aggregate_years) uma
      visão de escopo restrito sem duplicar bytes nem editar a função"
    - "guarda numérica calibrada por semente conservadora + medição real adaptativa, com raio de
      confiança para impedir que uma UF outlier (razão pequena) contamine a projeção de uma UF
      ordens de grandeza maior na razão"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/collect.py
    - pipeline/sih/tests/test_collect.py
  modified:
    - pipeline/sih/src/sih_pipeline/cli.py
    - package.json

key-decisions:
  - "UF_ORDER vai da menor para a maior UF (não a ordem D-23, que ordena agravos, não UFs -- ver
    docstring do módulo) -- prova o mecanismo novo barato antes de arriscar horas+disco em
    SP/MG"
  - "Parquet BRUTO reciclado por UF logo após a agregação ser persistida e conferida; as linhas
    agregadas (pequenas) ficam em cache_path('agregados/{uf}.parquet'), formato durável novo que
    09-09/09-10 vão precisar consumir no lugar do parquet bruto (ver Next Phase Readiness)"
  - "Guarda de disco recalibrada em produção: achado real (UF=DF, capital federal/polo de
    referência) mediu volume bruto ~12x acima da semente -- corrigido com um raio de confiança
    que impede uma UF pequena de inflar a projeção de uma UF 146x maior na razão (ver Deviations)"

patterns-established:
  - "Pattern: nunca sobrescrever o significado de um status existente quando a nova pergunta
    (‘isso já foi reciclado?’) é ortogonal à pergunta antiga (‘isso já foi baixado?’) -- introduzir
    uma camada de estado nova em vez disso"

requirements-completed: []

# Metrics
duration: ~75min (sessão ativa; a corrida de coleta em si continua rodando em segundo plano, dias)
completed: 2026-08-11
---

# Phase 9 Plan 04-COLETA-INCREMENTAL: Laço incremental por UF Summary

**Laço de coleta por UF (download → agrega → persiste → recicla o bruto) que desbloqueia a Task 3 do 09-04, com guarda de disco calibrada por medição real e corrigida ao vivo depois que a primeira UF (DF) revelou um achado genuíno: capital federal é polo de referência, com volume bruto ~12x maior que a razão do `sih_metric_muni` legado projetava.**

## Contexto: por que este trabalho existe

A Task 3 do `09-04-PLAN.md` foi escrita como uma corrida só, baixando os 4.212 arquivos inteiros
(~10-13 GB) e mantendo tudo em disco até o fim. Isso nunca rodou: o disco do operador não aguenta
— 8,4 GB livres no início desta plan, depois de já ter liberado ~3,3 GB de cache regenerável.
`STATE.md` registrava esse bloqueio desde o início da fase, listado em "Bloqueios abertos" como
impedimento a DATA-01/DATA-02 e à corrida real que 09-08/09-11/09-12 precisariam.

O fato medido que destrava o problema: SP, a maior UF do país (29,20× o AC em contagem de linhas
do `sih_metric_muni` legado), projeta ~1,9 GB de parquet bruto para os 13 anos da janela D-11 —
não ~10-13 GB. **Processar uma UF de cada vez faz o pico de disco cair para o tamanho da maior UF
sozinha**, que cabe com folga. Não havia `PLAN.md` para este trabalho — o brief operacional do
usuário (2026-08-10) foi o spec.

## Performance

- **Duração (sessão ativa):** ~75 min (leitura de contexto, TDD, 2 restarts operacionais, medição de liveness)
- **Iniciado:** 2026-08-10 (sessão)
- **Corrida de coleta real disparada:** 2026-08-11T01:39:26Z (primeira tentativa) / 2026-08-11T01:56:09Z (reinício definitivo, código corrigido) — **continua rodando em segundo plano, por design (D-01: dias, não minutos)**
- **Commits:** 3 (feat collect.py+testes, feat cli.py+package.json, fix guarda de disco)
- **Arquivos modificados:** 4 (2 criados, 2 modificados)

## Accomplishments

- `collect.py` novo: laço incremental que baixa uma UF inteira (156 arquivos = 12 meses × 13
  anos) via `download_all(only=[...])` já existente, agrega via `aggregate_years` já existente,
  persiste as linhas agregadas (pequenas) como parquet durável em
  `cache_path("agregados/{uf}.parquet")`, e só então recicla (apaga) o parquet bruto daquela UF.
- `CollectLedger`: camada de estado nova e ortogonal ao `FileLedger` do 09-04 — distingue
  `nunca_iniciado` / `baixado_pendente_agregacao` / `agregado_reciclado` / `falhou` por UF, sem
  jamais reinterpretar o que `FileLedger.STATUS_BAIXADO` significa (continua "baixado, hash
  verificado", nunca "presente em disco agora").
- Guarda de disco (`garantir_espaco_suficiente`/`project_uf_bytes`) que recusa iniciar uma UF cujo
  download projetado + margem de segurança (500 MB) não caiba no livre medido — provado por teste
  e, mais importante, **corrigido em produção** depois que a primeira UF real revelou uma falha de
  calibração (ver Deviations).
- Isolamento de falha em duas granularidades: por arquivo (delegado ao `download_all` do 09-04,
  intocado) e por UF (novo — uma UF que falhe fica `falhou` no `CollectLedger` e a corrida segue
  para a próxima, nunca trava a fila inteira).
- `collect` aceso em `cli.py` (`SUBCOMANDOS["collect"]`) e `package.json`
  (`npm run pipeline:collect`).
- **A corrida real está rodando**: 2 UFs completas de verdade (DF, RR) contra o FTP real do
  DataSUS, com retomada comprovada ao vivo (não só em teste) quando o processo foi reiniciado.

## Task Commits

1. **collect.py + test_collect.py (TDD, 20 testes)** — `82b2dc9` (feat)
2. **cli.py + package.json (subcomando `collect` aceso)** — `02e0e65` (feat)
3. **Correção da guarda de disco (achado real de produção)** — `7384dc0` (fix)

**Plan metadata:** commit deste SUMMARY + STATE.md (a seguir)

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/collect.py` — laço incremental, `CollectLedger`, guarda de disco, CLI
- `pipeline/sih/tests/test_collect.py` — 20 testes, zero rede, sobre `tests/fixtures/rdac_2019.parquet`
- `pipeline/sih/src/sih_pipeline/cli.py` — uma linha nova em `SUBCOMANDOS` ("collect")
- `package.json` — uma linha nova (`pipeline:collect`)

## Decisions Made

1. **Ordem das UFs: menor → maior, não a ordem D-23.** `scripts/catalog/collection-order.json`
   ordena AGRAVOS por relevância cirúrgica — mas cada arquivo bruto `RD{UF}{AA}{MM}` já contém as
   331 doenças na mesma passada (aggregate.py: "agregação é de graça"). Não existe forma de
   "baixar só os agravos vasculares primeiro" no nível de arquivo do SIH-RD: a primeira UF que
   terminar já entrega os 331 agravos completos para aquele território. As duas ordens são
   ortogonais — nenhuma substitui a outra. `UF_ORDER` foi escolhida menor→maior (razão de linhas
   medida do `sih_metric_muni` legado, `pipeline/sih/reports/particoes-dimensionamento.md` §3.2)
   porque este laço é NOVO e nunca rodou contra I/O real de dias; provar o mecanismo em UFs
   pequenas (minutos, risco de disco desprezível) antes de arriscar horas+disco em SP/MG é a
   escolha mais segura. **Validado na prática**: a primeira UF (DF) revelou um achado genuíno de
   calibração (ver Deviations) que só apareceu por ser barato de descobrir cedo.

2. **Estado novo e ortogonal em vez de reinterpretar `baixado`.** O `FileLedger` do 09-04 marca um
   arquivo como `baixado` e isso continua correto para sempre — é o que impede `download_all` de
   rebaixar/re-baixar um arquivo cujo bruto foi reciclado de propósito. Mas `baixado` sozinho não
   distingue "presente em disco" de "agregado e reciclado". `ledger.py` **não foi tocado**:
   `CollectLedger`, uma classe nova em `collect.py`, é quem sabe essa diferença, por UF.

3. **Diretório temporário de symlinks para escopar a agregação.** `_aggregate_uf` nunca aponta
   `aggregate_years` para `cache_path("parquet")` inteira — essa pasta pode conter sobras de
   outras UFs (o cache real do operador já tinha AC/2019 e SP/2019 antes desta plan existir, e não
   podiam ser tratadas como lixo). Um diretório temporário com symlinks só para os arquivos exatos
   desta UF (caminho lido do `FileLedger`) dá isolamento sem duplicar bytes e sem editar
   `aggregate.py`.

4. **Parquet AGREGADO durável em `cache_path("agregados/{uf}.parquet")` — novo insumo, não
   integrado a 09-09/09-10 nesta plan.** Ver "Next Phase Readiness" — é o handoff mais importante
   desta plan para quem continuar a fase.

## Deviations from Plan

Não havia `PLAN.md` formal para este trabalho (o brief operacional era o spec) — mas o processo de
execução revelou uma falha de design real, corrigida durante a mesma sessão:

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guarda de disco superestimava agressivamente a partir de uma UF outlier**
- **Encontrado durante:** a corrida real, ao processar a primeira UF (DF)
- **Problema:** a semente conservadora projetava ~13,3 MB de parquet bruto para DF; o valor
  MEDIDO de verdade foi 163.452.924 bytes (~155,9 MB) — ~12× acima. DF é capital federal e polo de
  referência: hospitais de Brasília atendem paciente de fora da própria UF (`MUNIC_RES` de fora
  do DF), então o volume BRUTO de internação é desproporcional à razão do `sih_metric_muni`
  legado (que mede só 93/331 agravos e só `local=ocorrência`). A guarda de disco original dividia
  bytes medidos pela razão da UF medida SEM limite e usava o maior valor encontrado para
  calibrar QUALQUER outra UF — extrapolar o achado de DF (razão 0,20) para SP (razão 29,20, 146×
  maior) projetaria **~24 GB** para SP, quando o real medido de SP (SP/2019 já em cache antes
  desta plan) é ~1,9 GB. Isso pararia a corrida "limpo" antes de SP por engano — resultado seguro
  (nunca estoura o disco), mas o objetivo real (coleta completa das 27 UFs) não seria atingido sem
  intervenção manual.
- **Fix:** `project_uf_bytes` só deixa uma UF medida calibrar outra UF cuja razão esteja dentro de
  `RAIO_CONFIANCA_RAZAO` (5×) — nunca através de duas ordens de grandeza. SP permanece ancorada
  perto da semente (~1,9 GB) mesmo com DF medido; UFs de razão próxima (ex.: RR, razão 0,46)
  continuam se beneficiando da calibração real.
- **Testes adicionados:** `test_project_uf_bytes_nao_extrapola_medicao_de_razao_pequena_para_razao_grande`,
  `test_project_uf_bytes_extrapola_medicao_dentro_do_raio_de_confianca`
- **Arquivos modificados:** `pipeline/sih/src/sih_pipeline/collect.py`, `pipeline/sih/tests/test_collect.py`
- **Verificação:** `SP` projetado antes/depois da medição de DF fica **idêntico** (1.945,6 MB,
  ambos < 2 GB — nunca ~24 GB); `RR`, dentro do raio, sobe corretamente com a medição de DF.
- **Commit:** `7384dc0`

---

**Total de desvios:** 1 auto-corrigido (Rule 1 — bug de calibração numérica encontrado só porque a
corrida real rodou de verdade contra o FTP, não um mock). **Impacto:** correção necessária para
que a corrida complete as 27 UFs sem intervenção manual perto do fim; sem escopo adicional.

## Issues Encountered

- **Buffering de stdout mascarou a prova de liveness.** O primeiro disparo (`nohup ... > log 2>&1
  &`, sem flags de unbuffering) manteve `collect.log` em 0 bytes por vários minutos mesmo com
  download real acontecendo (confirmado observando o cache crescer) — Python bufuriza `stdout` em
  blocos quando a saída não é um terminal. Resolvido reiniciando com `PYTHONUNBUFFERED=1 uv run
  python -u`, sem perda de progresso (o `FileLedger`/`CollectLedger` são idempotentes: arquivos já
  `baixado` nunca foram re-baixados). Nenhum código mudou por causa disto — é uma nota operacional
  para quem reiniciar a corrida no futuro.
- **Engano do agente durante exploração da CLI `gsd-sdk`:** ao testar a sintaxe de
  `gsd-sdk query state ...`, uma chamada `state advance-plan` executou de verdade e avançou o
  contador de plano em `.planning/STATE.md` (12→13) sem que nenhum plano formal 09-13 tivesse sido
  concluído. Detectado imediatamente via `git diff`, revertido com `git checkout -- .planning/STATE.md`
  antes de qualquer commit. Nenhum dado real foi perdido; registrado aqui por transparência. A
  partir deste ponto, todas as atualizações de `STATE.md` desta plan foram feitas via `Edit` direto
  (nunca via comandos mutadores do `gsd-sdk`), porque este trabalho ad-hoc não se encaixa no
  modelo de "plano N de M" que aquelas ferramentas assumem.

## Corrida real — estado medido

**Processo:** `uv run python -u -m sih_pipeline.cli collect` (PID 49618 no momento deste registro,
depois de um reinício limpo para captar a correção da guarda de disco — sem perda de progresso).
**Log:** `pipeline/sih/reports/collect.log` (append, cresce a cada UF concluída).

### Prova de liveness (medida duas vezes, com intervalo)

| Medição | Timestamp (UTC) | PID vivo | Bytes do log |
|---|---|---|---|
| 1 | 2026-08-11T01:56:11Z | sim (etime 00:08) | 330 |
| 2 | 2026-08-11T01:56:56Z | sim (etime 00:53) | 330 (RR ainda agregando; completou 10s depois) |
| confirmação extra | 2026-08-11T01:57:15Z | sim (etime 01:12) | 554 (RR concluída, AP iniciada) |

Prova mais forte que a exigida: entre a primeira tentativa (buferizada, 2026-08-11T01:39:26Z) e o
reinício definitivo, **duas UFs completas rodaram de ponta a ponta contra o FTP real do DataSUS**,
incluindo uma retomada real (não simulada em teste) em que o processo reiniciado leu
`collect: DF já agregado e reciclado -- pulando (retomada)` e não re-baixou nada de DF.

### Custo real medido por UF (a primeira prova empírica, não extrapolação)

| UF | arquivos | linhas agregadas | bytes persistidos (durável) | bytes reciclados (bruto apagado) |
|---|---:|---:|---:|---:|
| DF | 156 | 145.095 | 1.912.291 (1,82 MiB) | 163.452.924 (155,9 MiB) |
| RR | 156 | 37.460 | 469.533 (458 KiB) | 37.049.268 (35,3 MiB) |

DF (capital federal, polo de referência) é um outlier real — ver Deviations. RR, também pequena
mas sem o mesmo perfil de referência regional, ficou muito mais próxima da semente conservadora
original (~80,5 MB/unidade medido contra ~66,6 MB/unidade da semente), confirmando que o achado de
DF era específico daquela UF, não um erro sistemático na tabela de razões inteira.

**Disco livre observado ao longo da sessão:** 8,4 GB (início, brief) → 8,1 GB → 6,9 GB → 5,8 GB →
5,7 GB → 5,8 GB (após reciclar DF). A queda é maior do que o que este pipeline sozinho explicaria
(picos de ~164 MB por UF, reciclados logo em seguida) — **há pressão de disco concorrente nesta
máquina, fora do controle deste pipeline** (não investigado; possivelmente cache/snapshot do
sistema). Isso reforça, não enfraquece, a necessidade da guarda de disco: o livre real pode cair
por razões alheias à corrida, e `garantir_espaco_suficiente` reconsulta o disco antes de CADA UF,
nunca assume o valor medido no início.

## User Setup Required

None - nenhuma configuração de serviço externo. A corrida usa o mesmo FTP público do DataSUS que
`download.py` (09-04) já usa, sem credencial nova.

## Next Phase Readiness

**O que está pronto:**
- A corrida incremental está rodando em segundo plano, processando as 27 UFs menor→maior, e
  sobrevive a reinícios sem perder progresso nem re-baixar dado.
- `cache_path("agregados/{uf}.parquet")` é o novo formato durável de saída — pequeno (a projeção
  nacional é ~13M linhas agregadas, partições D-21 medem ~139 MB no total), schema fixo
  (`disease_id, grao, local, territorio_codigo, ano, internacoes, obitos, valor_total,
  dias_permanencia, taxa_mortalidade` — os mesmos campos de `aggregate.Row`).

**O que falta — handoff explícito para 09-09/09-10/09-13:**

`partitions.py` (09-09), `aggregate.py --dry-run`/`main()` (09-07, uso via CLI) e `reconcile.py`
(09-08) **leem diretamente `cache_path("parquet")`** — o parquet BRUTO — para reagregar sob
demanda. Esta plan APAGA o parquet bruto de cada UF depois de agregá-lo. Consequência prática:
depois que `collect.py` reciclar uma UF, rodar `npm run pipeline:partitions -- --uf {essa-UF}` ou
`npm run pipeline:aggregate` sobre ela vai encontrar "nenhum parquet em cache_path('parquet') --
nada a processar" — **não é um bug do 09-09/09-08, é uma mudança de contrato que esta plan
introduz e não resolve** (fora do escopo declarado: eu não tocaria `partitions.py`/`reconcile.py`).
Quem continuar a fase precisa adaptar esses dois consumidores (e o futuro `upload.py` do 09-10)
para ler de `cache_path("agregados/*.parquet")` no lugar do parquet bruto — ou reagregar a partir
do agregado já persistido (concatenar os `Row` de todas as UFs) em vez de reler o SIH-RD original.

**Bloqueios/observações levadas para STATE.md:**
- O bloqueio de disco do 09-04 Task 3 está **resolvido** por este mecanismo — mas a corrida ainda
  está em andamento (2/27 UFs no momento deste registro), não completa. DATA-01/DATA-02 (cobertura
  real dos 331 agravos) continuam dependendo da corrida terminar.
- A guarda de disco, mesmo corrigida, é uma PROJEÇÃO — pode ainda superestimar para UFs
  individuais com perfil atípico (como DF revelou). Se a corrida parar antes de completar as 27
  UFs citando espaço insuficiente, checar `pipeline/sih/reports/collect.log` e
  `~/.lacir/sih-cache/agregados/collect_state.json` antes de assumir que o disco realmente não
  cabe — pode ser a guarda sendo conservadora demais, não falta de espaço real.

## Self-Check: PASSED

- FOUND: `pipeline/sih/src/sih_pipeline/collect.py`
- FOUND: `pipeline/sih/tests/test_collect.py`
- FOUND commit `82b2dc9` (feat: collect.py + testes)
- FOUND commit `02e0e65` (feat: cli.py + package.json)
- FOUND commit `7384dc0` (fix: raio de confiança da guarda de disco)
- CONFIRMADO ao vivo: `~/.lacir/sih-cache/agregados/collect_state.json` mostra `DF` e `RR` com
  `status: "agregado_reciclado"` no momento deste registro — a corrida continua rodando
  (PID 49618) para as UFs seguintes.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-11*
