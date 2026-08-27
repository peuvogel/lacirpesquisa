import { describe, expect, it } from 'vitest';
import { hasBlockingIssues, type AnalysisIssue } from './analysisIssues';

describe('analysis issues', () => {
  it('distinguishes blocking errors from corrective warnings', () => {
    const warnings: AnalysisIssue[] = [{ code: 'rows_ignored', severity: 'warning', message: 'Revise.' }];
    expect(hasBlockingIssues(warnings)).toBe(false);
    expect(hasBlockingIssues([...warnings, { code: 'missing_group', severity: 'error', message: 'Falta grupo.' }])).toBe(true);
  });
});
