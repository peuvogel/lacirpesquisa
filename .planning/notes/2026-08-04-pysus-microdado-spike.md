# Spike: microdado SIH via PySUS como fonte da Fase 9

**Data:** 2026-08-04
**Contexto:** avaliação do [PySUS](https://github.com/AlertaDengue/PySUS) como substituto do scraping
de TabNet para a coleta da Fase 9. Todo o trabalho foi feito em scratchpad; nenhum arquivo do
repositório foi alterado por este spike.

## Veredito

A ideia se sustenta e o dado é o certo, **mas o número não bate com o TabNet de saída** e a
versão atual da biblioteca é inutilizável. Ambos têm caminho conhecido.

## 1. PySUS 2.7.0 tem um defeito bloqueante no índice de arquivos

`list_files("SIH", state, year)` devolve **exatamente um arquivo por (estado, ano, mês)**, com o
grupo escolhido arbitrariamente e a coluna `group` sempre `None`. O filtro `group="RD"` devolve
lista vazia em todos os clients (`ftp`, `ducklake`, default).

```
AC 2019 → 12 arquivos:  RD em 05,07,09,11,12 · RJ em 01,08 · SP em 02,03,04,06,10
```

Reproduzido em AC, SP, MG (2019) e RR (2022) — sempre o mesmo padrão. `RDAC1901.parquet` não é
alcançável por caminho nenhum. O parser de nome (`SIH.formatter`) está correto; o defeito é no
índice que o alimenta.

**Por que importa:** RJ é AIH *rejeitada*; SP é uma linha por *procedimento*, não por internação.
Um pipeline que confiasse no índice agregaria esses arquivos como se fossem internações e
produziria número plausível e errado — exatamente o modo de falha que a Fase 9 existe para matar.

## 2. PySUS 1.0.1 funciona — é só pinar

A API `pysus.ftp` foi removida na reescrita da 2.0.0 (maio/2026). A **1.0.1** (fev/2026) é a última
antes dela e lista corretamente:

```python
from pysus.ftp.databases.sih import SIH
s = SIH().load()
s.get_files("RD", uf="AC", year=2019)   # 12 arquivos, RDAC1901..RDAC1912
```

Expõe 6 grupos (RD, RJ, ER, SP, CH, CM) contra os 4 quebrados da 2.7.0, baixa `.dbc` do FTP real do
DATASUS e decodifica para parquet. Requer Python `>=3.10,<3.14` — esta máquina já tem 3.11.15 e `uv`.

## 3. O dado é exatamente o que a Fase 9 precisa

AC 2019 completo: **44.589 registros × 113 colunas**. Todos os campos necessários presentes —
`DIAG_PRINC`, `IDENT`, `MUNIC_MOV`, `MUNIC_RES`, `VAL_TOT`, `DIAS_PERM`, `MORTE`, `SEXO`, `IDADE`.

As 4 medidas saem de uma passada só, e `taxa_mortalidade` sai direto do `MORTE` — hoje ela é
critério de sucesso da fase e está vazia em quase todo CSV coletado.

**Volume:** 3,1 MB para AC/2019 → extrapolando, **~0,8 GB/ano** e **~10 GB** para 2013-2025 do
Brasil inteiro. Gerenciável.

## 4. O matcher CID→categoria funciona sobre o `lista-morb-cid.json` da Fase 8

O mapa congelado na 08-01 tem quatro formas de valor, e todas precisam ser tratadas:

| Forma | Exemplo | Regra |
|---|---|---|
| simples 3 char | `A00` | prefixo de 3 |
| faixa 3 char | `I60-I62` | intervalo em 3 |
| exato 4 char | `A18.3` | igualdade em 4 |
| faixa 4 char | `A15.0-A15.3` | intervalo em 4 |
| composta | `A02, A04-A05, A07-A08` | união dos anteriores |

`DIAG_PRINC` vem com 4 caracteres em ~94% dos registros e 3 nos demais, então o matcher precisa dos
dois grãos — não basta prefixo de 3. Implementado e testado: **7 registros sem categoria em 44.589**
(0,016%), e todo CID testado cai em **exatamente uma** categoria. `G450 → 150` confirma o
mapeamento AIT/G45 decidido no checkpoint clínico da 08-07.

## 5. A reconciliação com o TabNet NÃO fecha de saída

Agregando AC/2019 por `MUNIC_MOV` (local de internação, como o `nibr.def` que a coleta atual usa) e
comparando contra os CSVs já coletados, em 85 agravos comparáveis:

| Métrica | Valor |
|---|---|
| Bate exato | **31 / 85** |
| Delta mediano | **+4,14%** |
| Dentro de ±1% | 31 / 85 |
| Dentro de ±5% | 45 / 85 |
| p90 | +20% |

**O viés é consistentemente positivo** — o microdado conta sempre *mais* que o TabNet. Duas
hipóteses já descartadas empiricamente:

- **competência × processamento**: `ANO_CMPT` é uniformemente `2019` nos arquivos de processamento
  de 2019, então não há vazamento de ano.
- **AIH tipo 5 (longa permanência)**: só 26 dos 44.589 registros têm `IDENT=5`; excluí-los não muda
  nenhuma contagem (31/85 exatos nas duas hipóteses).

Hipóteses testadas e **descartadas por medição**:

| Hipótese | Medição | Veredito |
|---|---|---|
| competência × processamento | `ANO_CMPT` uniformemente 2019 | descartada |
| AIH tipo 5 (longa permanência) | 26 de 44.589 registros | descartada |
| `VAL_TOT = 0` (não paga) | 537 (1,2%), = exatamente os `ESPEC='87'` | insuficiente |
| `N_AIH` duplicado | 26 (0,06%) | descartada |
| ano de atendimento vs. processamento | 3.496 (7,8%) são internações de 2018; refazendo por `DT_INTER` com arquivos 2019+2020 o desvio vai de +4,14% para +3,45% | real, mas menor |
| scraper perdendo linhas na soma município→UF | 36.564 pares checados, **0 incoerências** | descartada |

**Onde o desvio realmente está.** Como **31 agravos batem exato** e os demais vêm sempre *a mais*,
não é filtro global — se fosse, nenhum bateria. É o matcher atribuindo registros a mais em
categorias específicas: faixas CID onde uma categoria "restante de…" absorve o que o TabNet manda
para uma categoria mais estreita. Os maiores desvios são obstétricos (+15% edema/hipertensão da
gravidez, +11% complicações do puerpério), apêndice (+15%) e diabetes (+14%); os menores são
colelitíase (+2,9%), aborto (+2,9%) e anemia (+1,2%). É depurável categoria a categoria contra os
85 pares já coletados.

## 6. Achado colateral: o estado real da coleta atual

Levantando os CSVs de `trabalhos datasus/outputs/coleta_sih_multi/`:

- **424 dos 654 CSVs têm 0 bytes** (65%)
- **212 agravos estão inteiramente vazios**, nos dois grãos — só 115 têm qualquer conteúdo
- dos que têm conteúdo, **84 de 85 trazem só `internacoes`** — sem óbitos, valor ou dias
- diretórios com nome de tombstone ainda existem: `avc`, `ait` (confirma a premissa do CR-04)

O pipeline registrou 341 agravos como coletados. Dois terços não têm nada dentro.

## Recomendação para a Fase 9

1. Pinar `pysus==1.0.1` (não a 2.x) e registrar o porquê, para ninguém "atualizar" e quebrar.
2. Enumerar os arquivos esperados de forma determinística (`RD{UF}{AA}{MM}`, 27 × 12 × N anos) e
   tratar ausência como falha ruidosa — é a propriedade que a fase quer.
3. Fechar a reconciliação **antes** de trocar a fonte que serve o estudante: o alvo é explicar o
   +4%, não apenas medi-lo. Enquanto não fechar, o número exibido mudaria sem justificativa.
4. Considerar abrir issue upstream sobre o índice da 2.7.0.

## Reprodução

Scripts do spike (scratchpad, não versionados): `cidmatch.py`, `reconcilia.py`, `comparar.py`,
`diag.py`. O ambiente é um venv Python 3.11 com `pysus==1.0.1` criado via `uv`.
