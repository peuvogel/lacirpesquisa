# Reconciliação SC-7 — depuração categoria a categoria (09-08)

**Data:** 2026-08-10
**Recorte:** AC/2019, 44.589 registros do microdado SIH-RD (D-03, fixture de gate `rdac_2019.parquet`)
**Oráculo:** `pipeline/sih/tests/fixtures/oracle_tabnet.json` — 98 pares AC/2019 re-raspados ao vivo pelo
09-05, todos reproduzindo o CSV guardado (D-04, ver `reports/oracle-descartados.md`)
**Ferramenta:** `sih_pipeline.reconcile.compare` (Task 1 deste plano), invariante D-02: exato ou
explicado, nunca banda de aceitação percentual

Este relatório é o registro completo da depuração, inclusive das hipóteses que **não** funcionaram —
uma hipótese descartada por medição é resultado, não desperdício de tempo.

## Estado inicial (antes de qualquer correção ou divergência)

| Métrica | Valor |
|---|---|
| Pares no oráculo (AC/2019, medida `internacoes`) | 98 |
| Bate exato (delta 0) | **33 / 98** |
| Inexplicado | 65 / 98 |
| Delta mediano dos inexplicados | **+9,09%** |
| Delta máximo | +100% (n=1, `infeccao_meningococica`, ruído de amostra pequena) |
| Viés | consistentemente **positivo** — nenhum inexplicado tem delta negativo |

Nota sobre o número de pares: o spike de 2026-08-04 mediu 31/85 com uma metodologia diferente
(comparação direta contra os CSVs do corpus legado, sem re-raspagem). O oráculo deste plano (09-05)
tem 98 pares, todos re-raspados e confirmados ao vivo — os dois conjuntos não precisam coincidir
(ver `reports/oracle-descartados.md` §"Por que 98 e não 85"). **33 > 31 já é verdade na medição
crua, antes de qualquer trabalho de correção** — registrado aqui para não atribuir a este número um
mérito que não é das correções abaixo.

O padrão do spike se confirma: o viés é sempre positivo (o microdado nunca conta menos que o
TabNet), e um terço dos pares já bate exato — não é filtro global.

## Colisões estruturais (as duas primeiras entradas, D-05/09-RESEARCH)

### 1. `75`/`76` → `B92` (Seqüelas de poliomielite / Seqüelas de hanseníase)

Achado do 09-RESEARCH (`## Code Examples`, script de sobreposição): os dois códigos reivindicam a
faixa exata `B92`. Consultando a definição oficial de cada rótulo na CID-10:

- `B91` = "Sequelae of poliomyelitis" — título exato do código 75 ("Seqüelas de poliomielite")
- `B92` = "Sequelae of leprosy" — título exato do código 76 ("Seqüelas de hanseníase [lepra]")

**Evidência empírica adicional (AC/2019):** existem 6 registros reais com `DIAG_PRINC=B92`. Sob a
ordem de inserção atual do mapa, o código 75 (que aparece primeiro) vence e absorve os 6 — ou seja,
hoje esses 6 casos aparecem classificados como "sequelas de poliomielite". Clinicamente isso é
implausível: a pólio foi erradicada no Brasil desde 1989 (sequelas novas seriam raríssimas), enquanto
a hanseníase é endêmica na região amazônica/Acre. A evidência clínica reforça que **76**, não 75, é
quem deveria vencer o token `B92`.

**Correção aplicada:** `75: B92 -> B91`.

**Efeito cascata:** mover 75 para `B91` colidiria com o código `74` (Seqüelas de tuberculose), que já
reivindica `B91` — uma colisão NOVA em vez da original resolvida. `74`'s rótulo exato na CID-10 é
`B90` ("Sequelae of tuberculosis"), que fica livre depois da correção do código `14` (ver achado
extra, abaixo). **Correção aplicada:** `74: B91 -> B90`.

**Resultado:** com as duas correções, `74`/`75`/`76` ficam em `B90`/`B91`/`B92` respectivamente, sem
sobreposição entre si. Nenhum dos quatro códigos (`74`, `75`, `76`, `14`) está entre os 98 pares do
oráculo AC/2019, e não há nenhum registro real de `B90`/`B91` em AC/2019 — a correção não move a
contagem de exatos desta UF, mas resolve a colisão estrutural para qualquer UF que tenha esses casos
(o que o 09-11 vai medir numa UF grande).

### 2. `142`/`274` → `G02` (Meningite em doenç. infec/parasit / Doenças infecciosas e parasitárias congênitas)

`G02` = "Meningitis in other infectious and parasitic diseases classified elsewhere" — título exato
do código 142 ("Mening em doenç infec/parasit class outr part"). **Código 142 mantido sem alteração.**

`274` ("Doenças infecciosas e parasitárias congênitas") não tem nenhuma relação com meningite — é a
mesma classe de defeito do par 75/76, um código reivindicando a faixa exata de outro.

**Investigação da faixa correta:** medido em AC/2019, não existe nenhum registro com `DIAG_PRINC`
iniciando em `G02` (zero). A faixa CID-10 `P35-P37` ("infecções específicas do período perinatal" de
caráter congênito — P35 doenças virais congênitas, P36 sepse bacteriana do RN, P37 outras doenças
infecciosas/parasitárias congênitas) é o candidato textualmente mais próximo do rótulo. Medido: **53
registros reais** com esse prefixo em AC/2019, contra os **50** que o TabNet relata para esta
categoria — a aproximação mais próxima encontrada.

**Correção aplicada:** `274: G02 -> P35-P37`.

**Limitação conhecida e documentada (não escondida):** o código `77` ("Outras doenças infecciosas e
parasitárias") já reivindica a mesma faixa `P35-P37` no mapa original e vence por ordem de inserção
— então, mesmo com a correção aplicada, `274` continua recebendo ZERO registros nesta rodada
(verificado por medição, não suposição). Resolver isso por completo exigiria também redefinir a
faixa do código `77`, e uma varredura de todo o mapa (script de sobreposição do 09-RESEARCH, ver
`## Estado final e limitações` abaixo) mostrou que **não existe território livre em nenhuma faixa
CID de chapter I (A00-B99) para onde `77` poderia migrar sem colidir com outro código já existente**
— toda a vizinhança está densamente ocupada. Determinar a faixa correta de `77` exigiria consulta ao
`nibr.def` ao vivo ou revisão clínica, fora do alcance desta plan. Registrado como divergência
(`cid-divergencias.json`, ver abaixo) e recomendado para o checkpoint do 09-11.

## Achado extra durante a depuração: `14` (Tuberculose miliar)

Não fazia parte dos dois achados nomeados pelo 09-RESEARCH, mas surgiu durante a depuração ao
investigar por que `tuberculose_miliar` aparecia sem correspondente algum no agregado (par
"ausente", não apenas divergente).

`A19` = "Miliary tuberculosis" — título exato do código 14 ("Tuberculose miliar"). O valor atual do
mapa (`B90`, "Sequelas de tuberculose") não tem relação clínica com TB miliar ativa. Medido em
AC/2019: **exatamente 3 registros** com `DIAG_PRINC` iniciando em `A19` (`A192`: 1, `A199`: 2) — e o
TabNet relata **exatamente 3** internações para esta categoria no par re-raspado do oráculo.
Coincidência 3-para-3 forte demais para ser acaso.

**Correção aplicada:** `14: B90 -> A19`.

**Mesma limitação do achado anterior:** o código `9` ("Restante de tuberculose respiratória") já
reivindica a faixa exata `A19` e vence por ordem de inserção — a correção fica sem efeito mensurável
nesta rodada até que a faixa correta de `9` também seja determinada (não foi possível com as
ferramentas disponíveis nesta plan). Registrado como divergência e recomendado para o 09-11.

**Por que isso liberou `B90` para o código `74`:** ver seção anterior — a cadeia de três correções
(`14`→A19, `74`→B90, `75`→B91) se resolve de forma limpa e sem sobreposição residual entre os três.

## Hipóteses testadas e descartadas nesta rodada (categoria a categoria)

A hipótese original do 09-RESEARCH/spike era que os *maiores* desvios percentuais decorreriam de
faixas CID largas absorvendo categorias mais estreitas (o mesmo mecanismo dos dois achados
estruturais, replicado em escala menor por outras categorias). Testada contra os sete pares de maior
delta absoluto em AC/2019 — listando **todo** `DIAG_PRINC` atribuído a cada um e conferindo contra a
definição oficial da Lista Morb:

| Categoria | tabnetCode | Faixa declarada | Registros reais inspecionados | Veredito |
|---|---|---|---|---|
| Doenças do apêndice | 210 | `K35-K38` | 679, distribuídos em 8 subcódigos, todos dentro da faixa | faixa correta e completa — **descartada** |
| Diabetes mellitus | 124 | `E10-E14` | 461, distribuídos em 34 subcódigos, todos dentro da faixa | faixa correta e completa — **descartada** |
| Edema/hipertensão gravídica | 261 | `O10-O16` | 721, dominados por O141/O140, todos dentro da faixa | faixa correta e completa — **descartada** |
| Compl. puerpério NCOP | 268 | `O85-O99` | 600, distribuídos em 32 subcódigos, todos dentro da faixa | faixa correta e completa — **descartada** |
| Outras doenças infecciosas intestinais | 6 | `A02, A04-A05, A07-A08` | 609, dominados por A084/A049, todos dentro da composição | faixa correta e completa — **descartada** |
| Infarto cerebral | 178 | `I63` | 327, dominados por I638, todos dentro da faixa | faixa correta e completa — **descartada** |
| Insuficiência cardíaca | 175 | `I50` | 327, dominados por I509/I500, todos dentro da faixa | faixa correta e completa — **descartada** |

**Veredito da hipótese geral:** para as sete categorias de maior delta absoluto em AC/2019, a hipótese
de absorção por faixa CID larga foi **testada e descartada por medição** — a faixa CID declarada é,
em cada caso, exatamente a faixa oficial da Lista Morb, sem sobreposição com nenhum código vizinho.
Isso não significa que a hipótese seja falsa para outras categorias/UFs (os dois achados estruturais
provam que ela É real em pelo menos dois pontos do mapa) — significa que, nas sete categorias mais
impactantes desta UF, ela não é a explicação.

Uma varredura adicional (listar faixa declarada × rótulo para os 98 códigos do oráculo, não só os
sete de maior delta) não encontrou nenhum outro candidato óbvio a colisão — todas as faixas
compostas/largas ("outras", "restante", "NCOP") inspecionadas correspondem a agrupamentos
legitimamente amplos da própria Lista Morb oficial, não a absorção indevida.

**Hipótese alternativa identificada (não testável dentro do escopo desta plan):** o padrão observado
— viés **sempre positivo**, presente em quase todas as categorias, com deltas pequenos (`+1` a `+2`
casos) em categorias raras e deltas maiores em categorias de alto volume — é consistente com o efeito
de **competência de processamento (`ANO_CMPT`) vs. data real de internação (`DT_INTER`)** já medido
pelo spike de 2026-08-04: `ANO_CMPT=2019` inclui internações cuja `DT_INTER` real é de 2018
(~7,8% dos registros medidos pelo spike), e reagregar por `DT_INTER` com os arquivos de 2020
incluídos reduz o viés mediano de +4,14% para +3,45% — real, mas insuficiente para eliminá-lo. Este
plano **não re-testa** essa hipótese (já medida pelo spike) e **não pode corrigi-la**: exigiria
arquivos de 2020 (fora do recorte AC/2019 do D-03) e uma mudança em `aggregate.py`, que pertence ao
09-07 e está fora do escopo de arquivo desta plan (`file_scope_discipline`).

## Divergências registradas (`cid-divergencias.json`)

9 entradas — 7 tornam-se `explicado` no `reconcile.compare` (delta não-zero, faixa CID confirmada
correta, viés residual atribuído ao efeito de competência de processamento); 2 (`tuberculose_miliar`,
`doencas_infecciosas_e_parasitarias_congenitas`) documentam um mecanismo real e uma correção já
aplicada em `cid-corrections.json`, mas **continuam `inexplicado`** no `compare` — não por falta de
razão escrita, mas por decisão de design do próprio comparador (Task 1 deste plano): um par do
oráculo **sem nenhum correspondente no agregado** (ausência total, não apenas delta) nunca é resgatado
por uma entrada de divergência, só um delta não-zero é. Ausência total é tratada como mais grave que
divergência explicada — decisão deliberada, não lacuna.

## Estado final

| Métrica | Valor |
|---|---|
| Exato | 33 / 98 |
| Explicado (com divergência escrita e `compare` concorda) | 7 / 98 |
| Inexplicado | 58 / 98 (inclui os 2 casos "ausência com mecanismo documentado, ainda sem efeito mensurável") |
| `ReconciliationResult.ok` | `False` |
| Delta mediano dos 58 inexplicados restantes | +7,90% (baixou de +9,09% depois de remover os 7 explicados, que estavam entre os maiores deltas) |
| p90 dos 58 inexplicados restantes | ~+30% |

**33 é estritamente maior que os 31 medidos pelo spike** (critério de aceitação do plano). As
correções estruturais (75/76, 142/274, e o achado extra 14) não alteram esse número especificamente
para AC/2019 — nenhum dos códigos motivadores está entre os 98 pares do oráculo desta UF, e seu efeito
pleno depende de codigos (9, 77) que esta plan não teve evidência suficiente para corrigir. O ganho
de 31→33 vem inteiramente da diferença de metodologia entre o oráculo do spike (85 pares, corpus
legado) e o oráculo deste plano (98 pares, re-raspados pelo 09-05) — registrado aqui para não
atribuir crédito indevido ao trabalho de correção.

## Estado final e limitações — sobreposição residual

Rodando o script de sobreposição do 09-RESEARCH (`## Code Examples`) sobre o mapa **com as quatro
correções aplicadas**:

```
9  A19 <-> 14  A19
77 P35-P37 <-> 274 P35-P37
```

Os dois pares de sobreposição originais (75/76, 142/274) estão **resolvidos**. Restam dois pares
NOVOS, ambos envolvendo um código (`9`, `77`) que esta plan não editou e cuja faixa correta não foi
possível determinar com confiança sem acesso ao `nibr.def` ao vivo ou revisão clínica — a mesma classe
de decisão que a Fase 8 tratou com checkpoint humano (`08-07`, achado `ait`→G45). **Não são
sobreposições escondidas**: estão documentadas aqui, no `reason` de cada correção afetada em
`cid-corrections.json`, e nas duas divergências correspondentes. Recomendado como pergunta explícita
para o checkpoint do 09-11.

## Resíduo honesto

58 pares permanecem `inexplicado` — nenhuma razão foi inventada para fechá-los. A hipótese mais
plausível (competência de processamento, já medida pelo spike, real mas insuficiente e fora do
alcance de arquivo desta plan para corrigir) está documentada, mas não foi convertida em divergência
individual para os 51 pares que não tiveram investigação categoria-a-categoria dedicada nesta rodada
— fazer isso sem verificação individual seria o "residue hidden by tuning" que este plano existe para
evitar. Levado ao checkpoint do 09-11 como pergunta aberta: aceitar o mecanismo geral (competência de
processamento) como explicação de lote para o resíduo, ou aprofundar a depuração categoria a
categoria.

---

## Investigação nova, 2026-08-10 — as duas pendências que bloqueiam o upload (09-08-INVESTIGACAO)

**Contexto:** o checkpoint clínico do 09-11 (D-07, 2026-08-10) aprovou as 4 correções acima e
aceitou o resíduo geral como divergência de lote, mas recusou fechar duas questões como
divergência honesta — determinou investigação nova antes de qualquer upload. Registradas em
`scripts/catalog/cid-divergencias.json` como `PENDENTE_colisao_codigos_9_e_77` (decisão 3) e
`PENDENTE_sete_categorias_delta_extremo_sp` (decisão 4), ambas com `bloqueiaUpload: true`. Esta
seção é o registro da investigação que resolveu a primeira e caracterizou (sem resolver por
completo) a segunda. Não há um novo PLAN.md — este é um round de investigação avulso, escopado
diretamente aos artefatos do 09-08.

### Pendência A — faixa correta dos códigos 9 e 77

**Método (protocolo em ordem, conforme a instrução do coordenador):**

1. **Fonte autoritativa primeiro.** `oracle_scrape.py` fala com
   `http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sih/cnv/nibr.def`, mas esse formulário só expõe
   o `<select>` de categorias (rótulo + um id sequencial 1..333, não a faixa CID). A faixa CID
   vive numa página DIFERENTE, já mapeada pelo 08-RESEARCH §1.3 mas nunca absorvida:
   `http://tabnet.datasus.gov.br/cgi/sih/mxcid10lm.htm` — "Morbidade Hospitalar do SUS — CID-10 —
   Lista de Tabulação para Morbidade", uma tabela HTML oficial com colunas Capítulo/Código/
   Descrição/Códigos da CID-10. Buscada ao vivo em 2026-08-10: **51.116 bytes**, exatamente o
   mesmo tamanho já registrado pelo 08-RESEARCH em 2026-08-03 — a página não mudou. Cache local
   em `pipeline/sih/cache/mxcid10lm.htm` (gitignored, `pipeline/sih/cache/` — reproduzível por
   qualquer um com um `curl`/`urllib` simples, sem segredo nem rate-limit especial — é uma página
   pública, GET simples, sem POST ao `nibr.def`).

2. **Join por rótulo normalizado** (mesmo método do 08-RESEARCH §1.3, que mediu 74% de match
   exato entre o `<select>` e a tabela oficial): 334 opções do `<select>` × 341 itens da tabela
   oficial, normalizados (minúsculas, sem acento, espaço colapsado) → **247/333 batem exato**
   (mesma proporção do 08-RESEARCH). Os 86 sem match exato são majoritariamente truncamento de
   rótulo (ex. "Diarréia e gastroenterite origem infecc presumível" vs. nome completo oficial) —
   já catalogado pelo 08-RESEARCH como fricção conhecida, não um problema novo.

3. **Achado principal:** dentro do capítulo I (`001`–`057`, "Algumas doenças infecciosas e
   parasitárias", `A00-B99`), a tabela oficial tem exatamente 57 itens de topo — e o mapa
   `lista-morb-cid.json` tem um **deslocamento estrutural de atribuição envolvendo TRÊS
   códigos**, não dois:

   | tabnetCode | Rótulo (`<select>`) | Valor ANTIGO no mapa | Item oficial cujo rótulo bate EXATO | Valor oficial | A quem o valor antigo pertence de verdade |
   |---|---|---|---|---|---|
   | `9` | Restante de tuberculose respiratória | `A19` | *(nenhum — ver abaixo)* | — | Pertence ao item `008.5 Tuberculose miliar` = rótulo do código `14` |
   | `15` | Restante de outras tuberculoses | `A65-A67, A69-A70, A74, A77-A79, B58-B64, B85-B89, B94-B99` | `008.9 Restante de outras tuberculoses` | `A18.2, A18.4-A18.8` | Pertence ao item `057 Outras doenças infecciosas e parasitárias` = rótulo do código `77` |
   | `77` | Outras doenças infecciosas e parasitárias | `P35-P37` | `057 Outras doenças infecciosas e parasitárias` | `A65-A67, A69-A70, A74, A77-A79, B58-B64, B85-B89, B94-B99` | Pertence ao item `250 Doenças infecciosas e parasitárias congênitas` = rótulo do código `274` (já corrigido pelo 09-08, aprovado pelo 09-11) |

   Ou seja: `9` tinha o valor de `14`; `15` tinha o valor de `77`; `77` tinha o valor de `274`.
   Três códigos, três valores emprestados de três OUTROS códigos — não um erro isolado. Isso é a
   mesma família de defeito dos achados 75/76 e 142/274 originais (um rótulo reivindicando a
   faixa exata de outro), mas numa cadeia mais longa, presumivelmente herdada da construção
   original de `lista-morb-cid.json` (anterior à Fase 8, nunca revalidada contra `mxcid10lm.htm`
   até esta investigação — o 08-RESEARCH mediu o join mas recomendou explicitamente **não**
   absorver os intervalos por causa da fricção de truncamento, e essa decisão nunca foi
   revisitada para os casos que a fricção escondia).

4. **Código `9` — sem item próprio na tabela oficial, resolvido por medição empírica (protocolo
   passo 2).** O item `007 Tuberculose respiratória` (`A15-A16`) tem só dois filhos na tabela
   impressa — `007.1` (código `7`, `A15.0-A15.3, A16.0-A16.3`) e `007.2` (código `8`,
   `A15.4-A15.9, A16.4-A16.9`) — que juntos já esgotam todos os dígitos `.0`-`.9` de A15 e A16.
   Por leitura estrita da tabela impressa, "restante" seria conjunto vazio. Mas a mesma página
   tem uma nota técnica: *"Alguns agrupamentos, como malária, tuberculoses respiratórias etc.,
   foram subdivididos para atender necessidades específicas da realidade brasileira"* — aviso
   explícito de que a tabela de 3 colunas não esgota o que o TabNet realmente usa. Medido ao
   vivo (`oracle_scrape.post_tabnet`, `REQUEST_DELAY_SEC=1.5` respeitado):

   | UF/ano | TabNet (código 9) | `DIAG_PRINC` sem 4º dígito no microdado (`"A15"`/`"A16"`, 3 caracteres) |
   |---|---|---|
   | SP/2019 | **26** | **26** (18×`A15` + 8×`A16`) |
   | AC/2019 | **0** (erro "nenhum município da UF 12" — zero genuíno) | **0** |

   Coincidência exata, não aproximação — `DIAG_PRINC` gravado sem subcategoria (código de 3
   caracteres, sem ponto) é o "resto" real: tuberculose respiratória notificada sem
   especificidade suficiente para cair em `007.1`/`007.2`. `newRange = "A15, A16"` (token de 3
   caracteres, cobre por design todo subcódigo — ver `matcher.py`) é seguro porque os tokens de
   `7`/`8` (4 caracteres, com ponto) vêm ANTES de `9` na ordem numérica do mapa e vencem por
   primeira correspondência qualquer `DIAG_PRINC` de 4 dígitos — o token de `9` só alcança, na
   prática, os registros sem 4º dígito.

5. **Correções aplicadas** (`scripts/catalog/cid-corrections.json`, tabnetCodes `9`, `15`, `77`):
   corrigir `77` sem corrigir `15` primeiro criaria uma colisão NOVA (os dois reivindicando o
   mesmo intervalo) — as três formam uma cadeia, igual à cadeia `74`/`75`/`14` do 09-08 original.

6. **Prova de ausência de colisão nova:** varredura de sobreposição sobre o mapa inteiro (331
   códigos, 493 tokens após parsing) com as três correções aplicadas juntas — **zero
   sobreposições**, mesmo método do script de sobreposição do 09-RESEARCH usado pelo 09-08.

7. **Efeito medido sobre a fixture congelada do gate (AC/2019):**

   | Categoria | Antes | Depois | TabNet | Status |
   |---|---|---|---|---|
   | `tuberculose_miliar` (14) | ausente | agregado=3 | 3 | **EXATO** |
   | `doencas_infecciosas_e_parasitarias_congenitas` (274) | ausente | agregado=53 | 50 | **EXPLICADO** (delta +6%, banda de competência de processamento já aceita) |

   Composição do gate: `exato` 33→**34**, `explicado` 60→**61**, `inexplicado` 5→**3** (saem
   `tuberculose_miliar` e `doencas_infecciosas_e_parasitarias_congenitas`). `test_reconcile_gate.py`
   atualizado com a nova composição — `result.ok` continua `False` (3 inexplicados restantes, ver
   pendência B). `uv run pytest` (todos os testes) e `npm run pipeline:reconcile-gate` verdes.

8. **Efeito medido em SP/2019** (raspagem ao vivo 2026-08-10, mesmo método): código `77` ―
   agregado (`DIAG_PRINC` real no novo intervalo) = 2.557, TabNet = 2.424, delta +5,5% — dentro
   da banda aceita. Código `274` (já medido pelo 09-11 Task 1): agregado = 2.090, TabNet = 1.992,
   delta +4,9% — agora com efeito mensurável de verdade, passa a ser resgatado pela divergência
   já existente. Código `15`: agregado (novo intervalo `A18.2, A18.4-A18.8`) = 96, TabNet = 72,
   delta +33% — ver pendência B abaixo (mecanismo diferente, mistura faixa CID + AIH tipo 5).

**Resultado:** `PENDENTE_colisao_codigos_9_e_77` **RESOLVIDA** — `bloqueiaUpload` alterado para
`false` em `cid-divergencias.json`. As hipóteses "descartadas" originais (faixa livre na
vizinhança) continuam corretas — a faixa certa não estava livre ao lado, estava **numa
atribuição trocada** com dois outros códigos existentes, um mecanismo mais sutil que a varredura
manual do 09-08 não podia detectar sem a tabela `mxcid10lm.htm` como referência cruzada.

### Pendência B — sete categorias de delta extremo em SP/2019

**Confirmação inicial (herdada do 09-11):** nenhuma das sete faixas CID declaradas colide
estruturalmente com um código vizinho — confirmado de novo nesta investigação contra
`mxcid10lm.htm`: `demência` (132, `F00-F03`), `doença de Parkinson` (145, `G20`) e `doença de
Alzheimer` (146, `G30`) batem EXATO por rótulo com os itens oficiais `112`, `121`, `122` — mesmos
valores já no mapa, **sem bug de faixa**. `tuberculose_pulmonar` (7, já confirmado pelo 09-08),
`tuberculose_do_sistema_nervoso` (10) e `tuberc_intest...` (11) também já tinham faixa correta.
Só `restante_de_outras_tuberculoses` (15) tinha faixa errada — corrigida junto da pendência A
acima (faz parte da mesma cadeia 9/15/77).

**Mecanismo identificado (novo nesta investigação):** o campo `IDENT` (tipo de AIH, presente no
microdado SIH-RD, coluna `IDENT` do parquet) não é filtrado pela agregação. `IDENT='5'` marca
"AIH de longa permanência" — uma renovação MENSAL de faturamento para um paciente que CONTINUA
internado, não uma nova admissão. `IDENT='1'` é a AIH normal/inicial. A base inteira de SP/2019
tem 97,3% `IDENT='1'` (2.537.199 de 2.606.482) — a esmagadora maioria dos registros já é limpa.
Mas nas sete categorias de delta extremo, a proporção de `IDENT='5'` é muito acima dessa
baseline:

| Categoria | tabnetCode | `IDENT='5'` em SP/2019 | % | `IDENT='5'` em AC/2019 |
|---|---|---|---|---|
| demência | 132 | 3.427 de 3.986 | **86,0%** | 0 de 17 |
| tuberculose_pulmonar | 7 | 2.390 de 4.762 | **50,2%** | 0 de 37 |
| doença de Alzheimer | 146 | 155 de 590 | **26,3%** | 0 de 6 |
| doença de Parkinson | 145 | 81 de 326 | **24,8%** | 0 de 3 |
| tuberc. intest./peritônio/gânglios | 11 | 6 de 26 | **23,1%** | 0 de 1 |
| tuberculose do sistema nervoso | 10 | 20 de 112 | **17,9%** | 0 de 3 |
| restante de outras tuberculoses | 15 | 11 de 96 | **11,5%** | 0 de 1 |

Todas as sete têm **0% de `IDENT='5'` em AC/2019** — explica, com mecanismo, por que o Acre
nunca revelou este defeito (a vacuidade do D-03, já flagrada pelo 09-11, agora com causa
identificada, não só volume): não parece ter havido internação de longa permanência para estas
condições crônicas no Acre em 2019, enquanto São Paulo tem rede de cuidado geriátrico/
psiquiátrico de longa permanência que gera renovação mensal de AIH para os mesmos pacientes.
Contraprova com categorias "normais": apendicite (`K35-K38`, já exata no 09-08) e colelitíase
(`K80-K81`) têm **0% de `IDENT='5'` em SP/2019** — condições agudas não geram longa permanência.

**Filtrando só `IDENT='1'`, os deltas colapsam** para a mesma ordem de grandeza da banda de
competência de processamento já aceita (~+4% a +8%):

| Categoria | Delta bruto (hoje) | Delta com `IDENT='1'` só |
|---|---|---|
| demência | +665,1% | **+7,3%** |
| tuberculose_pulmonar | +108,2% | **+3,7%** |
| doença de Alzheimer | +45,7% | **+7,4%** |
| doença de Parkinson | +47,5% | **+10,9%** |
| tuberc. intest./peritônio/gânglios | +44,4% | **+11,1%** |
| tuberculose do sistema nervoso | +47,4% | **+21,1%** |
| restante de outras tuberculoses (após corrigir a faixa, pendência A) | +33,3% (bruto, faixa já corrigida) | **+18,1%** |

**Hipóteses descartadas nesta rodada:** sobreposição estrutural de faixa CID (confirmado de novo
contra `mxcid10lm.htm` — nenhuma, exceto o caso já corrigido do código 15); erro de agregação do
scraper (as contagens ao vivo do TabNet e o microdado local usam fontes independentes e ainda
assim reproduzem a mesma ordem de grandeza uma vez filtrado `IDENT='1'`).

**Por que isto NÃO está resolvido, mesmo com o mecanismo identificado:** a correção pertence ao
cálculo da medida `internacoes` em `aggregate.py` (precisa excluir `IDENT='5'`, ou equivalente) —
arquivo de propriedade do 09-07, **fora do escopo de arquivo desta investigação** (instrução
explícita: não editar `aggregate.py`, `matcher.py` nem `codigos.py`). Subir os dados hoje ainda
inflaria estas sete categorias. `PENDENTE_sete_categorias_delta_extremo_sp` continua com
`bloqueiaUpload: true`, mas `mecanismoIdentificado` passa para `true` e a razão registrada em
`cid-divergencias.json` documenta o achado completo, com o próximo dono explícito: 09-07 (ou
uma plan nova dedicada), fora do escopo desta investigação.

**Nota de escopo, não escondida:** esta investigação mediu `IDENT='5'` só para as sete categorias
designadas pelo checkpoint do 09-11 (mais as duas da pendência A). Não foi feita uma varredura
de `IDENT='5'` sobre as 331 categorias — é plausível, por analogia clínica (câncer terminal,
cuidados paliativos, diálise crônica, saúde mental de longa permanência são também perfis de
internação prolongada), que outras categorias tenham o mesmo problema em grau menor, inclusive
contribuindo parcialmente para o resíduo geral de +5,1%/+7,9% já aceito como divergência de lote
pela decisão 2 do checkpoint do 09-11. Esta é uma HIPÓTESE não testada aqui — levantá-la não
reabre a decisão 2 (fora do mandato desta investigação, que é as duas pendências específicas),
mas fica registrada para quem eventualmente corrigir `aggregate.py` verificar o efeito completo,
não só nas sete categorias nomeadas.

### Resumo do estado depois desta investigação

| Pendência | Status | `bloqueiaUpload` |
|---|---|---|
| A — colisão residual códigos 9/77 | **RESOLVIDA** (faixa correta determinada e aplicada) | `false` |
| B — 7 categorias de delta extremo | Mecanismo IDENTIFICADO (AIH tipo 5), correção fora de escopo (aggregate.py, 09-07) | `true` |

Gate AC/2019: `exato=34, explicado=61, inexplicado=3` (`doenca_de_alzheimer`,
`tuberculose_do_sistema_nervoso`, `tuberculose_pulmonar` — os três representantes da pendência B
visíveis no recorte pequeno do Acre). `result.ok = False`, de propósito.

---

## Remedição pós-fix IDENT, 2026-08-10

**Contexto:** o operador aprovou o fix (2026-08-10, sem PLAN.md — brief avulso do coordenador,
mesmo padrão da investigação anterior): filtrar `aggregate.py` para contar só `IDENT='1'` (AIH
normal). Rationale registrada pelo operador: uma renovação de AIH de longa permanência é
faturamento continuado da MESMA hospitalização, não uma nova admissão — contar as duas juntas
duplica a internação; e o TabNet (oráculo) evidentemente já conta só a AIH inicial. Este fix
fecha a pendência B, a segunda das duas pendências que bloqueavam o upload (09-10).

### O fix

TDD RED→GREEN sobre `pipeline/sih/tests/test_aggregate.py`/`aggregate.py`:

- **RED** (`defa477`): dois testes novos — um sintético (4 registros, 2×`IDENT='1'` +
  1×`IDENT='5'` + 1×`IDENT='9'`, afirma que só os 2 primeiros contam) e um sobre dado real (a
  fixture de gate `rdac_2019.parquet`, afirma `total_ocorrencia == 44.563` = 44.589 − 26
  registros `IDENT='5'` medidos ao vivo em AC/2019, 0 descartes do matcher nesta fixture).
  Verificado RED isoladamente: restaurando a versão commitada de `aggregate.py` e da fixture
  antes do commit, `3 failed / 13 passed`, zero erros de coleção (o `NEEDED_COLUMNS` também
  falha, como esperado).
- **GREEN** (`53b7323`): `NEEDED_COLUMNS` ganha `IDENT`; excluído ANTES do `match_category`
  (`continue` explícito), nunca contado como descarte — não é falha de categorização do CID, é
  exclusão semântica deliberada da medida `internacoes`. A fixture `rdac_2019.parquet` foi
  regenerada a partir dos mesmos 12 arquivos reais de AC/2019 (`RDAC1901`..`RDAC1912`) do 09-07,
  agora projetando `IDENT` também — 44.589 registros preservados, 267 KB → 347 KB.

Invariantes preexistentes confirmados intactos após o fix: ocorrência==residência (mesmo
conjunto de AIHs), soma de município==grão UF, `VAL_TOT` soma como float positivo, `_cast_morte`
trata `MORTE` como string com padding (achado do 09-07).

### Remedição do gate SC-7 (AC/2019) — composição BYTE-IDÊNTICA, medida não assumida

Rodando o gate real (`test_reconcile_gate.py`) e o comparador (`reconcile.compare`) diretamente
sobre a fixture regenerada: `exato=34, explicado=61, inexplicado=3`, **exatamente os mesmos 98
disease_ids nos mesmos três buckets** de antes do fix (conferido conjunto a conjunto, não só a
contagem). Comparado também, um a um, o `agregado` pós-fix contra o `agregado` pré-fix
registrado em `paresQueMotivaram` de cada uma das 60 divergências já aceitas em
`cid-divergencias.json` (decisão 2 do checkpoint + as 7 categorias originais do 09-08): **zero
categorias mudaram de valor** — a única mudança nos 98 pares do oráculo AC/2019 continua sendo a
já registrada pela investigação anterior (`tuberculose_miliar` e
`doencas_infecciosas_e_parasitarias_congenitas`, resolução da pendência A, não deste fix).

**Por que o fix não move nenhum número em AC/2019, medido:** dos 26 registros `IDENT='5'` do
dataset inteiro de AC/2019 (44.589 registros), **100% pertencem a duas categorias só** —
`esquizofrenia_transt_esquizotipicos_e_delirantes` (24 registros) e
`outros_transtornos_mentais_e_comportamentais` (2 registros) — condições de saúde mental de
longa permanência, confirmando por medição a hipótese não-testada que a investigação anterior
tinha registrado ("é plausível... que outras categorias crônicas [incluindo] saúde mental de
longa permanência... tenham o mesmo problema"). **Nenhuma das duas tem par no oráculo AC/2019**
(98 pares) — por isso a remoção destes 26 registros não altera nenhum valor agregado que o gate
compara. Isto é consistente com, e explica com mecanismo, o achado original do spike de
2026-08-04 ("só 26 dos 44.589 registros têm IDENT=5; excluí-los não muda nenhuma contagem") — o
spike media contra um oráculo diferente (85 pares do corpus legado) mas a mesma causa raiz
(nenhum dos pares comparados intersecta as categorias psiquiátricas) explica por que AC nunca
revelou nem esta parte do problema.

`test_reconcile_gate.py` foi atualizado (docstring + comentários), mas **a composição numérica
(34/61/3) e o conjunto exato de disease_ids permanecem os mesmos** — não é uma regressão, é a
composição TRUE medida diretamente contra o código real pós-fix. Nenhum número foi afrouxado.

### Remedição das 7 categorias contra SP/2019 — mecanismo confirmado, deltas colapsam

Reagregado o cache local completo de SP/2019 (`RDSP1901`..`RDSP1912`, 2.606.482 registros) com o
`aggregate.py` real (pós-fix), não um script ad-hoc — reproduzindo exatamente o caminho de
código que vai rodar em produção:

| Categoria | tabnetCode | Agregado pós-fix | TabNet | Delta pós-fix | Delta pré-fix |
|---|---|---|---|---|---|
| `restante_de_outras_tuberculoses` | 15 | 85 | 72 | **+18,06%** | +3.451,39% (bruto) / +33,33% (faixa já corrigida) |
| `demencia` | 132 | 559 | 521 | **+7,29%** | +665,07% |
| `tuberculose_pulmonar` | 7 | 2.372 | 2.287 | **+3,72%** | +108,22% |
| `doenca_de_parkinson` | 145 | 245 | 221 | **+10,86%** | +47,51% |
| `tuberculose_do_sistema_nervoso` | 10 | 92 | 76 | **+21,05%** | +47,37% |
| `doenca_de_alzheimer` | 146 | 435 | 405 | **+7,41%** | +45,68% |
| `tuberc_intest_peritonio_glangl_mesentericos` | 11 | 20 | 18 | **+11,11%** | +44,44% |

Os sete deltas pós-fix (medidos com o código real, agosto de 2026) reproduzem, dentro de
arredondamento, os deltas que a investigação anterior tinha calculado com um script auxiliar —
boa validação cruzada independente. Todas as sete caem agora entre **+3,7% e +21,1%**, na mesma
ordem de grandeza de divergências de lote já aceitas em `cid-divergencias.json` (ex.:
`insuficiencia_cardiaca` +15,96%, `outras_tuberculoses_respiratorias` +18,18%,
`doenca_pelo_virus_da_imunodeficiencia_humana_hiv` +15,87%, `infarto_cerebral` +24,81%,
`embolia_e_trombose_arteriais` +40,0%) — não são mais delta extremo.

**`PENDENTE_sete_categorias_delta_extremo_sp` RESOLVIDA** — `bloqueiaUpload` alterado para
`false` em `cid-divergencias.json`. As duas pendências que bloqueavam o upload do 09-10 (A —
colisão 9/77, e B — sete categorias de delta extremo) estão agora ambas resolvidas.

### A divergência de lote (competência de processamento) continua valendo, na mesma magnitude

Pergunta explícita do coordenador: o fix de IDENT absorveu parte do que estava sendo atribuído
ao efeito de competência de processamento (`ANO_CMPT` vs `DT_INTER`)? **Medido, não assumido: em
AC/2019, não** — comparação categoria a categoria (seção acima) mostra zero mudança nos valores
agregados das 60 categorias já explicadas por essa divergência de lote. Isso faz sentido: os 26
únicos registros `IDENT='5'` de AC/2019 pertencem a duas categorias psiquiátricas sem par no
oráculo, então não podiam ter contribuído para o resíduo geral daquela UF em primeiro lugar.

Em SP/2019, não foi re-executado o `reconcile.compare` completo sobre os 113 pares do oráculo
(re-raspar SP inteiro está fora do orçamento deste fix — a tabela acima já mede exatamente as 7
categorias que a pendência B cobria, com o código real). É plausível que outras categorias de
SP/2019 (fora as 7 nomeadas) tenham alguma fração de `IDENT='5'`, reduzindo levemente seus
deltas também — mas isso não contradiz nem esvazia o mecanismo de competência de processamento:
a baseline de `IDENT='5'` no dataset inteiro de SP é 2,7% (69.283 de 2.606.482, medido), baixa o
bastante para não explicar sozinha o resíduo mediano de +5,10% já registrado. **Não medido nesta
rodada** (fora do escopo do fix, que é as 7 categorias designadas) — registrado honestamente como
item de acompanhamento, não como conclusão.

### Resíduo honesto que permanece (não-bloqueante)

Das 7 categorias, 3 (`tuberculose_pulmonar`/7, `tuberculose_do_sistema_nervoso`/10,
`doenca_de_alzheimer`/146) têm par no oráculo AC/2019 e permanecem **inexplicado** no gate
congelado, com os MESMOS deltas de antes do fix (+12,12%/+50%/+50%, denominadores pequenos —
33/2/4 internações). Isto não é uma regressão nem uma pendência nova: é o resíduo pequeno já
conhecido do AC (decisão 4 do checkpoint do 09-11 excluiu deliberadamente estas 3 da aceitação
em lote), que o fix de IDENT não tinha como resolver porque, em AC especificamente, IDENT não é
a causa (0% de `IDENT='5'` nestas 3 categorias). Não bloqueia o upload — é a mesma classe de
ruído de amostra pequena já tolerada para dezenas de outras categorias de baixo volume, apenas
sem uma entrada de divergência individual escrita (decisão do operador, não deste fix, de não
aceitar em lote sem investigação própria). Registrado em `cid-divergencias.json` (campo
`residuoNaoBloqueante` da entrada `PENDENTE_sete_categorias_delta_extremo_sp`).

### Resumo final

| Pendência | Status | `bloqueiaUpload` |
|---|---|---|
| A — colisão residual códigos 9/77 | RESOLVIDA (investigação anterior) | `false` |
| B — 7 categorias de delta extremo | **RESOLVIDA** (este fix — IDENT='1' em `aggregate.py`) | `false` |

**As duas pendências que bloqueavam o upload do 09-10 estão resolvidas.** O 09-10 continua
sujeito às demais restrições registradas em `STATE.md` §"Bloqueios abertos" (ordem de evacuação
de `sih_metric_muni`, credencial `SUPABASE_ACCESS_TOKEN`, `psql` fora do PATH) — nenhuma delas
relacionada ao SC-7.

Commits: `defa477` (test, RED), `53b7323` (feat, GREEN aggregate.py). Ver
`.planning/phases/09-pipeline-confi-vel-coleta-completa/09-07-IDENT-FIX-SUMMARY.md` para o
resumo completo da tarefa.
