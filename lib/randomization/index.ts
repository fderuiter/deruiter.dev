/**
 * Public entry point for the Clinical Study Studio randomization engine
 * (epic #3997, ticket #3998, ADR 0073).
 *
 * Pure, framework-free contracts, compatibility metadata, ratio reduction,
 * overflow-safe resource preflight, and plan validation.
 */
export * from "./types";
export {
  checkResourcePreflight,
  describeAlgorithmCompatibility,
  isSupportedContractVersion,
  reduceAllocationRatios,
} from "./internal/contracts";
export { validateRandomizationPlan } from "./internal/validate-plan";
