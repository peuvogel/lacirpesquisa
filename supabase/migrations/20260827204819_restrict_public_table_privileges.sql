-- Public SIH data is intentionally readable through the Data API, but all writes belong to
-- the offline ingestion pipeline. RLS policies already express that read-only contract; this
-- migration also enforces it at the table privilege boundary.

revoke all privileges on table
  public.sih_disease,
  public.sih_metric_uf,
  public.sih_collection_status,
  public.sih_population_total_uf,
  public.sih_population_total_muni,
  public.sih_population_uf,
  public.sih_population_muni
from anon, authenticated;

grant select on table
  public.sih_disease,
  public.sih_metric_uf,
  public.sih_collection_status,
  public.sih_population_total_uf,
  public.sih_population_total_muni,
  public.sih_population_uf,
  public.sih_population_muni
to anon, authenticated;

-- Migrations create application tables as postgres. Keep future tables from silently
-- inheriting write privileges while retaining the intended Data API read access.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  grant select on tables to anon, authenticated;

-- Abort atomically if the effective contract differs from the intended read-only surface.
do $$
declare
  target_table text;
  client_role text;
  has_nonselect boolean;
  rls_enabled boolean;
begin
  foreach target_table in array array[
    'sih_disease',
    'sih_metric_uf',
    'sih_collection_status',
    'sih_population_total_uf',
    'sih_population_total_muni',
    'sih_population_uf',
    'sih_population_muni'
  ] loop
    if to_regclass(format('public.%I', target_table)) is null then
      raise exception 'restrict_public_table_privileges: public.% does not exist', target_table;
    end if;

    select c.relrowsecurity
      into rls_enabled
      from pg_class c
      where c.oid = to_regclass(format('public.%I', target_table));
    if not rls_enabled then
      raise exception 'restrict_public_table_privileges: RLS is disabled on public.%', target_table;
    end if;

    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = target_table
        and p.cmd = 'SELECT'
        and p.roles @> array['anon', 'authenticated']::name[]
    ) then
      raise exception 'restrict_public_table_privileges: public.% lacks the shared SELECT policy', target_table;
    end if;

    foreach client_role in array array['anon', 'authenticated'] loop
      if not has_table_privilege(client_role, format('public.%I', target_table), 'SELECT') then
        raise exception 'restrict_public_table_privileges: % cannot SELECT public.%', client_role, target_table;
      end if;

      select exists (
        select 1
        from pg_class c
        cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
        where c.oid = to_regclass(format('public.%I', target_table))
          and pg_get_userbyid(acl.grantee) = client_role
          and acl.privilege_type <> 'SELECT'
      ) into has_nonselect;
      if has_nonselect then
        raise exception 'restrict_public_table_privileges: % retains non-SELECT access on public.%', client_role, target_table;
      end if;
    end loop;
  end loop;

  foreach client_role in array array['anon', 'authenticated'] loop
    if not exists (
      select 1
      from pg_default_acl defaults
      cross join lateral aclexplode(defaults.defaclacl) acl
      where defaults.defaclrole = 'postgres'::regrole
        and defaults.defaclnamespace = 'public'::regnamespace
        and defaults.defaclobjtype = 'r'
        and pg_get_userbyid(acl.grantee) = client_role
        and acl.privilege_type = 'SELECT'
    ) then
      raise exception 'restrict_public_table_privileges: postgres defaults do not grant SELECT to %', client_role;
    end if;

    select exists (
      select 1
      from pg_default_acl defaults
      cross join lateral aclexplode(defaults.defaclacl) acl
      where defaults.defaclrole = 'postgres'::regrole
        and defaults.defaclnamespace = 'public'::regnamespace
        and defaults.defaclobjtype = 'r'
        and pg_get_userbyid(acl.grantee) = client_role
        and acl.privilege_type <> 'SELECT'
    ) into has_nonselect;
    if has_nonselect then
      raise exception 'restrict_public_table_privileges: postgres defaults retain non-SELECT access for %', client_role;
    end if;
  end loop;
end $$;
