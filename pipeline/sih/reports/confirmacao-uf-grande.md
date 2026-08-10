# Confirmação SC-7 em UF grande — SP/2019 (09-11 Task 1, D-03)

**Data:** 2026-08-10
**UF escolhida:** SP (São Paulo) — **ano:** 2019
**Regra deste plano:** confirmar, **não redepurar**. `cid-corrections.json` não foi alterado
nesta task — `git diff --stat scripts/catalog/cid-corrections.json` permanece vazio do início ao
fim (conferido antes e depois da agregação).

## Por que SP, e por que este oráculo não é o do 09-05

O oráculo re-raspado do 09-05 (`oracle_tabnet.json`) cobre **só AC/2019** (98 pares, todos
`uf=AC`) — nenhum par de SP ou MG. A instrução original deste plano ("escolher a UF com mais
pares no oráculo re-raspado do 09-05") pressupunha um oráculo multi-UF que não existe; a
confirmação em UF grande precisa do próprio método do 09-05 aplicado a uma UF nova, não de um
oráculo já pronto.

Construído então um oráculo candidato pelo mesmo método do 09-05:

1. Para cada um dos 342 diretórios de `trabalhos datasus/outputs/coleta_sih_multi/`, o
   `tabnetCode` foi lido do `metadata.json` daquele diretório — **nunca** do nome do diretório
   (que é id pré-migração da Fase 8, T-09-21) — e resolvido para o id canônico via
   `scripts/catalog/diseases.json`.
2. Contados os pares com `internacoes` não vazio em 2019 nos CSVs `base_*_uf_2013_2025.csv`:
   **SP = 113 pares candidatos**, **MG = 112 pares candidatos**. SP tem mais — critério do plano
   ("a que tiver mais pares") aplicado ao oráculo que este plano precisou construir, já que o do
   09-05 não cobre nenhuma das duas.
3. Os 113 candidatos de SP foram **re-raspados ao vivo** contra o TabNet
   (`oracle_scrape.scrape_pairs`, `REQUEST_DELAY_SEC=1.5` respeitado) e comparados contra o valor
   guardado no CSV do corpus legado (D-04) — **113/113 reproduziram exatamente**, 0 descartes,
   nenhum retry necessário (nenhum timeout na corrida).

O oráculo de SP/2019 resultante (113 pares) é um artefato de trabalho desta confirmação, não uma
fixture do gate — o gate permanente (Task 3) continua sendo só AC/2019 (D-06: recorte pequeno,
~140–250 KB, nunca 10 GB).

## Preparação do recorte de dados

O cache local (`~/.lacir/sih-cache/parquet/`) já tinha os 12 arquivos de AC/2019 (mais 2 de
AC/2013, resíduo de trabalho anterior). Os 12 arquivos de SP/2019 (`RDSP1901`..`RDSP1912`) **não**
estavam em cache — a corrida completa do 09-04 ainda não rodou (`STATE.md` §Bloqueios abertos).
Baixados só esses 12 via `download --only`, nunca a corrida completa:

```
uv run python -m sih_pipeline.cli download --only RDSP1901 RDSP1902 ... RDSP1912
```

Resultado: 12 arquivos, 2.659.863 registros acumulados no ledger (AC+SP), ~148 MB de parquet total
em cache. Disco verificado antes (`df -h /`: ~11 GiB livres) e depois (sem variação relevante) —
nenhum risco de esgotar o disco do operador. Nenhum `.parquet`/`.dbc` foi adicionado ao git
(`git status --short | grep -cE '\.(parquet|dbc)$'` = 0 — parquet/dbc vivem só no cache local,
fora do repositório, coberto pelo `.gitignore` do pipeline).

## Rodando `reconcile.compare` — correções já aplicadas, nada alterado

`reconcile.compare()` chamado exatamente como `reconcile.main()` já roda em produção: mapa CID
com `cid-corrections.json` aplicado (4 entradas, inalteradas), índice pré-compilado, agregação
filtrada `grao=uf` + `local=ocorrencia`, tradução de código IBGE para sigla via
`UF_POR_CODIGO`, comparado contra o oráculo de SP/2019 e `cid-divergencias.json` (9 entradas,
inalteradas).

## Resultado medido

| Métrica | Valor |
|---|---|
| Pares conferidos | **113** |
| Exato (delta 0) | **8** |
| Explicado (divergência com razão escrita, `compare()` concorda) | **7** |
| **Inexplicado** | **98** |
| Extras (chaves do agregado sem par no oráculo) | 2.253 (esperado — o oráculo cobre só um subconjunto; nunca afeta `result.ok`, D-02) |

`ReconciliationResult.ok` = **False** para SP/2019 (98 inexplicados > 0) — o mesmo veredito de
AC/2019 (09-08), só que numa escala maior.

### Categorias exercitadas em SP/2019 que tinham ZERO registros em AC/2019

**35 categorias** têm `internacoes > 0` em SP/2019 (grão UF, local ocorrência) mas **nenhum**
registro em AC/2019 na mesma medida — a categoria inteira era invisível à depuração do 09-08
porque o Acre nunca a exercitou. Esta é a medida direta do D-03: "uma categoria vazia no Acre
passaria verde por vacuidade".

```
assistencia_e_exame_pos_natal          conjuntivite_e_outros_transtornos_da_conjuntiva
brucelose                              colera
cegueira_e_visao_subnormal             deficiencia_de_vitamina_a
descolamentos_e_defeitos_da_retina     difteria
doencas_por_clamidias_transmitidas_por_via_sexual   espinha_bifida
estado_infec_assint_virus_da_imunodef_humana_hiv    febre_amarela
infeccao_gonococica                    infertilidade_feminina
leishmaniose_visceral                  mening_em_doenc_infec_parasit_class_outr_part
nascidos_vivos_segundo_o_local_de_nascimento        neoplasia_benigna_dos_orgaos_urinarios
outr_pess_riscos_pot_a_saude_rel_doencas_transmiss  outras_deficiencias_vitaminicas
outros_tetanos                         perda_de_audicao
peste                                  rastreamento_pre_natal_e_outr_superv_da_gravidez
rubeola                                sarampo
sequelas_de_desnutricao_e_de_outras_defic_nutric    sequelas_de_poliomielite
sequelas_de_tuberculose                sinusite_cronica
tifo_exantematico                      tireotoxicose
tracoma                                transtornos_da_refracao_e_da_acomodacao
tuberculose_do_aparelho_geniturinario
```

Note-se: 5 destas 35 (`difteria`, `outros_tetanos`, `peste`, `febre_amarela`,
`infeccao_gonococica`, `tuberculose_do_aparelho_geniturinario`) estão entre as que bateram
**exato** em SP — a categoria era literalmente invisível no AC (zero registros) e, mesmo assim,
bate número exato contra o TabNet em SP. Isso é evidência a favor da faixa CID declarada para
essas categorias, não contra.

## Achado 1 (confirmado, não novo): as duas colisões residuais do 09-08 são MUITO mais materiais em SP

O `09-08-SUMMARY.md` deixou dois achados com correção aplicada mas sem efeito mensurável em
AC/2019, por causa de colisão com um código vizinho que vence por ordem de inserção:

| Categoria | tabnetCode | Faixa nova (já aplicada) | Ausente em AC/2019 | Ausente em SP/2019 |
|---|---|---|---|---|
| `tuberculose_miliar` | 14 | B90 → A19 (colide com código 9, que já reivindica A19) | sim, TabNet=3 | **sim, TabNet=133** |
| `doencas_infecciosas_e_parasitarias_congenitas` | 274 | G02 → P35-P37 (colide com código 77, que já reivindica P35-P37) | sim, TabNet=50 | **sim, TabNet=1.992** |

Em AC, a colisão custava 3 e 50 internações "invisíveis" — perceptível, mas pequeno o bastante
para não saltar aos olhos. Em SP, a mesma colisão custa **133 e 1.992 internações inteiramente
ausentes do agregado**, uma ordem de grandeza maior. Isto é a prova direta, medida, de que a
colisão dos códigos `9`/`77` (ainda sem faixa correta determinada — precisa de `nibr.def` ao vivo
ou revisão clínica) não é um detalhe cosmético do Acre: numa UF grande ela apaga quase 2 mil
internações reais de uma categoria clínica (doenças infecciosas/parasitárias congênitas do
recém-nascido). Recomendado para o checkpoint (Task 2) com peso maior do que o relatório do 09-08
sozinho sugeria.

## Achado 2 (novo, não exercitado em AC): 7 categorias com delta extremo, sem colisão estrutural de faixa

Além dos 89 pares "inexplicado" cujo delta acompanha o padrão já documentado pelo 09-08 (viés
positivo moderado, mediana **+5,10%**, consistente com o efeito de competência de processamento
`ANO_CMPT` vs `DT_INTER` medido pelo spike de 2026-08-04 — a mediana de SP é da mesma ordem de
grandeza da mediana de AC, +7,90%), **7 categorias** têm delta muito acima desse padrão:

| Categoria | tabnetCode | Faixa CID declarada | Agregado | TabNet | Delta |
|---|---|---|---|---|---|
| `restante_de_outras_tuberculoses` | 15 | A65-A67, A69-A70, A74, A77-A79, B58-B64, B85-B89, B94-B99 | 2.557 | 72 | **+3.451,39%** |
| `demencia` | 132 | F00-F03 | 3.986 | 521 | **+665,07%** |
| `tuberculose_pulmonar` | 7 | A15.0-A15.3, A16.0-A16.3 | 4.762 | 2.287 | **+108,22%** |
| `doenca_de_parkinson` | 145 | G20 | 326 | 221 | **+47,51%** |
| `tuberculose_do_sistema_nervoso` | 10 | A17 | 112 | 76 | **+47,37%** |
| `doenca_de_alzheimer` | 146 | G30 | 590 | 405 | **+45,68%** |
| `tuberc_intest_peritonio_glangl_mesentericos` | 11 | A18.3 | 26 | 18 | **+44,44%** |

**Investigação de faixa (sem alterar nada, D-03):** conferido se alguma dessas 7 faixas colide
estruturalmente com um código vizinho, do mesmo jeito que os pares 75/76 e 142/274 colidiam
(script de sobreposição do 09-RESEARCH, aplicado manualmente às faixas F00-F03/F04-F09 e ao bloco
A15-A18/A65-A99 do capítulo de tuberculose) — **nenhuma sobreposição de faixa encontrada**. As
sete faixas declaradas são as oficiais e não reivindicam território de nenhum código vizinho.

Isso significa que o mecanismo, seja ele qual for, **não é** o mesmo das colisões estruturais
75/76, 142/274 ou 9/14/77/274 — é outra coisa, que o recorte de AC/2019 nunca exercitou o volume
suficiente para revelar (das 7, só `tuberc_intest_peritonio_glangl_mesentericos` e
`tuberculose_do_sistema_nervoso` aparecem no oráculo AC/2019 original, e nenhuma delas está entre
os pares de maior delta absoluto que o 09-08 investigou lá). Quatro das sete (`15`, `7`, `10`,
`11`) pertencem ao capítulo de tuberculose (junto dos dois achados já conhecidos, `9`/`14`) — um
padrão que sugere que o bloco de tuberculose do mapa CID pode ter mais de uma inconsistência além
das duas já identificadas, mas **isto é hipótese, não conclusão**: nenhuma faixa foi alterada,
nenhuma investigação de `DIAG_PRINC` real foi conduzida nesta task (isso seria redepurar, D-03).

**Não corrigido aqui.** São achados a levar ao 09-08 como trabalho novo, exatamente como o D-03
prevê ("se a confirmação mostrar categorias inexplicadas que o AC não expôs, elas voltam ao 09-08
como trabalho — mas isso é uma decisão a registrar, não um ajuste a fazer aqui").

## Todos os 98 pares inexplicados (SP/2019), ordenados por delta absoluto decrescente

| diseaseId | tabnetCode | agregado | TabNet | delta |
|---|---|---|---|---|
| doencas_infecciosas_e_parasitarias_congenitas | 274 | — (ausente) | 1992 | ausente |
| tuberculose_miliar | 14 | — (ausente) | 133 | ausente |
| restante_de_outras_tuberculoses | 15 | 2557 | 72 | +3451,39% |
| demencia | 132 | 3986 | 521 | +665,07% |
| tuberculose_pulmonar | 7 | 4762 | 2287 | +108,22% |
| doenca_de_parkinson | 145 | 326 | 221 | +47,51% |
| tuberculose_do_sistema_nervoso | 10 | 112 | 76 | +47,37% |
| doenca_de_alzheimer | 146 | 590 | 405 | +45,68% |
| tuberc_intest_peritonio_glangl_mesentericos | 11 | 26 | 18 | +44,44% |
| tuberculose_ossea_e_das_articulacoes | 12 | 37 | 29 | +27,59% |
| brucelose | 17 | 5 | 4 | +25,00% |
| hanseniase_lepra | 18 | 233 | 187 | +24,60% |
| doenca_pelo_virus_da_imunodeficiencia_humana_hiv | 51 | 4788 | 3966 | +20,73% |
| doencas_por_clamidias_transmitidas_por_via_sexual | 33 | 7 | 6 | +16,67% |
| doencas_sistemicas_do_tecido_conjuntivo | 228 | 1715 | 1494 | +14,79% |
| outras_tuberculoses_respiratorias | 8 | 802 | 713 | +12,48% |
| anomalias_cromossomicas_ncop | 290 | 173 | 156 | +10,90% |
| outras_formas_de_leptospirose | 26 | 23 | 21 | +9,52% |
| hipertensao_essencial_primaria | 169 | 9699 | 8871 | +9,33% |
| ausencia_atresia_e_estenose_do_intestino_delgado | 282 | 37 | 34 | +8,82% |
| doenca_de_hodgkin | 105 | 1734 | 1598 | +8,51% |
| doenca_hemolitica_do_feto_e_do_recem_nascido | 276 | 947 | 876 | +8,11% |
| deformidades_congenitas_do_quadril | 286 | 310 | 287 | +8,01% |
| embolia_e_trombose_arteriais | 183 | 5709 | 5287 | +7,98% |
| septicemia | 24 | 34216 | 31746 | +7,78% |
| doenca_de_crohn_e_colite_ulcerativa | 213 | 1474 | 1370 | +7,59% |
| cert_compl_prec_traum_compl_cirurg_ass_medic_ncop | 312 | 23295 | 21671 | +7,49% |
| encefalite_viral | 40 | 264 | 246 | +7,32% |
| restante_de_outras_doencas_bacterianas | 28 | 26708 | 24897 | +7,27% |
| bronquiectasia | 201 | 192 | 179 | +7,26% |
| fratura_do_cranio_e_dos_ossos_da_face | 295 | 5808 | 5418 | +7,20% |
| outras_doencas_vasculares_perifericas | 182 | 3271 | 3058 | +6,97% |
| outras_doencas_das_arterias_arteriolas_e_capilares | 184 | 6768 | 6339 | +6,77% |
| doenca_reumatica_cronica_do_coracao | 168 | 1350 | 1265 | +6,72% |
| alguns_transtornos_envolvendo_mecanismo_imunitario | 120 | 210 | 197 | +6,60% |
| outras_doencas_do_coracao | 176 | 6517 | 6119 | +6,50% |
| doenca_alcoolica_do_figado | 217 | 3459 | 3248 | +6,50% |
| embolia_pulmonar | 173 | 2999 | 2819 | +6,39% |
| febres_tifoide_e_paratifoide | 2 | 17 | 16 | +6,25% |
| sifilis_precoce | 30 | 51 | 48 | +6,25% |
| outras_sifilis | 31 | 376 | 354 | +6,21% |
| hipoxia_intrauterina_e_asfixia_ao_nascer | 272 | 1197 | 1127 | +6,21% |
| caxumba_parotidite_epidemica | 52 | 104 | 98 | +6,12% |
| febres_recorrentes | 35 | 126 | 119 | +5,88% |
| ileo_paralitico_e_obstrucao_intestinal_sem_hernia | 214 | 9901 | 9351 | +5,88% |
| infeccao_meningococica | 23 | 223 | 211 | +5,69% |
| acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem | 179 | 31390 | 29721 | +5,62% |
| afecc_hemorrag_e_outr_doenc_sang_e_org_hematopoet | 119 | 5152 | 4886 | +5,44% |
| sifilis_congenita | 29 | 2372 | 2254 | +5,24% |
| acid_vascular_cerebr_isquem_transit_e_sindr_correl | 150 | 4657 | 4426 | +5,22% |
| infeccoes_da_pele_e_do_tecido_subcutaneo | 222 | 18663 | 17778 | +4,98% |
| efeitos_toxicos_subst_origem_princ_nao_medicinal | 309 | 3537 | 3371 | +4,92% |
| bronquite_enfisema_e_outr_doenc_pulm_obstr_cronic | 199 | 18650 | 17799 | +4,78% |
| coqueluche | 22 | 232 | 222 | +4,50% |
| dor_abdominal_e_pelvica | 291 | 9515 | 9109 | +4,46% |
| desnutricao | 125 | 3486 | 3340 | +4,37% |
| doenca_diverticular_do_intestino | 215 | 3955 | 3790 | +4,35% |
| leptospirose_icterohemorragica | 25 | 49 | 47 | +4,26% |
| doencas_renais_tubulo_intersticiais | 237 | 12766 | 12248 | +4,23% |
| enxaqueca_e_outras_sindromes_de_algias_cefalicos | 149 | 2096 | 2011 | +4,23% |
| flebite_tromboflebite_embolia_e_trombose_venosa | 185 | 12597 | 12087 | +4,22% |
| artrose | 225 | 5952 | 5712 | +4,20% |
| ceratite_e_outros_transtornos_esclerotica_e_cornea | 156 | 1724 | 1655 | +4,17% |
| artrite_reumatoide_e_outr_poliartropatias_inflamat | 224 | 1876 | 1802 | +4,11% |
| deformidades_adquiridas_das_articulacoes | 226 | 2583 | 2483 | +4,03% |
| outras_doencas_do_olho_e_anexos | 163 | 7165 | 6897 | +3,89% |
| leptospirose_nao_especificada | 27 | 384 | 370 | +3,78% |
| carie_dentaria | 204 | 341 | 329 | +3,65% |
| asma | 200 | 10059 | 9711 | +3,58% |
| anemia_por_deficiencia_de_ferro | 117 | 2500 | 2415 | +3,52% |
| descolamentos_e_defeitos_da_retina | 158 | 6012 | 5809 | +3,49% |
| cistite | 240 | 2779 | 2686 | +3,46% |
| colera | 1 | 31 | 30 | +3,33% |
| carcinoma_in_situ_de_colo_do_utero | 109 | 871 | 843 | +3,32% |
| deformidades_congenitas_dos_pes | 287 | 1309 | 1267 | +3,31% |
| cegueira_e_visao_subnormal | 162 | 32 | 31 | +3,23% |
| diarreia_e_gastroenterite_origem_infecc_presumivel | 5 | 11132 | 10790 | +3,17% |
| aborto_por_razoes_medicas | 259 | 504 | 489 | +3,07% |
| hiperplasia_da_prostata | 242 | 5304 | 5151 | +2,97% |
| otite_media_e_outr_transt_ouvido_medio_apof_mast | 164 | 3930 | 3827 | +2,69% |
| efeitos_corpo_estranho_atraves_de_orificio_natural | 306 | 3541 | 3450 | +2,64% |
| amebiase | 4 | 39 | 38 | +2,63% |
| laringite_e_traqueite_agudas | 190 | 2068 | 2015 | +2,63% |
| deplecao_de_volume | 130 | 4696 | 4579 | +2,56% |
| aborto_espontaneo | 258 | 13700 | 13361 | +2,54% |
| bronquite_aguda_e_bronquiolite_aguda | 194 | 18217 | 17771 | +2,51% |
| endometriose | 251 | 2253 | 2198 | +2,50% |
| estrabismo | 160 | 1566 | 1530 | +2,35% |
| colelitiase_e_colecistite | 219 | 62155 | 60731 | +2,34% |
| outras_infeccoes_com_transm_predominant_sexual | 34 | 632 | 619 | +2,10% |
| doenca_inflamatoria_do_colo_do_utero | 249 | 58 | 57 | +1,75% |
| anticoncepcao | 317 | 34914 | 34330 | +1,70% |
| hidrocele_e_espermatocele | 244 | 2964 | 2919 | +1,54% |
| assistencia_e_exame_pos_natal | 320 | 289 | 285 | +1,40% |
| doencas_cronicas_das_amigdalas_e_das_adenoides | 197 | 17170 | 17023 | +0,86% |
| dengue_dengue_classsico | 42 | 10238 | 10168 | +0,69% |
| catarata_e_outros_transtornos_do_cristalino | 157 | 29478 | 29325 | +0,52% |
| conjuntivite_e_outros_transtornos_da_conjuntiva | 155 | 1690 | 1682 | +0,48% |

## Pares explicados (7) — mesmas 7 razões escritas do 09-08, confirmadas em SP

As 7 divergências que o 09-08 escreveu para AC (doenças do apêndice, diabetes mellitus, edema
hipertensivo da gravidez, complicações do puerpério NCOP, outras doenças infecciosas intestinais,
infarto cerebral, insuficiência cardíaca) continuam com delta positivo em SP e o `compare()`
concede exatamente o mesmo tratamento (`explicado`), porque a razão escrita para cada uma cita o
mecanismo geral (competência de processamento `ANO_CMPT`/`DT_INTER`), não um número específico do
Acre — a razão se sustenta fora do recorte em que foi escrita, o que é evidência a favor da
qualidade dela.

## Pares exatos (8)

`difteria`, `equinococose`, `febre_amarela`, `infeccao_gonococica`, `outros_tetanos`, `peste`,
`shiguelose`, `tuberculose_do_aparelho_geniturinario` — todas categorias de baixo volume absoluto
em SP (3 a 50 internações), onde o viés percentual do efeito de competência de processamento fica
pequeno demais para deslocar a contagem inteira.

## Estado final e conclusão desta task

| Métrica | AC/2019 (09-08) | SP/2019 (esta task) |
|---|---|---|
| Pares conferidos | 98 | 113 |
| Exato | 33 | 8 |
| Explicado | 7 | 7 |
| Inexplicado | 58 | 98 |
| `result.ok` | False | False |

A confirmação em SP **não fecha o SC-7** — nem tinha esse objetivo (D-03 é sobre confirmar a
correção existente fora do recorte de depuração, não sobre fechar a barra). O que ela prova, com
número medido:

1. **A vacuidade do AC é real e mensurável.** 35 categorias inteiras eram invisíveis à depuração
   do 09-08 por terem zero registros no Acre; 5 delas batem exato em SP, o que sustenta (não
   prova sozinho) que as faixas CID declaradas para elas estão corretas.
2. **As duas colisões residuais (`9`/`14`, `77`/`274`) são muito mais materiais do que a
   depuração do AC sugeria** — 133 e 1.992 internações reais ausentes do agregado em SP contra 3
   e 50 no Acre. Peso maior para o checkpoint decidir sobre elas.
3. **Um achado novo**: 7 categorias (4 delas do capítulo de tuberculose) com delta extremo
   (25%–3.451%) que o AC nunca exercitou com volume suficiente para revelar, e cuja faixa CID não
   apresenta sobreposição estrutural óbvia com nenhum código vizinho — mecanismo desconhecido,
   não investigado além da checagem de sobreposição (redepurar está fora do escopo desta task,
   D-03). Recomendado como trabalho novo para o 09-08.
4. **A maioria (89/98) segue o padrão já documentado**: viés positivo moderado (mediana +5,10%
   em SP, +7,90% em AC — mesma ordem de grandeza), consistente com o efeito de competência de
   processamento já medido pelo spike de 2026-08-04.

Nenhuma correção foi alterada nesta task. `git diff --stat scripts/catalog/cid-corrections.json`
permanece vazio. Estes achados (a materialidade maior das duas colisões conhecidas, o achado novo
de 7 categorias extremas, e o resíduo honesto de 58 pares inexplicados do AC que o 09-08 já havia
levado ao checkpoint) seguem juntos para o checkpoint clínico da Task 2 deste plano.

## Checkpoint clínico (Task 2) — decisões do operador, 2026-08-10

O operador respondeu o checkpoint em lote (D-07) com quatro decisões. Registro aqui o resultado;
os arquivos JSON (`scripts/catalog/cid-corrections.json` e `scripts/catalog/cid-divergencias.json`)
são a fonte de verdade — este é só um resumo legível.

**Decisão 1 — as 4 correções de faixa CID: APROVADAS como estão.** `75` (B92→B91), `74`
(B91→B90), `14` (B90→A19), `274` (G02→P35-P37). Cada entrada de `cid-corrections.json` ganhou um
campo `aprovacaoClinica` datado, citando a evidência que sustentou a aprovação (incluindo a
medição desta Task 1 em SP/2019). Para a `274`, a aprovação registra explicitamente que
`P35-P37` é a melhor aproximação textual encontrada, **não** um título CID-10 exato como as
outras três — aprovação consciente da aproximação, não descuido.

**Decisão 2 — resíduo de 58/98 pares inexplicados do AC: aceito como divergência de lote.** O que
pesou foi a medição desta Task 1 em SP/2019 (mediana +5,10% em 89/98 pares, mesma ordem de
grandeza do +7,90% do AC) — a hipótese de competência de processamento (`ANO_CMPT` vs `DT_INTER`)
deixou de ser de uma UF só e passou a estar confirmada em duas UFs independentes. 53 novas entradas
em `cid-divergencias.json` (58 menos os 2 já ausentes — `14`/`274` — e menos 3 excluídas
deliberadamente por decisão 4 — `7`/`146`/`10`), cada uma com o mecanismo nomeado, as duas medições
que o sustentam, as hipóteses alternativas descartadas por medição (faixa larga absorvendo
estreita, AIH tipo 5, `N_AIH` duplicado, erro de agregação do scraper), e a honestidade explícita
de que o mecanismo **reduz mas não zera** o viés.

**Decisão 3 — códigos `9` e `77`: NÃO aceito como divergência honesta, volta ao 09-08.** O
operador quer investigação para determinar as faixas corretas, não uma divergência registrada. O
que pesou: as duas correções aprovadas na decisão 1 (`14`, `274`) ficam sem efeito enquanto isso
não for resolvido, e a Task 1 mediu 2.254 internações reais (164 A19 + 2.090 P35-P37) atribuídas
ao código errado em SP/2019, contra 56 no AC. Registrado como ficha de pendência
`PENDENTE_colisao_codigos_9_e_77` em `cid-divergencias.json`, com `bloqueiaUpload: true` e
`mecanismoIdentificado: false` — um `diseaseId` sintético que nunca casa com nenhum par real do
oráculo, então não é resgatado por `compare()` como "explicado": os pares `14`/`274` continuam
`ausente`/`inexplicado` no gate, exatamente como devem.

**Decisão 4 — as 7 categorias de delta extremo: NÃO aceito como divergência honesta, volta ao
09-08.** `+3.451%` (`restante_de_outras_tuberculoses`) e `+665%` (`demência`) são grandes demais
para o mecanismo de competência de processamento explicar; a concentração no capítulo de
tuberculose (4 das 7) reforça a suspeita de defeito estrutural ainda não mapeado. Registrado como
ficha de pendência `PENDENTE_sete_categorias_delta_extremo_sp` em `cid-divergencias.json`, mesmo
padrão de `diseaseId` sintético. Três das sete (`7`/`146`/`10`) já apareciam inexplicadas em
AC/2019 com delta menor (+12,12%/+50%/+50%) e foram deliberadamente **excluídas** da divergência
de lote da decisão 2, para que o gate do AC/2019 (Task 3) continue refletindo esta pendência sem
inventar explicação. As outras três (`132`/`145`/`11`) batem **exato** em AC/2019 (volumes de
17/3/1 casos) — só a escala de SP revelou a divergência real; a sétima (`15`) nem aparece no
oráculo AC/2019.

**Resultado medido em AC/2019 após as decisões 1 e 2:** `exato=33, explicado=60, inexplicado=5,
result.ok=False`. Os 5 inexplicados restantes são exatamente os 5 códigos das decisões 3/4 que o
operador determinou não resolver agora: `146` (doença de Alzheimer), `274` (doenças infecciosas e
parasitárias congênitas, ausente), `10` (tuberculose do sistema nervoso), `14` (tuberculose
miliar, ausente), `7` (tuberculose pulmonar). Isto é o comportamento correto e esperado — o gate
não pode fingir sucesso sobre uma pendência que o operador explicitamente manteve aberta.

**Estas duas pendências (decisões 3 e 4) BLOQUEIAM o upload do 09-10** — ver SUMMARY deste plano,
seção "Bloqueia o 09-10", para os números completos.
