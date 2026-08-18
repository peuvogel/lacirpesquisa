-- sih-retire.sql
-- Fase 9 Plan 14 (D-20 — PIPE-01, PIPE-06, DATA-02) — gerado por
-- scripts/catalog/generateSihRetireMigration.mjs a partir de scripts/catalog/schema-v3.json.
-- NAO EDITAR A MAO.
--
-- Roda manualmente apos a migracao (supabase db push) -- fica FORA de supabase/migrations/,
-- entao supabase db push nunca aplica isto.
do $$
declare
  tbl text;
  v_muni regclass;
  v_disease bigint;
  v_uf bigint;
  v_rowsecurity boolean;
begin
  -- (1) sih_metric_muni ausente de information_schema.tables (to_regclass devolve null para
  -- objeto inexistente -- forma mais barata que consultar information_schema.tables direto).
  select to_regclass('public.sih_metric_muni') into v_muni;
  if v_muni is not null then
    raise exception 'sih-retire: sih_metric_muni ainda existe (to_regclass = %), esperado null', v_muni;
  end if;

  -- (2) sih_disease com a contagem final da Fase 8 (D-25) -- prova que o DROP nao levou nada
  -- junto por engano via ON DELETE CASCADE em ordem errada.
  select count(*) into v_disease from sih_disease;
  if v_disease is distinct from 331 then
    raise exception 'sih-retire: sih_disease tem % linha(s), esperado 331', v_disease;
  end if;

  -- (3) sih_metric_uf com a contagem final registrada na 09-12 (segunda substituicao de
  -- producao) -- a tabela irma de sih_metric_muni, que este DROP nao deveria tocar.
  select count(*) into v_uf from sih_metric_uf;
  if v_uf is distinct from 207965 then
    raise exception 'sih-retire: sih_metric_uf tem % linha(s), esperado 207965', v_uf;
  end if;

  -- (4) as cinco tabelas do schema v3 (09-03) sobrevivem, todas com RLS ligada -- a
  -- aposentadoria de sih_metric_muni nao pode ter efeito colateral sobre elas.
  foreach tbl in array array['sih_collection_status', 'sih_population_total_uf', 'sih_population_total_muni', 'sih_population_uf', 'sih_population_muni']
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      raise exception 'sih-retire: tabela % nao existe (deveria sobreviver ao DROP de sih_metric_muni)', tbl;
    end if;

    select rowsecurity into v_rowsecurity
    from pg_tables where schemaname = 'public' and tablename = tbl;
    if v_rowsecurity is distinct from true then
      raise exception 'sih-retire: tabela % nao tem row level security habilitada', tbl;
    end if;
  end loop;
end $$;
