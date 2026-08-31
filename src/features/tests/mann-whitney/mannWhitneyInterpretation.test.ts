import { describe, expect, it } from 'vitest';
import { readTabularPasteState } from '@/shared/data-input/parseTabular';
import { legacyStats } from '@/shared/data-input/legacyAdapters';
import { buildDatasetFromConfirmed, runAnalysis } from './mannWhitneyEngine';
import { exampleText, TABULAR_OPTIONS } from './mannWhitneyConfig';
import { buildMannWhitneyInterpretation } from './mannWhitneyInterpretation';

describe('mannWhitneyInterpretation', () => {
  it('does not include a research-question paragraph by default', () => {
    const parsed = readTabularPasteState(exampleText, legacyStats, TABULAR_OPTIONS);
    if (parsed.status !== 'loaded') throw new Error('expected loaded paste');

    const dataset = buildDatasetFromConfirmed({
      headers: parsed.headers,
      rows: parsed.bodyRows,
      recognizedColumns: Object.fromEntries(
        Object.entries(parsed.recognizedColumns).map(([key, col]) => [key, col.index]),
      ),
    });
    const result = runAnalysis(dataset);
    const paragraphs = buildMannWhitneyInterpretation(result, 0.05, dataset.labels);

    expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
  });
});
