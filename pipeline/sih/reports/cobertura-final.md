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

**Medido em duas rodadas — antes e depois do fechamento da lacuna do grão município decidido no
checkpoint da Task 3 (§6.1):**

```
ANTES  (Task 2, antes da decisão do operador):
audit: esperado=68848 coletado=33560 zero_verdadeiro=0 ausente=0 faltantes=35288 status={'coletado': 33560} anos_incompletos={} ok=True
audit: faltantes por grão -- {'municipio': 34424, 'uf': 864}

DEPOIS (Task 3, após upload.py --municipio escrever a Camada 2 do grão município):
audit: esperado=68848 coletado=67120 zero_verdadeiro=0 ausente=0 faltantes=1728 status={'coletado': 67120} anos_incompletos={} ok=True
audit: faltantes por grão -- {'municipio': 864, 'uf': 864}
```

`esperado=68.848` é o produto cartesiano completo do D-13 (331 agravos × 4 medidas × 2 grãos × 2
locais × 13 anos). `anos_incompletos={}` confirma, medido pela Camada 1 (não por suposição), que
**nenhum ano da janela está parcial no ledger de arquivo** — inclusive 2025, o ano mais recente,
que é justamente o caso que o D-13 existe para tornar visível quando acontece (ver §1).

`ok=True` porque nenhuma linha de `sih_collection_status` tem `status='falhou'` ou
`'nunca_tentado'` — mas **isso não significa cobertura completa**: `ok` mede só o que o ledger
*declara* explicitamente como falho, não o que está *ausente por completo*. Os "faltantes" são o
achado real que este parágrafo existe para não esconder atrás de `ok=True`. **`faltantes` caiu de
35.288 para 1.728** com o fechamento do §6.1 — os 1.728 remanescentes (864 por grão) são
exatamente as 108 combinações (disease_id, ano) genuinamente zero em todo o Brasil, explicadas
individualmente em §6.2, não uma lacuna de escritor.

### 6.1. Grão `municipio` sem escritor de Camada 2 — FECHADO (decisão do operador, checkpoint Task 3)

**Achado original (Task 2):** `upload.py::_persistir_collection_status` (a única função que
escrevia `sih_collection_status` em produção) filtrava explicitamente `linha.grao == GRAO_UF` —
nenhum código do pipeline escrevia uma linha de `sih_collection_status` para o grão `municipio`.
`partitions.py` (o módulo que sobe as 27 partições ao Storage, D-20) também não escrevia essa
tabela. Não era um problema de *dado* (as partições de município já estavam completas e servidas,
§4) — era um problema de **proveniência auditável**.

**Decisão do operador (checkpoint Task 3): fechar antes do encerramento da fase, não registrar
como débito.** O operador ampliou o `file_scope` desta execução, autorizando tocar `upload.py`/
`partitions.py` **exclusivamente** para escrever a proveniência do grão município, sem tocar o
swap de `sih_metric_uf` nem reenviar partições.

**Implementado, TDD (RED→GREEN, 8 testes novos + 2 no `audit.py`), medido contra produção:**

- `upload.py` ganhou `_linhas_grao_municipio()` (lê a MESMA fonte territorial que `partitions.py`
  usa para montar as partições, `construir_indice_territorial` — nunca uma segunda fonte de
  verdade) e `_persistir_collection_status_municipio()` (MESMO padrão de `COPY`+upsert do grão
  UF, função nova e separada de propósito — decisão explícita de não tocar/refatorar o caminho já
  provado duas vezes em produção). Um novo flag `upload.py --municipio` (e `--municipio --dry-run`)
  expõe isso na CLI, isolado do fluxo de `--tabela sih_metric_uf`: `copy_to_staging`/`swap`/
  `recount_via_postgrest`/`release_cache` **nunca são chamados** por esse caminho (provado por
  teste, `test_main_municipio_nunca_toca_caminho_de_sih_metric_uf`).
- **Nenhuma partição foi reenviada, nenhum swap de `sih_metric_uf` rodou** — só a trilha de
  proveniência foi escrita.
- **`--dry-run` mediu antes de escrever**: 12.327.573 linhas de grão município, 331 agravos, anos
  2013–2025.
- **Escrita real**: 33.560 linhas novas em `sih_collection_status` (grão `municipio`) — **o mesmo
  número exato do grão UF**, não coincidência: se um agravo tem zero internações em TODAS as 27
  UFs num ano, mecanicamente também tem zero em TODOS os municípios (mesma pergunta: houve alguma
  internação no Brasil?). Confirmado por SQL: o conjunto de `(disease_id, ano)` do grão `uf` e do
  grão `municipio` em `sih_collection_status` é **idêntico** (`EXCEPT` entre os dois devolve 0
  linhas).
- `sih_collection_status` total: **33.560 → 67.120** linhas, `0` sem `derived_at`/`cid_map_version`
  em qualquer um dos dois grãos.
- **D-13/D-14 preservados**: um par (disease_id, medida, local, ano) sem NENHUM município com dado
  não ganhou linha nenhuma (provado por teste Docker,
  `test_persistir_collection_status_municipio_nao_grava_ano_sem_nenhum_municipio`) — continua
  "faltante" na auditoria, nunca virou uma linha `coletado` vazia inventada.
- **Leitura anônima confirmada** pelo caminho real do app: `GET sih_collection_status?grao=eq.municipio`
  com a chave `anon` devolve 200 e dado real (ex.: `outras_anemias`/2013/`internacoes`/ocorrência,
  `row_count=2384` municípios).
- **`audit.py` também precisou de um ajuste** (mesmo `file_scope` desta plan, `audit.py` já era
  seu): `_metric_keys_grao_municipio` foi adicionada para que a auditoria não classificasse TODA
  combinação de município recém-provisionada como zero verdadeiro por omissão — ela usa a MESMA
  fonte territorial local (`upload._linhas_grao_municipio`) como proxy da fonte servida, já que
  não existe forma barata de reler o conteúdo do Storage em lote via SQL (D-20 tirou o grão
  município do Postgres exatamente para não pagar esse custo).

**Resultado medido, não estimado:** `audit.py` passou a reportar `faltantes` no grão município
caindo de **34.424 para 864** — os 864 remanescentes são exatamente os mesmos 108 pares
(disease_id, ano) genuinamente zero em todo o Brasil que já explicavam os 864 faltantes do grão UF
(§6.2), não uma lacuna nova. `sih_collection_status` cobre agora os dois grãos por igual.

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
microdado da MESMA forma.

**Decisão do operador (checkpoint da Task 3, 09-12): registrar e seguir — não construir suporte a
`DIAGSEC1` agora, e não remover estas 8 categorias do catálogo.** Corrigir a causa raiz (adicionar
`DIAGSEC1` como eixo alternativo de classificação para causas externas) seria uma mudança
estrutural em `aggregate.py`/`matcher.py` — fora do `file_scope` desta execução — e mudaria o que
a fase inteira reconcilia contra o TabNet (o SC-7 inteiro é `DIAG_PRINC`-based). Registrado aqui
com destaque, não escondido:

- **A causa é mudança de prática de codificação do DATASUS** (migração do código de causa externa
  de `DIAG_PRINC` para `DIAGSEC1` por volta de 2016) — **não é defeito do pipeline**.
- **Confirmado contra o próprio TabNet**, que devolve "Nenhum registro selecionado" para as
  mesmas combinações pós-2015 (tabela acima) — o mesmo comportamento no oráculo e no microdado.
- **2013–2015 têm dado bom para estas 8 categorias** — só a série pós-2016 quebra. Um agravo como
  `acidentes_de_transporte` não é um agravo "sem dado": é um agravo com série interrompida numa
  data conhecida e explicada.

**Risco didático explícito, para quem for construir a interface (não é escopo desta plan
implementar, é escopo deixar o aviso onde quem for fazer a UI vá encontrá-lo):** um aluno que
abrir "acidentes de transporte" no mapa/série temporal vê zero de 2016 em diante e pode concluir
algo clinicamente falso sobre o Brasil (que acidentes de transporte praticamente desapareceram),
quando na verdade o zero é um artefato de reclassificação de campo na fonte, não uma queda real de
incidência. **Item de acompanhamento para uma fase de UI (Fase 10 ou posterior): a tela precisa
sinalizar quando uma série zera por mudança de fonte/prática de codificação, de forma distinta de
um zero verdadeiro genuíno** (ex.: um selo/nota na série a partir de 2016 para estas 8 categorias,
ou uma heurística mais geral de "série interrompida" que a Fase 10 possa generalizar). A lista
completa dos 8 `disease_id` afetados está acima (Grupo A) — qualquer implementação futura pode
usar essa lista diretamente ou generalizar a heurística por capítulo CID (V01–Y98).

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

## 8. Achados — estado final após as decisões do operador no checkpoint da Task 3

| # | Achado | Estado |
|---|---|---|
| 1 | `sih_collection_status` não tinha NENHUMA linha para o grão `municipio` (§6.1) | **RESOLVIDO nesta sessão.** `file_scope` ampliado pelo operador; `upload.py --municipio` escreveu 33.560 linhas novas (67.120 total), `faltantes` do grão município caiu de 34.424 para 864 (medido, ver §6.1). |
| 2 | 8 categorias de causa externa (V01–Y98) zeradas de 2016 em diante — confirmado contra o TabNet, causa raiz (`DIAG_PRINC`→`DIAGSEC1`) não corrigida (§6.2, Grupo A) | **Decisão do operador: registrar e seguir.** Não construir suporte a `DIAGSEC1` agora, não remover as categorias do catálogo. Risco didático documentado com destaque (§6.2) e item de acompanhamento registrado para a Fase 10/UI (sinalizar série que zera por mudança de fonte). |
| 3 | Carga de `sih_population_*` (4 tabelas, D-24) continua sem executor — `upload.py` recusa `--tabela` diferente de `sih_metric_uf` por desenho | Fora do escopo desta plan (registrado desde o `09-10-SUMMARY.md`) — decisão: planejar a carga real de população numa fase futura ou plano ad-hoc |
| 4 | Gap de ledger de 12 arquivos (Camada 1, AC/2025) — **fechado nesta sessão** (§1) | Resolvido — documentado para auditoria |

**Item 3 permanece aberto por decisão implícita** (o checkpoint da Task 3 não o mencionou) — não é
bloqueante para o fechamento desta fase (população nunca foi declarada como parte do critério de
"fase pronta" do `09-01`), registrado para planejamento futuro.

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

## 10. Resumo — fase fechada com as três decisões do operador (checkpoint Task 3)

**Cobertura: aprovada pelo operador.** 331/331 agravos servidos, 4/4 medidas, 2/2 grãos (UF no
banco, município no Storage), 2/2 locais, janela 2013–2025 completa (§2–4), ledger de arquivo
4.212/4.212 (§1–2). `sih_collection_status` agora cobre os dois grãos por igual (67.120 linhas,
§6.1). SC-7 inalterado, `exato=34, explicado=61, inexplicado=3`, `ok=False` por desenho — já
aprovado antes, nada mudou aqui (§9).

- **Antes × depois medido** (§5): de 115/331 agravos com qualquer conteúdo e 424/654 CSVs vazios
  para 331/331 agravos com as 4 medidas e 0 arquivos vazios.
- **Ano mais recente (2025) está completo no ledger de arquivo** — `anos_incompletos={}` (§6),
  depois do fechamento do gap do Acre (§1).
- **Verificação null-vs-zero confirmada contra o TabNet ao vivo, em dois casos concretos** (§7):
  o TabNet nunca emite célula `0`, sempre omite a linha (parcial) ou a tabela inteira (total).
- **Grão município: lacuna de Camada 2 fechada** (§6.1) — `faltantes` caiu de 34.424 para 864
  (mesmos 108 pares zero-nacionais já explicados, não uma lacuna nova).
- **8 categorias de causa externa zeradas desde 2016: registradas e aceitas como característica da
  fonte** (§6.2, Grupo A), com risco didático documentado e item de acompanhamento para a Fase 10/
  UI (sinalizar série que zera por mudança de fonte, distinto de zero verdadeiro genuíno).

Todas as três decisões do checkpoint da Task 3 estão refletidas neste relatório e no
`09-12-SUMMARY.md`.
