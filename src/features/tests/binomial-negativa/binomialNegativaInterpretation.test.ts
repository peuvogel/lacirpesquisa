import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './binomialNegativaConfig';
import {
  buildDatasetFromConfirmed,
  runAnalysis,
  toEngineOutput,
} from './binomialNegativaEngine';
import {
  buildBinomialNegativaInterpretation,
  paragraphsContainNoHtml,
} from './binomialNegativaInterpretation';

describe('binomialNegativaInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/binomial-negativa-exemplo.txt'),
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

  it('mentions slope beta, p and theta at display precision', () => {
    const output = loadOutput();
    const slope = output.result.coefficients.find((coef) => coef.term !== '(Intercept)');
    expect(slope).toBeDefined();

    const paragraphs = buildBinomialNegativaInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).not.toContain('Pergunta analisada:');
    expect(joined).toContain(fmtNumber(slope!.beta, 3));
    expect(joined).toContain(fmtP(slope!.p));
    expect(joined).toContain(fmtNumber(output.result.theta, 3));
    expect(joined).toMatch(/equidispers/i);
  });

  it('returns string[] with no HTML (T-03-07-03)', () => {
    const output = loadOutput();
    const paragraphs = buildBinomialNegativaInterpretation(output, 0.05);

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('binomialNegativaCharts presets', () => {
  it('includes forest coefficient preset', async () => {
    const { buildBinomialNegativaChartPresets, getDefaultBinomialNegativaChartPreset } =
      await import('./binomialNegativaCharts');
    const presets = buildBinomialNegativaChartPresets();
    expect(presets.some((preset) => preset.id === 'forest')).toBe(true);
    expect(getDefaultBinomialNegativaChartPreset()).toBe('forest');
  });
});
