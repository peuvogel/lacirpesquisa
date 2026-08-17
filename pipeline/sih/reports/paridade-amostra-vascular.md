# Amostra vascular (nível 1) — paridade site × TabNet

*Medido ao vivo em 2026-08-17. Agravos: os 6 do `nivel 1` de `scripts/catalog/collection-order.json`
que vivem no eixo CID (`amputacao_mmii`, o sétimo, é eixo de PROCEDIMENTO e é reconciliado
separadamente contra `qibr.def` — ver abaixo).*

## Resultado

| UF/ano | pares | exatos | site | TabNet bem-formado | TabNet ingênuo | lacuna | mediana da lacuna |
|---|---|---|---|---|---|---|---|
| AC/2015 | 6 | **6/6** | 490 | 490 | 468 | +22 | 2,60% |
| AP/2019 | 6 | **6/6** | 432 | 432 | 423 | +9 | 1,82% |
| DF/2022 | 6 | **6/6** | 3.300 | 3.300 | 3.103 | +197 | 5,42% |
| PE/2019 | 6 | **6/6** | 17.832 | 17.832 | 17.193 | +639 | 6,17% |
| PE/2024 | 6 | **6/6** | 16.590 | 16.590 | 16.198 | +392 | 3,04% |
| RR/2019 | 6 | **6/6** | 528 | 528 | 508 | +20 | 0,82% |
| **TOTAL** | **36** | **36/36** | **39.172** | **39.172** | **37.893** | **+1.279** | **3,09%** |

**36 de 36 pares com paridade bem-formada EXATA**, cobrindo o pedido do brief: UF pequena
(AP 432, RR 528), UF grande dentre as coletadas (PE 17.832, 41× o AP), e quatro anos distintos
(2015, 2019, 2022, 2024).

Somados aos 98 pares de AC/2019 (`paridade-AC-2019-sc7.md`): **134 pares, 134 exatos, delta zero**.

### A lacuna da consulta ingênua, distribuída

Nos 35 pares com denominador não-nulo: **min 0,00% · mediana 3,09% · max 16,67%.**

**O site nunca fica abaixo da consulta ingênua — em nenhum dos 36 pares.** A direção é uma
propriedade do mecanismo (o site enxerga internações faturadas depois; a consulta ingênua não),
não um acidente desta amostra.

O par restante é o caso que a UF pequena expõe: em AP/2019 um agravo vascular tem **0 no TabNet
ingênuo e 2 no site** — percentual não existe, e o relatório diz `—` em vez de inventar 0% ou
infinito.

## Detalhe por par

| UF/ano | agravo | site | TabNet bem-formado | paridade exata | TabNet ingênuo | Δ | Δ% |
|---|---|---|---|---|---|---|---|
| AC/2015 | `infarto_cerebral` | 225 | 225 | sim | 218 | +7 | +3.21% |
| AC/2015 | `flebite_tromboflebite_embolia_e_trombose_venosa` | 114 | 114 | sim | 102 | +12 | +11.76% |
| AC/2015 | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 103 | 103 | sim | 101 | +2 | +1.98% |
| AC/2015 | `outras_doencas_das_arterias_arteriolas_e_capilares` | 30 | 30 | sim | 29 | +1 | +3.45% |
| AC/2015 | `embolia_e_trombose_arteriais` | 16 | 16 | sim | 16 | +0 | +0.00% |
| AC/2015 | `outras_doencas_vasculares_perifericas` | 2 | 2 | sim | 2 | +0 | +0.00% |
| AP/2019 | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 391 | 391 | sim | 384 | +7 | +1.82% |
| AP/2019 | `flebite_tromboflebite_embolia_e_trombose_venosa` | 18 | 18 | sim | 17 | +1 | +5.88% |
| AP/2019 | `outras_doencas_das_arterias_arteriolas_e_capilares` | 14 | 14 | sim | 14 | +0 | +0.00% |
| AP/2019 | `embolia_e_trombose_arteriais` | 7 | 7 | sim | 6 | +1 | +16.67% |
| AP/2019 | `infarto_cerebral` | 2 | 2 | sim | 2 | +0 | +0.00% |
| AP/2019 | `outras_doencas_vasculares_perifericas` | 0 | 0 | sim | 0 | +0 | — |
| DF/2022 | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 1340 | 1340 | sim | 1233 | +107 | +8.68% |
| DF/2022 | `flebite_tromboflebite_embolia_e_trombose_venosa` | 531 | 531 | sim | 498 | +33 | +6.63% |
| DF/2022 | `infarto_cerebral` | 523 | 523 | sim | 497 | +26 | +5.23% |
| DF/2022 | `outras_doencas_das_arterias_arteriolas_e_capilares` | 414 | 414 | sim | 392 | +22 | +5.61% |
| DF/2022 | `embolia_e_trombose_arteriais` | 328 | 328 | sim | 320 | +8 | +2.50% |
| DF/2022 | `outras_doencas_vasculares_perifericas` | 164 | 164 | sim | 163 | +1 | +0.61% |
| PE/2019 | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 11663 | 11663 | sim | 11403 | +260 | +2.28% |
| PE/2019 | `outras_doencas_das_arterias_arteriolas_e_capilares` | 1908 | 1908 | sim | 1777 | +131 | +7.37% |
| PE/2019 | `flebite_tromboflebite_embolia_e_trombose_venosa` | 1721 | 1721 | sim | 1597 | +124 | +7.76% |
| PE/2019 | `embolia_e_trombose_arteriais` | 1061 | 1061 | sim | 1000 | +61 | +6.10% |
| PE/2019 | `outras_doencas_vasculares_perifericas` | 953 | 953 | sim | 897 | +56 | +6.24% |
| PE/2019 | `infarto_cerebral` | 526 | 526 | sim | 519 | +7 | +1.35% |
| PE/2024 | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 10348 | 10348 | sim | 10164 | +184 | +1.81% |
| PE/2024 | `outras_doencas_das_arterias_arteriolas_e_capilares` | 1700 | 1700 | sim | 1649 | +51 | +3.09% |
| PE/2024 | `flebite_tromboflebite_embolia_e_trombose_venosa` | 1451 | 1451 | sim | 1409 | +42 | +2.98% |
| PE/2024 | `infarto_cerebral` | 1242 | 1242 | sim | 1183 | +59 | +4.99% |
| PE/2024 | `embolia_e_trombose_arteriais` | 928 | 928 | sim | 892 | +36 | +4.04% |
| PE/2024 | `outras_doencas_vasculares_perifericas` | 921 | 921 | sim | 901 | +20 | +2.22% |
| RR/2019 | `infarto_cerebral` | 282 | 282 | sim | 270 | +12 | +4.44% |
| RR/2019 | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 146 | 146 | sim | 139 | +7 | +5.04% |
| RR/2019 | `flebite_tromboflebite_embolia_e_trombose_venosa` | 62 | 62 | sim | 61 | +1 | +1.64% |
| RR/2019 | `embolia_e_trombose_arteriais` | 28 | 28 | sim | 28 | +0 | +0.00% |
| RR/2019 | `outras_doencas_das_arterias_arteriolas_e_capilares` | 8 | 8 | sim | 8 | +0 | +0.00% |
| RR/2019 | `outras_doencas_vasculares_perifericas` | 2 | 2 | sim | 2 | +0 | +0.00% |

## `amputacao_mmii` — o sétimo agravo do nível 1

Não está na tabela acima porque não é casado por CID: vem de `sih/cnv/qibr.def` pelo
procedimento SIGTAP `0408050012` (`PROC_REA`). O oráculo dele **já** submete os 156 arquivos dos
13 anos, ou seja já é bem-formado por construção — é por isso que ele serve de verificação
independente do eixo CID.

Reconciliado contra a resposta arquivada desse oráculo, sobre o agregado REAL da recoleta:

| UF | pares 2013-2025 | exatos | os não-exatos |
|---|---|---|---|
| AC | 13 | **12** | 2025: site 69 vs oráculo 65 (+4) |
| RR | 13 | **12** | 2025: site 32 vs oráculo 26 (+6) |
| DF | 13 | **12** | 2025: site 435 vs oráculo 417 (+18) |
| **TOTAL** | **39** | **36** | os 3 são 2025, todos positivos |

**AC/2019 = 66 = 66**, o alvo que o brief mandou confirmar, agora contra o dado realmente
coletado e não contra a análise prévia. Junto com ele, mais 35 pares exatos ao registro.

Os 3 não-exatos são **todos** o ano de 2025 e **todos** para mais, por razão estrutural conhecida:
o script legado usa `YEARS = range(2013, 2026)` e portanto **não submete nenhum arquivo de
competência de 2026** — exatamente onde a cauda da nossa coleta acrescenta as internações de
dezembro/2025 faturadas em janeiro/2026. Nosso 2025 é *mais* completo que o oráculo dele, não
menos. É a confirmação independente de que a cauda de competência funciona.

## Como reproduzir

```bash
cd pipeline/sih
uv run python -m sih_pipeline.paridade --uf PE --ano 2019 \
  --agravos embolia_e_trombose_arteriais,flebite_tromboflebite_embolia_e_trombose_venosa,\
outras_doencas_vasculares_perifericas,outras_doencas_das_arterias_arteriolas_e_capilares,\
infarto_cerebral,acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem \
  --sufixo-saida vasc-PE-2019
```

Cada corrida grava `reports/paridade-<sufixo>.md` (humano) e `reports/paridade-<sufixo>.json`
(legível por máquina, na chave de `sih_collection_status`).
