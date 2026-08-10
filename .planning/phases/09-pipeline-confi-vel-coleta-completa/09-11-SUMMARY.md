---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 11
subsystem: infra
tags: [python, reconciliation, cid-10, data-quality, tabnet, sc-7, checkpoint, gate]

# Dependency graph
requires:
  - phase: 09-08
    provides: "reconcile.py (comparador fail-closed), cid-corrections.json (4 correções), cid-divergencias.json (9 divergências), reconciliacao-sc7.md — a depuração categoria a categoria em AC/2019"
  - phase: 09-05
    provides: "oracle_scrape.py e o método de re-raspagem ao vivo confirmada contra o CSV guardado (D-04) — reaplicado nesta plan para construir o oráculo de SP/2019"
provides:
  - "pipeline/sih/reports/confirmacao-uf-grande.md: confirmação das 4 correções contra SP/2019 (113 pares, 8 exato, 7 explicado, 98 inexplicado) sem redepurar (D-03), mais o resultado do checkpoint clínico"
  - "scripts/catalog/cid-corrections.json: as 4 correções aprovadas pelo operador, cada uma com campo aprovacaoClinica datado"
  - "scripts/catalog/cid-divergencias.json: 53 divergências de lote novas (mecanismo de competência de processamento, decisão 2) + 2 fichas de pendência que bloqueiam o upload (decisões 3/4) — 64 entradas no total"
  - "pipeline/sih/tests/fixtures/oracle_ac_2019.json: snapshot congelado do oráculo AC/2019 (98 pares), a fixture do gate permanente"
  - "pipeline/sih/tests/test_reconcile_gate.py: gate permanente do SC-7 (D-06), invocado por npm run gate via pipeline:reconcile-gate"
affects: [09-10, 09-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Divergência de lote com diseaseId sintético (prefixo PENDENTE_) para documentar uma pendência sem que reconcile.compare() a resgate como 'explicado' — diseaseId nunca casa com par real do oráculo, então o gate continua honestamente inexplicado nos códigos afetados"
    - "Gate permanente protege a COMPOSIÇÃO EXATA do conjunto inexplicado (frozenset nomeado), não 'zero inexplicado' — result.ok pode ser False de propósito quando há pendência conhecida e aprovada pelo operador; o teste falha se o conjunto mudar para mais OU para menos"
    - "Prova viva de sensibilidade do gate feita in-memory (cópia mutada de load_corrections()/load_oracle(), nunca o arquivo real) para manter o teste rápido e determinístico; a prova sobre o arquivo real é feita uma vez, manualmente, e revertida (documentada aqui, não como teste permanente)"

key-files:
  created:
    - pipeline/sih/reports/confirmacao-uf-grande.md
    - pipeline/sih/tests/fixtures/oracle_ac_2019.json
  modified:
    - scripts/catalog/cid-corrections.json
    - scripts/catalog/cid-divergencias.json
    - pipeline/sih/tests/test_reconcile_gate.py
    - .planning/STATE.md

key-decisions:
  - "Operador aprovou as 4 correções de faixa CID como estão (75→B91, 74→B90, 14→A19, 274→P35-P37), ciente de que P35-P37 (274) é aproximação textual, não título CID-10 exato como as outras três — aprovação consciente, registrada no próprio JSON"
  - "Operador aceitou o resíduo de 58/98 pares inexplicados do AC como divergência de lote (mecanismo de competência de processamento ANO_CMPT/DT_INTER), sustentado por duas medições independentes (AC +7,90%, SP +5,10%) — mas EXCLUIU deliberadamente 3 das 58 categorias (7/tuberculose_pulmonar, 146/doença_de_alzheimer, 10/tuberculose_do_sistema_nervoso) por decisão 4, mantendo-as inexplicado no gate"
  - "Operador NÃO aceitou os códigos 9/77 (colisão residual) nem as 7 categorias de delta extremo como divergência honesta — determinou investigação no 09-08 antes do upload. Registrados como fichas de pendência com diseaseId sintético, bloqueiaUpload=true, mecanismoIdentificado=false"
  - "Gate permanente (Task 3) assert a composição EXATA do conjunto inexplicado (5 disease_ids nomeados), não result.ok==True — desvio deliberado do texto original do plano (que assumia zero inexplicado), autorizado explicitamente pelo operador via coordenador: 'o gate deve refletir a realidade... mas precisa continuar falhando se alguém reintroduzir um par inexplicado'"
  - "RED e GREEN da Task 3 (TDD) commitados juntos, não em dois commits separados — o pre-commit hook (.githooks/pre-commit) roda npm run gate em todo commit fora de .planning/, e um commit intermediário com teste falhando quebraria o hook. RED foi executado e observado localmente (FileNotFoundError) antes de criar a fixture; GREEN confirmado (5/5, <1s) antes do commit único"

requirements-completed: []  # PIPE-05/DATA-01 permanecem Pending -- ver "Nota sobre REQUIREMENTS.md" abaixo

# Metrics
duration: ~55min
completed: 2026-08-10
---

# Phase 09 Plan 11: Confirmação em UF grande + checkpoint clínico + gate permanente do SC-7 Summary

**Correções CID confirmadas contra SP/2019 (113 pares, sem redepurar), aprovadas em checkpoint clínico pelo operador junto de uma divergência de lote para 53 categorias (mecanismo de competência de processamento, confirmado em duas UFs), com duas pendências explícitas — colisão residual dos códigos 9/77 e 7 categorias de delta extremo — registradas como bloqueadoras do upload do 09-10, e o gate permanente do SC-7 congelado protegendo a composição exata do resíduo conhecido.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completos (Task 2 pausou em checkpoint humano, retomada após resposta do operador)
- **Files modified:** 6 (2 criados, 4 modificados)

## Accomplishments

- **Task 1 — Confirmação sem redepurar (D-03):** oráculo de SP/2019 construído do zero pelo método do 09-05 (113 candidatos, 113/113 reproduzidos ao vivo, 0 descartes) porque o oráculo do 09-05 cobre só AC. `reconcile.compare()` rodado com as correções já aplicadas e **inalteradas** (`git diff --quiet scripts/catalog/cid-corrections.json` confirmado antes e depois): 8 exato, 7 explicado, 98 inexplicado. Achados registrados, não corrigidos: 35 categorias tinham zero registros em AC/2019 (a vacuidade que a task existe para medir); os dois códigos residuais (`9`/`77`) provados muito mais materiais em escala (133 e 1.992 internações reais ausentes, contra 3 e 50 no AC); 7 categorias novas com delta extremo (25%–3.451%) que o AC nunca exercitou com volume suficiente para revelar.
- **Task 2 — Checkpoint clínico em lote (D-07):** apresentação em tabela única (4 correções + evidência de `DIAG_PRINC` real medida em AC e SP, nunca alterada) mais a tabela de divergências residuais, com o resíduo de 58/98 do AC como decisão explícita. O operador respondeu com 4 decisões: (1) aprovar as 4 correções como estão; (2) aceitar o resíduo como divergência de lote; (3) recusar divergência honesta para os códigos 9/77 — volta ao 09-08; (4) recusar divergência honesta para as 7 categorias de delta extremo — volta ao 09-08. Registrado nos próprios JSONs.
- **Task 3 — Gate permanente (D-06):** `oracle_ac_2019.json` (subconjunto congelado `uf=="AC"`, 98/98) + `test_reconcile_gate.py` reescrito (5 testes, <1s de parede, zero rede) protegendo a composição exata do conjunto inexplicado — não "zero inexplicado", que deixou de ser verdade depois das decisões 3/4. `npm run pipeline:reconcile-gate` e `npm run gate` verdes.

## Task Commits

1. **Task 1: Confirmar correção contra UF grande (D-03)** - `c5468cc` (docs)
2. **Registro do checkpoint pendente no STATE.md** - `f308f35` (docs)
3. **Task 2: Decisão clínica do checkpoint — 4 aprovadas, 2 pendências** - `7321bd8` (feat)
4. **Task 3: Gate permanente do SC-7 (RED+GREEN, ver nota abaixo)** - `9243cc0` (test)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `pipeline/sih/reports/confirmacao-uf-grande.md` — confirmação em SP/2019 + resultado do checkpoint clínico (seção "Checkpoint clínico (Task 2)")
- `scripts/catalog/cid-corrections.json` — 4 entradas, cada uma com `aprovacaoClinica` datada
- `scripts/catalog/cid-divergencias.json` — 9 (09-08) + 53 (divergência de lote, decisão 2) + 2 (fichas de pendência, decisões 3/4) = 64 entradas
- `pipeline/sih/tests/fixtures/oracle_ac_2019.json` — 98 pares, `uf=="AC"`, `raspadoEm` preservado
- `pipeline/sih/tests/test_reconcile_gate.py` — gate permanente, 5 testes
- `.planning/STATE.md` — posição, bloqueio do checkpoint (removido após resolução), novos bloqueios do 09-10

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o operador aprovou as correções e o mecanismo geral de viés, mas recusou fechar em falso as duas questões mais sérias (colisão 9/77 e as 7 categorias de delta extremo) — exatamente o comportamento que o checkpoint em lote (D-07) existe para proteger, e o precedente que a 08-07 estabeleceu (revisão humana pega o que a automação sozinha não pegaria).

## Bloqueia o 09-10

**Duas pendências bloqueiam o upload.** Nenhuma delas foi resolvida nesta plan — o D-03 proíbe redepurar durante a confirmação, e o operador explicitamente recusou fechá-las como divergência honesta. Quem executar o 09-10 precisa tratar isto como pré-requisito, não como nota de rodapé.

### 1. Colisão residual dos códigos `9` e `77` (`cid-divergencias.json` → `PENDENTE_colisao_codigos_9_e_77`)

- Código `9` (A19, "restante de tuberculose respiratória") bloqueia o efeito da correção aprovada do código `14` (tuberculose miliar).
- Código `77` (P35-P37, "outras doenças infecciosas e parasitárias") bloqueia o efeito da correção aprovada do código `274` (doenças infecciosas e parasitárias congênitas).
- **Materialidade medida (09-11 Task 1, SP/2019):** **2.254 internações reais** atribuídas ao código errado — 164 com prefixo A19 (deveriam ir para `tuberculose_miliar`) + 2.090 com prefixo P35/P36/P37 (deveriam ir para `doencas_infecciosas_e_parasitarias_congenitas`). No AC eram só 56 (3+53).
- **Dono do próximo passo:** 09-08 — determinar a faixa correta de `9` e `77` (exige `nibr.def` ao vivo ou revisão clínica direta).

### 2. Sete categorias com delta extremo, mecanismo desconhecido (`cid-divergencias.json` → `PENDENTE_sete_categorias_delta_extremo_sp`)

| Categoria | tabnetCode | Delta SP/2019 |
|---|---|---|
| restante_de_outras_tuberculoses | 15 | +3.451% |
| demencia | 132 | +665% |
| tuberculose_pulmonar | 7 | +108% |
| doenca_de_parkinson | 145 | +47,5% |
| tuberculose_do_sistema_nervoso | 10 | +47,4% |
| doenca_de_alzheimer | 146 | +45,7% |
| tuberc_intest_peritonio_glangl_mesentericos | 11 | +44,4% |

- Nenhuma sobreposição estrutural de faixa CID encontrada (verificado, não corrigido, D-03).
- 4 das 7 são do capítulo de tuberculose (junto dos códigos `9`/`14` já pendentes) — suspeita de defeito estrutural não mapeado naquele capítulo.
- 3 delas (`demência`, `parkinson`, `tuberc_intest`) batem **exato** em AC/2019 (17/3/1 casos) — só a escala de SP revelou a divergência real. Isso é a vacuidade do D-03 em ação: o AC não teria pego isto sozinho.
- **Dono do próximo passo:** 09-08.

### Estado do gate após as decisões (AC/2019, fixture congelada)

`exato=33, explicado=60, inexplicado=5, result.ok=False`. Os 5 inexplicados são exatamente `doenca_de_alzheimer`, `doencas_infecciosas_e_parasitarias_congenitas`, `tuberculose_do_sistema_nervoso`, `tuberculose_miliar`, `tuberculose_pulmonar` — a interseção visível em AC/2019 das duas pendências acima. **O que o gate cobre:** essa composição exata, protegida por `frozenset` nomeado em `test_reconcile_gate.py` — qualquer mudança (regressão ou correção futura) precisa passar por decisão humana e atualização deliberada do teste. **O que o gate NÃO cobre:** as outras 4 categorias do achado 2 (`restante_de_outras_tuberculoses`, `doenca_de_parkinson`, e as duas que batem exato em AC mas divergem em SP) — a fixture do gate é só AC/2019 (D-06, ~267 KB de parquet); SP nunca entra no gate, então essas 4 pendências só ficam visíveis em `pipeline/sih/reports/confirmacao-uf-grande.md` e nas fichas de `cid-divergencias.json`, não no `npm run gate`.

## Deviations from Plan

### Auto-fixed Issues

Nenhuma das Rules 1-3 se aplicou (nenhum bug, funcionalidade crítica faltante, ou bloqueio automaticamente corrigível). Duas decisões arquiteturais/de escopo foram tratadas via checkpoint humano (Rule 4), não auto-corrigidas:

**1. [Deviation de processo — não Rule 1-4] Task 3 TDD: RED e GREEN commitados juntos**
- **Encontrado durante:** Task 3, ao tentar commitar a fase RED isoladamente (teste real sem a fixture, esperado falhar)
- **Problema:** `.githooks/pre-commit` roda `npm run gate` (que inclui `uv run pytest -q`, a suíte inteira) em qualquer commit fora de `.planning/` — um commit com `test_reconcile_gate.py` falhando bloquearia o próprio commit
- **Ação:** RED executado e observado localmente (`FileNotFoundError` na fixture ausente) antes de criar `oracle_ac_2019.json`; GREEN confirmado (5/5 testes, <1s) antes do único commit `9243cc0`. Disciplina RED→GREEN seguida no processo, só a granularidade do commit foi ajustada à política do próprio repositório
- **Files modified:** `pipeline/sih/tests/test_reconcile_gate.py`, `pipeline/sih/tests/fixtures/oracle_ac_2019.json`
- **Committed in:** `9243cc0`

**2. [Rule 4 — Architectural, resolvido via checkpoint] Task 3 `<behavior>` original assumia `result.ok == True`; realidade pós-checkpoint é `False`**
- **Encontrado durante:** Task 3, depois de registrar as decisões 1-2 do operador (Task 2)
- **Problema:** o texto original do plano especificava "`result.ok` precisa ser `True` — todo par exato ou explicado, nunca inexplicado". As decisões 3/4 do operador mantêm 5 pares deliberadamente inexplicado (pendências que bloqueiam o upload) — `result.ok == True` seria só alcançável escondendo essas pendências atrás de uma divergência inventada, exatamente o que D-02/D-08 proíbem
- **Ação:** o coordenador (repassando a decisão do operador) autorizou explicitamente o desvio: "o gate deve refletir a realidade... mas precisa continuar falhando se alguém reintroduzir um par inexplicado". O gate passou a proteger a composição EXATA do conjunto inexplicado (frozenset de 5 disease_ids nomeados) em vez de `result.ok == True`
- **Files modified:** `pipeline/sih/tests/test_reconcile_gate.py`
- **Committed in:** `9243cc0`

---

**Total deviations:** 2 (1 de processo/commit-granularity, 1 arquitetural autorizada explicitamente pelo operador)
**Impact on plan:** Nenhum impacto negativo — ambas preservam a integridade do gate (D-06) e a honestidade do resíduo (D-02/D-08); a segunda é, na verdade, mais fiel ao espírito do D-02 do que o texto original do plano.

## Issues Encountered

- **Prova manual de sensibilidade do gate (`cid-corrections.json`):** conforme exigido pelo acceptance criteria da Task 3, uma correção temporária foi adicionada ao arquivo REAL (`tabnetCode "105" -> "Z99"`), `npm run pipeline:reconcile-gate` executado e confirmado saindo com código 1 (`FAILED test_gate_agrega_fixture_pequena_e_compara_com_oraculo_congelado`), e revertido via `git checkout -- scripts/catalog/cid-corrections.json` (`git diff --stat` confirmado vazio depois). `npm run pipeline:reconcile-gate` confirmado verde novamente após a reversão.
- **Deltas extremos concentrados no capítulo de tuberculose:** achado não previsto pelo plano original — 4 das 7 categorias de delta extremo (achado da Task 1) pertencem ao mesmo capítulo CID dos dois códigos já pendentes (9/14), reforçando a suspeita (não confirmada) de defeito estrutural mais amplo naquele capítulo. Registrado como pendência para o 09-08, não investigado além da checagem de sobreposição de faixa (D-03 proíbe redepurar).

## User Setup Required

None — nenhuma configuração de serviço externo necessária nesta plan.

## Nota sobre REQUIREMENTS.md

`requirements: [PIPE-05, DATA-01, DATA-03]` no frontmatter do plano, mas nenhum novo requisito
marcado `[x]` (`DATA-03` já estava `Complete` desde o 09-07). `DATA-01` ("4 medidas coletadas para
os 331 agravos, grão UF") continua `Pending`: a corrida completa do 09-04 (bloqueada por disco)
ainda não aconteceu, e SC-7 (o critério de qualidade da coleta) tem duas pendências abertas
bloqueando o upload. `PIPE-05` ("o operador consegue verificar que uma coleta capturou o que
afirma") continua `Pending`: entregue mais diretamente pelo ledger/auditoria do 09-12. Mesmo padrão
de cautela que 09-07/09-08 já registraram.

## Next Phase Readiness

- **09-10 permanece BLOQUEADO** — não pelo mesmo motivo de antes (credenciais), mas por duas
  pendências de dados explícitas (ver seção "Bloqueia o 09-10" acima). `09-10` deve verificar
  `scripts/catalog/cid-divergencias.json` por entradas `bloqueiaUpload: true` antes de rodar
  qualquer `COPY`.
- **09-08 tem dois itens de trabalho novos**, ambos com número medido e dono claro: investigar a
  faixa correta dos códigos `9`/`77` (2.254 internações reais em jogo), e investigar as 7
  categorias de delta extremo (suspeita de defeito estrutural no capítulo de tuberculose).
- `npm run gate` verde em todos os 4 commits (784 testes Python+Vitest + build).
- Nenhum `.parquet`/`.dbc` de SP foi commitado — só viveram em `~/.lacir/sih-cache/parquet/`
  (fora do repositório) durante a execução desta plan.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-10*

## Self-Check: PASSED

Todos os 6 arquivos listados em Files Created/Modified existem no disco; todos os 4 hashes de
commit (`c5468cc`, `f308f35`, `7321bd8`, `9243cc0`) existem em `git log --oneline --all`.
