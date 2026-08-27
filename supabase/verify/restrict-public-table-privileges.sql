-- Verificacao somente leitura para executar depois da publicacao da migracao.
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
      raise exception 'restrict-public-table-privileges: public.% ausente', target_table;
    end if;

    select c.relrowsecurity
      into rls_enabled
      from pg_class c
      where c.oid = to_regclass(format('public.%I', target_table));
    if not rls_enabled then
      raise exception 'restrict-public-table-privileges: RLS inativa em public.%', target_table;
    end if;

    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = target_table
        and p.cmd = 'SELECT'
        and p.roles @> array['anon', 'authenticated']::name[]
    ) then
      raise exception 'restrict-public-table-privileges: policy SELECT incompleta em public.%', target_table;
    end if;

    foreach client_role in array array['anon', 'authenticated'] loop
      if not has_table_privilege(client_role, format('public.%I', target_table), 'SELECT') then
        raise exception 'restrict-public-table-privileges: % sem SELECT em public.%', client_role, target_table;
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
        raise exception 'restrict-public-table-privileges: % tem acesso alem de SELECT em public.%', client_role, target_table;
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
      raise exception 'restrict-public-table-privileges: default SELECT ausente para %', client_role;
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
      raise exception 'restrict-public-table-privileges: default alem de SELECT para %', client_role;
    end if;
  end loop;
end $$;
