import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fmtNumber, fmtP } from '@/shared/format';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { TABULAR_OPTIONS } from './quiQuadradoConfig';
import { buildDatasetFromConfirmed, runAnalysis, toEngineOutput } from './quiQuadradoEngine';
import {
  buildQuiQuadradoInterpretation,
  paragraphsContainNoHtml,
} from './quiQuadradoInterpretation';

describe('quiQuadradoInterpretation', () => {
  const exemploText = readFileSync(
    join(__dirname, '../../../test/fixtures/tests/qui-quadrado-exemplo.txt'),
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

  it('is alpha-aware for non-significant fixture at α=0.05', () => {
    const output = loadOutput();
    const paragraphs = buildQuiQuadradoInterpretation(output, 0.05);
    expect(paragraphs[0]).toMatch(/Não se observou associação estatisticamente significativa/i);
  });

  it('includes key stats at display precision', () => {
    const output = loadOutput();
    const joined = buildQuiQuadradoInterpretation(output, 0.05).join(' ');

    expect(joined).not.toContain('Pergunta analisada:');
    expect(joined).toContain(fmtP(output.result.p));
    expect(joined).toContain(fmtNumber(output.result.cramersV, 3));
    expect(joined).toContain(String(output.dataset.totalN));
  });

  it('returns string[] with no HTML (T-03-02-01)', () => {
    const output = loadOutput();
    const paragraphs = buildQuiQuadradoInterpretation(output, 0.05);

    expect(Array.isArray(paragraphs)).toBe(true);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
    expect(paragraphsContainNoHtml(paragraphs)).toBe(true);
  });
});
