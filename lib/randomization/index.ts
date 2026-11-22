/**
 * Public entry point for the Clinical Study Studio randomization engine
 * (epic #3997, tickets #3998, #3999 and #4000, ADR 0073).
 *
 * Pure, framework-free contracts, compatibility metadata, ratio reduction,
 * overflow-safe resource preflight, plan validation, deterministic MT19937
 * seeds/streams, structural stratum and subject ID masks, and canonical
 * immutable artifact integrity. Permuted-block schedules, actual-profile
 * block sessions and manual or proportional capacities come from #4000.
 */
export * from "./types";
export {
  checkResourcePreflight,
  describeAlgorithmCompatibility,
  isSupportedContractVersion,
  reduceAllocationRatios,
} from "./internal/contracts";
export { validateRandomizationPlan } from "./internal/validate-plan";
export { createMt19937Stream } from "./internal/engines/mt19937";
export {
  createRandomizationStreams,
  deriveSeedComponents,
  generateRandomSeed,
  validateSeedValue,
} from "./internal/engines/seed";
export {
  formatStratumHumanCode,
  serializeStructuralStratumKey,
} from "./internal/identity/stratum-identity";
export {
  computeRandomizationCheckDigit,
  createSubjectIdGenerator,
  migrateLegacySubjectIdMask,
  parseSubjectIdMask,
  previewSubjectIdMask,
} from "./internal/identity/subject-id";
export {
  buildImmutableArtifact,
  canonicalizeAuditValue,
  computeContentDigest,
  computeEventProvenanceDigest,
} from "./internal/integrity/canonical-digest";
export {
  allocateLargestRemainder,
  enumerateStratumIntersections,
  isProportionalMatrixCurrent,
  resolveBlockCapacities,
} from "./internal/engines/caps";
export type {
  CapResolutionResult,
  ResolvedIntersectionCap,
  StratumIntersection,
} from "./internal/engines/caps";
export {
  buildPermutedBlock,
  createBlockAllocationSession,
  generateBlockSchedule,
  previewBlockComposition,
} from "./internal/engines/block";
export type {
  BlockAllocationSession,
  BlockAllocationSessionResult,
  BlockCompositionPreview,
  BlockScheduleResult,
  PartialBlockRecord,
} from "./internal/engines/block";
