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
  | "OCCDS"
  | "ADaM-CR"
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
  /**
   * Set when SDTMIG marks the variable Core "Req" in its domain: it is
   * never null, and Define-XML writes it as mandatory.
   */
  readonly required?: true;
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
  /** Category (`--CAT`), for example the questionnaire a QS score belongs to. */
  readonly category?: string;
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

/**
 * A stratification factor declared for randomisation: the factor, the ADSL
 * variable its randomised value is analysed as, and its levels.
 */
export interface StratificationFactorDefinition {
  /** The factor, for example `Surgical risk (STS-PROM)`. */
  readonly factor: string;
  /** The ADSL variable for the stratum at randomisation, for example `STRAT1R`. */
  readonly adslVariable: string;
  /** The levels, in protocol order. */
  readonly levels: readonly string[];
}

/**
 * How subjects are randomised, read from the study's randomisation extension
 * (`https://deruiter.dev/usdm/extensions/randomisation`).
 */
export interface RandomisationDefinition {
  /** Allocation ratio by USDM arm id: positive whole numbers, one per arm. */
  readonly ratio: Readonly<Record<string, number>>;
  /** The method as the protocol names it, for example `Permuted blocks within strata`. */
  readonly method: string;
  /** Stratification factors, in protocol order; empty when unstratified. */
  readonly strata: readonly StratificationFactorDefinition[];
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
  /**
   * Type of the experimental intervention, coded in Intervention Type
   * Response (C99078), for example `C1909`. Empty when the study names none.
   */
  readonly interventionType: CodedValue;
  /**
   * MED-RT Established Pharmacologic Class of the investigational product,
   * with the MED-RT release it was taken from. Null when the study names no
   * investigational product with a class.
   */
  readonly pharmacologicClass:
    (CodedValue & { readonly version: string }) | null;
  /**
   * Dose form of the investigational product, for example `C42998` Tablet
   * Dosage Form. Null when the study names no investigational product.
   */
  readonly doseForm: CodedValue | null;
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
  /**
   * Randomisation ratio and strata, when the study declares them. Absent, the
   * generator allocates subjects to the arms in equal shares.
   */
  readonly randomisation?: RandomisationDefinition;
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
/** The id of a scenario in `MESSY_DATA_SCENARIOS`. */
export type ScenarioId =
  | "impossible-date"
  | "partial-end-date"
  | "ae-before-first-dose"
  | "missing-baseline"
  | "no-post-baseline"
  | "off-codelist-extensible"
  | "off-codelist-non-extensible"
  | "duplicate-record"
  | "unit-change"
  | "lab-retest-same-day"
  | "unscheduled-visit-in-window"
  | "rescreened-subject"
  | "death-during-treatment"
  | "withdrawal-before-week-12"
  | "randomized-not-dosed"
  | "unplanned-treatment"
  | "qtcf-outlier"
  | "ecg-missing-rr";

/** What a scenario expects of the pipeline, declared as data. */
export interface ScenarioExpectation {
  /**
   * Rule ids that must report at least one finding on the target subject.
   * No other rule may report a finding on that subject that it did not
   * report before the scenario was applied.
   */
  readonly findings: readonly string[];
  /** The derivation behaviour the scenario checks, in words. */
  readonly derivation: string;
}

/** One messy-data scenario, as the page and the tests list it. */
export interface MessyDataScenario {
  readonly id: ScenarioId;
  readonly title: string;
  /** What is done to the collected records. */
  readonly description: string;
  readonly expected: ScenarioExpectation;
}

/** A scenario applied to a run, and the subject it changed. */
export interface AppliedScenario {
  readonly id: ScenarioId;
  /** The changed subject, or null when no subject was eligible. */
  readonly subject: string | null;
}

export interface PipelineOptions {
  /** PRNG seed, a non-negative 32-bit integer. */
  readonly seed: number;
  /** Number of synthetic subjects to generate. */
  readonly nSubjects: number;
  /**
   * Messy-data scenarios to layer onto the collected data (#2605). Omitted
   * or empty, the run is exactly the generated study.
   */
  readonly scenarios?: readonly ScenarioId[];
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
  /** The scenarios applied, present only when the run asked for some. */
  readonly scenarios?: readonly AppliedScenario[];
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

// ---------------------------------------------------------------------------
// Analysis results: the ARS 1.0 metadata model, with lineage extensions (#2593, #3025)
// ---------------------------------------------------------------------------

/** Summary statistics of one set of values, from `descriptiveStatistics`. */
export interface DescriptiveStatistics {
  /** Number of values. */
  readonly n: number;
  /** Decimals the values were recorded with. */
  readonly rawDecimals: number;
  /** Arithmetic mean, `null` when there are no values. */
  readonly mean: number | null;
  /** Sample SD with the n - 1 denominator, `null` for fewer than two values. */
  readonly sd: number | null;
  /** Median; the mean of the two middle values for an even count. */
  readonly median: number | null;
  /** Smallest value. */
  readonly min: number | null;
  /** Largest value. */
  readonly max: number | null;
}

/** A comparator, as ARS 1.0 names them. */
export type ArsComparator =
  "EQ" | "NE" | "GT" | "GE" | "LT" | "LE" | "IN" | "NOTIN";

/**
 * One condition, `dataset.variable comparator value`. Dataset and variable
 * names are the ones the Dataset-JSON files and `itemOid` use.
 */
export interface ArsCondition {
  /** Dataset name, for example `ADSL`. */
  readonly dataset: string;
  /** Variable name, for example `SAFFL`. */
  readonly variable: string;
  /** How the variable is compared. */
  readonly comparator: ArsComparator;
  /**
   * Values to compare against, as text. A numeric variable compares
   * numerically. A missing value matches only `NE` and `NOTIN`.
   */
  readonly value: readonly string[];
}

/** A where clause that holds one condition. */
export interface ArsConditionClause {
  /** The condition. */
  readonly condition: ArsCondition;
}

/** A where clause that combines other where clauses. */
export interface ArsCompoundClause {
  /** The combination. */
  readonly compoundExpression: ArsCompoundExpression;
}

/** A where clause: one condition, or a compound expression. */
export type ArsWhereClause = ArsConditionClause | ArsCompoundClause;

/**
 * A where clause inside a compound expression, with its position: `level`
 * is one more than the level of the clause that holds it, and `order` its
 * place among its siblings, from 1. ARS 1.0 requires both.
 */
export type ArsNestedWhereClause = ArsWhereClause & {
  /** Nesting level: 2 under a top-level entity, 3 below that. */
  readonly level: number;
  /** Position among its siblings, from 1. */
  readonly order: number;
};

/** Where clauses joined by AND or OR, or one negated by NOT. */
export interface ArsCompoundExpression {
  /** The logical operator. NOT takes exactly one clause. */
  readonly logicalOperator: "AND" | "OR" | "NOT";
  /** The clauses it joins, in order. */
  readonly whereClauses: readonly ArsNestedWhereClause[];
}

/** Identity and position shared by analysis sets, groups and data subsets. */
export interface ArsOrderedEntity {
  /** Stable id, for example `AnalysisSet_SAF`. */
  readonly id: string;
  /** Short name. */
  readonly name: string;
  /** Label for displays. */
  readonly label: string;
  /** Nesting level, 1 for top level. */
  readonly level: number;
  /** Position among its siblings, from 1. */
  readonly order: number;
}

/** A population of subjects, defined on ADSL. */
export type ArsAnalysisSet = ArsOrderedEntity & ArsWhereClause;

/** One pre-specified group of a grouping factor. */
export type ArsGroup = ArsOrderedEntity & ArsWhereClause;

/** A subset of an analysis dataset's records. */
export type ArsDataSubset = ArsOrderedEntity & ArsWhereClause;

/**
 * A factor results are grouped by, such as treatment or system organ class.
 * A data-driven factor has no pre-specified groups: results carry the
 * observed value as `groupValue` instead of a `groupId`.
 */
export interface ArsGroupingFactor {
  /** Stable id, for example `AnlsGrouping_TRT01A`. */
  readonly id: string;
  /** Short name. */
  readonly name: string;
  /** Label for displays. */
  readonly label: string;
  /** Dataset the grouping variable is read from. */
  readonly groupingDataset: string;
  /** The grouping variable. */
  readonly groupingVariable: string;
  /** Whether groups come from the observed values. */
  readonly dataDriven: boolean;
  /** Pre-specified groups, in display order; empty when data-driven. */
  readonly groups: readonly ArsGroup[];
}

/** A term from ARS controlled terminology, such as a role or a reason. */
export interface ArsTerm {
  /** The term, for example `DENOMINATOR`. */
  readonly controlledTerm: string;
}

/**
 * A sponsor-defined term, used where ARS terminology is extensible and no
 * controlled term fits. It refers to an entry of the reporting event's
 * `terminologyExtensions`.
 */
export interface ArsSponsorTermRef {
  /** The id of the sponsor term. */
  readonly sponsorTermId: string;
}

/** A value of an extensible ARS enumeration: a controlled or a sponsor term. */
export type ArsExtensibleTerm = ArsTerm | ArsSponsorTermRef;

/** One sponsor-defined term added to an extensible ARS enumeration. */
export interface ArsSponsorTerm {
  /** Stable id, for example `SponsorTerm_Purpose_BASELINE`. */
  readonly id: string;
  /** The value, for example `BASELINE CHARACTERISTICS`. */
  readonly submissionValue: string;
  /** What the term means. */
  readonly description: string;
}

/** The sponsor terms added to one extensible ARS enumeration. */
export interface ArsTerminologyExtension {
  /** Stable id, for example `TermExt_AnalysisPurpose`. */
  readonly id: string;
  /** The enumeration extended. */
  readonly enumeration:
    | "AnalysisReasonEnum"
    | "AnalysisPurposeEnum"
    | "OperationRoleEnum"
    | "OutputFileTypeEnum";
  /** The terms added. */
  readonly sponsorTerms: readonly ArsSponsorTerm[];
}

/** A link from one operation to another whose result it uses. */
export interface ArsOperationRelationship {
  /** Stable id, referenced by an analysis. */
  readonly id: string;
  /** `NUMERATOR` or `DENOMINATOR`. */
  readonly referencedOperationRole: ArsTerm;
  /** The operation whose result is used. */
  readonly operationId: string;
  /** What the relationship means. */
  readonly description: string;
}

/** One operation of a method, which produces one result per group. */
export interface ArsOperation {
  /** Stable id, for example `Mth_Summ_Mean`. */
  readonly id: string;
  /** Short name, for example `Mean`. */
  readonly name: string;
  /** Label, including the display precision rule. */
  readonly label: string;
  /** Position within the method, from 1. */
  readonly order: number;
  /** Display pattern, for example `XX` or `(XX.X)`, when it does not depend on the data. */
  readonly resultPattern?: string;
  /** Operations of other analyses whose results this one uses. */
  readonly referencedOperationRelationships?: readonly ArsOperationRelationship[];
}

/** A statistical method: a named, ordered list of operations. */
export interface ArsAnalysisMethod {
  /** Stable id, for example `Mth_Summ`. */
  readonly id: string;
  /** Short name. */
  readonly name: string;
  /** Label for displays. */
  readonly label: string;
  /** What the method computes, in words. */
  readonly description: string;
  /** Operations, in order. */
  readonly operations: readonly ArsOperation[];
}

/** One grouping factor applied by an analysis, in order. */
export interface ArsOrderedGrouping {
  /** Position, from 1. */
  readonly order: number;
  /** The grouping factor. */
  readonly groupingId: string;
  /** Whether a result is produced for each group. */
  readonly resultsByGroup: boolean;
}

/** Which analysis supplies the operation a relationship refers to. */
export interface ArsReferencedAnalysisOperation {
  /** The operation relationship. */
  readonly referencedOperationRelationshipId: string;
  /** The analysis whose result is used. */
  readonly analysisId: string;
}

/** The group a result belongs to, for one grouping factor. */
export interface ArsResultGroup {
  /** The grouping factor. */
  readonly groupingId: string;
  /** The pre-specified group, when the factor is not data-driven. */
  readonly groupId?: string;
  /** The observed value, when the factor is data-driven. */
  readonly groupValue?: string;
}

/**
 * Why a set of ADaM rows is linked to a result: `population` rows are the
 * ADSL records of the subjects in the analysis set and group (the
 * denominator), `analysis` rows the records counted or summarised.
 */
export type ArsRowRole = "population" | "analysis";

/**
 * A deduplicated set of ADaM rows that results refer to. Row ids are built
 * by `adamRowId`: the dataset name and the values of its key variables
 * other than `STUDYID`, for example `ADVS:DEMO-301-0001:5`.
 *
 * A set holds its own `rowIds` and every row of the sets it `includes`.
 * Nested sets, such as the Kaplan-Meier risk sets, use this so each row is
 * listed once rather than once per set it belongs to.
 */
export interface ArsRowSet {
  /** Stable id, for example `RowSet_0001`. */
  readonly id: string;
  /** Dataset the rows belong to. */
  readonly dataset: string;
  /** Row ids the set lists itself, in dataset order; may be empty. */
  readonly rowIds: readonly string[];
  /**
   * Row sets of the same dataset whose rows this set also holds. Each one
   * is listed before this set, so inclusion never forms a cycle.
   */
  readonly includes?: readonly string[];
}

/** A link from a result to a set of ADaM rows. */
export interface ArsRowReference {
  /** Why the rows are linked. */
  readonly role: ArsRowRole;
  /** The row set. */
  readonly rowSetId: string;
}

/**
 * One result: the value of one operation for one combination of groups.
 * `id` and `rowReferences` extend the ARS 1.0 class, so a displayed cell
 * can name its results and each result the rows that produced it. The ARS
 * file leaves them out; the result lineage file carries them.
 */
export interface ArsOperationResult {
  /** Stable id, for example `An_14_1_1_AGE.004`. */
  readonly id: string;
  /** The operation that produced it. */
  readonly operationId: string;
  /** The groups it belongs to, one per grouping with results by group. */
  readonly resultGroups: readonly ArsResultGroup[];
  /** The unrounded value as text; absent when not estimable. */
  readonly rawValue?: string;
  /** The value as displayed, `NE` when not estimable. */
  readonly formattedValue: string;
  /** The ADaM rows the value was computed from. */
  readonly rowReferences: readonly ArsRowReference[];
}

/** One analysis: a method applied to a variable for an analysis set. */
export interface ArsAnalysis {
  /** Stable id, for example `An_14_1_1_AGE`. */
  readonly id: string;
  /** Short description. */
  readonly name: string;
  /** Version, from 1. */
  readonly version: number;
  /** Why the analysis is performed, for example `SPECIFIED IN SAP`. */
  readonly reason: ArsTerm;
  /**
   * What the analysis is for: an outcome measure, or a sponsor term for a
   * descriptive analysis that measures no endpoint.
   */
  readonly purpose: ArsExtensibleTerm;
  /** The analysis dataset. */
  readonly dataset: string;
  /** The analysis variable. */
  readonly variable: string;
  /** The population. */
  readonly analysisSetId: string;
  /** The record subset, when there is one. */
  readonly dataSubsetId?: string;
  /** The method. */
  readonly methodId: string;
  /** Grouping factors, in order. */
  readonly orderedGroupings: readonly ArsOrderedGrouping[];
  /** Where the results of related operations come from. */
  readonly referencedAnalysisOperations?: readonly ArsReferencedAnalysisOperation[];
  /**
   * Decimals the summarised data is recorded with, which set the display
   * precision. Present for descriptive summaries only. It extends the ARS
   * 1.0 class, so the ARS file leaves it out and the result lineage file
   * carries it.
   */
  readonly rawDecimals?: number;
  /** The results, one per operation and group combination. */
  readonly results: readonly ArsOperationResult[];
}

/** An ARS display section type. */
export type ArsDisplaySectionType =
  | "Title"
  | "Footnote"
  | "Rowlabel Header"
  | "Header"
  | "Abbreviation"
  | "Legend"
  | "Body";

/** One piece of text in a display section. */
export interface ArsDisplaySubSection {
  /** Stable id. */
  readonly id: string;
  /** The text. */
  readonly text: string;
}

/** A display sub-section in order. */
export interface ArsOrderedDisplaySubSection {
  /** Position, from 1. */
  readonly order: number;
  /** The sub-section. */
  readonly subSection: ArsDisplaySubSection;
}

/** A section of a display, such as its titles or footnotes. */
export interface ArsDisplaySection {
  /** The section type. */
  readonly sectionType: ArsDisplaySectionType;
  /** Its text, in order. */
  readonly orderedSubSections: readonly ArsOrderedDisplaySubSection[];
}

/** One display (one table) of an output. */
export interface ArsOutputDisplay {
  /** Stable id, for example `Disp_14_1_1`. */
  readonly id: string;
  /** Short name. */
  readonly name: string;
  /** Version, from 1. */
  readonly version: number;
  /** The title as displayed. */
  readonly displayTitle: string;
  /** Titles, headers and footnotes. */
  readonly displaySections: readonly ArsDisplaySection[];
}

/** A display in order. */
export interface ArsOrderedDisplay {
  /** Position, from 1. */
  readonly order: number;
  /** The display. */
  readonly display: ArsOutputDisplay;
}

/** A file an output is rendered to. */
export interface ArsFileSpecification {
  /** File name. */
  readonly name: string;
  /**
   * File type: the controlled term `rtf`, or a sponsor term for `html` and
   * `svg`, which ARS 1.0 does not list.
   */
  readonly fileType: ArsExtensibleTerm;
  /** Path relative to the output folder. */
  readonly location: string;
}

/** One output: a numbered table or figure, its displays and its files. */
export interface ArsOutput {
  /** Stable id, for example `Out_14_1_1`. */
  readonly id: string;
  /** Short name, for example `Table 14.1.1`. */
  readonly name: string;
  /** Version, from 1. */
  readonly version: number;
  /** Files the output is rendered to. */
  readonly fileSpecifications: readonly ArsFileSpecification[];
  /** Displays, in order. */
  readonly displays: readonly ArsOrderedDisplay[];
}

/** One entry of the list of contents: an output with its analyses. */
export interface ArsListItem {
  /** Name shown in the list. */
  readonly name: string;
  /** Nesting level, from 1. */
  readonly level: number;
  /** Position among its siblings, from 1. */
  readonly order: number;
  /** The output, for a level 1 entry. */
  readonly outputId?: string;
  /** The analysis, for a level 2 entry. */
  readonly analysisId?: string;
  /** Nested entries. */
  readonly sublist?: { readonly listItems: readonly ArsListItem[] };
}

/**
 * The reporting event: every analysis set, grouping, data subset, method,
 * analysis and output of a run, with the results. It holds no timestamps,
 * so the same study, seed and subject count give the same JSON. `notice`,
 * `studyId`, `seed`, `nSubjects`, `standards` and `rowSets` extend the
 * ARS 1.0 class: `writeArsJson` leaves them out, so the file validates
 * against the ARS 1.0 schema, and `writeArsLineageJson` writes them.
 */
export interface ArsReportingEvent {
  /** Stable id, for example `RE_DEMO-301`. */
  readonly id: string;
  /** Short name. */
  readonly name: string;
  /** What the reporting event holds. */
  readonly description: string;
  /** Version, from 1. */
  readonly version: number;
  /** The synthetic-data notice. */
  readonly notice: string;
  /** Study identifier. */
  readonly studyId: string;
  /** PRNG seed of the run. */
  readonly seed: number;
  /** Number of screened subjects in the run. */
  readonly nSubjects: number;
  /** Pinned versions of the standards the model and data follow. */
  readonly standards: Readonly<Record<"ARS" | "ADaMIG", string>>;
  /** Sponsor terms the event uses where ARS terminology is extensible. */
  readonly terminologyExtensions: readonly ArsTerminologyExtension[];
  /** Outputs and the analyses each one displays. */
  readonly mainListOfContents: {
    readonly name: string;
    readonly contentsList: { readonly listItems: readonly ArsListItem[] };
  };
  /** Populations. */
  readonly analysisSets: readonly ArsAnalysisSet[];
  /** Grouping factors. */
  readonly analysisGroupings: readonly ArsGroupingFactor[];
  /** Record subsets. */
  readonly dataSubsets: readonly ArsDataSubset[];
  /** Methods. */
  readonly methods: readonly ArsAnalysisMethod[];
  /** Analyses, with their results. */
  readonly analyses: readonly ArsAnalysis[];
  /** Outputs. */
  readonly outputs: readonly ArsOutput[];
  /** The ADaM row sets that results refer to. */
  readonly rowSets: readonly ArsRowSet[];
}

/** Where an ADaM row id points: the dataset and the zero-based row. */
export interface AdamRowLocation {
  /** The row id. */
  readonly rowId: string;
  /** The dataset name. */
  readonly dataset: string;
  /** Zero-based row index in that dataset. */
  readonly rowIndex: number;
}

/** A result's ADaM row, with the role it plays in the result. */
export interface ResultRow extends AdamRowLocation {
  /** Why the row is linked to the result. */
  readonly role: ArsRowRole;
}

/** One displayed cell and the results it shows. */
export interface TlfCell {
  /** The text, for example `12 (35.3)`. */
  readonly text: string;
  /** Ids of the results the text is made from. */
  readonly resultIds: readonly string[];
}

/** One treatment column with its population count. */
export interface TlfColumn {
  /** Stable id, for example `col1`. */
  readonly id: string;
  /** The treatment, for example `Placebo`. */
  readonly label: string;
  /** The grouping factor of the column. */
  readonly groupingId: string;
  /** The group of the column. */
  readonly groupId: string;
  /** Subjects in the analysis set and group (N). */
  readonly bigN: number;
  /** The result that N comes from. */
  readonly bigNResultId: string;
}

/** One data row of a table. */
export interface TlfRow {
  /** Stable id within the table. */
  readonly id: string;
  /** Row label, for example `Mean` or a preferred term. */
  readonly label: string;
  /** One cell per column. */
  readonly cells: readonly TlfCell[];
}

/**
 * A block of rows under one heading. When the heading itself carries
 * results, as a system organ class does, `cells` holds them.
 */
export interface TlfSection {
  /** Stable id within the table. */
  readonly id: string;
  /** The heading, for example `Age (years)`. */
  readonly label: string;
  /** One cell per column when the heading has results, otherwise absent. */
  readonly cells?: readonly TlfCell[];
  /** The rows under the heading. */
  readonly rows: readonly TlfRow[];
}

/**
 * A table as a render model, which the HTML and RTF writers read and a page
 * can render directly.
 */
export interface TlfTable {
  /** The ARS output. */
  readonly outputId: string;
  /** The ARS display. */
  readonly displayId: string;
  /** Table number, for example `14.1.1`. */
  readonly number: string;
  /** Title. */
  readonly title: string;
  /** Population line, for example `Safety Set`. */
  readonly population: string;
  /** Header of the row-label column. */
  readonly stubHeader: string;
  /** Treatment columns, in protocol order. */
  readonly columns: readonly TlfColumn[];
  /** Row blocks, in display order. */
  readonly sections: readonly TlfSection[];
  /** Footnotes, in order. */
  readonly footnotes: readonly string[];
  /** The synthetic-data notice. */
  readonly notice: string;
  /** File name without extension, for example `t-14-1-1`. */
  readonly fileBase: string;
}

/** The analysis results of a run: the reporting event, its tables and its figures. */
export interface TlfOutputs {
  /** The ARS reporting event, with results and row sets. */
  readonly reportingEvent: ArsReportingEvent;
  /** The tables, in output order. */
  readonly tables: readonly TlfTable[];
  /** The figures, in output order. */
  readonly figures: readonly TlfKmFigure[];
}

/** One subject's time to an event or to censoring. */
export interface SurvivalObservation {
  /** Time from the start of risk, finite and not negative. */
  readonly time: number;
  /** `true` for an event, `false` for a censored time. */
  readonly event: boolean;
}

/**
 * The product-limit estimate at one observed time: the events and
 * censorings at the time and the estimate just after it.
 */
export interface KaplanMeierStep {
  /** The time. */
  readonly time: number;
  /** Subjects at risk at the time: those whose time is the same or later. */
  readonly atRisk: number;
  /** Events at the time. */
  readonly events: number;
  /** Censorings at the time. */
  readonly censored: number;
  /** The survival estimate just after the time. */
  readonly survival: number;
  /** Greenwood standard error of the estimate. */
  readonly standardError: number;
  /** Lower 95% limit (log-log), or `null` when not estimable. */
  readonly lower: number | null;
  /** Upper 95% limit (log-log), or `null` when not estimable. */
  readonly upper: number | null;
}

/** A Kaplan-Meier estimate with Greenwood standard errors. */
export interface KaplanMeierEstimate {
  /** Subjects. */
  readonly n: number;
  /** Subjects with an event. */
  readonly events: number;
  /** Subjects censored. */
  readonly censored: number;
  /** Confidence level of the limits, 0.95. */
  readonly confidenceLevel: number;
  /** Transform the limits are computed on. */
  readonly confidenceTransform: "log-log";
  /** One step per distinct observed time, in ascending order. */
  readonly steps: readonly KaplanMeierStep[];
}

/** An unstratified log-rank test across groups. */
export interface LogRankTest {
  /** Observed events per group. */
  readonly observed: readonly number[];
  /** Expected events per group under equal survival. */
  readonly expected: readonly number[];
  /** Covariance of observed minus expected, one row per group. */
  readonly covariance: readonly (readonly number[])[];
  /** Rank of the covariance: groups with information less one. */
  readonly degreesOfFreedom: number;
  /** The chi-square statistic, or `null` when not estimable. */
  readonly chiSquare: number | null;
  /** Upper-tail chi-square probability, or `null` when not estimable. */
  readonly pValue: number | null;
}

/** The kinds of outcome a component of a hierarchical composite can be. */
export type WinRatioComponentKind = "time-to-event" | "continuous" | "binary";

/**
 * One component of a hierarchical composite endpoint, compared between
 * the two members of a pair only when every component above it is a tie.
 */
export interface WinRatioComponent {
  /** Identifier, unique within the hierarchy (for example a PARAMCD). */
  readonly id: string;
  /** Label for tables. */
  readonly label: string;
  /** How the outcome is recorded and compared. */
  readonly kind: WinRatioComponentKind;
  /**
   * Which values are better. For a time to an event, `"higher"` means a
   * later event is better (death, hospitalisation) and `"lower"` means an
   * earlier event is better (time to recovery). For a binary outcome,
   * `"higher"` means 1 is better than 0.
   */
  readonly better: "higher" | "lower";
  /**
   * The smallest difference that counts as a win, in the outcome's unit,
   * finite and not negative. A difference equal to the margin is a tie.
   * Ignored for binary outcomes. Defaults to 0.
   */
  readonly margin?: number;
  /**
   * For a time to an event: the end of the comparison window. Later times
   * are censored at it. Defaults to no limit.
   */
  readonly horizon?: number;
}

/**
 * One subject's outcome on one component. For a time to an event,
 * `value` is the time to the event or to censoring and `event` says which.
 * For a continuous outcome it is the value; for a binary outcome 0 or 1.
 * `null` is a missing outcome, which ties with every other subject on that
 * component.
 */
export interface WinRatioOutcome {
  /** The value or time, or `null` when missing. */
  readonly value: number | null;
  /** For a time to an event: `true` for an event, `false` for censoring. */
  readonly event?: boolean;
}

/** One subject entering a win-ratio analysis. */
export interface WinRatioSubject {
  /** Identifier, unique within the analysis (for example USUBJID). */
  readonly id: string;
  /** Which side of the comparison the subject is on. */
  readonly group: "treatment" | "control";
  /** Stratum label; subjects are paired only within a stratum. */
  readonly stratum?: string;
  /** Outcomes, one per component, in the hierarchy's order. */
  readonly outcomes: readonly WinRatioOutcome[];
}

/**
 * How strata are combined: `"unstratified"` pools every subject into one
 * stratum, `"mantel-haenszel"` weights each stratum by the inverse of its
 * size (Dong et al. 2018), `"equal"` weights strata equally.
 */
export type WinRatioStratumWeighting =
  "unstratified" | "mantel-haenszel" | "equal";

/** Options for `winStatistics`. */
export interface WinRatioOptions {
  /** The components, most important first. */
  readonly components: readonly WinRatioComponent[];
  /** How strata are combined. Defaults to `"unstratified"`. */
  readonly weighting?: WinRatioStratumWeighting;
  /** Two-sided significance level of the limits, in (0, 1). Defaults to 0.05. */
  readonly alpha?: number;
  /** Sidedness of the p-values. Defaults to `"two-sided"`. */
  readonly sided?: "two-sided" | "one-sided";
}

/** A win statistic with its limits and test, `null` where not estimable. */
export interface WinStatisticEstimate {
  /** The point estimate. */
  readonly estimate: number | null;
  /** Lower confidence limit. */
  readonly lower: number | null;
  /** Upper confidence limit. */
  readonly upper: number | null;
  /** Standard error, of the logarithm for the win ratio and win odds. */
  readonly standardError: number | null;
  /** The z statistic against no difference. */
  readonly zStatistic: number | null;
  /** The p-value of the z statistic, with the requested sidedness. */
  readonly pValue: number | null;
}

/** Wins and losses decided on one component. */
export interface WinRatioComponentResult {
  /** The component's identifier. */
  readonly componentId: string;
  /** Pairs the treatment member won on this component. */
  readonly wins: number;
  /** Pairs the control member won on this component. */
  readonly losses: number;
  /** Pairs still tied after this component. */
  readonly tiesAfter: number;
  /** Subjects with at least one pair decided on this component, in input order. */
  readonly decidingSubjectIds: readonly string[];
}

/** Pair counts and point estimates within one stratum. */
export interface WinRatioStratumResult {
  /** The stratum label, `""` when unstratified. */
  readonly stratum: string;
  /** Treatment subjects in the stratum. */
  readonly treatmentCount: number;
  /** Control subjects in the stratum. */
  readonly controlCount: number;
  /** Treatment-control pairs. */
  readonly pairs: number;
  /** Pairs won by the treatment member. */
  readonly wins: number;
  /** Pairs won by the control member. */
  readonly losses: number;
  /** Pairs tied on every component. */
  readonly ties: number;
  /** The stratum's weight in the combined estimates. */
  readonly weight: number;
}

/** The Finkelstein-Schoenfeld rank test on the pooled pairwise scores. */
export interface FinkelsteinSchoenfeldTest {
  /** Sum over treatment subjects of their pooled scores, over strata. */
  readonly statistic: number;
  /** Permutation variance of the statistic, over strata. */
  readonly variance: number;
  /** The standardised statistic, or `null` when the variance is 0. */
  readonly zStatistic: number | null;
  /** Its p-value, with the requested sidedness, or `null`. */
  readonly pValue: number | null;
}

/** Wins, losses and ties per subject: the row or column sums of the pairs. */
export interface WinRatioSubjectResult {
  /** The subject's identifier. */
  readonly id: string;
  /** The subject's group. */
  readonly group: "treatment" | "control";
  /** Pairs in which this subject was the better member. */
  readonly wins: number;
  /** Pairs in which this subject was the worse member. */
  readonly losses: number;
  /** Pairs tied on every component. */
  readonly ties: number;
}

/** The result of `winStatistics`. */
export interface WinRatioResult {
  /** Treatment subjects. */
  readonly treatmentCount: number;
  /** Control subjects. */
  readonly controlCount: number;
  /** Treatment-control pairs compared, within strata. */
  readonly pairs: number;
  /** Pairs won by the treatment member. */
  readonly wins: number;
  /** Pairs won by the control member. */
  readonly losses: number;
  /** Pairs tied on every component. */
  readonly ties: number;
  /** Per component, in the hierarchy's order. */
  readonly components: readonly WinRatioComponentResult[];
  /** Per stratum, in order of first appearance. */
  readonly strata: readonly WinRatioStratumResult[];
  /** Per subject, in input order. */
  readonly subjects: readonly WinRatioSubjectResult[];
  /** Wins over losses. */
  readonly winRatio: WinStatisticEstimate;
  /** Wins less losses, over pairs (the win difference). */
  readonly netBenefit: WinStatisticEstimate;
  /** Wins plus half the ties, over losses plus half the ties. */
  readonly winOdds: WinStatisticEstimate;
  /** The Finkelstein-Schoenfeld test. */
  readonly finkelsteinSchoenfeld: FinkelsteinSchoenfeldTest;
  /** The settings the result was computed with. */
  readonly settings: {
    readonly weighting: WinRatioStratumWeighting;
    readonly alpha: number;
    readonly sided: "two-sided" | "one-sided";
  };
}

/** One plotted time of a Kaplan-Meier curve and the results it shows. */
export interface TlfKmPoint {
  /** The time, in days; 0 is the start of the curve. */
  readonly time: number;
  /** Subjects at risk at the time. */
  readonly atRisk: number;
  /** Events at the time. */
  readonly events: number;
  /** Censorings at the time, each marked on the curve. */
  readonly censored: number;
  /** The survival estimate just after the time. */
  readonly survival: number;
  /** Lower 95% limit, or `null` when not estimable. */
  readonly lower: number | null;
  /** Upper 95% limit, or `null` when not estimable. */
  readonly upper: number | null;
  /** The estimate as displayed. */
  readonly survivalText: string;
  /** The Greenwood standard error as displayed. */
  readonly standardErrorText: string;
  /** The 95% limits as displayed, for example `(0.6197, 0.9516)`, or `NE`. */
  readonly limitsText: string;
  /** Ids of the results the point is drawn from. */
  readonly resultIds: readonly string[];
}

/** One treatment group's Kaplan-Meier curve. */
export interface TlfKmCurve {
  /** Stable id, for example `curve1`. */
  readonly id: string;
  /** The treatment, for example `Placebo`. */
  readonly label: string;
  /** The grouping factor of the curve. */
  readonly groupingId: string;
  /** The group of the curve. */
  readonly groupId: string;
  /** Subjects in the analysis set and group (N). */
  readonly bigN: number;
  /** The result that N comes from. */
  readonly bigNResultId: string;
  /** Plotted times in ascending order, starting at 0; empty for a group with no records. */
  readonly points: readonly TlfKmPoint[];
}

/** A column of the number-at-risk table. */
export interface TlfAtRiskTime {
  /** The day, for example 15. */
  readonly time: number;
  /** Column label, for example `Day 15`. */
  readonly label: string;
}

/** A treatment group's row of the number-at-risk table. */
export interface TlfAtRiskRow {
  /** The curve the row belongs to. */
  readonly curveId: string;
  /** The treatment. */
  readonly label: string;
  /** One count per at-risk time. */
  readonly cells: readonly TlfCell[];
}

/**
 * A Kaplan-Meier figure as a render model, which the SVG and HTML writers
 * read and a page can render directly.
 */
export interface TlfKmFigure {
  /** The ARS output. */
  readonly outputId: string;
  /** The ARS display. */
  readonly displayId: string;
  /** Figure number, for example `14.2.2`. */
  readonly number: string;
  /** Title. */
  readonly title: string;
  /** Population line, for example `Safety Set`. */
  readonly population: string;
  /** Horizontal axis title. */
  readonly xLabel: string;
  /** Vertical axis title. */
  readonly yLabel: string;
  /** One curve per treatment group, in protocol order. */
  readonly curves: readonly TlfKmCurve[];
  /** Columns of the number-at-risk table, in time order. */
  readonly atRiskTimes: readonly TlfAtRiskTime[];
  /** Rows of the number-at-risk table, one per curve. */
  readonly atRisk: readonly TlfAtRiskRow[];
  /** The log-rank test line and the results it shows. */
  readonly test: TlfCell;
  /** Text alternative: what the figure shows, in words. */
  readonly summary: string;
  /** Footnotes, in order. */
  readonly footnotes: readonly string[];
  /** The synthetic-data notice. */
  readonly notice: string;
  /** File name without extension, for example `f-14-2-2`. */
  readonly fileBase: string;
}
