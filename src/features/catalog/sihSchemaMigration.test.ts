import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MIGRATION_TIMESTAMP,
  renderDownMigration,
  renderUpMigration,
  renderVerifySql,
  UP_RELATIVE_PATH,
  DOWN_RELATIVE_PATH,
  VERIFY_RELATIVE_PATH,
} from '../../../scripts/catalog/generateSihSchemaMigration.mjs';

const SCHEMA_PATH = resolve(process.cwd(), 'scripts/catalog/schema-v3.json');
const UP_PATH = resolve(process.cwd(), UP_RELATIVE_PATH);
const DOWN_PATH = resolve(process.cwd(), DOWN_RELATIVE_PATH);
const VERIFY_PATH = resolve(process.cwd(), VERIFY_RELATIVE_PATH);

/** As cinco tabelas novas do bloco `<interfaces>` do plano — nunca sih_metric_muni. */
const SIH_V3_NEW_TABLES = [
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

/** Nomes de tabela criados/dropados por statements `create table <nome>` / `drop table <nome>;`. */
function extractCreatedTables(sql: string): string[] {
  return [...sql.matchAll(/^create table (\S+) \(/gm)].map((m) => m[1]);
}

function extractDroppedTables(sql: string): string[] {
  return [...sql.matchAll(/^drop table (\S+);/gm)].map((m) => m[1]);
}

describe('sih v3 schema migration generation (D-13, D-14, D-15, D-24 — PIPE-02, DATA-04, DATA-01, DATA-02)', () => {
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
    expect(MIGRATION_TIMESTAMP).toBe('20260805000000');
  });

  it('o up nao contem ON UPDATE CASCADE, nem dentro nem fora de comentario (case-insensitive)', () => {
    const upText = renderUpMigration(loadData());
    expect(upText.toLowerCase()).not.toContain('on update cascade');
  });

  it('o up nao contem nenhuma policy de insert/update/delete', () => {
    const upText = renderUpMigration(loadData());
    expect(/for (insert|update|delete)/i.test(upText)).toBe(false);
  });

  it('todo valor de medidas, graos, locais e statuses de schema-v3.json aparece literalmente nos check constraints do up', () => {
    const data = loadData();
    const upText = renderUpMigration(data);

    for (const medida of data.medidas) {
      expect(upText).toContain(`'${medida}'`);
    }
    for (const grao of data.graos) {
      expect(upText).toContain(`'${grao}'`);
    }
    for (const local of data.locais) {
      expect(upText).toContain(`'${local}'`);
    }
    for (const status of data.statuses) {
      expect(upText).toContain(`'${status}'`);
    }
    // Se alguem acrescentar uma medida ao JSON sem regenerar, este teste cai: o up
    // commitado nao teria o novo valor, mas a regeracao em memoria (comparada acima) teria.
    expect(data.medidas).toHaveLength(4);
    expect(data.graos).toHaveLength(2);
    expect(data.locais).toHaveLength(2);
    expect(data.statuses).toHaveLength(3);
  });

  it('o up cria as cinco tabelas novas e nenhuma outra', () => {
    const upText = renderUpMigration(loadData());
    const createdTables = extractCreatedTables(upText);

    expect(createdTables).toHaveLength(5);
    expect(new Set(createdTables)).toEqual(new Set(SIH_V3_NEW_TABLES));
    expect(upText).not.toContain('sih_metric_muni');
  });

  it('o down dropa exatamente as mesmas cinco tabelas (simetria)', () => {
    const upText = renderUpMigration(loadData());
    const downText = renderDownMigration(loadData());

    const createdTables = extractCreatedTables(upText);
    const droppedTables = extractDroppedTables(downText);

    expect(droppedTables).toHaveLength(5);
    expect(new Set(droppedTables)).toEqual(new Set(createdTables));
    expect(downText).not.toContain('sih_metric_muni');
  });

  it('o check de proveniencia obrigatoria (SC-6/DATA-04) esta presente no up', () => {
    const upText = renderUpMigration(loadData());
    expect(upText).toContain("status <> 'coletado' or (derived_at is not null and cid_map_version is not null)");
  });

  it('a dimensao local em sih_metric_uf ganha PK nova e o default e removido (nenhum insert futuro cai em ocorrencia por omissao)', () => {
    const upText = renderUpMigration(loadData());
    expect(upText).toContain('add constraint sih_metric_uf_pkey primary key (disease_id, uf_codigo, ano, local)');
    expect(upText).toContain('alter column local drop default');
  });

  it('o verify cita raise exception e consulta pg_policies para provar RLS select-only', () => {
    const verifyText = renderVerifySql(loadData());
    expect(verifyText.toLowerCase()).toContain('raise exception');
    expect(verifyText).toContain('pg_policies');
    for (const table of SIH_V3_NEW_TABLES) {
      expect(verifyText).toContain(`'${table}'`);
    }
  });
});
