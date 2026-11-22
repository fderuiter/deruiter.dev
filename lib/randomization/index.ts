/**
 * Public entry point for the Clinical Study Studio randomization engine
 * (epic #3997, tickets #3998, #3999 and #4005, ADR 0073).
 *
 * Pure, framework-free contracts, compatibility metadata, ratio reduction,
 * overflow-safe resource preflight, plan validation, deterministic MT19937
 * seeds/streams, structural stratum and subject ID masks, and canonical
 * immutable artifact integrity. Display masking, the single export
 * disclosure gate and code-only error reports come from #4005.
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
  ANONYMOUS_SYNTHETIC_CAPABILITIES,
  BLINDED_TREATMENT_MARKER,
  DEFAULT_DISPLAY_PROFILE,
  DISPLAY_PERSONAS,
  DISPLAY_SEGMENTS,
  MAX_DISPLAY_LABEL_LENGTH,
  RANDOMIZATION_DISCLOSURE_POLICY_VERSION,
  RANDOMIZATION_EXPORT_KINDS,
  RANDOMIZATION_USE_POLICY_VERSION,
  assessVerificationEvidence,
  decideRandomizationExport,
  normalizeDisplayProfile,
  presentAllocationRows,
  presentTreatmentSummary,
  presentTreatmentValue,
  requestPromotion,
  resolvePresentation,
  sanitizeDisplayLabel,
} from "./internal/disclosure/policy";
export type {
  DisclosureDenialCode,
  DisclosureLabel,
  DisclosureMode,
  DisplayPersona,
  DisplayProfile,
  DisplaySegment,
  HostRandomizationCapabilities,
  PresentationReason,
  PromotionDecision,
  PromotionRequest,
  RandomizationDisclosureMetadata,
  RandomizationExportDecision,
  RandomizationExportKind,
  RandomizationExportRequest,
  RandomizationLifecycle,
  ResolvedPresentation,
  TreatmentSummaryEntry,
  VerificationEvidenceAssessment,
} from "./internal/disclosure/policy";
export {
  RandomizationError,
  toReportableRandomizationError,
  toSafeRandomizationErrorReport,
} from "./internal/disclosure/privacy";
export type {
  RandomizationRuntimeErrorCode,
  RandomizationSafeErrorCode,
  SafeRandomizationErrorReport,
} from "./internal/disclosure/privacy";
