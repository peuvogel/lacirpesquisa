import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './poissonConfig';
import {
  buildDatasetFromConfirmed,
  runAnalysis,
  toEngineOutput,
} from './poissonEngine';
import { buildPoissonInterpretation, paragraphsContainNoHtml } from './poissonInterpretation';

describe('poissonInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/poisson-exemplo.txt'),
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

  it('mentions slope beta, p and overdispersion ratio at display precision', () => {
    const output = loadOutput();
    const slope = output.result.coefficients.find((coef) => coef.term !== '(Intercept)');
    expect(slope).toBeDefined();

    const paragraphs = buildPoissonInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).toContain(fmtNumber(slope!.beta, 3));
    expect(joined).toContain(fmtP(slope!.p));
    expect(joined).toContain(fmtNumber(output.result.overdispersionRatio, 3));
  });

  it('mentions overdispersion caution when ratio exceeds threshold', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['contagem', 'exposicao'],
      rows: [
        ['2', '1'],
        ['18', '1'],
        ['1', '1'],
        ['22', '1'],
        ['3', '1'],
        ['25', '1'],
        ['0', '1'],
        ['20', '1'],
        ['5', '1'],
        ['28', '1'],
        ['2', '1'],
        ['30', '1'],
      ],
      recognizedColumns: { contagem: 0, preditor: 1 },
    });
    const output = toEngineOutput(dataset, runAnalysis(dataset));
    const paragraphs = buildPoissonInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).toMatch(/superdispersão|Binomial Negativa/i);
  });

  it('returns string[] with no HTML (T-03-06-03)', () => {
    const output = loadOutput();
    const paragraphs = buildPoissonInterpretation(output, 0.05, 'Teste?');

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('poissonCharts presets', () => {
  it('includes forest coefficient preset', async () => {
    const { buildPoissonChartPresets, getDefaultPoissonChartPreset } = await import('./poissonCharts');
    const presets = buildPoissonChartPresets();
    expect(presets.some((preset) => preset.id === 'forest')).toBe(true);
    expect(getDefaultPoissonChartPreset()).toBe('forest');
  });
});
