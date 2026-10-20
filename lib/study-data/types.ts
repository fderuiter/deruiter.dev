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
  /** NCI code of the controlled terminology codelist, for example `C66731`. */
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
  /** Natural key variables, in sort order. */
  readonly keys: readonly string[];
  /** Variable metadata, in dataset column order. */
  readonly variables: readonly VariableMeta[];
  /** One array of values per variable name, each `rowCount` long. */
  readonly columns: Readonly<Record<string, readonly CellValue[]>>;
  /** Number of records. */
  readonly rowCount: number;
}

/**
 * The study the pipeline runs: an identifier, a title and the USDM v4.0
 * document that defines the schedule, arms, visits and endpoints.
 */
export interface StudyDefinition {
  /** Study identifier, for example `DEMO-301`. */
  readonly studyId: string;
  /** Protocol title. */
  readonly title: string;
  /** The USDM v4.0 study document, read through the USDM adapter. */
  readonly usdm: unknown;
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
  /** Reproducibility manifest. */
  readonly manifest: RunManifest;
}
