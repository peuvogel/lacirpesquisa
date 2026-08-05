-- 20260805000000_sih_v3_schema.sql
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
alter table sih_metric_uf add constraint sih_metric_uf_local_check check (local in ('ocorrencia', 'residencia'));

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
  constraint sih_collection_status_medida_check check (medida in ('internacoes', 'obitos', 'valor_total', 'dias_permanencia')),
  constraint sih_collection_status_grao_check check (grao in ('uf', 'municipio')),
  constraint sih_collection_status_local_check check (local in ('ocorrencia', 'residencia')),
  constraint sih_collection_status_status_check check (status in ('coletado', 'falhou', 'nunca_tentado')),
  constraint sih_collection_status_ano_check check (ano >= 2013 and ano <= 2100),
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
  constraint sih_population_total_uf_ano_check check (ano >= 2013 and ano <= 2100),
  constraint sih_population_total_uf_populacao_check check (populacao >= 0)
);

create table sih_population_total_muni (
  municipio_codigo char(6) not null,
  uf_codigo char(2) not null,
  ano int not null,
  populacao bigint not null,
  constraint sih_population_total_muni_pkey primary key (municipio_codigo, ano),
  constraint sih_population_total_muni_ano_check check (ano >= 2013 and ano <= 2100),
  constraint sih_population_total_muni_populacao_check check (populacao >= 0)
);

create table sih_population_uf (
  uf_codigo char(2) not null,
  ano int not null,
  sexo char(1) not null,
  faixa_etaria text not null,
  populacao bigint not null,
  constraint sih_population_uf_pkey primary key (uf_codigo, ano, sexo, faixa_etaria),
  constraint sih_population_uf_ano_check check (ano >= 2013 and ano <= 2100),
  constraint sih_population_uf_sexo_check check (sexo in ('M', 'F')),
  constraint sih_population_uf_faixa_etaria_check check (faixa_etaria in ('00-09', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+')),
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
  constraint sih_population_muni_ano_check check (ano >= 2013 and ano <= 2100),
  constraint sih_population_muni_sexo_check check (sexo in ('M', 'F')),
  constraint sih_population_muni_faixa_etaria_check check (faixa_etaria in ('00-09', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+')),
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

-- Prova de integridade — aborta a transacao inteira (RAISE EXCEPTION) se qualquer
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
end $$;
