import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { loadCorrelacaoModuleOracle } from '@/test/correlacaoModuleOracle';
import { TABULAR_OPTIONS } from './correlacaoConfig';
import { buildDatasetFromConfirmed, toEngineOutput } from './correlacaoEngine';
import {
  buildCorrelacaoInterpretation,
  paragraphsContainNoHtml,
  sameSignificanceConclusion,
} from './correlacaoInterpretation';

const {
  buildPearsonInterpretationHtml,
  buildSpearmanInterpretationHtml,
} = loadCorrelacaoModuleOracle();

const legacyUtils = {
  fmtNumber,
  fmtP,
  fmtSigned,
  escapeHtml: (value: string) => String(value ?? ''),
};

const minimalPearsonDiagnostics = { adequacyTone: 'good', curvatureGain: 0, mae: 0.5 };
const minimalSpearmanDiagnostics = { monotonicConsistency: 0.8 };
const minimalRankSummary = { xTies: { groups: 0 }, yTies: { groups: 0 } };

describe('correlacaoInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/correlacao-exemplo.txt'),
    'utf8',
  );

  function loadOutput(method: 'pearson' | 'spearman') {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');
    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      method,
    });
    return toEngineOutput(dataset, method);
  }

  it('matches legacy significance conclusion at α=0.05 for Pearson (D-07, D-10)', () => {
    const output = loadOutput('pearson');
    const alpha = 0.05;

    const legacyHtml = buildPearsonInterpretationHtml(
      { headers: output.headers },
      output.pearson,
      output.spearman,
      minimalPearsonDiagnostics,
      [],
      legacyUtils,
      alpha,
      '',
    );
    const paragraphs = buildCorrelacaoInterpretation(output, alpha);

    expect(
      sameSignificanceConclusion(legacyHtml, paragraphs, alpha, output.pearson.p, 'pearson'),
    ).toBe(true);
    expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
  });

  it('matches legacy significance conclusion at α=0.05 for Spearman (D-07, D-10)', () => {
    const output = loadOutput('spearman');
    const alpha = 0.05;

    const legacyHtml = buildSpearmanInterpretationHtml(
      { headers: output.headers },
      output.pearson,
      output.spearman,
      minimalSpearmanDiagnostics,
      minimalRankSummary,
      legacyUtils,
      alpha,
      '',
    );
    const paragraphs = buildCorrelacaoInterpretation(output, alpha);

    expect(
      sameSignificanceConclusion(legacyHtml, paragraphs, alpha, output.spearman.p, 'spearman'),
    ).toBe(true);
    expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
  });

  it('includes key stats at display precision (D-08)', () => {
    const output = loadOutput('pearson');
    const paragraphs = buildCorrelacaoInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).not.toContain('Pergunta analisada:');
    expect(joined).toContain(fmtSigned(output.pearson.coef, 3));
    expect(joined).toContain(fmtP(output.pearson.p));
    expect(joined).toContain(String(output.pearson.n));
  });

  it('returns string[] with no HTML tags or entities (T-02-01)', () => {
    const output = loadOutput('pearson');
    const paragraphs = buildCorrelacaoInterpretation(output, 0.05);

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('correlacaoCharts presets', () => {
  it('exposes method-aware galleries for Pearson and Spearman', async () => {
    const { buildCorrelacaoChartPresets } = await import('./correlacaoCharts');
    const { CHART_PRESET_LABELS } = await import('./correlacaoConfig');

    const pearson = buildCorrelacaoChartPresets('pearson');
    const spearman = buildCorrelacaoChartPresets('spearman');

    expect(pearson.map((preset) => preset.id)).toEqual(['scatter', 'scatter-with-fit']);
    expect(spearman.map((preset) => preset.id)).toEqual(['rank-scatter', 'scatter']);
    expect(pearson.map((preset) => preset.label)).toContain(CHART_PRESET_LABELS.scatterWithFit);
    expect(spearman.map((preset) => preset.label)).toContain(CHART_PRESET_LABELS.rankScatter);
  });

  it('keeps the plain scatter a bare cloud and the fit preset the one with the line', async () => {
    const { buildCorrelacaoChartPresets } = await import('./correlacaoCharts');
    const { buildDatasetFromConfirmed, toEngineOutput } = await import('./correlacaoEngine');
    const exemploText = readFileSync(
      join(__dirname, '../../../test/fixtures/tests/correlacao-exemplo.txt'),
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
      method: 'pearson',
    });
    const output = toEngineOutput(dataset, 'pearson');
    const presets = buildCorrelacaoChartPresets('pearson');
    const scatter = presets.find((item) => item.id === 'scatter');
    const withFit = presets.find((item) => item.id === 'scatter-with-fit');
    expect(scatter).toBeDefined();
    expect(withFit).toBeDefined();

    type BuiltChart = ReturnType<(typeof presets)[number]['buildChart']>;
    const readAnnotations = (chart: BuiltChart) =>
      (chart.options as { plugins?: { annotation?: { annotations?: Record<string, unknown> } } })
        ?.plugins?.annotation?.annotations;
    const hasFitLine = (chart: BuiltChart) =>
      chart.data.datasets.some((dataset) => String(dataset.label).includes('regressão'));

    // "Dispersão" é só a nuvem: com a reta aqui, os dois tipos de gráfico
    // saíam idênticos no Pearson.
    const bare = scatter!.buildChart(output);
    expect(hasFitLine(bare)).toBe(false);
    expect(scatter!.capabilities?.some((capability) => capability.id === 'showRegressionLine')).toBeFalsy();
    // O coeficiente continua anotado, sem a equação da reta.
    const bareContent = String((readAnnotations(bare)?.showEquation as { content?: string })?.content);
    expect(bareContent).toContain('r =');
    expect(bareContent).not.toContain('×');

    const fitted = withFit!.buildChart(output);
    expect(hasFitLine(fitted)).toBe(true);
    expect(String((readAnnotations(fitted)?.showEquation as { content?: string[] })?.content)).toContain('×');
  });

  it('Spearman rank chart uses tied ranks and does not draw an OLS line', async () => {
    const { buildCorrelacaoChartPresets } = await import('./correlacaoCharts');
    const { toEngineOutput } = await import('./correlacaoEngine');
    const output = toEngineOutput(
      {
        x: [1, 2, 2, 4, 5],
        y: [5, 4, 4, 2, 1],
        labels: ['a', 'b', 'c', 'd', 'e'],
        headers: ['X', 'Y'],
        method: 'spearman',
      },
      'spearman',
    );
    const rankPreset = buildCorrelacaoChartPresets('spearman').find((item) => item.id === 'rank-scatter');
    expect(rankPreset).toBeDefined();
    const chart = rankPreset!.buildChart(output);
    expect(chart.data.datasets.some((dataset) => String(dataset.label).includes('regressão'))).toBe(
      false,
    );
    const annotations = (chart.options as { plugins?: { annotation?: { annotations?: Record<string, unknown> } } })
      ?.plugins?.annotation?.annotations;
    const content = (annotations?.showEquation as { content?: string } | undefined)?.content;
    expect(String(content)).toContain('ρ');
  });
});
