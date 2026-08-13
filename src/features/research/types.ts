export type ResearchGoal = 'describe' | 'compare' | 'describe_and_compare';
export type LocationBasis = 'ocorrencia' | 'residencia';
export type ResearchGeography = 'uf' | 'municipio' | 'mesorregiao' | 'macro_saude';
export type VariableType = 'count' | 'rate' | 'numeric' | 'categorical' | 'ordinal';
export type TemporalAggregation = 'sum' | 'recompute_rate' | 'weighted_mean' | 'point_only';

export type SourceCellStatus =
  | 'observed'
  | 'collection_zero'
  | 'missing'
  | 'suppressed'
  | 'not_applicable'
  | 'not_queried';

export type AnalyticCellStatus =
  | 'include'
  | 'exclude_missing'
  | 'exclude_suspected_noncollection'
  | 'exclude_manual'
  | 'requires_review';

export interface ResearchTerritory {
  id: string;
  label: string;
  parentId?: string;
}

export interface TerritoryGroup {
  id: string;
  name: string;
  territories: ResearchTerritory[];
}

export type ResearchPeriod =
  | { mode: 'point'; point: string }
  | { mode: 'range'; start: string; end: string }
  | { mode: 'compare'; periodA: string; periodB: string };

export type SharedOrPerGroupPeriod =
  | { scope: 'shared'; time: ResearchPeriod }
  | { scope: 'per_group'; timesByGroupId: Record<string, ResearchPeriod> };

export interface ResearchDesign {
  groups: TerritoryGroup[];
  geography: ResearchGeography;
  locationBasis: LocationBasis;
  diseaseIds: string[];
  period: SharedOrPerGroupPeriod;
  goal?: ResearchGoal;
}

export interface VariableProfile {
  variableId: string;
  label: string;
  variableType: VariableType;
  unit?: string;
  numeratorVariableId?: string;
  denominatorVariableId?: string;
  exposureVariableId?: string;
  rateMultiplier?: number;
  temporalAggregation: TemporalAggregation;
}

export interface AnalysisCell {
  territoryId: string;
  groupId: string;
  periodKey: string;
  variableId: string;
  rawValue: number | null;
  sourceStatus: SourceCellStatus;
  analyticStatus: AnalyticCellStatus;
  reasonCode?: string;
}

export interface MissingDataDecision {
  cellKey: string;
  analyticStatus: AnalyticCellStatus;
  reasonCode: string;
  note?: string;
}

export interface AnalysisScenario {
  id: string;
  kind: 'recommended' | 'researcher_reviewed';
  cells: AnalysisCell[];
  decisions: MissingDataDecision[];
  createdAfterResults: boolean;
  fingerprint: string;
}

export type TestId = string;
export type EligibilityStatus = 'eligible' | 'eligible_with_caveat' | 'ineligible';

export interface EligibilityReason {
  code: string;
  message: string;
}

export interface EligibilityDecision {
  testId: TestId;
  status: EligibilityStatus;
  reasons: EligibilityReason[];
  roleAssignments: Record<string, string>;
  diagnosticsUsed: string[];
}

export interface GuidedAnalysisState {
  design: ResearchDesign | null;
  selectedVariableIds: string[];
  scenario: AnalysisScenario | null;
  eligibility: EligibilityDecision[];
  resultsFingerprint: string | null;
}

export type AggregationReasonCode =
  | 'no_usable_values'
  | 'missing_component'
  | 'mismatched_components'
  | 'invalid_denominator'
  | 'multiple_periods_for_point_only'
  | 'multiple_analytic_units';

export interface AggregationReason {
  code: AggregationReasonCode;
  variableIds?: string[];
  periodKeys?: string[];
}

export interface PeriodAggregationResult {
  value: number | null;
  status: SourceCellStatus;
  reason?: AggregationReason;
  includedCellCount: number;
}
