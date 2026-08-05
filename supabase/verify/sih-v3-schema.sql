-- sih-v3-schema.sql
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
  foreach tbl in array array['sih_collection_status', 'sih_population_total_uf', 'sih_population_total_muni', 'sih_population_uf', 'sih_population_muni']
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
  if v_uf_count is distinct from 30313 then
    raise exception 'sih-v3-schema: sih_metric_uf tem % linhas, esperado 30313', v_uf_count;
  end if;

  select count(*) into v_uf_local_errado from sih_metric_uf where local is distinct from 'ocorrencia';
  if v_uf_local_errado > 0 then
    raise exception 'sih-v3-schema: % linha(s) de sih_metric_uf sem local = ocorrencia', v_uf_local_errado;
  end if;
end $$;
