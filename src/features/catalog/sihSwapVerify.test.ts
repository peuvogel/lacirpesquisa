import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CID_MAP_VERSION_DA_CORRIDA,
  ESPERADO_SIH_METRIC_UF,
  renderVerifySql,
  VERIFY_RELATIVE_PATH,
} from '../../../scripts/catalog/generateSihSwapVerify.mjs';

const SCHEMA_PATH = resolve(process.cwd(), 'scripts/catalog/schema-v3.json');
const VERIFY_PATH = resolve(process.cwd(), VERIFY_RELATIVE_PATH);

type SchemaV3 = {
  medidas: string[];
  graos: string[];
  locais: string[];
  statuses: string[];
};

function loadSchema(): SchemaV3 {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

function committedText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('sih swap verify generation (D-16 — a substituição atômica provada por RAISE EXCEPTION)', () => {
  it('regenera o verify em memória e bate byte a byte, string com string, com o arquivo commitado', () => {
    const schema = loadSchema();
    expect(renderVerifySql(schema)).toBe(committedText(VERIFY_PATH));
  });

  it('regenerar duas vezes produz exatamente os mesmos bytes (determinístico, sem Date.now() nem aleatoriedade)', () => {
    const schema = loadSchema();
    expect(renderVerifySql(schema)).toBe(renderVerifySql(schema));
  });

  it('fica fora de supabase/migrations/ — supabase db push nunca aplica isto por engano', () => {
    expect(VERIFY_PATH).not.toContain('/supabase/migrations/');
    expect(VERIFY_RELATIVE_PATH.startsWith('supabase/migrations/')).toBe(false);
    expect(VERIFY_RELATIVE_PATH).toBe('supabase/verify/sih-swap-contagens.sql');
  });

  it('tem ao menos cinco provas com RAISE EXCEPTION (uma por garantia do D-16/D-09/D-15)', () => {
    const verifyText = renderVerifySql(loadSchema());
    const raises = verifyText.match(/raise exception/gi) ?? [];
    expect(raises.length).toBeGreaterThanOrEqual(5);
  });

  it('usa IS DISTINCT FROM na comparação de contagem (NULL-safe, nunca "=")', () => {
    const verifyText = renderVerifySql(loadSchema());
    expect(verifyText).toContain('is distinct from');
  });

  it('os dois valores de local de schema-v3.json aparecem e a prova exige as DUAS presenças (D-09)', () => {
    const schema = loadSchema();
    const verifyText = renderVerifySql(schema);
    expect(schema.locais).toEqual(['ocorrencia', 'residencia']);
    for (const local of schema.locais) {
      expect(verifyText).toContain(`'${local}'`);
    }
    expect(verifyText).toContain("where local = 'ocorrencia'");
    expect(verifyText).toContain("where local = 'residencia'");
  });

  it('prova a ausência de linha remanescente da fonte antiga via sih_collection_status (status coletado + cid_map_version da corrida)', () => {
    const verifyText = renderVerifySql(loadSchema());
    expect(verifyText).toContain('sih_collection_status');
    expect(verifyText).toContain("status = 'coletado'");
    expect(verifyText).toContain('s.cid_map_version =');
  });

  it('prova integridade referencial (disease_id de sih_metric_uf sempre existe em sih_disease)', () => {
    const verifyText = renderVerifySql(loadSchema());
    expect(verifyText).toContain('from sih_disease d where d.id = m.disease_id');
  });

  it('prova que nenhuma linha coletada de sih_collection_status tem derived_at ou cid_map_version nulos (D-15)', () => {
    const verifyText = renderVerifySql(loadSchema());
    expect(verifyText).toContain('derived_at is null or cid_map_version is null');
  });

  it('fecha com a consulta de inspeção manual — agravos de sih_disease sem nenhuma linha em sih_metric_uf', () => {
    const verifyText = renderVerifySql(loadSchema());
    const linhas = verifyText.trimEnd().split('\n');
    // últimas linhas não-vazias são a query de inspeção (sem RAISE EXCEPTION, no espírito de
    // contagens.sql) — prova que ela existe e é a cauda do arquivo, não algo perdido no meio.
    expect(verifyText).toContain('from sih_disease d');
    expect(verifyText).toContain('where d.id not in (select distinct disease_id from sih_metric_uf)');
    expect(linhas.at(-1)).toBe('where d.id not in (select distinct disease_id from sih_metric_uf);');
  });

  it('ESPERADO_SIH_METRIC_UF/CID_MAP_VERSION_DA_CORRIDA nascem null — o verify falha alto por padrão até serem preenchidos com o valor medido na corrida real (D-16, nunca adivinhado)', () => {
    expect(ESPERADO_SIH_METRIC_UF).toBeNull();
    expect(CID_MAP_VERSION_DA_CORRIDA).toBeNull();
    const verifyText = renderVerifySql(loadSchema());
    expect(verifyText).toContain('is distinct from NULL');
  });

  it('aceita parâmetros explícitos de contagem/versão (o caminho que a corrida real usa) sem tocar as constantes default', () => {
    const schema = loadSchema();
    const verifyComMedida = renderVerifySql(schema, {
      esperadoSihMetricUf: 12345,
      cidMapVersaoCorrida: 'abc123',
    });
    expect(verifyComMedida).toContain('is distinct from 12345');
    expect(verifyComMedida).toContain("cid_map_version = 'abc123'");
    // as constantes exportadas (o que fica commitado) continuam null — só o parâmetro explícito
    // desta chamada mudou, provando que renderVerifySql é pura, não depende de estado mutável.
    expect(ESPERADO_SIH_METRIC_UF).toBeNull();
  });
});
