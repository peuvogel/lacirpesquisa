import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260827204819_restrict_public_table_privileges.sql',
);
const VERIFY_PATH = resolve(
  process.cwd(),
  'supabase/verify/restrict-public-table-privileges.sql',
);

const PUBLIC_READ_TABLES = [
  'sih_disease',
  'sih_metric_uf',
  'sih_collection_status',
  'sih_population_total_uf',
  'sih_population_total_muni',
  'sih_population_uf',
  'sih_population_muni',
] as const;

function migrationSql() {
  return readFileSync(MIGRATION_PATH, 'utf8').toLowerCase();
}

describe('public SIH table privileges migration', () => {
  it('restricts exactly the seven public read tables and restores SELECT for clients', () => {
    const sql = migrationSql();

    expect(sql).toContain('revoke all privileges on table');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('grant select on table');
    expect(sql).toContain('to anon, authenticated');
    for (const table of PUBLIC_READ_TABLES) {
      expect(sql).toContain(`public.${table}`);
    }
  });

  it('makes future public tables opt-in without changing service-role or pipeline grants', () => {
    const sql = migrationSql();

    expect(sql).toContain(
      'alter default privileges for role postgres in schema public\n  revoke all privileges on tables from public, anon, authenticated',
    );
    expect(sql).not.toMatch(/alter default privileges[^;]+grant\s+select/is);
    expect(sql).not.toMatch(/(?:revoke|grant)[^;]+(?:service_role|pipeline)/);
  });

  it('checks effective inherited privileges in addition to RLS and SELECT policies', () => {
    const sql = migrationSql();

    expect(sql).toContain('relrowsecurity');
    expect(sql).toContain('pg_policies');
    expect(sql).toContain('has_table_privilege');
    expect(sql).toContain('foreach forbidden_privilege');
    expect(sql).toContain("'insert', 'update', 'delete', 'truncate', 'references', 'trigger', 'maintain'");
    expect(sql).toContain('raise exception');
    expect(sql).not.toContain('disable row level security');
  });

  it('ships a read-only post-deploy verifier outside the migration chain', () => {
    const verify = readFileSync(VERIFY_PATH, 'utf8').toLowerCase();

    expect(VERIFY_PATH).not.toContain('/supabase/migrations/');
    expect(verify).toContain('has_table_privilege');
    expect(verify).toContain('pg_policies');
    expect(verify).toContain('raise exception');
    expect(verify).not.toMatch(
      /^\s*(?:grant|revoke|alter|create|drop|insert|update|delete|truncate)\b/im,
    );
  });
});
