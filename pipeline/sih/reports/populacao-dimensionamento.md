# Dimensionamento real da população (D-24) — POPSVS × teto de 500 MB

**Medido em:** 2026-08-10
**Plano:** 09-06 (`.planning/phases/09-pipeline-confi-vel-coleta-completa/09-06-PLAN.md`), Task 2
**Objetivo:** o D-24 pede que a disponibilidade da fonte e o tamanho do dado estratificado sejam
tratados como **hipótese a confirmar**, não como fato. Este relatório traz as medições reais que
faltavam — nenhum número aqui é estimado sem uma medição por trás.

---

## 1. Contagem de linhas — medida, não estimada

`aggregate_population(range(2013, 2026))` (os 13 anos da janela D-11) rodou de ponta a ponta uma
única vez, sobre os 13 arquivos `POPSBR13..POPSBR25` reais baixados do FTP do DATASUS nesta sessão
(nunca a rota de conveniência da biblioteca — RESEARCH Pitfalls 3/4/5). Resultado exato:

| Coleção (nome exato da tabela, 09-03) | Linhas medidas |
|---|---:|
| `sih_population_total_uf` | 351 |
| `sih_population_total_muni` | 72.411 |
| `sih_population_uf` | 6.318 |
| `sih_population_muni` | 1.303.398 |
| **Total (4 tabelas)** | **1.382.478** |

- Registros brutos lidos do DBF nos 13 anos: **11.730.582** (5.570–5.571 municípios × 81 idades ×
  2 sexos × 13 anos — a contagem de municípios sobe de 5.570 para 5.571 em 2025, mudança real do
  IBGE, não um defeito de leitura).
- Descarte (SEXO/IDADE não classificável, T-09-25): **0 em 11.730.582 (0,0000%)** — muito abaixo
  do limite de 0,01%, nos 13 anos, sem exceção.
- `sih_population_total_uf` fica fixo em 27 UFs × 13 anos = 351 em todo ano (nenhum UF some ou
  aparece). `sih_population_uf` fica fixo em 27 × 9 faixas × 2 sexos × 13 anos = 6.318. As duas
  coleções de município variam ano a ano só pela mudança real de 5.570→5.571 municípios em 2025.
- **Desvio encontrado e corrigido durante esta medição:** o arquivo `POPSBR25` (o ano mais recente
  da própria janela D-11) vem com os nomes de campo do DBF em **minúsculas**
  (`cod_mun`/`ano`/`sexo`/`idade`/`pop`), diferente de `POPSBR13..POPSBR24` (maiúsculas). Sem a
  normalização, `aggregate_population` levantava `KeyError('COD_MUN')` para 2025 e a janela D-11
  nunca fechava com os 13 anos completos. Corrigido em `read_popsvs_year` (commit `cc41dd5`,
  Rule 1 — bug de comportamento, corrigido inline antes desta medição prosseguir) — ver
  `09-06-SUMMARY.md` quando a plan fechar.

## 2. Tamanho projetado — duas medições independentes

### 2.1 Medição real: carga completa num Postgres local idêntico ao schema da 09-03

As quatro `CREATE TABLE` (colunas, `PRIMARY KEY`, `CHECK`) foram copiadas **literalmente** de
`supabase/migrations/20260805000000_sih_v3_schema.sql` para um Postgres 17 local (Docker,
descartado ao final desta medição — nunca tocou o projeto Supabase real). As 1.382.478 linhas reais
(as mesmas geradas na seção 1, via `COPY`) foram carregadas, seguidas de `VACUUM ANALYZE`, e o
tamanho em disco foi lido com `pg_total_relation_size`/`pg_relation_size`/`pg_indexes_size` — a
mesma família de função que produziu a medição do `sih_metric_muni` já registrada no CONTEXT.

| Tabela | Total | Heap | Índices | Linhas |
|---|---:|---:|---:|---:|
| `sih_population_muni` | 139 MB (145.432.576 B) | 75 MB | 64 MB | 1.303.398 |
| `sih_population_total_muni` | 6.472 kB (6.627.328 B) | 3.696 kB | 2.744 kB | 72.411 |
| `sih_population_uf` | 608 kB (622.592 B) | 328 kB | 240 kB | 6.318 |
| `sih_population_total_uf` | 64 kB (65.536 B) | 16 kB | 16 kB | 351 |
| **Total (4 tabelas)** | **≈ 146 MB (152.748.032 B)** | — | — | 1.382.478 |

Esta é a medição mais confiável deste relatório: schema idêntico, dado real, índice real
(`PRIMARY KEY` composta em cada uma das 4 tabelas, sem índice secundário — diferente de
`sih_metric_muni`, que tem 2 índices).

### 2.2 Projeção conservadora: razão medida de `sih_metric_muni` (pedida pelo plano)

O plano pede, além da medição direta, uma projeção usando como base a razão bytes/linha já
registrada no CONTEXT (`sih_metric_muni`: 334.315.520 B totais / 1.099.403 linhas). Medido
novamente ao vivo nesta sessão para maior precisão (bytes exatos, não a versão arredondada em MB do
CONTEXT):

| | `sih_metric_muni` medido | bytes/linha |
|---|---:|---:|
| Total | 334.315.520 B | 304,09 |
| Heap | 159.653.888 B | 145,22 |
| Índices (2: `pkey` 147 MB + `sih_metric_muni_disease_uf_ano` 19 MB) | 174.587.904 B | 158,80 |

Aplicando 304,09 B/linha às 1.382.478 linhas medidas na seção 1: **≈ 420,4 MB (420.395.298 B)**.

**Por que as duas projeções divergem quase 3×:** `sih_metric_muni` carrega `disease_id` (texto
longo, repetido em 2 índices — CONTEXT já registrava "índices pesando mais que o dado") e 9
colunas; as tabelas de população têm só 1 índice (a própria `PRIMARY KEY`, sem índice secundário)
e colunas de largura fixa e curta (`char(2)`, `char(6)`, `char(1)`, `int`, `bigint`, mais
`faixa_etaria text` com 5-9 bytes reais). A razão de `sih_metric_muni` é portanto um teto
conservador, não uma boa previsão pontual — a medição real da seção 2.1 é a que deve pesar na
decisão.

## 3. Espaço já ocupado hoje no projeto — medido

```sql
select pg_size_pretty(sum(pg_total_relation_size(relid)))
from pg_catalog.pg_statio_user_tables;
-- 327 MB (342.515.712 B), medido ao vivo em 2026-08-10
```

| Tabela | Total medido | Observação |
|---|---:|---|
| `sih_metric_muni` | 334.315.520 B (319 MB) | **Dado do TabNet legado (município), a evacuar do banco por D-20/D-16** — ver §5 |
| `sih_metric_uf` | 6.594.560 B (6,3 MB) | 30.313 linhas — cobertura parcial (93/331 agravos, medição do CONTEXT) |
| `sih_disease` | 139.264 B (136 kB) | 331 linhas, já completo |
| Demais tabelas do Supabase (auth/storage internos) | ≈ 1,5 MB | Infraestrutura do projeto, não deste pipeline |
| **Total ocupado hoje** | **342.515.712 B (327 MB)** | |
| `sih_population_*` (as 4 tabelas) | 0 B | Ainda vazias — nenhum `COPY` rodou (D-01: upload é do 09-10) |

## 4. Comparação POPSVS × POPTCU — a checagem de sanidade do RESEARCH Open Question 3

| Recorte | POPSVS (soma agregada) | POPTCU | Diferença | % |
|---|---:|---:|---:|---:|
| AC / 2019 (22 municípios) | 857.919 | 881.935 | −24.016 | **−2,72%** |
| Brasil / 2019 (5.570 municípios) | 207.900.099 | 210.147.125 | −2.247.026 | **−1,07%** |

`POPTCU` é a base de repasse fiscal (usada por `POPTBR{AA}.zip`, sem sexo/idade); `POPSVS` é a
base institucional de vigilância em saúde (a única com município **e** sexo/idade ao mesmo tempo —
RESEARCH Pitfall 5). As duas divergem de forma pequena e sistemática (POPSVS menor que POPTCU em
ambos os recortes) — divergência de metodologia de estimativa entre bases do IBGE/DATASUS, não um
erro de leitura (a mesma ordem de grandeza nos dois recortes, AC e Brasil inteiro). O desvio de AC
(−2,72%) é maior que o nacional (−1,07%) — há variação regional na divergência entre as duas
bases, o que por si só não invalida `POPSVS`, mas é uma diferença real que fica registrada aqui.

**Não foi possível, dentro do escopo desta medição, confirmar de forma definitiva qual base o
TabNet usa como denominador oficial das taxas que a Fase 9 tenta reconciliar** — a suposição A3 do
RESEARCH (confiança MEDIUM) continua sendo suposição. A diferença medida (~1-3%) é pequena o
bastante para não invalidar `POPSVS` como escolha, mas grande o bastante para valer registro
explícito na proveniência de qualquer taxa que a Fase 10 exibir (D-08).

## 5. Nota sobre o espaço ocupado hoje × o desenho já decidido da fase (D-16/D-20)

Os 319 MB de `sih_metric_muni` medidos na seção 3 são dado do **caminho TabNet legado**
(1.099.403 linhas, município). D-16 já decidiu a substituição atômica total desse dado pelo
microdado quando a reconciliação fechar; D-20 já decidiu que o grão município passa a morar no
Supabase Storage, não no banco. Ou seja: **o próprio desenho já travado desta fase evacua esses
319 MB do Postgres** quando o 09-10 (upload) rodar o swap transacional — este relatório não está
propondo isso, só registrando que o número de "327 MB ocupados hoje" é uma fotografia transitória
de um estado que a fase já decidiu substituir, não a linha de base de longo prazo.

Isso é relevante para a decisão da Task 2 porque muda o "contra o quê" comparar a projeção da
população:

- **Comparação "hoje", antes de qualquer swap** (o pior caso, caso o `COPY` da população rodasse
  antes do 09-10 evacuar `sih_metric_muni`): 342.515.712 B (hoje) + 152.748.032 B (população,
  medição real §2.1) = **495.263.744 B ≈ 472,4 MB** — deixa ≈ 27,6 MB de folga contra um teto de
  500×1024×1024 B, ou ≈ 4,5 MB contra um teto de 500.000.000 B decimal. **Margem muito apertada em
  qualquer uma das duas leituras do teto.**
- **Comparação "regime permanente"** (depois do 09-10 evacuar o município para o Storage,
  cenário que D-16/D-20 já decidiram, não uma proposta nova): `sih_disease` (136 kB, completo) +
  `sih_metric_uf` em cobertura completa (D-20 estima ~232 mil linhas/~28 MB — **não remedido nesta
  plan**, fora do escopo da 09-06) + `sih_collection_status` (D-13 estima ~69 mil linhas,
  **não remedido nesta plan**) + população (152.748.032 B, medição real §2.1) ≈ **bem abaixo de
  200 MB**, com folga confortável contra o teto de 500 MB.

Nenhuma das duas comparações depende de estimativa para a parte da população — os 152.748.032 B
são medidos (§2.1). A parte que seria estimada (`sih_metric_uf`/`sih_collection_status` em
cobertura completa) pertence a outras plans (09-04/09-10), fora do escopo de medição desta plan.

## 6. Recomendação preliminar (não é a decisão — ver checkpoint)

A medição real (§2.1, 146 MB) é ordens de grandeza mais confiável que a projeção conservadora
(§2.2, 420 MB) porque usa o schema real e dado real, não uma razão importada de uma tabela com
formato de coluna muito diferente. Sob o regime permanente que D-16/D-20 já decidiram para esta
mesma fase, as quatro tabelas de população cabem no banco gratuito com folga confortável — nenhuma
das opções B/C do checkpoint (Storage ou faixas mais largas) parece necessária **se** o regime
permanente for o cenário relevante. A única situação onde a margem fica de fato apertada é a
comparação "hoje" (§5), que é transitória por construção do próprio desenho da fase e não deveria
persistir além do 09-10.

Esta seção é uma leitura, não uma decisão — a decisão (fonte + onde mora o estrato) é do operador,
registrada abaixo.

---

## Decisão do operador

**Data:** _(preencher no momento da resposta ao checkpoint)_
**Fonte do denominador (POPSVS confirmada ou corrigida):** _(pendente)_
**Opção escolhida (`popsvs-no-banco` / `popsvs-estratificado-no-storage` / `faixas-mais-largas`):**
_(pendente)_
**Justificativa registrada pelo operador:** _(pendente)_
