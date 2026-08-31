import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { buildLegacyPraisInterpretation } from '@/test/praisModuleOracle';
import { TABULAR_OPTIONS } from './praisConfig';
import { buildDatasetFromConfirmed, runAnalysis } from './praisEngine';
import {
  buildPraisInterpretation,
  legacyDatasetFromBuilt,
  paragraphsContainNoHtml,
  sameTrendConclusion,
} from './praisInterpretation';

describe('praisInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/prais-exemplo.txt'),
    'utf8',
  );

  it('matches legacy trend/significance conclusion at α=0.05 on exemplo fixture', () => {
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

    const output = runAnalysis(dataset);
    const alpha = 0.05;

    const legacyParagraph = buildLegacyPraisInterpretation(
      output.model,
      legacyDatasetFromBuilt(dataset),
      'O indicador mudou ao longo do tempo?',
      String(alpha),
    );
    const paragraphs = buildPraisInterpretation(output, alpha);

    expect(
      sameTrendConclusion(
        legacyParagraph,
        paragraphs,
        alpha,
        output.model.p,
        output.model.classification,
      ),
    ).toBe(true);
  });

  it('includes beta, rho, and p at display precision (D-08)', () => {
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
    const paragraphs = buildPraisInterpretation(output, 0.05);

    const joined = paragraphs.join(' ');
    expect(joined).not.toContain('Pergunta analisada:');
    expect(joined).toContain(fmtP(output.model.p));
    expect(joined).toContain(fmtSigned(output.model.beta, 4));
    expect(joined).toContain(fmtSigned(output.model.rho, 3));
    expect(joined).toContain(fmtSigned(output.model.apc, 2));
    expect(joined).toContain(fmtNumber(output.model.ciApc[0], 2));
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
    });
    const output = runAnalysis(dataset);
    const paragraphs = buildPraisInterpretation(output, 0.05);

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });

  it('explains zero-series results as absolute change and never as APC', () => {
    const dataset = buildDatasetFromConfirmed({
      headers: ['Ano', 'Valor'],
      rows: Array.from({ length: 8 }, (_, index) => [String(2017 + index), String(index * 2)]),
      recognizedColumns: { tempo: 0, variavel_y: 1 },
    });
    const output = runAnalysis(dataset);
    const joined = buildPraisInterpretation(output, 0.05).join(' ');

    expect(joined).not.toContain('Pergunta analisada:');
    expect(joined).toMatch(/sem pseudocontagem/i);
    expect(joined).toMatch(/mudança absoluta/i);
    expect(joined).not.toMatch(/Resultado principal: APC/i);
  });
});

describe('SeriesPreviewTable truncation copy', () => {
  it('uses UI-SPEC PT message for rows beyond max preview', async () => {
    const { render, screen } = await import('@testing-library/react');
    const React = await import('react');
    const { SeriesPreviewTable } = await import('./SeriesPreviewTable');

    const rows = Array.from({ length: 10 }, (_, index) => ({
      index: index + 1,
      idLabel: `Linha ${index + 1}`,
      timeRaw: String(2010 + index),
      timeLabel: String(2010 + index),
      timeValue: 2010 + index,
      timeSortKey: `year:${2010 + index}`,
      yRaw: String(100 + index),
      yValue: 100 + index,
    }));

    render(
      React.createElement(SeriesPreviewTable, {
        rows,
        timeHeaderLabel: 'Ano',
        yHeaderLabel: 'Valor',
        maxPreviewRows: 8,
      }),
    );

    expect(screen.getByText('… e mais 2 linhas')).toBeInTheDocument();
  });
});

describe('praisCharts presets', () => {
  it('exports trend and residual chart presets', async () => {
    const { praisTrendPresets, praisResidualPresets } = await import('./praisCharts');
    const { CHART_PRESET_LABELS } = await import('./praisConfig');

    expect(praisTrendPresets.length).toBeGreaterThanOrEqual(1);
    expect(praisResidualPresets.length).toBeGreaterThanOrEqual(1);
    expect(praisTrendPresets.map((preset) => preset.label)).toContain(CHART_PRESET_LABELS.trend);
    expect(praisResidualPresets.map((preset) => preset.label)).toContain(CHART_PRESET_LABELS.residual);
  });
});
