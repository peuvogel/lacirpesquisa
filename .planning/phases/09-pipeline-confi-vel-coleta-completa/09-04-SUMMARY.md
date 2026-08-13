---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04
subsystem: infra
tags: [python, pysus, ftp, ledger, retomada, cli, sih-rd]

# Dependency graph
requires:
  - phase: 09-01
    provides: ".env.pipeline (D-17, Session Pooler), decisão de ordem de coleta (D-23)"
  - phase: 09-02
    provides: "paths.py (cache_path/ledger_path/cache_root), scripts pipeline:* declarados no package.json, contrato do despachante cli.py"
provides:
  - "enumerate.py -- lista determinística dos 4.212 arquivos RD{UF}{AA}{MM} esperados (27 UFs x 12 meses x 13 anos, D-11), ausência vira SystemExit não-zero, nunca 'OK · 0 linhas' (SC-1/PIPE-01)"
  - "ledger.py -- FileLedger, ledger de arquivo local (Camada 1, D-12), retomada idempotente sem duplicar nem rebaixar status (PIPE-03), escrita atômica .tmp+os.replace"
  - "download.py -- laço de download com isolamento de falha por arquivo (try/except + mark_failed + continue, PIPE-06), nunca Database.download(files=[...]) em lote"
  - "cli.py -- despachante declarativo preguiçoso dos 9 subcomandos pipeline:*, dono único desta plan, nenhum outro plano da fase o edita"
  - "A corrida completa dos 4.212 arquivos, disparada nesta plan (D-01) -- Task 3 bloqueada por disco do operador dias depois, SUPERADA por collect.py (09-04-COLETA-INCREMENTAL), nunca reexecutada como corrida monolítica"
affects: ["09-06 (population.py)", "09-07 (aggregate.py)", "09-08 (reconcile.py)", "09-09 (partitions.py)", "09-10 (upload.py)", "09-12 (audit.py)", "todos os planos 09-04-* ad-hoc listados abaixo"]

# Tech tracking
tech-stack:
  added: ["pysus==1.0.1 (pinado, nunca >=/~= -- 2.x devolve arquivos RJ/SP sob o nome do grupo RD pedido)"]
  patterns:
    - "Falha ruidosa por desenho: assert_no_missing levanta SystemExit com contagem+nomes ausentes, nunca return False/print de aviso/exit 0 (SC-1)"
    - "Ledger de arquivo local, nunca na rede -- retomada de uma corrida de dias não pode depender de conectividade para saber o que já baixou (D-12 Camada 1)"
    - "Isolamento de falha por arquivo: try/except Exception + mark_failed + continue -- uma exceção nunca aborta o restante da corrida (PIPE-06)"
    - "cli.py despachante puramente declarativo (dict SUBCOMANDOS + resolver() via importlib) -- registrar um subcomando novo é uma linha no dict, nunca um if por nome"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/enumerate.py
    - pipeline/sih/src/sih_pipeline/ledger.py
    - pipeline/sih/src/sih_pipeline/download.py
    - pipeline/sih/src/sih_pipeline/cli.py
    - pipeline/sih/tests/test_enumerate.py
    - pipeline/sih/tests/test_ledger.py
  modified: []

key-decisions:
  - "[Decisão original do plano, D-01] A corrida completa de download começa nesta onda em vez de esperar a depuração do SC-7 terminar -- download/agregação são etapas independentes e idempotentes, só o upload espera a reconciliação fechar."
  - "[Decisão operacional, dias depois desta plan] Task 3 (disparar a corrida completa como um download monolítico de ~10-13 GB) ficou bloqueada pelo disco real do operador (~1,5-8,4 GB livres, medido) -- não corrigida dentro desta plan, SUPERADA por um mecanismo novo (collect.py, 09-04-COLETA-INCREMENTAL) que baixa/agrega/recicla uma UF por vez, sem exigir o pico de disco da corrida inteira."
  - "[Decisão operacional acumulada ao longo de vários planos ad-hoc] Cinco lacunas reais de qualidade de dado foram encontradas e corrigidas SOMENTE depois que a corrida real rodou contra o FTP do DataSUS de verdade -- nenhuma foi hipotética nem encontrada em teste sintético; cada uma tem seu próprio SUMMARY ad-hoc (ver tabela abaixo)."

patterns-established:
  - "download_one nunca usa Database.download(files=[...]) (método em lote sem isolamento de falha por item) -- sempre File.download() individual dentro do laço com try/except próprio"
  - "Todo módulo pipeline expõe main(argv: list[str]) -> int + guard __main__, resolvido pelo cli.py via importlib -- nunca lógica de subcomando dentro do despachante"

requirements-completed: [PIPE-01, PIPE-03, PIPE-05, PIPE-06]

# Metrics
duration: ~1h (sessão original, 2026-08-05) -- a corrida real que a Task 3 disparou continuou rodando (e sendo corrigida/retomada) por dias em sessões ad-hoc subsequentes, listadas abaixo
completed: 2026-08-13 (fechamento formal deste SUMMARY -- o código e a corrida já estavam completos e em produção desde antes; nenhum trabalho novo de coleta foi feito para este documento)
---

# Phase 9 Plan 04: Enumeração, ledger de arquivo e download isolado por falha Summary

**As três peças que tornam a coleta SIH-RD auditável antes de rápida — `enumerate.py` (ausência vira falha ruidosa, SC-1), `ledger.py` (retomada idempotente com prova por arquivo, PIPE-03/PIPE-05) e `download.py` (isolamento de falha por arquivo, PIPE-06) — foram entregues e comitadas nesta sessão; a corrida completa que a Task 3 deveria disparar ficou bloqueada por disco do operador dias depois e foi superada por um mecanismo incremental por UF (`collect.py`, plano ad-hoc separado), que terminou a coleta nacional real: 27/27 UFs, 13.466.703 linhas, zero falhas.**

## Por que este SUMMARY está sendo escrito agora

Este plano não tinha `SUMMARY.md` nem o checkbox do ROADMAP marcado, apesar de o trabalho estar completo: as Tasks 1 e 2 foram commitadas normalmente (`bc93cda`, `d890b06`), a Task 3 entregou `download.py`/`cli.py` (`945e984`) e o README de operação (`c8f115e`), mas o item final da Task 3 — "disparar a corrida completa em segundo plano" — ficou bloqueado pelo disco real do operador antes de ser fechado com um `SUMMARY.md` formal. Nos dias seguintes, o trabalho continuou inteiramente como planos ad-hoc sem `PLAN.md` (brief operacional do usuário), o que preveniu o encerramento automático desta plan. Este documento fecha essa lacuna de escrituração: **nenhum código novo foi escrito para produzi-lo** — é documentação do que já está em produção.

## Performance

- **Duração (sessão original, código):** ~1h (2026-08-05, 12:50–13:02) — Tasks 1-2 e o código da Task 3
- **Duração (corrida real completa, incluindo bloqueios/retomadas):** dias, através de 6 planos ad-hoc subsequentes (ver "Task 3 — o que realmente aconteceu" abaixo)
- **Tasks:** 3/3 completas — Task 1 e 2 diretas; Task 3 completa em código, mas seu item final ("disparar a corrida") foi **superado**, não executado como escrito
- **Files modified:** 6 criados (4 módulos + 2 arquivos de teste), 0 modificados

## Accomplishments

- **`enumerate.py`**: `expected_file_names()` computa os 4.212 nomes `RD{UF}{AA}{MM}` (27 UFs × 12 meses × 13 anos, janela D-11 2013–2025) por regra determinística, nunca por suposição sobre o que o FTP publica — o FTP já tinha arquivos de 2026 no momento da implementação, e a janela é filtro explícito do pipeline. `assert_no_missing()` levanta `SystemExit` com a contagem e os nomes ausentes; ausência de exceção é o único sinal de sucesso, nunca uma mensagem "OK" impressa.
- **`ledger.py`**: `FileLedger` grava `<cache_root>/ledger/files.json` com escrita atômica (`.tmp` + `os.replace`), status `baixado`/`falhou`/`nunca_tentado`, `sha256` + `row_count` por arquivo (a prova de captura que PIPE-05 exige). A regra de não-rebaixamento (um arquivo `baixado` nunca regride para `falhou` numa retomada) está explícita no código citando PIPE-03.
- **`download.py`**: `download_all` roda `enumerate.assert_no_missing()` antes do primeiro byte (SC-1 no caminho de produção, não só em teste), depois percorre `ledger.pending(expected)` com `try/except Exception` por arquivo — uma falha nunca aborta o restante da corrida (PIPE-06). Usa `File.download()` individual, nunca `Database.download(files=[...])` (que não isola falha por item).
- **`cli.py`**: despachante declarativo — `SUBCOMANDOS` é um `dict` literal (subcomando → módulo, plano dono), `resolver()` faz `importlib.import_module` + `getattr(mod, "main", None)`. Escrito uma única vez nesta plan; todo plano subsequente da fase (09-05 a 09-12) acendeu seu próprio subcomando sem tocar este arquivo — confirmado pela ausência de commits de outros planos sobre `cli.py` desde então.

## Task 3 — o que realmente aconteceu (não como o plano previu)

O plano previa: disparar `npm run pipeline:download` desanexado, cobrindo os ~10-13 GB dos 4.212 arquivos numa corrida só, e confirmar liveness. Isso **nunca rodou como uma corrida monolítica** — o disco real do operador (~1,5 GB livres num único volume de 228 GB, medido) estava muito abaixo da folga de ~12-15 GB necessária.

Em vez de forçar a corrida original, o trabalho seguinte (`09-04-COLETA-INCREMENTAL`, plano ad-hoc sem `PLAN.md` formal, brief operacional do usuário em 2026-08-10) reformulou o problema: `collect.py` baixa **uma UF inteira por vez** (via `download_all(only=[...])`, já entregue por esta plan, sem alteração), agrega localmente, persiste só as linhas agregadas (pequenas) e recicla o parquet bruto daquela UF antes de seguir para a próxima. O pico de disco caiu do tamanho da corrida inteira para o tamanho da maior UF sozinha (SP, ~1,9 GB) — dentro da folga real do operador. `ledger.py`/`download.py`/`enumerate.py` desta plan permaneceram **intocados**: `collect.py` é uma camada nova que os reaproveita, nunca uma reescrita.

A corrida incremental então rodou por dias, através de mais 6 planos ad-hoc — cada um corrigindo uma falha real encontrada só porque a coleta estava rodando contra o FTP público do DataSUS de verdade, não contra um mock:

| Ordem | Plano ad-hoc | Achado real | Commit(s) | SUMMARY |
|---|---|---|---|---|
| 1 | `09-04-COLETA-INCREMENTAL` | Bloqueio de disco da Task 3 original resolvido pelo laço incremental por UF; guarda de disco recalibrada ao vivo (DF, capital federal, mediu ~12× a semente) | `82b2dc9`, `02e0e65`, `7384dc0` | `09-04-COLETA-INCREMENTAL-SUMMARY.md` |
| 2 | `09-04-GUARDA-TRAVAMENTO` | `RDPR1805.dbc` ficou 9h sem nenhum byte novo, socket FTP `ESTABLISHED`, sem exceção/timeout — isolamento por arquivo nunca disparava porque, do ponto de vista do código, "ainda estava em andamento" | `b458ce5` | `09-04-GUARDA-TRAVAMENTO-SUMMARY.md` |
| 3 | `09-04-FIX-DOWNLOAD-VAZIO` | Regressão da guarda de trava: a corrida seguinte corrompeu 152/420 arquivos (`.dbc` de 0 bytes) sem a guarda disparar — faltava validação de resultado, não o transporte em si | `1582244` | `09-04-FIX-DOWNLOAD-VAZIO-SUMMARY.md` |
| 4 | `09-04-FIX-AGREGACAO-VAZIO` | String vazia em `VAL_TOT`/`DIAS_PERM`/`MORTE`/`ANO_CMPT` sendo coagida cegamente no cast, não tratada como ausência explícita | `2516c45` | `09-04-FIX-AGREGACAO-VAZIO-SUMMARY.md` |
| 5 | `09-04-FIX-DBC-CORROMPIDO` | Registro desalinhado/truncado num `.dbc` por arquivo, detectável antes da agregação | `62bd0fc` | `09-04-FIX-DBC-CORROMPIDO-SUMMARY.md` |
| 6 | `09-04-FIX-MUNICIPIO-BRANCO` | `MUNIC_MOV`/`MUNIC_RES` em branco ou malformado derrubava a agregação da UF inteira em vez de descartar só o registro afetado | `ca78300` | `09-04-FIX-MUNICIPIO-BRANCO-SUMMARY.md` |
| 7 | `09-04-AUTOCURA-LEDGER` | Deadlock permanente "arquivo `baixado` no `FileLedger`, parquet ausente em disco" (após reparo manual do operador) — `collect.py` passou a se autocurar antes de decidir o download | `e0198f9` | `09-04-AUTOCURA-LEDGER-SUMMARY.md` |

Nenhuma dessas correções alterou `enumerate.py`/`ledger.py`/`download.py`/`cli.py` desta plan — todas viveram em `collect.py` (a camada nova) ou em módulos de outras plans (`aggregate.py`, `codigos.py`).

## Estado final medido (não assumido)

A corrida nacional terminou: **27/27 UFs `agregado_reciclado`, 13.466.703 linhas, zero `falhou`** — confirmado pelo `collect_state.json` e, de forma independente, pelas substituições de produção subsequentes (`09-10`, `09-10-SEGUNDA-SUBSTITUICAO`) que consumiram esse resultado: `sih_metric_uf` em produção hoje tem 207.664 linhas / 331 agravos, e o ledger de arquivo (Camada 1, desta própria plan) está em **4.212/4.212** `baixado` (fechado pelo `09-12`, que encontrou e corrigiu uma lacuna residual de 12 arquivos cuja prova de ledger tinha sumido apesar do dado já estar agregado — ver `09-12-SUMMARY.md`).

## Task Commits

1. **Task 1: enumeração determinística dos 4.212 arquivos (SC-1/PIPE-01)** — `bc93cda` (feat)
2. **Task 2: ledger de arquivo Camada 1 — retomada idempotente (PIPE-03/PIPE-05/D-12)** — `d890b06` (feat)
3. **Task 3: download com isolamento de falha por arquivo + despachante cli.py (PIPE-06)** — `945e984` (feat)
4. **Task 3 (continuação): README de operação da corrida (D-01)** — `c8f115e` (docs)

**Plan metadata:** (este commit — `docs: complete plan`, escrito 2026-08-13, dias depois do código)

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/enumerate.py` — `expected_file_names`, `UFS`, `YEARS`, `diff_expected_actual`, `assert_no_missing`, `fetch_actual_file_names`, `main`
- `pipeline/sih/src/sih_pipeline/ledger.py` — `FileLedger`, `STATUS_BAIXADO`/`STATUS_FALHOU`/`STATUS_NUNCA_TENTADO`
- `pipeline/sih/src/sih_pipeline/download.py` — `download_one`, `download_all`, `main`
- `pipeline/sih/src/sih_pipeline/cli.py` — `SUBCOMANDOS`, `resolver`, `main`
- `pipeline/sih/tests/test_enumerate.py` — 6+ testes, zero rede
- `pipeline/sih/tests/test_ledger.py` — 8+ testes, `test_resume_no_duplicate` (nome exigido pelo `09-VALIDATION.md`)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: (1) D-01 (baixar já, upload espera reconciliação) seguido como escrito; (2) a corrida monolítica da Task 3 foi abandonada em favor do laço incremental por UF assim que o disco real do operador provou ser insuficiente — decisão operacional tomada fora desta plan, documentada aqui por completude; (3) cinco (mais uma sexta, autocura de ledger) lacunas de qualidade de dado só apareceram por a corrida ser real, não simulada, e cada uma foi corrigida no módulo/plano correto, nunca retroativamente dentro desta plan.

## Deviations from Plan

**Uma deviation estrutural, não um auto-fix de execução**: o item final da Task 3 ("disparar a corrida completa em segundo plano") não foi executado como o plano descreveu (uma corrida monolítica de ~10-13 GB) porque o disco real do operador não permitia — isso é uma condição de ambiente medida, não um bug de código. A resposta foi arquitetural (Rule 4 em espírito, ainda que aplicada num plano ad-hoc subsequente, não dentro desta execução): um mecanismo novo e incremental (`collect.py`) que reaproveita `enumerate.py`/`ledger.py`/`download.py` sem alterá-los. Nenhum código desta plan foi revertido ou corrigido — o handoff ficou aberto, formalmente, até este SUMMARY.

## Issues Encountered

Nenhum na sessão original de código (Tasks 1-3, 2026-08-05). Os sete achados reais listados na tabela "Task 3 — o que realmente aconteceu" ocorreram em sessões subsequentes, cada um com seu próprio SUMMARY — não repetidos aqui.

## User Setup Required

Nenhum novo. `.env.pipeline` (D-17) já existia desde o `09-01`.

## Next Phase Readiness

- **PIPE-01/PIPE-03/PIPE-05/PIPE-06 fechados** — provados por teste nesta plan E por produção real (4.212/4.212 no ledger, 27/27 UFs, zero falhas residuais).
- **`cli.py` continua com dono único** — nenhum plano da fase o editou fora do que o contrato desta plan previa.
- **09-13/09-14 são os únicos itens pendentes da fase** — este SUMMARY não muda esse estado, só formaliza um trabalho já concluído.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-13*

## Self-Check: PASSED

Todos os 6 arquivos (`enumerate.py`, `ledger.py`, `download.py`, `cli.py`, `test_enumerate.py`, `test_ledger.py`) existem no disco; os 4 hashes de commit desta plan (`bc93cda`, `d890b06`, `945e984`, `c8f115e`) e os 7 hashes das plans ad-hoc que superaram/corrigiram a Task 3 (`82b2dc9`, `02e0e65`, `7384dc0`, `b458ce5`, `1582244`, `2516c45`, `62bd0fc`, `ca78300`, `e0198f9`) existem em `git log --oneline --all`.
