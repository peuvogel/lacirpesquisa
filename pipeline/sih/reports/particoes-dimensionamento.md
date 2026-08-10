# Dimensionamento real das partições de município (D-20/D-21) — Storage × teto de 1 GB

**Medido em:** 2026-08-10
**Plano:** 09-09 (`.planning/phases/09-pipeline-confi-vel-coleta-completa/09-09-PLAN.md`), Task 2
**Objetivo:** o D-21 exige medir o tamanho real das 27 partições **antes** de travar o formato —
as projeções do CONTEXT/RESEARCH (Assumption A5) são cálculo aproximado, não medição. Este
relatório traz as medições reais que existem hoje e é explícito sobre onde a medição direta não é
possível (corpus completo não baixado) e uma extrapolação rotulada entra no lugar.

---

## 0. Absorção da decisão do 09-06 (pré-requisito desta medição)

O 09-06 (checkpoint respondido pelo operador em 2026-08-10, registrado em
`pipeline/sih/reports/populacao-dimensionamento.md` §"Decisão do operador") confirmou
**`popsvs-no-banco`**: as quatro tabelas `sih_population_*` vão para o Postgres, como o D-24
escreveu. **Não** foi escolhido `popsvs-estratificado-no-storage`.

Consequência direta para esta medição, exatamente como o plano previu: a família
`v1/pop/{sigla}.json.gz` **não** entra no conjunto medido abaixo. Todos os números deste
relatório são só da família `"metrica"` (`v1/{sigla}.json.gz`). `partitions.py` (Task 1) já
implementa o parâmetro `familia` com default `"metrica"` e não gera a família `"populacao"` neste
caminho — provado por teste (`test_build_partition_familia_default_e_metrica`).

---

## 1. Honestidade sobre a cobertura real dos dados disponíveis hoje

A corrida completa do 09-04 (~10 GB, 4.212 arquivos `RD{UF}{AA}{MM}`, 27 UF × 12 meses × 13 anos)
**não rodou** — bloqueada por disco (`STATE.md` §"Bloqueios abertos"). O cache local
(`~/.lacir/sih-cache/parquet/`) contém hoje **14 de 4.212 arquivos esperados** (0,33%), todos do
AC: `RDAC1301`/`RDAC1302` (jan/fev 2013) e `RDAC1901`..`RDAC1912` (ano inteiro 2019) — confirmado
pelo ledger local (`ledger/files.json`: 14 entradas, todas `status="baixado"`).

**Não é possível medir as outras 26 UFs diretamente sem baixar o corpus completo**, e esta task
foi instruída a não disparar essa corrida. Por isso, a partir da seção 3, dois tipos de número
aparecem, marcados sem ambiguidade:

- **MEDIDO** — rodou de verdade sobre dado real (AC).
- **PROJETADO/CALCULADO** — extrapolação com método explícito, nunca apresentada como medição.

---

## 2. Medição real — partição AC (única UF com dado local hoje)

`cd pipeline/sih && uv run python -m sih_pipeline.cli partitions --uf AC` (Task 1, código real,
sem mock) rodou sobre os 14 arquivos disponíveis e produziu:

| Métrica | Valor medido |
|---|---:|
| Linhas (grão município, 2 locais, todos os disease_id que casaram) | 5.933 |
| `disease_id` distintos presentes | 281 de 331 |
| Anos presentes | 2013, 2019 |
| Bytes descomprimidos (JSON UTF-8) | 567.809 B (554,5 KB) |
| Bytes comprimidos (gzip -9, real) | 66.109 B (64,6 KB) |
| Razão de compressão | 11,6% |

Esta partição foi **subida de verdade** ao bucket (`upload_partition`, Task 1, service_role) — ver
§6. `GET` anônimo dela confirmou bytes idênticos byte a byte ao arquivo local (§6.3).

O fato de 281/331 `disease_id` já aparecerem em só 14/156 arquivos-mês de uma UF pequena é
consistente com o achado do 09-07 (matcher roda contra o mapa CID completo, não uma allowlist de
93 agravos como o caminho TabNet legado).

---

## 3. Método de projeção para as 26 UFs sem dado local — dois métodos, rotulados

### 3.1 Método A (ingênuo, o que o texto do plano pede literalmente): escalar pela fração do ledger

O plano pede "escalando pela fração de arquivos já baixados que o ledger reporta". Aplicado ao
**total nacional** (14 de 4.212 arquivos baixados, fator 300,857×):

| | Comprimido | Descomprimido |
|---|---:|---:|
| **Total ingênuo (27 UFs somadas)** | 19.889.365 B (**18,97 MB**) | 170.829.393 B (162,92 MB) |

**Por que este número não é confiável sozinho:** o método A assume implicitamente que todas as 27
UFs têm a mesma densidade de linhas por arquivo que o AC — que é a menor UF do país em quase todo
critério de volume hospitalar. A medição real do `sih_metric_muni` legado (produção, tabela que o
D-20 já decidiu evacuar) mostra que SP tem **29,2× mais linhas que o AC** para a mesma cobertura de
93 agravos — o método A geraria um total nacional menor que a própria partição de SP sozinha
projetada pelo método B abaixo. Reportado aqui porque o plano pediu explicitamente, mas **não** é
o número usado para a decisão.

### 3.2 Método B (ponderado por UF, preferido): razão real de linhas do `sih_metric_muni` legado

`sih_metric_muni` (produção, 327 MB medidos, 1.099.403 linhas, 93/331 agravos, 1 local — o
DADO QUE O D-20 JÁ DECIDIU EVACUAR) tem `uf_codigo` em cada linha. Consultado ao vivo
(`select uf_codigo, count(*) from sih_metric_muni group by uf_codigo`), ele dá a **distribuição
real e medida** de volume hospitalar por UF — não uma suposição de uniformidade. Usar essa razão
para escalar a medição real do AC (§2, já projetada para as 13 anos completos da janela D-11 por
`156/14`) é o método que respeita o fato mais forte que já temos sobre a forma da distribuição:

**AC projetado para cobertura completa (13 anos, todos os meses) — base do método B:**

| | Linhas | Comprimido | Descomprimido |
|---|---:|---:|---:|
| AC medido (14/156 arquivos-mês) | 5.933 | 66.109 B | 567.809 B |
| AC projetado (×156/14 = 11,14) | 66.111 | 736.643 B (**719,4 KB**) | 6.327.015 B (6,03 MB) |

**As 27 UFs projetadas (método B), ordenadas da maior para a menor:**

| UF | linhas `sih_metric_muni` (legado, real) | razão vs AC | linhas projetadas | comprimido projetado | descomprimido projetado |
|---|---:|---:|---:|---:|---:|
| SP | 162.248 | 29,20x | 1.930.234 | 20,51 MB | 176,17 MB |
| MG | 148.136 | 26,66x | 1.762.346 | 18,73 MB | 160,85 MB |
| BA | 95.288 | 17,15x | 1.133.623 | 12,05 MB | 103,47 MB |
| RS | 90.656 | 16,31x | 1.078.517 | 11,46 MB | 98,44 MB |
| PR | 74.364 | 13,38x | 884.694 | 9,40 MB | 80,75 MB |
| SC | 57.595 | 10,36x | 685.197 | 7,28 MB | 62,54 MB |
| MA | 52.305 | 9,41x | 622.263 | 6,61 MB | 56,79 MB |
| GO | 50.751 | 9,13x | 603.775 | 6,42 MB | 55,11 MB |
| PA | 47.818 | 8,61x | 568.882 | 6,05 MB | 51,92 MB |
| CE | 46.295 | 8,33x | 550.763 | 5,85 MB | 50,27 MB |
| RJ | 41.801 | 7,52x | 497.299 | 5,28 MB | 45,39 MB |
| PE | 34.143 | 6,14x | 406.193 | 4,32 MB | 37,07 MB |
| MT | 29.919 | 5,38x | 355.941 | 3,78 MB | 32,49 MB |
| MS | 24.583 | 4,42x | 292.459 | 3,11 MB | 26,69 MB |
| ES | 20.318 | 3,66x | 241.719 | 2,57 MB | 22,06 MB |
| AM | 19.237 | 3,46x | 228.859 | 2,43 MB | 20,89 MB |
| PI | 17.430 | 3,14x | 207.361 | 2,20 MB | 18,93 MB |
| PB | 16.190 | 2,91x | 192.609 | 2,05 MB | 17,58 MB |
| RN | 15.888 | 2,86x | 189.017 | 2,01 MB | 17,25 MB |
| RO | 15.415 | 2,77x | 183.389 | 1,95 MB | 16,74 MB |
| TO | 11.318 | 2,04x | 134.648 | 1,43 MB | 12,29 MB |
| AL | 9.870 | 1,78x | 117.422 | 1,25 MB | 10,72 MB |
| **AC** | **5.557** | **1,00x (base, MEDIDO)** | **66.111** | **719 KB** | **6,03 MB** |
| SE | 5.448 | 0,98x | 64.814 | 705 KB | 5,92 MB |
| AP | 3.160 | 0,57x | 37.594 | 409 KB | 3,43 MB |
| RR | 2.539 | 0,46x | 30.206 | 329 KB | 2,76 MB |
| DF | 1.131 | 0,20x | 13.455 | 146 KB | 1,23 MB |

| | Linhas | Comprimido | Descomprimido |
|---|---:|---:|---:|
| **TOTAL projetado (27 UFs, método B)** | 13.079.388 | **139,0 MB** (145.738.291 B) | 1.193,8 MB (1,17 GB) |

**Maior partição projetada: SP, ≈20,51 MB comprimida.** **Menor: DF, ≈146 KB comprimida.**

Esta é uma extrapolação, não uma medição de SP — mas usa o único dado real disponível sobre a
distribuição por UF (o legado que o D-20 evacua), o que a torna muito mais confiável que assumir
uniformidade entre UFs (método A). A ressalva registrada no RESEARCH Assumption A5 ("SP pode ser
muito maior que os 15-20% assumidos da linha de base") é diretamente testada aqui: SP mede 29,2×
o AC, não uma fração pequena — e mesmo assim a partição projetada (20,51 MB) fica **2,4× abaixo**
do limite de 50 MB por objeto confirmado ao vivo (§5).

---

## 4. SP — calibração adicional com gzip real (não só extrapolação linear)

Para não depender só de escala linear (que assume bytes/linha constante), foi gerado um arquivo
`.json.gz` **real** do tamanho de linhas projetado para SP (1.930.234 linhas), replicando os dados
reais do AC até esse volume e comprimindo com gzip real (nível 9) — mede como o gzip real se
comporta num arquivo desse volume, ainda que o conteúdo replicado super-estime a compressibilidade
(dado repetido comprime melhor que dado único real):

| Método | Comprimido | Nota |
|---|---:|---|
| Linear (§3.2, bytes/linha constante) | 20,51 MB | conservador — ignora ganho de compressão em arquivo maior |
| gzip real sobre arquivo replicado do tamanho-alvo | **15,24 MB** | otimista — dado replicado comprime bem melhor que dado único real |

**Faixa real esperada para a partição de SP: entre ≈15,2 MB e ≈20,5 MB comprimidos** — o valor
real (dado único, não replicado) fica entre os dois limites, tipicamente mais perto do limite
inferior por causa de strings repetidas reais (mesmos `disease_id`, mesmos `municipio_codigo` ano
a ano). **Qualquer um dos dois limites fica confortavelmente abaixo do teto de 50 MB por objeto.**

---

## 5. Tempo de parede — `fetch` + `DecompressionStream` + `JSON.parse`, medido de verdade

Medido com a **mesma API que `loadMunicipioPartition.ts` (Task 3) vai usar**
(`response.body.pipeThrough(new DecompressionStream('gzip'))` + `JSON.parse`), rodando em Node
25 (que implementa a Web Streams API do navegador) contra um servidor HTTP local com taxa de
transferência artificialmente limitada — simula "conexão limitada de sala de aula" porque não há
uma rede de sala de aula real disponível neste ambiente. O arquivo servido é o `.json.gz` real de
15,24 MB do §4 (o limite otimista da faixa de SP).

| Cenário | Taxa | fetch+decompress | `JSON.parse` | **TOTAL medido** |
|---|---:|---:|---:|---:|
| Sem limite (piso de CPU, loopback) | ~8 Gbps | 1.228 ms | 453 ms | **1.690 ms (1,7 s)** |
| Wifi favorável | 10 Mbps | 12.852 ms | 414 ms | **13.273 ms (13,3 s)** |
| Wifi congestionado | 4 Mbps | 32.425 ms | 422 ms | **32.857 ms (32,9 s)** |

**Escalado (CALCULADO, não medido) para o limite superior da faixa de SP (20,51 MB, fator
1,346×):**

| Cenário | TOTAL calculado |
|---|---:|
| Piso de CPU | ≈2,3 s |
| 10 Mbps | ≈17,9 s |
| 4 Mbps | ≈44,2 s |

**Leitura:** o `JSON.parse` (a parte que crítica de fato acontece na CPU do aluno) é
consistentemente **≈0,4 s**, irrelevante frente ao tempo de rede. O tempo do "primeiro pixel
municipal" é dominado quase inteiramente pela banda da rede, não pelo parser nem pela
descompressão — que é exatamente a razão de D-21 preferir 27 arquivos grandes (1 download por UF,
depois tudo offline) a 8.900 arquivos pequenos (rede toda vez que o agravo muda). Numa rede
congestionada (4 Mbps), o pior caso (SP) leva até ≈44 s no primeiro download da aula — depois
disso, o cache do navegador (D-22) atende instantaneamente para o resto da aula, mesmo trocando
agravo/ano/medida.

---

## 6. Bucket `sih-municipio` — criado e auditado ao vivo

### 6.1 Criação

```
POST /storage/v1/bucket  (service_role)
{"id":"sih-municipio","name":"sih-municipio","public":true,"file_size_limit":52428800}
-> HTTP 200 {"name":"sih-municipio"}
```

Confirmado por leitura (`GET /storage/v1/bucket/sih-municipio`): `"public": true`,
`"file_size_limit": 52428800`.

### 6.2 Teto de 50 MB por objeto — confirmado ao vivo, não assumido

Tentativa real de subir o teto do bucket para 100 MB:

```
PUT /storage/v1/bucket/sih-municipio {"public":true,"file_size_limit":104857600}
-> HTTP 400 {"statusCode":"413","error":"Payload too large",
             "message":"The object exceeded the maximum allowed size","code":"EntityTooLarge"}
```

A plataforma **rejeitou** o aumento — o bucket permaneceu em `file_size_limit: 52428800` (50 MiB)
após a tentativa. Isto confirma ao vivo, contra o projeto real, o limite de 50 MB por objeto que o
RESEARCH (Assumption A5) só citava como documentação de terceiros. Toda a faixa projetada de SP
(§3-4, 15,2–20,5 MB) fica **2,4×–3,3× abaixo** deste teto real.

### 6.3 Upload real e leitura anônima — byte a byte

`upload_partition("AC")` (Task 1, código real, `service_role`) subiu a partição do AC:

```
$ uv run python -m sih_pipeline.cli partitions --uf AC --upload
partitions: AC -> .../particoes/AC.json.gz (5933 linha(s))
partitions: AC enviado ao Storage (sih-municipio/v1/AC.json.gz)
```

`GET` anônimo (chave `anon` do `.env.local`, a mesma que o app usa em produção):

```
GET /storage/v1/object/public/sih-municipio/v1/AC.json.gz
-> HTTP 200, 66.111 bytes
```

Os bytes baixados foram comparados (`diff`) byte a byte contra o arquivo local gravado por
`write_partition` — **idênticos**. Repetido também **sem nenhum header de autenticação** (nem
`apikey`, nem `Authorization`) — mesmo resultado, HTTP 200, confirmando que o bucket público serve
sem exigir credencial alguma, como o design pede (sem login, D-hard_constraint).

### 6.4 Escrita anônima — recusada, com os códigos HTTP REAIS observados

Três tentativas reais com a chave `anon`, contra o objeto já existente e um objeto novo:

| Operação | Endpoint | HTTP (transporte, observado) | Corpo da resposta |
|---|---|---:|---|
| `POST` (criar objeto novo) | `/object/sih-municipio/v1/hackeado.json.gz` | **400** | `{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy","code":"AccessDenied"}` |
| `PUT` (sobrescrever `AC.json.gz`) | `/object/sih-municipio/v1/AC.json.gz` | **400** | `{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy","code":"AccessDenied"}` |
| `DELETE` (apagar `AC.json.gz`) | `/object/sih-municipio/v1/AC.json.gz` | **400** | `{"statusCode":"403","error":"Unauthorized","message":"Access denied","code":"AccessDenied"}` |

**Registro honesto (instrução explícita da task — reportar o código observado, não o esperado):**
o status HTTP de **transporte** (confirmado com `curl -v`, linha `HTTP/2 400`) é **400**, não
**401**/**403** como a redação do critério de aceitação antecipava. O corpo do erro, porém, carrega
`"statusCode":"403"` e `"code":"AccessDenied"` — é uma convenção conhecida da API de Storage do
Supabase: ela envelopa todo erro não-2xx vindo do Postgres/RLS num transporte HTTP 400, com o
código semântico real dentro do JSON. **A recusa em si é real e comprovada** (nenhum byte foi
escrito nem apagado — ver §6.5); o desvio é só na forma exata do código de transporte, não na
substância da negação.

### 6.5 Prova de que nada foi escrito

Listagem do bucket via `service_role` **depois** das três tentativas de escrita anônima:

```json
[{"name": "AC.json.gz", "id": "ff035b44-...", "metadata": {"size": 66111, ...}}]
```

Só `v1/AC.json.gz` existe, com o mesmo tamanho de antes das tentativas — `hackeado.json.gz` não
foi criado, e `AC.json.gz` não foi alterado nem apagado.

### 6.6 Listagem anônima — não vaza nada, mesmo tecnicamente "permitida"

```
POST /storage/v1/object/list/sih-municipio  (chave anon, prefix="")
-> HTTP 200, []
```

O endpoint de listagem não é bloqueado na borda (retorna 200), mas devolve **lista vazia** —
porque a listagem depende de uma policy `SELECT` em `storage.objects` que não existe (§6.7). Um
GET anônimo de um objeto inexistente também segue a mesma convenção do §6.4 (corpo
`"statusCode":"404"`, transporte HTTP 400).

### 6.7 Auditoria direta em `pg_policies` — zero policies, colada aqui

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```
```
 schemaname | tablename | policyname | cmd | roles | qual | with_check
------------+-----------+------------+-----+-------+------+------------
(0 rows)
```

**Zero policies de qualquer tipo** (não só insert/update/delete) para `storage.objects` — nem para
`anon`, nem para `authenticated`, nem para nenhum outro role. Consultado também para o schema
`storage` inteiro (todas as tabelas, não só `objects`): também zero linhas.

Isto só é seguro porque RLS está **habilitado** na tabela (confirmado: `relrowsecurity = t`,
`relforcerowsecurity = f`) — Postgres nega por padrão qualquer role não-dono quando RLS está
ligado e não há nenhuma policy permissiva. Confirmado também que `anon`/`authenticated` têm
`rolbypassrls = false` (não escapam da checagem) e `service_role` tem `rolbypassrls = true` (é
assim que `upload_partition`, via API de Storage autenticada com `service_role`, consegue
escrever mesmo sem nenhuma policy de `insert`).

`GRANT`s de tabela (`information_schema.role_table_grants`) mostram `anon`/`authenticated` com
INSERT/SELECT/UPDATE/DELETE concedidos em `storage.objects` — isto é o **padrão de todo projeto
Supabase** (a tabela é acessível por role, mas toda decisão de linha fica com RLS). Sem RLS
habilitado, esse GRANT teria sido perigoso; com RLS habilitado e zero policies, o efeito real é
"acesso zero" para essas roles via a tabela crua — a leitura pública do bucket funciona por um
caminho separado e deliberado (o endpoint `/object/public/...` da API de Storage, que decide com
base na flag `buckets.public`, não em RLS de `objects`).

**Resultado da auditoria: T-09-13 mitigado, confirmado por consulta direta E por tentativa real
de escrita — as duas provas que o threat model pediu.**

---

## 7. Comparação contra os tetos do plano gratuito

| Recurso | Teto do plano gratuito | Uso projetado (método B) | Margem |
|---|---:|---:|---:|
| Storage total | 1 GB | 139,0 MB (27 partições completas) | ~86% livre |
| Tamanho por objeto | 50 MB (confirmado ao vivo, §6.2) | 20,51 MB (SP, maior) | 2,4× abaixo |
| Egresso mensal | 5 GB + 5 GB egresso cacheado | ver cenários abaixo | — |

**Cenários de egresso (30 alunos, aula prática, CALCULADO a partir dos bytes medidos/projetados):**

- 30 alunos baixam SP (a maior UF) uma vez cada, numa aula: 30 × 20,51 MB ≈ **615 MB** — 12% do
  teto mensal de 5 GB, numa única aula.
- 30 alunos exploram 3 UFs grandes cada ao longo do mês: 30 × 3 × ~15 MB ≈ **1,35 GB** — 27% do
  teto mensal.
- Pior caso extremo (todos os 30 alunos baixam as 27 partições completas, uma vez cada, em um
  único mês): 30 × 139,0 MB ≈ **4,17 GB** — 83% do teto de 5 GB, próximo do limite mas ainda
  dentro dele; e esse cenário é didaticamente improvável (nenhum aluno individual precisa das 27
  UFs para um trabalho de bioestatística com recorte regional). O bucket "egresso cacheado" (mais
  5 GB adicionais para objetos servidos do cache de borda) dá folga extra para downloads
  repetidos do mesmo objeto popular.

O Storage total (139 MB projetado) usa **13,9%** do teto de 1 GB — folga grande mesmo se a
extrapolação do método B estiver subestimando por um fator de 2-3×.

---

## 8. Redis (D-22) — permanece descartado

Nenhuma dependência de cache externo entra neste desenho. O cache é inteiramente o cache HTTP do
navegador (favorecido pelo desenho de 27 arquivos grandes e estáveis, não milhares de arquivos
pequenos) mais o cache em memória por processo que `loadMunicipioPartition.ts` (Task 3) vai
implementar no mesmo padrão de `loadCatalog.ts` — decisão D-22 já travada na 09-CONTEXT, apenas
reafirmada aqui porque o critério de aceitação pede o registro explícito.

---

## 9. Decisão pendente — apresentada ao operador no checkpoint desta task

Este relatório termina aqui sem registrar uma decisão do operador — ela é coletada pelo checkpoint
`type="checkpoint:decision"` da Task 2, que apresenta os três formatos de partição possíveis
(`manter-por-uf`, `uf-por-ano`, `uf-com-grandes-divididas`) à luz dos números medidos acima. A
seção "Decisão do operador" será acrescentada a este arquivo quando a resposta chegar.
