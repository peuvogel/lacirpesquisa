# Substituição de produção — o que o swap mudaria (NÃO executado)

*Medido em 2026-08-17 (09-16). Produção lida em modo leitura; nenhuma escrita foi feita.*

## Veredito: o swap NÃO pode rodar agora

Não por cautela genérica — por uma razão medida:

> `upload.swap()` faz `TRUNCATE TABLE sih_metric_uf` seguido de
> `INSERT ... SELECT ... FROM sih_metric_uf_staging`, numa única transação.

É **substituição total**, não merge. E a recoleta tem **15 das 27 UFs**
(ver `recoleta-dt-inter.md`). Rodar o swap hoje apagaria da produção as 12 UFs que ainda não
foram recoletadas — incluindo **SP, MG, BA e RS**.

| | produção hoje | se o swap rodasse agora | efeito |
|---|---|---|---|
| chaves `(disease_id, uf, ano, local)` | 207.664 | 139.269 | **−68.395 (−32,9%)** |
| internações (ambos os locais) | 308.872.790 | 68.485.708 | **−77,8%** |
| UFs | 27 | 15 | **−12 UFs** |

**Isto não é um efeito do `DT_INTER`. É o efeito de subir uma coleta pela metade.** Os dois
precisam ficar separados, e a tabela acima existe só para tornar o risco impossível de ignorar.

## O efeito REAL do `DT_INTER`, isolado

Comparando as **mesmas 15 UFs** nas duas eras de agregação (`agregados-pre-dt-inter/` vs
`agregados/`), que é a única comparação que isola a mudança:

| | ANO_CMPT | DT_INTER | delta |
|---|---|---|---|
| chaves únicas | 139.036 | 139.269 | **+233 (+0,17%)** |
| internações | 67.383.169 | 68.485.708 | **+1.102.539 (+1,64%)** |

Projetado para as 27 UFs, a substituição completa deve ficar na ordem de **+1,6% de internações**
e **+0,2% de chaves** — mas isso é projeção, e só valerá como medição quando a coleta fechar.

### De onde vêm os +1,64%

Duas forças opostas, e o saldo é positivo:

- **Entra:** internações de dezembro/Y faturadas em Y+1, que o `ANO_CMPT` atribuía ao ano errado
  ou (na ponta de 2025) não capturava, e que a cauda de competência 2026 agora traz.
- **Sai:** internações de 2012 que viviam nos arquivos de competência 2013 e que o `ANO_CMPT`
  contava como 2013. Sob `DT_INTER` elas são de 2012, fora da janela D-11, e saem — corretamente.

O saldo por UF **não é uniforme**, e uma UF chega a ficar negativa:

| UF | delta de internações (grão UF, ocorrência) |
|---|---|
| PE | +147.725 |
| MT | +130.087 |
| AM | +113.955 |
| ES | +81.834 |
| RR | +29.898 |
| … | … |
| **AC** | **−1.655** |

### Os anos não se movem juntos — e é isso que o operador precisa ver antes de aprovar

O delta **não** é um deslocamento uniforme. Ele redistribui entre anos, e em células
específicas é grande:

| UF | ano | ANO_CMPT | DT_INTER | delta |
|---|---|---|---|---|
| PE | 2014 | 479.017 | 543.547 | **+13,47%** |
| PE | 2023 | 579.035 | 617.868 | +6,71% |
| PE | 2018 | 528.378 | 562.201 | +6,40% |
| AC | 2016 | 48.459 | 46.624 | **−3,79%** |
| AC | 2017 | 44.048 | 45.464 | +3,21% |

**O caso PE/2014 merece leitura, porque é um argumento a favor da mudança.** Sob `ANO_CMPT`, a
série de PE tinha um vale em 2014 (479 mil) entre 2013 (537 mil) e 2015 (508 mil). Sob
`DT_INTER` esse vale desaparece (544 mil, em linha com os vizinhos). O vale não era uma queda de
internações em Pernambuco: era um atraso de faturamento sendo lido como epidemiologia.

Medindo isso em todas as 15 UFs, pela variação média ano-a-ano da série ("serrilhado"):

| | ANO_CMPT | DT_INTER |
|---|---|---|
| serrilhado médio das 15 UFs | 7,79% | **6,42%** |
| UFs que ficaram mais suaves | — | **9 de 15** |

Maiores ganhos: MT (15,29% → 5,83%), ES (10,65% → 5,45%), PE (8,15% → 5,41%).
**6 UFs ficaram marginalmente mais serrilhadas** (todas por ≤ 0,81 p.p.), o que é compatível com
ruído. Isto é evidência de apoio, não prova: a prova de correção são os 134 pares exatos contra o
TabNet bem-formado.

## Um resíduo de 3, dito em vez de arredondado

Os agregados `ANO_CMPT` das 27 UFs somam **207.667** chaves e **308.872.793** internações.
Produção tem **207.664** e **308.872.790**. Diferença: **exatamente 3**, nas duas medidas.

Não foi investigado a fundo (custo alto, efeito 1e-8) e **não** está explicado. Fica registrado
como resíduo aberto em vez de arredondado para "bate", porque foi exatamente esse tipo de
arredondamento que esta fase passou duas semanas pagando. Hipótese mais provável, não verificada:
3 linhas descartadas pelo `upload.py` por violação de constraint, ou uma republicação do DATASUS
entre a agregação e o upload.

## Ordem de execução quando o operador autorizar

1. Liberar ~2,1 GB e rodar `npm run pipeline:collect` até as **27** UFs ficarem
   `agregado_reciclado` (`recoleta-dt-inter.md` tem os números).
2. Rodar `npm run pipeline:partitions` (as partições foram removidas de propósito: as antigas
   derivam da era `ANO_CMPT` e serviriam o ano errado).
3. Só então `npm run pipeline:upload`. O contrato PIPE-04/SC-4 é
   `copy_to_staging` → `swap` → `recount_via_postgrest` → `release_cache`, e a releitura via
   PostgREST é o que confere se o swap escreveu o que deveria.
4. Backup verificado disponível em `.local/backup-pre-09-14/sih-tabelas-20260817-0851.dump`
   (restaurado e conferido: 1.099.403 / 207.664 / 67.120 / 331).

**Enquanto o passo 1 não fechar, o passo 3 destrói dado.**
