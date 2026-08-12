---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-FIX-DOWNLOAD-VAZIO
subsystem: infra
tags: [python, ftplib, pysus, pyreaddbc, ftp, integridade, tdd]

# Dependency graph
requires:
  - phase: 09-04-guarda-travamento
    provides: "Guarda de trava (timeout de socket + retry limitado) no download FTP, DownloadStalledError, _com_guarda_de_trava, _uma_tentativa_de_download"
provides:
  - "Validação de tamanho do .dbc (0 bytes -> DownloadVazioError) ANTES de hash/conversão/mark_collected"
  - "DownloadVazioError tratada por _com_guarda_de_trava como a mesma classe de falha transitória que TimeoutError (retry limitado, reconexão do zero)"
  - "Cleanup de .dbc ampliado em download_one: cobre TODO o caminho até mark_collected (download + hash + conversão), não só a guarda de trava"
  - "Documentação (código + este SUMMARY) da nuance real de pysus.data.dbc_to_dbf/dbf_to_parquet: dbc_to_dbf não levanta para .dbc corrompido-mas-não-vazio (imprime e apaga a origem sem condição); dbf_to_parquet é quem levanta (struct.error) e já se autolimpa nesse caso específico"
affects: [09-04-coleta-incremental, 09-04-guarda-travamento, collect.py, corrida-em-producao-27-ufs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validação de resultado (tamanho > 0) ANTES de qualquer processamento downstream (hash/conversão/ledger) -- o transporte 'não ter levantado exceção' nunca é suficiente para provar sucesso"
    - "Nova classe de falha transitória (DownloadVazioError) compartilhando a mesma política de retry que TimeoutError -- mesma reconexão do zero, mesmo MAX_STALL_RETRIES, sem duplicar a máquina de retry"
    - "Cleanup de arquivo temporário movido para o escopo MAIS AMPLO possível (todo o caminho até a escrita no ledger), nunca só o escopo da primeira operação de rede -- dependências de terceiros (pysus/pyreaddbc) não são consistentes sobre quando autolimpam"

key-files:
  created: []
  modified:
    - pipeline/sih/src/sih_pipeline/download.py
    - pipeline/sih/tests/test_download.py

key-decisions:
  - "Opção B (corrigir o caminho reescrito), não A (reverter para o pysus original) -- medido, não assumido: 25+ downloads reais sequenciais e testes de timeout forçado contra o FTP público do DataSUS usando o código ATUAL (com a guarda) nunca reproduziram um retrbinary 'bem-sucedido' com 0 bytes; o mecanismo RETR com caminho absoluto é idêntico ao que já funcionava para 4.212 arquivos antes de b458ce5 (e ao que pysus.ftp.File.download() usa). Reverter não teria mudado o mecanismo de transporte -- a lacuna real (nenhuma validação de resultado, cleanup incompleto) existia independente da guarda"
  - "DownloadVazioError é RETENTADA pela guarda (mesma política que TimeoutError), não é uma falha permanente imediata -- a causa raiz completa de por que o FTP às vezes reporta sucesso sem transferir dado continua sem prova definitiva (documentada como residual); negar retry a uma condição potencialmente transitória converteria toda flutuação de rede numa falha desnecessária e permanente do arquivo"
  - "Checagem de tamanho ownership: só '== 0 bytes' é tratado como DownloadVazioError explícito (rápido, sem depender de parsing de formato); um .dbc não-vazio mas com cabeçalho corrompido continua sendo detectado pelo dbc_to_dbf/dbf_to_parquet do próprio pysus (autoridade sobre o formato DBC), nunca reimplementado aqui -- evita o risco de um parser de cabeçalho DBC caseiro com endianness/offset errado"
  - "Cleanup de .dbc movido para envolver TODO o trecho até mark_collected (não só a guarda de trava) -- descoberta durante a investigação: dbc_to_dbf() do pysus NÃO levanta em Python para .dbc corrompido-mas-não-vazio (imprime em stderr, apaga a origem sem condição, devolve .dbf de 0 bytes); é dbf_to_parquet() quem levanta de verdade (struct.error) e SÓ ELE já se autolimpa nesse caso específico -- o cleanup ampliado é a rede de segurança para qualquer outra exceção nessa faixa (ex.: _count_parquet_rows) que o pysus não trata sozinho"

requirements-completed: []  # PIPE-06 continua Pending em REQUIREMENTS.md -- este é um bugfix sobre a hardening anterior (09-04-GUARDA-TRAVAMENTO), não a conclusão formal (que depende da corrida completa das 27 UFs)

# Metrics
duration: ~2h
completed: 2026-08-12
---

# Phase 09 Plan 04-FIX-DOWNLOAD-VAZIO: Corrige corrupção silenciosa de download vazio Summary

**`_uma_tentativa_de_download` agora rejeita um `.dbc` de 0 bytes como `DownloadVazioError` (retentável pela mesma guarda de trava) ANTES de qualquer hash/conversão, e `download_one` envolve todo o caminho até `mark_collected` num único cleanup — corrige a corrupção medida em produção (152/420 arquivos, 36%) sem reverter o mecanismo de transporte FTP, que a investigação confirmou continuar funcionando.**

## Performance

- **Duration:** ~2h (a maior parte em investigação empírica contra o FTP real do DataSUS, não em código)
- **Completed:** 2026-08-12
- **Tasks:** 1 (bugfix sem checkpoints — brief sem PLAN.md formal)
- **Files modified:** 2 (`download.py`, `test_download.py`)

## Accomplishments

- **Root cause investigado por medição, não assumido.** Rodei 25+ downloads reais e sequenciais contra `ftp.datasus.gov.br` usando o código ATUAL (com a guarda de trava — `_uma_tentativa_de_download` real, sem mocks) para arquivos pequenos de RR: 25/25 sucesso, 0 bytes vazios, 0 erros. Forcei timeouts artificiais (`ftp.timeout` reduzido a 0.03–0.4s) contra arquivos grandes de SP para simular um stall real: em todos os casos, `TimeoutError` propagou limpo (nunca um "sucesso" silencioso com dado truncado). **Não foi possível reproduzir a hipótese do brief** (RETR com caminho absoluto precisando de `cwd` + nome nu) nem qualquer cenário onde `retrbinary` "termina bem" sem transferir dado — a evidência aponta para uma causa externa/transitória ainda sem prova definitiva, não para um defeito determinístico no mecanismo RETR em si.
- **Escolhida a Opção B (corrigir o caminho atual), não A (reverter).** O mecanismo de transporte (`RETR` com `file.path` absoluto) é **idêntico** entre o código pré-`b458ce5` (que funcionou para 4.212 arquivos) e o código pós-`b458ce5` — a única diferença real são os dois `settimeout` e um `close()` extra antes de reconectar, nenhum dos quais a investigação conseguiu ligar à corrupção. Reverter não mudaria nada de observável; a lacuna real (nenhuma validação de resultado, cleanup incompleto) é ortogonal à guarda de trava.
- **A lacuna real, confirmada:** `download_one` nunca validava o resultado do download (tamanho, cabeçalho) antes de hashear/converter, e o cleanup do `.dbc` só cobria a exceção da própria guarda de trava — um `.dbc` vazio ou corrompido que só falhasse depois (dentro de `dbc_to_dbf`/`dbf_to_parquet`) ficava esquecido no cache indefinidamente, mesmo já marcado `falhou` no ledger.
- **Descoberta adicional durante a investigação** (documentada em código e neste SUMMARY, não estava no brief): `pysus.data.dbc_to_dbf()` **não levanta em Python** para um `.dbc` não-vazio mas com cabeçalho corrompido/truncado — o parser C (`pyreaddbc.dbc2dbf`) só **imprime** "Invalid or corrupt DBC file ... implausible header size" em stderr e devolve um `.dbf` de 0 bytes, tendo **já apagado o `.dbc` de origem sem condição nenhuma**. É o passo seguinte, `dbf_to_parquet()` (lendo esse `.dbf` vazio via `dbfread`), quem levanta de verdade — um `struct.error: unpack requires a buffer of 32 bytes` — e essa função específica do pysus **já se autolimpa** nesse `except struct.error` (apaga o `.dbf`, remove o diretório `.parquet` vazio). Isso explica por que a mensagem "implausible header size" apareceria nos LOGS da corrida real (stderr, print direto) mas não necessariamente no campo `reason` do ledger (que grava `str(exceção_python_levantada)`, e a exceção real levantada é o `struct.error` mais tarde).
- **A correção, proporcional ao que foi medido:**
  1. `_uma_tentativa_de_download` confere `dbc_path.stat().st_size == 0` logo após o `retrbinary` retornar sem exceção — 0 bytes vira `DownloadVazioError` (nova exceção).
  2. `_com_guarda_de_trava` trata `DownloadVazioError` exatamente como `TimeoutError`: mesma classe de falha transitória, mesmo `MAX_STALL_RETRIES`, mesma reconexão do zero por tentativa. Esgotadas as tentativas, ainda levanta `DownloadStalledError` (nome preservado), mas com mensagem que reflete a causa real ("voltou vazio" vs "travou") em vez de sempre alegar "travou".
  3. `download_one` envolve TODO o trecho até `mark_collected` (download + hash + `dbc_to_dbf` + `dbf_to_parquet` + `_count_parquet_rows`) num único `try/except` que apaga o `.dbc` (se ainda existir — cobre tanto "não foi apagado" quanto "já foi apagado por outra camada", nunca levanta `FileNotFoundError` no próprio cleanup) e repropaga.
  4. `mark_collected` continua sendo a **última linha** de `download_one` — nenhum caminho de erro (velho ou novo) passa por ela, então um arquivo vazio ou corrompido nunca vira `baixado` (contrato do `FileLedger` preservado, `baixado` continua significando "baixado e hash-verificado").
- **9 testes novos**, sendo 8 offline e **1 real contra o FTP público do DataSUS** — exatamente a lacuna que `b458ce5` deixou passar (8 testes 100% mockados, nenhum provando que um download real ainda funcionava).

## Task Commits

Tarefa única (investigação + correção + testes), commitada atomicamente:

1. **Valida tamanho/cabeçalho do `.dbc` antes de marcar `baixado`** — `1582244` (fix) — `download.py` (`DownloadVazioError`, checagem de tamanho, cleanup ampliado) e `test_download.py` (9 testes novos) no mesmo commit.

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/download.py` — nova classe `DownloadVazioError`; `_uma_tentativa_de_download` confere tamanho pós-`retrbinary`; `_com_guarda_de_trava` retenta `(TimeoutError, DownloadVazioError)`, mensagens de log/exceção final ajustadas por causa real; `download_one` reestruturado com cleanup envolvendo todo o caminho até `mark_collected`; docstring do módulo com nova seção "Correção de download vazio" documentando a investigação e a nuance real do `dbc_to_dbf`/`dbf_to_parquet`
- `pipeline/sih/tests/test_download.py` — 9 testes novos (Prova 4 offline: `_uma_tentativa_de_download` levanta/não-levanta `DownloadVazioError`; guarda retenta e recupera; guarda esgota e encadeia `DownloadVazioError`; `download_one` limpa+não-marca-`baixado` para download vazio, para `.dbc` com cabeçalho inválido usando `pyreaddbc`/`pysus` REAIS sem mock, e para falha pós-conversão via `_count_parquet_rows`; `download_all` isola PIPE-06 para a nova classe de falha — Prova 5 real: `test_download_one_arquivo_real_pequeno_do_datasus_de_ponta_a_ponta`, skipif por padrão via `SIH_PIPELINE_TEST_REDE_REAL`)

## Decisions Made

Ver `key-decisions` no frontmatter (4 decisões, todas com justificativa medida). Resumo:

- **Opção B, não A** — mecanismo de transporte idêntico entre versões, reverter não mudaria nada observável.
- **`DownloadVazioError` é retentável**, não falha permanente imediata — causa raiz completa ainda sem prova definitiva, tratar como transitória é a escolha mais segura dado o que foi medido.
- **Checagem própria só para "0 bytes exatos"** — validação de cabeçalho/formato continua delegada ao `pysus`/`pyreaddbc` (autoridade sobre o formato DBC), nunca reimplementada aqui.
- **Cleanup ampliado para todo o caminho até `mark_collected`** — descoberta de que `dbc_to_dbf`/`dbf_to_parquet` não são consistentes entre si sobre quando autolimpam.

## Deviations from Plan

Não há PLAN.md formal (brief explícito do usuário substitui a plan) — não há "desvio" no sentido de tasks pré-definidas descumpridas. Uma adição além do que o brief pedia explicitamente, classificada como **Rule 2 (funcionalidade crítica ausente)**:

**1. [Rule 2 - Missing Critical] Testes offline adicionais para o cleanup pós-conversão, além do cenário de cabeçalho inválido**
- **Encontrado durante:** escrita dos testes de integração (Prova 4)
- **Motivo:** a investigação revelou que `dbc_to_dbf`/`dbf_to_parquet` já se autolimpam para o caso específico de `struct.error` — um teste que só cobrisse "cabeçalho inválido" não exercitaria de fato o cleanup NOVO que este fix adiciona (ele já era coberto pelo próprio `pysus`). Adicionei `test_download_one_apaga_dbc_quando_falha_depois_da_conversao_ja_ter_terminado`, que força uma falha em `_count_parquet_rows` (via monkeypatch) — um ponto que o `pysus` NÃO trata sozinho — para provar que o cleanup ampliado cobre exatamente a lacuna que o motivou.
- **Arquivos modificados:** `pipeline/sih/tests/test_download.py`
- **Verificação:** teste passa, `dbc_path` não existe após a falha, ledger permanece `nunca_tentado`
- **Commit:** `1582244` (parte do commit único desta correção)

---

**Total deviations:** 1 auto-adicionado (Rule 2)
**Impact on plan:** Fortalece a cobertura de teste sem alterar o comportamento do código de produção; nenhum scope creep.

## Issues Encountered

- **A hipótese do brief sobre `cwd`/caminho relativo não se confirmou.** O brief levantou como "mecanismo provável" que `RETR` com caminho absoluto (`file.path`) precisasse de `ftp.cwd(...)` + nome nu, citando o teste manual do usuário. Testei diretamente: `pysus.ftp.File.__init__` já monta `file.path` como caminho absoluto completo (`{diretório}/{basename}`), e tanto o código pré-`b458ce5` quanto o pós-`b458ce5` sempre usaram exatamente esse caminho absoluto em `RETR` — nunca houve `cwd` em nenhuma das duas versões. 25+ downloads reais confirmaram que o `RETR` absoluto funciona de forma consistente. Reporto isso explicitamente porque o brief pediu "verificar, não assumir" — verifiquei e a hipótese específica não se sustentou, mas isso não invalida a correção (que ataca a lacuna de validação/cleanup, não o mecanismo de RETR).
- **A causa raiz completa (por que o FTP às vezes reporta sucesso sem transferir dado) permanece sem prova definitiva.** Isso é reportado com transparência total no docstring do módulo e aqui — não forcei uma narrativa de causa raiz que a evidência não sustenta. A correção é robusta a essa incerteza justamente porque não depende de saber a causa exata: qualquer transferência que volte vazia agora falha alto e limpo, é retentada como falha transitória, e nunca vira `baixado` silenciosamente.
- **Achado lateral sobre `~/.lacir/sih-cache/ledger/files.json` (não modificado, só lido):** os 168 registros `falhou` atuais no ledger real mostram majoritariamente `[Errno 2] No such file or directory` como `reason` (167 de 168, todos DF/RR, janela de ~12 min em 2026-08-12), **não** literalmente o texto "implausible header size" que o brief citou como evidência de log. Isso é consistente com a descoberta acima: o texto "implausible header size" é impresso pelo `pyreaddbc` em stderr (visível nos LOGS da corrida), mas a exceção Python que efetivamente chega ao `ledger.mark_failed(reason=str(exc))` é outra, mais adiante na cadeia (ou, possivelmente, de uma segunda tentativa/retomada dentro da mesma corrida). Não persegui essa cadeia exata mais a fundo — está fora do escopo de arquivo desta correção (`collect.py`/`ledger.py` são propriedade de outras plans) e não muda a correção necessária em `download.py`.

## User Setup Required

None — correção interna, sem configuração externa nova. O teste real de rede é opcional e roda só com `SIH_PIPELINE_TEST_REDE_REAL=1` explícito.

## Next Phase Readiness

- **Os 152 arquivos hoje `falhou` no ledger real (`~/.lacir/sih-cache/ledger/files.json`, tratado como somente-leitura nesta correção) serão retomados automaticamente na próxima coleta — confirmado por leitura de código, não assumido:** `FileLedger.pending(expected)` inclui qualquer nome cujo `status != "baixado"` (`ledger.py:106-112`), e `collect_uf()` sempre chama `download_fn(only=sorted(uf_files))` quando há `faltantes` (`collect.py:402-403`) — `falhou` conta como `faltante`. Nenhuma ação manual é necessária além de reiniciar a coleta.
- **`npm run gate` verde** (108 arquivos de teste, 796 testes, build OK) confirmado duas vezes: uma vez antes do commit (verificação manual) e uma vez pelo hook de pre-commit do próprio `git commit`.
- **O usuário pediu explicitamente para NÃO reiniciar a coleta** — isso não foi feito; a correção está pronta para verificação e reinício manual pelo usuário.
- Nenhum bloqueio novo introduzido. PIPE-06 permanece `Pending` em `REQUIREMENTS.md` (a conclusão formal continua dependendo da corrida completa das 27 UFs, agora com esta correção aplicada).
- Ficou registrado, mas fora do escopo de arquivo desta correção, um achado lateral não resolvido: a cadeia exata que produz `[Errno 2] No such file or directory` no ledger real (ver "Issues Encountered") pode merecer uma investigação futura em `collect.py`/`ledger.py` se a próxima corrida real ainda mostrar esse padrão específico — mas a correção presente já garante que nenhuma variante de download vazio/corrompido chega a `baixado`, que era o requisito mandatório.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: pipeline/sih/src/sih_pipeline/download.py
- FOUND: pipeline/sih/tests/test_download.py
- FOUND: commit 1582244 (fix(09-04-fix-download-vazio): valida tamanho/cabecalho do .dbc antes de marcar baixado)
