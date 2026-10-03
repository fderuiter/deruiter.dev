/**
 * Review package export (#680).
 *
 * Hands a reviewer one coherent archive built from one study revision: the
 * editable native source, PDF forms and change summary, CSV dictionary and
 * schedule, readable edit checks, and test and readiness reports, all
 * described by a common manifest.
 *
 * Coherence comes from taking the snapshot once. Every artifact is generated
 * from the same frozen copy of the study, so an edit made while the package
 * is being generated can never leave the PDF describing one revision and the
 * dictionary another. The manifest records the snapshot's checksum, and each
 * readable report repeats it in its header.
 *
 * The package is clinical content handed to other people, so it carries no
 * portfolio promotion: the PDF forms are rendered without the consultation
 * footer, and no other artifact links back to the site.
 *
 * Everything here runs in the browser. Nothing is uploaded.
 */

import type {
  AstCondition,
  CRFField,
  CRFForm,
  EditCheckRule,
  StudyProtocol,
  StudyReviewThread,
  TestScenario,
} from "./types";
import { cloneDeep } from "@/lib/utils";
import { deterministicStringify } from "./study-draft-storage";
import { computeStudyChecksum } from "./study-baselines";
import { exportUniversalCrfJson, parseUniversalCrf } from "./universal-schema";
import {
  describeExpectationResult,
  getScenarioStanding,
  isEvidenceStale,
  type ScenarioStanding,
} from "./test-scenarios";
import { StudyAuditor, type AuditDiagnostic } from "./study-auditor";
import {
  compareStudyToBaseline,
  describeBaselineDiffCategory,
  describeBaselineDiffChangeType,
  type BaselineComparisonResult,
} from "./study-baseline-diff";
import { serializeBaselineDiffToCsv } from "./export-baseline-diff";
import { sdtmTargetFor } from "./export-annotations";
import { StudyProtocolEngine } from "./study-engine";

/** Identifies the archive layout, so a reader can tell a review package apart from other zips. */
export const REVIEW_PACKAGE_FORMAT = "crf-review-package";

/** Version of the manifest layout. Bumped only when a reader would need to change. */
export const REVIEW_PACKAGE_FORMAT_VERSION = 1;

/** Name and version of the generator, recorded in every manifest. */
export const REVIEW_PACKAGE_GENERATOR = {
  name: "CRF Studio review package",
  version: "1.0.0",
} as const;

/** Path of the machine-readable manifest inside the archive. */
export const REVIEW_PACKAGE_MANIFEST_PATH = "MANIFEST.json";

/** Path of the human-readable index inside the archive. */
export const REVIEW_PACKAGE_README_PATH = "README.txt";

/** The artifacts a package can contain, in generation order. */
export type ReviewPackageArtifactId =
  | "native_source"
  | "forms_pdf"
  | "change_summary_pdf"
  | "change_summary_csv"
  | "data_dictionary_csv"
  | "codelists_csv"
  | "schedule_csv"
  | "edit_checks"
  | "test_report"
  | "readiness_report";

/** The artifacts an author may leave out. The native source is always included. */
export type ReviewPackageOptionalArtifactId = Exclude<
  ReviewPackageArtifactId,
  "native_source"
>;

/** Identity of the one revision a package was generated from. */
export interface ReviewPackageRevision {
  studyId: string;
  protocolNumber: string;
  studyName: string;
  version: string;
  lastModified: string;
  /** Deterministic checksum of the snapshot every artifact was generated from. */
  checksum: string;
}

/**
 * A frozen copy of the study taken once, plus the revision it identifies.
 * Every artifact in a package is generated from `study`.
 */
export interface ReviewPackageSnapshot {
  readonly study: Readonly<StudyProtocol>;
  readonly revision: ReviewPackageRevision;
}

/** A baseline to summarize changes against. A stored `StudyBaseline` satisfies this. */
export interface ReviewPackageBaseline {
  id: string;
  versionTag: string;
  label: string;
  study: StudyProtocol;
}

/**
 * The staleness of one scenario's evidence. A bare boolean is accepted, or an
 * object carrying a reason an author can read.
 */
export type ReviewPackageStaleness =
  boolean | { stale: boolean; reason?: string };

/**
 * Decides whether a scenario's saved evidence is stale. Return `undefined` to
 * fall back to the built-in form-fingerprint check. `form` is undefined when
 * the scenario's target form is no longer part of the study.
 */
export type ReviewPackageStalenessResolver = (
  scenario: TestScenario,
  form: CRFForm | undefined
) => ReviewPackageStaleness | undefined;

/** One progress notification while a package is generated. */
export interface ReviewPackageProgress {
  stepId: ReviewPackageArtifactId | "verify_native_source" | "manifest";
  label: string;
  /** Zero-based position of this step. */
  index: number;
  total: number;
  status: "running" | "done" | "reused";
}

/** Options shared by preview and generation. */
export interface ReviewPackageOptions {
  /** Timestamp recorded in the manifest and report headers. Defaults to now. */
  generatedAt?: Date | string;
  /** Baseline to summarize changes against. Without one, the change summary is left out. */
  baseline?: ReviewPackageBaseline | null;
  /** Optional artifacts to leave out. The native source cannot be excluded. */
  exclude?: readonly ReviewPackageOptionalArtifactId[];
  /** Overrides the built-in staleness check for scenario evidence. */
  isScenarioStale?: ReviewPackageStalenessResolver;
}

/** Options that only apply while generating. */
export interface BuildReviewPackageOptions extends ReviewPackageOptions {
  onProgress?: (progress: ReviewPackageProgress) => void;
  signal?: AbortSignal;
  /**
   * Artifacts already generated by an earlier, interrupted attempt. Those
   * produced from the same snapshot checksum are reused rather than rebuilt,
   * so a retry resumes where the failure happened.
   */
  reuse?: readonly ReviewPackageArtifact[];
}

/** One file in the package. */
export interface ReviewPackageArtifact {
  id: ReviewPackageArtifactId | "readme" | "manifest";
  path: string;
  title: string;
  format: "json" | "pdf" | "csv" | "text";
  mimeType: string;
  content: string | Uint8Array;
  /** Checksum of the snapshot this artifact was generated from. */
  revisionChecksum: string;
}

/** A row of the preview: what the package will contain, or why an item is left out. */
export interface ReviewPackagePlanEntry {
  id: ReviewPackageArtifactId;
  path: string;
  title: string;
  format: ReviewPackageArtifact["format"];
  description: string;
  included: boolean;
  required: boolean;
  /** Why the entry is left out, when it is. */
  excludedReason?: string;
}

/** An open authoring review thread carried into the package. */
export interface ReviewPackageOpenThread {
  threadId: string;
  fieldId: string;
  formId: string;
  formName: string;
  variableName: string;
  label: string;
  targetDeleted: boolean;
  commentCount: number;
  lastComment?: string;
}

/** A scenario whose evidence does not describe the packaged revision. */
export interface ReviewPackageScenarioFinding {
  scenarioId: string;
  name: string;
  formId: string;
  formName: string;
  standing: ScenarioStanding;
  stale: boolean;
  staleReason?: string;
  passed: number;
  failed: number;
  lastRunAt?: string;
}

/** A readiness diagnostic carried into the manifest. */
export interface ReviewPackageReadinessFinding {
  id: string;
  severity: AuditDiagnostic["severity"];
  formId: string;
  formName?: string;
  message: string;
}

/** Everything still unresolved at the packaged revision. */
export interface ReviewPackageFindings {
  openReviewThreads: ReviewPackageOpenThread[];
  resolvedReviewThreadCount: number;
  staleTests: ReviewPackageScenarioFinding[];
  failingTests: ReviewPackageScenarioFinding[];
  neverRunTests: ReviewPackageScenarioFinding[];
  passingTestCount: number;
  readiness: {
    score: number;
    errors: ReviewPackageReadinessFinding[];
    warnings: ReviewPackageReadinessFinding[];
  };
}

/** Counts describing how much of the study the package covers. */
export interface ReviewPackageScope {
  forms: number;
  sections: number;
  fields: number;
  visits: number;
  rules: number;
  codelists: number;
  testScenarios: number;
  reviewThreads: number;
}

/** The preview shown before anything is generated. */
export interface ReviewPackagePreview {
  revision: ReviewPackageRevision;
  entries: ReviewPackagePlanEntry[];
  scope: ReviewPackageScope;
  findings: ReviewPackageFindings;
  limitations: string[];
  comparison: { baselineId: string; versionTag: string; label: string } | null;
}

/** Result of reopening the included native source during generation. */
export interface ReviewPackageNativeSourceCheck {
  path: string;
  reopens: boolean;
  reopenedChecksum?: string;
  reviewThreadsPreserved: boolean;
  testScenariosPreserved: boolean;
  error?: string;
}

/** The machine-readable manifest written to `MANIFEST.json`. */
export interface ReviewPackageManifest {
  format: typeof REVIEW_PACKAGE_FORMAT;
  formatVersion: typeof REVIEW_PACKAGE_FORMAT_VERSION;
  generator: { name: string; version: string };
  generatedAt: string;
  revision: ReviewPackageRevision;
  comparison: {
    baselineId: string;
    versionTag: string;
    label: string;
    baselineChecksum: string;
    totalChanges: number;
  } | null;
  scope: ReviewPackageScope;
  contents: Array<{
    id: ReviewPackageArtifact["id"];
    path: string;
    title: string;
    format: ReviewPackageArtifact["format"];
    /** Content checksum for text artifacts; null for rendered PDFs. */
    checksum: string | null;
    bytes: number | null;
  }>;
  excluded: Array<{
    id: ReviewPackageArtifactId;
    title: string;
    reason: string;
  }>;
  nativeSource: ReviewPackageNativeSourceCheck;
  unresolvedFindings: ReviewPackageFindings;
  limitations: string[];
}

/** A generated package, ready to be zipped. */
export interface ReviewPackageResult {
  manifest: ReviewPackageManifest;
  /** Every file, including the manifest and readme. */
  artifacts: ReviewPackageArtifact[];
}

/** Raised when generation stops. Holds what completed, so a retry can resume. */
export class ReviewPackageBuildError extends Error {
  readonly stepId: ReviewPackageProgress["stepId"];
  readonly stepLabel: string;
  readonly aborted: boolean;
  readonly completed: ReviewPackageArtifact[];

  constructor(options: {
    message: string;
    stepId: ReviewPackageProgress["stepId"];
    stepLabel: string;
    aborted: boolean;
    completed: ReviewPackageArtifact[];
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "ReviewPackageBuildError";
    this.stepId = options.stepId;
    this.stepLabel = options.stepLabel;
    this.aborted = options.aborted;
    this.completed = options.completed;
  }
}

// --- Snapshot ----------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Takes the one snapshot a package is generated from. The study is deep
 * cloned and frozen, so later edits to the working draft cannot reach it.
 *
 * @param study - The working study.
 * @returns The frozen snapshot and the revision it identifies.
 */
export function createReviewPackageSnapshot(
  study: StudyProtocol
): ReviewPackageSnapshot {
  const copy = deepFreeze(cloneDeep(study));
  return {
    study: copy,
    revision: {
      studyId: copy.id,
      protocolNumber: copy.protocolNumber || copy.id,
      studyName: copy.studyName || copy.title || copy.protocolNumber || copy.id,
      version: copy.version || "",
      lastModified: copy.lastModified || "",
      checksum: computeStudyChecksum(copy),
    },
  };
}

// --- Shared helpers ------------------------------------------------------------

function fileSlug(revision: ReviewPackageRevision): string {
  const base = (revision.protocolNumber || revision.studyId || "study")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "study";
}

/**
 * The download filename for a package of this revision.
 *
 * @param revision - The packaged revision.
 * @returns A filesystem-safe `.zip` filename.
 */
export function reviewPackageFilename(revision: ReviewPackageRevision): string {
  const version = (revision.version || "draft").replace(
    /[^A-Za-z0-9._-]+/g,
    "-"
  );
  return `${fileSlug(revision)}-v${version}-review-package.zip`;
}

function contentChecksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function resolveGeneratedAt(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function allFields(form: CRFForm): CRFField[] {
  return (form.sections || []).flatMap((section) => section.fields || []);
}

function reportHeader(
  title: string,
  revision: ReviewPackageRevision,
  generatedAt: string
): string[] {
  return [
    title,
    "=".repeat(title.length),
    `Study      : ${revision.studyName}`,
    `Protocol   : ${revision.protocolNumber}`,
    `Revision   : ${revision.version || "unversioned"} (checksum ${revision.checksum})`,
    `Generated  : ${generatedAt} by ${REVIEW_PACKAGE_GENERATOR.name} ${REVIEW_PACKAGE_GENERATOR.version}`,
    "Data       : synthetic authoring specification, not operational EDC data",
    "",
  ];
}

// --- Plan --------------------------------------------------------------------

interface ArtifactDefinition {
  id: ReviewPackageArtifactId;
  title: string;
  format: ReviewPackageArtifact["format"];
  mimeType: string;
  description: string;
  path: (slug: string) => string;
}

const ARTIFACT_DEFINITIONS: readonly ArtifactDefinition[] = [
  {
    id: "native_source",
    title: "Native study source",
    format: "json",
    mimeType: "application/json",
    description:
      "Universal CRF JSON for this revision, including review threads and saved test scenarios. Reopens in CRF Studio.",
    path: (slug) => `study/${slug}.crf.json`,
  },
  {
    id: "forms_pdf",
    title: "Annotated CRF forms",
    format: "pdf",
    mimeType: "application/pdf",
    description:
      "Every form with SDTM annotations and a mapping appendix, rendered without promotional footers.",
    path: (slug) => `forms/${slug}-annotated-forms.pdf`,
  },
  {
    id: "change_summary_pdf",
    title: "Change summary",
    format: "pdf",
    mimeType: "application/pdf",
    description:
      "What changed against the chosen baseline, by category, with dependents that still reference removed items.",
    path: (slug) => `forms/${slug}-change-summary.pdf`,
  },
  {
    id: "change_summary_csv",
    title: "Change summary table",
    format: "csv",
    mimeType: "text/csv",
    description: "The same change summary as a spreadsheet.",
    path: (slug) => `changes/${slug}-change-summary.csv`,
  },
  {
    id: "data_dictionary_csv",
    title: "Data dictionary",
    format: "csv",
    mimeType: "text/csv",
    description:
      "One row per field: form, section, variable, label, type, limits, codelist, derivation and SDTM target.",
    path: (slug) => `dictionary/${slug}-data-dictionary.csv`,
  },
  {
    id: "codelists_csv",
    title: "Codelists",
    format: "csv",
    mimeType: "text/csv",
    description: "One row per codelist option.",
    path: (slug) => `dictionary/${slug}-codelists.csv`,
  },
  {
    id: "schedule_csv",
    title: "Schedule of activities",
    format: "csv",
    mimeType: "text/csv",
    description:
      "One row per visit and assigned form, with target day, window and arm-specific assignments.",
    path: (slug) => `schedule/${slug}-schedule.csv`,
  },
  {
    id: "edit_checks",
    title: "Edit checks",
    format: "text",
    mimeType: "text/plain",
    description:
      "Every rule and derivation in plain language, with imported expressions that are not evaluated flagged.",
    path: (slug) => `checks/${slug}-edit-checks.txt`,
  },
  {
    id: "test_report",
    title: "Test report",
    format: "text",
    mimeType: "text/plain",
    description:
      "Each saved scenario's last recorded result, labelled stale when it predates this revision.",
    path: (slug) => `reports/${slug}-test-report.txt`,
  },
  {
    id: "readiness_report",
    title: "Readiness report",
    format: "text",
    mimeType: "text/plain",
    description:
      "Audit score and diagnostics, plus every open review thread with its discussion.",
    path: (slug) => `reports/${slug}-readiness-report.txt`,
  },
];

const CHANGE_SUMMARY_IDS: ReadonlySet<ReviewPackageArtifactId> = new Set([
  "change_summary_pdf",
  "change_summary_csv",
]);

function planEntries(
  snapshot: ReviewPackageSnapshot,
  options: ReviewPackageOptions
): ReviewPackagePlanEntry[] {
  const slug = fileSlug(snapshot.revision);
  const excluded = new Set<ReviewPackageArtifactId>(options.exclude || []);
  return ARTIFACT_DEFINITIONS.map((definition) => {
    const required = definition.id === "native_source";
    let excludedReason: string | undefined;
    if (
      !required &&
      CHANGE_SUMMARY_IDS.has(definition.id) &&
      !options.baseline
    ) {
      excludedReason = "No comparison baseline was chosen.";
    } else if (!required && excluded.has(definition.id)) {
      excludedReason = "Left out by the author.";
    }
    return {
      id: definition.id,
      path: definition.path(slug),
      title: definition.title,
      format: definition.format,
      description: definition.description,
      included: excludedReason === undefined,
      required,
      ...(excludedReason ? { excludedReason } : {}),
    };
  });
}

function computeScope(study: Readonly<StudyProtocol>): ReviewPackageScope {
  const forms = study.forms || [];
  return {
    forms: forms.length,
    sections: forms.reduce((n, form) => n + (form.sections || []).length, 0),
    fields: forms.reduce((n, form) => n + allFields(form).length, 0),
    visits: (study.visits || []).length,
    rules:
      forms.reduce((n, form) => n + (form.rules || []).length, 0) +
      (study.rules || []).length,
    codelists: (study.codelists || []).length,
    testScenarios: (study.testScenarios || []).length,
    reviewThreads: (study.reviewThreads || []).length,
  };
}

// --- Findings ----------------------------------------------------------------

function normalizeStaleness(value: ReviewPackageStaleness): {
  stale: boolean;
  reason?: string;
} {
  return typeof value === "boolean" ? { stale: value } : value;
}

function resolveScenarioFinding(
  scenario: TestScenario,
  study: Readonly<StudyProtocol>,
  resolver: ReviewPackageStalenessResolver | undefined
): ReviewPackageScenarioFinding {
  const form = (study.forms || []).find((f) => f.id === scenario.formId);
  const override = resolver?.(scenario, form);

  let stale: boolean;
  let staleReason: string | undefined;
  if (override !== undefined) {
    ({ stale, reason: staleReason } = normalizeStaleness(override));
  } else if (!form) {
    stale = true;
    staleReason = "The scenario's form is no longer part of the study.";
  } else {
    stale = Boolean(scenario.lastRun) && isEvidenceStale(scenario, form);
    if (stale) {
      staleReason = "The form changed after this scenario last ran.";
    }
  }

  let standing: ScenarioStanding;
  if (!scenario.lastRun) {
    standing = "never_run";
  } else if (stale) {
    standing = "stale";
  } else if (form && override === undefined) {
    standing = getScenarioStanding(scenario, form);
  } else {
    standing = scenario.lastRun.failed === 0 ? "passing" : "failing";
  }

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    formId: scenario.formId,
    formName: form?.name || scenario.formId,
    standing,
    stale: standing === "stale",
    ...(standing === "stale" && staleReason ? { staleReason } : {}),
    passed: scenario.lastRun?.passed ?? 0,
    failed: scenario.lastRun?.failed ?? 0,
    ...(scenario.lastRun ? { lastRunAt: scenario.lastRun.ranAt } : {}),
  };
}

function sortedScenarios(study: Readonly<StudyProtocol>): TestScenario[] {
  return [...(study.testScenarios || [])].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
}

function describeOpenThread(
  thread: StudyReviewThread
): ReviewPackageOpenThread {
  const comments = thread.events.filter((event) => event.type === "comment");
  const last = comments[comments.length - 1];
  return {
    threadId: thread.id,
    fieldId: thread.target.fieldId,
    formId: thread.target.formId,
    formName: thread.target.formName,
    variableName: thread.target.variableName,
    label: thread.target.label,
    targetDeleted: StudyProtocolEngine.isReviewTargetDeleted(thread),
    commentCount: comments.length,
    ...(last && last.type === "comment" ? { lastComment: last.body } : {}),
  };
}

function toReadinessFinding(
  diagnostic: AuditDiagnostic
): ReviewPackageReadinessFinding {
  return {
    id: diagnostic.id,
    severity: diagnostic.severity,
    formId: diagnostic.formId,
    ...(diagnostic.formName ? { formName: diagnostic.formName } : {}),
    message: diagnostic.message,
  };
}

/**
 * Collects everything still unresolved at the snapshot: open review threads,
 * stale, failing and never-run tests, and readiness errors and warnings.
 *
 * @param snapshot - The packaged snapshot.
 * @param options - Supplies the optional staleness resolver.
 * @returns Findings in a stable order.
 */
export function collectReviewPackageFindings(
  snapshot: ReviewPackageSnapshot,
  options: Pick<ReviewPackageOptions, "isScenarioStale"> = {}
): ReviewPackageFindings {
  const { study } = snapshot;
  const threads = study.reviewThreads || [];
  const open = threads.filter(
    (thread) => StudyProtocolEngine.getReviewThreadStatus(thread) === "open"
  );

  const scenarios = sortedScenarios(study).map((scenario) =>
    resolveScenarioFinding(scenario, study, options.isScenarioStale)
  );

  const audit = StudyAuditor.audit(study as StudyProtocol);
  const bySeverity = (severity: AuditDiagnostic["severity"]) =>
    audit.diagnostics
      .filter((d) => d.severity === severity)
      .map(toReadinessFinding)
      .sort((a, b) => a.id.localeCompare(b.id));

  return {
    openReviewThreads: open
      .map(describeOpenThread)
      .sort((a, b) => a.threadId.localeCompare(b.threadId)),
    resolvedReviewThreadCount: threads.length - open.length,
    staleTests: scenarios.filter((s) => s.standing === "stale"),
    failingTests: scenarios.filter((s) => s.standing === "failing"),
    neverRunTests: scenarios.filter((s) => s.standing === "never_run"),
    passingTestCount: scenarios.filter((s) => s.standing === "passing").length,
    readiness: {
      score: audit.score,
      errors: bySeverity("error"),
      warnings: bySeverity("warning"),
    },
  };
}

function buildLimitations(
  entries: ReviewPackagePlanEntry[],
  baseline: ReviewPackageBaseline | null | undefined
): string[] {
  const limitations = [
    "This package describes a synthetic authoring specification. It is not validated for operational EDC use or regulatory submission, and does not establish 21 CFR Part 11 compliance.",
    "Test results are the evidence last recorded on each scenario; packaging does not re-run them. Results marked stale predate this revision and are unknown until re-run.",
    "Review threads are local authoring discussion, not EDC queries or audit records, and carry the author names declared in the studio.",
    "PDF files are rendered layouts. They embed a creation timestamp, so the manifest lists no checksum for them; the text and CSV artifacts are checksummed.",
    "The edit-check text describes rule logic for reading. The native source remains the authoritative definition.",
  ];
  if (baseline) {
    limitations.push(
      `The change summary compares against the local baseline "${baseline.versionTag}" (${baseline.label}). The baseline itself is not included.`
    );
  }
  for (const entry of entries) {
    if (!entry.included && entry.excludedReason) {
      limitations.push(`${entry.title} not included: ${entry.excludedReason}`);
    }
  }
  return limitations;
}

/**
 * Describes what a package of this snapshot would contain, without generating
 * anything. Used for the preview an author confirms before generation.
 *
 * @param snapshot - The snapshot taken with {@link createReviewPackageSnapshot}.
 * @param options - Baseline, exclusions and staleness resolver.
 * @returns Contents, scope, unresolved findings and limitations.
 */
export function previewReviewPackage(
  snapshot: ReviewPackageSnapshot,
  options: ReviewPackageOptions = {}
): ReviewPackagePreview {
  const entries = planEntries(snapshot, options);
  return {
    revision: snapshot.revision,
    entries,
    scope: computeScope(snapshot.study),
    findings: collectReviewPackageFindings(snapshot, options),
    limitations: buildLimitations(entries, options.baseline),
    comparison: options.baseline
      ? {
          baselineId: options.baseline.id,
          versionTag: options.baseline.versionTag,
          label: options.baseline.label,
        }
      : null,
  };
}

// --- Artifact renderers ------------------------------------------------------

function renderDataDictionary(study: Readonly<StudyProtocol>): string {
  const codelists = new Map((study.codelists || []).map((cl) => [cl.id, cl]));
  const rows: unknown[][] = [
    [
      "Form ID",
      "Form",
      "Domain",
      "Form Version",
      "Section",
      "Field ID",
      "Variable",
      "Label",
      "Data Type",
      "Required",
      "Unit",
      "Min",
      "Max",
      "Codelist",
      "Options",
      "Derivation",
      "SDTM Target",
      "CDASH Core",
    ],
  ];
  const pushField = (form: CRFForm, sectionTitle: string, field: CRFField) => {
    const codelist = field.codelistId
      ? codelists.get(field.codelistId)
      : undefined;
    const options = field.customOptions || codelist?.options || [];
    rows.push([
      form.id,
      form.name,
      form.domain,
      form.version,
      sectionTitle,
      field.id,
      field.variableName,
      field.label,
      field.dataType,
      field.required ? "Yes" : "No",
      field.unit,
      field.minValue,
      field.maxValue,
      codelist ? `${codelist.name} (${codelist.id})` : field.codelistId,
      options.map((o) => `${o.code}=${o.label}`).join("; "),
      field.calculationFormula,
      sdtmTargetFor(field, form.domain),
      field.cdashMetadata?.core,
    ]);
  };
  for (const form of study.forms || []) {
    for (const section of form.sections || []) {
      for (const field of section.fields || []) {
        pushField(form, section.title, field);
        for (const column of field.repeatingColumns || []) {
          pushField(form, `${section.title} › ${field.label}`, column);
        }
      }
    }
  }
  return csv(rows);
}

function renderCodelists(study: Readonly<StudyProtocol>): string {
  const rows: unknown[][] = [
    [
      "Codelist ID",
      "Codelist",
      "NCI Codelist",
      "Order",
      "Code",
      "Label",
      "NCI Code",
    ],
  ];
  for (const codelist of study.codelists || []) {
    for (const option of [...(codelist.options || [])].sort(
      (a, b) => a.order - b.order
    )) {
      rows.push([
        codelist.id,
        codelist.name,
        codelist.nciCodelistCode,
        option.order,
        option.code,
        option.label,
        option.nciCode,
      ]);
    }
  }
  return csv(rows);
}

function renderSchedule(study: Readonly<StudyProtocol>): string {
  const forms = new Map((study.forms || []).map((form) => [form.id, form]));
  const epochs = new Map(
    (study.epochs || []).map((epoch) => [epoch.id, epoch])
  );
  const arms = new Map((study.arms || []).map((arm) => [arm.id, arm]));
  const rows: unknown[][] = [
    [
      "Visit OID",
      "Visit",
      "Visit Type",
      "Target Day",
      "Window Before",
      "Window After",
      "Epoch",
      "Assignment",
      "Arms",
      "Form ID",
      "Form",
      "Domain",
    ],
  ];
  const visits = [...(study.visits || [])].sort(
    (a, b) => a.targetDay - b.targetDay || a.id.localeCompare(b.id)
  );
  for (const visit of visits) {
    const base = [
      visit.oid,
      visit.name,
      visit.visitType,
      visit.targetDay,
      visit.windowBefore,
      visit.windowAfter,
      visit.epochId ? epochs.get(visit.epochId)?.name || visit.epochId : "",
    ];
    const visitArms = (visit.armIds || [])
      .map((id) => arms.get(id)?.name || id)
      .join("; ");
    const formIds = visit.assignedFormIds || visit.formIds || [];
    if (formIds.length === 0) {
      rows.push([...base, "None", visitArms, "", "", ""]);
    }
    for (const formId of formIds) {
      const form = forms.get(formId);
      rows.push([
        ...base,
        "All arms",
        visitArms,
        formId,
        form?.name || "(form not in study)",
        form?.domain,
      ]);
    }
    for (const [armId, armFormIds] of Object.entries(
      visit.armFormAssignments || {}
    ).sort(([a], [b]) => a.localeCompare(b))) {
      for (const formId of armFormIds) {
        const form = forms.get(formId);
        rows.push([
          ...base,
          "Arm-specific",
          arms.get(armId)?.name || armId,
          formId,
          form?.name || "(form not in study)",
          form?.domain,
        ]);
      }
    }
  }
  return csv(rows);
}

const OPERATOR_TEXT: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  in: "is one of",
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const ACTION_TEXT: Record<EditCheckRule["actionType"], string> = {
  show_field: "show",
  hide_field: "hide",
  require_field: "require",
  raise_query: "raise a query on",
  set_value: "set the value of",
};

function makeFieldNamer(study: Readonly<StudyProtocol>) {
  const names = new Map<string, string>();
  for (const form of study.forms || []) {
    for (const field of allFields(form)) {
      names.set(field.id, `${field.label} (${field.variableName})`);
    }
  }
  return (fieldId: string) =>
    names.get(fieldId) || `unknown field "${fieldId}"`;
}

function describeConditionText(
  condition: AstCondition,
  nameField: (id: string) => string
): string {
  const subject = nameField(condition.fieldId);
  const visit = condition.crossVisitId
    ? ` at visit ${condition.crossVisitId}`
    : "";
  const operator =
    OPERATOR_TEXT[condition.operator] ??
    `(unsupported operator "${String(condition.operator)}")`;
  if (
    condition.operator === "is_empty" ||
    condition.operator === "is_not_empty"
  ) {
    return `${subject}${visit} ${operator}`;
  }
  const compared = condition.compareFieldId
    ? nameField(condition.compareFieldId)
    : Array.isArray(condition.value)
      ? condition.value.join(", ")
      : JSON.stringify(condition.value);
  return `${subject}${visit} ${operator} ${compared}`;
}

function describeRuleConditions(
  rule: EditCheckRule,
  nameField: (id: string) => string
): string {
  if (rule.conditionGroups && rule.conditionGroups.length > 0) {
    const joiner = ` ${rule.groupLogicalOperator || "AND"} `;
    return rule.conditionGroups
      .map(
        (group) =>
          `(${group.conditions
            .map((c) => describeConditionText(c, nameField))
            .join(` ${group.logicalOperator} `)})`
      )
      .join(joiner);
  }
  if (!rule.conditions || rule.conditions.length === 0) return "always";
  return rule.conditions
    .map((c) => describeConditionText(c, nameField))
    .join(` ${rule.logicalOperator || "AND"} `);
}

function describeRuleLines(
  rule: EditCheckRule,
  index: number,
  nameField: (id: string) => string
): string[] {
  const lines = [`${index}. ${rule.name || rule.id} [${rule.id}]`];
  if (rule.description) lines.push(`   Purpose : ${rule.description}`);
  lines.push(`   When    : ${describeRuleConditions(rule, nameField)}`);
  let then = `${ACTION_TEXT[rule.actionType] || rule.actionType} ${nameField(rule.targetFieldId)}`;
  if (rule.actionType === "raise_query") {
    then += ` with ${rule.querySeverity || "warning"} severity`;
    if (rule.queryMessage) then += `: "${rule.queryMessage}"`;
  }
  if (rule.actionType === "set_value" && rule.formulaExpression) {
    then += ` to ${rule.formulaExpression}`;
  }
  lines.push(`   Then    : ${then}`);
  if (rule.unsupportedExpression) {
    lines.push(
      `   NOT EVALUATED: imported expression kept verbatim for review (${rule.unsupportedExpression.reason}).`
    );
  }
  return lines;
}

function renderEditChecks(
  snapshot: ReviewPackageSnapshot,
  generatedAt: string
): string {
  const { study } = snapshot;
  const nameField = makeFieldNamer(study);
  const lines = reportHeader("Edit checks", snapshot.revision, generatedAt);
  let total = 0;

  for (const form of study.forms || []) {
    lines.push(`Form: ${form.name} [${form.domain}] (${form.id})`);
    lines.push("-".repeat(60));
    const rules = form.rules || [];
    if (rules.length === 0) lines.push("No edit checks on this form.");
    rules.forEach((rule, i) => {
      lines.push(...describeRuleLines(rule, i + 1, nameField));
      total++;
    });
    const derived = allFields(form).filter((f) => f.calculationFormula);
    if (derived.length > 0) {
      lines.push("", "Derivations:");
      for (const field of derived) {
        lines.push(
          `   ${field.label} (${field.variableName}) = ${field.calculationFormula}`
        );
      }
    }
    lines.push("");
  }

  const studyRules = study.rules || [];
  if (studyRules.length > 0) {
    lines.push("Study-level checks", "-".repeat(60));
    studyRules.forEach((rule, i) => {
      lines.push(...describeRuleLines(rule, i + 1, nameField));
      total++;
    });
    lines.push("");
  }

  lines.push(`Total edit checks: ${total}`);
  return lines.join("\n") + "\n";
}

const STANDING_LABEL: Record<ScenarioStanding, string> = {
  passing: "PASSING",
  failing: "FAILING",
  stale: "STALE",
  never_run: "NEVER RUN",
};

function renderTestReport(
  snapshot: ReviewPackageSnapshot,
  findings: ReviewPackageFindings,
  resolver: ReviewPackageStalenessResolver | undefined,
  generatedAt: string
): string {
  const { study } = snapshot;
  const lines = reportHeader("Test report", snapshot.revision, generatedAt);
  const scenarios = sortedScenarios(study);

  lines.push(
    `Scenarios: ${scenarios.length} (passing ${findings.passingTestCount}, failing ${findings.failingTests.length}, stale ${findings.staleTests.length}, never run ${findings.neverRunTests.length})`,
    "Stale means the evidence predates this revision: the result is unknown, not failed.",
    ""
  );
  if (scenarios.length === 0) {
    lines.push("No test scenarios are saved on this study.");
  }

  for (const scenario of scenarios) {
    const finding = resolveScenarioFinding(scenario, study, resolver);
    lines.push(
      `[${STANDING_LABEL[finding.standing]}] ${scenario.name} (${scenario.id})`
    );
    lines.push(`   Form    : ${finding.formName} (${scenario.formId})`);
    lines.push(
      `   Scope   : subject ${scenario.scope.subjectId}, visit ${scenario.scope.visitId}`
    );
    if (scenario.description)
      lines.push(`   About   : ${scenario.description}`);
    if (finding.staleReason) lines.push(`   Stale   : ${finding.staleReason}`);
    if (scenario.lastRun) {
      lines.push(
        `   Last run: ${scenario.lastRun.ranAt}, ${scenario.lastRun.passed} passed, ${scenario.lastRun.failed} failed (form fingerprint ${scenario.lastRun.formFingerprint})`
      );
      for (const result of scenario.lastRun.results) {
        lines.push(
          `     ${result.satisfied ? "ok  " : "FAIL"} ${describeExpectationResult(result)}`
        );
      }
    } else {
      lines.push(
        `   Last run: never. ${scenario.expectations.length} expectation(s) defined.`
      );
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

function describeThreadEvent(
  event: StudyReviewThread["events"][number]
): string {
  const who = `${event.author.name} (${event.author.role})`;
  switch (event.type) {
    case "comment":
      return `${event.at} ${who}: ${event.body}`;
    case "resolved":
      return `${event.at} ${who} resolved the thread`;
    case "reopened":
      return `${event.at} ${who} reopened the thread`;
    case "target-renamed":
      return `${event.at} field renamed ${event.previousVariableName} "${event.previousLabel}" → ${event.nextVariableName} "${event.nextLabel}"`;
    case "target-deleted":
    default:
      return `${event.at} field deleted from ${event.type === "target-deleted" ? event.target.formName : "its form"}`;
  }
}

function renderReadinessReport(
  snapshot: ReviewPackageSnapshot,
  findings: ReviewPackageFindings,
  generatedAt: string
): string {
  const { study } = snapshot;
  const lines = reportHeader(
    "Readiness report",
    snapshot.revision,
    generatedAt
  );
  const { readiness } = findings;

  lines.push(
    `Audit score : ${readiness.score}/100`,
    `Errors      : ${readiness.errors.length}`,
    `Warnings    : ${readiness.warnings.length}`,
    `Open review threads    : ${findings.openReviewThreads.length}`,
    `Resolved review threads: ${findings.resolvedReviewThreadCount}`,
    `Tests not current      : ${findings.staleTests.length} stale, ${findings.failingTests.length} failing, ${findings.neverRunTests.length} never run`,
    ""
  );

  for (const [title, items] of [
    ["Errors", readiness.errors],
    ["Warnings", readiness.warnings],
  ] as const) {
    lines.push(title, "-".repeat(60));
    if (items.length === 0) lines.push("None.");
    for (const item of items) {
      lines.push(
        `- [${item.id}] ${item.formName ? `${item.formName}: ` : ""}${item.message}`
      );
    }
    lines.push("");
  }

  lines.push("Open review threads", "-".repeat(60));
  const openIds = new Set(findings.openReviewThreads.map((t) => t.threadId));
  const openThreads = (study.reviewThreads || [])
    .filter((thread) => openIds.has(thread.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (openThreads.length === 0) lines.push("None.");
  for (const thread of openThreads) {
    const deleted = StudyProtocolEngine.isReviewTargetDeleted(thread)
      ? " [field deleted]"
      : "";
    lines.push(
      `* ${thread.target.formName} › ${thread.target.label} (${thread.target.variableName})${deleted} [${thread.id}]`
    );
    for (const event of thread.events) {
      lines.push(`    ${describeThreadEvent(event)}`);
    }
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

function renderReadme(
  preview: ReviewPackagePreview,
  nativeCheck: ReviewPackageNativeSourceCheck,
  generatedAt: string
): string {
  const lines = reportHeader(
    "Study review package",
    preview.revision,
    generatedAt
  );
  const { findings } = preview;
  lines.push("Contents", "-".repeat(60));
  for (const entry of preview.entries.filter((e) => e.included)) {
    lines.push(`${entry.path}`, `    ${entry.title}: ${entry.description}`);
  }
  lines.push(
    `${REVIEW_PACKAGE_MANIFEST_PATH}`,
    "    Machine-readable manifest.",
    ""
  );

  lines.push(
    "Unresolved at this revision",
    "-".repeat(60),
    `Open review threads: ${findings.openReviewThreads.length}`,
    `Stale tests        : ${findings.staleTests.length}`,
    `Failing tests      : ${findings.failingTests.length}`,
    `Never-run tests    : ${findings.neverRunTests.length}`,
    `Readiness errors   : ${findings.readiness.errors.length}`,
    `Readiness warnings : ${findings.readiness.warnings.length}`,
    ""
  );

  lines.push("Reopening the study", "-".repeat(60));
  lines.push(
    nativeCheck.reopens
      ? `Import ${nativeCheck.path} in CRF Studio (Exports → Import). It was reopened and checked while this package was generated.`
      : `${nativeCheck.path} did not pass schema validation when reopened: ${nativeCheck.error}`
  );
  lines.push("", "Limitations", "-".repeat(60));
  for (const limitation of preview.limitations) lines.push(`- ${limitation}`);
  return lines.join("\n") + "\n";
}

async function renderChangeSummaryPdf(
  snapshot: ReviewPackageSnapshot,
  comparison: BaselineComparisonResult,
  generatedAt: string
): Promise<Uint8Array> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 14;
  const { revision } = snapshot;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Change summary: ${revision.protocolNumber}`, margin, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [
      `${revision.studyName}`,
      `Revision ${revision.version || "unversioned"} (checksum ${revision.checksum}), generated ${generatedAt}`,
      `Compared against baseline ${comparison.baselineVersionTag} (${comparison.baselineLabel})`,
      `${comparison.summary.totalChanges} change(s): ${comparison.summary.addedCount} added, ${comparison.summary.removedCount} removed, ${comparison.summary.modifiedCount} modified`,
    ],
    margin,
    25
  );

  autoTable(doc, {
    startY: 46,
    margin: { left: margin, right: margin },
    head: [
      [
        "Change",
        "Category",
        "Item",
        "Changed attributes",
        "Still referenced by",
      ],
    ],
    body:
      comparison.entries.length > 0
        ? comparison.entries.map((entry) => [
            describeBaselineDiffChangeType(entry.changeType),
            describeBaselineDiffCategory(entry.category),
            (entry.breadcrumb || [entry.label]).join(" › "),
            (entry.changedFields || []).join(", "),
            (entry.affectedUses || []).join("; "),
          ])
        : [["No changes", "", "This revision matches the baseline.", "", ""]],
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.text(
      `${revision.protocolNumber} • revision ${revision.checksum} • synthetic authoring specification`,
      margin,
      doc.internal.pageSize.getHeight() - 7
    );
    doc.text(
      `Page ${i} of ${pages}`,
      doc.internal.pageSize.getWidth() - margin,
      doc.internal.pageSize.getHeight() - 7,
      { align: "right" }
    );
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Uint8Array(
    await new Response(blob as unknown as BodyInit).arrayBuffer()
  );
}

function checkNativeSource(
  path: string,
  text: string,
  study: Readonly<StudyProtocol>
): ReviewPackageNativeSourceCheck {
  try {
    const reopened = parseUniversalCrf(text);
    return {
      path,
      reopens: true,
      reopenedChecksum: computeStudyChecksum(reopened),
      reviewThreadsPreserved:
        deterministicStringify(reopened.reviewThreads || []) ===
        deterministicStringify(study.reviewThreads || []),
      testScenariosPreserved:
        deterministicStringify(reopened.testScenarios || []) ===
        deterministicStringify(study.testScenarios || []),
    };
  } catch (err) {
    return {
      path,
      reopens: false,
      reviewThreadsPreserved: false,
      testScenariosPreserved: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

// --- Build -------------------------------------------------------------------

/**
 * Generates every included artifact from one snapshot, reopens the native
 * source to check it, and writes the manifest and readme.
 *
 * Generation yields between artifacts and reports progress. If an artifact
 * fails, or `signal` aborts, a {@link ReviewPackageBuildError} is thrown that
 * carries the artifacts already completed; pass them back as `reuse` to
 * resume.
 *
 * @param snapshot - The snapshot taken with {@link createReviewPackageSnapshot}.
 * @param options - Baseline, exclusions, staleness resolver, progress and abort.
 * @returns The manifest and every file in the package.
 */
export async function buildReviewPackage(
  snapshot: ReviewPackageSnapshot,
  options: BuildReviewPackageOptions = {}
): Promise<ReviewPackageResult> {
  const generatedAt = resolveGeneratedAt(options.generatedAt);
  const preview = previewReviewPackage(snapshot, options);
  const { study, revision } = snapshot;
  const included = preview.entries.filter((entry) => entry.included);
  const total = included.length + 2;
  const completed: ReviewPackageArtifact[] = [];
  const reusable = new Map(
    (options.reuse || [])
      .filter((artifact) => artifact.revisionChecksum === revision.checksum)
      .map((artifact) => [artifact.id, artifact])
  );

  const comparison: BaselineComparisonResult | null = options.baseline
    ? {
        ...compareStudyToBaseline(
          study as StudyProtocol,
          options.baseline.study,
          {
            id: options.baseline.id,
            versionTag: options.baseline.versionTag,
            label: options.baseline.label,
          }
        ),
        comparedAt: generatedAt,
      }
    : null;

  const fail = (
    stepId: ReviewPackageProgress["stepId"],
    stepLabel: string,
    cause: unknown,
    aborted: boolean
  ): never => {
    throw new ReviewPackageBuildError({
      message: aborted
        ? "Generation was cancelled."
        : `${stepLabel} could not be generated: ${cause instanceof Error ? cause.message : String(cause)}`,
      stepId,
      stepLabel,
      aborted,
      completed: [...completed],
      cause,
    });
  };

  const render = async (
    entry: ReviewPackagePlanEntry
  ): Promise<string | Uint8Array> => {
    switch (entry.id) {
      case "native_source":
        return exportUniversalCrfJson(study as StudyProtocol);
      case "forms_pdf": {
        const { generateStudyPdf } = await import("./export-pdf");
        const blob = await generateStudyPdf(study as StudyProtocol, {
          mode: "annotated",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
          includeConsultationLink: false,
        });
        return blobToBytes(blob);
      }
      case "change_summary_pdf":
        return renderChangeSummaryPdf(snapshot, comparison!, generatedAt);
      case "change_summary_csv":
        return serializeBaselineDiffToCsv(comparison!) + "\r\n";
      case "data_dictionary_csv":
        return renderDataDictionary(study);
      case "codelists_csv":
        return renderCodelists(study);
      case "schedule_csv":
        return renderSchedule(study);
      case "edit_checks":
        return renderEditChecks(snapshot, generatedAt);
      case "test_report":
        return renderTestReport(
          snapshot,
          preview.findings,
          options.isScenarioStale,
          generatedAt
        );
      case "readiness_report":
      default:
        return renderReadinessReport(snapshot, preview.findings, generatedAt);
    }
  };

  for (const [index, entry] of included.entries()) {
    if (options.signal?.aborted) fail(entry.id, entry.title, undefined, true);
    const reused = reusable.get(entry.id);
    if (reused) {
      completed.push(reused);
      options.onProgress?.({
        stepId: entry.id,
        label: entry.title,
        index,
        total,
        status: "reused",
      });
      continue;
    }
    options.onProgress?.({
      stepId: entry.id,
      label: entry.title,
      index,
      total,
      status: "running",
    });
    await yieldToEventLoop();
    let content: string | Uint8Array;
    try {
      content = await render(entry);
    } catch (err) {
      return fail(entry.id, entry.title, err, false);
    }
    const definition = ARTIFACT_DEFINITIONS.find((d) => d.id === entry.id)!;
    completed.push({
      id: entry.id,
      path: entry.path,
      title: entry.title,
      format: entry.format,
      mimeType: definition.mimeType,
      content,
      revisionChecksum: revision.checksum,
    });
    options.onProgress?.({
      stepId: entry.id,
      label: entry.title,
      index,
      total,
      status: "done",
    });
  }

  const verifyLabel = "Reopen native source";
  if (options.signal?.aborted)
    fail("verify_native_source", verifyLabel, undefined, true);
  options.onProgress?.({
    stepId: "verify_native_source",
    label: verifyLabel,
    index: included.length,
    total,
    status: "running",
  });
  await yieldToEventLoop();
  const native = completed.find((artifact) => artifact.id === "native_source")!;
  const nativeCheck = checkNativeSource(
    native.path,
    native.content as string,
    study
  );
  options.onProgress?.({
    stepId: "verify_native_source",
    label: verifyLabel,
    index: included.length,
    total,
    status: "done",
  });

  const manifestLabel = "Write manifest";
  if (options.signal?.aborted) fail("manifest", manifestLabel, undefined, true);
  options.onProgress?.({
    stepId: "manifest",
    label: manifestLabel,
    index: included.length + 1,
    total,
    status: "running",
  });

  const limitations = nativeCheck.reopens
    ? preview.limitations
    : [
        ...preview.limitations,
        `The native source did not pass schema validation when reopened, so it cannot be imported as-is: ${nativeCheck.error}`,
      ];
  const finalPreview = { ...preview, limitations };

  const readme: ReviewPackageArtifact = {
    id: "readme",
    path: REVIEW_PACKAGE_README_PATH,
    title: "Package index",
    format: "text",
    mimeType: "text/plain",
    content: renderReadme(finalPreview, nativeCheck, generatedAt),
    revisionChecksum: revision.checksum,
  };
  const artifacts = [...completed, readme];

  const manifest: ReviewPackageManifest = {
    format: REVIEW_PACKAGE_FORMAT,
    formatVersion: REVIEW_PACKAGE_FORMAT_VERSION,
    generator: { ...REVIEW_PACKAGE_GENERATOR },
    generatedAt,
    revision: { ...revision },
    comparison:
      options.baseline && comparison
        ? {
            baselineId: options.baseline.id,
            versionTag: options.baseline.versionTag,
            label: options.baseline.label,
            baselineChecksum: computeStudyChecksum(options.baseline.study),
            totalChanges: comparison.summary.totalChanges,
          }
        : null,
    scope: preview.scope,
    contents: artifacts.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      title: artifact.title,
      format: artifact.format,
      checksum:
        typeof artifact.content === "string"
          ? contentChecksum(artifact.content)
          : null,
      bytes:
        typeof artifact.content === "string"
          ? utf8Length(artifact.content)
          : null,
    })),
    excluded: preview.entries
      .filter((entry) => !entry.included)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        reason: entry.excludedReason || "Not included.",
      })),
    nativeSource: nativeCheck,
    unresolvedFindings: preview.findings,
    limitations,
  };

  artifacts.push({
    id: "manifest",
    path: REVIEW_PACKAGE_MANIFEST_PATH,
    title: "Manifest",
    format: "json",
    mimeType: "application/json",
    content: JSON.stringify(manifest, null, 2) + "\n",
    revisionChecksum: revision.checksum,
  });
  options.onProgress?.({
    stepId: "manifest",
    label: manifestLabel,
    index: included.length + 1,
    total,
    status: "done",
  });

  return { manifest, artifacts };
}

// --- Archive -----------------------------------------------------------------

/**
 * Compresses a generated package into one zip archive. Entry timestamps are
 * the manifest's `generatedAt`, so the same package zips the same way.
 *
 * @param result - The result of {@link buildReviewPackage}.
 * @returns The archive bytes.
 */
export async function zipReviewPackage(
  result: ReviewPackageResult
): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const date = new Date(result.manifest.generatedAt);
  const stamp = Number.isNaN(date.getTime()) ? new Date(0) : date;
  for (const artifact of result.artifacts) {
    zip.file(artifact.path, artifact.content, { date: stamp });
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/** A package read back from its archive. */
export interface OpenedReviewPackage {
  manifest: ReviewPackageManifest;
  /** The study reopened from the included native source. */
  study: StudyProtocol;
  paths: string[];
}

/**
 * Reads a review package archive and reopens its native source, exactly as
 * an author receiving the package would.
 *
 * @param data - The archive bytes.
 * @returns The manifest, the reopened study and the archive's file paths.
 */
export async function openReviewPackage(
  data: Uint8Array | ArrayBuffer | Blob
): Promise<OpenedReviewPackage> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);
  const manifestFile = zip.file(REVIEW_PACKAGE_MANIFEST_PATH);
  if (!manifestFile) {
    throw new Error("This archive has no review package manifest.");
  }
  const manifest = JSON.parse(
    await manifestFile.async("string")
  ) as ReviewPackageManifest;
  if (manifest.format !== REVIEW_PACKAGE_FORMAT) {
    throw new Error("This archive is not a CRF Studio review package.");
  }
  const nativeFile = zip.file(manifest.nativeSource.path);
  if (!nativeFile) {
    throw new Error(
      `The native source ${manifest.nativeSource.path} is missing.`
    );
  }
  const study = parseUniversalCrf(await nativeFile.async("string"));
  const paths = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .sort();
  return { manifest, study, paths };
}
