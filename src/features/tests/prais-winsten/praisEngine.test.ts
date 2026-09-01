/**
 * Differential parity: ported praisEngine vs legacy Stats + vm oracle.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import * as portImporter from '@/shared/data-input/datasusImporter';
import * as portNormalizer from '@/shared/data-input/datasusNormalizer';
import { legacyStats, legacyUtils } from '@/shared/data-input/legacyAdapters';
import type { DatasusSource } from '@/shared/data-input/types';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { loadLegacyStatsOracle } from '@/test/legacyStatsOracle';
import { statsEngine } from '@/shared/stats/statsEngine';
import { TABULAR_OPTIONS } from './praisConfig';
import {
  buildDatasetFromConfirmed,
  parseTemporalValue,
  runAnalysis,
  runPraisWinsten,
  validateSeries,
  validateSeriesIssues,
} from './praisEngine';

const legacyStatsOracle = loadLegacyStatsOracle();

const fixtureDir = join(__dirname, '../../../test/fixtures/tests');
const tabnetDir = join(__dirname, '../../../test/fixtures/tabnet');

const pastedSemesters = `Semestre\tN de inscritos
2021.1\t90
2021.2\t92
2022.1\t93
2022.2\t95
2023.1\t95
2023.2\t97
2024.1\t98
2024.2\t100
2025.1\t102
2025.2\t105
2026.1\t108
2026.2\t114`;

function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8');
}

function displayParity(actual: number, expected: number, formatter: (v: number) => string) {
  expect(formatter(actual)).toBe(formatter(expected));
}

function buildTabnetSource(fixtureFile: string): DatasusSource {
  const text = readFixture(tabnetDir, fixtureFile);
  const parsed = portImporter.parseDatasusText({
    text,
    fileName: fixtureFile,
    utils: legacyUtils,
    stats: legacyStats,
  });
  if (!parsed.ok) throw new Error(`Fixture ${fixtureFile} failed to parse`);
  const source: DatasusSource = {
    id: `${fixtureFile}-source`,
    fileName: fixtureFile,
    rawText: text,
    parsed,
    mapping: parsed.initialMapping,
    confirmed: true,
  };
  source.normalized = portNormalizer.normalizeDatasusSource(source, legacyUtils, legacyStats);
  return source;
}

describe('praisEngine differential parity', () => {
  const exemploText = readFixture(fixtureDir, 'prais-exemplo.txt');

  it('builds the user semester paste as twelve regular observations', () => {
    const parsed = readTabularPasteState(pastedSemesters, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, value]) => [key, value.index]),
      ),
      temporalMode: 'auto',
    });
    expect(dataset.validCount).toBe(12);
    expect(dataset.frequencyLabel).toBe('Semestral');
    expect(dataset.time.slice(0, 3)).toEqual([2021, 2021.5, 2022]);
    expect(validateSeriesIssues(dataset).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('runPraisWinsten matches legacy Stats on prais-exemplo fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });

    const portModel = runPraisWinsten(dataset.time, dataset.values);
    const legacyModel = legacyStatsOracle.praisWinsten(dataset.time, dataset.values);

    expect(portModel.n).toBe(legacyModel.n);
    expect(portModel.classification).toBe(legacyModel.classification);
    displayParity(portModel.alpha, legacyModel.alpha, (v) => fmtNumber(v, 6));
    displayParity(portModel.beta, legacyModel.beta, (v) => fmtNumber(v, 6));
    displayParity(portModel.rho, legacyModel.rho, (v) => fmtNumber(v, 4));
    displayParity(portModel.p, legacyModel.p, fmtP);
  });

  it('fitted values match legacy pow(10, alpha+beta*t) formula', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });

    const output = runAnalysis(dataset);
    const legacyModel = legacyStatsOracle.praisWinsten(dataset.time, dataset.values);
    const legacyFitted = dataset.time.map((t) => 10 ** (legacyModel.alpha + legacyModel.beta * t));

    output.fitted.forEach((value, index) => {
      displayParity(value, legacyFitted[index], (v) => fmtNumber(v, 2));
    });
  });

  it('keeps confirmed zero rows and switches to original scale without pseudocount', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: Array.from({ length: 8 }, (_, index) => [String(2017 + index), String(index * 2)]),
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(dataset.values).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(dataset.orderedRows[0]).toMatchObject({ yRaw: '0', yValue: 0 });
    const output = runAnalysis(dataset);
    expect(output.model.scale).toBe('original');
    expect(output.model.apc).toBeNaN();
    expect(output.model.beta).toBeCloseTo(2, 8);
    expect(output.fitted[0]).toBeCloseTo(0, 8);
    expect(output.residuals.every(Number.isFinite)).toBe(true);
  });

  it('uses log scale and APC only for a strictly positive series', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: Array.from({ length: 8 }, (_, index) => [String(2017 + index), String(100 * 1.1 ** index)]),
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });
    const output = runAnalysis(dataset);

    expect(output.model.scale).toBe('log');
    expect(output.model.apc).toBeCloseTo(10, 8);
  });

  it('rejects internal temporal gaps instead of connecting them', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2017', '1'], ['2018', '2'], ['2020', '3'], ['2021', '4']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(validateSeries(dataset)).toContainEqual(expect.stringMatching(/intervalos regulares|lacuna/i));
  });

  it('does not run Prais-Winsten when dataset issues block analysis', () => {
    const calculation = vi.spyOn(statsEngine, 'praisWinsten');
    const blockedDatasets = [
      buildDatasetFromConfirmed({
        headers: ['Ano', 'Valor'],
        rows: [['2021', '1'], ['2022', '2'], ['2024', '4']],
        recognizedColumns: { tempo: 0, variavel_y: 1 },
      }),
      buildDatasetFromConfirmed({
        headers: ['Ano', 'Valor'],
        rows: [['2021', '1'], ['2022', '2'], ['2022', '3'], ['2023', '4']],
        recognizedColumns: { tempo: 0, variavel_y: 1 },
      }),
      buildDatasetFromConfirmed({
        headers: ['Ano', 'Valor'],
        rows: [['2021', '1'], ['2022', 'inválido'], ['2023', '3'], ['2024', '4']],
        recognizedColumns: { tempo: 0, variavel_y: 1 },
      }),
    ];

    blockedDatasets.forEach((dataset) => expect(() => runAnalysis(dataset)).toThrow());
    expect(calculation).not.toHaveBeenCalled();
    calculation.mockRestore();
  });

  it('reports an invalid outcome and preserves the gap created by excluding its period', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2021', '1'], ['2022', 'inválido'], ['2023', '3'], ['2024', '4']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(dataset.validCount).toBe(3);
    expect(dataset.orderedRows.map((row) => row.timePeriodIndex)).toEqual([2021, 2023, 2024]);
    expect(validateSeriesIssues(dataset)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_outcome', severity: 'error', rowNumbers: [2] }),
      expect.objectContaining({ code: 'missing_period', severity: 'error', rowNumbers: [1, 3] }),
    ]));
  });

  it('reconciles temporal gaps against rows retained after an invalid outcome', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2021', '1'], ['2022', 'inválido'], ['2024', '4'], ['2025', '5']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    const issues = validateSeriesIssues(dataset);
    expect(issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'temporal_missing_period' }),
    ]));
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_period', rowNumbers: [1, 3] }),
    ]));
  });

  it('reports every effective gap and preserves matching temporal details', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [
        ['2021', '1'],
        ['2022', 'inválido'],
        ['2023', '3'],
        ['2025', '5'],
        ['2026', '6'],
        ['2028', '8'],
      ],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    const gaps = validateSeriesIssues(dataset).filter((issue) => issue.code === 'missing_period');
    expect(gaps).toEqual([
      {
        code: 'missing_period',
        severity: 'error',
        message: 'A série possui lacuna temporal ou intervalos irregulares. Complete os períodos antes de analisar.',
        rowNumbers: [1, 3],
      },
      {
        code: 'missing_period',
        severity: 'error',
        message: 'Período ausente: 2024.',
        rowNumbers: [3, 4],
        hint: 'Corrija os períodos ou escolha explicitamente a periodicidade antes de analisar.',
      },
      {
        code: 'missing_period',
        severity: 'error',
        message: 'Período ausente: 2027.',
        rowNumbers: [5, 6],
        hint: 'Corrija os períodos ou escolha explicitamente a periodicidade antes de analisar.',
      },
    ]);
  });

  it('does not retain a duplicate-period issue when the duplicate outcome is excluded', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2021', '1'], ['2022', '2'], ['2022', 'inválido'], ['2023', '3']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    const issues = validateSeriesIssues(dataset);
    expect(issues).not.toContainEqual(expect.objectContaining({ code: 'temporal_duplicate_period' }));
    expect(issues).not.toContainEqual(expect.objectContaining({ code: 'duplicate_period' }));
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_outcome', rowNumbers: [3] }),
    ]));
  });

  it('rejects negative indicators instead of silently dropping them', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [['2017', '1'], ['2018', '-2'], ['2019', '3'], ['2020', '4']],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(validateSeries(dataset)).toContainEqual(expect.stringMatching(/negativo/i));
  });

  it('parseTemporalValue handles year-month tokens and numeric years', () => {
    const year = parseTemporalValue('2015');
    expect(year.numeric).toBe(2015);
    expect(['year', 'integer']).toContain(year.timeType);

    const ym = parseTemporalValue('2015-03');
    expect(ym.numeric).toBeCloseTo(2015 + 2 / 12, 6);
    expect(ym.timeType).toBe('year-month');
  });

  it('validateSeries returns UI-SPEC error for fewer than 3 valid points', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: [
        ['2015', '10'],
        ['2016', '12'],
      ],
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });

    expect(validateSeries(dataset)).toContain(
      'A série temporal precisa de pelo menos 3 pontos válidos.',
    );
  });

  it('TABNET derive path produces analyzable series', () => {
    const source = buildTabnetSource('prais-derive.txt');
    const categories = portNormalizer.getCategoryOptions(source, false);
    expect(categories.length).toBeGreaterThan(0);

    const categoryKey =
      categories.find((option) => /nacional/i.test(option.label))?.key ?? categories[0]?.key ?? '';

    const derived = portNormalizer.derivePraisSeries({
      source,
      categoryKey,
      includeTotal: false,
      stats: legacyStats,
    });
    expect(derived.ok, derived.errors.join('; ')).toBe(true);
    expect(derived.rows.length).toBeGreaterThanOrEqual(3);

    const headers = ['tempo', derived.metricLabel || 'valor'];
    const rows = derived.rows.map((row) => [row.timeLabel, String(row.value)]);
    const dataset = buildDatasetFromConfirmed({
      headers,
      rows,
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });
    expect(dataset.validCount).toBeGreaterThanOrEqual(3);

    const output = runAnalysis(dataset);
    const legacyModel = legacyStatsOracle.praisWinsten(dataset.time, dataset.values);
    displayParity(output.model.p, legacyModel.p, fmtP);
    displayParity(output.model.beta, legacyModel.beta, (v) => fmtNumber(v, 6));
  });
});
