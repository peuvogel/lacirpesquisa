export type NudgeSeverity = 'info' | 'warning';

export interface AssumptionNudge {
  severity: NudgeSeverity;
  message: string;
  cta?: { label: string; testId: string };
}

/** Warnings first, then info — stable within each severity group. */
export function sortNudges(nudges: AssumptionNudge[]): AssumptionNudge[] {
  const order: Record<NudgeSeverity, number> = { warning: 0, info: 1 };
  return [...nudges].sort((a, b) => order[a.severity] - order[b.severity]);
}
