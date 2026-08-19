# Supabase catalog backend (LACIR)

> **Contrato v3, capturado ao vivo em 2026-08-19** com `pg_dump --schema-only` pelo Session
> Pooler, logo depois de a migração `20260806000000_sih_retire_muni` ser aplicada. O que está
> aqui é o que o banco tem, não o que se pretendia que ele tivesse — a mesma disciplina que a
> Fase 8 aplicou ao criar a seção "Real schema (v2)", que esta substitui.

## Why

O app é um Vite/React estático servido sem backend próprio. O Supabase é o único lugar onde o
dado do SIH vive de forma consultável pelo navegador do aluno, com chave `anon`, sem servidor no
meio. O plano é o **gratuito**, com teto de **500 MB** de banco — e esse teto é uma restrição de
projeto, não um detalhe operacional: ele decide o que mora no Postgres e o que mora no Storage.

## Onde cada coisa mora

| Grão | Onde | Por quê |
|---|---|---|
| **UF × ano × local** | Postgres, `sih_metric_uf` | 207.965 linhas, 54 MB — cabe folgado e precisa de filtro/ordenação server-side |
| **Município × ano × local** | **Storage**, bucket `sih-municipio` | 12.404.039 linhas; como tabela media 319 MB e estourava o orçamento junto com a população |
| Cobertura/proveniência | Postgres, `sih_collection_status` | 67.168 linhas, consultado junto com a métrica |
| População | Postgres, `sih_population_*` | ~146 MB medidos; só cabe **depois** da evacuação do grão município |

**`sih_metric_muni` não existe mais.** Foi removida em 2026-08-19 pela migração
`20260806000000_sih_retire_muni` (D-20), depois de provado que as 27 partições do Storage servem o
mesmo grão a partir do microdado. O banco caiu de **430 MB para 112 MB** na mesma operação.

## Real schema (v3)

Sete tabelas em `public`. Todas com **RLS ligada** e exatamente uma policy, de `SELECT`, para
`anon` e `authenticated` — leitura anônima liberada, escrita anônima sem policy nenhuma.

### `sih_disease` — o catálogo canônico (331 agravos)

```sql
CREATE TABLE public.sih_disease (
    id text NOT NULL,
    label text NOT NULL,
    filter_kind text NOT NULL,      -- 'lista_morb' | 'procedimento'
    tabnet_code text NOT NULL,
    def_path text DEFAULT 'sih/cnv/nibr.def'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- PK (id)
```

> **Aviso sobre `tabnet_code`:** para `filter_kind = 'procedimento'` ele é um **índice posicional**
> dentro de um `<select>` do TabNet, e o DATASUS o desloca ao inserir procedimentos novos no meio
> da lista. Medido: o índice `3331` apontava para AMPUTAÇÃO em 2026-06-17 e para outro
> procedimento em 2026-08-12. Nunca use `tabnet_code` como identificador estável de procedimento —
> o pipeline casa por `PROC_REA` (código SIGTAP).

### `sih_metric_uf` — a métrica servida ao app

```sql
CREATE TABLE public.sih_metric_uf (
    disease_id text NOT NULL,
    uf_codigo character(2) NOT NULL,
    uf character(2) NOT NULL,
    uf_nome text,
    ano integer NOT NULL,
    internacoes numeric,
    obitos numeric,
    valor_total numeric,
    dias_permanencia numeric,
    taxa_mortalidade numeric,
    local text NOT NULL,            -- 'ocorrencia' | 'residencia'
    CONSTRAINT sih_metric_uf_ano_check CHECK (ano >= 1990 AND ano <= 2100)
);
-- PK (disease_id, uf_codigo, ano, local)
-- FK disease_id -> sih_disease(id) ON DELETE CASCADE
-- INDEX sih_metric_uf_disease_ano_local (disease_id, ano, local)
```

A dimensão **`local`** é o que a v2 não tinha: cada combinação aparece duas vezes, uma por
`ocorrencia` (onde a internação aconteceu) e uma por `residencia` (onde o paciente mora). Não são
alternativas de apresentação — respondem perguntas diferentes, e o app precisa dizer qual está
mostrando.

**O ano é contado por `DT_INTER` (data de internação), não por `ANO_CMPT` (competência de
faturamento)** — desde 2026-08-18. Ver `.planning/phases/09-.../09-17-SWAP-DT-INTER-SUMMARY.md`.

### `sih_collection_status` — o ledger de cobertura e proveniência

```sql
CREATE TABLE public.sih_collection_status (
    disease_id text NOT NULL,
    medida text NOT NULL,           -- internacoes | obitos | valor_total | dias_permanencia
    grao text NOT NULL,             -- 'uf' | 'municipio'
    local text NOT NULL,            -- 'ocorrencia' | 'residencia'
    ano integer NOT NULL,
    status text NOT NULL,           -- 'coletado' | 'falhou' | 'nunca_tentado'
    derived_at timestamp with time zone,
    cid_map_version text,
    row_count bigint,
    divergencia_pct numeric,
    divergencia_razao text,
    CONSTRAINT sih_collection_status_provenance_check
      CHECK (status <> 'coletado' OR (derived_at IS NOT NULL AND cid_map_version IS NOT NULL))
);
-- PK (disease_id, medida, grao, local, ano)
-- INDEX sih_collection_status_leitura (grao, local, ano)
```

O `provenance_check` é fail-closed por desenho: **nenhuma linha pode se declarar `coletado` sem
carregar de onde veio**. Um `INSERT` sem `derived_at`/`cid_map_version` é recusado pelo banco, não
por convenção.

### `sih_population_*` — quatro tabelas, hoje vazias

`sih_population_total_uf` (PK `uf_codigo, ano`), `sih_population_total_muni` (PK
`municipio_codigo, ano`), `sih_population_uf` e `sih_population_muni` (as duas com `sexo` e
`faixa_etaria` na PK; faixas de `'00-09'` a `'80+'`).

Existem no schema mas **nunca foram carregadas**. Com o grão município já evacuado, os ~146 MB
medidos agora cabem: o banco está em 112 MB, com 388 MB de folga.

## Como interpretar ausência (D-14)

A regra que separa **zero verdadeiro** de **ausência de dado** é uma função pura em
`pipeline/sih/src/sih_pipeline/audit.py::classificar_ausencia` — sem I/O, sem estado, pronta para
o front importar sem reinterpretar.

Dada uma combinação `(disease_id, medida, grao, local, ano)` que **já se confirmou sem linha de
métrica**:

- `status == 'coletado'` → **zero verdadeiro**. Processamos com sucesso e nenhum território teve
  internação. O mapa deve pintar zero, não cinza.
- `status IN ('falhou', 'nunca_tentado')` → **ausente**. Não processamos com sucesso; a ausência da
  linha é ausência de dado. O mapa deve pintar cinza, nunca zero.

As duas classes são mutuamente exclusivas por construção. Nunca deduza ausência da falta da linha
de métrica sozinha — sem consultar o ledger, as duas situações são indistinguíveis.

## Grão município: o bucket `sih-municipio`

27 objetos, `v1/{UF}.json.gz`, bucket **público** (`file_size_limit` = 52.428.800 bytes).
Estado medido em 2026-08-19: 131,50 MB no total, maior objeto **SP com 19,37 MB** — 2,6× sob o
teto por objeto.

Formato **JSON colunar**, gzip, descompactado no cliente com `DecompressionStream`:

```json
{
  "schema": 1,
  "uf": "AC",
  "colunas": ["disease_id","municipio_codigo","ano","local","internacoes","obitos",
              "valor_total","dias_permanencia","taxa_mortalidade"],
  "dados": [ [...], [...], ... ],
  "derivedAt": "2026-08-18T18:14:49Z",
  "cidMapVersion": "5395d951...8963f"
}
```

`dados` é uma lista de **colunas**, não de linhas: `dados[i]` é o array inteiro da coluna
`colunas[i]`, e o número de linhas é `len(dados[0])`. Ler `len(dados)` devolve o número de colunas
— erro fácil de cometer.

`derivedAt` e `cidMapVersion` viajam dentro de cada partição, então uma partição baixada e
cacheada no navegador continua sabendo de onde veio.

Escritor único: `pipeline/sih/src/sih_pipeline/partitions.py` (`npm run pipeline:partitions --
--todas --upload`). `upload.py --municipio` escreve **só a proveniência** desse grão em
`sih_collection_status` e nunca toca o Storage.

## Caminho de ingest: `COPY` + swap transacional

O ingest é `pipeline/sih/src/sih_pipeline/upload.py`, rodando na máquina do operador contra o
**Session Pooler** — host `aws-1-us-west-2.pooler.supabase.com`, a única conexão
IPv4-compatível que suporta o protocolo `COPY` no plano gratuito. `upload.py` valida que a URL
aponta mesmo para o pooler antes de qualquer trabalho, inclusive em `--dry-run`. A ordem é fixa
(PIPE-04) e nenhum caminho alternativo chega ao fim:

```
copy_to_staging  ->  swap  ->  recount_via_postgrest  ->  (só se conferir)  ->  release_cache
```

O `swap` é uma **transação única**: `TRUNCATE` da tabela viva + `INSERT ... SELECT` do staging +
`DROP` do staging. Uma exceção em qualquer ponto reverte tudo e a tabela viva fica exatamente como
estava. Usa `INSERT ... SELECT` em vez de `ALTER TABLE ... RENAME` de propósito: mantém
constraints, índices e policies da tabela viva intactos, sem precisar recriá-los.

```sh
export PATH="$(brew --prefix libpq)/bin:$PATH"
set -a; . ./.env.pipeline; set +a          # SIH_PIPELINE_DB_URL, SUPABASE_URL, SERVICE_ROLE_KEY

npm run pipeline:upload -- --dry-run                  # monta as linhas, não escreve nada
npm run pipeline:partitions -- --todas --upload       # 27 partições ao Storage (reversível)
npm run pipeline:upload -- --tabela sih_metric_uf     # o swap (irreversível)
npm run pipeline:upload -- --municipio                # proveniência do grão município
```

> **Nota histórica.** Até a Fase 9 o ingest era um scrape do TabNet enviado por uma Edge Function
> `sih-ingest`, com o segredo `INGEST_SECRET`, e um uploader Node em `scripts/catalog/`. A Edge
> Function, o segredo, os três scrapers e o uploader foram **removidos** no 09-14 — o segredo se
> resolveu por remoção, não por rotação, porque não sobrou nada que o leia. Nenhum desses caminhos
> existe hoje; se você encontrar referência a algum, é resíduo.

> **`supabase --linked` não funciona neste projeto** (sem `SUPABASE_ACCESS_TOKEN`). Todo comando
> do CLI usa `--db-url "$SIH_PIPELINE_DB_URL"`.

## App contract

O app lê com a chave **`anon`**, pelo PostgREST, nunca com `service_role` (que só existe em
`.env.pipeline`, offline, fora do bundle):

```
GET {SUPABASE_URL}/rest/v1/sih_metric_uf?disease_id=eq.{id}&ano=eq.{ano}&local=eq.{local}
```

Paginação do PostgREST **não é estável sem `order=` explícito** entre requisições — o gerador de
packs já corrige isso; qualquer consulta paginada nova precisa fazer o mesmo.

Os 10 packs estáticos em `public/data/catalog/packs/` são derivados de `sih_metric_uf` via
PostgREST por `npm run catalog:sih-packs`. **Precisam ser regerados depois de cada swap** — gerados
antes, materializam números velhos num arquivo estático e o site passa a servir dado antigo com
carimbo novo.

## `supabase/` — estrutura de diretórios

| Diretório | Conteúdo | Varrido por `db push`? |
|---|---|---|
| `migrations/` | `20260804015329_remote_schema`, `20260804020000_rename_disease_ids`, `20260805000000_sih_v3_schema`, `20260806000000_sih_retire_muni` | **sim** |
| `rollback/` | o `_down.sql` de cada migração reversível | não |
| `verify/` | `contagens`, `sih-v3-schema`, `sih-swap-contagens`, `sih-retire` | não |

Só `migrations/` é varrido — por isso `rollback/` e `verify/` moram fora dele de propósito, e há
teste que falha se um `_down.sql` aparecer sob `migrations/`.

Os `verify/` provam por `RAISE EXCEPTION`: rodam contra produção e **saem 0 em silêncio** quando
tudo está certo. `sih-swap-contagens.sql` e `sih-retire.sql` carregam contagens **cravadas à mão**
nos geradores (`ESPERADO_SIH_METRIC_UF`), medidas na corrida real e nunca derivadas de produção —
derivar seria circular. Editar a constante no gerador e regerar é o único caminho previsto; os dois
geradores que a cravam precisam ser editados juntos, e há teste que trava a igualdade entre eles.
