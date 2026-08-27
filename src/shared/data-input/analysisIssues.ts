export interface AnalysisIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  columnId?: string;
  rowNumbers?: number[];
  hint?: string;
}

export function hasBlockingIssues(issues: readonly AnalysisIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
