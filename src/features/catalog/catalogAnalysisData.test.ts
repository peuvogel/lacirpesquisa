import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCatalogTimeSeriesYears,
  getCatalogVariableById,
  getDefaultCatalogVariableId,
  getMetricByUf,
  getMetricByUfAndYear,
  resolveVariableId,
} from './catalogAnalysisData';

const PACK_ROOT = resolve(process.cwd(), 'public/data/catalog/packs');

function packSpValue(packId: string, year: number, columnKey: string): number {
  const pack = JSON.parse(readFileSync(resolve(PACK_ROOT, `${packId}.json`), 'utf8')) as {
    rows: Array<Record<string, unknown>>;
  };
  const row = pack.rows.find((r) => r.uf === 'SP' && r.ano === year);
  expect(row).toBeTruthy();
  const value = row![columnKey];
  expect(typeof value).toBe('number');
  return value as number;
}

describe('catalogAnalysisData', () => {
  it("resolveVariableId('mock.amputacoes') → sih.amputacao_mmii.internacoes", () => {
    expect(resolveVariableId('mock.amputacoes')).toBe('sih.amputacao_mmii.internacoes');
  });

  it('aliases mock.internacoes and mock.obitos to embolia pack columns', () => {
    expect(resolveVariableId('mock.internacoes')).toBe('sih.embolia_trombose.internacoes');
    expect(resolveVariableId('mock.obitos')).toBe('sih.embolia_trombose.obitos');
  });

  it('does not alias mock.taxa_mortalidade (infantil) to hospital rates', () => {
    expect(resolveVariableId('mock.taxa_mortalidade')).toBe('mock.taxa_mortalidade');
    expect(getCatalogVariableById('mock.taxa_mortalidade')).toBeUndefined();
    expect(Object.keys(getMetricByUf('mock.taxa_mortalidade'))).toHaveLength(0);
  });

  it('getMetricByUfAndYear(embolia internações, 2019) for SP matches pack CSV (not mock weights)', () => {
    const expected = packSpValue(
      'sih.embolia_trombose_uf',
      2019,
      'internacoes_embolia_trombose_arteriais',
    );
    const byUf = getMetricByUfAndYear('sih.embolia_trombose.internacoes', 2019);
    expect(byUf.SP).toBe(expected);
    expect(byUf.SP).toBe(5660);
    // Old didactic UF_WEIGHT formula for mock.internacoes SP ≈ 898000
    expect(byUf.SP).not.toBe(898000);
  });

  it('alias mock.internacoes resolves to the same pack value as catalog id', () => {
    const viaAlias = getMetricByUfAndYear('mock.internacoes', 2019);
    const viaCatalog = getMetricByUfAndYear('sih.embolia_trombose.internacoes', 2019);
    expect(viaAlias.SP).toBe(viaCatalog.SP);
    expect(viaAlias.SP).toBe(5660);
  });

  it('getCatalogTimeSeriesYears for rate/density vars excludes nullYears (e.g. 2023)', () => {
    const years = getCatalogTimeSeriesYears('sih.embolia_trombose.taxa_internacao_100k');
    expect(years).not.toContain(2023);
    expect(years.length).toBeGreaterThan(0);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('getCatalogTimeSeriesYears works for multi-disease packs (numeric cells)', () => {
    const years = getCatalogTimeSeriesYears('sih.avc.internacoes');
    expect(years.length).toBeGreaterThanOrEqual(10);
    expect(years[0]).toBeLessThanOrEqual(2013);
    expect(years[years.length - 1]!).toBeGreaterThanOrEqual(2020);
    const byUf = getMetricByUfAndYear('sih.avc.internacoes', years[0]!);
    expect(Object.keys(byUf).length).toBeGreaterThan(0);
  });

  it('getCatalogTimeSeriesYears for densidade médicos excludes 2022 and 2023', () => {
    const years = getCatalogTimeSeriesYears('cnes.medicos_vasculares_por_100k');
    expect(years).not.toContain(2022);
    expect(years).not.toContain(2023);
  });

  it('unknown id returns empty/undefined safely', () => {
    expect(resolveVariableId('no.such.var')).toBe('no.such.var');
    expect(getCatalogVariableById('no.such.var')).toBeUndefined();
    expect(getMetricByUf('no.such.var')).toEqual({});
    expect(getMetricByUfAndYear('no.such.var', 2019)).toEqual({});
    expect(getCatalogTimeSeriesYears('no.such.var')).toEqual([]);
  });

  it('getMetricByUf defaults to latest non-null year for the variable', () => {
    const years = getCatalogTimeSeriesYears('sih.embolia_trombose.internacoes');
    const latest = years[years.length - 1]!;
    const defaulted = getMetricByUf('sih.embolia_trombose.internacoes');
    const explicit = getMetricByUfAndYear('sih.embolia_trombose.internacoes', latest);
    expect(defaulted.SP).toBe(explicit.SP);
    expect(Number.isFinite(defaulted.SP)).toBe(true);
  });

  it('omits null UF cells instead of coercing to 0', () => {
    // 2022 is a nullYear for embolia internações — metrics should be empty / omit UFs
    const byUf = getMetricByUfAndYear('sih.embolia_trombose.internacoes', 2022);
    for (const value of Object.values(byUf)) {
      expect(value).not.toBe(0);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('default catalog variable is a loadable vascular count', () => {
    const id = getDefaultCatalogVariableId();
    const entry = getCatalogVariableById(id);
    expect(entry?.loadable).toBe(true);
    expect(entry?.variableType).toBe('contagem');
    expect(id).toMatch(/sih\.(amputacao_mmii|embolia_trombose)\./);
  });
});
