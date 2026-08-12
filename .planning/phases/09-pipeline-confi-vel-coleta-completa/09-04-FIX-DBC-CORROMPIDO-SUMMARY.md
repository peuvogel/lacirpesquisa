---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-FIX-DBC-CORROMPIDO
subsystem: infra
tags: [python, pyarrow, ftp, dbc, integridade, tdd, pipe-06]

# Dependency graph
requires:
  - phase: 09-04-fix-download-vazio
    provides: "DownloadVazioError (.dbc de 0 bytes) e cleanup de .dbc cobrindo todo o caminho até mark_collected"
  - phase: 09-04-fix-agregacao-vazio
    provides: "_blank_to_null/_cast_morte em aggregate.py -- as MESMAS funções reutilizadas aqui, nunca copiadas"
provides:
  - "_valida_registros_alinhados: roda o cast que aggregate.py aplicaria (VAL_TOT/DIAS_PERM/ANO_CMPT/MORTE) por ARQUIVO, dentro de download_one, antes de mark_collected"
  - "RegistroCorrompidoError: nova classe de falha isolada pelo PIPE-06 já existente (except Exception -> mark_failed -> continue), nunca um caminho de erro novo"
  - "Cleanup de download_one ampliado: apaga também o parquet_dir já convertido (não só o .dbc) em qualquer falha pós-conversão -- sem isso, dbc_to_dbf reaproveitaria o parquet corrompido em vez de reconverter na próxima tentativa"
  - "Fixture real tests/fixtures/rdgo_1902_corrompido.parquet (RDGO1902, GO/2019-02, projetado às 4 colunas checadas, 10.699 registros) -- localizada varrendo os 156 arquivos de GO em cache contra o mesmo cast, não sintética"
affects: [09-04-coleta-incremental, collect.py, aggregate.py, corrida-em-producao-27-ufs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checagem de integridade por ARQUIVO, reusando (via import, nunca cópia) as mesmas funções de transformação que o consumidor downstream (aggregate.py) vai aplicar -- garante que a checagem nunca divirja do que realmente quebra depois"
    - "Custo proporcional ao problema: projeta só as colunas em risco (4 de 113) via pyarrow.dataset, sobre UM arquivo por chamada -- nunca a UF inteira, nunca amostragem (o defeito medido é raro por registro, uma amostra teria a mesma chance de errar)"
    - "Cleanup de artefato intermediário precisa cobrir TODO estado que um retry reaproveitaria -- não só o insumo (.dbc), também o produto já convertido (parquet_dir), quando a própria dependência de terceiros (pysus) tem um guard de 'já existe, reaproveita' que um artefato corrompido esquecido envenenaria permanentemente"

key-files:
  created:
    - pipeline/sih/tests/fixtures/rdgo_1902_corrompido.parquet
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-04-FIX-DBC-CORROMPIDO-SUMMARY.md
  modified:
    - pipeline/sih/src/sih_pipeline/download.py
    - pipeline/sih/tests/test_download.py

key-decisions:
  - "Checagem vive em download.py (não em aggregate.py/collect.py), no ponto exato onde row_count/sha256 já são computados e onde uma falha já cai no except Exception que isola por arquivo (PIPE-06) -- é o brief explícito, e é o único ponto onde 'um arquivo ruim' ainda é uma unidade de retry barata (re-baixar 1 arquivo de ~230KB-1MB, não re-processar os 156 de uma UF)"
  - "Reusa _blank_to_null/_cast_morte de aggregate.py via import direto (símbolos privados, nunca copiados) -- garante que a checagem NUNCA divirja do cast real que a agregação aplica; a alternativa (duplicar a lógica) teria o mesmo risco de drift que já causou dois bugs anteriores nesta fase (FIX-DOWNLOAD-VAZIO, FIX-AGREGACAO-VAZIO)"
  - "Verificado, não assumido: o valor '1.87' citado no brief como suspeito de int64 na verdade mede como VAL_TOT (float64) com um byte de controle invisível anexado ('  1.87\\x90', só visível no repr()) -- '1.87' sozinho casta limpo para double (confirmado ao vivo). O teste sintético usa '1.87' literalmente contra DIAS_PERM (int64), satisfazendo a instrução explícita do brief ('1.87 into an int column'); o teste REAL usa o valor genuíno medido em RDPA2303 (documentado no código) para não perder a evidência de produção"
  - "Cleanup do except em download_one ampliado para apagar também o parquet_dir (Rule 2, funcionalidade crítica ausente, não pedida explicitamente no brief) -- sem isso, dbc_to_dbf() (que devolve o .parquet de uma tentativa anterior direto, sem reconverter, quando ele já existe em disco) reaproveitaria o parquet corrompido para sempre, e a promessa do brief ('vai re-baixar na próxima passada') seria falsa: o arquivo baixaria de novo mas nunca reconverteria"

patterns-established:
  - "Toda checagem de integridade nova precisa citar o ponto exato onde ela intercepta um caminho de erro JÁ existente (PIPE-06 aqui) -- nunca inventar um mecanismo de isolamento paralelo"

requirements-completed: []  # bugfix sem PLAN.md formal, suporta PIPE-06 (corrida completa das 27 UFs) mas não completa nenhum requisito por si só -- mesmo padrão de FIX-DOWNLOAD-VAZIO/FIX-AGREGACAO-VAZIO

# Metrics
duration: ~2h
completed: 2026-08-12
---

# Phase 09 Plan 04-FIX-DBC-CORROMPIDO: Detecta registro desalinhado por arquivo, antes da agregação Summary

**`_valida_registros_alinhados` roda dentro de `download_one`, por arquivo, o MESMO cast que `aggregate.py` aplicaria depois (reusando `_blank_to_null`/`_cast_morte`, nunca uma cópia) — um `.dbc` que converte sem erro mas tem registro desalinhado agora vira `RegistroCorrompidoError`, isolado pelo PIPE-06 já existente, em vez de derrubar a agregação da UF inteira horas depois de baixar os 156 arquivos.**

## Performance

- **Duration:** ~2h (a maior parte em localizar os arquivos reais corrompidos em cache e medir o valor exato que quebrou produção, não em código)
- **Completed:** 2026-08-12
- **Tasks:** 1 (bugfix sem checkpoints — brief avulso sem PLAN.md formal)
- **Files modified:** 2 (`download.py`, `test_download.py`) + 1 fixture nova

## Accomplishments

- **Localizados os arquivos reais corrompidos em cache, não assumidos.** Varri os 156 arquivos de PA e os 156 de GO já em `~/.lacir/sih-cache/parquet/` (raw, ainda não reciclado porque a agregação falhou) contra o mesmo cast que `aggregate.py` aplica, e encontrei os três arquivos exatos:
  - `RDPA2303.parquet` — `VAL_TOT` com `' 1.87\x90'` (um byte de controle `\x90` grudado; **`repr()` foi necessário para ver isso** — `print()` direto mostra só `'1.87'`, visualmente indistinguível de um valor limpo).
  - `RDGO1902.parquet` — `VAL_TOT` com **82 de 10.699 registros** no padrão `'.25  23.'`/`'.2523.'`/`'.25   23.'` (espaçamento variável, sempre fragmento de dois campos concatenados) — não é 1 valor isolado, é ~0,8% do arquivo.
  - `RDPA1308.parquet` — `ANO_CMPT` (não `DIAS_PERM`) com `'UTEN'` na ÚLTIMA linha do arquivo (índice 15554 de 15555) — fragmento de texto vazando para dentro de um campo numérico, no registro final, consistente com truncamento.
- **Corrigida uma imprecisão do brief por medição direta ("verificado, não assumido").** O brief descreveu `'1.87'` como "decimal landing in a field cast to int64 (DIAS_PERM/ANO_CMPT)" — testei ao vivo: `pc.cast(['1.87'], 'int64')` levanta (`"as a scalar of type int64"`), mas `pc.cast(['1.87'], 'float64')` **não levanta** (1.87 é um double válido). O log real de produção (`collect_state.json`, campo `reason`) confirma "type **double**" para PA, e o valor genuíno medido em `RDPA2303.parquet` é `' 1.87\x90'` — o byte de controle invisível é quem quebra o cast double, não o `1.87` em si. Reporto isso com transparência: o teste sintético usa `'1.87'` literalmente contra `DIAS_PERM` (satisfaz a instrução explícita "'1.87' into an int column... verbatim"); o teste com a fixture REAL usa o valor genuíno de produção.
- **A correção, no ponto exato que o brief pediu:** `_valida_registros_alinhados(parquet_dir, file_name=...)`, chamada dentro de `download_one` logo depois de `row_count = _count_parquet_rows(...)` (mesmo ponto onde `_com_guarda_de_trava`/`DownloadVazioError` já rodam, antes de `mark_collected`). Projeta só as 4 colunas que `aggregate.py` casta eager (`VAL_TOT`, `DIAS_PERM`, `ANO_CMPT`, `MORTE`) via `pyarrow.dataset` — nunca as 113 colunas, nunca a pasta da UF inteira — e roda `pc.cast` vetorizado sobre elas, reusando `_blank_to_null`/`_cast_morte` **importadas de `aggregate.py`** (nunca copiadas), para que a checagem nunca divirja do cast real que quebra a agregação.
- **Custo medido/justificado:** ~4.212 chamadas (uma por arquivo da corrida completa), cada uma lendo 4 de 113 colunas de UM arquivo mensal (milhares de registros, não os milhões de uma UF inteira) — mesma ordem de grandeza que `_count_parquet_rows` (metadado + leitura de poucas colunas), nunca da ordem de uma agregação completa de UF. Sem amostragem: os valores que quebraram produção eram ~1 em 15 mil (PA) ou ~1% (GO) — uma amostra teria a mesma chance de errar que já vínhamos tendo.
- **Achado crítico não pedido explicitamente, corrigido (Rule 2):** `dbc_to_dbf()` do `pysus` tem um guard — se o `.parquet` de uma tentativa anterior já existe em disco, ele **apaga o `.dbc` recém-baixado sem condição e devolve o parquet velho direto, sem reconverter**. Sem ampliar o cleanup do `except` de `download_one` para apagar também o `parquet_dir` (não só o `.dbc`), a promessa do brief ("o arquivo vai re-baixar e reconverter na próxima passada") seria falsa: o arquivo baixaria de novo com sucesso, mas `dbc_to_dbf` ignoraria os bytes novos e devolveria o MESMO parquet corrompido — a checagem falharia identicamente para sempre, e o retry nunca se recuperaria. Corrigido: o cleanup agora apaga `parquet_dir_para_limpeza` (a variável que rastreia o parquet já convertido, se houver) em QUALQUER exceção pós-conversão, não só corrupção de registro.
- **9 testes novos**, incluindo 1 contra dado real de cache (`rdgo_1902_corrompido.parquet`, derivado de `RDGO1902.parquet`, projetado às 4 colunas checadas) e 1 que prova PIPE-06 continua isolando a UMA-UF-inteira-não-morre-por-um-arquivo para esta nova classe de falha.

## Task Commits

Tarefa única (investigação + correção + testes, commitada atomicamente por exigência do hook de pre-commit deste repo — `npm run gate` roda no commit; mesmo padrão de `FIX-DOWNLOAD-VAZIO`/`FIX-AGREGACAO-VAZIO`):

1. **Detecta registro desalinhado por arquivo antes da agregação** — `62bd0fc` (fix) — `download.py` (`RegistroCorrompidoError`, `_valida_registros_alinhados`, cleanup de `parquet_dir` ampliado, docstring do módulo) e `test_download.py` (9 testes novos) no mesmo commit; fixture real `tests/fixtures/rdgo_1902_corrompido.parquet` incluída.

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/download.py` — nova classe `RegistroCorrompidoError`; constante `_COLUNAS_CASTADAS_PELA_AGREGACAO`; nova função `_valida_registros_alinhados` (importa `_blank_to_null`/`_cast_morte` de `aggregate.py`); `download_one` chama a validação logo após `row_count`, e o `except` amplia o cleanup para apagar `parquet_dir_para_limpeza` além do `.dbc`; docstring do módulo ganha seção "Correção de registro corrompido" com a investigação completa
- `pipeline/sih/tests/test_download.py` — 9 testes novos (Prova 6): `test_valida_registros_alinhados_rejeita_decimal_em_coluna_inteira` (`'1.87'` verbatim em `DIAS_PERM`), `test_valida_registros_alinhados_rejeita_fragmentos_concatenados` (`'.25  23.'` verbatim em `VAL_TOT`), `test_valida_registros_alinhados_aceita_padding_de_espaco` (regressão — inclui `MORTE` padded), `test_valida_registros_alinhados_aceita_valor_genuinamente_vazio` (regressão — semântica de `_blank_to_null` preservada), `test_valida_registros_alinhados_rejeita_arquivo_real_go_corrompido` (fixture real), `test_download_one_detecta_registro_corrompido_e_limpa_dbc_e_parquet` (integração completa sem rede, prova o cleanup ampliado), `test_download_all_isola_arquivo_corrompido_sem_derrubar_a_corrida` (PIPE-06 para a nova classe de falha — prova que um arquivo corrompido isola só a si mesmo); mais 1 ajuste num teste pré-existente (ver Deviations)
- `pipeline/sih/tests/fixtures/rdgo_1902_corrompido.parquet` (novo) — GO/2019-02 real, projetado às 4 colunas checadas (`VAL_TOT`/`DIAS_PERM`/`ANO_CMPT`/`MORTE`), 10.699 registros, 82 KB

## Decisions Made

Ver `key-decisions` no frontmatter (4 decisões, todas medidas). Resumo:

- **Checagem em `download.py`, não em `aggregate.py`/`collect.py`** — é o único ponto onde "um arquivo ruim" ainda é uma unidade de retry barata, e onde o `except Exception` do PIPE-06 já existe.
- **Reusa `_blank_to_null`/`_cast_morte` de `aggregate.py` via import, nunca copia** — elimina o risco de drift que já causou dois bugs anteriores nesta mesma fase.
- **`'1.87'` do brief é impreciso; medido e documentado** — o valor real que quebrou PA tem um byte de controle invisível; o teste sintético segue a instrução literal do brief (`'1.87'` em coluna int), o teste real usa o valor genuíno.
- **Cleanup ampliado para o `parquet_dir`, não só o `.dbc`** — sem isso a promessa de "retry na próxima passada" seria falsa, dado o guard de `dbc_to_dbf` que reaproveita parquet existente.

## Deviations from Plan

Não há PLAN.md formal (brief explícito do usuário substitui a plan). Duas adições além do que o brief pediu explicitamente:

**1. [Rule 2 - Missing Critical] Cleanup de `download_one` ampliado para apagar o `parquet_dir` já convertido, não só o `.dbc`**
- **Found during:** desenho da correção, ao ler o código-fonte instalado de `pysus.data.dbc_to_dbf` (mesma disciplina de leitura de fonte já estabelecida em `FIX-DOWNLOAD-VAZIO`)
- **Issue:** `dbc_to_dbf()` apaga o `.dbc` recém-baixado sem condição e devolve o `.parquet` de uma tentativa anterior direto, SEM reconverter, se esse `.parquet` já existir em disco. Sem limpar o parquet corrompido junto com o `.dbc` no cleanup de falha, um arquivo marcado `falhou` por `RegistroCorrompidoError` nunca se recuperaria: a próxima tentativa baixaria bytes novos, mas `dbc_to_dbf` ignoraria eles e devolveria o MESMO parquet corrompido, falhando identicamente para sempre — a promessa do brief ("vai re-baixar na próxima passada") seria falsa.
- **Fix:** `download_one` agora rastreia `parquet_dir_para_limpeza` (populada só depois que a conversão produz um parquet de verdade) e o `except` apaga esse diretório/arquivo (via `shutil.rmtree` ou `unlink`, conforme o tipo) além do `.dbc`, em QUALQUER exceção pós-conversão — não só corrupção de registro.
- **Arquivos modificados:** `pipeline/sih/src/sih_pipeline/download.py`
- **Verificação:** `test_download_one_detecta_registro_corrompido_e_limpa_dbc_e_parquet` prova que tanto o `.dbc` quanto o `RDGO1902.parquet` deixam de existir depois da falha, e que o ledger permanece `nunca_tentado`
- **Commit:** `62bd0fc` (parte do commit único desta correção)

**2. [Rule 3 - Blocking Issue] Ajuste em teste pré-existente (`test_download_one_recupera_de_trava_transitoria_e_completa`) que quebrou com a nova checagem**
- **Found during:** primeira rodada de `pytest tests/test_download.py` depois da integração
- **Issue:** esse teste (herdado de `GUARDA-TRAVAMENTO`) usa `dbc_to_dbf`/`dbf_to_parquet` mockados como identidade e `_count_parquet_rows` mockado — o "parquet_dir" resultante nunca foi um parquet de verdade (é o conteúdo cru simulado do `.dbc`). Minha nova checagem tenta abrir esse "parquet_dir" com `pyarrow.dataset`, que levanta `ArrowInvalid` (schema ilegível) antes mesmo de chegar ao meu `try/except` por coluna — quebrando um teste que não tem nada a ver com corrupção de registro (ele prova a guarda de trava).
- **Fix:** adicionado `monkeypatch.setattr(download, "_valida_registros_alinhados", lambda parquet_dir, *, file_name: None)` nesse teste específico — mesma técnica de dublê já usada ali para `_sha256_of_file`/`_count_parquet_rows`, mantendo o teste focado no que ele sempre provou (retry de stall).
- **Arquivos modificados:** `pipeline/sih/tests/test_download.py`
- **Verificação:** suíte completa volta a 238 passed, 1 skipped
- **Commit:** `62bd0fc` (parte do commit único desta correção)

---

**Total deviations:** 2 auto-aplicadas (1 Rule 2, 1 Rule 3)
**Impact on plan:** Ambas necessárias para que a correção funcionasse de ponta a ponta (retry que realmente recupera) e para não deixar uma regressão de teste pré-existente — sem scope creep além disso.

## Issues Encountered

- **A citação do brief sobre `'1.87'`/int64 não bateu com o valor real medido, e isso é reportado com transparência total** (ver "Accomplishments" e `key-decisions`) — o brief pediu "verificar, não assumir", e a verificação encontrou uma imprecisão na própria descrição do incidente (o log real diz "type double", o valor genuíno tem um byte de controle invisível). Isso não invalida a correção — o teste sintético cobre a instrução literal do brief, e o teste real cobre o que genuinamente quebrou produção.
- **`RDPA1308.parquet` (`ANO_CMPT` com `'UTEN'`) foi encontrado mas não virou fixture separada** — a mesma checagem (`_valida_registros_alinhados`) cobriria esse caso igualmente (`ANO_CMPT` está entre as 4 colunas checadas), mas usar `RDGO1902` como fixture única (mais registros afetados, padrão mais claramente "truncamento", já documentado com o valor exato do brief) foi suficiente para a prova real exigida sem duplicar fixtures. Documentado aqui para o registro: se um caso futuro precisar de um exemplo específico de fragmento-de-texto-em-campo-numérico (distinto de decimal-em-inteiro ou fragmentos-concatenados), `RDPA1308.parquet` ainda está no cache real (não reciclado, PA continua `falhou`).
- **`RDCE`, `RDES`, `RDMT`, `RDPE`, `RDRJ` também aparecem `falhou` na agregação com mensagens `"Failed to parse string..."` similares no `collect_state.json` real** (lido, não modificado) — não investigados individualmente nesta correção (fora do que o brief pediu: "use PA e GO"), mas a MESMA checagem agora os protege igualmente na próxima corrida, já que `_valida_registros_alinhados` roda para todo arquivo, de qualquer UF, sem exceção por sigla.

## User Setup Required

None — correção interna, sem configuração externa nova. Nenhuma ação manual necessária: os arquivos hoje `falhou`/UFs `falhou` no `collect_state.json` real serão retomados automaticamente pelo mecanismo de retomada já existente (`FileLedger.pending`/`CollectLedger`, tratados como somente-leitura nesta correção) na próxima vez que a corrida (já em andamento) processar essas UFs de novo — nenhuma intervenção manual pedida ou feita.

## Next Phase Readiness

- **A corrida nacional em produção (PID monitorado, iniciada antes desta correção) permanece intocada e viva durante todo este trabalho** — verificado no início (elapsed ~1h) e no fim (elapsed ~1h16min) desta correção, sem kill/restart/edição de ledger. A correção entra em vigor no próximo `.dbc` que `download_one` processar (código Python, sem reinício necessário do processo já rodando -- mas como o processo já está em memória com o código ANTIGO carregado, esta correção só protege a próxima UF que ele começar a processar depois de um reinício natural do processo, ou uma corrida futura).
- **`npm run gate` verde** (108 arquivos de teste, 796 testes, build OK) confirmado duas vezes: uma vez antes do commit (verificação manual, 238 passed/1 skipped no pipeline) e uma vez pelo hook de pre-commit do próprio `git commit`.
- **SC-7 permanece byte-idêntico** (`exato=34, explicado=61, inexplicado=3`) — `aggregate.py`/`_blank_to_null`/`_cast_morte` não foram tocados (só importados, nunca modificados); `tests/test_reconcile_gate.py`/`tests/test_aggregate.py` continuam verdes sem alteração.
- **Achado lateral não perseguido, registrado para acompanhamento:** CE/ES/MT/PE/RJ também falharam a agregação com o mesmo padrão de `ArrowInvalid` — não investigados individualmente (fora do escopo do brief), mas cobertos pela mesma correção estrutural. Se a próxima corrida ainda mostrar essas UFs falhando na agregação (não deveria, dado que a checagem agora roda por arquivo, mas depende do processo em produção ser reiniciado com este código), vale conferir se algum arquivo específico dessas UFs escapa das 4 colunas checadas (ex.: corrupção em `IDENT`/`DIAG_PRINC`/`MUNIC_MOV`/`MUNIC_RES`, fora do escopo desta correção — ver `codigos.municipio6()` risco lateral já documentado em `09-04-FIX-AGREGACAO-VAZIO-SUMMARY.md`).
- Nenhum bloqueio novo introduzido.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: pipeline/sih/src/sih_pipeline/download.py
- FOUND: pipeline/sih/tests/test_download.py
- FOUND: pipeline/sih/tests/fixtures/rdgo_1902_corrompido.parquet
- FOUND: commit 62bd0fc (fix(09-04-fix-dbc-corrompido): detecta registro desalinhado por arquivo antes da agregacao)
