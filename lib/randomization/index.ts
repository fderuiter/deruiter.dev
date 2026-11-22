/**
 * Public entry point for the Clinical Study Studio randomization engine
 * (epic #3997, ADR 0073), built in tickets #3998 to #4007. The paragraph
 * below says which ticket added what.
 *
 * Pure, framework-free contracts, compatibility metadata, ratio reduction,
 * overflow-safe resource preflight, plan validation, deterministic MT19937
 * seeds/streams, structural stratum and subject ID masks, and canonical
 * immutable artifact integrity. Permuted-block schedules, actual-profile
 * block sessions and manual or proportional capacities come from #4000;
 * marginal (factor-level) caps and their site policies from #4001;
 * ratio-normalized minimization cohorts and sessions from #4002.
 * Display masking, the single export disclosure gate and code-only error
 * reports come from #4005. Plan digests that bind worker answers to their
 * request come from #4004, and reproducible Monte Carlo allocation QA
 * comes from #4007.
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
  computePlanDigest,
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
  BlockCapacities,
  BlockCompositionPreview,
  BlockScheduleResult,
  MarginalScheduleSummary,
  MarginalStopReason,
  PartialBlockRecord,
} from "./internal/engines/block";
export {
  MARGINAL_SITE_POLICIES,
  resolveMarginalCaps,
} from "./internal/engines/marginal";
export {
  createMinimizationSession,
  generateMinimizationSchedule,
} from "./internal/engines/minimization";
export type { ResolvedCapacities } from "./internal/engines/capacity";
export type {
  MinimizationAllocationSession,
  MinimizationAllocationSessionResult,
  MinimizationDecision,
  MinimizationScheduleResult,
  MinimizationScheduleSummary,
  MinimizationStopReason,
} from "./internal/engines/minimization";
export type {
  MarginalCapResolution,
  ResolvedLevelCap,
} from "./internal/engines/marginal";
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
export {
  DEFAULT_SIMULATION_REPETITIONS,
  MAX_SIMULATION_ATTRITION_PERCENT,
  MONTE_CARLO_SIMULATION_VERSION,
  RETAINED_DEVIATION_WARNING,
  createSimulationRunner,
  deriveRepetitionSeeds,
  isSimulationReportCurrent,
  reproduceRepetitionRequest,
  validateSimulationRequest,
} from "./internal/simulation/monte-carlo";
export type {
  ArmCountStatistics,
  DeviationBand,
  RepetitionSeeds,
  SimulationArmReport,
  SimulationInterpretation,
  SimulationRepetitionFailure,
  SimulationReport,
  SimulationReportIdentity,
  SimulationRequest,
  SimulationRunner,
  SimulationRunnerResult,
} from "./internal/simulation/monte-carlo";
