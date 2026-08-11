---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-GUARDA-TRAVAMENTO
subsystem: infra
tags: [python, ftplib, pysus, ftp, timeout, resiliencia, tdd]

# Dependency graph
requires:
  - phase: 09-04-coleta-incremental
    provides: "download_one/download_all com isolamento de falha por arquivo (PIPE-06/T-09-18), FileLedger"
provides:
  - "Guarda de trava (no-progress) no caminho de download FTP: socket-level timeout + retry limitado + roteamento para o PIPE-06 existente"
  - "DownloadStalledError, STALL_TIMEOUT_SEC, MAX_STALL_RETRIES, _com_guarda_de_trava, _uma_tentativa_de_download em download.py"
  - "download_one(..., ftp_factory=None) injetável para teste sem rede"
affects: [09-04-coleta-incremental, collect.py, corrida-em-producao-27-ufs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timeout de socket por-recv (ftp.sock.settimeout + ftp.timeout) como detector de FALTA DE PROGRESSO, não de tempo total -- cada chunk recebido reseta a janela"
    - "Retry bounded só para a classe de erro transitória (TimeoutError), nunca para outras exceções -- erro permanente cai direto no PIPE-06 sem desperdiçar tentativa"
    - "Reconexão do zero (FTPSingleton.close()+get_instance()) a cada tentativa, nunca reaproveitando uma conexão que acabou de travar"
    - "Dependência injetável (ftp_factory) só para viabilizar teste sem rede -- produção continua usando o FTPSingleton real do pysus, importado dentro do corpo da função"

key-files:
  created:
    - pipeline/sih/tests/test_download.py
  modified:
    - pipeline/sih/src/sih_pipeline/download.py

key-decisions:
  - "Mecanismo escolhido: timeout de socket (ftp.sock.settimeout + ftp.timeout) em vez de watchdog thread -- é o mecanismo mais simples que detecta corretamente FALTA DE PROGRESSO (cada recv() individual da conexão de dados tem um prazo que reseta a cada chunk), não overall-elapsed-time; não reimplementa o loop de recv do ftplib, só configura o timeout que ele já respeita"
  - "STALL_TIMEOUT_SEC=120s (2 minutos sem nenhum byte novo) e MAX_STALL_RETRIES=3 -- valores conservadores para uma rede pública sem SLA (DATASUS); nenhum dos dois apareceu como requisito numérico no brief, então documentados como escolha de implementação, ajustáveis se a corrida real revelar timeout curto demais para picos de latência do FTP público"
  - "Retry só para TimeoutError -- qualquer outra exceção (arquivo ausente, permissão) propaga na primeira ocorrência, sem consumir tentativa, preservando o PIPE-06 existente sem atraso artificial"
  - "download_one ganhou um parâmetro ftp_factory opcional (default None -> FTPSingleton real) só para permitir injeção em teste -- download_all não muda de assinatura nem de comportamento, chama download_one(file, ledger) exatamente como antes"

requirements-completed: []  # PIPE-06 continua Pending no REQUIREMENTS.md -- este e um hardening, nao a conclusao formal (que depende da corrida completa das 27 UFs)

# Metrics
duration: ~35min
completed: 2026-08-11
---

# Phase 09 Plan 04-GUARDA-TRAVAMENTO: Guarda de trava no download FTP Summary

**Timeout de socket por-recv (120s sem byte novo, não tempo total) em `download.py`, com retry limitado a 3 tentativas e roteamento para o isolamento por arquivo (PIPE-06) já existente — corrige o travamento silencioso de 9h medido em produção em `RDPR1805.dbc`.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-11
- **Tasks:** 1 (implementação + testes TDD, sem checkpoints)
- **Files modified:** 2 (1 modificado, 1 criado)

## Accomplishments

- `download_one` agora arma o timeout de socket do `FTPSingleton` (`STALL_TIMEOUT_SEC=120.0`) antes de cada `retrbinary`, nos dois pontos que o `ftplib` usa: `ftp.sock.settimeout(...)` (conexão de controle já aberta) e `ftp.timeout = ...` (usado pelo `ftplib` para abrir a conexão de DADOS do RETR). Uma trava real (bytes param de chegar, socket ainda `ESTABLISHED`) agora vira `TimeoutError` em vez de bloqueio eterno.
- Isso é detecção de **falta de progresso**, não de tempo total: cada `recv()` individual tem seu próprio prazo que reseta a cada chunk recebido — um arquivo grande e saudável (SP, MG, BA, RS inteiros) nunca esbarra nisso, só uma transferência que realmente parou de entregar bytes.
- `_com_guarda_de_trava` retenta especificamente essa condição (nunca outra exceção) até `MAX_STALL_RETRIES=3` vezes, reconectando do zero (`FTPSingleton.close()` + `get_instance()`) a cada tentativa e logando cada uma em `stderr` — os 9h silenciosos do incidente real eram tanto o bug quanto a trava em si, então a nova guarda nunca falha em silêncio.
- Esgotadas as tentativas, levanta `DownloadStalledError`, que `download_all` trata exatamente como qualquer outra exceção de arquivo já tratava (`except Exception -> ledger.mark_failed -> continue`, PIPE-06/T-09-18) — nenhum caminho de erro novo foi criado; o arquivo cai em `falhou`, a UF (via `collect.py`) cai em `falhou`, e é retomada automaticamente na próxima corrida.
- 8 testes novos em `test_download.py`, todos offline (sem rede, sem `sleep` real): a trava é simulada injetando uma tentativa/`ftp_factory` falsa que levanta `TimeoutError` — o mesmo tipo que o timeout de socket real levantaria.

## Task Commits

Tarefa única (implementação + testes TDD), commitada atomicamente:

1. **Guarda de trava no download FTP** — `b458ce5` (feat) — `download.py` (guarda + retry + reconexão) e `test_download.py` (8 testes) no mesmo commit, já que a guarda e sua prova formam uma unidade indivisível nesta plan sem checkpoints.

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/download.py` — `STALL_TIMEOUT_SEC`, `MAX_STALL_RETRIES`, `DownloadStalledError`, `_com_guarda_de_trava` (retry limitado só para `TimeoutError`, com log por tentativa), `_uma_tentativa_de_download` (reconecta + arma os dois timeouts + `RETR`), `download_one` reescrito para compor as duas (com `ftp_factory` injetável, default `None` -> `FTPSingleton` real do `pysus`)
- `pipeline/sih/tests/test_download.py` (novo) — 8 testes: guarda detecta e esgota tentativas (`DownloadStalledError` encadeado via `raise ... from`); guarda recupera de trava transitória; guarda NÃO mata transferência lenta-mas-saudável (regressão explícita); guarda respeita o limite exato de tentativas; guarda não retenta erro que não é trava; `download_one` esgota tentativas/reconecta/limpa o `.dbc` parcial; `download_one` recupera de trava transitória e completa (hash+conversão+ledger, com `pysus.data.dbc_to_dbf`/`dbf_to_parquet` dublados); `download_all` isola um arquivo travado sem derrubar o outro (regressão do PIPE-06 existente)

## Decisions Made

- **Mecanismo: timeout de socket, não watchdog thread.** É o mecanismo mais simples que já detecta corretamente falta-de-progresso (o `ftplib.retrbinary` já chama `conn.recv(blocksize)` em loop; um timeout no socket faz cada chamada individual expirar se não chegar byte novo, resetando a cada chunk) sem reimplementar o loop de recv do `ftplib` nem introduzir uma thread concorrente com todos os riscos de sincronização que isso trria. Proporcional ao pedido: "robustness guard on an existing, working download path — not a rewrite".
- **`STALL_TIMEOUT_SEC=120s`, `MAX_STALL_RETRIES=3`** — valores conservadores escolhidos para uma rede pública sem SLA (FTP do DATASUS); não apareceram como requisito numérico no brief, documentados como escolha de implementação. Se a corrida real revelar picos de latência maiores que 120s em transferências saudáveis (falso positivo), ajustar a constante é uma mudança de uma linha.
- **Retry só para `TimeoutError`.** Qualquer outra exceção (arquivo ausente na listagem, erro de permissão) propaga na primeira ocorrência, sem consumir tentativa — evita atrasar artificialmente o `mark_failed` que o PIPE-06 já faz corretamente para erros não-transitórios.
- **`ftp_factory` injetável em `download_one`** — único ponto de acoplamento novo com o restante do código; `download_all` continua chamando `download_one(file, ledger)` sem mudança de assinatura nem comportamento visível.

## Deviations from Plan

None - o brief não é uma plan formal (não há PLAN.md), então não há "desvio" no sentido de tasks pré-definidas; a implementação seguiu integralmente o `<what_to_build>` do brief: detecção de falta-de-progresso (não elapsed-time), roteamento para o PIPE-06 existente, retry limitado, timeout de socket, log claro.

## Issues Encountered

Nenhum bloqueio. A verificação RED foi feita reduzindo temporariamente o laço de retry de `_com_guarda_de_trava` para 1 tentativa (edição no arquivo real, segura porque o processo de coleta em produção já carregou seus módulos e só relê o disco na próxima execução) — 5 dos 8 testes falharam como esperado, confirmando que os testes exercitam de verdade a lógica de retry/detecção e não são vácuos; a implementação correta foi restaurada de um backup em scratchpad antes do commit e a suíte inteira (`uv run pytest -q`, 62 testes no módulo `test_download.py`+resto, 100% do pipeline) e `npm run gate` (796 testes vitest + build) voltaram a passar 100%.

## User Setup Required

None - hardening interno, sem configuração externa nova.

## Next Phase Readiness

- A corrida de coleta em segundo plano (PID 46582, iniciada 17:11, viva e ativa no momento deste registro) continua rodando com o `download.py` ANTERIOR já carregado em memória — a guarda de trava só entra em vigor na PRÓXIMA execução de `npm run pipeline:collect`/`npm run pipeline:download` (comportamento esperado e documentado no brief: "Editing the .py files is safe — the running process already loaded its modules").
- Faltam BA/MG/RS/SP/PR (nunca iniciadas ou travadas antes deste fix) e uma segunda passada de MA (retomada automática, `falhou`) para completar as 27 UFs — a próxima vez que a corrida travar num desses arquivos grandes, a guarda vai transformar o silêncio de horas num `falhou` + log em minutos, permitindo que `collect.py` siga para a próxima UF em vez de bloquear a corrida inteira.
- Nenhum novo bloqueio introduzido; PIPE-06 permanece `Pending` em `REQUIREMENTS.md` (a conclusão formal continua dependendo da corrida completa das 27 UFs, não desta hardening).

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: pipeline/sih/src/sih_pipeline/download.py
- FOUND: pipeline/sih/tests/test_download.py
- FOUND: commit b458ce5 (feat(09-04-guarda-travamento): guarda de trava no download FTP)
