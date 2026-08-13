import type { ResearchGoal, VariableType } from '@/features/research/types';

export type GuidedAvailability = 'complete' | 'partial' | 'none';

export interface ResearchCutSummaryViewModel {
  eyebrow: string;
  title: string;
  facts: string[];
}

export interface SourceMethodViewModel {
  source: string;
  method: string;
  url?: string;
}

interface GuidedVariableBaseViewModel {
  id: string;
  label: string;
  type: VariableType;
  typeLabel: string;
  sourceMethod: SourceMethodViewModel;
}

export type GuidedVariableViewModel = GuidedVariableBaseViewModel & (
  | { availability: 'complete'; availabilityReason?: never }
  | { availability: 'partial' | 'none'; availabilityReason: string }
);

export interface ProfileCoverageViewModel {
  expected: number;
  available: number;
  used: number;
  missing: number;
}

export interface ProfileFactViewModel {
  label: string;
  value: string;
}

export interface DistributionViewModel {
  title: string;
  description: string;
  histogram?: Array<{ lower: number; upper: number; count: number }>;
  qqPoints?: Array<{ theoretical: number; observed: number }>;
  categories?: Array<{ label: string; count: number }>;
  slot?: React.ReactNode;
}

export interface DataProfileViewModel {
  variableId: string;
  label: string;
  kind: VariableType;
  coverage: ProfileCoverageViewModel;
  facts: ProfileFactViewModel[];
  diagnosticLabel: string;
  distribution: DistributionViewModel;
}

export type EligibleTestStatus = 'eligible' | 'eligible_with_caveat' | 'ineligible';

export interface EligibleTestViewModel {
  id: string;
  label: string;
  status: EligibleTestStatus;
  statusLabel: string;
  reason: string;
}

export interface GuidedResearchSelection {
  goal: ResearchGoal | null;
  variableIds: string[];
  trendTestIds: string[];
  testIds: string[];
  primaryTestId: string | null;
  roleAssignments?: Record<string, string>;
}
