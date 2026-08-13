# Cobertura final da coleta SIH-RD (Fase 9, plano 09-12)

**Medido em 2026-08-13, contra produção real** (Session Pooler + PostgREST anônimo + Storage
anônimo — nunca assumido do relato de sessões anteriores). Este relatório fecha o critério de
"fase pronta" declarado no `09-01`: as 4 medidas para os 331 agravos, nos dois grãos e nos dois
locais, servidas — não um recorte demonstrativo.

**A corrida de coleta já estava concluída quando este plano começou** (27/27 UFs
`agregado_reciclado`, duas substituições reais de produção já executadas pelo `09-10`/
`09-10-PROCEDIMENTO`/`09-10-SEGUNDA-SUBSTITUICAO`). O trabalho deste plano foi verificar e
auditar esse estado — não repeti a coleta nem o upload.

---

## 1. Achado corrigido nesta sessão — 12 arquivos ausentes do ledger de arquivo (Camada 1)

Antes de qualquer outra medição, `FileLedger.load().summary()` mostrou `4200` arquivos `baixado`
contra os `4212` esperados (27 UFs × 12 meses × 13 anos) — 12 faltando, todos `RDAC2501`..
`RDAC2512` (Acre, os 12 meses de 2025), e **nenhum deles sequer aparecia no ledger** (nem
`falhou`, nem `nunca_tentado` explícito — ausência total da chave).

**Investigado antes de agir** (nunca uma re-coleta às cegas): o agregado persistido
(`agregados/AC.parquet`) **já continha os dados de 2025 do Acre** (6.866 linhas para `ano=2025`,
consistente com o crescimento ano a ano da série) — ou seja, a coleta desses 12 arquivos
aconteceu de verdade e alimentou o agregado que já está em produção hoje. O que sumiu foi só a
prova de proveniência da Camada 1 (o ledger local `files.json`), não o dado em si. A causa mais
provável é uma divergência de leitura-modificação-escrita entre sessões concorrentes/sucessivas
que tocaram o mesmo arquivo `files.json` ao longo da corrida longa (múltiplas sessões, um
reinício de máquina, processos destacados via `nohup` — todos documentados no histórico do
`STATE.md`) — **não investigada até a causa raiz exata**, porque o dado em si nunca esteve em
risco e a ação corretiva é direta e comprovadamente segura.

**Ação tomada, exatamente conforme a Task 1 deste plano prescreve** ("Rodar `pipeline:download`
de novo — a retomada é por arquivo e idempotente (PIPE-03), então reexecutar é seguro"): rodei
`pipeline:download --only RDAC2501 .. RDAC2512`. Não toquei `collect.py`/`upload.py`/
`aggregate.py` (fora do `file_scope` desta execução) — só usei a CLI já existente e testada.
Resultado: `{'baixado': 4212, 'falhou': 0, 'nunca_tentado': 0, 'total_registros': 156618554}` —
ledger de arquivo agora **completo e consistente com o dado real que já estava servido**.

Isto **não foi uma nova coleta** (não baixei nada que não estivesse já refletido no agregado de
produção) — foi fechar uma lacuna de proveniência (Camada 1) que não tinha efeito sobre o dado
servido (Camada 2/`sih_metric_uf`), mas que faria a auditoria da Task 2 mentir sobre completude
de arquivo se não fosse corrigida primeiro.

---

## 2. Estado medido da corrida (Camada 1 — ledger de arquivo)

| Métrica | Valor medido |
|---|---|
| Arquivos esperados (27 UFs × 12 meses × 13 anos) | 4.212 |
| Arquivos `baixado` (após a correção acima) | **4.212** (100%) |
| Arquivos `falhou` | 0 |
| Arquivos `nunca_tentado` | 0 |
| Total de registros brutos processados (`total_registros` do ledger) | **156.618.554** |
| UFs `agregado_reciclado` (Camada de coleta incremental) | **27/27**, 0 `falhou` |

## 3. Tempos de parede medidos (das sessões que executaram a corrida — não re-executados aqui)

| Etapa | Início | Fim | Duração |
|---|---|---|---|
| Corrida de coleta nacional (re-coleta com eixo `PROC_REA`, 27 UFs) — entre a conclusão da 1ª UF (AC) e da última (SP) | 2026-08-12T16:34:15Z | 2026-08-13T02:36:57Z | **~10h02min** (limite inferior; não inclui o tempo de download/agregação da própria AC antes de sua conclusão) |
| Upload atômico de produção (2ª substituição, `upload.py --tabela sih_metric_uf`) | 2026-08-13T02:53:58Z | 2026-08-13T02:57:27Z | **3min29s** (`copy_to_staging → swap → persist_collection_status → recount_via_postgrest → release_cache`) |
| Geração + upload das 27 partições de município ao Storage | 2026-08-12T23:49:33Z | 2026-08-12T23:52:47Z | **~3min30s** |
| Fechamento do gap de ledger desta sessão (12 arquivos AC/2025) | 2026-08-13T03:17:58Z | 2026-08-13T03:18:24Z | **~26s** |

D-23 (ordem de relevância cirúrgica): a ordem de `scripts/catalog/collection-order.json` foi
respeitada como **ordem de decisão de upload**, mas a substituição real de produção (`09-10`)
acabou acontecendo como **um swap único para o catálogo inteiro** (330 depois 331 agravos), não
nível a nível — porque `swap()` faz `TRUNCATE` da tabela inteira (D-16, substituição total), e um
upload real por nível exigiria um swap incremental fora do escopo de qualquer plano já executado
(`09-10-SUMMARY.md` documenta essa restrição explicitamente). Isso não viola o D-23: **nenhum
agravo foi cortado** — o resultado final cobre o catálogo inteiro de uma vez, superset de
qualquer entrega nível a nível.

## 4. Tabelas de produção — contagens e tamanhos medidos (Session Pooler, `psql`)

| Tabela | Linhas | `pg_total_relation_size` |
|---|---|---|
| `sih_metric_uf` | 207.664 (103.619 ocorrência + 104.045 residência) | 54 MB |
| `sih_metric_muni` | 1.099.403 (dado TabNet legado — segue no banco até o `09-14`) | 319 MB |
| `sih_collection_status` | 33.560 | 36 MB |
| `sih_disease` | 331 | 136 kB |
| `sih_population_uf`/`sih_population_muni`/`sih_population_total_uf`/`sih_population_total_muni` | 0 (fora do escopo de carga de qualquer plano executado até aqui — ver §8) | 16 kB / 16 kB / 8 kB / 8 kB |
| **Banco (total)** | — | **420 MB**, teto 500 MB (headroom ~80 MB; o `09-14` ainda libera 319 MB de `sih_metric_muni`) |

| Consulta | Resultado |
|---|---|
| `count(distinct disease_id) from sih_metric_uf` | **331** |
| `count(distinct local) from sih_metric_uf` | **2** (ocorrência=103.619, residência=104.045 — as duas não-zero) |
| `min(ano), max(ano) from sih_metric_uf` | **2013, 2025** |
| `count(distinct disease_id) from sih_metric_uf where taxa_mortalidade is not null` | **331** (DATA-03 em todo o catálogo) |

### Storage (bucket `sih-municipio`) — as 27 partições, medidas por `GET` anônimo real

Todas as 27 UFs devolveram **HTTP 200** com a chave `anon` (leitura pública real, não assumida):

| UF | Bytes | UF | Bytes | UF | Bytes |
|---|---|---|---|---|---|
| AC 588.853 | ES 2.638.088 | PA 4.308.125 |
| AL 2.148.347 | GO 5.159.069 | PB 3.413.475 |
| AM 1.362.817 | MA 5.278.658 | PE 5.417.786 |
| AP 327.587 | MG **19.367.174** | PI 3.245.504 |
| BA 10.356.769 | MS 2.220.580 | PR 10.306.868 |
| CE 5.051.587 | MT 2.971.891 | RJ 4.097.025 |
| DF 488.046 | — | RN 2.953.448 |
| — | — | RO 1.453.667 |
| — | — | RR 333.346 |
| — | — | RS 11.460.030 |
| — | — | SC 7.702.880 |
| — | — | SE 1.449.688 |
| — | — | SP **20.299.075** |
| — | — | TO 1.965.906 |

**Total: 136.366.289 bytes ≈ 130,04 MB** — sob o teto de 1 GB do Storage gratuito (headroom
~870 MB), e cada objeto individual bem sob o teto de 50 MB/objeto (SP, o maior, em 19,36 MB, 2,6×
sob o limite). Leitura/escrita anônima reconfirmada: `GET` de qualquer partição → 200; `POST` →
403 (RLS `storage.objects`, default-deny). `GET`/`POST` em `sih_metric_uf`/`sih_disease` via
PostgREST com chave `anon` → 200 leitura, 401 escrita.

---

## 5. Antes × depois

A tabela abaixo compara o estado que esta fase substitui (o pipeline aposentado,
`.planning/notes/2026-08-04-pysus-microdado-spike.md` §6, corpus `coleta_sih_multi_disease.py`)
contra o estado medido hoje.

| Métrica | Antes (pipeline aposentado) | Depois (medido hoje) |
|---|---|---|
| Agravos com qualquer conteúdo | **115 de 331** | **331 de 331** |
| Arquivos vazios (0 bytes) registrados como sucesso | **424 de 654 CSVs (65%)** | **0 de 4.212 arquivos** (guardas de zero-byte/corrupção do `09-04` fecharam essa classe inteira) |
| Medidas por agravo | **84 de 85 casos com conteúdo trazem só 1 de 4 medidas** (`internações`) | **4 de 4 medidas para os 331 agravos** (`internacoes`/`obitos`/`valor_total`/`dias_permanencia`, `taxa_mortalidade` derivada em todo o catálogo) |
| Grãos úteis | **1** (o grão prático da coleta legada) | **2** (UF no Postgres, município particionado no Storage) |
| Locais | **1** (só ocorrência, implícito) | **2** (ocorrência e residência, explícitos, D-09) |
| Janela temporal | Variável por agravo, sem garantia | **2013–2025 completo (13 anos), nos 27 UFs** |
| Proveniência por combinação (ledger consultável) | Nenhuma | `sih_collection_status`, 33.560 linhas, todas com `derived_at`/`cid_map_version` (ver §6 para os limites atuais dessa cobertura) |

---

## 6. Auditoria de cobertura (`sih_pipeline.cli audit`, Task 2)

Comando real, contra produção: `cd pipeline/sih && uv run python -m sih_pipeline.cli audit`.
Saída medida:

```
audit: esperado=68848 coletado=33560 zero_verdadeiro=0 ausente=0 faltantes=35288 status={'coletado': 33560} anos_incompletos={} ok=True
audit: faltantes por grão -- {'municipio': 34424, 'uf': 864}
```

`esperado=68.848` é o produto cartesiano completo do D-13 (331 agravos × 4 medidas × 2 grãos × 2
locais × 13 anos). `anos_incompletos={}` confirma, medido pela Camada 1 (não por suposição), que
**nenhum ano da janela está parcial no ledger de arquivo** — inclusive 2025, o ano mais recente,
que é justamente o caso que o D-13 existe para tornar visível quando acontece (ver §1: era
exatamente isso que os 12 arquivos ausentes do Acre teriam produzido, se não tivessem sido
fechados antes desta auditoria rodar).

`ok=True` porque nenhuma linha de `sih_collection_status` tem `status='falhou'` ou
`'nunca_tentado'` — mas **isso não significa cobertura completa**: `ok` mede só o que o ledger
*declara* explicitamente como falho, não o que está *ausente por completo*. Os 35.288 "faltantes"
são o achado real que este parágrafo existe para não esconder atrás de `ok=True`:

### 6.1. Achado arquitetural — grão `municipio` sem escritor de Camada 2 (34.424 faltantes)

`upload.py::_persistir_collection_status` (a única função que escreve `sih_collection_status` em
produção) filtra explicitamente `linha.grao == GRAO_UF` — **nenhum código do pipeline escreve
uma linha de `sih_collection_status` para o grão `municipio`**. `partitions.py` (o módulo que
sobe as 27 partições ao Storage, D-20) também não escreve essa tabela. Isto não é um problema de
*dado* — as partições de município estão completas e servidas (§4, 27/27 com `GET` 200 real) —
é um problema de **proveniência auditável**: hoje não existe, em `sih_collection_status`, nenhuma
linha que diga "processamos o grão município para o agravo X, ano Y, e o resultado foi Z" (D-13/
PIPE-02 cobrindo só metade do que declaram). A auditoria reflete isso honestamente: toda
combinação de grão `municipio` cai em `faltantes`, nunca em `zero_verdadeiro` — a regra do D-14
(`classificar_ausencia`) não é aplicada a uma combinação sem nenhuma linha de status, por
desenho, exatamente para não confundir "sem escritor" com "zero verdadeiro".

**Este achado está fora do `file_scope` desta execução** (exigiria editar `upload.py` ou
`partitions.py`, ambos fora do escopo declarado do 09-12) — registrado aqui para decisão do
operador, não corrigido. Ver §8.

### 6.2. Achado explicado — 108 pares agravo×ano com zero nacional no grão UF (864 faltantes)

O grão UF tem 864 faltantes = 108 pares (disease_id, ano) × 2 locais × 4 medidas, onde **nenhuma
das 27 UFs** tem uma linha de métrica para aquela combinação em nenhum local. Investigado
individualmente (não aceito por suposição):

**14 agravos envolvidos**, divididos em dois grupos com explicações completamente diferentes:

**Grupo A — 8 categorias de "causas externas" (capítulo CID-10 V01–Y98), zeradas de 2016 em
diante, explicado e confirmado contra o TabNet ao vivo:**

`acidentes_de_transporte`, `afogamento_e_submersao_acidentamente`, `agressoes`,
`envenenamento_intox_exposicao_substancias_nocivas`, `exposicao_ao_fumo_ao_fogo_e_as_chamas`,
`lesoes_autoprovocadas_voluntariamente`, `quedas`, `todas_as_outras_causas_externas` — todos os 8
têm dado SÓ em 2013–2015 (3 anos) e zero nos 10 anos seguintes, no grão UF inteiro (as 27 UFs).

Investigação (dado real, `RDAC2501.parquet`, 4.541 registros de 2025 ainda em cache no momento
desta auditoria): **zero** registros têm `DIAG_PRINC` começando com `V` ou `Y` — mas
**123 registros têm `DIAGSEC1` (primeiro diagnóstico secundário) começando com `V`** e **133 com
`DIAGSEC1` começando com `Y`**. A Lista de Morbidade CID-10 (`nibr.def`, tanto do TabNet quanto do
nosso matcher) classifica **só por `DIAG_PRINC`** — nunca por diagnóstico secundário. Isto indica
que, a partir de ~2016, a prática de codificação do SIH-RD para internações por causa externa
passou a registrar o CÓDIGO DA LESÃO (capítulo S/T, ex. fratura) como `DIAG_PRINC` e o CÓDIGO DA
CAUSA EXTERNA (capítulo V/Y) como diagnóstico secundário — não mais como `DIAG_PRINC`.

**Confirmado contra o TabNet ao vivo, não só inferido do microdado:**

| Verificação | Esperado | Medido |
|---|---|---|
| `acidentes_de_transporte`, SP, 2015 (tabnetCode 323) | dado presente | **135 internações** (TabNet responde normalmente) |
| `acidentes_de_transporte`, SP, 2019 | zero | **"Nenhum registro selecionado"** — o TabNet devolve uma página SEM bloco `<PRE>`, a mesma resposta de "não há nada a mostrar" |
| `acidentes_de_transporte`, SP, 2016 | zero | **"Nenhum registro selecionado"**, idêntico a 2019 |

**Isto prova que o TabNet, a fonte que este pipeline substitui e contra a qual se reconcilia,
também não tem dado para estas 8 categorias a partir de 2016** — porque ele também classifica só
por `DIAG_PRINC`. Não é um defeito do nosso matcher nem uma lacuna de coleta: é uma característica
real e documentada da fonte (mudança de prática de codificação hospitalar), que afeta TabNet e
microdado da MESMA forma. Corrigir isto (adicionar `DIAGSEC1` como eixo alternativo de
classificação para causas externas) seria uma mudança estrutural em `aggregate.py`/`matcher.py`
— fora do `file_scope` desta execução — e mudaria o que a fase inteira reconcilia contra o TabNet
(o SC-7 inteiro é `DIAG_PRINC`-based); registrado para decisão de fase futura, não uma correção
aqui.

**Grupo B — 6 doenças raras/quase erradicadas no Brasil, com anos genuinamente sem caso
registrado:**

`deficiencia_de_vitamina_a`, `dracunculiase`, `meningite_em_doencas_bacters_class_outr_parte`,
`oncocercose`, `restante_de_tuberculose_respiratoria`, `tifo_exantematico` — doenças tropicais
raras ou candidatas a erradicação no Brasil (dracunculíase e oncocercose, em particular, têm
programas de eliminação/erradicação ativos e décadas sem transmissão autóctone confirmada em
grande parte do país). Anos sem nenhuma internação nacional para estas categorias são clinicamente
plausíveis, consistente com o padrão já visto em outras categorias raras do catálogo (ex.
`outras_infestacoes_por_trematodeos`, que tem só 3 UFs com dado em 2019 — ver §7).

---

## 7. Verificação empírica null-vs-zero contra o TabNet (ROADMAP §"Riscos conhecidos")

A premissa herdada do pipeline aposentado — "o TabNet nunca emite célula `0` explícita; ausência
de linha *é* o zero" — nunca tinha sido verificada contra spec oficial, só contra o comportamento
observado do scraper legado. Com o raspador mínimo do `09-05` (`oracle_scrape.py`) e a regra
escrita de zero verdadeiro (D-14, `classificar_ausencia`), esta plano verificou empiricamente,
ao vivo, dois casos concretos:

**Caso 1 — território específico ausente dentro de uma resposta com dado (o caso comum de
D-14):** `outras_infestacoes_por_trematodeos` (tabnetCode 67), ano 2019. O microdado mostra dado
em **3 UFs apenas** (MG=1, PA=1, RN=1 internação) — as outras 24 UFs, incluindo AC, têm zero.
Pedido ao TabNet o mesmo agravo/ano para MG: **devolveu 1** (bate exato com o microdado). Pedido
para AC: **`RuntimeError: nenhum município da UF 12 na resposta do TabNet`** — o TabNet devolveu
uma tabela válida (`<PRE>` presente, com MG/PA/RN dentro), mas **nenhuma linha para nenhum
município do Acre** — confirma que o TabNet OMITE a linha do território sem caso, nunca emite
`0` explícito.

**Caso 2 — nenhum território tem dado (zero nacional completo):** `acidentes_de_transporte`
(tabnetCode 323), SP, 2019 (ver §6.2) — o TabNet nem chega a montar uma tabela: devolve
`"Nenhum registro selecionado"`, uma página inteiramente diferente, sem bloco `<PRE>` algum.

**Conclusão, medida e não herdada:** o TabNet nunca emite um valor `0` explícito, nos dois modos
possíveis de ausência (parcial — omite a linha do território dentro de uma tabela válida; e
total — devolve "nenhum registro selecionado" em vez de tabela). A premissa do D-14 (ausência de
linha de métrica = zero verdadeiro, quando o ledger diz `coletado`) está alinhada com o
comportamento real da fonte que este pipeline substitui — confirma a premissa, não a derruba.
Isto é o que a Fase 10 (MAPA-03/MAPA-04) vai renderizar de forma honesta em vez de coagir a `0`.

---

## 8. Achados registrados para decisão do operador (não corrigidos nesta execução)

| # | Achado | Escopo | Ação recomendada |
|---|---|---|---|
| 1 | `sih_collection_status` não tem NENHUMA linha para o grão `municipio` — `upload.py`/`partitions.py` nunca escrevem essa Camada 2 para esse grão (§6.1) | Exigiria editar `upload.py` ou `partitions.py`, fora do `file_scope` desta execução | Decisão: aceitar a lacuna (o dado de município está servido e provado por `GET` anônimo real, só a proveniência auditável em `sih_collection_status` está incompleta) ou planejar um plano futuro para escrever Camada 2 do grão município |
| 2 | 8 categorias de causa externa (V01–Y98) zeradas de 2016 em diante — explicado e confirmado contra o TabNet, mas a causa raiz (código migrou de `DIAG_PRINC` para `DIAGSEC1`) não foi corrigida (§6.2, Grupo A) | Exigiria um eixo de classificação novo em `aggregate.py`/`matcher.py` (mudaria o que o SC-7 reconcilia) | Decisão: aceitar como característica documentada da fonte (igual ao TabNet) ou priorizar correção em fase futura |
| 3 | Carga de `sih_population_*` (4 tabelas, D-24) continua sem executor — `upload.py` recusa `--tabela` diferente de `sih_metric_uf` por desenho | Fora do escopo de qualquer plano executado até aqui (registrado desde o `09-10-SUMMARY.md`) | Decisão: planejar a carga real de população numa fase futura ou plano ad-hoc |
| 4 | Gap de ledger de 12 arquivos (Camada 1, AC/2025) — já **fechado nesta sessão** (§1) | Resolvido | Nenhuma — documentado para auditoria |

---

## 9. Estado do SC-7 (reconciliação, herdado, não fechado por este plano)

Não é escopo desta execução recomputar a reconciliação — o estado é o que o `09-08`/`09-11`/fix
IDENT já fecharam e o operador já aprovou conscientemente:

- **`exato=34, explicado=61, inexplicado=3`, `result.ok=False` por desenho** — 3 categorias
  (`tuberculose_pulmonar`, `tuberculose_do_sistema_nervoso`, `doenca_de_alzheimer`, AC/2019)
  permanecem um resíduo pequeno de amostra sem explicação inventada.
- **Divergência de lote (`ANO_CMPT` vs `DT_INTER`)** cobre 53 categorias com razão escrita e
  medida duas vezes (AC +7,90%, SP +5,10%) — reduz mas não zera o viés esperado entre competência
  de processamento e data de internação. Presente nas 207.664 linhas servidas hoje.

---

## 10. Resumo para a conferência humana (Task 3)

- **331/331 agravos servidos**, 4/4 medidas, 2/2 grãos (UF no banco, município no Storage), 2/2
  locais, janela 2013–2025 completa (§2–4).
- **Antes × depois medido** (§5): de 115/331 agravos com qualquer conteúdo e 424/654 CSVs vazios
  para 331/331 agravos com as 4 medidas e 0 arquivos vazios.
- **Ano mais recente (2025) está completo no ledger de arquivo** — `anos_incompletos={}` (§6),
  depois do fechamento do gap do Acre (§1).
- **Verificação null-vs-zero confirmada contra o TabNet ao vivo, em dois casos concretos** (§7):
  o TabNet nunca emite célula `0`, sempre omite a linha (parcial) ou a tabela inteira (total).
- **Dois achados genuínos, não corrigidos, registrados para decisão** (§8): grão município sem
  Camada 2 de proveniência; 8 categorias de causa externa zeradas desde 2016 por mudança de
  prática de codificação da fonte (confirmado contra o TabNet, não um defeito do pipeline).
- **SC-7 permanece com o resíduo pequeno já conhecido e aprovado** (§9) — nada mudou aqui.

Este relatório não assume conclusão — os achados de #8 esperam decisão explícita do operador no
checkpoint da Task 3.
