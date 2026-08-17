# Aposentadoria das divergências de lote de `cid-divergencias.json`

*Decidido e medido em 2026-08-17 (09-16). `scripts/catalog/cid-divergencias.json` passou de 64
entradas para `[]`.*

## A decisão, em uma linha

**As 64 entradas explicavam um resíduo que não existe. Foram aposentadas, e o arquivo ficou
vazio — não porque incomodavam, mas porque foi MEDIDO que nenhuma delas é consultada e que o
delta que cada uma alegava é zero quando as duas pontas medem a mesma população.**

## O que elas alegavam

61 das 64 entradas diziam alguma variação de:

> O excedente de N internações sobre o valor do TabNet é consistente com o efeito de competência
> de processamento (`ANO_CMPT`) vs. data real de internação (`DT_INTER`) medido no spike de
> 2026-08-04.

Ou seja: elas **nomeavam o mecanismo certo** (competência de faturamento × data de internação),
mas o registravam como uma divergência aceita e permanente do agregado — quando era, na verdade,
um artefato da comparação, corrigível.

As outras 3: `tuberculose_miliar` (colisão dos códigos 9/77, resolvida em 09-08 por
`cid-corrections.json`) e as duas `PENDENTE_*`, ambas já com `bloqueiaUpload: false`.

## Por que estão aposentadas — a medição, não a opinião

### Prova 1 — nenhuma é consultada

`scripts/catalog/cid-divergencias.json` com `[]` produz resultado **byte-idêntico** em toda a
suíte: `318 passed, 1 skipped` e `catalog:validate OK`, exatamente como com as 64 entradas.
Congelado como teste permanente em
`test_gate_paridade_bem_formada_nao_depende_de_nenhuma_divergencia_de_lote`.

Isso já bastava para dizer que estavam inertes. Mas inerte não é o mesmo que errada, e a segunda
prova é a que importa.

### Prova 2 — o delta que cada uma alegava é ZERO quando medido direito

Raspando o TabNet com a janela de competência correta (`janela=1`, 24 arquivos, medindo o ano de
internação em vez do ano de faturamento) e comparando contra o agregado por `DT_INTER`:

**Todas as 61 entradas de lote batem EXATO — delta zero — nos 98 pares de AC/2019.**

### Prova 3 — o que elas mediam era a lacuna da consulta ingênua

O delta que cada entrada alegava correlaciona fortemente com a lacuna que a consulta INGÊNUA do
TabNet (12 arquivos de um ano) produz hoje, medida ao vivo:

| | valor |
|---|---|
| Correlação de Pearson (delta alegado × lacuna ingênua medida) | **0,777** |
| Mediana do delta alegado | 8,70% |
| Mediana da lacuna ingênua medida | 8,11% |
| Entradas em que os dois batem até 0,01 p.p. | 10 de 60 |

Não é identidade (0,777, não 1,0) — e não deveria ser: os deltas originais foram medidos contra
agregados por `ANO_CMPT`, que é uma terceira quantidade, nem o ano de internação nem a competência
submetida. Mas é a mesma família de fenômeno, com a mesma ordem de grandeza e o mesmo sinal.

**A leitura honesta:** a "divergência de lote" nunca foi um fenômeno do dado. Era a janela de
competência, medida sob outro nome e promovida a explicação permanente.

## O registro do que foi aposentado

`deltaPct alegado` é o que a entrada dizia; `paridade bem-formada` e `lacuna ingênua` são o que
foi medido em 2026-08-17 nos mesmos pares.

| agravo | tabnetCode | deltaPct alegado | paridade bem-formada | lacuna ingênua medida |
|---|---|---|---|---|
| `doencas_infecciosas_e_parasitarias_congenitas` | 274 | -100.0% | EXATO (0) | +12.00% |
| `infeccao_meningococica` | 23 | 100.0% | EXATO (0) | +100.00% |
| `hipoxia_intrauterina_e_asfixia_ao_nascer` | 272 | 52.17% | EXATO (0) | +30.43% |
| `embolia_e_trombose_arteriais` | 183 | 40.0% | EXATO (0) | +20.00% |
| `aborto_por_razoes_medicas` | 259 | 33.33% | EXATO (0) | +33.33% |
| `doencas_sistemicas_do_tecido_conjuntivo` | 228 | 30.0% | EXATO (0) | +20.00% |
| `deformidades_congenitas_dos_pes` | 287 | 28.57% | EXATO (0) | +0.00% |
| `doenca_de_hodgkin` | 105 | 25.0% | EXATO (0) | +25.00% |
| `infarto_cerebral` | 178 | 24.81% | EXATO (0) | +12.21% |
| `outras_formas_de_leptospirose` | 26 | 20.0% | EXATO (0) | +0.00% |
| `outras_tuberculoses_respiratorias` | 8 | 18.18% | EXATO (0) | +0.00% |
| `insuficiencia_cardiaca` | 175 | 15.96% | EXATO (0) | +10.64% |
| `doenca_pelo_virus_da_imunodeficiencia_humana_hiv` | 51 | 15.87% | EXATO (0) | +7.94% |
| `flebite_tromboflebite_embolia_e_trombose_venosa` | 185 | 15.19% | EXATO (0) | +21.52% |
| `deplecao_de_volume` | 130 | 14.29% | EXATO (0) | +0.00% |
| `outras_doencas_do_olho_e_anexos` | 163 | 14.29% | EXATO (0) | +5.71% |
| `doencas_do_apendice` | 210 | 13.36% | EXATO (0) | +14.86% |
| `cert_compl_prec_traum_compl_cirurg_ass_medic_ncop` | 312 | 12.75% | EXATO (0) | +7.72% |
| `septicemia` | 24 | 12.61% | EXATO (0) | +16.81% |
| `embolia_pulmonar` | 173 | 12.5% | EXATO (0) | +0.00% |
| `diabetes_mellitus` | 124 | 12.44% | EXATO (0) | +14.39% |
| `ileo_paralitico_e_obstrucao_intestinal_sem_hernia` | 214 | 12.04% | EXATO (0) | +13.89% |
| `dengue_dengue_classsico` | 42 | 11.36% | EXATO (0) | +5.30% |
| `artrite_reumatoide_e_outr_poliartropatias_inflamat` | 224 | 10.0% | EXATO (0) | +3.33% |
| `doenca_de_crohn_e_colite_ulcerativa` | 213 | 10.0% | EXATO (0) | +0.00% |
| `outras_doencas_infecciosas_intestinais` | 6 | 9.93% | EXATO (0) | +5.96% |
| `enxaqueca_e_outras_sindromes_de_algias_cefalicos` | 149 | 9.8% | EXATO (0) | +9.80% |
| `edema_protein_transt_hipertens_gravid_parto_puerp` | 261 | 9.41% | EXATO (0) | +15.17% |
| `hidrocele_e_espermatocele` | 244 | 9.38% | EXATO (0) | +0.00% |
| `desnutricao` | 125 | 9.09% | EXATO (0) | +24.24% |
| `hanseniase_lepra` | 18 | 9.09% | EXATO (0) | +4.55% |
| `compl_pred_rel_puerperio_e_outr_afecc_obstetr_ncop` | 268 | 8.3% | EXATO (0) | +11.19% |
| `anticoncepcao` | 317 | 8.18% | EXATO (0) | +0.91% |
| `bronquite_enfisema_e_outr_doenc_pulm_obstr_cronic` | 199 | 7.62% | EXATO (0) | +7.62% |
| `efeitos_corpo_estranho_atraves_de_orificio_natural` | 306 | 7.41% | EXATO (0) | +11.11% |
| `doenca_diverticular_do_intestino` | 215 | 7.14% | EXATO (0) | +21.43% |
| `hipertensao_essencial_primaria` | 169 | 7.14% | EXATO (0) | +3.06% |
| `restante_de_outras_doencas_bacterianas` | 28 | 6.83% | EXATO (0) | +7.51% |
| `doenca_alcoolica_do_figado` | 217 | 6.82% | EXATO (0) | +6.82% |
| `anemia_por_deficiencia_de_ferro` | 117 | 6.75% | EXATO (0) | +1.23% |
| `infeccoes_da_pele_e_do_tecido_subcutaneo` | 222 | 6.73% | EXATO (0) | +10.38% |
| `fratura_do_cranio_e_dos_ossos_da_face` | 295 | 6.1% | EXATO (0) | +10.98% |
| `afecc_hemorrag_e_outr_doenc_sang_e_org_hematopoet` | 119 | 5.68% | EXATO (0) | +9.09% |
| `colelitiase_e_colecistite` | 219 | 5.05% | EXATO (0) | +2.85% |
| `outras_doencas_do_coracao` | 176 | 4.62% | EXATO (0) | +15.61% |
| `dor_abdominal_e_pelvica` | 291 | 4.32% | EXATO (0) | +9.35% |
| `sifilis_congenita` | 29 | 4.3% | EXATO (0) | +16.13% |
| `bronquite_aguda_e_bronquiolite_aguda` | 194 | 4.14% | EXATO (0) | +8.28% |
| `hiperplasia_da_prostata` | 242 | 4.0% | EXATO (0) | +4.00% |
| `asma` | 200 | 3.95% | EXATO (0) | +1.32% |
| `aborto_espontaneo` | 258 | 3.79% | EXATO (0) | +2.90% |
| `leptospirose_nao_especificada` | 27 | 3.45% | EXATO (0) | +3.45% |
| `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` | 179 | 3.28% | EXATO (0) | +31.97% |
| `efeitos_toxicos_subst_origem_princ_nao_medicinal` | 309 | 2.9% | EXATO (0) | +13.04% |
| `cistite` | 240 | 2.82% | EXATO (0) | +2.82% |
| `doencas_renais_tubulo_intersticiais` | 237 | 2.7% | EXATO (0) | +11.71% |
| `outras_doencas_das_arterias_arteriolas_e_capilares` | 184 | 2.7% | EXATO (0) | +16.22% |
| `doenca_reumatica_cronica_do_coracao` | 168 | 2.33% | EXATO (0) | +2.33% |
| `acid_vascular_cerebr_isquem_transit_e_sindr_correl` | 150 | 2.22% | EXATO (0) | +6.67% |
| `doencas_cronicas_das_amigdalas_e_das_adenoides` | 197 | 1.83% | EXATO (0) | +0.92% |
| `diarreia_e_gastroenterite_origem_infecc_presumivel` | 5 | 1.8% | EXATO (0) | +7.91% |

*(As 61 entradas de lote acima; `tuberculose_miliar` e as duas `PENDENTE_*` não constam da tabela
porque não alegavam divergência de lote — ver acima.)*

## O que substitui a explicação

Nada, no sentido de "razão de divergência aceita" — porque não há divergência a aceitar. O que
existe agora é uma **justificativa de metodologia**, que é coisa diferente e vive em outro lugar:

- `pipeline/sih/reports/paridade-AC-2019-sc7.json` — a medição das duas pontas, legível por
  máquina, com `divergencia_pct` e `divergencia_razao` na chave exata de `sih_collection_status`.
- `sih_pipeline.paridade.RAZAO_DIVERGENCIA_JANELA` — a frase única que o app mostra ao aluno.

A diferença é a que esta fase levou duas semanas para aprender: uma **divergência** é dado que
não bate e precisa de desculpa; uma **metodologia** é dado que bate e precisa de explicação. O
que existe aqui é a segunda.

## Reversão

O conteúdo integral das 64 entradas está no histórico do git (commit anterior a esta
aposentadoria) e pode ser restaurado com `git show <sha>:scripts/catalog/cid-divergencias.json`.
Nada foi perdido; foi retirado do caminho de execução, com a medição que autoriza isso registrada
acima.
