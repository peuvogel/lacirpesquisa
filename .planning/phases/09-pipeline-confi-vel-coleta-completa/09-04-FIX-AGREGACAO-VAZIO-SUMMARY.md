---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-FIX-AGREGACAO-VAZIO
subsystem: infra
tags: [python, pyarrow, sih, agregacao, integridade, tdd]

# Dependency graph
requires:
  - phase: 09-07-ident-fix
    provides: "IDENT='1' como único valor contado em internacoes, _cast_morte tratando MORTE string/int"
  - phase: 09-10-procedimento
    provides: "Eixo de PROC_REA (amputacao_mmii) em paralelo ao eixo CID -- investigado e descartado como causa raiz desta correção"
provides:
  - "_blank_to_null: troca só string vazia (após trim) por null explícito antes de qualquer pc.cast numérico -- nunca um coerce cego, qualquer outro valor não numérico continua estourando ArrowInvalid"
  - "_cast_morte tratando MORTE vazio (além de string/int já tratados) via _blank_to_null"
  - "Semântica documentada e testada por medida: VAL_TOT/DIAS_PERM vazio = contribuição desconhecida (soma só o conhecido, nunca zero fabricado); MORTE vazio = NUNCA óbito; ANO_CMPT vazio = mesmo caminho de 'fora da janela D-11'"
  - "Fixture real tests/fixtures/rddf_1708_vazio.parquet (DF/2017-08, 2.292 registros, 46 com todos os campos vazios) -- reproduz o crash relatado contra dado real, não sintético"
  - "Regressão hash-based (SHA-256) do eixo CID sobre rdac_2019.parquet, provando saída byte-idêntica antes/depois da correção"
affects: [09-09-adaptacao-agregados, 09-10-procedimento, collect.py, corrida-em-producao-27-ufs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transformação explícita e nomeada (_blank_to_null) para o ÚNICO caso problemático medido (string vazia), nunca um coerce genérico que esconderia qualquer outro tipo de corrupção de dado -- mesma disciplina de _cast_morte (verificar tipo/valor real, falhar alto para o que não foi medido)"
    - "Cast eager sobre coluna inteira (antes do filtro por registro) precisa ser NULL-SAFE para o caso 'ausente', não só 'padded' -- o filtro por registro (IDENT, janela de ano) só consegue excluir um registro se o cast que o precede não quebrar primeiro"
    - "Ausência não é zero, mas contribuição para uma SOMA corrente não tem representação de 'parcialmente desconhecido' -- a escolha documentada é sempre a que NUNCA infla a medida (soma só o conhecido; nunca conta óbito sem evidência)"
    - "Fixture real (não sintética) commitada para reproduzir um crash de produção -- mesma disciplina de rdac_2019.parquet, evita a armadilha (já registrada nesta fase) de testes que só provam consistência interna sem tocar dado real"

key-files:
  created:
    - pipeline/sih/tests/fixtures/rddf_1708_vazio.parquet
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-04-FIX-AGREGACAO-VAZIO-SUMMARY.md
  modified:
    - pipeline/sih/src/sih_pipeline/aggregate.py
    - pipeline/sih/tests/test_aggregate.py

key-decisions:
  - "Verificado, não assumido: a hipótese do brief (regressão do eixo de procedimento, 9f8545c) NÃO se confirmou -- rodei a versão de aggregate_parquet_dir de ANTES de 9f8545c contra o mesmo arquivo real (RDDF1708.parquet) e ela quebra idêntico. A causa é um cast eager preexistente (VAL_TOT/DIAS_PERM/ANO_CMPT/MORTE sobre a coluna inteira, antes do filtro por registro) nunca antes medido contra um arquivo real com string vazia nesses 4 campos"
  - "VAL_TOT/DIAS_PERM vazio = contribuição DESCONHECIDA, tratada como 0 na soma corrente (nunca exclui a internação, que sempre conta) -- decisão explícita: ausência não é zero, mas uma soma corrente de float/int não tem forma de representar 'parcialmente desconhecido'; a escolha subestima o total real nesses poucos registros, nunca o superestima com um zero fabricado que pareça sabido"
  - "MORTE vazio = NUNCA conta como óbito -- inventar uma morte sem nenhuma evidência no dado-fonte inflaria taxa_mortalidade sem base real, o erro mais grave possível para uma medida pública de saúde. Diferente de VAL_TOT/DIAS_PERM (onde 'desconhecido' é plausivelmente qualquer valor positivo), para MORTE a ausência de evidência de óbito é o próprio conteúdo semântico do zero -- não é uma aproximação, é a leitura mais defensável do dado disponível"
  - "_blank_to_null troca SÓ a string exatamente vazia (após trim) por null -- nunca um coerce cego. Qualquer valor não vazio e não numérico continua propagando sem alteração e estourando ArrowInvalid no cast seguinte, exatamente como antes desta correção (medido: 0 valores desse tipo em IDENT='1' de DF/RR hoje -- se aparecer no futuro, a correção não o esconde)"

patterns-established:
  - "Toda coluna com cast eager (pc.cast sobre tabela inteira, antes de qualquer filtro por registro) precisa ser auditada quanto a valores ausentes, não só padded -- o padrão do RESEARCH (Pitfall 1) cobria só espaço; string vazia é uma categoria distinta que só aparece medida contra dado real"

requirements-completed: []  # bugfix sem PLAN.md formal, suporta PIPE-06 (corrida completa das 27 UFs) mas não completa nenhum requisito por si só -- mesmo padrão de 09-04-FIX-DOWNLOAD-VAZIO

# Metrics
duration: ~2h30
completed: 2026-08-12
---

# Phase 09 Plan 04-FIX-AGREGACAO-VAZIO: Corrige crash de valor numérico vazio na agregação Summary

**`_blank_to_null` troca string vazia por `null` explícito antes de 4 casts eager (`VAL_TOT`→float64, `DIAS_PERM`/`ANO_CMPT`→int64, `MORTE` via `_cast_morte`) — corrige o crash `"Failed to parse string: '' as a scalar of type double"` medido em DF e RR na recoleta nacional, sem coerce cego e sem mudar 1 byte do eixo CID já em produção.**

## Performance

- **Duration:** ~2h30 (maior parte em investigação empírica contra dado real de 27 UFs, não em código)
- **Completed:** 2026-08-12
- **Tasks:** 1 (bugfix sem checkpoints — brief avulso sem PLAN.md formal)
- **Files modified:** 2 (`aggregate.py`, `test_aggregate.py`) + 1 fixture nova

## Accomplishments

- **Reproduzido o crash contra dado real ANTES de corrigir.** Raw parquet de DF e RR ainda estava em cache (`~/.lacir/sih-cache/parquet/`, não reciclado porque a agregação tinha falhado) — nada precisou ser baixado de novo. `RDDF1708.parquet` (competência 2017-08, 2.292 registros) reproduz `ArrowInvalid: Failed to parse string: '' as a scalar of type double` de ponta a ponta, virou fixture congelada (`tests/fixtures/rddf_1708_vazio.parquet`, 61 KB, projetada a `NEEDED_COLUMNS`).
- **A hipótese do brief (regressão do eixo de procedimento, `9f8545c`) foi verificada e DESCARTADA, não assumida.** Rodei a versão de `aggregate_parquet_dir` de ANTES de `9f8545c` (via `git show 9f8545c^:...`) contra o mesmo `RDDF1708.parquet` real — quebra idêntico, mesma mensagem. O bug é preexistente e ortogonal ao eixo de procedimento: os 4 casts eager (`VAL_TOT`, `DIAS_PERM`, `MORTE`, `ANO_CMPT`) sempre rodaram sobre a **coluna inteira**, antes de qualquer filtro por registro — nunca tinham sido medidos contra um arquivo real com string vazia (só padding de espaço, Pitfall 1 já coberto). A primeira coleta nacional completou as 27 UFs porque, por acaso, nenhum dos arquivos que ela processou continha esse padrão — não porque o código estivesse correto para o caso geral.
- **Duas classes de registro vazio, medidas contra as 27 UFs em cache, com tratamentos DIFERENTES:**
  1. **Registro corrompido do DBC** (DF/`RDDF1708.parquet`: 46 de 2.292 registros) — `IDENT`, `ANO_CMPT`, `DIAG_PRINC`, `MUNIC_RES` **e** os 4 campos numéricos vêm TODOS vazios juntos (bytes desalinhados na decodificação, mesma classe de achado do `09-04-FIX-DOWNLOAD-VAZIO`, mas na conversão, não no download). Como `IDENT` também vem vazio (`≠ '1'`), esses registros já eram excluídos pelo filtro de `IDENT` existente — o problema nunca foi a classificação deles, foi o cast eager travar ANTES do laço conseguir filtrá-los.
  2. **AIH real com campo de faturamento/óbito não preenchido** (RR: 2 registros `VAL_TOT` vazio, 5 `DIAS_PERM`/`MORTE` vazio; DF: 2 `DIAS_PERM`/`MORTE` vazio — sempre o par junto) — `IDENT='1'`, `ANO_CMPT` dentro da janela D-11: é uma internação genuína, só o campo billing específico não foi preenchido nesta competência.
- **Auditoria exaustiva contra as 27 UFs em cache confirmou que "vazio" é o ÚNICO valor problemático** nos 4 campos para registros `IDENT='1'` — 0 valores não vazios e não numéricos encontrados. Isso justifica a correção cirúrgica (`_blank_to_null` troca só o exatamente-vazio) em vez de um `errors='coerce'` genérico, que teria escondido qualquer corrupção real futura.
- **Risco lateral identificado e DELIBERADAMENTE não corrigido (fora do escopo de arquivo desta correção):** alguns registros de DF/RR com `IDENT='1'` têm `MUNIC_MOV` vazio ou de tamanho inválido, o que faria `codigos.municipio6()` levantar `ValueError` se esse registro casasse alguma categoria (CID ou procedimento). Medido exaustivamente contra DF e RR inteiros: **0 registros** com essa combinação (município inválido + match em algum eixo) — todos os registros com `MUNIC_MOV` inválido também têm `DIAG_PRINC` vazio (nunca casa CID) e `PROC_REA` fora do conjunto de amputação (nunca casa procedimento), então nunca chegam à chamada de `municipio6()`. Documentado aqui para visibilidade; `codigos.py` está fora do `file_scope` desta correção e o risco não se manifesta no dado real disponível hoje.
- **Achado lateral, não perseguido:** `RDRR2501.parquet` no cache é um parquet vazio (0 linhas, 0 colunas, 64 bytes) — ler esse arquivo ISOLADO levanta um erro diferente (`No match for FieldRef`), mas a agregação real (que lê o DIRETÓRIO inteiro da UF via `pyarrow.dataset`, unificando schema entre fragmentos) não é afetada, confirmado pela agregação completa de RR (36.961 linhas) ter funcionado. Fora do escopo de arquivo desta correção (`collect.py`/`ledger.py`/`download.py`), não perseguido mais a fundo.

## Task Commits

Tarefa única (RED planejado + GREEN, commitados atomicamente por exigência do hook de pre-commit deste repo — `npm run gate` roda no commit e bloqueia um estado RED isolado; mesmo padrão do `09-04-FIX-DOWNLOAD-VAZIO`):

1. **Corrige cast eager vazio + 6 testes novos (1 real, 5 sintéticos) + regressão hash do eixo CID** — `2516c45` (fix) — `aggregate.py` (`_blank_to_null`, `_cast_morte` atualizado, semântica por medida no laço principal, docstring do módulo) e `test_aggregate.py` (6 testes novos, fixture real `rddf_1708_vazio.parquet`) no mesmo commit.

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/aggregate.py` — nova função `_blank_to_null` (troca string vazia por `null` antes de `pc.cast`, nunca um coerce cego); `_cast_morte` atualizado para tratar `MORTE` vazio; os 4 casts eager (`VAL_TOT`, `DIAS_PERM`, `MORTE`, `ANO_CMPT`) passam por `_blank_to_null`; laço principal documenta e aplica a semântica por medida (`internacoes` sempre conta, `valor_total`/`dias_permanencia` somam só a contribuição conhecida, `MORTE` vazio nunca vira óbito); docstring do módulo ganha seção "Correção de valor numérico vazio" com a investigação completa
- `pipeline/sih/tests/test_aggregate.py` — 6 testes novos: `test_val_tot_vazio_real_df_nao_quebra_a_agregacao_da_uf` (real, fixture nova), `test_val_tot_vazio_conta_internacao_mas_nao_soma_valor_desconhecido`, `test_dias_perm_vazio_conta_internacao_mas_nao_soma_dias_desconhecidos`, `test_morte_vazio_conta_internacao_mas_nao_conta_como_obito`, `test_ano_cmpt_vazio_e_excluido_sem_quebrar`, `test_valor_nao_vazio_e_nao_numerico_continua_estourando` (sintéticos), mais `test_cid_output_identico_byte_a_byte_apos_correcao_de_vazio` (hash SHA-256 da saída completa sobre `rdac_2019.parquet`)
- `pipeline/sih/tests/fixtures/rddf_1708_vazio.parquet` (novo) — DF/2017-08 real, projetado a `NEEDED_COLUMNS`, 2.292 registros, 61 KB

## Decisions Made

Ver `key-decisions` no frontmatter (4 decisões, todas medidas contra dado real). Resumo:

- **Regressão do eixo de procedimento descartada por medição direta** — o código pré-`9f8545c` quebra idêntico contra o mesmo arquivo real.
- **`VAL_TOT`/`DIAS_PERM` vazio → contribuição desconhecida (soma só o conhecido, nunca 0 fabricado que pareça sabido)** — internação sempre conta, a soma subestima nesses poucos registros, nunca superestima.
- **`MORTE` vazio → NUNCA óbito** — ausência de evidência de morte é a leitura mais defensável, não uma aproximação arriscada.
- **`_blank_to_null` é cirúrgico, não um coerce genérico** — só o exatamente-vazio vira `null`; qualquer outra corrupção real continua estourando alto.

## Deviations from Plan

Não há PLAN.md formal (brief explícito do usuário substitui a plan). Uma adição além do que o brief pediu explicitamente, classificada como **Rule 1 (correção de bug) auto-aplicada durante a investigação**:

**1. [Rule 1 - Bug] `ANO_CMPT` também precisava de `_blank_to_null`, não só `VAL_TOT`**
- **Encontrado durante:** escrita do teste `test_ano_cmpt_vazio_e_excluido_sem_quebrar` (TDD RED)
- **Issue:** o brief citou especificamente o crash de `VAL_TOT` (a mensagem relatada, "as a scalar of type **double**"). Ao investigar os registros corrompidos de DF (classe 1, `IDENT` vazio), medi que `ANO_CMPT` também vem vazio nesses mesmos registros — corrigir só `VAL_TOT` teria deixado o crash reaparecer no cast seguinte de `ANO_CMPT` (`int64`), só com uma mensagem diferente ("as a scalar of type **int64**"), assim que `VAL_TOT` parasse de ser o primeiro a quebrar.
- **Fix:** `_blank_to_null` aplicado uniformemente aos 4 campos (`VAL_TOT`, `DIAS_PERM`, `MORTE` via `_cast_morte`, `ANO_CMPT`), não só ao campo citado no brief.
- **Arquivos modificados:** `pipeline/sih/src/sih_pipeline/aggregate.py`
- **Verificação:** `test_ano_cmpt_vazio_e_excluido_sem_quebrar` prova que o registro cai no mesmo caminho de "fora da janela D-11" já existente; agregação completa de DF/RR contra o cache raw inteiro confirma 0 crashes restantes.
- **Committed in:** `2516c45` (parte do commit único desta correção)

---

**Total deviations:** 1 auto-aplicado (Rule 1)
**Impact on plan:** Necessário para que a correção resolvesse o crash de ponta a ponta (não só a primeira manifestação relatada) — sem scope creep, mesma causa raiz.

## Issues Encountered

- **A hipótese do brief sobre a causa raiz (regressão do eixo de procedimento) não se confirmou.** Reporto isso com transparência total, como pedido explicitamente ("verificar, não assumir"): o brief tinha razão em que o crash é real e em que a mensagem exata era `"Failed to parse string: '' as a scalar of type double"`, mas errou sobre QUANDO o bug foi introduzido. Isso não muda a correção necessária (que ataca o cast eager, não o eixo de procedimento), mas evita a armadilha de "corrigir" algo no código de `9f8545c` que não era a causa.
- **Risco lateral em `codigos.municipio6()` identificado mas não corrigido** — ver "Accomplishments" acima. Medido exaustivamente que não se manifesta no dado real disponível hoje (0 registros afetados em DF/RR), mas é um ponto de fragilidade estrutural (mesma classe de bug desta correção: cast/parse que assume formato válido sem checar): se uma futura UF tiver um registro com `IDENT='1'`, `DIAG_PRINC` ou `PROC_REA` casável, E `MUNIC_MOV`/`MUNIC_RES` vazio ou malformado, a agregação dessa UF quebraria com `ValueError: municipio6: tipo não suportado` ou comprimento inválido. Fora do `file_scope` desta correção (`codigos.py` não está na lista de arquivos possuídos); reportado para que uma correção futura, se necessária, saiba exatamente onde procurar.
- **`RDRR2501.parquet` vazio (0 linhas/colunas) no cache** — não afeta a agregação real (que lê o diretório inteiro da UF, não o arquivo isolado), mas levanta um erro diferente se lido isoladamente. Fora do `file_scope` (`collect.py`/`download.py`/`ledger.py`), não investigado a fundo — mencionado para não ser confundido com o crash desta correção caso reapareça em log futuro.

## User Setup Required

None — correção interna, sem configuração externa nova.

## Next Phase Readiness

- **A correção está pronta para o operador reiniciar a coleta nacional** (que o usuário explicitamente pausou antes desta correção e não pediu para reiniciar). DF e RR devem completar a agregação na próxima corrida — confirmado por medição direta: `aggregate_years` contra o cache raw INTEIRO de DF (145.051 linhas) e RR (36.961 linhas) completa sem levantar, o mesmo caminho que produzia o crash registrado em `collect_state.json`.
- **O gate SC-7 permanece byte-idêntico** (`exato=34, explicado=61, inexplicado=3`, `test_reconcile_gate.py`, 5/5 verde) — a composição já aprovada pelo operador não foi recomputada nem tocada.
- **O eixo CID em produção (`sih_metric_uf`, 207.131 linhas / 330 agravos) não é afetado** — prova por hash SHA-256 sobre `rdac_2019.parquet` (a fixture que não tem nenhum campo vazio nos 4 campos afetados) trava byte a byte que a saída do caminho CID é idêntica antes e depois desta correção.
- **`npm run gate` verde** (108 arquivos de teste, 796 testes, build OK) confirmado duas vezes: uma vez antes do commit (verificação manual) e uma vez pelo hook de pre-commit do próprio `git commit`.
- **Risco lateral não corrigido, registrado para acompanhamento** (ver "Issues Encountered"): fragilidade estrutural em `codigos.municipio6()` para `MUNIC_MOV`/`MUNIC_RES` vazio/malformado combinado com match em algum eixo. Não se manifesta hoje; merece atenção se uma UF futura reproduzir esse padrão específico.
- Nenhum bloqueio novo introduzido. O usuário deve reiniciar a coleta manualmente quando decidir.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: pipeline/sih/src/sih_pipeline/aggregate.py
- FOUND: pipeline/sih/tests/test_aggregate.py
- FOUND: pipeline/sih/tests/fixtures/rddf_1708_vazio.parquet
- FOUND: commit 2516c45 (fix(09-04-fix-agregacao-vazio): GREEN -- trata VAL_TOT/DIAS_PERM/MORTE/ANO_CMPT vazio sem coerce cego)
