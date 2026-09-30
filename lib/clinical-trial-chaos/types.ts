import { AstCondition, EditCheckRule } from "../crf/types";

export type CDISCDomain = "DM" | "VS" | "AE" | "LB" | "CM" | "EX" | "DS" | "MH";

export type ValidationErrorType =
  | "unit-error"
  | "missing-digit"
  | "invalid-date"
  | "negative-value"
  | "range-outlier"
  | "casing-mismatch"
  | "unapproved-conmed"
  | "dose-calculation-error"
  | "disposition-date-mismatch";

export interface ClinicalObservation {
  id: string;
  field: string;
  fieldId?: string;
  rawValue: string;
  correctedValue?: string;
  currentValue: string;
  destination: CDISCDomain;
  errorType?: ValidationErrorType;
  hint?: string;
  explanation?: string;
  ctCode?: string; // e.g. CDISC CT Code C25473 or MedDRA PT
  options?: string[]; // Multi-choice validation puzzle options
  isResolved: boolean;
  astRule?: EditCheckRule;
  astConditions?: AstCondition[];
}

export interface ClinicalSubject {
  id: string;
  subjectLabel: string; // e.g. "SUBJ-1042"
  studySite: string; // e.g. "Site 014 (Boston General)"
  observations: ClinicalObservation[];
  status:
    | "queued"
    | "validating"
    | "routing"
    | "signing"
    | "submitted"
    | "rejected"
    | "expired";
  isSAE?: boolean; // Serious Adverse Event - urgent priority rush!
  timeRemaining: number; // Seconds before auditor flags it as overdue
  maxTime: number;
  assignedDomainSlot?: CDISCDomain;
  createdAt: number;
}

export type VendorSystem =
  "iMednet" | "Veeva Vault" | "OpenClinica" | "Medidata Rave" | "Oracle InForm";

export interface StationConfig {
  id: CDISCDomain;
  name: string;
  label: string;
  description: string;
  color: string;
  accentColor: string;
  positionIndex: number; // Position index for layout and hotkeys
  vendor: VendorSystem;
  pendingSubjects: ClinicalSubject[];
  processedCount: number;
}

export type AuditorBehavior =
  "patrolling" | "inspecting" | "suspicious" | "issuing_483" | "coffee_break";

export interface AuditorState {
  x: number; // 0 to 1 percentage
  y: number;
  direction: 1 | -1;
  behavior: AuditorBehavior;
  suspicion: number; // 0 to 100%
  suspicionDecayRate: number; // points per second
  targetStationId?: CDISCDomain;
  inspectTimer: number;
  total483Citations: number;
  isPaused?: boolean;
}

export type AmendmentType =
  | "station-scramble"
  | "sae-priority-rush"
  | "unit-shift-lbs-to-kg"
  | "double-signature-audit"
  | "conmed-reconciliation-rush"
  | "gcp-spot-inspection";

export interface ProtocolAmendment {
  id: string;
  version: string; // e.g. "Protocol v3.2.1"
  title: string;
  description: string;
  type: AmendmentType;
  durationSeconds: number;
  timeRemaining: number;
  active: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "CRITICAL" | "COMPLIANT";
  message: string;
  suspicionDelta: number;
}

export type GamePhase = 1 | 2 | 3;
export type GameMode = "campaign" | "endless";
export type PlayState =
  "idle" | "playing" | "paused" | "phase_cleared" | "game_over";

export interface GameScoreState {
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  /** CRFs locked across the whole campaign run. */
  subjectsSubmitted: number;
  correctionsMade: number;
  cleanSubmissions: number;
  /** Every missed or misrouted CRF: expired subjects plus station rejections. */
  auditViolations: number;
  /** Subjects that expired on the conveyor, a subset of `auditViolations` (#1670). */
  expiredSubjects: number;
}

export interface SignatureModalState {
  isOpen: boolean;
  subject: ClinicalSubject | null;
  selectedReason: SignatureReason;
  passwordInput: string;
  requiresReason: boolean;
}

export type SignatureReason =
  | "Intent to Submit"
  | "Author Verification"
  | "Protocol Compliance Review"
  | "Urgent Safety Expedited";

export type PowerUpType =
  "fda-coffee-break" | "auto-clean" | "query-extension" | "fast-sign";

export interface PowerUpState {
  id: PowerUpType;
  name: string;
  description: string;
  hotkey: string;
  charge: number; // Current charge points (0 to maxCharge)
  maxCharge: number;
  activeSecondsRemaining: number;
  duration: number;
}

export type PowerUpInventory = Record<PowerUpType, PowerUpState>;

export interface SDTMRow {
  STUDYID: string;
  DOMAIN: CDISCDomain;
  USUBJID: string;
  SEQ: number;
  TESTCD: string;
  TEST: string;
  ORRES: string;
  STRESC: string;
  STRESN?: number;
  STRESU?: string;
  VISIT: string;
  DY: number;
  SIGNDATE: string;
  STATUS: "COMPLIANT" | "QUERY";
}

export interface BIMOFinding {
  id: string;
  category:
    | "Data Integrity"
    | "Protocol Compliance"
    | "21 CFR Part 11"
    | "Adverse Event Reporting";
  severity: "Critical" | "Major" | "Minor";
  description: string;
  regulation: string;
}

export interface RecordedRuleViolation {
  id: string;
  type: "ast_edit_check" | "cdisc_conformance";
  subjectLabel: string;
  field: string;
  selectedChoice: string;
  ruleName?: string;
  message: string;
  domain?: CDISCDomain;
  timestamp: string;
}

export interface BIMOInspectionReport {
  runId: string;
  auditDate: string;
  overallScore: number;
  verdict:
    | "NAI (No Action Indicated - Approved)"
    | "VAI (Voluntary Action Indicated)"
    | "OAI (Official Action Indicated - Form 483 Issued)";
  /** Percentage of submitted CRFs that were clean, or `null` when none were submitted. */
  complianceRate: number | null;
  findings: BIMOFinding[];
  submittedCRFs: number;
  /** Percentage of submitted CRFs that were clean, or `null` when none were submitted. */
  cleanRate: number | null;
  /** Subjects that expired on the conveyor and were never submitted (#1670). */
  expiredCRFs: number;
  summary: string;
}
