---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 12
subsystem: database
tags: [python, postgres, postgrest, copy, supabase, storage, audit, provenance, tdd, pipe-05]

# Dependency graph
requires:
  - phase: 09-03
    provides: "schema v3 em produção (sih_collection_status com o check de proveniência obrigatória, PK (disease_id, medida, grao, local, ano))"
  - phase: 09-09
    provides: "partitions.py::construir_indice_territorial -- a fonte territorial única (UF+município) que audit.py e o novo upload.py --municipio reaproveitam"
  - phase: 09-10
    provides: "upload.py com o padrão COPY-para-staging + upsert (build_collection_status_rows, _persistir_collection_status) -- o molde que _persistir_collection_status_municipio replica sem tocar"
  - phase: 09-05
    provides: "oracle_scrape.py (raspador mínimo do TabNet) -- usado ao vivo para a verificação empírica null-vs-zero (Task 3)"
provides:
  - "Coleta e substituição de produção verificadas e documentadas (não repetidas): 27/27 UFs, 331 agravos, 4 medidas, 2 grãos, 2 locais, 2013-2025, medido contra produção real"
  - "Lacuna real de ledger fechada nesta sessão: 12 arquivos RDAC2501..2512 (Acre/2025) ausentes da Camada 1 -- dado já estava em produção, só a prova de arquivo faltava; ledger agora 4.212/4.212"
  - "audit.py -- sih_pipeline.cli audit -- compara o cartesiano completo (331x4x2x2x13~=69mil) contra sih_collection_status e a fonte servida, com a regra pura do D-14 (classificar_ausencia) pronta para a Fase 10 portar"
  - "Camada 2 (sih_collection_status) do grão município fechada por decisão do operador: upload.py --municipio escreveu 33.560 linhas novas (67.120 total), faltantes do grão município caiu de 34.424 para 864 (medido)"
  - "Verificação empírica null-vs-zero contra o TabNet ao vivo (dois casos concretos): confirma que ausência de linha É o zero, TabNet nunca emite célula 0 explícita"
  - "8 categorias de causa externa (V01-Y98) zeradas de 2016 em diante identificadas, investigadas até a causa raiz (migração DIAG_PRINC->DIAGSEC1) e confirmadas contra o TabNet -- registradas com risco didático explícito para a Fase 10/UI, não corrigidas (decisão do operador)"
affects: [09-13, 09-14, "Fase 10 (MAPA-03/MAPA-04 consomem classificar_ausencia; risco didático de causas externas fica registrado para a UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "audit_coverage compara um universo cartesiano completo contra o que existe de fato (status + fonte servida), classificando cada combinação em exatamente um balde (coletado/zero_verdadeiro/ausente/faltantes) -- nunca uma alegação de sucesso sem prova (T-09-44)"
    - "classificar_ausencia(status) é uma função pura de uma linha, documentada com a decisão (D-14) que a motiva -- desenhada para ser portada/importada por um consumidor futuro (Fase 10) sem reinterpretação"
    - "Leitura paginada via PostgREST reaproveita os primitivos de baixo nível (_fetch/_parse_content_range_total) de um módulo irmão em vez de reimplementar a paginação -- nunca confia em HTTP 200 sozinho"
    - "Quando uma função existente e provada em produção (_persistir_collection_status) precisa do mesmo comportamento para uma dimensão nova, a decisão explícita do operador foi NÃO refatorar/generalizar a função existente -- duplicar o pouco SQL necessário numa função nova e separada, para zero risco sobre o caminho já provado duas vezes contra produção real"
    - "Quando não existe fonte barata para verificar uma dimensão (Storage não é consultável em lote via SQL), a auditoria usa a MESMA fonte local que gerou tanto o dado servido quanto a nova linha de proveniência como proxy -- registrado como limitação estrutural, não escondido"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/audit.py
    - pipeline/sih/tests/test_audit.py
    - pipeline/sih/reports/cobertura-final.md
  modified:
    - pipeline/sih/src/sih_pipeline/upload.py
    - pipeline/sih/tests/test_upload.py

key-decisions:
  - "[Rule 1/3 durante Task 1] 12 arquivos RDAC2501..2512 (Acre/2025) ausentes do ledger de arquivo (Camada 1) apesar do dado já estar agregado e em produção -- investigado antes de agir (não uma re-coleta às cegas), fechado reexecutando pipeline:download --only conforme a própria ação da Task 1 prescreve, sem tocar código"
  - "[Achado da Task 2, decisão do operador no checkpoint da Task 3] sih_collection_status não tinha NENHUM escritor de Camada 2 para o grão município -- operador NÃO aceitou registrar como débito, ampliou o file_scope exclusivamente para upload.py --municipio (função nova e separada, não reaproveitando/refatorando o caminho de grão UF já provado 2x em produção)"
  - "[Decisão do operador] 8 categorias de causa externa (V01-Y98) zeradas desde 2016 (causa raiz: migração DIAG_PRINC->DIAGSEC1 na fonte, confirmada contra o TabNet ao vivo) -- registrar e seguir, não construir suporte a DIAGSEC1 agora, não remover do catálogo. Risco didático documentado com destaque; item de acompanhamento explícito para uma fase de UI sinalizar série que zera por mudança de fonte"
  - "[Decisão do operador] Cobertura aprovada (PIPE-05) -- 331/331 agravos, 27/27 UFs, 2013-2025, ledger 4212/4212, SC-7 inalterado (exato=34/explicado=61/inexplicado=3, ok=False por desenho, já aprovado antes)"
  - "metric_keys do grão município em audit.py usa o índice territorial local (a mesma fonte que gerou as partições do Storage E a nova Camada 2), não uma releitura do Storage -- não existe forma barata de auditar o conteúdo do Storage em lote via SQL (D-20 tirou município do Postgres exatamente para não pagar esse custo)"

patterns-established:
  - "TDD RED->GREEN provado em duas rodadas nesta sessão (upload.py --municipio: 8 testes; audit.py metric_keys: 3 testes) -- cada rodada com RED confirmado (AttributeError nas funções ainda inexistentes) antes do GREEN"
  - "Medição antes/depois obrigatória para qualquer fechamento de lacuna contra produção real: --dry-run mede antes de escrever, audit.py roda antes E depois, os dois resultados ficam registrados lado a lado no relatório"

requirements-completed: [PIPE-02, PIPE-05, DATA-01, DATA-02, DATA-03, DATA-04]

# Metrics
duration: ~5h30min (inclui esperas reais de rede/CPU: PostgREST paginado sobre 67-207 mil linhas, construção do índice territorial local sobre ~12,3 milhões de linhas de grão município, três vezes nesta sessão)
completed: 2026-08-13
---

# Phase 9 Plan 12: Fechar a coleta e provar a cobertura Summary

**A coleta e a substituição de produção (já concluídas por planos anteriores) foram verificadas e auditadas — não repetidas: `audit.py` prova que os 331 agravos, 4 medidas, 2 grãos e 2 locais estão servidos e provisionados em `sih_collection_status`, uma lacuna real de ledger (12 arquivos) e uma lacuna arquitetural real de proveniência (grão município) foram encontradas e fechadas, e a premissa null-vs-zero herdada do pipeline aposentado foi confirmada empiricamente contra o TabNet ao vivo, não assumida.**

## Performance

- **Duration:** ~5h30min (sessão longa: três operações de produção reais — download de 12 arquivos, escrita de 33.560 linhas de proveniência de município, duas rodadas de `audit.py` — cada uma envolvendo paginação de rede real ou construção de um índice territorial local sobre ~12,3 milhões de linhas)
- **Tasks:** 3/3 completas (Task 1 auto, Task 2 auto+TDD, Task 3 checkpoint humano — aprovado com 3 decisões que geraram trabalho adicional, todo ele TDD e medido)
- **Files modified:** 5 (`audit.py`, `test_audit.py`, `cobertura-final.md`, `upload.py`, `test_upload.py`)

## Accomplishments

- **Estado da corrida verificado, não repetido**: 27/27 UFs `agregado_reciclado`, 331/331 agravos servidos, 4/4 medidas, 2/2 grãos, 2/2 locais, janela 2013-2025 completa. Medido contra produção real via `psql`/PostgREST/`curl` anônimo — nunca assumido de sessões anteriores.
- **Lacuna real de Camada 1 encontrada e fechada**: 12 arquivos (`RDAC2501`..`RDAC2512`) ausentes do ledger de arquivo apesar do dado já estar em produção — investigada, não corrigida às cegas, fechada com o comando que a própria Task 1 já prescrevia (`pipeline:download --only`).
- **`audit.py` implementado via TDD** (7 comportamentos declarados, 15 testes) — `audit_coverage`, `classificar_ausencia` (a regra pura do D-14, citando a decisão), `anos_incompletos_no_ledger` (D-13). Rodado ao vivo contra produção duas vezes nesta sessão.
- **Verificação empírica null-vs-zero contra o TabNet** (ROADMAP §"Riscos conhecidos"): dois casos reais — território específico ausente dentro de tabela válida (omite a linha) e zero nacional completo (`"Nenhum registro selecionado"`, sem tabela nenhuma). Confirma a premissa, não a herda.
- **Achado investigado até a causa raiz**: 8 categorias de causa externa (acidentes de transporte, quedas, agressões, etc.) zeradas de 2016 em diante — medido no microdado real (`DIAG_PRINC` sem nenhum código V/Y, `DIAGSEC1` com 256 códigos V/Y) e confirmado contra o TabNet ao vivo (mesma resposta "Nenhum registro selecionado" pós-2015). Não é defeito do pipeline.
- **Checkpoint humano (Task 3) respondido com 3 decisões**, todas implementadas e medidas nesta sessão: cobertura aprovada; causas externas registradas com risco didático explícito para a Fase 10/UI; lacuna de Camada 2 do grão município fechada via TDD, com `file_scope` ampliado exclusivamente para isso.
- **Grão município: `sih_collection_status` fechado** — `upload.py --municipio` (função nova, não reaproveitando o caminho de grão UF já provado 2x em produção) escreveu 33.560 linhas novas (67.120 total). `audit.py` reauditado: `faltantes` do grão município caiu de 34.424 para 864 — exatamente os mesmos 108 pares agravo-ano zero-nacionais já explicados para o grão UF, não uma lacuna nova.

## Task Commits

1. **Task 1: relatório de cobertura final medido contra produção real** — `b60a022` (docs)
2. **Task 2: `audit.py` — ledger de cobertura completo e a regra do zero verdadeiro** — `f2c868d` (feat)
3. **Checkpoint Task 3, decisão 3: `upload.py --municipio` — escreve Camada 2 do grão município** — `f884a9c` (feat)
4. **Checkpoint Task 3, decisão 3 (continuação): `audit.py` classifica grão município pela fonte real** — `92c7592` (fix)
5. **Checkpoint Task 3, decisões 1+2: registra as três decisões do operador no relatório** — `a7cf4d2` (docs)

**Plan metadata:** (este commit — `docs: complete plan`)

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/audit.py` — `audit_coverage`, `CoverageReport`, `classificar_ausencia` (D-14), `cartesiano_completo`, `anos_incompletos_no_ledger` (D-13), `_fetch_all_paginated`, `_metric_keys_grao_uf`, `_metric_keys_grao_municipio`, `main(argv)` (contrato do subcomando `audit`)
- `pipeline/sih/tests/test_audit.py` — 20 testes cobrindo os 7 comportamentos declarados + a extensão de município
- `pipeline/sih/reports/cobertura-final.md` — o relatório de cobertura da fase, com antes×depois, achados investigados até a causa raiz, e as três decisões do operador
- `pipeline/sih/src/sih_pipeline/upload.py` — `_linhas_grao_municipio`, `_persistir_collection_status_municipio`, flag `--municipio`/`--municipio --dry-run` em `main()` — tudo novo e aditivo, `_persistir_collection_status`/`copy_to_staging`/`swap`/`recount_via_postgrest`/`release_cache` (o caminho de grão UF já provado 2x em produção) intocados
- `pipeline/sih/tests/test_upload.py` — 8 testes novos (grão município) + fix de isolamento de teste (`_resetar_producao` passou a truncar `sih_collection_status`)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: (1) lacuna de ledger fechada por reexecução idempotente, não recoleta; (2) lacuna de Camada 2 do grão município fechada por decisão explícita do operador, com `file_scope` ampliado só para isso e o caminho de grão UF preservado intocado; (3) causas externas zeradas por mudança de prática de codificação da fonte registradas e aceitas, não corrigidas — item de acompanhamento explícito deixado para a Fase 10/UI; (4) cobertura aprovada como está, SC-7 inalterado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 12 arquivos ausentes do ledger de arquivo (Camada 1) apesar do dado já estar em produção**
- **Found during:** Task 1, primeira verificação do `summary()` do ledger (`4200` de `4212` esperados)
- **Issue:** `RDAC2501`..`RDAC2512` (Acre, os 12 meses de 2025) estavam totalmente ausentes do ledger de arquivo (`files.json`) — nem `falhou`, nem `nunca_tentado` explícito. Investigado antes de agir: o agregado persistido (`agregados/AC.parquet`) já continha os dados de 2025 (6.866 linhas), confirmando que a coleta aconteceu de verdade; só a prova de proveniência da Camada 1 sumiu, provavelmente por uma divergência de leitura-modificação-escrita entre sessões concorrentes/sucessivas da corrida longa.
- **Fix:** `pipeline:download --only RDAC2501 .. RDAC2512` — exatamente a ação que a Task 1 do plano já prescrevia para fechar pendências, sem tocar `collect.py`/`download.py`/`ledger.py`.
- **Files modified:** nenhum arquivo do repositório (só `~/.lacir/sih-cache/ledger/files.json`, fora do controle de versão)
- **Verification:** `FileLedger.load().summary()` — `4212` `baixado`, `0` `falhou`, `0` `nunca_tentado`.
- **Committed in:** não aplicável (fora do repositório) — documentado em `cobertura-final.md` §1.

**2. [Rule 4 - decisão do operador, não auto-fix] Grão município sem escritor de Camada 2 — checkpoint humano da Task 3**
- **Found during:** Task 2, auditoria contra produção (`audit.py` mostrou 34.424 de 35.288 faltantes concentrados no grão `municipio`)
- **Issue:** `upload.py`/`partitions.py` nunca escreviam `sih_collection_status` para o grão `municipio` — mudança estrutural, corretamente escalada como checkpoint (Rule 4) em vez de corrigida sem autorização, já que o `file_scope` original desta plan não incluía `upload.py`/`partitions.py`.
- **Fix:** O operador respondeu ao checkpoint ampliando o `file_scope` exclusivamente para isto. Implementado via TDD: `_linhas_grao_municipio`/`_persistir_collection_status_municipio` (funções novas, separadas do caminho de grão UF por decisão explícita do operador) em `upload.py`, mais `_metric_keys_grao_municipio` em `audit.py` para a auditoria não classificar as novas linhas como zero verdadeiro por omissão.
- **Files modified:** `pipeline/sih/src/sih_pipeline/upload.py`, `pipeline/sih/tests/test_upload.py`, `pipeline/sih/src/sih_pipeline/audit.py`, `pipeline/sih/tests/test_audit.py`
- **Verification:** `--dry-run` mediu 12.327.573 linhas antes de escrever; escrita real gravou 33.560 linhas (idêntico ao grão UF, matematicamente esperado); `audit.py` reauditado mostrou `faltantes` do grão município caindo de 34.424 para 864; suíte completa (289 testes Python + 796 frontend) verde; `npm run gate` verde em cada commit.
- **Committed in:** `f884a9c`, `92c7592`

---

**Total deviations:** 1 auto-fixed (Rule 1, lacuna de ledger sem efeito em produção) + 1 escalada corretamente para checkpoint humano (Rule 4, o operador decidiu e o trabalho subsequente foi medido e testado). Nenhum escopo além do que os achados genuínos desta própria execução exigiam.

## Issues Encountered

- **Construção do índice territorial local (`construir_indice_territorial`) sobre ~12,3 milhões de linhas de grão município é lenta** (~60-90s de CPU, picos de memória de até ~4,9 GB) — rodada três vezes nesta sessão (dry-run, escrita real, reauditoria). Não é um defeito: é o mesmo mecanismo que `partitions.py` já usa para montar as 27 partições reais, só que agora também consumido por `upload.py --municipio`/`audit.py`. Registrado como característica de custo, não corrigido (otimizar essa leitura está fora do escopo desta plan).
- **Paginação PostgREST de `sih_collection_status` (67.120 linhas) e `sih_metric_uf` (207.664 linhas, colunas reduzidas) em `audit.py`** levou alguns minutos por execução — esperado dado o volume, coerente com os tempos já medidos pelo `09-10` para operações de escala semelhante.

## User Setup Required

Nenhum novo. `.env.pipeline`/`.env.local` (já existentes) cobriram toda a execução — nunca impressos.

## Next Phase Readiness

- **PIPE-05 fechado**: `sih_pipeline.cli audit` existe, testado e provado contra produção real duas vezes nesta sessão.
- **SC-5/DATA-01/DATA-02/DATA-03 fechados**: as 4 medidas, 331 agravos, 2 grãos, 2 locais, com `taxa_mortalidade` em todo o catálogo — `sih_collection_status` agora prova isso para os dois grãos (67.120 linhas), não só para o grão UF.
- **SC-6/DATA-04 fechados**: `derived_at`/`cid_map_version` em toda linha coletada, nos dois grãos, zero exceções.
- **A regra zero-verdadeiro×ausente (D-14) existe como função pura** (`classificar_ausencia`) e está exercitada contra os dois grãos — pronta para a Fase 10 portar ou importar sem reinterpretar.
- **Achado registrado para a Fase 10/UI, não implementado aqui** (decisão explícita do operador): a tela precisa sinalizar quando uma série zera por mudança de prática de codificação da fonte (as 8 categorias de causa externa, capítulo V01-Y98), distinto de um zero verdadeiro genuíno — a lista completa dos `disease_id` afetados está em `cobertura-final.md` §6.2.
- **`09-13`/`09-14` continuam pendentes** — nenhuma mudança de bloqueio desta plan quanto a eles.
- **Carga de `sih_population_*` (D-24) continua sem executor** — registrado desde o `09-10-SUMMARY.md`, não é escopo desta plan, não bloqueante para o fechamento da Fase 9 (população nunca foi parte do critério de "fase pronta" do `09-01`).

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-13*

## Self-Check: PASSED

Todos os 5 arquivos (`audit.py`, `test_audit.py`, `cobertura-final.md`, `upload.py`, `test_upload.py`) existem no disco; todos os 5 hashes de commit (`b60a022`, `f2c868d`, `f884a9c`, `92c7592`, `a7cf4d2`) existem em `git log --oneline --all`. `npm run gate` verde no último commit (108 arquivos de teste frontend / 796 testes; suíte Python completa, 289 testes; build).
