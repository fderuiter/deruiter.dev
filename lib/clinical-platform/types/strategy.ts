/**
 * Clinical Data Platform: vendor scoring, build or buy and total cost of
 * ownership types.
 */

/** Editable criterion in a synthetic vendor comparison. */
export interface StrategyCriterion {
  id: string;
  label: string;
  group: string;
  weight: number;
}
/** Fictional vendor and its ratings from zero to five. */
export interface StrategyVendor {
  id: string;
  name: string;
  ratings: Record<string, number>;
}
/** Browser-only strategy inputs; no real vendor evidence is represented. */
export interface StrategyScenario {
  criteria: StrategyCriterion[];
  vendors: StrategyVendor[];
}
/** A normalized score, or null when every criterion weight is zero. */
export interface StrategyScore {
  id: string;
  name: string;
  score: number | null;
}
/** Five-year financial assumptions in synthetic thousands of currency units. */
export interface StrategyCashFlow {
  implementation: number;
  validation: number;
  annualLicense: number;
  annualRun: number;
  annualBenefit: number;
  decommissionSavings: number;
  discountRate: number;
}
/** Roadmap work item with dependency ids and capacity units. */
export interface RoadmapItem {
  id: string;
  label: string;
  capability: string;
  effort: number;
  dependsOn: string[];
}
/** Text fields in a one-page decision memo. */
export interface StrategyMemo {
  context: string;
  options: string;
  criteria: string;
  recommendation: string;
  risks: string;
}
