import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './kruskalConfig';
import { buildDatasetFromConfirmed, runAnalysis } from './kruskalEngine';
import { buildKruskalInterpretation, paragraphsContainNoHtml } from './kruskalInterpretation';

describe('kruskalInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/kruskal-dunn-exemplo.txt'),
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

  it('mentions omnibus H, df and p at display precision', () => {
    const { dataset, result } = loadResult();
    const paragraphs = buildKruskalInterpretation(
      result,
      0.05,
      dataset.headers,
      dataset.groupOrder.length,
    );
    const joined = paragraphs.join(' ');

    expect(joined).toContain(fmtNumber(result.h, 3));
    expect(joined).toContain(fmtP(result.p));
    expect(joined).toContain(String(result.df));
  });

  it('mentions Dunn post-hoc when omnibus is significant', () => {
    const { dataset, result } = loadResult();
    const paragraphs = buildKruskalInterpretation(
      result,
      0.05,
      dataset.headers,
      dataset.groupOrder.length,
    );
    const joined = paragraphs.join(' ');

    if (result.p < 0.05) {
      expect(joined).toMatch(/Dunn|par a par/i);
    }
  });

  it('returns string[] with no HTML (T-03-04-01)', () => {
    const { dataset, result } = loadResult();
    const paragraphs = buildKruskalInterpretation(
      result,
      0.05,
      dataset.headers,
      dataset.groupOrder.length,
      'Teste?',
    );

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('kruskalCharts presets', () => {
  it('includes heatmap preset when k ≤ 6', async () => {
    const { buildKruskalChartPresetsForOutput } = await import('./kruskalCharts');
    const { toEngineOutput, buildDatasetFromConfirmed } = await import('./kruskalEngine');
    const exemploText = readFileSync(
      join(__dirname, '../../../test/fixtures/tests/kruskal-dunn-exemplo.txt'),
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
    const presets = buildKruskalChartPresetsForOutput(output);

    expect(presets.some((preset) => preset.id === 'heatmap')).toBe(true);
    expect(presets.some((preset) => preset.id === 'raw-data')).toBe(true);
    expect(presets.find((preset) => preset.id === 'raw-data')?.buildChart(output).type).toBe(
      'scatter',
    );
    const { getDefaultKruskalChartPreset } = await import('./kruskalCharts');
    expect(getDefaultKruskalChartPreset()).toBe('raw-data');
  });

  it('omits heatmap preset when k > 6', async () => {
    const { buildKruskalChartPresets } = await import('./kruskalCharts');
    const presets = buildKruskalChartPresets(7);
    expect(presets.some((preset) => preset.id === 'heatmap')).toBe(false);
    expect(presets.some((preset) => preset.id === 'medians')).toBe(true);
    expect(presets.some((preset) => preset.id === 'raw-data')).toBe(true);
  });

  it('renders medians with IQR geometry and never labels IQR as a confidence interval', async () => {
    const { buildKruskalChartPresetsForOutput } = await import('./kruskalCharts');
    const { toEngineOutput, buildDatasetFromConfirmed } = await import('./kruskalEngine');
    const { KRUSKAL_ANNOTATIONS } = await import('./kruskalConfig');
    const fixture = readFileSync(
      join(__dirname, '../../../test/fixtures/tests/kruskal-dunn-exemplo.txt'),
      'utf8',
    );
    const parsed = readTabularPasteState(fixture, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });
    const output = toEngineOutput(dataset, runAnalysis(dataset));
    const preset = buildKruskalChartPresetsForOutput(output).find((item) => item.id === 'medians')!;
    const chart = preset.buildChart(output);
    const annotations = (chart.options?.plugins?.annotation as {
      annotations?: Record<string, Record<string, unknown>>;
    })?.annotations ?? {};

    expect(chart.type).toBe('scatter');
    expect(annotations.showIqr_0_line).toMatchObject({ yMin: 11.8, yMax: 13.5 });
    expect(KRUSKAL_ANNOTATIONS.map((item) => item.label).join(' ')).not.toMatch(/confiança/i);
    expect(KRUSKAL_ANNOTATIONS.map((item) => item.label).join(' ')).toMatch(/interquartil|IQR/i);
  });
});
