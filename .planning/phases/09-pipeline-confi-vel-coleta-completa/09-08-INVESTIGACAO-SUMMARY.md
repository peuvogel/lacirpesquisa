---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 08-INVESTIGACAO
subsystem: infra
tags: [python, reconciliation, cid-10, data-quality, tabnet, sc-7, aih, ident]

# Dependency graph
requires:
  - phase: 09-08
    provides: "reconcile.py, cid-corrections.json (4 correções), cid-divergencias.json (9 divergências) — a base sobre a qual esta investigação atua"
  - phase: 09-11
    provides: "confirmação em SP/2019, checkpoint clínico do operador (2026-08-10) que devolveu as duas pendências (códigos 9/77 e 7 categorias de delta extremo) ao 09-08 como bloqueadoras explícitas do upload"
provides:
  - "scripts/catalog/cid-corrections.json: 3 correções novas (tabnetCode 9/15/77), determinadas por fonte autoritativa (mxcid10lm.htm) + validação empírica ao vivo — resolve a colisão residual que bloqueava o efeito das correções já aprovadas dos códigos 14/274"
  - "scripts/catalog/cid-divergencias.json: PENDENTE_colisao_codigos_9_e_77 resolvida (bloqueiaUpload=false); PENDENTE_sete_categorias_delta_extremo_sp com mecanismo identificado (AIH tipo 5, IDENT='5') mas correção fora de escopo — permanece bloqueiaUpload=true"
  - "pipeline/sih/reports/reconciliacao-sc7.md: seção nova documentando o método completo de ambas as investigações"
  - "pipeline/sih/tests/test_reconcile_gate.py: composição do gate atualizada (exato 33->34, explicado 60->61, inexplicado 5->3) refletindo a resolução da pendência A"
affects: [09-10, 09-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fonte autoritativa para faixa CID: http://tabnet.datasus.gov.br/cgi/sih/mxcid10lm.htm (tabela oficial Capítulo/Código/Descrição/CID-10, distinta do <select> do nibr.def que só expõe rótulo+id sequencial) — join por rótulo normalizado, cache local gitignored para reprodutibilidade sem exigir rede"
    - "Quando um item não tem correspondência na tabela oficial impressa, a nota técnica da própria página avisa quando isso é esperado ('subdivisões para necessidades brasileiras') — nesses casos, resolver por medição empírica ao vivo (TabNet + microdado), nunca por suposição"
    - "IDENT (tipo de AIH) — IDENT='5' é renovação de faturamento de internação de longa permanência, não uma nova admissão; contá-lo em 'internações' infla categorias crônicas (demência, Parkinson, Alzheimer, formas graves de tuberculose) em ordens de grandeza, sem afetar condições agudas (0% em apendicite/colelitíase)"

key-files:
  created: []
  modified:
    - scripts/catalog/cid-corrections.json
    - scripts/catalog/cid-divergencias.json
    - pipeline/sih/reports/reconciliacao-sc7.md
    - pipeline/sih/tests/test_reconcile_gate.py
    - .planning/STATE.md

key-decisions:
  - "Pendência A (códigos 9/77) resolvida por fonte autoritativa (mxcid10lm.htm, tabela oficial DATASUS) com correspondência EXATA de rótulo para os códigos 15/77, e por medição empírica ao vivo (TabNet + microdado, coincidência exata 26=26) para o código 9, que não tem item próprio na tabela impressa"
  - "Achado: a cadeia envolvia TRÊS códigos (9, 15, 77), não dois — cada um tinha o valor que pertence a um dos outros dois (9↔14, 15↔77, 77↔274) — corrigir 77 sem corrigir 15 primeiro criaria uma colisão nova; as três correções foram aplicadas juntas e verificadas sem sobreposição (varredura de 493 tokens sobre o mapa inteiro)"
  - "Pendência B (7 categorias de delta extremo) NÃO foi fechada como resolvida — o mecanismo (AIH tipo 5, IDENT='5' não filtrado por aggregate.py) foi identificado e medido com forte evidência (deltas colapsam para a banda já aceita ao filtrar IDENT='1'), mas a correção pertence a aggregate.py, fora do escopo de arquivo explícito desta investigação (dono: 09-07). bloqueiaUpload permanece true por decisão de honestidade — mecanismo conhecido não é o mesmo que dado corrigido"
  - "cid-corrections.json das 3 novas entradas NÃO recebeu campo aprovacaoClinica (diferente das 4 correções anteriores, aprovadas no checkpoint do 09-11) — a evidência é técnica/documental (fonte oficial + medição), não julgamento clínico, e nenhuma nova aprovação do operador ocorreu nesta sessão; distinção registrada honestamente nos próprios JSONs"
  - "Gate permanente (test_reconcile_gate.py) atualizado para a nova composição real (34/61/3) — não afrouxado: result.ok continua False, os 3 inexplicados restantes (doenca_de_alzheimer, tuberculose_do_sistema_nervoso, tuberculose_pulmonar) são exatamente os representantes visíveis em AC/2019 da pendência B ainda aberta"

requirements-completed: []  # Nenhum requisito novo -- esta é uma investigação de correção de dados sobre trabalho do 09-08/09-11, não uma entrega de requisito novo

# Metrics
duration: ~35min
completed: 2026-08-10
---

# Investigação 09-08: Resolução das duas pendências que bloqueiam o upload (09-10) Summary

**Faixa correta dos códigos 9 e 77 determinada via tabela oficial DATASUS `mxcid10lm.htm` + validação empírica ao vivo (coincidência exata 26=26), revelando uma cadeia de 3 códigos com valores trocados (9/15/77) — resolve a colisão residual (`PENDENTE_colisao_codigos_9_e_77`); as 7 categorias de delta extremo tiveram seu mecanismo identificado como AIH tipo 5 (`IDENT='5'`, renovação de faturamento de longa permanência não filtrada por `aggregate.py`) mas a correção fica fora do escopo de arquivo desta investigação — `PENDENTE_sete_categorias_delta_extremo_sp` continua bloqueando o upload.**

## Performance

- **Duration:** ~35 min
- **Tasks:** investigação avulsa, sem PLAN.md (brief do coordenador) — 2 pendências investigadas
- **Files modified:** 5 (0 criados fora deste SUMMARY, 4 modificados + este arquivo)

## Accomplishments

- **Pendência A resolvida com evidência de duas camadas.** Fonte autoritativa: `http://tabnet.datasus.gov.br/cgi/sih/mxcid10lm.htm` (tabela oficial "CID-10 — Lista de Tabulação para Morbidade", já mapeada pelo 08-RESEARCH §1.3 mas nunca absorvida até agora), buscada ao vivo (51.116 bytes, idêntico ao tamanho já registrado em 2026-08-03 — página estável), cache local em `pipeline/sih/cache/mxcid10lm.htm` (gitignored, reproduzível). Join por rótulo normalizado (74% exato, mesma proporção medida pelo 08-RESEARCH) revelou que o mapa `lista-morb-cid.json` tem uma cadeia de atribuição TROCADA envolvendo três códigos: `9` tinha o valor de `14`, `15` tinha o valor de `77`, `77` tinha o valor de `274`. Os códigos `15` e `77` bateram correspondência EXATA de rótulo contra a tabela oficial; o código `9` não tem item próprio na tabela impressa (a página avisa explicitamente que "tuberculoses respiratórias" foi subdividida além do que a tabela de 3 colunas mostra) — resolvido por medição empírica ao vivo: TabNet relata 26 internações em SP/2019 e 0 em AC/2019 para o código 9; no microdado real, `DIAG_PRINC` gravado sem 4º dígito (`"A15"`/`"A16"` de 3 caracteres) soma exatamente 26 em SP e 0 em AC — coincidência exata, não aproximação.
- **Três correções aplicadas em cadeia** (`cid-corrections.json`, tabnetCodes `9`, `15`, `77`) — corrigir `77` sem `15` criaria uma colisão nova. Varredura de sobreposição sobre o mapa inteiro (331 códigos, 493 tokens) confirma zero colisões novas.
- **Efeito medido sobre a fixture congelada do gate (AC/2019):** libera as correções já aprovadas dos códigos `14`/`274` — `tuberculose_miliar` passa de ausente para **EXATO** (agregado=3, TabNet=3); `doencas_infecciosas_e_parasitarias_congenitas` passa de ausente para **EXPLICADO** (agregado=53, TabNet=50, delta +6%, dentro da banda de competência de processamento já aceita). Gate: `exato` 33→34, `explicado` 60→61, `inexplicado` 5→3.
- **Pendência B caracterizada, não resolvida.** Confirmado (de novo, contra a fonte autoritativa) que as faixas CID de demência/Parkinson/Alzheimer já eram exatas — o problema não é faixa CID. Achado o mecanismo real: o campo `IDENT` (tipo de AIH) não é filtrado por `aggregate.py`; `IDENT='5'` (AIH de longa permanência, renovação mensal de faturamento, não nova admissão) domina desproporcionalmente estas sete categorias em SP/2019 (11,5% a 86,0%, contra 2,7% de baseline no dataset inteiro e 0% em condições agudas como apendicite/colelitíase) e é **0% em todas as sete em AC/2019** — explica com mecanismo, não só volume, por que o Acre nunca revelou o defeito. Filtrando só `IDENT='1'`, os deltas colapsam de +45%/+108%/+665% para +3,7% a +21,1% — a mesma ordem de grandeza da banda já aceita. **Não corrigido**: a correção pertence a `aggregate.py`, de propriedade do 09-07, fora do escopo de arquivo explícito desta investigação.
- **Gate permanente atualizado, não afrouxado.** `test_reconcile_gate.py`: composição nova (34/61/3), `result.ok` continua `False` — os 3 inexplicados restantes são exatamente os representantes de AC/2019 da pendência B ainda aberta.

## Task Commits

1. **Correções CID 9/15/77 + gate atualizado** - `bba9620` (fix)
2. **Relatório da investigação (reconciliacao-sc7.md)** - `b507866` (docs)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `scripts/catalog/cid-corrections.json` — 3 correções novas (tabnetCode 9/15/77), cada uma com `reason` extenso citando fonte autoritativa + medição empírica
- `scripts/catalog/cid-divergencias.json` — `PENDENTE_colisao_codigos_9_e_77` resolvida (`bloqueiaUpload: false`); `tuberculose_miliar`/`doencas_infecciosas_e_parasitarias_congenitas` atualizadas (agora exato/explicado, não mais ausente); `PENDENTE_sete_categorias_delta_extremo_sp` com `mecanismoIdentificado: true`, `bloqueiaUpload` permanece `true`
- `pipeline/sih/reports/reconciliacao-sc7.md` — seção nova "Investigação nova, 2026-08-10" com o método completo de ambas as investigações
- `pipeline/sih/tests/test_reconcile_gate.py` — composição do gate atualizada (34/61/3), docstring e comentários atualizados
- `.planning/STATE.md` — bloqueios abertos atualizados (este commit)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: pendência A resolvida com evidência dupla (fonte autoritativa + medição empírica), aplicada como correção de faixa CID normal (mesmo padrão D-05 do 09-08); pendência B caracterizada honestamente como "mecanismo conhecido, correção fora de escopo" — decisão deliberada de NÃO fechar `bloqueiaUpload` apesar de entender a causa, porque entender não é o mesmo que corrigir o dado.

## Deviations from Plan

Não há PLAN.md formal para esta investigação (brief avulso do coordenador) — as "Rules" de desvio se aplicam ao brief como espécie de plano implícito.

### Auto-fixed Issues

Nenhum bug/funcionalidade crítica faltante encontrado nos arquivos de propriedade desta investigação (Rules 1-3 não se aplicaram). Um achado arquitetural real foi encontrado FORA do escopo de arquivo e tratado por Rule 4 (não editar, reportar):

**1. [Rule 4 — fora de escopo, reportado não editado] Bug real em `aggregate.py`: `IDENT='5'` (AIH de longa permanência) não filtrado**
- **Encontrado durante:** investigação da pendência B (7 categorias de delta extremo)
- **Problema:** a medida `internacoes` conta toda linha do microdado sem filtrar `IDENT`, incluindo renovações mensais de faturamento de internações de longa permanência (`IDENT='5'`) como se fossem novas admissões — infla categorias crônicas (demência +665%, tuberculose pulmonar +108%, outras 5 categorias entre +33% e +48%) sem afetar a maioria das categorias (baseline 2,7% `IDENT='5'` no dataset inteiro, 0% em condições agudas)
- **Ação:** NÃO editado — `aggregate.py` é de propriedade do 09-07 e está explicitamente fora do `file_scope` desta investigação ("Do NOT modify aggregate.py"). Documentado extensivamente em `cid-divergencias.json` (`PENDENTE_sete_categorias_delta_extremo_sp`, `mecanismoIdentificado: true`) e em `reconciliacao-sc7.md`, com o próximo dono explícito (09-07) e a evidência completa (tabela IDENT por categoria, SP vs AC, deltas antes/depois do filtro)
- **Files modified:** nenhum arquivo de `aggregate.py`; documentação em `cid-divergencias.json`/`reconciliacao-sc7.md`
- **Committed in:** `bba9620`, `b507866`

---

**Total deviations:** 1 (achado arquitetural real, reportado e documentado, não editado — fora do escopo de arquivo por instrução explícita)
**Impact on plan:** Nenhum impacto negativo — a decisão de não editar `aggregate.py` preserva a disciplina de propriedade de arquivo entre planos; a pendência B permanece corretamente bloqueando o upload até que o dono correto aplique o fix.

## Issues Encountered

- **Nota de escopo não testada, registrada honestamente:** esta investigação mediu `IDENT='5'` só para as sete categorias designadas pelo checkpoint do 09-11 (mais as duas da pendência A). É plausível, por analogia clínica, que outras categorias crônicas (câncer terminal, cuidados paliativos, diálise, saúde mental de longa permanência) tenham o mesmo problema em grau menor — inclusive contribuindo parcialmente para o resíduo geral já aceito como divergência de lote pela decisão 2 do checkpoint do 09-11. Esta é uma HIPÓTESE não testada aqui (fora do mandato desta investigação, que é as duas pendências específicas) — não reabre a decisão 2, mas fica registrada em `reconciliacao-sc7.md` para quem eventualmente corrigir `aggregate.py`.

## User Setup Required

None — nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- **09-10 deixa de estar bloqueado pela pendência A.** `scripts/catalog/cid-divergencias.json` → `PENDENTE_colisao_codigos_9_e_77` tem `bloqueiaUpload: false`.
- **09-10 continua bloqueado pela pendência B**, agora com mecanismo conhecido e um dono explícito diferente: 09-07 precisa filtrar `IDENT='1'` (ou equivalente — excluir AIH de longa permanência) em `aggregate.py` antes que o upload possa proceder com segurança para estas categorias (e possivelmente outras, ver nota de escopo). `scripts/catalog/cid-divergencias.json` → `PENDENTE_sete_categorias_delta_extremo_sp` continua com `bloqueiaUpload: true`, `mecanismoIdentificado: true`.
- `npm run gate` e `npm run pipeline:reconcile-gate` verdes em ambos os commits (784 testes JS/Vitest + suíte Python completa + build).
- Nenhuma pergunta desta investigação precisa de um novo checkpoint clínico do operador — a pendência A foi resolvida por evidência técnica/documental (fonte autoritativa + medição), não por julgamento clínico; a pendência B não foi fechada (permanece bloqueando), então não há decisão de "aceitar como está" a apresentar.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-10*

## Self-Check: PASSED

Todos os arquivos listados em Files Created/Modified existem no disco (`cid-corrections.json`,
`cid-divergencias.json`, `reconciliacao-sc7.md`, `test_reconcile_gate.py`, `STATE.md`); JSONs
validados com `json.load` sem erro (7 e 64 entradas respectivamente); ambos os hashes de commit
(`bba9620`, `b507866`) existem em `git log --oneline --all`; `uv run pytest` (todos os testes
Python) e `npm run pipeline:reconcile-gate` verdes após as mudanças.
