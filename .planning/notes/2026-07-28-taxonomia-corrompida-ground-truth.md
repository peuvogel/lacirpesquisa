# Ground truth: os 20 agravos com `id` corrompido

**Apurado em** 2026-07-28, contra `scripts/catalog/diseases.json`, `scripts/catalog/lista-morb-cid.json` e o Supabase ao vivo (`hmfbxqemububjyhdckrj`).
**Consome isto:** Fase 8 (taxonomia + integridade). Não replanejar sem reler.

## O que exatamente está errado

Apenas o **`id`**. Para os 330 registros, `tabnetCode`, `cid` e `label` são mutuamente consistentes e corretos — verifiquei par a par. O que aconteceu foi que ~20 ids legados escritos à mão (`avc`, `ait`, `varizes_mmii`, …) foram reaproveitados como *slots* na hora de gerar a lista completa da Lista Morb, e cada um herdou o código que calhou de cair naquela posição.

Consequência prática: **nenhum dado precisa ser re-coletado.** As 30.313 linhas UF e 1.099.403 linhas município estão corretas para o código que foi consultado. A migração é uma renomeação pura.

Consequência clínica: os dados reais de AVC **existem** — sob os ids `doencas_arterias` (I63, infarto cerebral) e `aneurisma_aorta` (I64, AVC não especificado). A embolia pulmonar real (I26) está sob `doencas_reumaticas_cronicas`.

## Tabela de renomeação verificada

| id atual (errado) | código | CID-10 | rótulo verdadeiro | slug canônico |
|---|---|---|---|---|
| `avc` | 163 | H02-H06, H20-H22, H30-H32, H34-H36, H43-H48, H51, H53, H55-H59 | Outras doenças do olho e anexos | `outras_doencas_do_olho_e_anexos` |
| `ait` | 164 | H65-H75 | Otite média e outr transt ouvido médio apóf mast | `otite_media_e_outr_transt_ouvido_medio_apof_mast` |
| `febre_reumatica` | 172 | I20, I23-I25 | Outras doenças isquêmicas do coração | `outras_doencas_isquemicas_do_coracao` |
| `doencas_reumaticas_cronicas` | 173 | I26 | Embolia pulmonar | `embolia_pulmonar` |
| `outras_doencas_coracao` | 174 | I44-I49 | Transtornos de condução e arritmias cardíacas | `transtornos_de_conducao_e_arritmias_cardiacas` |
| `hipertensao` | 175 | I50 | Insuficiência cardíaca | `insuficiencia_cardiaca` |
| `angina_pectoris` | 176 | I27-I43, I51-I52 | Outras doenças do coração | `outras_doencas_do_coracao` |
| `infarto_agudo` | 177 | I60-I62 | Hemorragia intracraniana | `hemorragia_intracraniana` |
| `doencas_arterias` | 178 | I63 | Infarto cerebral | `infarto_cerebral` |
| `aneurisma_aorta` | 179 | I64 | Acid vascular cerebr não espec hemorrág ou isquêm | `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` |
| `aterosclerose` | 181 | I70 | Arteroesclerose | `arteroesclerose` |
| `embolia_pulmonar` | 182 | I73 | Outras doenças vasculares periféricas | `outras_doencas_vasculares_perifericas` |
| `embolia_trombose` | 183 | I74 | Embolia e trombose arteriais | `embolia_e_trombose_arteriais` |
| `flebites_tromboflebites` | 184 | I71-I72, I77-I79 | Outras doenças das artérias arteríolas e capilares | `outras_doencas_das_arterias_arteriolas_e_capilares` |
| `varizes_mmii` | 185 | I80-I82 | Flebite tromboflebite embolia e trombose venosa | `flebite_tromboflebite_embolia_e_trombose_venosa` |
| `hemorroidas` | 186 | I83 | Veias varicosas das extremidades inferiores | `veias_varicosas_das_extremidades_inferiores` |
| `outras_doencas_veias` | 187 | I84 | Hemorróidas | `hemorroidas` |
| `linfedema` | 188 | I85-I99 | Outras doenças do aparelho circulatório | `outras_doencas_do_aparelho_circulatorio` |
| `hipotensao` | 189 | J02-J03 | Faringite aguda e amigdalite aguda | `faringite_aguda_e_amigdalite_aguda` |
| `outras_doencas_vasculares` | 190 | J04 | Laringite e traqueíte agudas | `laringite_e_traqueite_agudas` |

`amputacao_mmii` (procedimento, código 3331) está **correto** — aparece em detectores ingênuos de desalinhamento por não ter entrada na Lista Morb CID, mas não é um defeito.

## ⚠ Ciclos de renomeação — a migração não pode ser sequencial

Dois ids de destino já estão ocupados por outro registro na origem:

- `hemorroidas` (186) → `veias_varicosas_das_extremidades_inferiores`, **e** `outras_doencas_veias` (187) → `hemorroidas`
- `doencas_reumaticas_cronicas` (173) → `embolia_pulmonar`, **e** `embolia_pulmonar` (182) → `outras_doencas_vasculares_perifericas`

Um `UPDATE` linha a linha na ordem da tabela viola a PK. A migração precisa ser atômica: renomear para ids temporários numa primeira passada e para os canônicos numa segunda, ou fazer o update dentro de uma transação com a constraint deferida. Vale para `sih_disease` (PK), `sih_metric_uf` e `sih_metric_muni` (FK + parte da PK composta).

## Alcance da contaminação

Artefatos que carregam o id errado e precisam ser regerados/migrados juntos:

- `scripts/catalog/diseases.json` — fonte dos demais
- `scripts/catalog/lista-morb-cid.json` — chaveado pelo mesmo id
- `scripts/catalog/sql/0.sql` … `4.sql` — seeds do `sih_disease`
- Supabase: `sih_disease` (330), `sih_metric_uf` (30.313), `sih_metric_muni` (1.099.403)
- `src/features/catalog/diseases.lista.json` — cópia no bundle
- `public/data/catalog/packs/sih.*_uf.json` — 10 packs, 8 deles com nome enganoso
- `public/data/catalog/variables.json` — **rótulos visíveis ao estudante**, ex.: `sih.avc.internacoes` exibido como "Internações — AVC / acidente vascular cerebral"
- `trabalhos datasus/outputs/coleta_sih_multi/<id>/` — nomes de diretório e de CSV
- `src/features/catalog/catalogAnalysisData.ts` — imports estáticos por nome de arquivo
- `src/routes/mapas/` — `VARIABLE_ID_ALIASES` e qualquer id fixado em código

## Apelidos clínicos (decisão do milestone)

A liga usa "AVC", "TVP", "embolia pulmonar" no dia a dia. Depois de canonizar os ids, expor uma camada de apelido curado que mapeia o termo clínico para um ou mais ids canônicos — ex.: **AVC** → `infarto_cerebral` + `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` + `hemorragia_intracraniana`. O apelido é de apresentação/busca; o id canônico continua sendo a chave. Um apelido nunca pode ser gravado como chave de dado.

## Teste de regressão que teria pego o bug

Para os 330 registros, afirmar que `slug(label) === id` (com uma allowlist explícita e justificada para procedimentos como `amputacao_mmii`). Esse invariante é falso hoje em 20 registros e teria falhado no primeiro commit da lista gerada. Deve rodar em `scripts/catalog/validate.mjs` (fail-closed, já encadeado em `pretest`/`test:run`) **e** como teste de vitest, para que valha tanto no CI quanto localmente.
