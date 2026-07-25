import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { loadLegacyStatsOracle } from '@/test/legacyStatsOracle';
import { loadTStudentModuleOracle } from '@/test/tStudentModuleOracle';
import { TABULAR_OPTIONS } from './tStudentConfig';
import {
  buildDatasetFromConfirmed,
  runIndependentWelch,
} from './tStudentEngine';
import {
  buildTStudentInterpretation,
  paragraphsContainNoHtml,
  sameSignificanceConclusion,
} from './tStudentInterpretation';

const legacyStatsOracle = loadLegacyStatsOracle();
const { buildManualInterpretation, safeWelch } = loadTStudentModuleOracle();

const legacyUtils = {
  fmtNumber,
  fmtP,
  fmtSigned,
  escapeHtml: (value: string) => String(value ?? ''),
  buildInterpretationCard: (title: string, paragraph: string, bullets: string[] = []) =>
    `<div class="interpretation-card"><h4>${title}</h4><p>${paragraph}</p>${
      bullets.length ? `<ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''
    }</div>`,
};

describe('tStudentInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/t-student-exemplo.txt'),
    'utf8',
  );

  it('matches legacy significance conclusion at α=0.05 on exemplo fixture', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    expect(parsed.status).toBe('loaded');
    if (parsed.status !== 'loaded') return;

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      mode: 'independent',
    });

    const result = runIndependentWelch(dataset.g1, dataset.g2);
    const alpha = 0.05;
    const labels = dataset.labels;
    const question = 'As médias dos dois grupos são diferentes?';

    const legacyHtml = buildManualInterpretation(
      safeWelch(dataset.g1, dataset.g2, legacyStatsOracle),
      alpha,
      labels,
      question,
      legacyUtils,
    );
    const paragraphs = buildTStudentInterpretation(result, alpha, labels, question);

    expect(sameSignificanceConclusion(legacyHtml, paragraphs, alpha, result.p)).toBe(true);
  });

  it('includes key stats at display precision (D-08)', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      mode: 'independent',
    });
    const result = runIndependentWelch(dataset.g1, dataset.g2);
    const paragraphs = buildTStudentInterpretation(result, 0.05, dataset.labels);

    const joined = paragraphs.join(' ');
    expect(joined).toContain(fmtP(result.p));
    expect(joined).toContain(fmtNumber(result.t, 3));
    expect(joined).toContain(fmtSigned(result.diff, 2));
    expect(joined).toContain(fmtNumber(result.ci[0], 2));
    expect(joined).toContain(fmtNumber(result.ci[1], 2));
  });

  it('returns string[] with no HTML tags or entities', () => {
    const parsed = readTabularPasteState(exemploText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
      mode: 'independent',
    });
    const result = runIndependentWelch(dataset.g1, dataset.g2);
    const paragraphs = buildTStudentInterpretation(result, 0.05, dataset.labels, 'Teste?');

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});

describe('tStudentCharts presets', () => {
  it('exports at least 3 presets matching UI-SPEC labels', async () => {
    const { tStudentChartPresets } = await import('./tStudentCharts');
    const { CHART_PRESET_LABELS } = await import('./tStudentConfig');
    expect(tStudentChartPresets.length).toBeGreaterThanOrEqual(3);
    const labels = tStudentChartPresets.map((preset) => preset.label);
    expect(labels).toContain(CHART_PRESET_LABELS.diff);
    expect(labels).toContain(CHART_PRESET_LABELS.distribution);
    expect(labels).toContain(CHART_PRESET_LABELS.meansBar);
  });
});
