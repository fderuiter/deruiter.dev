/**
 * Display masking and export disclosure policy for the Clinical Study Studio
 * randomization work area (epic #3997, ticket #4005, ADR 0073 section 7).
 *
 * Persona and organization choices are local display preferences for an
 * anonymous synthetic workspace. They never grant access to anything. Full
 * JSON, seed/config and executable code can rebuild every assignment, so
 * those artifacts need an explicit full-disclosure choice and are never
 * labeled blinded. Every function is pure and leaves its inputs unchanged.
 */

import type { AllocationRow, ArmSpec } from "../../types";

/** Version of the display and export disclosure rules in this module. */
export const RANDOMIZATION_DISCLOSURE_POLICY_VERSION = 1 as const;

/** Version of the reviewed use notice that gates generation and code actions. */
export const RANDOMIZATION_USE_POLICY_VERSION = 1 as const;

/** Marker shown in place of a masked treatment value. */
export const BLINDED_TREATMENT_MARKER = "Blinded" as const;

/** Persona display contexts (RND-DISCL-001). */
export const DISPLAY_PERSONAS = [
  "Biostatistician",
  "TrialManager",
  "ComplianceOfficer",
] as const;

/** Persona display context chosen by the visitor. */
export type DisplayPersona = (typeof DISPLAY_PERSONAS)[number];

/** Organization segment display contexts (RND-DISCL-002). */
export const DISPLAY_SEGMENTS = ["Sponsor", "Academic", "CRO"] as const;

/** Organization segment display context chosen by the visitor. */
export type DisplaySegment = (typeof DISPLAY_SEGMENTS)[number];

/** A visitor's local display preferences. Never an authorization claim. */
export interface DisplayProfile {
  readonly persona: DisplayPersona;
  readonly segment: DisplaySegment;
  /** Only honored where the segment allows the visitor to unmask. */
  readonly unblindRequested: boolean;
}

/** Legacy-compatible default: Sponsor organization, TrialManager persona, masked. */
export const DEFAULT_DISPLAY_PROFILE: DisplayProfile = Object.freeze({
  persona: "TrialManager",
  segment: "Sponsor",
  unblindRequested: false,
});

/**
 * Capabilities a host grants to the randomization work area. The site has
 * no sign-in for the studio, so the only capability set is the anonymous
 * one, and it grants no protected allocation access (RND-DISCL-004).
 */
export interface HostRandomizationCapabilities {
  readonly kind: "anonymous-synthetic";
  readonly canAccessProtectedAllocations: false;
}

/** The capability set every visitor gets. */
export const ANONYMOUS_SYNTHETIC_CAPABILITIES: HostRandomizationCapabilities =
  Object.freeze({
    kind: "anonymous-synthetic",
    canAccessProtectedAllocations: false,
  });

/** Why a presentation is masked or unmasked. */
export type PresentationReason =
  | "biostatistician-view"
  | "academic-unmasked"
  | "academic-masked"
  | "segment-masked";

/** The resolved display behavior for one profile. */
export interface ResolvedPresentation {
  readonly profile: DisplayProfile;
  readonly maskTreatment: boolean;
  readonly canToggleUnblind: boolean;
  readonly reason: PresentationReason;
  /** Always false: a display preference is not access to protected data. */
  readonly grantsProtectedAccess: false;
  /** Export kinds this presentation can request; each still passes `decideRandomizationExport`. */
  readonly visibleExportKinds: readonly RandomizationExportKind[];
}

/** Artifact kinds the work area can export. */
export const RANDOMIZATION_EXPORT_KINDS = [
  "allocation-json",
  "seed-config",
  "executable-code",
  "csv",
  "xlsx",
  "pdf",
  "validation-manifest",
] as const;

/** One exportable artifact kind. */
export type RandomizationExportKind =
  (typeof RANDOMIZATION_EXPORT_KINDS)[number];

/**
 * Kinds that can rebuild assignments on their own: a full request plus seed
 * is allocation-sensitive (RND-DISCL-005).
 */
const ALLOCATION_SENSITIVE_KINDS: ReadonlySet<RandomizationExportKind> =
  new Set(["allocation-json", "seed-config", "executable-code"]);

/** Kinds behind the reviewed use notice (generation and code actions). */
const USE_NOTICE_KINDS: ReadonlySet<RandomizationExportKind> = new Set([
  "allocation-json",
  "seed-config",
  "executable-code",
]);

/** Explicit lifecycle state of a result. Never inferred from names or IDs. */
export type RandomizationLifecycle = "exploration" | "promoted";

/** Whether an export reveals assignments or only a masked presentation. */
export type DisclosureMode = "masked" | "full";

/** Everything the export gate needs to decide one request. */
export interface RandomizationExportRequest {
  readonly kind: RandomizationExportKind;
  readonly lifecycle: RandomizationLifecycle;
  readonly disclosure: DisclosureMode;
  /** The visitor confirmed the file can rebuild every assignment. */
  readonly fullDisclosureAcknowledged: boolean;
  /** The visitor accepted the current reviewed use notice. */
  readonly useNoticeAcknowledged: boolean;
}

/** Label written on an export and shown beside it. */
export type DisclosureLabel = "full-disclosure" | "masked-presentation";

/** Disclosure metadata carried in every export (step 3). */
export interface RandomizationDisclosureMetadata {
  readonly disclosurePolicyVersion: typeof RANDOMIZATION_DISCLOSURE_POLICY_VERSION;
  readonly usePolicyVersion: typeof RANDOMIZATION_USE_POLICY_VERSION;
  readonly disclosure: DisclosureMode;
  readonly label: DisclosureLabel;
  readonly lifecycle: RandomizationLifecycle;
  readonly containsAuthoritativeAssignments: boolean;
}

/** Stable reasons an export is refused. */
export type DisclosureDenialCode =
  | "UNKNOWN_EXPORT_KIND"
  | "UNKNOWN_LIFECYCLE"
  | "UNKNOWN_DISCLOSURE_MODE"
  | "EXPLORATION_EXPORT_BLOCKED"
  | "FULL_DISCLOSURE_REQUIRED"
  | "FULL_DISCLOSURE_NOT_ACKNOWLEDGED"
  | "USE_NOTICE_REQUIRED";

/** Result of the single export gate. */
export type RandomizationExportDecision =
  | {
      readonly allowed: true;
      readonly metadata: RandomizationDisclosureMetadata;
    }
  | {
      readonly allowed: false;
      readonly code: DisclosureDenialCode;
    };

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

/**
 * Coerces untrusted input (a saved preference, a hash value) into a valid
 * profile. Anything unknown falls back to the legacy default.
 */
export function normalizeDisplayProfile(value: unknown): DisplayProfile {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_DISPLAY_PROFILE;
  }
  const candidate = value as Record<string, unknown>;
  return Object.freeze({
    persona: isOneOf(DISPLAY_PERSONAS, candidate.persona)
      ? candidate.persona
      : DEFAULT_DISPLAY_PROFILE.persona,
    segment: isOneOf(DISPLAY_SEGMENTS, candidate.segment)
      ? candidate.segment
      : DEFAULT_DISPLAY_PROFILE.segment,
    unblindRequested: candidate.unblindRequested === true,
  });
}

/**
 * Resolves how treatment values are shown for a profile (RND-DISCL-003).
 * Biostatisticians see treatment values; Academic visitors may unmask;
 * Sponsor and CRO visitors in other personas see the blinded marker and
 * cannot toggle it. The capability argument exists so a host can never
 * widen access through this function: the result always reports
 * `grantsProtectedAccess: false`.
 */
export function resolvePresentation(
  profile: DisplayProfile,
  capabilities: HostRandomizationCapabilities = ANONYMOUS_SYNTHETIC_CAPABILITIES
): ResolvedPresentation {
  void capabilities;
  const normalized = normalizeDisplayProfile(profile);

  let maskTreatment: boolean;
  let canToggleUnblind: boolean;
  let reason: PresentationReason;

  if (normalized.persona === "Biostatistician") {
    maskTreatment = false;
    canToggleUnblind = false;
    reason = "biostatistician-view";
  } else if (normalized.segment === "Academic") {
    canToggleUnblind = true;
    maskTreatment = !normalized.unblindRequested;
    reason = maskTreatment ? "academic-masked" : "academic-unmasked";
  } else {
    maskTreatment = true;
    canToggleUnblind = false;
    reason = "segment-masked";
  }

  const visibleExportKinds = RANDOMIZATION_EXPORT_KINDS.filter(
    (kind) => !maskTreatment || !ALLOCATION_SENSITIVE_KINDS.has(kind)
  );

  return Object.freeze({
    profile: normalized,
    maskTreatment,
    canToggleUnblind,
    reason,
    grantsProtectedAccess: false as const,
    visibleExportKinds: Object.freeze(visibleExportKinds),
  });
}

/** Returns the value to display for a treatment field. */
export function presentTreatmentValue(
  value: string,
  presentation: ResolvedPresentation
): string {
  return presentation.maskTreatment ? BLINDED_TREATMENT_MARKER : value;
}

/**
 * Returns display copies of allocation rows with treatment fields masked
 * when the presentation requires it. The input rows are never changed, so
 * switching profile cannot alter the numerical result.
 */
export function presentAllocationRows(
  rows: readonly AllocationRow[],
  presentation: ResolvedPresentation
): readonly AllocationRow[] {
  if (!presentation.maskTreatment) {
    return rows;
  }
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        ...row,
        armId: BLINDED_TREATMENT_MARKER,
        armCode: BLINDED_TREATMENT_MARKER,
      })
    )
  );
}

/** One legend or balance-summary entry. */
export interface TreatmentSummaryEntry {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Builds legend and balance-summary entries. A masked presentation collapses
 * every arm into one blinded entry, so counts per arm cannot reveal which
 * arm is which.
 */
export function presentTreatmentSummary(
  arms: readonly ArmSpec[],
  countsByArmId: Readonly<Record<string, number>>,
  presentation: ResolvedPresentation
): readonly TreatmentSummaryEntry[] {
  if (presentation.maskTreatment) {
    const total = arms.reduce(
      (sum, arm) => sum + (countsByArmId[arm.id] ?? 0),
      0
    );
    return Object.freeze([
      Object.freeze({
        key: BLINDED_TREATMENT_MARKER,
        label: BLINDED_TREATMENT_MARKER,
        count: total,
      }),
    ]);
  }
  return Object.freeze(
    arms.map((arm) =>
      Object.freeze({
        key: arm.id,
        label: sanitizeDisplayLabel(arm.label),
        count: countsByArmId[arm.id] ?? 0,
      })
    )
  );
}

// C0/C1 controls plus bidirectional overrides and isolates.
// eslint-disable-next-line no-control-regex
const UNSAFE_LABEL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g;

/** Longest label the work area displays. */
export const MAX_DISPLAY_LABEL_LENGTH = 120;

/**
 * Turns an imported label into plain display text: control and bidi
 * override characters removed, whitespace collapsed, length capped. The
 * result is rendered as text, never as HTML or a link target.
 */
export function sanitizeDisplayLabel(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  const cleaned = text
    .replace(UNSAFE_LABEL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, MAX_DISPLAY_LABEL_LENGTH).join("");
}

/**
 * The single export gate for CSV, XLSX, PDF, JSON, seed/config, code and
 * manifests (RND-DISCL-005, RND-DISCL-006). It fails closed on unknown
 * values, blocks every export while a result is in exploration, and never
 * lets an allocation-sensitive artifact leave under a masked label.
 */
export function decideRandomizationExport(
  request: RandomizationExportRequest
): RandomizationExportDecision {
  if (!isOneOf(RANDOMIZATION_EXPORT_KINDS, request.kind)) {
    return { allowed: false, code: "UNKNOWN_EXPORT_KIND" };
  }
  if (request.lifecycle !== "exploration" && request.lifecycle !== "promoted") {
    return { allowed: false, code: "UNKNOWN_LIFECYCLE" };
  }
  if (request.disclosure !== "masked" && request.disclosure !== "full") {
    return { allowed: false, code: "UNKNOWN_DISCLOSURE_MODE" };
  }
  if (request.lifecycle === "exploration") {
    return { allowed: false, code: "EXPLORATION_EXPORT_BLOCKED" };
  }
  if (
    USE_NOTICE_KINDS.has(request.kind) &&
    request.useNoticeAcknowledged !== true
  ) {
    return { allowed: false, code: "USE_NOTICE_REQUIRED" };
  }
  if (
    ALLOCATION_SENSITIVE_KINDS.has(request.kind) &&
    request.disclosure !== "full"
  ) {
    return { allowed: false, code: "FULL_DISCLOSURE_REQUIRED" };
  }
  if (
    request.disclosure === "full" &&
    request.fullDisclosureAcknowledged !== true
  ) {
    return { allowed: false, code: "FULL_DISCLOSURE_NOT_ACKNOWLEDGED" };
  }

  const full = request.disclosure === "full";
  return {
    allowed: true,
    metadata: Object.freeze({
      disclosurePolicyVersion: RANDOMIZATION_DISCLOSURE_POLICY_VERSION,
      usePolicyVersion: RANDOMIZATION_USE_POLICY_VERSION,
      disclosure: request.disclosure,
      label: full ? "full-disclosure" : "masked-presentation",
      lifecycle: request.lifecycle,
      containsAuthoritativeAssignments: full,
    }),
  };
}

/** Input to promote an exploration result. */
export interface PromotionRequest {
  readonly lifecycle: RandomizationLifecycle;
  /** Study metadata required for a promoted result is complete. */
  readonly metadataComplete: boolean;
  /** The visitor confirmed that promotion discards demo results. */
  readonly acknowledged: boolean;
}

/** Outcome of a promotion request. */
export type PromotionDecision =
  | {
      readonly ok: true;
      readonly lifecycle: "promoted";
      readonly invalidatesDemoResults: true;
    }
  | {
      readonly ok: false;
      readonly code:
        | "ALREADY_PROMOTED"
        | "PROMOTION_METADATA_INCOMPLETE"
        | "PROMOTION_NOT_ACKNOWLEDGED";
    };

/**
 * Moves a result from exploration to promoted only through explicit state.
 * Plan names, protocol IDs or reserved strings play no part.
 */
export function requestPromotion(request: PromotionRequest): PromotionDecision {
  if (request.lifecycle === "promoted") {
    return { ok: false, code: "ALREADY_PROMOTED" };
  }
  if (request.metadataComplete !== true) {
    return { ok: false, code: "PROMOTION_METADATA_INCOMPLETE" };
  }
  if (request.acknowledged !== true) {
    return { ok: false, code: "PROMOTION_NOT_ACKNOWLEDGED" };
  }
  return { ok: true, lifecycle: "promoted", invalidatesDemoResults: true };
}

/** Whether an imported file can support full verification. */
export type VerificationEvidenceAssessment =
  | { readonly status: "sufficient" }
  | {
      readonly status: "insufficient-evidence";
      readonly code:
        | "MISSING_DISCLOSURE_METADATA"
        | "MASKED_PRESENTATION"
        | "NO_AUTHORITATIVE_ASSIGNMENTS";
    };

/**
 * Checks an imported file's disclosure metadata before verification. A
 * masked presentation, or any file without authoritative assignments,
 * reports insufficient evidence instead of a pass or a fail.
 */
export function assessVerificationEvidence(
  metadata: unknown
): VerificationEvidenceAssessment {
  if (typeof metadata !== "object" || metadata === null) {
    return {
      status: "insufficient-evidence",
      code: "MISSING_DISCLOSURE_METADATA",
    };
  }
  const candidate = metadata as Record<string, unknown>;
  if (
    candidate.disclosurePolicyVersion !==
    RANDOMIZATION_DISCLOSURE_POLICY_VERSION
  ) {
    return {
      status: "insufficient-evidence",
      code: "MISSING_DISCLOSURE_METADATA",
    };
  }
  if (
    candidate.disclosure !== "full" ||
    candidate.label !== "full-disclosure"
  ) {
    return { status: "insufficient-evidence", code: "MASKED_PRESENTATION" };
  }
  if (candidate.containsAuthoritativeAssignments !== true) {
    return {
      status: "insufficient-evidence",
      code: "NO_AUTHORITATIVE_ASSIGNMENTS",
    };
  }
  return { status: "sufficient" };
}
