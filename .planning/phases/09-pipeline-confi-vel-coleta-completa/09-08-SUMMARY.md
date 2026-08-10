---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 08
subsystem: infra
tags: [python, reconciliation, cid-10, data-quality, tabnet, sc-7]

# Dependency graph
requires:
  - phase: 09-05
    provides: "oracle_tabnet.json — 98 pares AC/2019 re-raspados ao vivo do TabNet, todos reproduzindo o CSV guardado (D-04)"
  - phase: 09-07
    provides: "matcher.py/corrections.py/aggregate.py + fixture rdac_2019.parquet (44.589 registros AC/2019) — a entrada exata que a reconciliação precisa"
provides:
  - "reconcile.py: compare()/ReconciliationResult/load_oracle/load_divergencias/main() — comparador fail-closed exato/explicado/inexplicado, sem banda de aceitação percentual (D-02), filtra grao=uf e local=ocorrencia (D-10)"
  - "scripts/catalog/cid-corrections.json preenchido: 4 correções de faixa CID com razão escrita, cada uma motivada por medição real contra AC/2019 — resolve as duas colisões estruturais nomeadas pelo 09-RESEARCH (75/76->B92, 142/274->G02) mais um achado extra (14, tuberculose miliar)"
  - "scripts/catalog/cid-divergencias.json: 9 entradas de divergência residual por categoria, diseaseId canônico, razão >=30 caracteres, sem duplicata"
  - "pipeline/sih/reports/reconciliacao-sc7.md: registro completo da depuração — estado inicial, hipóteses testadas e descartadas, correções aplicadas, limitações conhecidas, estado final"
affects: [09-11, 09-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reconcile.compare(): disciplina foldInvariant de validate.mjs — acumula TODOS os pares antes de decidir, nunca retorna no primeiro inexplicado; classificação em exato/explicado/inexplicado, nunca uma banda de aceitação percentual (D-02)"
    - "Ausência total no agregado (par do oráculo sem chave correspondente) nunca é resgatada por uma entrada de divergência — só delta não-zero é. Decisão deliberada da Task 1, exercida na prática pelos casos 14/274 (ver Deviations)"
    - "Correção de faixa CID em cadeia: quando resolver uma colisão libera espaço para resolver outra (74/75/14 formam uma cadeia de 3), aplicar as três em vez de uma correção isolada que criaria uma colisão nova"
    - "Investigação categoria a categoria por evidência: listar TODO DIAG_PRINC real atribuído a uma categoria (não amostra) antes de decidir se a faixa CID está certa ou errada"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/reconcile.py
    - pipeline/sih/tests/test_reconcile.py
    - pipeline/sih/reports/reconciliacao-sc7.md
    - scripts/catalog/cid-divergencias.json
  modified:
    - scripts/catalog/cid-corrections.json
    - pipeline/sih/tests/test_matcher.py

key-decisions:
  - "Row.territorio_codigo no grão UF é o código IBGE numérico (2 dígitos, ex. '12'); o oráculo chaveia por sigla ('AC') — reconcile.py traduz via codigos.UF_POR_CODIGO antes de comparar, achado ao vivo na primeira medição empírica (todos os 98 pares apareciam 'ausentes' até o fix)"
  - "Correção em cadeia de 3 códigos (14->A19, 74->B90, 75->B91) para resolver a colisão 75/76 sem criar uma colisão nova com o 74 — decidido depois de medir que a correção isolada de 75 sozinha colidiria com o valor atual de 74"
  - "Hipótese 'faixa larga absorve faixa estreita' testada e DESCARTADA por medição para as sete categorias de maior delta absoluto em AC/2019 — todas as faixas CID declaradas já são as oficiais e completas da Lista Morb, sem sobreposição com vizinho"
  - "Residual de 58/98 pares deixado honestamente como inexplicado, não convertido em divergência de lote — a hipótese mais provável (competência de processamento ANO_CMPT vs DT_INTER, já medida pelo spike como real mas insuficiente) não foi individualmente verificada para 51 das 58 categorias, e fazer isso sem verificação seria o 'residue hidden by tuning' que o plano proíbe"
  - "Duas correções (14->A19, 274->P35-P37) ficam sem efeito mensurável nesta rodada porque os códigos 9 e 77 já reivindicam as mesmas faixas e vencem por ordem de inserção no mapa — faixa correta de 9/77 não determinável sem acesso ao nibr.def ao vivo; documentado como limitação explícita, não escondida, recomendada para o checkpoint do 09-11"

patterns-established:
  - "reconcile.py: comparador é sempre fail-closed (result.ok só True com zero inexplicado); nunca aplicar tolerância percentual em código de reconciliação (grep-verificado: zero ocorrências de 'toler'/'abs(delta')"

requirements-completed: [DATA-03]  # PIPE-05/DATA-01 permanecem Pending -- ver "Nota sobre REQUIREMENTS.md" abaixo (DATA-03 já estava completo desde o 09-07, sem mudança aqui)

# Metrics
duration: ~45min
completed: 2026-08-10
---

# Phase 09 Plan 08: Reconciliação SC-7 — comparador fail-closed + depuração categoria a categoria Summary

**`reconcile.py` fail-closed (exato/explicado/inexplicado, D-02) medindo 33/98 exato contra o oráculo re-raspado de AC/2019; as duas colisões estruturais do 09-RESEARCH resolvidas com razão escrita (75/76→B92, 142/274→G02) mais um achado extra (tuberculose miliar, 14→A19), a hipótese "faixa larga absorve faixa estreita" testada e descartada por medição nas sete categorias de maior delta, e 58 pares deixados honestamente inexplicado — sem razão inventada — para o checkpoint do 09-11.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completos
- **Files modified:** 6 (4 criados, 2 modificados)

## Accomplishments

- `reconcile.py`: `compare()`/`ReconciliationResult`/`load_oracle`/`load_divergencias`/`main()` — o comparador fail-closed que é o gate de verdade do SC-7. 13 testes cobrindo os nove comportamentos exigidos, incluindo um delta de 1,2% e um de 15% recebendo exatamente o mesmo tratamento (D-02) e um teste de integração contra a fixture real que pegou um bug de tradução de UF na primeira medição
- **Bug real encontrado e corrigido antes de qualquer depuração ser possível:** `Row.territorio_codigo` no grão UF é o código IBGE numérico (`"12"`), não a sigla (`"AC"`) que o oráculo usa — sem a tradução via `codigos.UF_POR_CODIGO`, os 98 pares apareciam TODOS como "ausentes no agregado", mascarando qualquer divergência real atrás de um erro de chave
- **Medição real contra AC/2019 (44.589 registros):** 33/98 bate exato na primeira medição (já > 31 do spike, por diferença de metodologia do oráculo — não por trabalho de correção; registrado honestamente no relatório para não atribuir crédito indevido)
- **As duas colisões estruturais do 09-RESEARCH resolvidas com razão escrita:** `75`/`76`→`B92` (75 corrigido para `B91`, título CID-10 exato + evidência clínica de que hanseníase, endêmica no Acre, é mais plausível que pólio, erradicada no Brasil desde 1989, para os 6 registros reais); `142`/`274`→`G02` (274 corrigido para `P35-P37`, 53 registros reais contra os 50 do TabNet)
- **Achado extra durante a depuração:** código `14` (tuberculose miliar) tinha `B90` no mapa quando deveria ser `A19` (título CID-10 exato) — validado por uma coincidência 3-para-3 (3 registros reais com prefixo A19, TabNet relata exatamente 3)
- **Correção em cadeia sem sobreposição residual dentro do trio:** corrigir 75 sozinho colidiria com o valor atual de 74; corrigir 74 também (B91→B90) resolve isso porque B90 fica livre depois que 14 sai de lá — os três (`74`/`75`/`76`) ficam em `B90`/`B91`/`B92` sem sobreposição entre si
- **Hipótese "faixa larga absorve faixa estreita" testada e DESCARTADA por medição** para as sete categorias de maior delta absoluto em AC/2019 (apêndice, diabetes, hipertensão gestacional, puerpério, doenças infecciosas intestinais, infarto cerebral, insuficiência cardíaca) — todo `DIAG_PRINC` real listado e conferido contra a Lista Morb oficial; todas as faixas já são exatamente as corretas
- **9 divergências registradas** em `cid-divergencias.json`, 7 tornando-se `explicado` no `compare()` real; 2 (os achados 14/274) continuam `inexplicado` mesmo com razão escrita, porque `compare()` nunca resgata uma AUSÊNCIA total via divergência — só um delta não-zero é resgatável (decisão deliberada da Task 1, documentada e não escondida)
- **Estado final honesto:** 33 exato / 7 explicado / 58 inexplicado / `result.ok = False`. Nenhuma razão inventada para os 58 — o relatório documenta a hipótese mais provável (competência de processamento, já medida pelo spike de 2026-08-04) sem convertê-la em divergência de lote sem verificação individual

## Task Commits

1. **Task 1: Comparador fail-closed** - `3b49ad5` (feat) — `reconcile.py` + `test_reconcile.py`, 12 testes
2. **Fix intermediário (achado durante Task 2): tradução UF sigla** - `6d0dbfe` (fix) — descoberto na primeira medição empírica
3. **Task 2: Depuração AC/2019 + correções** - `14a7cb6` (feat) — `cid-corrections.json` (4 entradas) + `reconciliacao-sc7.md` + fix de teste estale em `test_matcher.py`
4. **Task 3: Divergência residual persistida** - `4e8771a` (feat) — `cid-divergencias.json` (9 entradas)

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/reconcile.py` — `Pair`/`ReconciliationResult`/`compare`/`load_oracle`/`load_divergencias`/`main`
- `pipeline/sih/tests/test_reconcile.py` — 13 testes (9 comportamentos exigidos + 1 regressão de integração + 3 de `load_oracle`/`load_divergencias`)
- `pipeline/sih/reports/reconciliacao-sc7.md` — relatório completo da depuração
- `scripts/catalog/cid-corrections.json` — 4 correções, cada uma com `reason` >= 40 caracteres e `reconciliationPair`
- `scripts/catalog/cid-divergencias.json` — 9 divergências, cada uma com `razao` >= 30 caracteres, sem duplicata
- `pipeline/sih/tests/test_matcher.py` — asserção estale ("nasce vazio nesta plan") atualizada para refletir o preenchimento esperado pelo 09-08 (a própria docstring de `corrections.py` já previa este handoff)

## Decisions Made

Ver `key-decisions` no frontmatter — resumo: tradução de UF sigla necessária para qualquer medição fazer sentido; correção em cadeia de 3 códigos para evitar criar uma colisão nova; hipótese de absorção de faixa testada e descartada nas categorias de maior impacto; resíduo de 58 pares deixado honestamente inexplicado em vez de convertido em divergência de lote sem verificação.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `main()` comparava código IBGE numérico contra sigla de UF**
- **Found during:** Primeira medição empírica da Task 2, antes de qualquer depuração ser possível
- **Issue:** `aggregate.Row.territorio_codigo` no grão UF é o código IBGE de 2 dígitos (`"12"` para AC), mas `oracle_tabnet.json` (09-05) chaveia por sigla (`"AC"`) — sem tradução, a chave de junção de `compare()` nunca batia, e os 98 pares do oráculo apareciam TODOS como "ausentes no agregado", mascarando qualquer divergência real atrás de um erro de chave em vez de expor o sinal que a depuração precisava
- **Fix:** `main()` traduz `territorio_codigo` via `codigos.UF_POR_CODIGO` antes de montar a chave do agregado, com comentário citando o mecanismo
- **Files modified:** `pipeline/sih/src/sih_pipeline/reconcile.py`
- **Verification:** Teste de integração novo (`test_join_com_agregado_real_usa_sigla_de_uf_nao_codigo_ibge`) junta o agregado real contra o oráculo real e afirma que nem todo par fica sem correspondente; medição real passou de "98/98 ausente" para "33/98 exato" depois do fix
- **Committed in:** `6d0dbfe`

**2. [Rule 3 - Blocking] Teste estale de `test_matcher.py` bloqueava `uv run pytest -q` (exigido pelo `<verification>` do plano)**
- **Found during:** Task 2, depois de preencher `cid-corrections.json`
- **Issue:** `test_load_corrections_devolve_lista_vazia_nesta_plan` (herdado do 09-07) afirmava `load_corrections() == []` — verdade "nesta plan" era o 09-07; a própria docstring de `corrections.py` já dizia "quem o preenche é a depuração do 09-08", então este teste sempre ficaria estale assim que a Task 2 fizesse seu trabalho mandatado
- **Fix:** Assertiva atualizada para `len(correcoes) >= 2` e `reason` >= 20 caracteres (o piso que `load_corrections` aplica) — não altera nenhuma lógica de `matcher.py`/`corrections.py`, só a expectativa de um teste sobre um estado temporal que o próprio 09-07 já previa mudar
- **Files modified:** `pipeline/sih/tests/test_matcher.py`
- **Verification:** `uv run pytest -q` sai 0 (774 testes Python + suíte Vitest completa)
- **Committed in:** `14a7cb6`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) — nenhum fora do escopo previsto pelo próprio texto do plano ("verificar... em vez de assumir" e o handoff já documentado por `corrections.py`)
**Impact on plan:** Ambos necessários para que a reconciliação medisse alguma coisa de verdade. Sem o primeiro fix, toda a depuração categoria a categoria teria sido feita contra um sinal falso (100% ausente).

## Issues Encountered

- **Colisões residuais não totalmente resolvidas (limitação conhecida, documentada, não escondida):** duas das quatro correções aplicadas (`14`→A19, `274`→P35-P37) ficam sem efeito mensurável em AC/2019 porque os códigos `9` e `77` já reivindicam as mesmas faixas e vencem por ordem de inserção no mapa. Uma varredura completa do mapa (`lista-morb-cid.json`) mostrou que a vizinhança de chapter I (A00-B99) está densamente ocupada — não há território livre óbvio para onde `9`/`77` poderiam migrar sem colidir com outro código. Determinar a faixa correta desses dois exigiria acesso ao `nibr.def` ao vivo ou revisão clínica (mesma classe de decisão que a Fase 8 tratou com checkpoint humano em `08-07`), fora do alcance desta plan. O script de sobreposição do 09-RESEARCH, rodado sobre o mapa com as quatro correções aplicadas, confirma exatamente esses dois pares residuais e nenhum outro — registrado em `reconciliacao-sc7.md` §"Estado final e limitações" e recomendado como pergunta explícita para o checkpoint do 09-11.
- **58/98 pares permanecem `inexplicado`:** a hipótese mais plausível (efeito de competência de processamento `ANO_CMPT` vs. data real de internação `DT_INTER`, já medido pelo spike de 2026-08-04 como real porém insuficiente — reduz o viés mediano de +4,14% para +3,45%, não zera) não foi convertida em divergência de lote para as 51 categorias sem investigação individual dedicada nesta rodada, porque fazer isso sem verificação categoria a categoria seria exatamente o "residue hidden by tuning" que este plano existe para evitar. Corrigir isso definitivamente exigiria dados de 2020 (fora do recorte AC/2019 do D-03) e uma mudança em `aggregate.py`, que pertence ao 09-07 e está fora do escopo de arquivo desta plan.

## User Setup Required

None — nenhuma configuração de serviço externo necessária nesta plan.

## Nota sobre REQUIREMENTS.md

Este plano declara `requirements: [PIPE-05, DATA-01, DATA-03]` no frontmatter, mas **nenhum novo
requisito foi marcado `[x]`** além do que o 09-07 já havia marcado (`DATA-03`, sem mudança aqui).
Justificativa: `DATA-01` ("4 medidas coletadas para os 331 agravos, grão UF") exige a corrida
completa de coleta (`09-04`, ainda bloqueada por disco) e a confirmação do 09-11 numa UF grande —
esta plan trabalhou só sobre o recorte AC/2019 do D-03, a fatia de iteração rápida, nunca a coleta
inteira. `PIPE-05` ("o operador consegue verificar que uma coleta capturou o que afirma") é mais
diretamente entregue pelo ledger/auditoria do `09-12`, não pelo comparador de reconciliação em si.
Marcar qualquer um dos dois como `Complete` agora seria falso — mesmo padrão de cautela que o
`09-07-SUMMARY.md` já registrou para `DATA-01`/`DATA-02`.

## Next Phase Readiness

- `reconcile.py` pronto para o `09-11` invocar contra uma UF grande (SP ou MG) sem redepurar —
  `main()` já aceita `--uf`/`--ano`/`--relatorio` e sai não-zero quando há `inexplicado`
- `cid-corrections.json` (4 entradas) e `cid-divergencias.json` (9 entradas) prontos para o
  checkpoint em lote do 09-11 (D-07) — a tabela completa (código, faixa antiga, faixa nova, razão)
  está em `reconciliacao-sc7.md`
- **Duas perguntas explícitas levadas ao 09-11:** (1) os códigos `9` e `77` — faixa correta
  desconhecida, bloqueando o efeito pleno das correções `14`/`274`; (2) os 58 pares `inexplicado` —
  aceitar a hipótese de competência de processamento como explicação de lote, ou aprofundar a
  depuração categoria a categoria contra uma UF maior
- `lista-morb-cid.json` permanece intocado (`git diff --exit-code` confirmado em cada commit)
- `npm run gate` verde em todos os 4 commits (774 testes Python + suíte Vitest completa + build)

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-10*

## Self-Check: PASSED

Todos os 6 arquivos listados em Files Created/Modified existem no disco; todos os 4 hashes de
commit (`3b49ad5`, `6d0dbfe`, `14a7cb6`, `4e8771a`) existem em `git log --oneline --all`.
