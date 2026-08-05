#!/usr/bin/env node
/**
 * Generate the schema v3 migration (up), its rollback (down) and the post-migration
 * verification SQL from `schema-v3.json` (D-13, D-14, D-15, D-24 — PIPE-02, DATA-04,
 * DATA-01, DATA-02). No SQL here is hand-transcribed — every check-constraint value list
 * comes from `schema-v3.json`, the single source read by this generator **and**, from plan
 * 09-06 onward, by the Python pipeline. The migration timestamp is a constant declared
 * below (not `new Date()`), so regenerating is deterministic and
 * `sihSchemaMigration.test.ts` can compare byte-for-byte against the committed files.
 *
 * Aditiva, ao contrário de `generateRenameMigration.mjs`: adiciona a coluna `local` em
 * `sih_metric_uf`, cria `sih_collection_status` (Camada 2 do ledger) e as quatro tabelas de
 * população (D-24). Nenhuma FK nova carrega `ON UPDATE CASCADE` (Fase 8 D-08) — só
 * `ON DELETE CASCADE` de `sih_disease`, igual às tabelas de métrica já existentes.
 * `sih_metric_muni` **não** é tocada aqui — ela sai do banco por inteiro no plano `09-14`.
 *
 * Usage: node scripts/catalog/generateSihSchemaMigration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';

const SCHEMA_PATH = path.join(ROOT, 'scripts/catalog/schema-v3.json');

/** Constant, not `Date.now()` — regenerating must reproduce this filename exactly. */
export const MIGRATION_TIMESTAMP = '20260805000000';

export const UP_RELATIVE_PATH = `supabase/migrations/${MIGRATION_TIMESTAMP}_sih_v3_schema.sql`;
export const DOWN_RELATIVE_PATH = `supabase/rollback/${MIGRATION_TIMESTAMP}_sih_v3_schema_down.sql`;
export const VERIFY_RELATIVE_PATH = 'supabase/verify/sih-v3-schema.sql';

/** Nomes fixos das cinco tabelas novas (bloco `<interfaces>` do plano) — nunca `sih_metric_muni`. */
const SIH_V3_NEW_TABLES = [
  'sih_collection_status',
  'sih_population_total_uf',
  'sih_population_total_muni',
  'sih_population_uf',
  'sih_population_muni',
];

/**
 * Medido ao vivo por PostgREST na Fase 8 Plan 10 (anon key, `Prefer: count=exact`) e
 * reconfirmado antes desta migração (Task 3, plano 09-03) — a adição da coluna `local` é
 * puramente aditiva e não pode mudar esta contagem.
 */
const SIH_METRIC_UF_ROWS = 30313;

/** Limite superior do check constraint em banco — o mesmo teto largo já usado por
 * `sih_metric_uf`/`sih_metric_muni` (`ano <= 2100`), não o `anoMax` editorial (2025) da
 * janela de coleta do D-11. */
const ANO_MAX_CHECK = 2100;

/**
 * @param {unknown} value
 * @returns {string}
 */
function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * @param {string[]} values
 * @returns {string}
 */
function renderInList(values) {
  return values.map((v) => sqlString(v)).join(', ');
}

function renderUpIntegrityDoBlock() {
  return `-- Prova de integridade — aborta a transacao inteira (RAISE EXCEPTION) se qualquer
-- checagem falhar. Comparacao com IS DISTINCT FROM, nao "=", para que NULL conte como NULL
-- e nao passe batido.
do $$
declare
  v_uf_antes bigint;
  v_uf_depois bigint;
  v_uf_local_errado bigint;
  v_status_linhas bigint;
begin
  select n into v_uf_antes from __antes_sih_metric_uf;

  select count(*) into v_uf_depois from sih_metric_uf;
  if v_uf_antes is distinct from v_uf_depois then
    raise exception 'sih_v3_schema: contagem de sih_metric_uf mudou ao adicionar local (antes=%, depois=%)', v_uf_antes, v_uf_depois;
  end if;

  select count(*) into v_uf_local_errado from sih_metric_uf where local is distinct from 'ocorrencia';
  if v_uf_local_errado > 0 then
    raise exception 'sih_v3_schema: % linha(s) de sih_metric_uf sem local = ocorrencia apos o backfill', v_uf_local_errado;
  end if;

  select count(*) into v_status_linhas from sih_collection_status;
  if v_status_linhas is distinct from 0 then
    raise exception 'sih_v3_schema: sih_collection_status deveria nascer vazia, tem % linha(s)', v_status_linhas;
  end if;
end $$;`;
}

function renderDownIntegrityDoBlock() {
  return `-- Prova de integridade da reversao — a remocao da coluna local nao pode criar nem
-- perder linha de sih_metric_uf.
do $$
declare
  v_uf_antes bigint;
  v_uf_depois bigint;
begin
  select n into v_uf_antes from __antes_sih_metric_uf;

  select count(*) into v_uf_depois from sih_metric_uf;
  if v_uf_antes is distinct from v_uf_depois then
    raise exception 'sih_v3_schema_down: contagem de sih_metric_uf mudou ao remover local (antes=%, depois=%)', v_uf_antes, v_uf_depois;
  end if;
end $$;`;
}

/**
 * @param {{ medidas: string[], graos: string[], locais: string[], statuses: string[], sexos: string[], anoMin: number, faixasEtarias: Array<{id:string,idadeMin:number,idadeMax:number}> }} schema
 * @returns {string}
 */
export function renderUpMigration(schema) {
  const { medidas, graos, locais, statuses, sexos, anoMin, faixasEtarias } = schema;
  const faixaIds = faixasEtarias.map((f) => f.id);

  return `-- ${MIGRATION_TIMESTAMP}_sih_v3_schema.sql
-- Fase 9 Plan 3 (PIPE-02, DATA-04, DATA-01, DATA-02) — gerado por
-- scripts/catalog/generateSihSchemaMigration.mjs a partir de scripts/catalog/schema-v3.json.
-- NAO EDITAR A MAO: editar schema-v3.json e regerar (sihSchemaMigration.test.ts compara
-- este arquivo byte a byte contra a regeracao em memoria).
--
-- Aditiva: dimensao local em sih_metric_uf, ledger sih_collection_status (Camada 2 —
-- D-13/D-14/D-15) e quatro tabelas de populacao (D-24). A FK nova nao propaga renomeacao
-- de id (Fase 8 D-08, mesma ausencia deliberada das FKs de metrica ja existentes) — so
-- apaga em cascata quando o agravo pai e apagado. O Supabase CLI ja envolve este arquivo
-- numa transacao implicita — sem BEGIN/COMMIT aqui.

-- Retrato "antes" de sih_metric_uf — a adicao da coluna local nao pode criar nem perder
-- linha (prova de integridade ao final deste arquivo).
create temporary table __antes_sih_metric_uf on commit drop as
select count(*) as n from sih_metric_uf;

-- (1) dimensao local em sih_metric_uf, com default temporario so para preencher as linhas
-- de hoje.
alter table sih_metric_uf add column local text not null default 'ocorrencia';

-- (2) check constraint da dimensao local, a partir de schema-v3.json.
alter table sih_metric_uf add constraint sih_metric_uf_local_check check (local in (${renderInList(locais)}));

-- (3) chave primaria ganha local — a granularidade de sih_metric_uf passa a ser
-- (disease_id, uf_codigo, ano, local).
alter table sih_metric_uf drop constraint sih_metric_uf_pkey;
alter table sih_metric_uf add constraint sih_metric_uf_pkey primary key (disease_id, uf_codigo, ano, local);

-- (4) remove o default: existiu so para preencher as linhas de hoje. Deixa-lo vivo
-- permitiria um insert futuro cair em 'ocorrencia' por omissao — exatamente o tipo de
-- silencio que esta fase existe para matar.
alter table sih_metric_uf alter column local drop default;

-- (5) indice de leitura reflete a nova coluna.
drop index if exists sih_metric_uf_disease_ano;
create index sih_metric_uf_disease_ano_local on sih_metric_uf (disease_id, ano, local);

-- (6) sih_collection_status — Camada 2 do ledger (D-13/D-14/D-15). Chave
-- (disease_id, medida, grao, local, ano): o ano e obrigatorio porque uma coleta parcial no
-- tempo (2025 ainda incompleto no FTP, todo ano) precisa ser distinguivel de completa. FK
-- que nao propaga renomeacao de id (D-08, mesma ausencia deliberada das FKs de metrica) e
-- check de proveniencia obrigatoria (SC-6/DATA-04): o banco recusa uma linha "coletada" sem
-- derived_at e cid_map_version.
create table sih_collection_status (
  disease_id text not null,
  medida text not null,
  grao text not null,
  local text not null,
  ano int not null,
  status text not null,
  derived_at timestamptz,
  cid_map_version text,
  row_count bigint,
  divergencia_pct numeric,
  divergencia_razao text,
  constraint sih_collection_status_pkey primary key (disease_id, medida, grao, local, ano),
  constraint sih_collection_status_disease_id_fkey foreign key (disease_id)
    references sih_disease(id) on delete cascade,
  constraint sih_collection_status_medida_check check (medida in (${renderInList(medidas)})),
  constraint sih_collection_status_grao_check check (grao in (${renderInList(graos)})),
  constraint sih_collection_status_local_check check (local in (${renderInList(locais)})),
  constraint sih_collection_status_status_check check (status in (${renderInList(statuses)})),
  constraint sih_collection_status_ano_check check (ano >= ${anoMin} and ano <= ${ANO_MAX_CHECK}),
  constraint sih_collection_status_provenance_check check (status <> 'coletado' or (derived_at is not null and cid_map_version is not null))
);

-- (7) indice de leitura: a Fase 10 consulta o ledger por grao x local x ano.
create index sih_collection_status_leitura on sih_collection_status (grao, local, ano);

-- (8) populacao IBGE/DATASUS (D-24) — total e estratificada por sexo e faixa etaria, nos
-- dois graos. sexo usa o codigo canonico (M/F); a normalizacao de {1,3} (SIH) e {1,2}
-- (POPSVS) acontece no pipeline Python, nunca no banco.
create table sih_population_total_uf (
  uf_codigo char(2) not null,
  ano int not null,
  populacao bigint not null,
  constraint sih_population_total_uf_pkey primary key (uf_codigo, ano),
  constraint sih_population_total_uf_ano_check check (ano >= ${anoMin} and ano <= ${ANO_MAX_CHECK}),
  constraint sih_population_total_uf_populacao_check check (populacao >= 0)
);

create table sih_population_total_muni (
  municipio_codigo char(6) not null,
  uf_codigo char(2) not null,
  ano int not null,
  populacao bigint not null,
  constraint sih_population_total_muni_pkey primary key (municipio_codigo, ano),
  constraint sih_population_total_muni_ano_check check (ano >= ${anoMin} and ano <= ${ANO_MAX_CHECK}),
  constraint sih_population_total_muni_populacao_check check (populacao >= 0)
);

create table sih_population_uf (
  uf_codigo char(2) not null,
  ano int not null,
  sexo char(1) not null,
  faixa_etaria text not null,
  populacao bigint not null,
  constraint sih_population_uf_pkey primary key (uf_codigo, ano, sexo, faixa_etaria),
  constraint sih_population_uf_ano_check check (ano >= ${anoMin} and ano <= ${ANO_MAX_CHECK}),
  constraint sih_population_uf_sexo_check check (sexo in (${renderInList(sexos)})),
  constraint sih_population_uf_faixa_etaria_check check (faixa_etaria in (${renderInList(faixaIds)})),
  constraint sih_population_uf_populacao_check check (populacao >= 0)
);

create table sih_population_muni (
  municipio_codigo char(6) not null,
  uf_codigo char(2) not null,
  ano int not null,
  sexo char(1) not null,
  faixa_etaria text not null,
  populacao bigint not null,
  constraint sih_population_muni_pkey primary key (municipio_codigo, ano, sexo, faixa_etaria),
  constraint sih_population_muni_ano_check check (ano >= ${anoMin} and ano <= ${ANO_MAX_CHECK}),
  constraint sih_population_muni_sexo_check check (sexo in (${renderInList(sexos)})),
  constraint sih_population_muni_faixa_etaria_check check (faixa_etaria in (${renderInList(faixaIds)})),
  constraint sih_population_muni_populacao_check check (populacao >= 0)
);

-- (9) RLS select-only para anon e authenticated nas cinco tabelas novas. Nenhuma policy de
-- insert/update/delete: toda escrita entra por COPY com a credencial do banco (pipeline
-- offline), nunca pelo cliente.
alter table sih_collection_status enable row level security;
create policy sih_collection_status_select_anon on sih_collection_status for select to anon, authenticated using (true);

alter table sih_population_total_uf enable row level security;
create policy sih_population_total_uf_select_anon on sih_population_total_uf for select to anon, authenticated using (true);

alter table sih_population_total_muni enable row level security;
create policy sih_population_total_muni_select_anon on sih_population_total_muni for select to anon, authenticated using (true);

alter table sih_population_uf enable row level security;
create policy sih_population_uf_select_anon on sih_population_uf for select to anon, authenticated using (true);

alter table sih_population_muni enable row level security;
create policy sih_population_muni_select_anon on sih_population_muni for select to anon, authenticated using (true);

${renderUpIntegrityDoBlock()}
`;
}

/**
 * @param {{ medidas: string[], graos: string[], locais: string[], statuses: string[], sexos: string[], anoMin: number, faixasEtarias: Array<{id:string,idadeMin:number,idadeMax:number}> }} schema
 * @returns {string}
 */
export function renderDownMigration(schema) {
  // schema não é usado no corpo do down (ele desfaz por nome de tabela/coluna fixo), mas
  // recebido para manter a mesma assinatura de renderUpMigration/renderVerifySql.
  void schema;

  return `-- ${MIGRATION_TIMESTAMP}_sih_v3_schema_down.sql
-- Fase 9 Plan 3 — reversao do up, gerada por scripts/catalog/generateSihSchemaMigration.mjs
-- a partir de scripts/catalog/schema-v3.json. NAO EDITAR A MAO. Fica FORA de
-- supabase/migrations/ de proposito: supabase db push aplica tudo que estiver em
-- migrations/, e este script aplicado por engano desfaria a migracao em producao.
--
-- Desfaz na ordem inversa do up: dropa as cinco tabelas novas (RLS e policies vao junto,
-- automaticamente, com o DROP TABLE), recria o indice e a PK antigos de sih_metric_uf e
-- remove a coluna local. Sem BEGIN/COMMIT (roda via psql/CLI, envolvida manualmente numa
-- transacao quando aplicada).

-- Retrato "antes" (estado pos-up) de sih_metric_uf, para a mesma prova de integridade do
-- up na direcao inversa.
create temporary table __antes_sih_metric_uf on commit drop as
select count(*) as n from sih_metric_uf;

-- Reversao de (9)+(8)+(7)+(6) — dropa as cinco tabelas novas, na ordem inversa de criacao.
drop table sih_population_muni;
drop table sih_population_uf;
drop table sih_population_total_muni;
drop table sih_population_total_uf;
drop table sih_collection_status;

-- Reversao de (5) — indice antigo de volta.
drop index if exists sih_metric_uf_disease_ano_local;
create index sih_metric_uf_disease_ano on sih_metric_uf (disease_id, ano);

-- Reversao de (3) — PK antiga de volta, sem local.
alter table sih_metric_uf drop constraint sih_metric_uf_pkey;
alter table sih_metric_uf add constraint sih_metric_uf_pkey primary key (disease_id, uf_codigo, ano);

-- Reversao de (2)+(1) — remove o check e a coluna.
alter table sih_metric_uf drop constraint sih_metric_uf_local_check;
alter table sih_metric_uf drop column local;

${renderDownIntegrityDoBlock()}
`;
}

/**
 * @param {{ medidas: string[], graos: string[], locais: string[], statuses: string[], sexos: string[], anoMin: number, faixasEtarias: Array<{id:string,idadeMin:number,idadeMax:number}> }} schema
 * @returns {string}
 */
export function renderVerifySql(schema) {
  // schema não é usado no corpo do verify (as cinco tabelas e a contagem são fixas), mas
  // recebido para manter a mesma assinatura de renderUpMigration/renderDownMigration.
  void schema;

  return `-- sih-v3-schema.sql
-- Fase 9 Plan 3 (PIPE-02, DATA-04) — gerado por scripts/catalog/generateSihSchemaMigration.mjs
-- a partir de scripts/catalog/schema-v3.json. NAO EDITAR A MAO.
--
-- Roda manualmente apos a migracao (supabase db push) — fica FORA de supabase/migrations/,
-- entao supabase db push nunca aplica isto.
do $$
declare
  tbl text;
  v_select_policies int;
  v_write_policies int;
  v_uf_count bigint;
  v_uf_local_errado bigint;
begin
  foreach tbl in array array[${renderInList(SIH_V3_NEW_TABLES)}]
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      raise exception 'sih-v3-schema: tabela % nao existe', tbl;
    end if;

    if not exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = tbl and rowsecurity = true
    ) then
      raise exception 'sih-v3-schema: tabela % nao tem row level security habilitada', tbl;
    end if;

    select count(*) into v_select_policies
    from pg_policies
    where schemaname = 'public' and tablename = tbl and cmd = 'SELECT';
    if v_select_policies is distinct from 1 then
      raise exception 'sih-v3-schema: tabela % tem % policy(ies) de select, esperado 1', tbl, v_select_policies;
    end if;

    select count(*) into v_write_policies
    from pg_policies
    where schemaname = 'public' and tablename = tbl and cmd in ('INSERT','UPDATE','DELETE');
    if v_write_policies is distinct from 0 then
      raise exception 'sih-v3-schema: tabela % tem % policy(ies) de escrita, esperado 0', tbl, v_write_policies;
    end if;
  end loop;

  select count(*) into v_uf_count from sih_metric_uf;
  if v_uf_count is distinct from ${SIH_METRIC_UF_ROWS} then
    raise exception 'sih-v3-schema: sih_metric_uf tem % linhas, esperado ${SIH_METRIC_UF_ROWS}', v_uf_count;
  end if;

  select count(*) into v_uf_local_errado from sih_metric_uf where local is distinct from 'ocorrencia';
  if v_uf_local_errado > 0 then
    raise exception 'sih-v3-schema: % linha(s) de sih_metric_uf sem local = ocorrencia', v_uf_local_errado;
  end if;
end $$;
`;
}

function loadData() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function main() {
  const schema = loadData();

  const upPath = path.join(ROOT, UP_RELATIVE_PATH);
  const downPath = path.join(ROOT, DOWN_RELATIVE_PATH);
  const verifyPath = path.join(ROOT, VERIFY_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(upPath), { recursive: true });
  fs.mkdirSync(path.dirname(downPath), { recursive: true });
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });

  fs.writeFileSync(upPath, renderUpMigration(schema));
  fs.writeFileSync(downPath, renderDownMigration(schema));
  fs.writeFileSync(verifyPath, renderVerifySql(schema));

  console.log(
    `generateSihSchemaMigration: schema-v3.json -> ${UP_RELATIVE_PATH}, ${DOWN_RELATIVE_PATH}, ${VERIFY_RELATIVE_PATH}`,
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
