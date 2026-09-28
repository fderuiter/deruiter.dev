/**
 * CRF Studio Domain Types
 * Clinical Data Acquisition, CDISC CDASH 2.2, ODM-XML v1.3.2, and 21 CFR Part 11 Types
 */

export type ClinicalDataType =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "date"
  | "partial_date"
  | "precision_date"
  | "time"
  | "datetime"
  | "single_select"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "vas_scale" // Visual Analog Scale (0-100mm)
  | "nrs_scale" // Numerical Rating Scale (0-10)
  | "calculated" // Dynamic formula (BMI, BSA, eGFR, RECIST)
  | "repeating_table" // ConMeds, Adverse Events, Lesions
  | "signature"; // 21 CFR Part 11 e-signature

export interface CodelistOption {
  code: string;
  label: string;
  nciCode?: string;
  order: number;
}

export interface CodelistDefinition {
  id: string;
  name: string;
  nciCodelistCode?: string; // e.g. C66742 for Sex
  options: CodelistOption[];
  isStandard?: boolean;
}

export interface CdashVariableMetadata {
  domain: string; // e.g. DM, VS, AE, CM, LB
  sdtmVariable: string; // e.g. USUBJID, AESTDTC, VSTESTCD
  cdashLabel: string; // e.g. "Adverse Event Start Date"
  nciConceptId?: string; // e.g. C49487
  core: "HR" | "O" | "R"; // Highly Recommended, Optional, Required
  acrfAnnotation: string; // e.g. "AE.AESTDTC"
  dataCategory?: string; // Identifier, Timing, Topic, Qualifier
}

export type AstOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "is_empty"
  | "is_not_empty";

export interface AstCondition {
  fieldId: string;
  crossVisitId?: string; // Optional cross-visit comparator (e.g. "v_screen" or "prev_visit")
  operator: AstOperator;
  value: string | number | boolean | string[];
  /**
   * Field/field discrepancy check (#540): compares fieldId's value against
   * this OTHER field's value instead of the literal `value`. Takes
   * precedence over `value` when set.
   */
  compareFieldId?: string;
}

/**
 * One AND/OR-homogeneous group of leaf conditions (#540). EditCheckRule can
 * combine several of these with its own groupLogicalOperator, giving
 * explicit two-level AND/OR grouping (e.g. "(A AND B) OR (C AND D)")
 * without unbounded recursive nesting.
 */
export interface ConditionGroup {
  id: string;
  logicalOperator: "AND" | "OR";
  conditions: AstCondition[];
}

/**
 * Four-valued discrepancy check result (#540): "incompatible" is distinct
 * from "missing" so a genuine authoring/import error (comparing a date
 * field to a number literal, an unrecognized operator from an import) is
 * never silently reported the same as a field that simply has no value yet.
 */
export type ConditionResult = "true" | "false" | "missing" | "incompatible";

export interface EditCheckRule {
  id: string;
  name: string;
  description: string;
  triggerFieldIds: string[];
  actionType:
    "show_field" | "hide_field" | "require_field" | "raise_query" | "set_value";
  targetFieldId: string;
  conditions: AstCondition[];
  logicalOperator: "AND" | "OR";
  /**
   * Explicit AND/OR groups (#540). When present (non-empty), evaluation
   * uses these groups instead of the flat `conditions`/`logicalOperator`
   * pair, which is retained for backward compatibility with rules
   * authored, imported, or persisted before grouping existed.
   */
  conditionGroups?: ConditionGroup[];
  groupLogicalOperator?: "AND" | "OR";
  querySeverity?: "info" | "warning" | "error";
  queryMessage?: string;
  formulaExpression?: string; // For calculations: e.g. "weight / ((height/100) * (height/100))"
  /**
   * Preserves an imported expression this evaluator couldn't map onto
   * `conditions`/`conditionGroups` (unrecognized shape, not merely an
   * unrecognized operator) verbatim, rather than silently dropping or
   * simplifying it during import (#540). A rule carrying this never fires
   * automatically; it is surfaced to the author for review instead.
   */
  unsupportedExpression?: { raw: unknown; reason: string };
}

export interface StudyArm {
  id: string;
  name: string;
  type: string; // e.g. "Experimental", "Active Comparator", "Placebo Comparator"
  description?: string;
  epochIds?: string[];
}

export interface StudyEpoch {
  id: string;
  name: string;
  sequenceNumber: number;
  type?: string; // "Screening", "Treatment", "Follow-up", "Washout", etc.
  description?: string;
}

export interface StudyCohort {
  id: string;
  name: string;
  description?: string;
  armIds?: string[];
  targetSize?: number;
}

export interface BiomedicalConceptProperty {
  id: string;
  name: string;
  code?: string;
  datatype?: string;
}

export interface BiomedicalConcept {
  id: string;
  name: string;
  conceptId?: string; // e.g. "C25298"
  code?: string;
  domain?: string;
  synonyms?: string[];
  properties?: BiomedicalConceptProperty[] | Record<string, unknown>;
  variableName?: string;
  dataType?: string;
  label?: string;
  unit?: string;
}

export interface CRFField {
  id: string;
  conceptId?: string; // Reference to BiomedicalConcept
  variableName: string; // e.g. BRTHYR, DIABP, AETERM
  label: string; // Question text displayed to investigator
  description?: string; // Instructions / hint
  dataType: ClinicalDataType;
  columnSpan: number; // 1 to 12 in responsive grid
  required: boolean;
  readOnly?: boolean;
  placeholder?: string;
  unit?: string; // e.g. mmHg, kg, cm, mg/dL
  unitOptions?: string[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string | number | boolean;
  codelistId?: string; // Reference to CodelistDefinition
  customOptions?: CodelistOption[];
  calculationFormula?: string; // AST formula string
  cdashMetadata?: CdashVariableMetadata;
  repeatingColumns?: CRFField[]; // When dataType is 'repeating_table'
  scaleMinLabel?: string; // For VAS/NRS e.g. "No Pain"
  scaleMaxLabel?: string; // For VAS/NRS e.g. "Worst Possible Pain"
  allowPartial?: boolean; // Allow omission of unknown day/month in date capture
  preventFutureDate?: boolean; // Enforce date <= current UTC timestamp
  allowNullFlavor?: boolean; // Enable compact CDISC null-flavor pills (ND, NA, UNK)
  requirementTier?: "optional" | "hard_stop" | "auto_query"; // 3-tier missing data engine
  requiresSdv?: boolean; // Mandatory CRA Source Document Verification governance flag
  isBlinded?: boolean; // Protocol masking from unblinded sponsor roles until DB lock
  nullFlavorValue?: string; // Active/selected CDISC null-flavor code (e.g. "ND" | "NA" | "UNK")
  sdvVerified?: boolean; // CRA Source Data Verification flag
  sdvTimestamp?: string;
  sdvAuditedBy?: string;
}

export interface CRFSection {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  isRepeating?: boolean;
  fields: CRFField[];
}

export interface CRFForm {
  id: string;
  name: string;
  domain: string; // e.g. DM, VS, AE, CM, LB, RECIST
  description: string;
  version: string;
  sections: CRFSection[];
  rules: EditCheckRule[];
  isLogForm?: boolean; // Continuous log form vs visit-specific
  isLocked?: boolean; // PI Data Lock flag
  lockedBy?: string;
  lockedAt?: string;
}

export interface StudyVisit {
  id: string;
  oid: string; // e.g. SE.SCREENING, SE.VISIT1
  name: string; // e.g. "Screening", "Cycle 1 Day 1"
  visitType: "Scheduled" | "Unscheduled" | "Common";
  targetDay: number; // e.g. Day 0, Day 28
  timepointDays?: number;
  windowBefore: number; // -3 days
  windowAfter: number; // +3 days
  assignedFormIds: string[]; // Forms collected at this visit
  formIds?: string[];
  isRepeating?: boolean;
  repeatMax?: number;
  epochId?: string; // Link to StudyEpoch
  armIds?: string[]; // Link to applicable StudyArms
  armFormAssignments?: Record<string, string[]>; // armId -> formIds[]
}

export interface StudyBranding {
  organizationName: string;
  logoBase64?: string;
  logoUrl?: string;
  primaryColor: string; // e.g. "#0284c7" or "#00f0ff"
  accentColor: string; // e.g. "#9333ea" or "#3b82f6"
  tableHeaderColor?: string;
  headerText?: string; // e.g. "CONFIDENTIAL - INVESTIGATOR USE ONLY"
  footerText?: string; // e.g. "Protocol: ONC-2026-003 | Global Development"
  confidentialityNotice?: string;
  watermarkText?: string;
  showPageNumbers?: boolean;
  showTableOfContents?: boolean;
}

export interface ExportDocxOptions {
  mode: "blank" | "annotated";
  scope: "single" | "all" | "selected";
  selectedFormIds?: string[];
  includeTableOfContents?: boolean;
  includeSdtmAppendix?: boolean;
  includeRulesSummary?: boolean;
  branding?: StudyBranding;
}

export interface ExportPdfOptions {
  mode: "blank" | "annotated";
  scope: "single" | "all" | "selected";
  selectedFormIds?: string[];
  includeTableOfContents?: boolean;
  includeSdtmAppendix?: boolean;
  branding?: StudyBranding;
}

export interface ExportSasOptions {
  selectedFormId?: string;
  includeSampleData?: boolean;
  includeProcContents?: boolean;
  includeProcFreq?: boolean;
  datasetPrefix?: string;
}

export interface ExportROptions {
  selectedFormId?: string;
  includeSampleData?: boolean;
  includeGlimpse?: boolean;
  useLabelledPackage?: boolean;
  tibblePrefix?: string;
}

export interface StudyProtocol {
  $schema?: string;
  schemaVersion?: string;
  id: string;
  protocolNumber: string; // e.g. "ONC-2026-003"
  protocolId?: string;
  studyName: string; // e.g. "Phase III Multicenter Study of Immuno-Oncology..."
  title?: string;
  phase:
    | "Phase I"
    | "Phase I/II"
    | "Phase II"
    | "Phase III"
    | "Phase IV"
    | "Registry";
  sponsor: string;
  therapeuticArea: string; // Oncology, Neurology, Cardiology, Infectious Disease, etc.
  version: string;
  lastModified: string;
  forms: CRFForm[];
  visits: StudyVisit[];
  codelists: CodelistDefinition[];
  rules?: EditCheckRule[];
  branding?: StudyBranding;
  arms?: StudyArm[];
  epochs?: StudyEpoch[];
  cohorts?: StudyCohort[];
  biomedicalConcepts?: BiomedicalConcept[];
  provenance?: StudyProvenance;
  /**
   * Named test scenarios and their last-run evidence (#677). Carried on the
   * study document rather than in browser storage so they survive native
   * export and reopen alongside everything else the study holds.
   */
  testScenarios?: TestScenario[];
  /** Local authoring discussion and lifecycle history, separate from EDC audit data. */
  reviewThreads?: StudyReviewThread[];
  /** Document-level EDC simulation state (audit trail entries, electronic signatures, form values). */
  simulationState?: EdcSimulationState;
  /** Protocol-level audit trail history across authoring and review lifecycle. */
  auditTrail?: AuditTrailEntry[];
  auditLog?: AuditTrailEntry[];
}

/** Local authoring-review roles, unrelated to EDC permissions or audit roles. */
export type StudyReviewRole =
  "Data Manager" | "Medical Monitor" | "Biostatistician" | "Clinical Reviewer";

/** Declared local author identity for an authoring review action. */
export interface StudyReviewActor {
  name: string;
  role: StudyReviewRole;
}

/** A field's last known identity and readable context, retained after deletion. */
export interface StudyReviewTarget {
  fieldId: string;
  formId: string;
  formName: string;
  variableName: string;
  label: string;
}

/** Shared author and chronology attributes on an append-only review event. */
export interface StudyReviewEventBase {
  id: string;
  at: string;
  author: StudyReviewActor;
}

/** A comment, status transition, or retained target-lifecycle entry. */
export type StudyReviewEvent =
  | (StudyReviewEventBase & { type: "comment"; body: string })
  | (StudyReviewEventBase & { type: "resolved" | "reopened" })
  | (StudyReviewEventBase & {
      type: "target-renamed";
      previousVariableName: string;
      nextVariableName: string;
      previousLabel: string;
      nextLabel: string;
    })
  | (StudyReviewEventBase & {
      type: "target-deleted";
      target: StudyReviewTarget;
    });

/** Local discussion anchored to a stable field identity across edits and deletion. */
export interface StudyReviewThread {
  id: string;
  target: StudyReviewTarget;
  events: StudyReviewEvent[];
}

/** Calculation outcomes a scenario can assert on. */
export type CalculationStatus =
  | "success"
  | "missing_inputs"
  | "division_by_zero"
  | "invalid_unit"
  | "cyclic_dependency"
  | "syntax_error";

/**
 * Declared here rather than in the scenario engine so `types.ts` remains the
 * single public contract for the study document, with no runtime import and
 * therefore no cycle between the contract and the engine that operates on it.
 */
export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  formId: string;
  scope: { subjectId: string; visitId: string };
  inputs: Record<string, string | number | boolean | null>;
  expectations: ScenarioExpectation[];
  lastRun?: ScenarioRunEvidence;
  createdAt: string;
  updatedAt: string;
}

export type ScenarioExpectation =
  | { kind: "field_visible"; fieldId: string; expected: boolean }
  | { kind: "field_required"; fieldId: string; expected: boolean }
  | {
      kind: "calculation";
      fieldId: string;
      expectedStatus: CalculationStatus;
      expectedValue?: number | null;
    }
  | { kind: "rule_result"; ruleId: string; expected: ConditionResult };

export interface ScenarioExpectationResult {
  expectation: ScenarioExpectation;
  satisfied: boolean;
  expectedLabel: string;
  actualLabel: string;
  subjectId: string;
  subjectKind: "field" | "rule";
}

export interface ScenarioRunEvidence {
  ranAt: string;
  formFingerprint: string;
  results: ScenarioExpectationResult[];
  passed: number;
  failed: number;
}

export interface EDCQuery {
  id: string;
  fieldId: string;
  fieldName: string;
  ruleId?: string;
  formId: string;
  visitId: string;
  subjectId: string;
  status: "Open" | "Answered" | "Closed" | "Cancelled";
  severity: "info" | "warning" | "error";
  message: string;
  raisedBy: string; // System or User name
  raisedAt: string; // ISO Date
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string; // ISO Date
  changedBy: string;
  subjectId?: string;
  formId?: string;
  fieldId?: string;
  fieldName?: string;
  previousValue?:
    | string
    | number
    | boolean
    | Record<string, unknown>
    | unknown[]
    | null
    | unknown;
  newValue?:
    | string
    | number
    | boolean
    | Record<string, unknown>
    | unknown[]
    | null
    | unknown;
  userRole?:
    | "Site Coordinator"
    | "Principal Investigator"
    | "CRA Monitor"
    | "Data Manager"
    | "Medical Monitor"
    | "Biostatistician"
    | "Clinical Reviewer"
    | string;
  reasonForChange?: string;
  action?: string;
  actionType?: string;
  diagnosticId?: string;
  details?: string | Record<string, unknown> | unknown;
  targetId?: string;
  targetType?: string;
}

export interface ElectronicSignature {
  id: string;
  subjectId: string;
  formId: string;
  visitId: string;
  signedBy: string;
  userRole: string;
  timestamp: string;
  meaning:
    "Author" | "Investigator Approval" | "Data Lock" | "Monitor Verification";
  digest: string; // Cryptographic SHA-256 simulated signature hash
}

export interface EdcSimulationState {
  auditLog?: AuditTrailEntry[];
  signatures?: ElectronicSignature[];
  formValues?: Record<string, string | number | boolean | null>;
  sdvMap?: Record<
    string,
    { verified: boolean; timestamp: string; auditedBy: string }
  >;
  lockedForms?: Record<
    string,
    { locked: boolean; lockedBy: string; timestamp: string }
  >;
  queries?: EDCQuery[];
  availableSubjects?: string[];
}

export type ComplianceSeverity = "error" | "warning" | "notice";

export interface ComplianceViolation {
  id: string;
  ruleId: "SD0001" | "SD0002" | "SD0003" | "SD0004" | "SD0005";
  ruleDescription: string;
  severity: ComplianceSeverity;
  formId: string;
  formName: string;
  fieldId?: string;
  variableName?: string;
  message: string;
  autoFixAvailable: boolean;
  autoFixType?:
    | "truncate_variable"
    | "add_core_variable"
    | "assign_nci_codelist"
    | "fix_date_format"
    | "assign_visit_form";
  suggestedFix?: string;
}

export interface SubjectFormStatus {
  subjectId: string;
  visitId: string;
  formId: string;
  isComplete: boolean;
  isLocked: boolean;
  isSdvVerified: boolean;
  openQueriesCount: number;
  lastModified?: string;
}

export type StudioMode =
  | "designer" // 12-Column Responsive Form Canvas
  | "grid" // Active-Form Spreadsheet Grid
  | "matrix" // Visit x Form Matrix
  | "rules" // Visual Logic & AST Edit Check Graph
  | "edc" // Live 21 CFR Part 11 EDC Simulator
  | "acrf" // Annotated CRF Preview & Overlay
  | "export"; // ODM-XML, JSON, FHIR & Define-XML Export

export type DeviceViewport = "desktop" | "tablet" | "mobile";

export type StudioTheme = "dark" | "light";

/**
 * Historical lineage and provenance tracking for studies restored from baselines or external sources.
 */
export interface StudyProvenance {
  derivedFromBaselineId?: string;
  derivedFromVersionTag?: string;
  restoredAt?: string;
  restoredBy?: string;
  notes?: string;
}

/**
 * Local author or investigator actor metadata declared upon baseline creation.
 */
export interface StudyBaselineActor {
  name: string;
  role?: string;
  email?: string;
}

/**
 * Immutable, version-tagged study baseline snapshot.
 */
export interface StudyBaseline {
  id: string;
  versionTag: string;
  label: string;
  description?: string;
  createdAt: string;
  actor: StudyBaselineActor;
  study: StudyProtocol;
  checksum?: string;
  provenance?: {
    parentBaselineId?: string;
    parentVersionTag?: string;
    totalForms: number;
    totalVisits: number;
    totalRules: number;
    totalFields: number;
  };
}
