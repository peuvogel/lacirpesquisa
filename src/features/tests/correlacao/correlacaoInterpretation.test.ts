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
    const question = 'As duas variáveis estão associadas?';

    const legacyHtml = buildPearsonInterpretationHtml(
      { headers: output.headers },
      output.pearson,
      output.spearman,
      minimalPearsonDiagnostics,
      [],
      legacyUtils,
      alpha,
      question,
    );
    const paragraphs = buildCorrelacaoInterpretation(output, alpha, question);

    expect(
      sameSignificanceConclusion(legacyHtml, paragraphs, alpha, output.pearson.p, 'pearson'),
    ).toBe(true);
  });

  it('matches legacy significance conclusion at α=0.05 for Spearman (D-07, D-10)', () => {
    const output = loadOutput('spearman');
    const alpha = 0.05;
    const question = 'As duas variáveis estão associadas?';

    const legacyHtml = buildSpearmanInterpretationHtml(
      { headers: output.headers },
      output.pearson,
      output.spearman,
      minimalSpearmanDiagnostics,
      minimalRankSummary,
      legacyUtils,
      alpha,
      question,
    );
    const paragraphs = buildCorrelacaoInterpretation(output, alpha, question);

    expect(
      sameSignificanceConclusion(legacyHtml, paragraphs, alpha, output.spearman.p, 'spearman'),
    ).toBe(true);
  });

  it('includes key stats at display precision (D-08)', () => {
    const output = loadOutput('pearson');
    const paragraphs = buildCorrelacaoInterpretation(output, 0.05);
    const joined = paragraphs.join(' ');

    expect(joined).toContain(fmtSigned(output.pearson.coef, 3));
    expect(joined).toContain(fmtP(output.pearson.p));
    expect(joined).toContain(String(output.pearson.n));
  });

  it('returns string[] with no HTML tags or entities (T-02-01)', () => {
    const output = loadOutput('pearson');
    const paragraphs = buildCorrelacaoInterpretation(output, 0.05, 'Teste?');

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('correlacaoCharts presets', () => {
  it('exports at least 3 presets matching UI-SPEC labels', async () => {
    const { correlacaoChartPresets } = await import('./correlacaoCharts');
    const { CHART_PRESET_LABELS } = await import('./correlacaoConfig');
    expect(correlacaoChartPresets.length).toBeGreaterThanOrEqual(3);
    const labels = correlacaoChartPresets.map((preset) => preset.label);
    expect(labels).toContain(CHART_PRESET_LABELS.scatter);
    expect(labels).toContain(CHART_PRESET_LABELS.rankScatter);
    expect(labels).toContain(CHART_PRESET_LABELS.scatterWithFit);
  });

  it('regression overlay toggle produces annotation config when enabled', async () => {
    const { correlacaoChartPresets } = await import('./correlacaoCharts');
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
    const preset = correlacaoChartPresets.find((item) => item.id === 'scatter');
    expect(preset).toBeDefined();
    const chart = preset!.buildChart(output);
    const annotations = (chart.options as { plugins?: { annotation?: { annotations?: Record<string, unknown> } } })
      ?.plugins?.annotation?.annotations;
    expect(annotations?.showEquation).toBeDefined();
  });
});
