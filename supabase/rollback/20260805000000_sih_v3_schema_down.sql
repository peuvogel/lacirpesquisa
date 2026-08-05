-- 20260805000000_sih_v3_schema_down.sql
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

-- Prova de integridade da reversao — a remocao da coluna local nao pode criar nem
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
end $$;
