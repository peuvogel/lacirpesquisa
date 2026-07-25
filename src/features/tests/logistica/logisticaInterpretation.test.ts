import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './logisticaConfig';
import {
  buildDatasetFromConfirmed,
  runAnalysis,
  toEngineOutput,
} from './logisticaEngine';
import { buildLogisticaInterpretation, paragraphsContainNoHtml } from './logisticaInterpretation';

describe('logisticaInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/logistica-exemplo.txt'),
    'utf8',
  );

  function loadOutput() {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });
    const result = runAnalysis(dataset);
    return toEngineOutput(dataset, result);
  }

  it('mentions OR, CI and p at display precision', () => {
    const output = loadOutput();
    const slope = output.result.coefficients.find((coef) => coef.term !== '(Intercept)');
    const slopeOr = slope
      ? output.result.oddsRatios.find((row) => row.term === slope.term)
      : undefined;
    expect(slope).toBeDefined();
    expect(slopeOr).toBeDefined();

    const paragraphs = buildLogisticaInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).toContain(fmtNumber(slopeOr!.or, 3));
    expect(joined).toContain(fmtNumber(slopeOr!.ci95[0], 3));
    expect(joined).toContain(fmtNumber(slopeOr!.ci95[1], 3));
    expect(joined).toContain(fmtP(slope!.p));
    expect(joined).toMatch(/Odds ratio/i);
  });

  it('mentions rare events caution when minority class is sparse', () => {
    const rows: string[][] = [];
    for (let i = 0; i < 96; i += 1) rows.push(['0', '1']);
    for (let i = 0; i < 4; i += 1) rows.push(['1', '2']);

    const dataset = buildDatasetFromConfirmed({
      headers: ['desfecho_binario', 'dose'],
      rows,
      recognizedColumns: { desfecho_binario: 0, preditor: 1 },
    });
    const output = toEngineOutput(dataset, runAnalysis(dataset));
    const paragraphs = buildLogisticaInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).toMatch(/eventos raros|classe minoritária/i);
  });

  it('returns string[] with no HTML (T-03-08-02)', () => {
    const output = loadOutput();
    const paragraphs = buildLogisticaInterpretation(output, 0.05, 'Teste?');

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('logisticaCharts presets', () => {
  it('includes OR forest preset with or scale', async () => {
    const { buildLogisticaChartPresets, getDefaultLogisticaChartPreset } = await import('./logisticaCharts');
    const presets = buildLogisticaChartPresets();
    expect(presets.some((preset) => preset.id === 'forest')).toBe(true);
    expect(getDefaultLogisticaChartPreset()).toBe('forest');
  });
});
