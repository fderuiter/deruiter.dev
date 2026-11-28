/**
 * CRF Studio Domain Types
 * Clinical Data Acquisition, CDISC CDASH 2.2, ODM-XML v1.3.2, and 21 CFR Part 11 Types
 */
import type {
  CodelistDefinition,
  CodelistOption,
} from "@/lib/clinical-standards";

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

export type { CodelistDefinition, CodelistOption };

export interface CdashVariableMetadata {
  domain: string; // e.g. DM, VS, AE, CM, LB
  sdtmVariable: string; // e.g. USUBJID, AESTDTC, VSTESTCD
  cdashLabel: string; // e.g. "Adverse Event Start Date"
  nciConceptId?: string; // NCI codelist code when CDISC publishes the codelist, e.g. C66731
  codelistId?: string; // CRF Studio codelist the variable is collected with, e.g. CL_SEX
  /**
   * CDASH core designation: Highly Recommended, Required, Optional, or
   * Recommended/Conditional (collected only when another answer calls for
   * it, such as the seriousness criteria after a Yes to Serious Event, see
   * issue 2826). Only HR and R are expected on every page of their domain.
   */
  core: "HR" | "O" | "R" | "R/C";
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

/** A sex the protocol plans to enrol. */
export type StudyPlannedSex = "Female" | "Male";

/** Who the protocol plans to enrol: the USDM study design population. */
export interface StudyPopulationPlan {
  description?: string;
  plannedSex?: StudyPlannedSex[];
  /** Planned age range in years, both ends inclusive. */
  plannedAgeYears?: { min: number; max: number };
  includesHealthySubjects?: boolean;
}

/** One inclusion or exclusion criterion from the protocol. */
export interface StudyEligibilityCriterion {
  id: string;
  category: "Inclusion" | "Exclusion";
  /** A short name, such as "Age". */
  name: string;
  text: string;
}

/** The level of an objective or endpoint. */
export type StudyObjectiveLevel = "Primary" | "Secondary" | "Exploratory";

/** An endpoint that measures whether an objective was met. */
export interface StudyEndpoint {
  id: string;
  level: StudyObjectiveLevel;
  name: string;
  text: string;
  /** What the endpoint measures, such as "Efficacy" or "Safety". */
  purpose: string;
}

/** A protocol objective and its endpoints. */
export interface StudyObjective {
  id: string;
  level: StudyObjectiveLevel;
  name: string;
  text: string;
  endpoints: StudyEndpoint[];
}

/** The part a study intervention plays in the design. */
export type StudyInterventionRole =
  "Experimental Intervention" | "Active Comparator" | "Placebo";

/** What kind of product a study intervention is. */
export type StudyInterventionType = "Drug" | "Biologic" | "Device";

/** A drug, biologic or device the protocol gives to subjects. */
export interface StudyInterventionPlan {
  id: string;
  name: string;
  description?: string;
  role: StudyInterventionRole;
  type: StudyInterventionType;
  /** The arms that receive it; every arm when omitted. */
  armIds?: string[];
  /** The forms that record it being given. */
  administrationFormIds?: string[];
  /**
   * The NCI-coded procedure that gives it. Defaults to Medication
   * Administration (C128534).
   */
  procedure?: { name: string; code: string };
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
  needsReview?: boolean; // Form review flag (e.g. unassigned SDTM domain)
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
  /**
   * Whether page footers carry the portfolio consultation link. Defaults to
   * true; the review package (#680) turns it off so clinical content carries
   * no portfolio promotion.
   */
  includeConsultationLink?: boolean;
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

/** Phases the studio offers when a study is created or edited. */
export type StudyPhase =
  "Phase I" | "Phase I/II" | "Phase II" | "Phase III" | "Phase IV" | "Registry";

export interface StudyProtocol {
  $schema?: string;
  schemaVersion?: string;
  id: string;
  protocolNumber: string; // e.g. "ONC-2026-003"
  protocolId?: string;
  studyName: string; // e.g. "Phase III Multicenter Study of Immuno-Oncology..."
  title?: string;
  /**
   * One of the studio's phases, or the phase an imported study arrived with
   * (a USDM decode such as "Phase II/III Trial" is kept as written).
   */
  phase: StudyPhase | (string & {});
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
  /** Planned population, eligibility, objectives and interventions (#3051). */
  population?: StudyPopulationPlan;
  eligibilityCriteria?: StudyEligibilityCriterion[];
  objectives?: StudyObjective[];
  interventions?: StudyInterventionPlan[];
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
  /**
   * Personal-library blocks this study contains, with the version each was
   * taken from (#681). Carried on the study so an upgrade can be previewed
   * after native export and reopen.
   */
  libraryUses?: StudyLibraryUse[];
  auditLog?: AuditTrailEntry[];
}

/**
 * Deterministic ordered symbol table indexing canonical CRF entities by stable ID.
 */
export interface CanonicalCrfSymbolTable<T> {
  readonly order: readonly string[];
  readonly byId: Readonly<Record<string, T>>;
}

/**
 * Canonical form record retaining section order and symbol references.
 */
export interface CanonicalFormNode {
  readonly form: CRFForm;
  readonly fieldIds: readonly string[];
  readonly ruleIds: readonly string[];
}

/**
 * Canonical field record retaining form, section, and parent repeating-table lineage.
 */
export interface CanonicalFieldNode {
  readonly key: string;
  readonly formId: string;
  readonly formDomain: string;
  readonly formName: string;
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly parentFieldId?: string;
  readonly field: CRFField;
}

/**
 * Canonical rule record retaining either form-scoped or study-scoped ownership.
 */
export interface CanonicalRuleNode {
  readonly key: string;
  readonly scope: "form" | "study";
  readonly formId?: string;
  readonly formDomain?: string;
  readonly formName?: string;
  readonly rule: EditCheckRule;
}

/**
 * Root protocol metadata preserved losslessly on a {@link CanonicalCrfDocument}.
 */
export interface CanonicalCrfMetadata {
  readonly $schema?: string;
  readonly schemaVersion?: string;
  readonly id: string;
  readonly protocolNumber: string;
  readonly protocolId?: string;
  readonly studyName: string;
  readonly title?: string;
  readonly phase: StudyProtocol["phase"];
  readonly sponsor: string;
  readonly therapeuticArea: string;
  readonly version: string;
  readonly lastModified: string;
  readonly branding?: StudyBranding;
  readonly arms?: StudyArm[];
  readonly epochs?: StudyEpoch[];
  readonly cohorts?: StudyCohort[];
  readonly population?: StudyPopulationPlan;
  readonly eligibilityCriteria?: StudyEligibilityCriterion[];
  readonly objectives?: StudyObjective[];
  readonly interventions?: StudyInterventionPlan[];
  readonly biomedicalConcepts?: BiomedicalConcept[];
  readonly provenance?: StudyProvenance;
  readonly testScenarios?: TestScenario[];
  readonly reviewThreads?: StudyReviewThread[];
  readonly simulationState?: EdcSimulationState;
  readonly auditTrail?: AuditTrailEntry[];
  readonly libraryUses?: StudyLibraryUse[];
  readonly auditLog?: AuditTrailEntry[];
}

/**
 * Secondary lookup indexes over a {@link CanonicalCrfDocument}.
 */
export interface CanonicalCrfIndexes {
  readonly visitIdByOid: Readonly<Record<string, string>>;
  /** Maps `${formId}::${UPPER_VAR}` to canonical field symbol keys in that form. */
  readonly fieldKeysByFormVariable: Readonly<Record<string, readonly string[]>>;
  /** Maps `${formId}::${fieldId}` to canonical field symbol keys in that form. */
  readonly fieldKeysByFormFieldId: Readonly<Record<string, readonly string[]>>;
  /** Maps uppercase domain code to form IDs carrying that domain. */
  readonly formIdsByDomain: Readonly<Record<string, readonly string[]>>;
  /** Maps form ID to visit IDs assigning that form in the Schedule of Activities. */
  readonly visitIdsByFormId: Readonly<Record<string, readonly string[]>>;
}

/**
 * Identifiers for built-in clinical specification format codecs.
 */
export type FormatCodecId =
  | "json_universal"
  | "yaml_universal"
  | "json_usdm_v4"
  | "json_usdm_v3"
  | "json_fhir_r4"
  | "xml_odm_1_3_2"
  | "csv_redcap"
  | "csv_cdisc_spec";

/**
 * Ingestion format tags exposed by `detectAndParseStudyFile`.
 */
export type IngestedStudyFormat =
  | "json_usdm"
  | "json_universal"
  | "yaml_universal"
  | "json_fhir"
  | "xml_odm"
  | "csv_spec"
  | "csv_redcap";

/**
 * Compiler-grade canonical intermediate representation of a clinical study protocol.
 * Routes format codecs, storage checks, and conformance rule packs through indexed symbol tables.
 */
export interface CanonicalCrfDocument {
  readonly kind: "CanonicalCrfDocument";
  readonly irVersion: "1.0.0";
  readonly metadata: CanonicalCrfMetadata;
  readonly forms: CanonicalCrfSymbolTable<CanonicalFormNode>;
  readonly fields: CanonicalCrfSymbolTable<CanonicalFieldNode>;
  readonly visits: CanonicalCrfSymbolTable<StudyVisit>;
  readonly codelists: CanonicalCrfSymbolTable<CodelistDefinition>;
  readonly rules: CanonicalCrfSymbolTable<CanonicalRuleNode>;
  readonly indexes: CanonicalCrfIndexes;
}

/** HL7 FHIR R4 Coding element. */
export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
}

/** HL7 FHIR R4 CodeableConcept element. */
export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

/** HL7 FHIR R4 Identifier element. */
export interface FhirIdentifier {
  system?: string;
  value?: string;
}

/** HL7 FHIR R4 Extension element used on Questionnaire items. */
export interface FhirExtension {
  url: string;
  valueCoding?: FhirCoding;
  valueCodeableConcept?: FhirCodeableConcept;
  valueString?: string;
  valueCode?: string;
  valueInteger?: number;
  valueDecimal?: number;
  valueBoolean?: boolean;
}

/** HL7 FHIR R4 Questionnaire.item.answerOption element. */
export interface FhirAnswerOption {
  valueCoding?: FhirCoding;
  valueString?: string;
  valueInteger?: number;
  valueDate?: string;
  valueTime?: string;
}

/** HL7 FHIR R4 ValueSet resource subset supported in contained/bundled terminology. */
export interface FhirValueSet {
  resourceType: "ValueSet";
  id?: string;
  url?: string;
  name?: string;
  title?: string;
  status?: "draft" | "active" | "retired" | "unknown";
  expansion?: {
    contains?: FhirCoding[];
  };
  compose?: {
    include?: Array<{
      system?: string;
      concept?: Array<{ code: string; display?: string }>;
    }>;
  };
}

/** HL7 FHIR R4 Questionnaire.item element. */
export interface FhirQuestionnaireItem {
  linkId: string;
  text?: string;
  type:
    | "group"
    | "display"
    | "boolean"
    | "decimal"
    | "integer"
    | "date"
    | "dateTime"
    | "time"
    | "string"
    | "text"
    | "url"
    | "choice"
    | "open-choice"
    | "attachment"
    | "reference"
    | "quantity";
  required?: boolean;
  repeats?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  answerValueSet?: string;
  answerOption?: FhirAnswerOption[];
  extension?: FhirExtension[];
  item?: FhirQuestionnaireItem[];
}

/** HL7 FHIR R4 Questionnaire resource emitted and consumed by `FhirR4QuestionnaireCodec`. */
export interface FhirQuestionnaire {
  resourceType: "Questionnaire";
  id: string;
  url?: string;
  identifier?: FhirIdentifier[];
  version?: string;
  name?: string;
  title?: string;
  status: "draft" | "active" | "retired" | "unknown";
  date?: string;
  publisher?: string;
  description?: string;
  contained?: FhirValueSet[];
  item: FhirQuestionnaireItem[];
}

/** HL7 FHIR R4 Bundle.entry element carrying a Questionnaire or ValueSet resource. */
export interface FhirBundleEntry {
  fullUrl?: string;
  resource: FhirQuestionnaire | FhirValueSet;
}

/** HL7 FHIR R4 Bundle resource emitted and consumed by `FhirR4QuestionnaireCodec`. */
export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  entry: FhirBundleEntry[];
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
  /**
   * Per-dependency fingerprints recorded at run time (#679), so an amendment
   * can be attributed to the specific field, rule, codelist or visit it
   * touched. Absent on evidence recorded before dependency tracking existed.
   */
  dependencies?: ScenarioDependencySnapshot;
}

/**
 * Fingerprints of every study object a scenario's outcome depended on when it
 * ran (#679), keyed `kind:id/aspect` (for example `field:bmi/formula`).
 */
export interface ScenarioDependencySnapshot {
  /** Version of the fingerprint material; a mismatch makes evidence unverifiable rather than current. */
  version: number;
  fingerprints: Record<string, string>;
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
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
}

export interface RaiseEdcQueryInput {
  id?: string;
  subjectId: string;
  visitId: string;
  formId: string;
  fieldId: string;
  fieldName?: string;
  ruleId?: string;
  severity?: EDCQuery["severity"];
  message: string;
  actor: string;
  userRole: NonNullable<AuditTrailEntry["userRole"]>;
  timestamp?: string;
  reasonForChange?: string;
}

export interface AnswerEdcQueryInput {
  queryId: string;
  response: string;
  actor: string;
  userRole: NonNullable<AuditTrailEntry["userRole"]>;
  timestamp?: string;
  reasonForChange?: string;
}

export interface CloseEdcQueryInput {
  queryId: string;
  actor: string;
  userRole: NonNullable<AuditTrailEntry["userRole"]>;
  resolutionReason?: string;
  timestamp?: string;
}

export interface CancelEdcQueryInput {
  queryId: string;
  actor: string;
  userRole: NonNullable<AuditTrailEntry["userRole"]>;
  resolutionReason?: string;
  timestamp?: string;
}

export interface ReopenEdcQueryInput {
  queryId: string;
  actor: string;
  userRole: NonNullable<AuditTrailEntry["userRole"]>;
  reason?: string;
  timestamp?: string;
}

export type ClinicalDataCsvKind = "subjects" | "queries" | "audits";

export interface ExportClinicalCsvOptions {
  selectedFormId?: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string; // ISO Date
  changedBy: string;
  actionType?: string; // e.g. "FORM_CREATE", "FORM_REMOVE", "FIELD_INSERT", "FIELD_UPDATE", "AUTO_FIX"
  action?: string;
  targetId?: string; // Form ID, Field ID, or Diagnostic ID
  targetType?: string;
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
    | "System Auditor"
    | string;
  reasonForChange?: string;
  diagnosticId?: string;
  details?: string | Record<string, unknown> | unknown;
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
  /**
   * Random reference token for the simulated signature. It is not a hash or
   * a cryptographic signature. Records saved before #3617 carry a `SHA256-`
   * prefix; that value was random too.
   */
  digest: string;
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

/**
 * Clinical roles simulated in the Part 11-style EDC workspace.
 */
export type EdcUserRole =
  | "Site Coordinator"
  | "Principal Investigator"
  | "CRA Monitor"
  | "Data Manager";

/**
 * Capability matrix and inline permission guidance for an active {@link EdcUserRole}.
 */
export interface EdcRolePermissions {
  role: EdcUserRole;
  actorLabel: string;
  canEditUnlockedFields: boolean;
  canEditActiveForm: boolean;
  canToggleSdv: boolean;
  canLockAndSign: boolean;
  canUnlockForm: boolean;
  canManageQueries: boolean;
  canRespondToQueries: boolean;
  readOnlyBanner: string | null;
}

/**
 * Resolved lock and electronic signature state for a `(subjectId, visitId, formId)` record.
 */
export interface EdcFormSignatureStatus {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  isSigned: boolean;
  activeDataLockSignature?: ElectronicSignature;
  signatures: ElectronicSignature[];
}

/**
 * Pure validation outcome for 3-tier missing data, null-flavor, range, and precision-date checks.
 */
export interface EdcFormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  hardStops: string[];
  autoQueries: string[];
  queriesToRaise: EDCQuery[];
}

/**
 * Pure reducer actions driving all {@link EdcSimulationState} transitions.
 * Every action that writes to the audit trail, signatures, SDV map, lock map,
 * or discrepancy queries carries an explicit caller-supplied ISO `timestamp`
 * so `reduceEdcSimulationState` remains clock-free and deterministic.
 */
export type EdcSimulationAction =
  | {
      type: "SEED_SIMULATION";
      timestamp: string;
    }
  | {
      type: "UPDATE_FIELD_VALUE";
      subjectId: string;
      visitId: string;
      formId: string;
      fieldId: string;
      value: string | number | boolean | null;
      role: EdcUserRole;
      reasonForChange?: string;
      timestamp: string;
    }
  | {
      type: "TOGGLE_SDV";
      subjectId: string;
      visitId: string;
      formId: string;
      fieldId: string;
      fieldName?: string;
      role: EdcUserRole;
      timestamp: string;
    }
  | {
      type: "SAVE_FORM";
      subjectId: string;
      visitId: string;
      formId: string;
      role: EdcUserRole;
      timestamp: string;
    }
  | {
      type: "ENROLL_SUBJECT";
      subjectId: string;
      role?: EdcUserRole;
    }
  | {
      type: "LOCK_FORM";
      subjectId: string;
      visitId: string;
      formId: string;
      role: EdcUserRole;
      timestamp: string;
      signatureId?: string;
      digest?: string;
    }
  | {
      type: "UNLOCK_FORM";
      subjectId: string;
      visitId: string;
      formId: string;
      role: EdcUserRole;
      reasonForChange: string;
      timestamp: string;
    }
  | {
      type: "RAISE_QUERY";
      input: RaiseEdcQueryInput & { timestamp: string };
    }
  | {
      type: "ANSWER_QUERY";
      input: AnswerEdcQueryInput & { timestamp: string };
    }
  | {
      type: "CLOSE_QUERY";
      input: CloseEdcQueryInput & { timestamp: string };
    }
  | {
      type: "CANCEL_QUERY";
      input: CancelEdcQueryInput & { timestamp: string };
    }
  | {
      type: "REOPEN_QUERY";
      input: ReopenEdcQueryInput & { timestamp: string };
    }
  | {
      type: "REPLACE_SIMULATION_STATE";
      simulationState: EdcSimulationState;
    };

/**
 * Caller-facing simulation dispatch input accepted at the UI/engine boundary
 * (`StudyProtocolEngine.dispatchSimulationAction` and `useStudyEditor.dispatchSimulationAction`),
 * where omitted `timestamp` fields are stamped once before entering `reduceEdcSimulationState`.
 */
export type EdcSimulationActionInput =
  | {
      type: "SEED_SIMULATION";
      timestamp?: string;
    }
  | {
      type: "UPDATE_FIELD_VALUE";
      subjectId: string;
      visitId: string;
      formId: string;
      fieldId: string;
      value: string | number | boolean | null;
      role: EdcUserRole;
      reasonForChange?: string;
      timestamp?: string;
    }
  | {
      type: "TOGGLE_SDV";
      subjectId: string;
      visitId: string;
      formId: string;
      fieldId: string;
      fieldName?: string;
      role: EdcUserRole;
      timestamp?: string;
    }
  | {
      type: "SAVE_FORM";
      subjectId: string;
      visitId: string;
      formId: string;
      role: EdcUserRole;
      timestamp?: string;
    }
  | {
      type: "ENROLL_SUBJECT";
      subjectId: string;
      role?: EdcUserRole;
    }
  | {
      type: "LOCK_FORM";
      subjectId: string;
      visitId: string;
      formId: string;
      role: EdcUserRole;
      timestamp?: string;
      signatureId?: string;
      digest?: string;
    }
  | {
      type: "UNLOCK_FORM";
      subjectId: string;
      visitId: string;
      formId: string;
      role: EdcUserRole;
      reasonForChange: string;
      timestamp?: string;
    }
  | {
      type: "RAISE_QUERY";
      input: RaiseEdcQueryInput;
    }
  | {
      type: "ANSWER_QUERY";
      input: AnswerEdcQueryInput;
    }
  | {
      type: "CLOSE_QUERY";
      input: CloseEdcQueryInput;
    }
  | {
      type: "CANCEL_QUERY";
      input: CancelEdcQueryInput;
    }
  | {
      type: "REOPEN_QUERY";
      input: ReopenEdcQueryInput;
    }
  | {
      type: "REPLACE_SIMULATION_STATE";
      simulationState: EdcSimulationState;
    };

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
  | "edc" // Live EDC simulation (Part 11-style workflow)
  | "acrf" // Annotated CRF Preview & Overlay
  | "export"; // ODM-XML, JSON, FHIR & Define-XML Export

export type DeviceViewport = "desktop" | "tablet" | "mobile";

export type StudioTheme = "dark" | "light";

/**
 * Lineage of one personal-library block inside a study (#681): which entry
 * and version it came from, and how the library's identities map onto the
 * study's, so a later version can be compared three ways.
 */
export interface StudyLibraryUse {
  id: string;
  entryId: string;
  entryName: string;
  /** The library version the study's copy is currently based on. */
  entryVersion: number;
  /** When the block was first inserted. Kept unchanged across upgrades. */
  insertedAt: string;
  formId: string;
  /** The study section holding the block. */
  sectionId: string;
  /** Library identity to study identity, for the section, fields and rules. */
  idMap: Record<string, string>;
  /**
   * Library variable name to study variable name, for names the study took
   * from the library. A name the author customized has no entry.
   */
  variableMap: Record<string, string>;
  /** Earlier upgrades, oldest first. */
  upgradeHistory?: StudyLibraryUpgradeRecord[];
}

/** Provenance of one applied personal-library upgrade (#681). */
export interface StudyLibraryUpgradeRecord {
  fromVersion: number;
  toVersion: number;
  appliedAt: string;
  /** Lineage maps before the upgrade, so the earlier state stays explainable. */
  previousIdMap: Record<string, string>;
  previousVariableMap: Record<string, string>;
  /** The author's choice for every conflict, by change id. */
  resolutions: Record<string, "current" | "incoming">;
  incomingChangeCount: number;
  localCustomizationCount: number;
  conflictCount: number;
}

/**
 * Historical lineage and provenance tracking for studies restored from baselines or external sources.
 */
export interface StudyProvenance {
  derivedFromBaselineId?: string;
  derivedFromVersionTag?: string;
  restoredAt?: string;
  restoredBy?: string;
  notes?: string;
  sourceFormat?: string;
  sourceVersion?: string;
  importedAt?: string;
  importedBy?: string;
  timestamp?: string;
  author?: string;
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
