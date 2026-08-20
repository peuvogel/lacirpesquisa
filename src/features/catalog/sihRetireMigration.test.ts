import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ESPERADO_SIH_DISEASE,
  ESPERADO_SIH_METRIC_UF,
  MIGRATION_TIMESTAMP,
  renderDownMigration,
  renderUpMigration,
  renderVerifySql,
  UP_RELATIVE_PATH,
  DOWN_RELATIVE_PATH,
  VERIFY_RELATIVE_PATH,
} from '../../../scripts/catalog/generateSihRetireMigration.mjs';

const SCHEMA_PATH = resolve(process.cwd(), 'scripts/catalog/schema-v3.json');
const UP_PATH = resolve(process.cwd(), UP_RELATIVE_PATH);
const DOWN_PATH = resolve(process.cwd(), DOWN_RELATIVE_PATH);
const VERIFY_PATH = resolve(process.cwd(), VERIFY_RELATIVE_PATH);

/** As cinco tabelas do schema v3 que precisam sobreviver à aposentadoria de sih_metric_muni. */
const SIH_V3_TABLES = [
  'sih_collection_status',
  'sih_population_total_uf',
  'sih_population_total_muni',
  'sih_population_uf',
  'sih_population_muni',
];

type SchemaV3 = {
  medidas: string[];
  graos: string[];
  locais: string[];
  statuses: string[];
  sexos: string[];
  anoMin: number;
  anoMax: number;
  faixasEtarias: Array<{ id: string; idadeMin: number; idadeMax: number }>;
  reason: string;
};

function loadData(): SchemaV3 {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

function committedText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('sih retire migration generation (D-20 — PIPE-01, PIPE-06, DATA-02)', () => {
  it('regenera o up em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderUpMigration(data)).toBe(committedText(UP_PATH));
  });

  it('regenera o down em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderDownMigration(data)).toBe(committedText(DOWN_PATH));
  });

  it('regenera o verify em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderVerifySql(data)).toBe(committedText(VERIFY_PATH));
  });

  it('rollback e verify nunca ficam sob supabase/migrations/ — supabase db push nunca os aplica por engano', () => {
    expect(UP_PATH).toContain('/supabase/migrations/');
    expect(DOWN_PATH).not.toContain('/supabase/migrations/');
    expect(VERIFY_PATH).not.toContain('/supabase/migrations/');
    expect(UP_RELATIVE_PATH.startsWith('supabase/migrations/')).toBe(true);
    expect(DOWN_RELATIVE_PATH.startsWith('supabase/migrations/')).toBe(false);
    expect(VERIFY_RELATIVE_PATH.startsWith('supabase/migrations/')).toBe(false);
    expect(MIGRATION_TIMESTAMP).toBe('20260806000000');
  });

  it('o up dropa sih_metric_muni e seu indice secundario, nunca sih_metric_uf/sih_disease', () => {
    const upText = renderUpMigration(loadData());
    expect(upText).toContain('drop table sih_metric_muni');
    expect(upText).toContain('drop index if exists sih_metric_muni_disease_uf_ano');
    expect(upText).not.toContain('drop table sih_metric_uf');
    expect(upText).not.toContain('drop table sih_disease');
  });

  it('o up prova, com RAISE EXCEPTION, que sih_disease e sih_metric_uf nao mudaram de contagem (T-09-54)', () => {
    const upText = renderUpMigration(loadData());
    expect(upText.toLowerCase()).toContain('raise exception');
    expect(upText).toContain('is distinct from');
    expect(upText).toContain(`${ESPERADO_SIH_DISEASE}`);
    expect(upText).toContain(`${ESPERADO_SIH_METRIC_UF}`);
  });

  it('o down recria sih_metric_muni com o DDL real (docs/SUPABASE-CATALOG.md) mais o indice, vazia — sem BEGIN/COMMIT', () => {
    const downText = renderDownMigration(loadData());
    expect(downText).toContain('create table sih_metric_muni');
    expect(downText).toContain(
      'constraint sih_metric_muni_pkey primary key (disease_id, municipio_codigo, ano)',
    );
    expect(downText).toContain(
      'constraint sih_metric_muni_disease_id_fkey foreign key (disease_id)',
    );
    expect(downText).toContain('create index sih_metric_muni_disease_uf_ano');
    expect(downText).toContain('enable row level security');
    expect(downText).toContain('sih_metric_muni_select_anon');
    expect(downText).not.toContain('insert into sih_metric_muni');
    expect(downText.toLowerCase()).not.toContain('begin;');
    expect(downText.toLowerCase()).not.toContain('commit;');
  });

  it('o verify afirma ausencia de sih_metric_muni, as contagens finais e as cinco tabelas do schema v3 com RLS', () => {
    const verifyText = renderVerifySql(loadData());
    expect(verifyText.toLowerCase()).toContain('raise exception');
    expect(verifyText).toContain("to_regclass('public.sih_metric_muni')");
    expect(verifyText).toContain(`${ESPERADO_SIH_DISEASE}`);
    expect(verifyText).toContain(`${ESPERADO_SIH_METRIC_UF}`);
    for (const table of SIH_V3_TABLES) {
      expect(verifyText).toContain(`'${table}'`);
    }
    expect(verifyText).not.toContain('sih_metric_muni_disease_uf_ano');
  });

  it('ESPERADO_SIH_METRIC_UF bate com o mesmo numero baked em generateSihSwapVerify.mjs (a mesma tabela, nao tocada por este plano)', async () => {
    const swapVerify = await import('../../../scripts/catalog/generateSihSwapVerify.mjs');
    expect(ESPERADO_SIH_METRIC_UF).toBe(swapVerify.ESPERADO_SIH_METRIC_UF);
  });
});
