/**
 * Study Data Pipeline: public type contracts.
 *
 * One study definition flows through seeded synthetic collection, SDTM
 * tabulation, conformance, ADaM analysis datasets, Define-XML metadata and
 * ARS-linked outputs (ADR 0065). Every layer shares the column-oriented
 * table shape below, so each serialiser reads one structure.
 */

/** A standard whose version the pipeline pins and declares. */
export type StandardId =
  | "USDM"
  | "SDTM"
  | "SDTMIG"
  | "ADaM"
  | "ADaMIG"
  | "Define-XML"
  | "Dataset-JSON"
  | "ARS"
  | "NCI-EVS-CT";

/** The pinned version of every standard the pipeline applies. */
export type StandardVersions = Readonly<Record<StandardId, string>>;

/** A pipeline stage, in the order a run executes them. */
export type PipelineStageId =
  | "usdm"
  | "synth"
  | "sdtm"
  | "conformance"
  | "adam"
  | "define"
  | "export"
  | "tlf"
  | "lineage";

/** Display metadata for one pipeline stage. */
export interface PipelineStage {
  /** Stable stage id. */
  readonly id: PipelineStageId;
  /** Short label for the stage rail. */
  readonly label: string;
  /** One sentence on what the stage produces. */
  readonly summary: string;
}

/** The layer a dataset belongs to. Layers never write into each other. */
export type DataLayer = "collected" | "sdtm" | "adam";

/** Define-XML 2.1 data types the pipeline emits. */
export type VariableDataType =
  "text" | "integer" | "float" | "date" | "datetime" | "time";

/** Define-XML 2.1 origin types. */
export type VariableOrigin =
  | "Collected"
  | "Derived"
  | "Assigned"
  | "Protocol"
  | "Predecessor"
  | "Not Available";

/** SDTM variable roles. ADaM variables carry no role. */
export type VariableRole =
  | "Identifier"
  | "Topic"
  | "Timing"
  | "Grouping Qualifier"
  | "Result Qualifier"
  | "Synonym Qualifier"
  | "Record Qualifier"
  | "Variable Qualifier"
  | "Rule";

/** Metadata attached to one variable (one column) of a dataset. */
export interface VariableMeta {
  /** Variable name, for example `USUBJID` or `AVAL`. */
  readonly name: string;
  /** Variable label, at most 40 characters for XPT v5. */
  readonly label: string;
  /** Data type as Define-XML declares it. */
  readonly type: VariableDataType;
  /** Maximum length for text variables. */
  readonly length?: number;
  /** SDTM role. Omitted for ADaM and collected data. */
  readonly role?: VariableRole;
  /** Where the value comes from. */
  readonly origin: VariableOrigin;
  /**
   * Id of the codelist in the pipeline's local terminology subset, for
   * example `NY` (CDISC CT, NCI code C66742) or a sponsor-defined list such
   * as `AEREL`. The codelist entry carries the NCI code; see
   * `CONTROLLED_TERMINOLOGY`.
   */
  readonly codelist?: string;
  /** Derivation method id, required when the origin is Derived. */
  readonly method?: string;
  /** Source dataset and variable, required when the origin is Predecessor. */
  readonly source?: string;
}

/** One cell value. Missing values are `null`, never empty strings or NaN. */
export type CellValue = string | number | null;

/** A column-oriented table with its variable metadata attached. */
export interface Dataset {
  /** Dataset name, for example `DM`, `SUPPDM` or `ADSL`. */
  readonly name: string;
  /** Dataset label. */
  readonly label: string;
  /** The layer the dataset belongs to. */
  readonly layer: DataLayer;
  /** Observation class or ADaM class, for example `Events` or `BDS`. */
  readonly class: string;
  /** ADaM subclass, for example `TIME-TO-EVENT` for an ADTTE BDS dataset. */
  readonly subClass?: string;
  /**
   * What one record represents, for example `One record per subject`. The
   * pipeline sets it on every SDTM and ADaM dataset; Define-XML requires it.
   */
  readonly structure?: string;
  /** Natural key variables, in sort order. */
  readonly keys: readonly string[];
  /** Variable metadata, in dataset column order. */
  readonly variables: readonly VariableMeta[];
  /** One array of values per variable name, each `rowCount` long. */
  readonly columns: Readonly<Record<string, readonly CellValue[]>>;
  /** Number of records. */
  readonly rowCount: number;
  /** Source record ids for each row, outside SDTM submission columns. */
  readonly lineage?: readonly (readonly string[])[];
}

/** A coded value as USDM carries it: an NCI EVS code and its decode. */
export interface CodedValue {
  /** The code, for example `C174268`. */
  readonly code: string;
  /** The human-readable decode, for example `Placebo Comparator Arm`. */
  readonly decode: string;
}

/** One protocol arm (one SDTM `ARMCD`). */
export interface ArmDefinition {
  /** USDM arm id. */
  readonly id: string;
  /** Short arm code, up to 20 characters (`ARMCD`). */
  readonly armCode: string;
  /** Arm name (`ARM`). */
  readonly name: string;
  /** Arm description. */
  readonly description: string;
  /** Arm type from controlled terminology. */
  readonly type: CodedValue;
}

/** One epoch of the trial design (`EPOCH`). */
export interface EpochDefinition {
  /** USDM epoch id. */
  readonly id: string;
  /** Epoch name, for example `TREATMENT`. */
  readonly name: string;
  /** Epoch type from controlled terminology. */
  readonly type: CodedValue;
  /** One-based position in the epoch sequence. */
  readonly order: number;
}

/** One element of the trial design (an SDTM TE record). */
export interface ElementDefinition {
  /** USDM element id. */
  readonly id: string;
  /** Short element code (`ETCD`). */
  readonly elementCode: string;
  /** Element name (`ELEMENT`). */
  readonly name: string;
  /** Element description. */
  readonly description: string;
}

/** The element an arm passes through in one epoch (a USDM study cell). */
export interface StudyCellDefinition {
  /** Arm id. */
  readonly armId: string;
  /** Epoch id. */
  readonly epochId: string;
  /** Element ids, in order. */
  readonly elementIds: readonly string[];
}

/** One planned visit (one SDTM `VISITNUM`), from a USDM encounter and its timing. */
export interface VisitDefinition {
  /** USDM encounter id. */
  readonly id: string;
  /** Visit number (`VISITNUM`), one-based in schedule order. */
  readonly visitNum: number;
  /** Visit name (`VISIT`), for example `WEEK 12`. */
  readonly name: string;
  /** Epoch the visit belongs to. */
  readonly epochId: string;
  /** Planned study day (`VISITDY`). There is no Day 0. */
  readonly targetDay: number;
  /** Days the visit may fall before `targetDay`. */
  readonly windowBefore: number;
  /** Days the visit may fall after `targetDay`. */
  readonly windowAfter: number;
}

/** One measurement an activity collects, from a USDM biomedical concept. */
export interface AssessmentDefinition {
  /** USDM biomedical concept id. */
  readonly conceptId: string;
  /** NCI EVS code of the concept, for example `C25298`. */
  readonly nciCode: string;
  /** Test short name (`--TESTCD`), for example `SYSBP`. */
  readonly testCode: string;
  /** Test name (`--TEST`), for example `Systolic Blood Pressure`. */
  readonly testName: string;
  /** Standard result unit (`--STRESU`), when the test has one. */
  readonly unit?: string;
}

/** One activity in the schedule of activities. */
export interface ActivityDefinition {
  /** USDM activity id. */
  readonly id: string;
  /** Activity name. */
  readonly name: string;
  /** SDTM domain the activity's data is tabulated in, for example `VS`. */
  readonly domain: string;
  /** Measurements the activity collects, empty for event and intervention domains. */
  readonly assessments: readonly AssessmentDefinition[];
}

/** One cell of the schedule of activities: an activity planned at a visit. */
export interface ScheduledActivity {
  /** Visit id. */
  readonly visitId: string;
  /** Activity id. */
  readonly activityId: string;
}

/** A protocol eligibility criterion used by the TI trial-design domain. */
export interface EligibilityCriterionDefinition {
  /** USDM criterion id. */
  readonly id: string;
  /** Inclusion or exclusion criterion identifier. */
  readonly identifier: string;
  /** INCLUSION or EXCLUSION. */
  readonly category: "INCLUSION" | "EXCLUSION";
  /** Exact protocol criterion text. */
  readonly text: string;
}

/** One endpoint of an objective. */
export interface EndpointDefinition {
  /** USDM endpoint id. */
  readonly id: string;
  /** Endpoint name. */
  readonly name: string;
  /** Endpoint text, as written in the protocol. */
  readonly text: string;
  /** Level from controlled terminology (primary, secondary, ...). */
  readonly level: CodedValue;
  /** Purpose, for example `Efficacy` or `Safety`. */
  readonly purpose: string;
}

/** One study objective with its endpoints. */
export interface ObjectiveDefinition {
  /** USDM objective id. */
  readonly id: string;
  /** Objective name. */
  readonly name: string;
  /** Objective text. */
  readonly text: string;
  /** Level from controlled terminology. */
  readonly level: CodedValue;
  /** Endpoints that measure the objective. */
  readonly endpoints: readonly EndpointDefinition[];
}

/** An intercurrent event and the ICH E9(R1) strategy that handles it. */
export interface IntercurrentEventDefinition {
  /** Event name. */
  readonly name: string;
  /** Event description. */
  readonly text: string;
  /** Strategy, for example `Treatment policy` or `Hypothetical`. */
  readonly strategy: string;
}

/** An ICH E9(R1) estimand. */
export interface EstimandDefinition {
  /** USDM estimand id. */
  readonly id: string;
  /** Estimand name. */
  readonly name: string;
  /** Endpoint id the estimand's variable of interest is. */
  readonly endpointId: string;
  /** Analysis population id. */
  readonly analysisPopulationId: string;
  /** Population-level summary, for example a difference in means. */
  readonly populationSummary: string;
  /** Intercurrent events and their strategies. */
  readonly intercurrentEvents: readonly IntercurrentEventDefinition[];
}

/** A named analysis population. */
export interface AnalysisPopulationDefinition {
  /** USDM analysis population id. */
  readonly id: string;
  /** Population name, for example `Full Analysis Set`. */
  readonly name: string;
  /** Defining text. */
  readonly text: string;
}

/** The study design the pipeline reads from the USDM document. */
export interface StudyDesignDefinition {
  /** Trial phase decode, for example `Phase III Trial`. */
  readonly phase: string;
  /** Trial phase NCI EVS code. */
  readonly phaseCode: string;
  /** Intervention model decode, for example `Parallel Study`. */
  readonly model: string;
  /** Intervention model NCI EVS code. */
  readonly modelCode: string;
  /** Blinding decode, for example `Double Blind Study`. */
  readonly blinding: string;
  /** Blinding NCI EVS code. */
  readonly blindingCode: string;
  /** Planned number of subjects. */
  readonly plannedEnrollment: number;
  /** Arms, in protocol order. */
  readonly arms: readonly ArmDefinition[];
  /** Epochs, in sequence. */
  readonly epochs: readonly EpochDefinition[];
  /** Trial design elements. */
  readonly elements: readonly ElementDefinition[];
  /** Arm by epoch study cells. */
  readonly cells: readonly StudyCellDefinition[];
  /** Planned visits, in schedule order. */
  readonly visits: readonly VisitDefinition[];
  /** Activities, in protocol order. */
  readonly activities: readonly ActivityDefinition[];
  /** Schedule of activities: which activity is planned at which visit. */
  readonly schedule: readonly ScheduledActivity[];
  /** Inclusion and exclusion criteria, in protocol order. */
  readonly eligibilityCriteria: readonly EligibilityCriterionDefinition[];
  /** Objectives and their endpoints. */
  readonly objectives: readonly ObjectiveDefinition[];
  /** Estimands. */
  readonly estimands: readonly EstimandDefinition[];
  /** Analysis populations. */
  readonly analysisPopulations: readonly AnalysisPopulationDefinition[];
}

/**
 * The study the pipeline runs: an identifier, a title, the USDM v4.0
 * document that defines it, and the design read from that document.
 */
export interface StudyDefinition {
  /** Study identifier, for example `DEMO-301`. */
  readonly studyId: string;
  /** Protocol title. */
  readonly title: string;
  /** The USDM v4.0 study document the definition was read from. */
  readonly usdm: unknown;
  /** Arms, visits, schedule of activities and endpoints, read from `usdm`. */
  readonly design: StudyDesignDefinition;
}

/** Inputs that, with the study definition, fully determine a run. */
export interface PipelineOptions {
  /** PRNG seed, a non-negative 32-bit integer. */
  readonly seed: number;
  /** Number of synthetic subjects to generate. */
  readonly nSubjects: number;
}

/** Severity of a conformance finding. */
export type FindingSeverity = "error" | "warning" | "notice";

/** One conformance finding, citing the published rule it models. */
export interface Finding {
  /** Stable rule id, for example `SD0002`. */
  readonly ruleId: string;
  /** Finding severity. */
  readonly severity: FindingSeverity;
  /** Layer the finding was raised in. */
  readonly layer: DataLayer;
  /** Dataset name, when the finding concerns one dataset. */
  readonly dataset?: string;
  /** Variable name, when the finding concerns one variable. */
  readonly variable?: string;
  /** Zero-based row index, when the finding concerns one record. */
  readonly row?: number;
  /** Plain-language explanation. */
  readonly message: string;
  /** Citation of the published rule or guide section the rule models. */
  readonly citation?: string;
}

/** Outcome of one identifiable, versioned conformance rule on one dataset. */
export interface ConformanceRuleResult {
  readonly ruleId: string;
  readonly dataset: string;
  readonly status: "pass" | "warning" | "error";
  readonly findingCount: number;
  readonly citation: string;
}

/** Rule outcome counts for one domain. */
export interface ConformanceDomainSummary {
  readonly dataset: string;
  readonly pass: number;
  readonly warning: number;
  readonly error: number;
}

/** Explicit pipeline gate status and a pointer to the full CORE rule set. */
export interface ConformanceReport {
  readonly status: "pass" | "warning" | "failed";
  readonly rulesVersion: string;
  readonly terminologyVersion: string;
  readonly scopeNotice: string;
  readonly coreUrl: string;
  readonly domains: readonly ConformanceDomainSummary[];
  readonly ruleResults: readonly ConformanceRuleResult[];
}

/** One output file recorded in the run manifest. */
export interface ManifestEntry {
  /** Package-relative path, for example `m5/datasets/tabulations/sdtm/dm.json`. */
  readonly path: string;
  /** Media type of the file. */
  readonly mediaType: string;
  /** Lowercase hex SHA-256 of the file bytes. */
  readonly sha256: string;
}

/**
 * Everything needed to reproduce a run. It holds no timestamps, so the same
 * definition, seed and subject count give byte-identical manifests.
 */
export interface RunManifest {
  /** Study identifier. */
  readonly studyId: string;
  /** PRNG seed. */
  readonly seed: number;
  /** Number of synthetic subjects. */
  readonly nSubjects: number;
  /** Pinned standard versions. */
  readonly standards: StandardVersions;
  /** Stages the run executed, in order. */
  readonly stages: readonly PipelineStageId[];
  /** Hashed output files. */
  readonly outputs: readonly ManifestEntry[];
}

/** The result of one pipeline run. */
export interface PipelineRun {
  /** Datasets produced, across all layers. */
  readonly datasets: readonly Dataset[];
  /** Conformance findings, across all layers. */
  readonly findings: readonly Finding[];
  /** Dataset-level conformance gate result. */
  readonly conformance: ConformanceReport;
  /** Reproducibility manifest. */
  readonly manifest: RunManifest;
}
