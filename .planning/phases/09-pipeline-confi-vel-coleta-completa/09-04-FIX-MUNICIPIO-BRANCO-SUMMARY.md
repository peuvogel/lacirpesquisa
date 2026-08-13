---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-FIX-MUNICIPIO-BRANCO
subsystem: infra
tags: [python, pyarrow, sih, agregacao, integridade, tdd, municipio, uf_zi]

# Dependency graph
requires:
  - phase: 09-04-fix-agregacao-vazio
    provides: "_blank_to_null, semantica de valor vazio por medida, e o risco lateral de codigos.municipio6() ja previsto (e deliberadamente nao corrigido) no SUMMARY dessa plan"
  - phase: 09-07
    provides: "codigos.py (municipio6/uf_de_municipio/UF_POR_CODIGO) e aggregate.py (aggregate_parquet_dir, NEEDED_COLUMNS) como contrato existente"
provides:
  - "codigos.municipio6() endurecida para rejeitar tambem codigo de comprimento certo mas nao numerico (nao so string vazia)"
  - "codigos.municipio6_ou_none(): unico ponto do pipeline que trata municipio ilegivel como dado esperado (devolve None), nunca levanta -- municipio6() continua levantando para population.py"
  - "aggregate._territorio_ocorrencia/_territorio_residencia: semantica por grao (municipio nunca recuperavel; UF de ocorrencia resgatavel via UF_ZI; UF de residencia sem fallback)"
  - "aggregate._MAX_TAXA_DESCARTE_MUNICIPIO (0,01%): guarda de taxa de descarte de municipio, mesma disciplina de _MAX_TAXA_DESCARTE/T-09-30 -- nunca um catch-and-ignore silencioso"
  - "UF_ZI como coluna OPCIONAL (checagem de schema, nunca um segundo dataset.to_table) -- nao quebra parquet sintetico minimo de outros modulos (partitions.py, fora do file_scope)"
  - "Fixture real tests/fixtures/rdpr_2004_municipio_vazio.parquet (PR/2020-04 completo, 25.493 registros) -- reproduz o crash de producao contra dado real"
affects: [09-09-adaptacao-agregados, collect.py, corrida-em-producao-27-ufs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Funcao 'segura' aditiva (municipio6_ou_none) ao lado da funcao original que levanta (municipio6) -- nunca muda o contrato de uma funcao compartilhada usada por consumidores fora do file_scope (population.py); o novo comportamento e opt-in, nao substitui o antigo"
    - "Fallback de campo (UF_ZI) restrito ao grao onde a medicao prova cobertura -- nunca generalizado ao grao irmao (residencia) so por simetria de codigo, quando a medicao mostra que nao existe campo equivalente para esse grao"
    - "Coluna de fallback tratada como OPCIONAL via checagem de schema (nunca um NEEDED_COLUMNS rigido) quando exigi-la sem excecao quebraria consumidores fora do file_scope que nao precisam dela"
    - "Guarda de taxa de descarte calibrada pela ESCALA REAL de invocacao em producao (aggregate_parquet_dir roda por UF inteira, nunca por arquivo isolado) -- testes sinteticos de comportamento por registro precisam do mesmo volume de fundo (padding), nao 1 linha isolada, para nao disparar o proprio gate que estao testando"

key-files:
  created:
    - pipeline/sih/tests/fixtures/rdpr_2004_municipio_vazio.parquet
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-04-FIX-MUNICIPIO-BRANCO-SUMMARY.md
  modified:
    - pipeline/sih/src/sih_pipeline/codigos.py
    - pipeline/sih/src/sih_pipeline/aggregate.py
    - pipeline/sih/tests/test_codigos.py
    - pipeline/sih/tests/test_aggregate.py
    - pipeline/sih/tests/fixtures/rdac_2019.parquet
    - pipeline/sih/tests/fixtures/rddf_1708_vazio.parquet

key-decisions:
  - "Grao MUNICIPIO nunca e recuperavel quando MUNIC_MOV/MUNIC_RES vem em branco/malformado -- nao ha como inferir qual dos milhares de municipios seria o certo. Excluir o registro desse grao/local e a unica opcao honesta (nunca uma UF media, nunca um municipio-sede da UF, nunca qualquer heuristica inventada)"
  - "Grao UF de OCORRENCIA (MUNIC_MOV) PODE ser recuperado via UF_ZI -- campo oficial e ESTAVEL do SIH-RD para a UF do estabelecimento hospitalar, medido identico a MUNIC_MOV[:2] em toda amostra valida e presente/valido nos 8 registros reais afetados. Descartar tambem do grao UF quando a UF E conhecivel subcontaria silenciosamente"
  - "Grao UF de RESIDENCIA (MUNIC_RES) NAO tem fallback -- o SIH-RD nao publica campo equivalente a UF_ZI para a UF de residencia do paciente (UF_ZI e documentadamente a UF do ESTABELECIMENTO, nao do paciente); usa-lo juntaria endereco do hospital com residencia do paciente, erro pior que o descarte"
  - "Limiar de descarte de municipio (0,01%) calibrado pela medicao nacional real (8/82.091.610 = 0,00001% na populacao que alcanca o ponto do laco), nao por conveniencia -- ~1000x de margem sobre o baseline medido, mas 10x mais apertado que _MAX_TAXA_DESCARTE (0,1%) porque municipio em branco e uma classe de defeito ~10.000x mais rara que DIAG_PRINC sem categoria"
  - "codigos.municipio6() endurecida para tambem rejeitar codigo NAO NUMERICO do comprimento certo -- bug latente descoberto durante a medicao (a funcao so checava comprimento, nunca digito; '01510.'/'     8' passavam sem levantar e corrompiam silenciosamente sih_metric_muni.municipio_codigo). Mudanca aditiva e retrocompativel: nenhum teste/consumidor existente dependia do comportamento antigo de aceitar lixo do comprimento certo"
  - "UF_ZI tratada como coluna OPCIONAL (checagem de dataset.schema.names, nunca adicionada a NEEDED_COLUMNS) -- exigi-la sem excecao quebraria test_partitions.py::test_main_todas_mistura_agregado_bruto_e_uf_nao_coletada (partitions.py e seus testes estao fora do file_scope desta correcao), que constroi um parquet sintetico minimo sem essa coluna. Parquet real do SIH-RD sempre a tem (medido em toda UF do cache); o fallback so deixa de funcionar contra fontes sinteticas que nao a projetam, sem quebrar ninguem"

patterns-established:
  - "Ao adicionar uma coluna de fallback a uma funcao de agregacao compartilhada, medir o blast radius contra TODOS os consumidores do modulo (nao so o proprio file_scope) antes de torna-la hard-required -- um NEEDED_COLUMNS mais rigido quebra silenciosamente qualquer parquet sintetico minimo que outro modulo (fora do escopo da correcao) construa sem essa coluna"
  - "Testes de comportamento por registro sobre uma funcao com guarda de taxa (taxa de descarte, taxa de erro) precisam do MESMO volume de fundo que a funcao ve em producao -- 1 registro problematico isolado numa tabela de 1 linha mede 100% de descarte e estoura o proprio gate que o teste pretende exercitar"

requirements-completed: []  # bugfix sem PLAN.md formal, suporta PIPE-06 (corrida completa das 27 UFs) mas nao completa nenhum requisito por si so -- mesmo padrao de 09-04-FIX-AGREGACAO-VAZIO/09-04-FIX-DOWNLOAD-VAZIO

# Metrics
duration: ~2h
completed: 2026-08-12
---

# Phase 09 Plan 04-FIX-MUNICIPIO-BRANCO: Corrige crash de município em branco/malformado na agregação Summary

**`municipio6_ou_none()` (codigos.py) + `_territorio_ocorrencia`/`_territorio_residencia` (aggregate.py) tratam `MUNIC_MOV`/`MUNIC_RES` em branco ou malformado como descarte contado e taxa-guardado (nunca `ValueError` que derruba a UF inteira) — grão UF de ocorrência resgatado via `UF_ZI` quando possível, grão UF de residência sem fallback (campo inexistente no SIH-RD), medido nacionalmente contra 82 milhões de registros reais antes de calibrar o limiar.**

## Performance

- **Duration:** ~2h (maior parte em medição empírica contra as 27 UFs em cache, replicando o laço real de `aggregate_parquet_dir` com o matcher CID de verdade — não uma amostra sintética)
- **Completed:** 2026-08-12
- **Tasks:** 1 (bugfix sem checkpoints — brief avulso sem PLAN.md formal)
- **Files modified:** 6 (`codigos.py`, `aggregate.py`, `test_codigos.py`, `test_aggregate.py`, 2 fixtures regeneradas) + 1 fixture nova

## Accomplishments

- **Medido, não suposto, antes de escolher qualquer limiar.** Duas medições distintas contra as 27 UFs em cache (`~/.lacir/sih-cache/parquet/`, ~86 milhões de registros brutos):
  1. **Raw scan** (sem filtro de `IDENT`/ano/match): `MUNIC_MOV`/`MUNIC_RES` ruim aparece em 0,003%–0,4% por UF, mas **heterogêneo** — clusters de até ~90% de um único arquivo/mês (`RDMT1608.parquet` 89,2%, `RDMA1806.parquet` 52,9%, `RDGO1902.parquet` 50,7%). Inspecionado ao vivo: nesses clusters, `IDENT`/`DIAG_PRINC`/`CNES` vêm TODOS corrompidos junto — a mesma classe "registro corrompido do DBC" já documentada em `09-04-FIX-AGREGACAO-VAZIO`, já excluída pelo filtro de `IDENT` antes de alcançar `municipio6()`.
  2. **População que de fato alcança o ponto do laço onde `municipio6()` é chamado** (`IDENT='1'`, ano válido, alguma doença casada — a mesma população que `_MAX_TAXA_DESCARTE` usa): dos 82.091.610 registros medidos em 11 UFs, só **8** têm `MUNIC_MOV`/`MUNIC_RES` ruim (0,00001%) — dado real esparso, espalhado em 7 arquivos de 6 UFs diferentes, nunca corrupção sistemática.
- **Inspecionados os 8 registros reais um a um.** Em TODOS: `MUNIC_RES` válido, `UF_ZI` válido, só `MUNIC_MOV` problemático (branco em 6, malformado com comprimento certo mas não numérico em 2 — `'01510.'`, `'     8'`/`'51059.'`, medido em CE/GO/MA/MT/PE/PR). Confirmado também que `UF_ZI[:2] == MUNIC_MOV[:2]` em 100% de uma amostra de registros válidos — justificando `UF_ZI` como fallback confiável, não uma suposição.
- **Semântica decidida por grão, com justificativa escrita, exatamente como o brief pediu:** grão MUNICÍPIO nunca recuperável (nenhum campo alternativo identifica QUAL município); grão UF de OCORRÊNCIA recuperável via `UF_ZI` (campo oficial do SIH-RD para a UF do estabelecimento); grão UF de RESIDÊNCIA sem fallback (SIH-RD não publica campo equivalente para a UF do paciente — usar `UF_ZI` ali confundiria hospital com residência).
- **Bug latente descoberto durante a medição, fora do que o brief pedia explicitamente (Rule 1 — auto-fix):** `codigos.municipio6()` só validava COMPRIMENTO, nunca dígito — um código como `'01510.'` (6 caracteres, mas com ponto) passava pela validação sem levantar e era devolvido como código de município "válido", corrompendo silenciosamente `sih_metric_muni.municipio_codigo`. Endurecida para também rejeitar não numérico.
- **Guarda de taxa de descarte de município (`_MAX_TAXA_DESCARTE_MUNICIPIO`, 0,01%)** — mesma disciplina de `_MAX_TAXA_DESCARTE`/T-09-30: conta e falha alto, nunca um `try/except: continue`. Calibrado pela medição real (8/82.091.610), com ~1000x de margem, mas 10x mais apertado que o limiar de `DIAG_PRINC` porque município em branco é ~10.000x mais raro.
- **`UF_ZI` tratada como coluna OPCIONAL, não `NEEDED_COLUMNS` rígido** — descoberto durante a implementação que torná-la obrigatória quebrava `test_partitions.py` (fora do `file_scope` desta correção, que constrói um parquet sintético mínimo sem essa coluna). Resolvido com checagem de `dataset.schema.names` na mesma projeção (nunca um segundo `to_table`, preservando "agregação numa passada só").

## Task Commits

Tarefa única (RED planejado + GREEN, commitados atomicamente por exigência do hook de pre-commit deste repo — `npm run gate` roda no commit e bloqueia um estado RED isolado; mesmo padrão do `09-04-FIX-AGREGACAO-VAZIO`):

1. **Endurece `codigos.municipio6`, adiciona `municipio6_ou_none`, semântica por grão em `aggregate.py`, guarda de taxa, 2 fixtures regeneradas + 1 nova, 20 testes novos** — `ca78300` (fix) — `codigos.py`, `aggregate.py`, `test_codigos.py`, `test_aggregate.py`, `tests/fixtures/rdac_2019.parquet`, `tests/fixtures/rddf_1708_vazio.parquet` (ambas regeneradas com coluna `UF_ZI`), `tests/fixtures/rdpr_2004_municipio_vazio.parquet` (nova, real, arquivo PR/2020-04 completo).

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/codigos.py` — `municipio6()` endurecida (rejeita também código não numérico do comprimento certo); nova função `municipio6_ou_none()` (devolve `None` em vez de levantar, único ponto do pipeline que trata "não localizável" como dado esperado)
- `pipeline/sih/src/sih_pipeline/aggregate.py` — novas funções `_uf_de_uf_zi`, `_territorio_ocorrencia`, `_territorio_residencia`; `NEEDED_COLUMNS` inalterado (UF_ZI opcional via checagem de schema, `_COLUNA_UF_ZI`); novo `_MAX_TAXA_DESCARTE_MUNICIPIO` (0,01%); laço principal substitui as chamadas diretas a `municipio6()` pelas novas funções de território, contando descarte por grão/local e pulando território `None` na geração de linhas; docstring do módulo ganha seção "Correção de município em branco" com a medição completa
- `pipeline/sih/tests/test_codigos.py` — 4 testes novos: rejeição de código não numérico do comprimento certo, `municipio6_ou_none` para branco/malformado/None, regressão do caminho feliz
- `pipeline/sih/tests/test_aggregate.py` — 8 testes novos: mov vazio (grão UF resgatado via UF_ZI), mov malformado, res vazio (sem fallback, ambos os graus somem), UF_ZI também inválido, UF_ZI nunca sobrepõe MUNIC_MOV válido, guarda acima/abaixo do limiar, teste sobre a fixture real de PR; todos os 7 `pa.table(...)` sintéticos pré-existentes ganharam coluna `UF_ZI`
- `pipeline/sih/tests/fixtures/rdac_2019.parquet` e `rddf_1708_vazio.parquet` — regeneradas com coluna `UF_ZI` adicional (nenhuma outra mudança; hash SHA-256 do eixo CID sobre `rdac_2019.parquet` continua idêntico — nenhum registro dessa fixture tem `MUNIC_MOV` inválido, então o fallback nunca dispara)
- `pipeline/sih/tests/fixtures/rdpr_2004_municipio_vazio.parquet` (novo) — PR/2020-04 real e COMPLETO (25.493 registros, 288 KB), projetado a `NEEDED_COLUMNS`+`UF_ZI`, contém o único registro real que quebrou a recoleta nacional em PR

## Decisions Made

Ver `key-decisions` no frontmatter (6 decisões, todas medidas contra dado real). Resumo:

- **Grão MUNICÍPIO nunca recuperável** quando o próprio campo vem inválido — exclusão é a única opção honesta.
- **Grão UF de OCORRÊNCIA resgatável via `UF_ZI`** (campo oficial e estável do SIH-RD, validado 100% consistente com `MUNIC_MOV` em amostra real) — descartar também esse grão quando a UF é conhecível subcontaria silenciosamente.
- **Grão UF de RESIDÊNCIA sem fallback** — não existe campo equivalente a `UF_ZI` para a UF do paciente no SIH-RD; usar `UF_ZI` ali seria um erro de atribuição, não uma correção.
- **Limiar de 0,01% calibrado pela medição nacional real**, não por conveniência — 1000x de margem sobre o baseline medido (8/82.091.610), mas 10x mais apertado que o limiar de `DIAG_PRINC` porque a raridade real medida é ~10.000x menor.
- **`municipio6()` endurecida (Rule 1)** para também rejeitar código não numérico do comprimento certo — bug latente que corrompia dado silenciosamente, descoberto durante a medição, não pedido explicitamente pelo brief.
- **`UF_ZI` opcional, não hard-required** — evita quebrar `test_partitions.py` (fora do `file_scope`), sem perder nenhuma cobertura contra dado real (que sempre tem essa coluna).

## Deviations from Plan

Não há PLAN.md formal (brief explícito do usuário substitui a plan). Duas adições além do que o brief pediu explicitamente:

**1. [Rule 1 - Bug] `codigos.municipio6()` também precisava rejeitar código não numérico do comprimento certo, não só string vazia**
- **Found during:** Medição contra dado real de PR (os 2 registros malformados-mas-do-comprimento-certo: `'01510.'`, `'     8'`/`'51059.'`)
- **Issue:** O brief citou o erro reportado especificamente ("comprimento inválido... `''`"), mas a mensagem de erro da própria função já sugeria que existia uma segunda classe ("esperado 6 ou 7 dígitos" implica que a função deveria checar dígitos, mas ela só checava `len()`). Medido ao vivo: `municipio6('01510.')` NÃO levantava antes desta correção — devolvia `'01510.'` como se fosse um código de município válido, corrompendo silenciosamente qualquer consumidor a jusante.
- **Fix:** Adicionado `if not texto.isdigit(): raise ValueError(...)` após a checagem de comprimento existente — mudança aditiva, backward-compatible (nenhum teste/consumidor dependia do comportamento antigo).
- **Files modified:** `pipeline/sih/src/sih_pipeline/codigos.py`
- **Verification:** `test_municipio6_rejeita_codigo_nao_numerico_do_mesmo_comprimento`, `test_municipio6_ou_none_devolve_none_para_branco_e_malformado_sem_levantar`.
- **Committed in:** `ca78300` (parte do commit único desta correção)

**2. [Rule 3 - Blocking] `UF_ZI` precisou virar coluna opcional (checagem de schema), não `NEEDED_COLUMNS` rígido**
- **Found during:** Rodada completa do gate (`npm run gate`) após a implementação inicial (que adicionava `UF_ZI` a `NEEDED_COLUMNS` incondicionalmente)
- **Issue:** `test_partitions.py::test_main_todas_mistura_agregado_bruto_e_uf_nao_coletada` (fora do `file_scope` desta correção — `partitions.py` está na lista de arquivos proibidos) constrói um parquet sintético mínimo sem coluna `UF_ZI`. `dataset.to_table(columns=NEEDED_COLUMNS)` levantava `ArrowInvalid: No match for FieldRef.Name(UF_ZI)` contra essa fonte, quebrando um teste que eu não tenho permissão de editar.
- **Fix:** `UF_ZI` removida de `NEEDED_COLUMNS`; lida via checagem de `dataset.schema.names` na MESMA chamada de `to_table` (projeção condicional, nunca um segundo scan) — quando ausente, o array de `UF_ZI` vira `None` para todo registro, e o fallback simplesmente nunca resgata nada (comportamento correto e coberto pela guarda de taxa).
- **Files modified:** `pipeline/sih/src/sih_pipeline/aggregate.py`
- **Verification:** `uv run pytest` completo (108 arquivos de teste, todos verdes, incluindo `test_partitions.py` intocado); `npm run gate` verde.
- **Committed in:** `ca78300` (parte do commit único desta correção)

---

**Total deviations:** 2 auto-aplicados (1 bug, 1 bloqueio)
**Impact on plan:** Ambos necessários para que a correção resolvesse o problema por completo (não deixasse uma segunda classe de crash latente) e não quebrasse consumidores fora do escopo declarado. Sem scope creep — nenhuma mudança de comportamento em `partitions.py` ou qualquer arquivo fora do `file_scope`.

## Issues Encountered

- **Testes sintéticos de 1 linha dispararam o próprio gate que testavam.** Ao escrever os primeiros testes de comportamento por registro (mov vazio, res vazio etc.) com tabelas de 1 linha, cada um mediu 100% de descarte de município — muito acima de `_MAX_TAXA_DESCARTE_MUNICIPIO` (0,01%), calibrado pela escala REAL de produção (uma UF inteira, milhões de registros, medido que `aggregate_parquet_dir` é sempre chamada por UF completa via `collect.py::_aggregate_uf`, nunca por arquivo isolado). Resolvido preenchendo cada teste com N=20.000 registros "bons" de fundo (o registro problemático "afogado" no volume realista) — não ajustando o limiar para acomodar um teste mal calibrado. A fixture real (`rdpr_2004_municipio_vazio.parquet`) teve o mesmo ajuste: trocada de uma janela de 500 linhas para o arquivo completo (25.493 registros), levando a taxa medida de 0,2% (acima do limiar) para 0,00392% (dentro da margem).
- **Nenhum bloqueio da coleta em produção.** O processo de coleta nacional (`sih_pipeline.cli collect`) permaneceu rodando durante toda a correção, verificado vivo antes e depois de cada mudança relevante — `~/.lacir/sih-cache/` foi tratado como somente-leitura, nenhum download ou escrita nesse diretório.

## User Setup Required

None — correção interna, sem configuração externa nova.

## Next Phase Readiness

- **A correção está pronta para a próxima corrida da coleta nacional cobrir PR** (que falhou com o crash relatado) — confirmado por medição direta: `aggregate_parquet_dir` contra o arquivo real completo de PR/2020-04 (`RDPR2004.parquet`, 25.493 registros, o mesmo que causou o crash em produção) completa sem levantar, com a semântica por grão aplicada e verificada (279 registros da categoria "outras gravidezes que terminam em aborto" medidos, 278 no grão município de ocorrência, 279 no grão UF de ocorrência via resgate `UF_ZI`, 279 nos dois graus de residência).
- **BA/CE/ES/GO/MA/MT/PA/PE/RJ/RS permanecem `falhou`** por causas distintas (a maioria já coberta por `62bd0fc`, corrupção numérica detectada no download; BA/RS têm arquivos pendentes, fora do escopo de `collect.py`) — não investigadas nem corrigidas por esta plan, que tratou exclusivamente da classe "município em branco/malformado".
- **O gate SC-7 permanece byte-idêntico** (`test_reconcile_gate.py`, 5/5 verde, verificado diretamente). **O eixo CID sobre `rdac_2019.parquet` permanece byte-idêntico** (hash SHA-256 inalterado, `test_cid_output_identico_byte_a_byte_apos_correcao_de_vazio` verde) — nenhum registro dessa fixture tem `MUNIC_MOV`/`MUNIC_RES` inválido, então o fallback nunca dispara sobre ela.
- **`npm run gate` verde** (108 arquivos de teste Python, 796 testes Vitest, `catalog:validate` OK, build OK) confirmado duas vezes: uma vez antes do commit (verificação manual) e uma vez pelo hook de pre-commit do próprio `git commit`.
- **Processo de coleta nacional confirmado vivo** ao final da correção (`ps aux`, PID 96829) — nenhuma interferência, `~/.lacir/sih-cache/` nunca escrito por esta correção.
- Nenhum bloqueio novo introduzido. O usuário deve reiniciar/retomar a coleta manualmente quando decidir.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: pipeline/sih/src/sih_pipeline/codigos.py
- FOUND: pipeline/sih/src/sih_pipeline/aggregate.py
- FOUND: pipeline/sih/tests/test_codigos.py
- FOUND: pipeline/sih/tests/test_aggregate.py
- FOUND: pipeline/sih/tests/fixtures/rdpr_2004_municipio_vazio.parquet
- FOUND: pipeline/sih/tests/fixtures/rdac_2019.parquet
- FOUND: pipeline/sih/tests/fixtures/rddf_1708_vazio.parquet
- FOUND: commit ca78300 (fix(09-04-fix-municipio-branco): municipio6 em branco/malformado nao derruba mais a UF inteira)
