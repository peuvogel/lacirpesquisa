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
