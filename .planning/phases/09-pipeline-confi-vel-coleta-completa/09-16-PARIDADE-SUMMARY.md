---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 16-PARIDADE
subsystem: pipeline
tags: [python, tabnet, reconciliacao, paridade, dt-inter, janela-competencia, sc-7, oraculo]

# Dependency graph
requires:
  - phase: 09-15-DT-INTER
    provides: "agregação por DT_INTER e o achado do oráculo truncado -- verificado aqui contra o dado real, e corrigido num ponto"
  - phase: 09-10-PROCEDIMENTO
    provides: "eixo PROC_REA=0408050012 do amputacao_mmii -- reconciliado aqui contra o oráculo qibr.def sobre o dado realmente coletado"
provides:
  - "PROVA do critério do operador: 134 pares (98 de AC/2019 + 36 da amostra vascular) com paridade EXATA contra um TabNet bem-formado, delta zero, sem nenhum tuning"
  - "MEDIÇÃO da lacuna da consulta ingênua, distribuída (mediana 5,51% em AC/2019; 3,09% na amostra vascular; max 100%), com a direção provada: o site NUNCA fica abaixo"
  - "oracle_scrape.py com janela de competência (ingênua vs bem-formada), retentativa e zero-legítimo de UF pequena"
  - "sih_pipeline.paridade: módulo que mede as duas comparações separadamente e emite justificativa legível por máquina na chave de sih_collection_status"
  - "Aposentadoria MEDIDA das 64 divergências de lote de cid-divergencias.json"
  - "Estado da recoleta registrado no repo (15/27 UFs, bloqueio de disco quantificado) e efeito do swap medido sem executá-lo"
affects: [upload de produção, fase de UI que for exibir a justificativa, 09-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Um número de oráculo só significa alguma coisa junto da JANELA que o produziu -- por isso janelaCompetencia/arquivosSubmetidos viajam com o valor, nunca só no nome do arquivo"
    - "Divergência (dado que não bate, precisa de desculpa) vs metodologia (dado que bate, precisa de explicação) -- a segunda vive em JSON medido, nunca numa lista de exceções aceitas"
    - "Ausência é zero OU falha dependendo do contexto, e a diferença precisa ser explícita: tabela com municípios e sem a UF pedida é zero; tabela sem município nenhum é malformada"
    - "Teste de laço nunca pode herdar do ambiente a guarda que ele não está testando"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/paridade.py
    - pipeline/sih/tests/test_paridade.py
    - pipeline/sih/tests/fixtures/oracle_ac_2019_bem_formado.json
    - pipeline/sih/reports/paridade-AC-2019-sc7.md
    - pipeline/sih/reports/paridade-AC-2019-sc7.json
    - pipeline/sih/reports/paridade-amostra-vascular.md
    - pipeline/sih/reports/recoleta-dt-inter.md
    - pipeline/sih/reports/substituicao-producao.md
    - pipeline/sih/reports/cid-divergencias-aposentadas.md
  modified:
    - pipeline/sih/src/sih_pipeline/oracle_scrape.py
    - pipeline/sih/tests/test_oracle_scrape.py
    - pipeline/sih/tests/test_reconcile_gate.py
    - pipeline/sih/tests/test_collect.py
    - scripts/catalog/cid-divergencias.json

key-decisions:
  - "O default de scrape_pairs continua INGÊNUO: a fixture congelada do gate SC-7 foi raspada assim, e mudar o default reescreveria o significado dela sem ninguém pedir"
  - "janela=1 (24 competências) e não 2: medido que a defasagem é <= 1 ano em 35.455.907 de 35.455.908 AIH; a janela=2 pegaria 1 registro a mais ao custo de 12 requisições por par"
  - "cid-divergencias.json esvaziado (64 -> 0) com base em três medições, não em opinião -- e o conteúdo integral fica no histórico do git"
  - "Produção NÃO foi tocada em escrita; o swap foi medido e está BLOQUEADO por dado, não por cautela: com 15/27 UFs ele apagaria 12 UFs"
  - "O bloqueio de disco não foi contornado: a guarda não foi afrouxada, nenhum arquivo do operador foi apagado, e o pico por UF é irredutível por construção da agregação por DT_INTER"

requirements-completed: []

# Metrics
duration: ~1h de código e medição + ~40 min de raspagem ao vivo do TabNet
completed: 2026-08-17
---

# Phase 9 Plan 16-PARIDADE: Paridade site × TabNet Summary

**O critério do operador — "quando user puxe dado tabnet e site lado a lado sejam iguais e se diferentes justificados" — está provado nas duas metades: 134 pares batem EXATO contra um TabNet bem-formado (delta zero, zero tuning), e a diferença contra a consulta ingênua está medida, distribuída e explicada por um mecanismo verificado em duas fontes independentes.**

## O resultado, em uma tabela

| Comparação | Medido | Resultado |
|---|---|---|
| **site × TabNet bem-formado** (submete as competências que fecham o ano) | 98 pares AC/2019 + 36 pares da amostra vascular | **134/134 EXATO, delta zero** |
| **site × TabNet ingênuo** (12 arquivos de um ano, a seleção padrão) | os mesmos 134 pares | site **maior**, mediana +5,51% (AC/2019) e +3,09% (vascular), **nunca menor** |

As duas **não** foram colapsadas numa só. A primeira é a prova de correção; a segunda é a
justificativa que o app precisa mostrar a um aluno.

## Como a segunda ponta foi construída (era o que faltava)

O `09-15` achou que `oracle_scrape.py` submetia só os 12 arquivos `nibr{AA}MM.dbf` do ano pedido
— medindo "internações de Y faturadas em Y", não o ano de atendimento. Ele registrou isso como
pendência fora de escopo. **Aqui isso virou a ferramenta central**, porque o TabNet tabula
`Coluna=Ano_atendimento`: submeter também as 12 competências de Y+1 e ler a coluna de Y produz,
do próprio TabNet, a medição bem-formada. As duas consultas saem do mesmo raspador:

```
janela=0  -> 12 arquivos -> consulta INGÊNUA (o que o aluno faz)
janela=1  -> 24 arquivos -> consulta BEM-FORMADA (fecha o ano de internação)
```

O `1` é medido, não escolhido: ver a correção do lag abaixo.

## Correção ao 09-15 — a defasagem passou de 1 ano

O `09-15-DT-INTER-SUMMARY.md` afirma, sobre ~2,2 milhões de registros amostrados, que a defasagem
`ANO_CMPT - ano(DT_INTER)` **"nunca passou de 1 ano"**. Com o dado real da recoleta (16× mais),
isso é **falso**:

| Defasagem | Registros | % |
|---|---|---|
| 0 anos | 33.187.451 | 93,6020% |
| 1 ano | 2.268.456 | 6,3980% |
| **2 anos** | **1** (em RO) | 0,0000028% |

A formulação correta é **"≤ 1 ano em 35.455.907 de 35.455.908 (99,999997%)"**. O efeito prático é
minúsculo e conhecido — a consulta com `janela=1` deixa de fora esse único registro — mas uma
absoluta que o dado não sustenta é exatamente o tipo de afirmação que esta fase pagou caro para
aprender a não fazer. `janela=2` o pegaria, ao custo de 12 requisições a mais por par; a escolha
de `janela=1` agora tem numerador e denominador em vez de um "nunca".

**O que o 09-15 acertou e se confirmou:** zero descarte de `DT_INTER` em **35.455.908** AIH
`IDENT='1'` reais — a guarda de 0,1% nunca chegou perto de disparar.

## A lacuna ingênua, distribuída (não uma média)

AC/2019, 98 pares, contra a consulta ingênua:

| min | p25 | **mediana** | p75 | p90 | max |
|---|---|---|---|---|---|
| 0,00% | 0,00% | **+5,51%** | +13,68% | +24,47% | +100,00% |

- Site maior em **65** pares, igual em **33**, **menor em NENHUM**.
- Totais: site 11.211 · bem-formado 11.211 · ingênuo 10.265 (**+946, +9,22%**).

A mediana de +5,51% conversa com a defasagem nacional medida na coleta (**6,398%** das AIH
faturadas no ano seguinte): duas fontes independentes, mesmo mecanismo, mesma ordem de grandeza.

**Onde dói mais** (o que o app vai ter que explicar): agravos de contagem pequena, onde um punhado
de internações vira dezenas de por cento — `infeccao_meningococica` 2 vs 1 (+100%),
`encefalite_viral` 11 vs 7 (+57%). E cerebrovascular, que é o que a liga olha:
`acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` 161 vs 122 (**+32%**), `infarto_cerebral`
294 vs 262 (+12,2%).

## Amostra vascular (nível 1 do `collection-order.json`)

| UF/ano | pares | exatos | site | ingênuo | mediana da lacuna |
|---|---|---|---|---|---|
| AC/2015 | 6 | **6/6** | 490 | 468 | 2,60% |
| AP/2019 | 6 | **6/6** | 432 | 423 | 1,82% |
| DF/2022 | 6 | **6/6** | 3.300 | 3.103 | 5,42% |
| PE/2019 | 6 | **6/6** | 17.832 | 17.193 | 6,17% |
| PE/2024 | 6 | **6/6** | 16.590 | 16.198 | 3,04% |
| RR/2019 | 6 | **6/6** | 528 | 508 | 0,82% |

UF pequena (AP, RR), a maior já coletada (PE, 41× o AP), quatro anos. **36/36 exatos.**

`amputacao_mmii` (o sétimo do nível 1, eixo de PROCEDIMENTO) foi conferido contra o oráculo
`qibr.def` sobre o dado **realmente coletado**: **36/39 pares exatos** em AC/RR/DF × 13 anos, com
**AC/2019 = 66 = 66** — o alvo que o brief mandou confirmar. Os 3 não-exatos são todos 2025 e
todos positivos, porque o script legado (`YEARS = range(2013, 2026)`) não submete competência de
2026, justamente onde nossa cauda acrescenta dado real.

## A justificativa, legível por máquina — e o lugar já existia

`to_justificativa_json()` emite entradas na chave
`(disease_id, medida, grao, local, ano)` — que é **exatamente a PK de `sih_collection_status`** —
com `divergencia_pct` e `divergencia_razao`, **as colunas que aquela tabela já tem**
(`20260805000000_sih_v3_schema.sql`, linhas 55-56).

**Não foi preciso inventar schema.** O grão da tabela é o mesmo grão em que o aluno faz a
comparação lado a lado. Gravar lá é trabalho do `upload.py`, cujos caminhos de COPY/swap estão
fora do escopo deste plano; os JSONs em `reports/paridade-*.json` são a fonte pronta, e a frase
única que o app mostra vive em `paridade.RAZAO_DIVERGENCIA_JANELA`.

## As 64 divergências de lote, aposentadas com medição

`scripts/catalog/cid-divergencias.json`: **64 → `[]`**. Três provas, não uma opinião:

1. **Nenhuma é consultada** — com o arquivo vazio a suíte dá `318 passed, 1 skipped` e
   `catalog:validate OK`, idêntico. Congelado em
   `test_gate_paridade_bem_formada_nao_depende_de_nenhuma_divergencia_de_lote`.
2. **O delta alegado é zero medido direito** — as 61 entradas de lote batem **EXATO** nos 98
   pares de AC/2019 contra o oráculo bem-formado.
3. **O que elas mediam era a lacuna ingênua** — correlação de Pearson **0,777** entre o delta
   alegado e a lacuna ingênua medida hoje (medianas 8,70% vs 8,11%; 10 de 60 batem até
   0,01 p.p.). Não é identidade, e não deveria ser: os deltas originais foram medidos contra
   agregados por `ANO_CMPT`, uma terceira quantidade.

As outras 3 também estavam mortas (`tuberculose_miliar`, colisão 9/77 resolvida no 09-08; e as
duas `PENDENTE_*`, ambas já com `bloqueiaUpload: false`).

Registro completo em `reports/cid-divergencias-aposentadas.md`; conteúdo integral no git.

## Estado real da recoleta — parada, e por quê

**15 das 27 UFs** (`agregado_reciclado`); MS `falhou` com 71 arquivos pendentes (retomável, 90 já
baixados e preservados); **11 bloqueadas pela guarda de disco**.

Cobertura dita sem suavizar: 2.415/4.347 arquivos (55,6%) mas só **18,9% do volume nacional** —
faltam SP, MG, BA, RS. **Nenhuma conclusão nacional sai deste recorte, e nenhuma foi tirada.**

O bloqueio é físico: **372 MB livres** contra um pico exigido de **2.508 MB** (SP). E o pico é
**irredutível** — agregar a UF em pedaços quebraria a agregação por `DT_INTER`, como o próprio
`collect.py` documenta (um ano de internação se monta de mais de um ano de competência).

**Não foi contornado:** a guarda não foi afrouxada, nenhum arquivo do operador foi apagado.
`reports/recoleta-dt-inter.md` lista os caches regeneráveis que destravariam (~2,7 GB em dois
diretórios) como **decisão do operador**.

## Produção: NÃO carregada, e o swap está bloqueado por dado

`upload.swap()` faz `TRUNCATE` + `INSERT ... SELECT` — **substituição total, não merge**. Com
15/27 UFs:

| | hoje | se o swap rodasse | efeito |
|---|---|---|---|
| chaves | 207.664 | 139.269 | **−32,9%** |
| internações | 308.872.790 | 68.485.708 | **−77,8%** |
| UFs | 27 | 15 | **−12** |

**Efeito real do `DT_INTER`, isolado nas mesmas 15 UFs:** +233 chaves (+0,17%) e **+1.102.539
internações (+1,64%)**, com saldo não-uniforme (PE +147.725 … AC **−1.655**).

**Achado de apoio:** sob `ANO_CMPT`, a série de PE tinha um vale em 2014 (479 mil, entre 537 e
508 mil) que **desaparece** sob `DT_INTER` (544 mil). Não era queda de internações em Pernambuco:
era atraso de faturamento lido como epidemiologia. O serrilhado médio das 15 UFs cai de 7,79%
para 6,42% (9 de 15 mais suaves; 6 marginalmente piores, ≤0,81 p.p.). **Evidência de apoio, não
prova** — a prova são os 134 pares exatos.

## Resíduo aberto, registrado em vez de arredondado

Os agregados `ANO_CMPT` das 27 UFs somam **207.667** chaves e **308.872.793** internações;
produção tem **207.664** e **308.872.790**. Diferença de **exatamente 3** nas duas medidas.
Não investigado (custo alto, efeito ~1e-8) e **não explicado**. Fica como resíduo aberto porque
foi exatamente o hábito de arredondar para "bate" que custou duas semanas a esta fase.

## Invariantes preservados

`IDENT='1'`, `_blank_to_null`, validação de registro corrompido, município em branco com fallback
`UF_ZI`, self-cura do ledger, stall guard, paginação com `order=`, eixo `PROC_REA` do
`amputacao_mmii`: **todos intactos** — `download.py`, `ledger.py`, `aggregate.py`, `partitions.py`,
`upload.py`, `codigos.py`, `population.py` e `supabase/` **não foram modificados**. O gate SC-7
congelado continua 98/98.

## Task Commits

| # | commit | o quê |
|---|---|---|
| 1 | `d6156ce` | testes de laço do collect param de depender do disco ambiente |
| 2 | `1fd523c` | oráculo ganha janela de competência (ingênua vs bem-formada) |
| 3 | `77d0c9c` | módulo `paridade` — as duas comparações, separadas |
| 4 | `ea0da97` | retentativa no oráculo (o TabNet devolve o formulário de forma intermitente) |
| 5 | `cc0a8b9` | estado medido da recoleta + a correção do lag |
| 6 | `4d2c964` | **a prova: 98/98 exato em AC/2019** |
| 7 | `5673cbd` | gate novo — paridade bem-formada do ano de admissão |
| 8 | `81522f1` | ausência da UF no TabNet é zero legítimo, não falha |
| 9 | `0e13269` | aposenta as 64 divergências de lote |
| 10 | `edc2e2f` | amostra vascular 36/36 + efeito medido do swap |

## Deviations from Plan

Não havia PLAN.md — o brief era a especificação.

### 1. [Rule 3 - Blocking] `npm run gate` estava vermelho por disco, não por código
4 testes `test_collect_all_*` usavam `shutil.disk_usage` real e quebravam com 375 MB livres.
Corrigido tornando-os herméticos (`_disco_generoso`). **A guarda de produção não foi tocada** e
continua provada nos dois sentidos com disco falso. Commit `d6156ce`.

### 2. [Rule 1 - Bug] Retentativa no oráculo
Na primeira corrida real, a primeira requisição voltou com a página do `.def` (44 KB, sem tabela);
repetida, devolveu 1.434 linhas. Sem retentativa, ~20 min de raspagem morrem por um soluço.
Commit `ea0da97`.

### 3. [Rule 1 - Bug] Zero legítimo de UF pequena
AP/2019 derrubava a medição inteira porque o TabNet omite a linha de município quando o valor é
zero. Era exatamente o caso de UF pequena que o brief pediu para incluir. Commit `81522f1`.

### 4. `oracle_scrape.py` entrou no escopo
O 09-15 o declarou "fora do file_scope". Este brief dá a reconciliação inteira, e sem consertar o
oráculo não existe ponta bem-formada para provar paridade contra. `cli.py` **não** foi tocado
(ele declara dono único, 09-04): o módulo `paridade` roda por `python -m`.

## Issues Encountered

- **A recoleta não fechou** e não tinha como fechar: 372 MB livres contra 2.508 MB de pico. É o
  único item do brief que não foi entregue, e a razão é física, não de método.
- **Raspagem lenta:** 196 requisições levaram ~25 min (as de `janela=1` submetem 24 arquivos e o
  TabNet demora mais). A amostra foi dimensionada em cima disso.
- **Contagem de linhas dos agregados engana:** somar `grao=uf` por arquivo dá 481.135 contra
  207.664 em produção, porque o arquivo de cada UF carrega linhas `local=residencia` de
  residentes de OUTRAS UFs. A comparação certa é por chave mesclada — refeito antes de reportar.

## Next Phase Readiness

1. **Liberar ~2,1 GB e rodar `npm run pipeline:collect`** até as 27 UFs. É o gargalo de tudo.
2. **`npm run pipeline:partitions`** (as partições antigas derivam da era `ANO_CMPT`).
3. **Só então `pipeline:upload`.** Antes disso o swap destrói dado.
4. **UI:** consumir `reports/paridade-*.json` / `RAZAO_DIVERGENCIA_JANELA` para explicar a
   diferença no ponto de uso; o destino natural em banco é `sih_collection_status.divergencia_pct`
   / `.divergencia_razao`, que já existem.
5. **Repetir a paridade em SP/MG** quando forem coletadas — a prova atual não cobre UF grande de
   verdade.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-17*

## Self-Check: PASSED

Todos os 9 arquivos declarados em `key-files.created` existem em disco; todos os 10 commits da
tabela existem no git. Verificado por `[ -f ]` e `git log --oneline --all | grep` em 2026-08-17.
