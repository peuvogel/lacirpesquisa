---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 15-DT-INTER
subsystem: pipeline
tags: [python, pyarrow, sih-rd, dt-inter, epidemiologia, reconciliacao, sc-7, janela-temporal]

# Dependency graph
requires:
  - phase: 09-07-IDENT-FIX
    provides: "aggregate.py com o filtro IDENT='1' -- preservado e reprovado por regressão aqui"
  - phase: 09-10-PROCEDIMENTO
    provides: "eixo de procedimento (PROC_REA=0408050012) e a medição 45+20=65 vs oráculo 66 que este trabalho fecha em 66=66"
  - phase: 09-04-COLETA-INCREMENTAL
    provides: "collect.py (laço por UF, guarda de disco, reciclagem do bruto) -- estendido aqui só para persistir a defasagem medida"
provides:
  - "Agregação por DT_INTER (data de internação) em vez de ANO_CMPT (competência de faturamento) -- o ano de cada linha passa a ser o ano em que a hospitalização ACONTECEU"
  - "Separação explícita entre janela de ADMISSÃO (2013-2025, publicação) e janela de COMPETÊNCIA (2013-01 a 2026-05, coleta), com a cauda de 2026 tratada como oportunista (aviso ruidoso, nunca falha) sem enfraquecer a garantia SC-1/PIPE-01 dos 4.212 obrigatórios"
  - "ACHADO CENTRAL: o resíduo do SC-7 nunca existiu -- era artefato de comparar um agregado por competência contra um oráculo por atendimento truncado a uma competência. Alinhadas as pontas, o gate vai de exato=34/explicado=61/inexplicado=3 (ok=False) para exato=98/explicado=0/inexplicado=0 (ok=True), sem nenhuma correção de faixa CID nova"
  - "Guarda de descarte de DT_INTER (_MAX_TAXA_DESCARTE_DT_INTER) com semântica documentada e baseline nacional medido"
  - "collect.py persiste por UF o histograma de defasagem medido, na única janela em que esse dado existe (antes da reciclagem do bruto)"
affects: [09-14, upload de produção, cid-divergencias.json]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Duas janelas temporais nomeadas separadamente: a de PUBLICAÇÃO (ano do evento clínico, do schema-v3.json) e a de COLETA (competências de faturamento necessárias para fechar a primeira) -- a segunda é consequência derivada e medida da primeira, nunca um alargamento"
    - "Conjunto obrigatório vs. oportunista na enumeração: tolerância por NOME (o conjunto de cauda), jamais uma banda global -- ausência na cauda vira aviso ruidoso, ausência no obrigatório continua derrubando a corrida"
    - "Reconciliação só é válida quando as duas pontas medem a MESMA população -- antes de aceitar ou explicar um resíduo, verificar o que o oráculo de fato tabula (quais arquivos ele submete), não só o que ele diz tabular"

key-files:
  created:
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-15-DT-INTER-SUMMARY.md
    - pipeline/sih/tests/fixtures/rdac_admissao_2019.parquet
  modified:
    - pipeline/sih/src/sih_pipeline/aggregate.py
    - pipeline/sih/src/sih_pipeline/enumerate.py
    - pipeline/sih/src/sih_pipeline/collect.py
    - pipeline/sih/tests/test_aggregate.py
    - pipeline/sih/tests/test_enumerate.py
    - pipeline/sih/tests/test_collect.py
    - pipeline/sih/tests/test_partitions.py
    - pipeline/sih/tests/test_reconcile.py
    - pipeline/sih/tests/test_reconcile_gate.py
    - pipeline/sih/tests/fixtures/rdac_2019.parquet

key-decisions:
  - "Janela de competência cortada em 2026-05, medida e não suposta: a defasagem decai por fator de ~4 a ~8 por mês (AC e SP), e a competência 2026-06 existe para 25 das 27 UFs -- incluí-la faria duas UFs falharem por um arquivo que vale 0,007% do ano de admissão 2025"
  - "DT_INTER ausente/malformado é descarte contado e taxa-guardado (0,1% da população IDENT='1'); dia impossível (20250230) NÃO é descarte, porque o ano é inequívoco e é só ele que a agregação usa; ano válido fora da janela D-11 é `fora_da_janela`, jamais descarte (senão a guarda estouraria em toda UF por causa das internações de 2026 nos arquivos de cauda)"
  - "Filtro IDENT='1' movido para ANTES da leitura de data, para que o denominador da guarda nova conte só AIH real -- o registro corrompido do DBC tem IDENT vazio junto com DT_INTER e já era excluído antes"
  - "Gate SC-7 continua usando uma fixture de COMPETÊNCIA 2019, porque é isso que o oráculo congelado mede; a cobertura do ano de ADMISSÃO completo é provada separadamente contra o oráculo qibr.def, que submete os 156 arquivos dos 13 anos"
  - "As ~61 entradas de divergência de lote em cid-divergencias.json ficaram INERTES e devem ser aposentadas pelo operador -- esta plan não as remove (catálogo fora do file_scope) mas registra que a explicação não explica mais nada"

requirements-completed: []

# Metrics
duration: ~4h de trabalho de código e medição (a recoleta nacional roda em segundo plano, ver "Estado real")
completed: 2026-08-17
---

# Phase 9 Plan 15-DT-INTER: Agregação por data de internação Summary

> **CORREÇÃO (09-16, 2026-08-17).** Duas afirmações deste documento foram medidas contra a
> recoleta real e uma delas não se sustenta:
>
> - ❌ *"a defasagem **nunca passou de 1 ano** em ~2,2 milhões de registros medidos"* — com
>   35.455.908 AIH reais (16× mais dado), existe **1 registro em RO com defasagem 2**. O correto é
>   "≤ 1 ano em 35.455.907 de 35.455.908 (99,999997%)".
> - ✅ *"zero descarte de `DT_INTER`"* — **confirmado** nas 15 UFs fechadas, 35.455.908 AIH.
> - ✅ *`amputacao_mmii` AC/2019 = 66 = 66* — **confirmado** contra o dado realmente coletado,
>   junto com mais 35 pares exatos (36/39 em AC/RR/DF × 13 anos).
>
> Além disso, a pendência que este SUMMARY deixou aberta (*"`oracle_scrape.py` precisa de
> conserto"*) foi resolvida no 09-16 e virou a ferramenta que prova a paridade.
> Ver `09-16-PARIDADE-SUMMARY.md` e `pipeline/sih/reports/recoleta-dt-inter.md`.

**A agregação passa a chavear o ano por `DT_INTER` (quando a internação aconteceu) em vez de `ANO_CMPT` (quando a AIH foi faturada) — e, ao alinhar o agregado e o oráculo para medirem a mesma população, o resíduo do SC-7 que este projeto carregava havia duas semanas desapareceu por inteiro: 98 de 98 pares batem com delta ZERO, sem nenhuma correção nova.**

## Achado central — o resíduo do SC-7 nunca existiu

Desde o spike de 2026-08-04, o SC-7 carregava um viés **sempre positivo** (mediana +4,14% → +3,45% → +5,10% → +7,90% conforme a metodologia foi refinada), atribuído a "divergência de lote por competência de processamento" e formalizado em ~61 entradas de `scripts/catalog/cid-divergencias.json`. Esse resíduo motivou um checkpoint clínico, dois bloqueios de upload e uma rodada inteira de investigação.

A troca de `ANO_CMPT` por `DT_INTER` foi pedida por motivo epidemiológico independente. Medido o gate depois dela, o resíduo **piorou**: exatos 34 → 33, mediana +4,31% → +5,51%. Em vez de aceitar, ajustar ou tunar, foi medido o mecanismo.

**O oráculo do eixo CID estava truncado a UM ano de competência.** `oracle_scrape.py` submete ao TabNet apenas os 12 arquivos `nibr{AA}MM.dbf` do ano pedido e lê a coluna `Ano_atendimento`. Isso **não** mede o ano de atendimento: mede "internações do ano Y que foram faturadas na competência Y". Toda internação de Y faturada em Y+1 fica de fora do próprio oráculo.

O contraste é medido, não inferido: `coleta_vascular_amputacao.py` (o oráculo do eixo de PROCEDIMENTO, `sih/cnv/qibr.def`) submete os 156 arquivos dos 13 anos, e portanto mede o ano de atendimento de verdade.

Alinhadas as duas pontas para medirem a MESMA população, sobre a fixture real de AC (44.589 registros), sem tunar nada:

| Cenário (mesmo código, muda só a chave de ano / o recorte) | Exatos | Delta mediano |
|---|---|---|
| `ANO_CMPT=2019` (produção até esta correção) | 34/98 | +4,31% |
| `DT_INTER=2019` completo (competências 2019+2020) | 33/98 | +5,51% |
| **`DT_INTER=2019` na competência 2019 (o que o oráculo mede)** | **98/98** | **+0,00%** |

**98 de 98 pares, delta exatamente zero.** Nenhuma correção de faixa CID foi adicionada, alterada ou removida; as existentes continuam load-bearing (sem elas o gate cai para 96/2, provado em `test_gate_falha_se_cid_corrections_mudar`).

**O que isso significa, sem suavizar:** o matcher CID, o mapa da Lista Morb, o filtro `IDENT='1'` e a atribuição territorial estavam corretos o tempo todo. O que estava errado era a comparação. E agora isso está *provado* em 98 categorias independentes, com valores de 1 a mais de 3.000 — não apenas plausível.

## A defasagem, medida antes de qualquer decisão de janela

Nada aqui foi suposto. Antes de escolher a janela de coleta, a defasagem `ANO_CMPT - ano(DT_INTER)` foi medida contra dado real:

| Fonte | n (`IDENT='1'`) | `DT_INTER` malformado | defasagem máxima |
|---|---|---|---|
| AC competência 2025 (12 arq.) | 61.479 | **0** | 1 ano |
| AC competência 2019 (12 arq.) | 44.563 | **0** | 1 ano |
| AC competência 2020 (12 arq.) | 43.071 | **0** | 1 ano |
| SP competências 2026-01..06 (6 arq.) | ~1.455.000 | **0** | 1 ano |
| DF 2017-08 + PR 2020-04 | 71.409 | **0** | 1 ano |
| **RR completa, 13 anos + cauda (161 arq.)** | **529.614** | **0** | **1 ano** |

Decaimento da cauda por mês de competência do ano seguinte (fração do arquivo que é internação do ano anterior):

- **AC:** jan 58,70% · fev 16,39% · mar 6,25% · abr 0,46% · mai 0,02% · jun 0,05% · jul-dez 0,00%
- **SP:** jan 29,60% · fev 8,46% · mar 1,88% · abr 0,25% · mai 0,030% · jun 0,007%

Duas propriedades importam e as duas são consistentes nas duas UFs, apesar de SP ter 29,20× o volume do AC: a defasagem **nunca passou de 1 ano** em ~2,2 milhões de registros medidos, e a cauda **decai por um fator de ~4 a ~8 por mês**.

## A janela que isso obriga, e o que acontece com a ponta recente

O que antes era uma janela só (2013-2025) virou duas, nomeadas separadamente em `enumerate.py`:

| Janela | O que limita | Valor |
|---|---|---|
| **Admissão** (publicação) | o `ano` de cada linha agregada | 2013-2025 (`schema-v3.json`, inalterada) |
| **Competência** (coleta) | quais `RD{UF}{AA}{MM}` baixar | 2013-01 … 2026-05 |

A janela D-11 **não foi alargada** — ela passou a significar o que sempre deveria ter significado (anos de internação). A de competência é consequência derivada: uma internação de dezembro/2025 só existe no arquivo de competência 2026-01.

- **Obrigatório:** 4.212 arquivos (2013-2025). Ausência continua sendo `SystemExit` (SC-1/PIPE-01), com a barra exatamente igual de dura.
- **Cauda oportunista:** 135 arquivos (27 UFs × 2026-01..05). Ausência vira **aviso ruidoso em stderr**, nunca falha — o DATASUS publica competência mês a mês, então "ainda não existe" é o estado normal desses arquivos. A tolerância é por NOME, jamais uma banda global.

**Por que o corte é 2026-05 e não 2026-06** (verificado ao vivo no FTP): a competência 2026-06 existe para **25 das 27 UFs**. Incluí-la faria duas UFs falharem a coleta inteira por um arquivo que contribui 0,007% (17 de 245.252 registros em SP). O corte em 2026-05 está completo para as 27 UFs.

**A ponta incompleta, dita com número em vez de adjetivo.** O ano de admissão 2025 é o único cuja completude depende da cauda. Com a competência coletada até 2026-05, o que fica de fora é limitado por cima pela massa do primeiro mês não coletado: **17 registros em 245.252 (0,007%) na maior UF do país**, mais o resto de uma série que decai por fator ~4 (≈ +6 registros). Os anos 2013-2024 não têm essa exposição: cada um tem os 12 meses de competência do ano seguinte inteiramente coletados.

Isso **não** é a mesma coisa que dizer "2025 está completo". A representação honesta desse estado é exatamente o que o D-13/D-14 já desenhou (`sih_collection_status` com `ano` na chave, para que "coleta parcial no tempo" não fique indistinguível de "completa"). Esta plan **mede o número que esse mecanismo precisa carregar**; preenchê-lo é do `upload.py`, fora do file_scope aqui. Registrado como handoff explícito, não como pendência escondida.

## Validação contra oráculo externo independente (dado real, zero tuning)

### `amputacao_mmii`, AC/2019 — a medição que o brief apontou como alvo

Contra o oráculo `qibr.def` (que submete os 156 arquivos dos 13 anos, medindo o ano de atendimento de verdade), sobre os mesmos arquivos reais, mudando só a chave de ano:

| Medição | Valor | Delta vs oráculo (66) |
|---|---|---|
| por `ANO_CMPT` (produção até aqui) | 50 | **-24,2%** |
| por `DT_INTER`, só a competência 2019 | 45 | -31,8% |
| **por `DT_INTER`, competências 2019+2020** | **66** | **EXATO** |

O 09-10 tinha chegado a 45+20=65 lendo só 2 meses de 2020; com os 12 meses, fecha em 66. Sem nenhum ajuste de código.

### Série completa 2013-2025 por UF (à medida que a recoleta entrega)

Contra o mesmo oráculo legado, ano a ano, grão UF, local ocorrência:

| UF | pares 2013-2024 | exatos | 2025 |
|---|---|---|---|
| DF | 12 | **12/12 exatos** | agregado 435 vs oráculo 417 (+18) |
| RR | 12 | **12/12 exatos** | agregado 32 vs oráculo 26 (+6) |

**24 de 24 pares exatos ao registro, em 12 anos e 2 UFs.** Sob `ANO_CMPT`, a mesma comparação oscilava entre -24,2% e +16,7% ano a ano (ver a tabela de AC no 09-10-PROCEDIMENTO-SUMMARY).

O 2025 diverge **para mais**, e por razão medida, não desconhecida: o script legado usa `YEARS = range(2013, 2026)`, ou seja submete competências 2013-2025 e **nenhum arquivo de 2026** — o oráculo dele é truncado em 2025 exatamente onde a nossa cauda acrescenta dado. Nosso 2025 é *mais* completo que o oráculo, não menos. É a confirmação independente de que a cauda de competência funciona e é necessária.

## O que mudou no código

### `aggregate.py`
- `NEEDED_COLUMNS` ganha `DT_INTER`; o `ano` de cada `Row` vem de `_ano_de_dt_inter`.
- `_ano_de_dt_inter`: validação estrutural explícita (8 dígitos, mês 1-12, dia 1-31, ano em faixa de plausibilidade larga). **Semântica documentada, nunca um `try/except` mudo.**
- **Descarte guardado:** `DT_INTER` ausente/malformado em AIH `IDENT='1'` é contado e, acima de `_MAX_TAXA_DESCARTE_DT_INTER` (0,1% da população `IDENT='1'`, espelhando `_MAX_TAXA_DESCARTE`), levanta `ValueError`.
- **Duas coisas que deliberadamente NÃO são descarte**, e sem essa distinção a guarda não funcionaria:
  - *Dia impossível* (`20250230`): o ano é inequívoco e é só ele que a agregação usa. Recusar o registro jogaria fora uma internação real por erro de digitação num campo que nem é lido.
  - *Ano válido fora da janela D-11*: os arquivos de competência 2026 são feitos majoritariamente de internações de 2026. Contá-las como defeito estouraria a guarda em toda UF por dado perfeitamente saudável — e a faria deixar de pegar o defeito que existe para pegar. Vai para `fora_da_janela` (medido em RR: 10.271 registros).
- **`DT_INTER` nunca recebe cast eager** (ao contrário das 4 colunas numéricas): a validação é por registro. Um cast vetorizado transformaria um único valor malformado num `ArrowInvalid` que derruba a UF inteira — a classe de falha que 09-04-FIX-AGREGACAO-VAZIO e FIX-DBC-CORROMPIDO passaram esta fase consertando.
- **Ordem dos filtros:** `IDENT='1'` passou a rodar ANTES da leitura de data. O conjunto que chega à classificação é idêntico (portanto `_MAX_TAXA_DESCARTE` mede o que sempre mediu), mas o denominador da guarda nova passa a contar só AIH real — o registro corrompido do DBC tem `IDENT` vazio junto com `DT_INTER` e já era excluído antes.
- **`ANO_CMPT` permanece** em `NEEDED_COLUMNS`: sustenta a guarda de registro desalinhado de `download.py` (`_valida_registros_alinhados` roda os mesmos casts) e o histograma de defasagem.
- `stats` opcional: devolve `total`, `total_ident_1`, descartes e o histograma de defasagem sem inflar o schema de `Row` (que `partitions.py`/`upload.py` consomem e que esta plan não podia tocar).

### `enumerate.py`
`expected_file_names_obrigatorios()` (4.212) + `cauda_file_names()` (135) → `expected_file_names()` (4.347). `assert_no_missing` separa os dois. `YEARS` cobre 2013-2026 só para a **listagem** do FTP — listar não é prometer — o que faz `download.py` enxergar a cauda **sem uma linha de mudança** nele (arquivo fora do file_scope).

### `collect.py`
`collect_uf` grava as estatísticas medidas no `CollectLedger` **antes** de `_reclaim_raw_parquet`. É a única janela em que esse dado existe: o agregado que sobrevive não carrega `DT_INTER` nem `ANO_CMPT`. Sem isso, responder "a cauda foi suficiente?" custaria re-baixar ~8,8 GB — exatamente o preço que o 09-10 pagou por não ter preservado `PROC_REA`. `BYTES_PER_RATIO_UNIT_SEED` escalado por 161/156 (a janela cresceu 5 arquivos por UF, e uma guarda de disco que ignora arquivos que ela mesma manda baixar projeta por baixo).

## Invariantes preservados, provados por regressão

Nenhum destes foi regredido; cada um tem teste próprio rodando sobre a suíte:

- **`IDENT='1'` só** (`53b7323`) — `test_ident_5_continua_excluido_com_o_ano_vindo_de_dt_inter`, mais o teste real sobre AC/2019 (total 44.613, **inalterado**: os mesmos registros, só atribuídos ao ano certo).
- **Semântica de `_blank_to_null`** (`2516c45`) — `internacoes` sempre conta, `valor_total`/`dias_permanencia` somam só a parte conhecida, `MORTE` vazia nunca vira óbito.
- **Registro corrompido do DBC** — `test_registro_corrompido_do_dbc_tudo_vazio_continua_excluido_sem_quebrar`.
- **Município em branco/malformado + fallback `UF_ZI`** (`ca78300`) — suíte de município intacta, incluindo a prova sobre o arquivo real de PR.
- **Eixo de procedimento** (`PROC_REA = 0408050012`) — preservado e agora reconciliando EXATO.
- Guardas de download, self-cura do ledger, stall guard, paginação: intocadas (`download.py`/`ledger.py` não foram modificados).

**Mudança de comportamento deliberada, registrada em vez de escondida:** `ANO_CMPT` vazio já não exclui o registro. Antes ele era a fonte do ano; agora o ano vem de `DT_INTER`, então uma AIH real com competência em branco **conta**. Descartá-la seria perder um evento clínico por causa de um campo administrativo ausente. Teste: `test_ano_cmpt_vazio_nao_derruba_aih_real_com_dt_inter_valido`.

## A divergência de lote, re-examinada e dita sem rodeio

O brief pediu para verificar se a explicação de lote ainda se aplica, e para não deixar de pé uma explicação que não explica mais nada. **Ela não se aplica mais.**

O mecanismo (`ANO_CMPT` vs `DT_INTER`) era real, mas o diagnóstico da direção estava errado: supunha-se que o agregado estava errado e o oráculo certo. Na verdade **nenhum dos dois** media um ano de atendimento completo — o agregado media competência, e o oráculo media atendimento truncado a uma competência. Alinhados, o delta é zero em 98 de 98 pares.

Consequência: as ~61 entradas de "divergência de lote por competência de processamento" em `scripts/catalog/cid-divergencias.json` descrevem um resíduo que, medido corretamente, **não existe**. Elas ficaram **inertes** — nenhuma é consultada, porque nenhum par tem delta não-zero. Esta plan não as remove (`scripts/catalog/` está fora do file_scope, e a decisão é do operador), mas registra aqui, no gate e no SUMMARY que elas devem ser aposentadas. Deixá-las de pé como se explicassem algo seria manter no repositório exatamente o tipo de razão-escrita-que-não-prova-nada que a Fase 8 e a Fase 9 gastaram meses eliminando.

Os 3 pares que restavam `inexplicado` (`doenca_de_alzheimer`, `tuberculose_do_sistema_nervoso`, `tuberculose_pulmonar`, com deltas +50%/+50%/+12,12% sobre denominadores de 4/2/33) batem **exato** agora. Não foram tunados: o delta que tinham era a mesma diferença de população que afetava todo o resto, só mais visível em contagem pequena.

## Estado real da recoleta (honesto, não projetado)

A recoleta nacional é obrigatória e não evitável: os agregados persistidos carregavam `ano` derivado de `ANO_CMPT` e o parquet bruto já tinha sido reciclado — não há como recomputar sem re-baixar (~8,8 GB, agora 4.347 arquivos).

**No momento em que este SUMMARY foi escrito, a corrida está EM ANDAMENTO** (`nohup`, destacada, retomável por UF).

### Andamento da recoleta

Ordem `UF_ORDER` (menor → maior): DF · RR · AP · SE · AC · AL · TO · RO · RN · PB · PI · AM · ES · MS · MT · PE · RJ · CE · PA · GO · MA · SC · PR · RS · BA · MG · SP.

Ritmo medido: ~8 arquivos/min (dominado por `REQUEST_DELAY_SEC=1.0` + rede do DATASUS) → a corrida completa dos 4.347 arquivos leva da ordem de 8-10 horas. A retomada é por UF e não re-baixa nada já concluído: basta reexecutar `npm run pipeline:collect`.

| UF | status | arquivos | registros | linhas | descarte `DT_INTER` | fora da janela | defasagem |
|---|---|---|---|---|---|---|---|
| DF | concluída | 161 | — | 145.360 | 0 | — | máx. 1 ano |
| RR | concluída | 161 | 529.615 | 37.821 | **0** | 10.271 | `{0: 472.103, 1: 57.511}` |
| demais 25 | em andamento | — | — | — | — | — | — |

**Zero descarte de `DT_INTER` e zero defasagem ≥ 2 anos em toda UF fechada até aqui** — o baseline nacional que a guarda `_MAX_TAXA_DESCARTE_DT_INTER` supunha está se confirmando na corrida real, não só nas amostras.

**Estado preservado antes de resetar (nada apagado):**
- `~/.lacir/sih-cache/agregados-pre-dt-inter/` — os 27 agregados da era `ANO_CMPT` + `collect_state.json` (é a fonte do que está em produção hoje)
- `~/.lacir/sih-cache/ledger-pre-dt-inter/` — `files.json` da corrida anterior
- `~/.lacir/sih-cache/ledger-backup-pre-proc/` — intocado (auditoria do 09-10)
- Removido **de propósito**: `~/.lacir/sih-cache/particoes/` — artefato regenerável derivado dos agregados da era `ANO_CMPT`; reaproveitá-lo seria servir dado com o ano errado. `partitions.py` o regenera.

## Bloqueios abertos

1. **Disco.** Livre no início da corrida: **2,4 GB** (o brief falava em ~4,4 GB; o disco encolheu desde então). A guarda projeta MG em 2,33 GB e SP em 2,51 GB (projeção + margem de 500 MB) — as duas maiores UFs provavelmente serão **recusadas** com `DiscoInsuficienteError`, que é o comportamento CORRETO (para a corrida limpo em vez de arriscar o disco de boot). **Não foi contornado**: a guarda não foi afrouxada e nenhum arquivo do operador foi apagado para abrir espaço. Liberar ~1 GB (há 1,2 GB em `~/Library/Caches/com.todesktop.*/ShipIt`, cache de auto-update regenerável) destrava as duas; a retomada é por UF e não re-baixa nada já concluído.
2. **Produção NÃO foi re-carregada**, conforme instrução explícita do brief. O dado novo fica em `~/.lacir/sih-cache/agregados/` aguardando autorização do operador para um `upload.py` novo.
3. **09-14 continua bloqueado** pelo mesmo motivo do 09-10-PROCEDIMENTO (não pode apagar `sih_metric_muni` antes de `amputacao_mmii` existir no caminho novo em produção).

## Task Commits

1. `2edf1c4` — feat(09-15): separa janela de admissão da janela de competência na enumeração
2. `5607324` — feat(09-15): agrega por DT_INTER (data de internação), não por ANO_CMPT
3. `55dfdbb` — feat(09-15): collect persiste a defasagem medida antes de reciclar o bruto

## Deviations from Plan

Não havia PLAN.md — o brief do coordenador era a especificação. Desvios em relação a ele:

### 1. [Rule 3 - Blocking] `test_partitions.py` e `test_reconcile.py` fora do file_scope nomeado
- **Causa direta:** `NEEDED_COLUMNS` passou a exigir `DT_INTER` (quebra a tabela sintética de SP de `test_partitions.py`, mesma classe de correção que o `PROC_REA` do 09-10) e a composição do SC-7 mudou (`test_reconcile.py` congela o mesmo número do gate).
- **Correção:** coluna `DT_INTER: ["20190315"]` na fixture sintética (mesmo ano que `ANO_CMPT` já declarava, zero mudança de comportamento); composição esperada atualizada de 34/61/3 para 98/0/0 e código de saída de 1 para 0.
- **Committed in:** `5607324`

### 2. Fixture do gate regerada + fixture nova (necessário, não opcional)
`rdac_2019.parquet` não tinha `DT_INTER` e precisou ser regerada dos 12 arquivos reais (44.589 registros preservados, byte a byte no conteúdo original). Foi criada `rdac_admissao_2019.parquet` (competências 2019+2020, 87.816 registros, 813 KB) porque **nenhum recorte de competência única consegue montar um ano de admissão completo** — sem ela, a propriedade central desta correção não teria prova sobre dado real.

### 3. `DT_INTER` derivado no harness para duas fixtures de defeito real
`rddf_1708_vazio.parquet` e `rdpr_2004_municipio_vazio.parquet` são a evidência arquivada de dois defeitos que quebraram a recoleta nacional. O caminho óbvio seria regerá-las do arquivo original. **Medido: não dá mais** — o DATASUS **re-publicou** `RDDF1708` e `RDPR2004` desde 2026-08-12, e os arquivos servidos hoje têm contagem diferente (16.292 vs 2.292; 56.146 vs 25.493) e **zero** dos defeitos que as fixtures capturam. Regerar destruiria a única cópia sobrevivente da evidência. As fixtures ficaram **intocadas** no disco e a coluna que falta é derivada de `ANO_CMPT` no código de teste, à vista (`_com_dt_inter_derivado`), nunca gravada dentro do binário onde viraria dado real indistinguível do resto.

**Achado colateral que vale registro:** o DATASUS re-publica arquivos de competência já fechados, e a re-publicação limpou corrupção que existia. As guardas continuam valendo (a corrupção era real e pode voltar), mas os dois arquivos específicos já não a reproduzem.

## Issues Encountered

- **O gate SC-7 piorou antes de melhorar** (34/61/3 → 33/54/11 na primeira medição). Reportado como achado e investigado até o mecanismo, em vez de ajustado — foi essa investigação que revelou o truncamento do oráculo.
- **Disco bem abaixo do informado no brief** (2,4 GB em vez de ~4,4 GB). Ver "Bloqueios abertos".
- **Saída do `collect` é bufferizada** quando não roda em TTY, então o acompanhamento da corrida longa se faz pelo `FileLedger`/`collect_state.json`, não pelo log.

## Next Phase Readiness

- **Upload de produção:** o dado novo estará pronto assim que a recoleta fechar. Decisão e execução do operador.
- **`oracle_scrape.py` precisa de conserto** (fora do file_scope desta plan): submeter todos os arquivos de competência necessários, como o `qibr.def` já faz, para que o oráculo CID meça ano de atendimento de verdade. Enquanto isso não acontecer, o gate compara — corretamente e de propósito — a população de competência.
- **`cid-divergencias.json`:** ~61 entradas inertes a aposentar.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-17*
