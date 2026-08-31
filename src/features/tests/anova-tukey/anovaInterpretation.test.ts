import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './anovaConfig';
import { buildDatasetFromConfirmed, runAnalysis } from './anovaEngine';
import { buildAnovaInterpretation, paragraphsContainNoHtml } from './anovaInterpretation';

describe('anovaInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/anova-tukey-exemplo.txt'),
    'utf8',
  );

  function loadResult() {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });
    return { dataset, result: runAnalysis(dataset) };
  }

  it('mentions omnibus F, p and η² at display precision', () => {
    const { dataset, result } = loadResult();
    const paragraphs = buildAnovaInterpretation(result, 0.05, dataset.headers, dataset.groupOrder.length);
    const joined = paragraphs.join(' ');

    expect(joined).not.toContain('Pergunta analisada:');
    expect(joined).toContain(fmtNumber(result.f, 3));
    expect(joined).toContain(fmtP(result.p));
    expect(joined).toContain(fmtNumber(result.eta2, 3));
  });

  it('mentions Tukey post-hoc when omnibus is significant', () => {
    const { dataset, result } = loadResult();
    const paragraphs = buildAnovaInterpretation(result, 0.05, dataset.headers, dataset.groupOrder.length);
    const joined = paragraphs.join(' ');

    expect(joined).not.toContain('Pergunta analisada:');
    if (result.p < 0.05) {
      expect(joined).toMatch(/Tukey|par a par/i);
    }
  });

  it('returns string[] with no HTML (T-03-03-01)', () => {
    const { dataset, result } = loadResult();
    const paragraphs = buildAnovaInterpretation(result, 0.05, dataset.headers, dataset.groupOrder.length);

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('anovaCharts presets', () => {
  it('includes heatmap preset when k ≤ 6', async () => {
    const { buildAnovaChartPresetsForOutput } = await import('./anovaCharts');
    const { toEngineOutput, buildDatasetFromConfirmed } = await import('./anovaEngine');
    const exemploText = readFileSync(
      join(__dirname, '../../../test/fixtures/tests/anova-tukey-exemplo.txt'),
      'utf8',
    );
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });
    const output = toEngineOutput(dataset, runAnalysis(dataset));
    const presets = buildAnovaChartPresetsForOutput(output);

    expect(presets.some((preset) => preset.id === 'heatmap')).toBe(true);
    expect(presets.some((preset) => preset.id === 'raw-data')).toBe(true);
    expect(presets.find((preset) => preset.id === 'raw-data')?.buildChart(output).type).toBe(
      'scatter',
    );
    const { getDefaultAnovaChartPreset } = await import('./anovaCharts');
    expect(getDefaultAnovaChartPreset()).toBe('raw-data');
  });

  it('omits heatmap preset when k > 6', async () => {
    const { buildAnovaChartPresets } = await import('./anovaCharts');
    const presets = buildAnovaChartPresets(7);
    expect(presets.some((preset) => preset.id === 'heatmap')).toBe(false);
    expect(presets.some((preset) => preset.id === 'means')).toBe(true);
    expect(presets.some((preset) => preset.id === 'raw-data')).toBe(true);
  });
});
