/**
 * Public entry point for the Clinical Study Studio randomization engine
 * (epic #3997, tickets #3998-#3999, ADR 0073).
 *
 * Pure, framework-free contracts, compatibility metadata, ratio reduction,
 * overflow-safe resource preflight, plan validation, deterministic MT19937
 * seeds/streams, structural stratum and subject ID masks, and canonical
 * immutable artifact integrity.
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
