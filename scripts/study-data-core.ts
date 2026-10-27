/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADAM_DEFINE_PATH,
  ADAM_PACKAGE_DIR,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  DEMO_301_USDM,
  MESSY_DATA_SCENARIOS,
  PACKAGE_FIXED_TIMESTAMP,
  SDTM_DEFINE_PATH,
  SDTM_PACKAGE_DIR,
  STANDARD_VERSIONS,
  buildStudyDataPackage,
  runConformance,
  runPipeline,
  sha256Hex,
  writeDatasetJson,
  type CoreView,
  type RecordedCrfPreset,
  type RecordedDefaultView,
  type RecordedExplanation,
  type RecordedFindings,
  type RecordedLines,
  type RecordedRule,
  type RecordedScenarioView,
  type RecordedTwin,
  type ScenarioId,
} from "../lib/study-data";
import { STUDY_PRESETS } from "../lib/crf/presets";
import { exportStudyToUsdmObject } from "../lib/crf/usdm-adapter";

/**
 * CDISC CORE check of the Study Data Pipeline's outputs (#2603).
 *
 * `export` writes what `.github/workflows/study-data-core.yml` hands to the
 * open-source CDISC Rules Engine: the seed-301 SDTM and ADaM Dataset-JSON
 * files with their Define-XML, the USDM fixture, and the in-browser
 * conformance gate's own findings. `reconcile` reads CORE's JSON reports
 * back, sets them beside the in-browser gate's findings, and fails on any
 * CORE finding that `scripts/study-data-core-allowlist.json` does not
 * explain, and on any entry that no longer matches a finding.
 *
 * `export-crf` and `reconcile-crf` do the same for the USDM export of every
 * CRF Studio preset (#3051), against the allowlist's `crf-usdm` entries.
 * `record` writes both sets of findings to the committed file the site reads.
 */

/** One layer CORE validates, and where its files are written. */
export interface CoreTarget {
  readonly id: "sdtm" | "adam" | "usdm";
  readonly standard: string;
  readonly version: string;
  /** Folder of the data files, relative to the export root. */
  readonly dataDir: string;
  /** Define-XML file, relative to the export root, when the layer has one. */
  readonly define?: string;
}

/** The standards and versions the pipeline declares (`STANDARD_VERSIONS`). */
export const CORE_TARGETS: readonly CoreTarget[] = [
  {
    id: "sdtm",
    standard: "sdtmig",
    version: "3-4",
    dataDir: SDTM_PACKAGE_DIR,
    define: SDTM_DEFINE_PATH,
  },
  {
    id: "adam",
    standard: "adamig",
    version: "1-3",
    dataDir: ADAM_PACKAGE_DIR,
    define: ADAM_DEFINE_PATH,
  },
  { id: "usdm", standard: "usdm", version: "4-0", dataDir: "usdm" },
];

/** The in-browser gate's findings, relative to the export root. */
export const GATE_FINDINGS_FILE = "gate-findings.json";

/** What the export changed for CORE, relative to the export root. */
export const EXPORT_NOTES_FILE = "export-notes.json";

/** Options for {@link exportCoreInputs}. */
export interface ExportOptions {
  /**
   * A controlled terminology release CORE's rule cache holds, used in place
   * of the declared `STANDARD_VERSIONS["NCI-EVS-CT"]` when the cache does
   * not have the declared one yet. CORE refuses a Define-XML that cites a
   * release it cannot load, and reports every USDM code that carries one.
   */
  readonly ctVersion?: string;
  /**
   * The "Inject an issue" scenario to apply before export (#2992). Absent:
   * the default run.
   */
  readonly scenario?: ScenarioId;
}

/** Every view CI runs CORE over: the default run and all 16 scenarios. */
export const CORE_VIEWS: readonly CoreView[] = [
  "default",
  ...MESSY_DATA_SCENARIOS.map((scenario) => scenario.id),
];

/**
 * Fingerprint of what CORE reads for one view: the SDTM Dataset-JSON files
 * and Define-XML, as the pipeline declares them (before any CT release is
 * substituted for CORE's cache). Recorded findings carry it, so a test can
 * tell they are stale without running CORE.
 */
export async function viewInputSha256(
  files: readonly { readonly path: string; readonly bytes: Uint8Array }[]
): Promise<string> {
  const lines = await Promise.all(
    files
      .filter((file) => file.path.startsWith(`${SDTM_PACKAGE_DIR}/`))
      .filter(
        (file) => file.path.endsWith(".json") || file.path === SDTM_DEFINE_PATH
      )
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(async (file) => `${await sha256Hex(file.bytes)}  ${file.path}`)
  );
  return sha256Hex(new TextEncoder().encode(`${lines.join("\n")}\n`));
}

/** One file CORE reads, by its package path. */
interface ViewFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/**
 * Runs the pipeline for one view and returns the files CORE reads. A
 * scenario that puts a value outside a non-extensible codelist makes
 * `buildDefine` refuse to describe it, so that view's Dataset-JSON is
 * validated against the default run's Define-XML: the planned metadata,
 * which is what a reviewer would hold the data against.
 */
export async function buildView(view: CoreView): Promise<{
  run: ReturnType<typeof runPipeline>;
  files: readonly ViewFile[];
  defineFrom: CoreView;
}> {
  const runOf = (scenarios: readonly ScenarioId[]) =>
    runPipeline(DEMO_301_STUDY, {
      seed: DEFAULT_SEED,
      nSubjects: DEFAULT_SUBJECT_COUNT,
      scenarios,
    });
  const packageOf = async (run: ReturnType<typeof runPipeline>) =>
    (await buildStudyDataPackage(run, { generatedAt: PACKAGE_FIXED_TIMESTAMP }))
      .files;
  const run = runOf(view === "default" ? [] : [view]);
  try {
    return { run, files: await packageOf(run), defineFrom: view };
  } catch (error) {
    if (
      view === "default" ||
      !(error instanceof RangeError) ||
      !/outside the non-extensible codelist/.test(error.message)
    ) {
      throw error;
    }
  }
  const planned = await packageOf(runOf([]));
  const datasets: ViewFile[] = run.datasets
    .filter((dataset) => dataset.layer === "sdtm" || dataset.layer === "adam")
    .map((dataset) => ({
      path: `${dataset.layer === "sdtm" ? SDTM_PACKAGE_DIR : ADAM_PACKAGE_DIR}/${dataset.name.toLowerCase()}.json`,
      bytes: new TextEncoder().encode(
        writeDatasetJson(dataset, {
          studyId: run.manifest.studyId,
          createdAt: PACKAGE_FIXED_TIMESTAMP,
        })
      ),
    }));
  const defines = planned.filter(
    (file) => file.path === SDTM_DEFINE_PATH || file.path === ADAM_DEFINE_PATH
  );
  return { run, files: [...datasets, ...defines], defineFrom: "default" };
}

/** Replaces each whole occurrence of one CT release date with another. */
export function substituteCtVersion(
  text: string,
  declared: string,
  available: string
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(available)) {
    throw new RangeError(
      `A CT release is a YYYY-MM-DD date, got "${available}".`
    );
  }
  return text.replaceAll(declared, available);
}

/** Writes every input CORE reads into `root`, and the gate's findings. */
export async function exportCoreInputs(
  root: string,
  options: ExportOptions = {}
): Promise<string[]> {
  const declaredCt = STANDARD_VERSIONS["NCI-EVS-CT"];
  const ct = options.ctVersion ?? declaredCt;
  const forCore = (text: string) =>
    ct === declaredCt ? text : substituteCtVersion(text, declaredCt, ct);
  const view: CoreView = options.scenario ?? "default";
  const { run, files, defineFrom } = await buildView(view);
  const written: string[] = [];
  const write = (relative: string, bytes: Uint8Array | string) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    written.push(relative);
  };
  for (const file of files) {
    const inLayer = CORE_TARGETS.some(
      (target) =>
        target.dataDir !== "usdm" &&
        file.path.startsWith(`${target.dataDir}/`) &&
        (file.path.endsWith(".json") || file.path === target.define)
    );
    if (!inLayer) continue;
    write(
      file.path,
      file.path.endsWith(".xml")
        ? forCore(new TextDecoder().decode(file.bytes))
        : file.bytes
    );
  }
  write(
    "usdm/study.json",
    forCore(`${JSON.stringify(DEMO_301_USDM, null, 2)}\n`)
  );
  const gate = runConformance(
    run.datasets.filter(
      (dataset) => dataset.layer === "sdtm" || dataset.layer === "adam"
    )
  );
  write(GATE_FINDINGS_FILE, `${JSON.stringify(gate, null, 2)}\n`);
  write(
    EXPORT_NOTES_FILE,
    `${JSON.stringify(
      {
        seed: DEFAULT_SEED,
        nSubjects: DEFAULT_SUBJECT_COUNT,
        view,
        inputSha256: await viewInputSha256(files),
        defineFrom,
        declaredCt,
        validatedCt: ct,
      },
      null,
      2
    )}\n`
  );
  return written;
}

/** The CRF Studio presets whose USDM export CORE checks (#3051). */
export const CRF_PRESET_IDS: readonly string[] = STUDY_PRESETS.map(
  (preset) => preset.id
);

/** The USDM file of one CRF preset, relative to its export folder. */
export const CRF_USDM_FILE = "usdm/study.json";

/** One CRF preset's USDM export, as CRF Studio writes it. */
export function crfUsdmJson(presetId: string): string {
  const preset = STUDY_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new RangeError(`No CRF Studio preset "${presetId}".`);
  return `${JSON.stringify(exportStudyToUsdmObject(preset.study), null, 2)}\n`;
}

/**
 * Fingerprint of one CRF preset's USDM export, before any CT release is
 * substituted for CORE's cache, so a test can tell its recorded findings
 * are stale without running CORE.
 */
export function crfInputSha256(presetId: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(crfUsdmJson(presetId)));
}

/**
 * Writes every CRF Studio preset's USDM export into `<root>/<preset>/`,
 * with its export notes (#3051).
 */
export async function exportCrfInputs(
  root: string,
  options: Pick<ExportOptions, "ctVersion"> = {}
): Promise<string[]> {
  const declaredCt = STANDARD_VERSIONS["NCI-EVS-CT"];
  const ct = options.ctVersion ?? declaredCt;
  const written: string[] = [];
  for (const preset of CRF_PRESET_IDS) {
    const json = crfUsdmJson(preset);
    const write = (relative: string, text: string) => {
      const target = path.join(root, preset, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
      written.push(path.posix.join(preset, relative));
    };
    write(
      CRF_USDM_FILE,
      ct === declaredCt ? json : substituteCtVersion(json, declaredCt, ct)
    );
    write(
      EXPORT_NOTES_FILE,
      `${JSON.stringify(
        {
          preset,
          inputSha256: await crfInputSha256(preset),
          declaredCt,
          validatedCt: ct,
        },
        null,
        2
      )}\n`
    );
  }
  return written;
}

/** One CORE rule's findings on one dataset or USDM entity. */
export interface CoreIssue {
  readonly target: CoreTarget["id"];
  readonly coreId: string;
  readonly dataset: string;
  readonly issues: number;
  readonly message: string;
}

/** The allowlist target for CRF Studio preset USDM exports (#3051). */
export const CRF_USDM_TARGET = "crf-usdm";

/** Why a CORE finding is accepted, from the allowlist file. */
export interface AllowlistEntry {
  readonly target: CoreTarget["id"] | typeof CRF_USDM_TARGET;
  readonly coreId: string;
  readonly dataset: string;
  readonly category: "defect" | "by-design" | "ct-cache" | "core-limitation";
  /** The issue tracking a defect; required for `defect`. */
  readonly issue?: number;
  /**
   * For `crf-usdm` only: the presets the entry explains. Absent: every
   * preset, and every preset must report the finding.
   */
  readonly presets?: readonly string[];
  readonly reason: string;
}

/** The allowlist file, relative to the workspace root. */
export const ALLOWLIST_FILE = "scripts/study-data-core-allowlist.json";

/** The measured map from local rules to CORE rules (#2994). */
export const CROSSWALK_FILE = "scripts/study-data-core-crosswalk.json";

const CATEGORIES = new Set<AllowlistEntry["category"]>([
  "defect",
  "by-design",
  "ct-cache",
  "core-limitation",
]);

/** Checks the allowlist's shape: every entry explained, defects tracked. */
export function parseAllowlist(json: unknown): AllowlistEntry[] {
  const entries = (json as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    throw new TypeError("The allowlist has no entries array.");
  }
  const seen = new Set<string>();
  return entries.map((value, index) => {
    const entry = value as AllowlistEntry;
    const where = `Allowlist entry ${index + 1}`;
    if (
      entry.target !== CRF_USDM_TARGET &&
      !CORE_TARGETS.some((target) => target.id === entry.target)
    ) {
      throw new TypeError(`${where} has an unknown target "${entry.target}".`);
    }
    if (entry.presets !== undefined) {
      if (entry.target !== CRF_USDM_TARGET) {
        throw new TypeError(`${where} names presets on a pipeline target.`);
      }
      if (
        !Array.isArray(entry.presets) ||
        entry.presets.length === 0 ||
        entry.presets.some((preset) => !CRF_PRESET_IDS.includes(preset))
      ) {
        throw new TypeError(`${where} names an unknown CRF Studio preset.`);
      }
    }
    if (!/^CORE-\d{6}$/.test(entry.coreId)) {
      throw new TypeError(`${where} has no CORE rule id.`);
    }
    if (typeof entry.dataset !== "string" || entry.dataset === "") {
      throw new TypeError(`${where} names no dataset or entity.`);
    }
    if (!CATEGORIES.has(entry.category)) {
      throw new TypeError(`${where} has no known category.`);
    }
    if (entry.category === "defect" && !Number.isInteger(entry.issue)) {
      throw new TypeError(`${where} is a defect with no tracking issue.`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new TypeError(`${where} gives no reason.`);
    }
    const key = issueKey(entry);
    if (seen.has(key)) throw new TypeError(`${where} repeats ${key}.`);
    seen.add(key);
    return entry;
  });
}

function issueKey(value: {
  target: string;
  coreId: string;
  dataset: string;
}): string {
  return `${value.target} ${value.coreId} ${value.dataset}`;
}

/** Reads the per-rule summary out of a CORE JSON report. */
export function coreIssues(
  target: CoreTarget["id"],
  report: unknown
): CoreIssue[] {
  const summary = (report as { Issue_Summary?: unknown })?.Issue_Summary;
  if (!Array.isArray(summary)) {
    throw new TypeError(`The ${target} CORE report has no Issue_Summary.`);
  }
  return summary.map((row) => ({
    target,
    coreId: String(row.core_id),
    dataset: String(row.dataset ?? row.entity),
    issues: Number(row.issues),
    message: String(row.message),
  }));
}

/** CORE findings set against the allowlist. */
export interface Reconciliation {
  readonly explained: readonly {
    readonly issue: CoreIssue;
    readonly entry: AllowlistEntry;
  }[];
  /** Findings no entry explains: these fail the workflow. */
  readonly unexplained: readonly CoreIssue[];
  /** Entries for targets that ran but matched no finding: these fail too. */
  readonly stale: readonly AllowlistEntry[];
}

/**
 * Matches each finding to its allowlist entry by target, CORE rule id and
 * dataset. Entries for a target that did not run are neither used nor
 * stale.
 */
export function reconcile(
  issues: readonly CoreIssue[],
  allowlist: readonly AllowlistEntry[],
  ran: readonly CoreTarget["id"][]
): Reconciliation {
  const byKey = new Map(allowlist.map((entry) => [issueKey(entry), entry]));
  const used = new Set<string>();
  const explained: { issue: CoreIssue; entry: AllowlistEntry }[] = [];
  const unexplained: CoreIssue[] = [];
  for (const issue of issues) {
    const entry = byKey.get(issueKey(issue));
    if (entry) {
      explained.push({ issue, entry });
      used.add(issueKey(entry));
    } else {
      unexplained.push(issue);
    }
  }
  const stale = allowlist.filter(
    (entry) =>
      (ran as readonly string[]).includes(entry.target) &&
      !used.has(issueKey(entry))
  );
  return { explained, unexplained, stale };
}

/** The in-browser gate's findings, counted per dataset and rule id. */
export function gateCounts(gate: unknown): Map<string, Map<string, number>> {
  const findings = (gate as { findings?: unknown })?.findings;
  const counts = new Map<string, Map<string, number>>();
  for (const finding of Array.isArray(findings) ? findings : []) {
    const dataset = String(finding.dataset);
    const rules = counts.get(dataset) ?? new Map<string, number>();
    rules.set(
      String(finding.ruleId),
      (rules.get(String(finding.ruleId)) ?? 0) + 1
    );
    counts.set(dataset, rules);
  }
  return counts;
}

const cell = (text: string) =>
  text.replaceAll("|", "\\|").replaceAll("\n", " ");

/** Inputs to {@link renderReconciliation}. */
export interface ReconciliationInput {
  readonly notes: { readonly declaredCt: string; readonly validatedCt: string };
  readonly engine: string;
  readonly skipped: readonly { target: CoreTarget["id"]; reason: string }[];
  readonly issues: readonly CoreIssue[];
  readonly result: Reconciliation;
  readonly gate: Map<string, Map<string, number>>;
}

/** The reconciliation report, as Markdown for the job summary. */
export function renderReconciliation(input: ReconciliationInput): string {
  const { notes, result } = input;
  const failed = result.unexplained.length + result.stale.length;
  const lines = [
    "# CDISC CORE reconciliation",
    "",
    failed === 0
      ? `Every CORE finding is explained (${result.explained.length} rule and dataset pairs).`
      : `**${result.unexplained.length} unexplained CORE finding(s) and ${result.stale.length} stale allowlist entr${result.stale.length === 1 ? "y" : "ies"}.**`,
    "",
    `- Engine: ${input.engine}`,
    `- Input: DEMO-301, seed ${DEFAULT_SEED}, ${DEFAULT_SUBJECT_COUNT} subjects`,
    notes.validatedCt === notes.declaredCt
      ? `- Controlled terminology: ${notes.declaredCt}`
      : `- Controlled terminology: validated against ${notes.validatedCt}, the newest release in CORE's cache; the pipeline declares ${notes.declaredCt}`,
    ...input.skipped.map(
      ({ target, reason }) => `- Not run for ${target}: ${reason}`
    ),
    "",
  ];
  if (result.unexplained.length > 0) {
    lines.push(
      "## Unexplained findings",
      "",
      "Fix the output, or add an entry with a reason to `" +
        ALLOWLIST_FILE +
        "`.",
      "",
      "| Target | Rule | Dataset | Issues | Message |",
      "| --- | --- | --- | ---: | --- |",
      ...result.unexplained.map(
        (issue) =>
          `| ${issue.target} | ${issue.coreId} | ${issue.dataset} | ${issue.issues} | ${cell(issue.message)} |`
      ),
      ""
    );
  }
  if (result.stale.length > 0) {
    lines.push(
      "## Stale allowlist entries",
      "",
      "CORE no longer reports these. Remove them from `" +
        ALLOWLIST_FILE +
        "`.",
      "",
      ...result.stale.map(
        (entry) =>
          `- ${entry.target} ${entry.coreId} ${entry.dataset}${entry.issue ? ` (#${entry.issue})` : ""}`
      ),
      ""
    );
  }
  lines.push(
    "## CORE and the in-browser gate by dataset",
    "",
    "| Dataset | CORE rules reporting (issues) | Gate rules reporting (findings) |",
    "| --- | --- | --- |"
  );
  const datasets = [
    ...new Set([
      ...input.issues
        .filter((issue) => issue.target !== "usdm")
        .map((issue) => issue.dataset),
      ...input.gate.keys(),
    ]),
  ].sort();
  for (const dataset of datasets) {
    const core = input.issues
      .filter((issue) => issue.target !== "usdm" && issue.dataset === dataset)
      .map((issue) => `${issue.coreId} (${issue.issues})`)
      .join(", ");
    const gate = [...(input.gate.get(dataset) ?? new Map()).entries()]
      .map(([rule, count]) => `${rule} (${count})`)
      .join(", ");
    lines.push(`| ${dataset} | ${core || "none"} | ${gate || "none"} |`);
  }
  lines.push(
    "",
    "## Explained findings",
    "",
    "| Target | Rule | Dataset | Issues | Category | Reason |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...result.explained.map(
      ({ issue, entry }) =>
        `| ${issue.target} | ${issue.coreId} | ${issue.dataset} | ${issue.issues} | ${entry.category}${entry.issue ? ` (#${entry.issue})` : ""} | ${cell(entry.reason)} |`
    ),
    ""
  );
  return lines.join("\n");
}

/** Runs `reconcile` over an export folder and a folder of CORE reports. */
export function reconcileFolder(
  inputDir: string,
  reportsDir: string,
  allowlistFile: string,
  engine: string
): { markdown: string; failed: boolean } {
  const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
  const allowlist = parseAllowlist(read(allowlistFile));
  const issues: CoreIssue[] = [];
  const ran: CoreTarget["id"][] = [];
  const skipped: { target: CoreTarget["id"]; reason: string }[] = [];
  for (const target of CORE_TARGETS) {
    const report = path.join(reportsDir, `${target.id}.json`);
    const skip = path.join(reportsDir, `${target.id}.skipped`);
    if (fs.existsSync(report)) {
      issues.push(...coreIssues(target.id, read(report)));
      ran.push(target.id);
    } else if (fs.existsSync(skip)) {
      skipped.push({
        target: target.id,
        reason: fs.readFileSync(skip, "utf8").trim(),
      });
    } else {
      throw new Error(`No CORE report or skip note for ${target.id}.`);
    }
  }
  const result = reconcile(issues, allowlist, ran);
  const markdown = renderReconciliation({
    notes: read(path.join(inputDir, EXPORT_NOTES_FILE)),
    engine,
    skipped,
    issues,
    result,
    gate: gateCounts(read(path.join(inputDir, GATE_FINDINGS_FILE))),
  });
  return {
    markdown,
    failed: result.unexplained.length > 0 || result.stale.length > 0,
  };
}

/** One CORE rule's findings on one entity of one CRF preset's export. */
export interface CrfIssue extends CoreIssue {
  readonly preset: string;
}

/** CRF preset findings set against the allowlist's `crf-usdm` entries. */
export interface CrfReconciliation {
  readonly explained: readonly {
    readonly issue: CrfIssue;
    readonly entry: AllowlistEntry;
  }[];
  readonly unexplained: readonly CrfIssue[];
  /** Entries with a preset they cover that reports no such finding. */
  readonly stale: readonly {
    readonly entry: AllowlistEntry;
    readonly presets: readonly string[];
  }[];
}

/**
 * Matches each preset's findings to a `crf-usdm` entry by CORE rule id,
 * entity and preset. An entry is stale for every preset it covers that
 * does not report the finding, so an entry cannot outlive its defect on
 * one preset while it lasts on another.
 */
export function reconcileCrf(
  issues: readonly CrfIssue[],
  allowlist: readonly AllowlistEntry[],
  presets: readonly string[]
): CrfReconciliation {
  const entries = allowlist.filter((entry) => entry.target === CRF_USDM_TARGET);
  const covers = (entry: AllowlistEntry, preset: string) =>
    (entry.presets ?? presets).includes(preset);
  const explained: { issue: CrfIssue; entry: AllowlistEntry }[] = [];
  const unexplained: CrfIssue[] = [];
  for (const issue of issues) {
    const entry = entries.find(
      (item) =>
        item.coreId === issue.coreId &&
        item.dataset === issue.dataset &&
        covers(item, issue.preset)
    );
    if (entry) explained.push({ issue, entry });
    else unexplained.push(issue);
  }
  const stale = entries
    .map((entry) => ({
      entry,
      presets: presets.filter(
        (preset) =>
          covers(entry, preset) &&
          !issues.some(
            (issue) =>
              issue.preset === preset &&
              issue.coreId === entry.coreId &&
              issue.dataset === entry.dataset
          )
      ),
    }))
    .filter(({ presets: missing }) => missing.length > 0);
  return { explained, unexplained, stale };
}

/** The CRF preset reconciliation report, as Markdown for the job summary. */
export function renderCrfReconciliation(
  result: CrfReconciliation,
  engine: string,
  notes: { readonly declaredCt: string; readonly validatedCt: string }
): string {
  const failed = result.unexplained.length + result.stale.length;
  const lines = [
    "# CDISC CORE on CRF Studio USDM exports",
    "",
    failed === 0
      ? `Every CORE finding on the ${CRF_PRESET_IDS.length} preset exports is explained (${result.explained.length} preset, rule and entity triples).`
      : `**${result.unexplained.length} unexplained CORE finding(s) and ${result.stale.length} stale allowlist entr${result.stale.length === 1 ? "y" : "ies"}.**`,
    "",
    `- Engine: ${engine}, USDM 4.0`,
    notes.validatedCt === notes.declaredCt
      ? `- Controlled terminology: ${notes.declaredCt}`
      : `- Controlled terminology: validated against ${notes.validatedCt}, the newest release in CORE's cache; the exports cite ${notes.declaredCt}`,
    "",
  ];
  if (result.unexplained.length > 0) {
    lines.push(
      "## Unexplained findings",
      "",
      "Fix the export in `lib/crf/usdm-adapter.ts`, or add a `crf-usdm` entry with a reason to `" +
        ALLOWLIST_FILE +
        "`.",
      "",
      "| Preset | Rule | Entity | Issues | Message |",
      "| --- | --- | --- | ---: | --- |",
      ...result.unexplained.map(
        (issue) =>
          `| ${issue.preset} | ${issue.coreId} | ${issue.dataset} | ${issue.issues} | ${cell(issue.message)} |`
      ),
      ""
    );
  }
  if (result.stale.length > 0) {
    lines.push(
      "## Stale allowlist entries",
      "",
      "CORE no longer reports these for the presets named. Remove the entry or narrow its `presets`.",
      "",
      ...result.stale.map(
        ({ entry, presets }) =>
          `- ${entry.coreId} ${entry.dataset}${entry.issue ? ` (#${entry.issue})` : ""}: ${presets.join(", ")}`
      ),
      ""
    );
  }
  lines.push(
    "## Explained findings",
    "",
    "| Preset | Rule | Entity | Issues | Category | Reason |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...result.explained.map(
      ({ issue, entry }) =>
        `| ${issue.preset} | ${issue.coreId} | ${issue.dataset} | ${issue.issues} | ${entry.category}${entry.issue ? ` (#${entry.issue})` : ""} | ${cell(entry.reason)} |`
    ),
    ""
  );
  return lines.join("\n");
}

/** Runs {@link reconcileCrf} over the CRF exports and their CORE reports. */
export function reconcileCrfFolder(
  inputsDir: string,
  reportsDir: string,
  allowlistFile: string,
  engine: string
): { markdown: string; failed: boolean } {
  const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
  const allowlist = parseAllowlist(read(allowlistFile));
  const issues = CRF_PRESET_IDS.flatMap((preset) =>
    coreIssues("usdm", read(path.join(reportsDir, preset, "usdm.json"))).map(
      (issue) => ({ ...issue, preset })
    )
  );
  const result = reconcileCrf(issues, allowlist, CRF_PRESET_IDS);
  return {
    markdown: renderCrfReconciliation(
      result,
      engine,
      read(path.join(inputsDir, CRF_PRESET_IDS[0], EXPORT_NOTES_FILE))
    ),
    failed: result.unexplained.length > 0 || result.stale.length > 0,
  };
}

/** The committed CORE findings for every view, relative to the workspace root. */
export const RECORDED_FINDINGS_FILE =
  "lib/study-data/internal/core/recorded-findings.json";

/**
 * How many example lines are kept per rule and dataset. CORE can report a
 * cascade of thousands of rows for one planted defect (a duplicated DM
 * record breaks every study day), so the file keeps the first examples, in
 * sorted order, and the full count, as CORE's own issue limit does.
 */
export const RECORDED_EXAMPLES_PER_RULE = 20;

/**
 * One CORE finding as a line: rule, dataset or entity, the record (subject
 * and --SEQ, so a scenario that adds a row does not renumber every finding
 * after it) and the variables with the values CORE saw.
 */
export function findingLine(detail: Record<string, unknown>): string {
  const text = (value: unknown) =>
    value === null || value === undefined || value === ""
      ? "-"
      : String(value).replaceAll("\n", " ");
  const names = detail.variables ?? detail.attributes;
  const variables = Array.isArray(names) ? names : [];
  const values = Array.isArray(detail.values) ? detail.values : [];
  const record =
    detail.USUBJID !== undefined
      ? `${text(detail.USUBJID)}#${text(detail.SEQ ?? detail.row)}`
      : text(detail.instance_id ?? detail.path ?? detail.row);
  return [
    String(detail.core_id),
    text(detail.dataset ?? detail.entity),
    record,
    variables
      .map((name, index) => `${String(name)}=${text(values[index])}`)
      .join("|") || "-",
  ].join(" ");
}

function reportOf(report: unknown, target: string) {
  const value = report as {
    Issue_Details?: Record<string, unknown>[];
    Rules_Report?: Record<string, unknown>[];
    Conformance_Details?: Record<string, unknown>;
  };
  if (
    !Array.isArray(value?.Issue_Details) ||
    !Array.isArray(value?.Rules_Report)
  ) {
    throw new TypeError(
      `The ${target} CORE report has no Issue_Details or Rules_Report.`
    );
  }
  const rules: Record<string, RecordedRule> = {};
  for (const row of [...value.Rules_Report].sort((a, b) =>
    String(a.core_id).localeCompare(String(b.core_id))
  )) {
    rules[String(row.core_id)] = {
      status: String(row.status),
      cdisc: String(row.cdisc_rule_id ?? ""),
      fda: String(row.fda_rule_id ?? ""),
      message: String(row.message ?? ""),
    };
  }
  return {
    lines: value.Issue_Details.map(findingLine).sort(),
    rules,
    engineVersion: String(value.Conformance_Details?.CORE_Engine_Version ?? ""),
  };
}

/** Caps sorted lines per rule and dataset, keeping the full counts. */
export function capLines(lines: readonly string[]): RecordedLines {
  const counts: Record<string, number> = {};
  const kept: string[] = [];
  for (const line of [...lines].sort()) {
    const key = line.split(" ", 2).join(" ");
    counts[key] = (counts[key] ?? 0) + 1;
    if (counts[key] <= RECORDED_EXAMPLES_PER_RULE) kept.push(line);
  }
  return { lines: kept, counts };
}

/** Lines in `next` but not `base`, and in `base` but not `next`, by count. */
export function lineDifference(
  base: readonly string[],
  next: readonly string[]
): { added: string[]; removed: string[] } {
  const count = (lines: readonly string[]) => {
    const counts = new Map<string, number>();
    for (const item of lines) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
  };
  const before = count(base);
  const after = count(next);
  const extra = (a: Map<string, number>, b: Map<string, number>) =>
    [...a].flatMap(([item, n]) =>
      Array<string>(Math.max(0, n - (b.get(item) ?? 0))).fill(item)
    );
  return { added: extra(after, before), removed: extra(before, after) };
}

/** Options for {@link recordFindings}. */
export interface RecordOptions {
  readonly tag: string;
  readonly commit: string;
  /** The `export-crf` folder and the CORE reports on it (#3051). */
  readonly crf: { readonly inputsDir: string; readonly reportsDir: string };
  /** The allowlist and crosswalk; the checked-in files when absent. */
  readonly annotations?: AnnotationSources;
}

/**
 * Builds the committed findings file from a folder of per-view exports
 * (`<inputs>/<view>/`) and per-view CORE reports (`<reports>/<view>/`).
 * The default view needs SDTM and USDM reports and an ADaM report or skip
 * note; a scenario view needs only SDTM, since scenarios change collected
 * data and nothing else.
 */
export function recordFindings(
  inputsDir: string,
  reportsDir: string,
  options: RecordOptions
): RecordedFindings {
  const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
  const notesOf = (view: CoreView) => {
    const notes = read(path.join(inputsDir, view, EXPORT_NOTES_FILE));
    if (notes.view !== view) {
      throw new Error(`The ${view} export notes are for ${notes.view}.`);
    }
    return notes as {
      inputSha256: string;
      declaredCt: string;
      validatedCt: string;
    };
  };
  const sdtmOf = (view: CoreView) => {
    const result = reportOf(
      read(path.join(reportsDir, view, "sdtm.json")),
      `${view} sdtm`
    );
    if (`v${result.engineVersion}` !== options.tag) {
      throw new Error(
        `The ${view} report is from CORE ${result.engineVersion}, not ${options.tag}.`
      );
    }
    return result;
  };
  const notes = notesOf("default");
  const sdtm = sdtmOf("default");
  const usdm = reportOf(
    read(path.join(reportsDir, "default", "usdm.json")),
    "default usdm"
  );
  const adamReport = path.join(reportsDir, "default", "adam.json");
  const adamSkip = path.join(reportsDir, "default", "adam.skipped");
  const adam = fs.existsSync(adamReport)
    ? "ADaMIG 1.3"
    : fs.existsSync(adamSkip)
      ? `not run: ${fs.readFileSync(adamSkip, "utf8").trim()}`
      : null;
  if (adam === null) {
    throw new Error("No CORE report or skip note for the default adam.");
  }
  const views: Record<string, RecordedDefaultView | RecordedScenarioView> = {
    default: {
      inputSha256: notes.inputSha256,
      sdtm: capLines(sdtm.lines),
      usdm: capLines(usdm.lines),
    },
  };
  for (const view of CORE_VIEWS.filter((item) => item !== "default")) {
    const scenario = sdtmOf(view);
    const status: Record<string, string> = {};
    for (const [id, rule] of Object.entries(scenario.rules)) {
      if (sdtm.rules[id]?.status !== rule.status) status[id] = rule.status;
    }
    const change = lineDifference(sdtm.lines, scenario.lines);
    views[view] = {
      inputSha256: notesOf(view).inputSha256,
      added: capLines(change.added),
      removed: capLines(change.removed),
      status,
    };
  }
  const crf: Record<string, RecordedCrfPreset> = {};
  for (const preset of CRF_PRESET_IDS) {
    const presetNotes = read(
      path.join(options.crf.inputsDir, preset, EXPORT_NOTES_FILE)
    ) as { preset: string; inputSha256: string; validatedCt: string };
    if (presetNotes.preset !== preset) {
      throw new Error(
        `The ${preset} export notes are for ${presetNotes.preset}.`
      );
    }
    if (presetNotes.validatedCt !== notes.validatedCt) {
      throw new Error(
        `The ${preset} export was validated against CT ${presetNotes.validatedCt}, the pipeline against ${notes.validatedCt}.`
      );
    }
    const report = reportOf(
      read(path.join(options.crf.reportsDir, preset, "usdm.json")),
      `${preset} usdm`
    );
    if (`v${report.engineVersion}` !== options.tag) {
      throw new Error(
        `The ${preset} report is from CORE ${report.engineVersion}, not ${options.tag}.`
      );
    }
    const status: Record<string, string> = {};
    for (const [id, rule] of Object.entries(report.rules)) {
      if (usdm.rules[id]?.status !== rule.status) status[id] = rule.status;
    }
    crf[preset] = {
      inputSha256: presetNotes.inputSha256,
      usdm: capLines(report.lines),
      status,
    };
  }
  return {
    $comment:
      "Generated by scripts/study-data-core.ts record from CDISC CORE runs in .github/workflows/study-data-core.yml (#2992). Do not edit: see docs/how-to/refresh-cdisc-core-findings.md.",
    lock: {
      engine: "CDISC CORE",
      tag: options.tag,
      commit: options.commit,
      standards: { sdtm: "SDTMIG 3.4", adam, usdm: "USDM 4.0" },
      ct: { declared: notes.declaredCt, validated: notes.validatedCt },
    },
    rules: { sdtm: sdtm.rules, usdm: usdm.rules },
    ...recordedAnnotations(options.annotations ?? readAnnotationSources()),
    views: views as RecordedFindings["views"],
    crf,
  };
}

/** The allowlist and crosswalk, as `recordedAnnotations` reads them. */
export interface AnnotationSources {
  readonly allowlist: unknown;
  readonly crosswalk: unknown;
}

/** Reads the checked-in allowlist and crosswalk. */
export function readAnnotationSources(
  root: string = process.cwd()
): AnnotationSources {
  const read = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  return { allowlist: read(ALLOWLIST_FILE), crosswalk: read(CROSSWALK_FILE) };
}

/**
 * What the page shows beside CORE's findings: the allowlist's reason for
 * each accepted default-view finding, and the CORE rules measured to catch
 * each local rule's defect. They are copied into the recorded file so the
 * site reads one file and never the scripts folder.
 */
export function recordedAnnotations(
  sources: AnnotationSources
): Pick<RecordedFindings, "explained" | "twins"> {
  const explained: Record<
    "sdtm" | "usdm",
    Record<string, RecordedExplanation>
  > = { sdtm: {}, usdm: {} };
  for (const entry of parseAllowlist(sources.allowlist)) {
    if (entry.target !== "sdtm" && entry.target !== "usdm") continue;
    explained[entry.target][`${entry.coreId} ${entry.dataset}`] = {
      category: entry.category,
      reason: entry.reason,
      ...(entry.issue ? { issue: entry.issue } : {}),
    };
  }
  const entries = (sources.crosswalk as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    throw new TypeError("The crosswalk has no entries array.");
  }
  const twins: Record<string, RecordedTwin> = {};
  for (const item of entries as {
    ruleId: string;
    core: string[];
    coverage: string;
  }[]) {
    if (item.coverage !== "same-defect" && item.coverage !== "related")
      continue;
    twins[item.ruleId] = { coverage: item.coverage, core: [...item.core] };
  }
  return { explained, twins };
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, root, ...rest] = argv;
  if (command === "export" && root) {
    const flag = rest.indexOf("--ct-version");
    const written = await exportCoreInputs(path.resolve(root), {
      ctVersion: flag >= 0 ? rest[flag + 1] : undefined,
    });
    console.log(`Wrote ${written.length} files to ${root}.`);
    return 0;
  }
  if (command === "export-views" && root) {
    const flag = rest.indexOf("--ct-version");
    for (const view of CORE_VIEWS) {
      await exportCoreInputs(path.resolve(root, view), {
        ctVersion: flag >= 0 ? rest[flag + 1] : undefined,
        scenario: view === "default" ? undefined : view,
      });
    }
    console.log(`Exported ${CORE_VIEWS.length} views to ${root}.`);
    return 0;
  }
  if (command === "export-crf" && root) {
    const flag = rest.indexOf("--ct-version");
    await exportCrfInputs(path.resolve(root), {
      ctVersion: flag >= 0 ? rest[flag + 1] : undefined,
    });
    console.log(
      `Exported ${CRF_PRESET_IDS.length} CRF Studio USDM exports to ${root}.`
    );
    return 0;
  }
  if (command === "reconcile-crf" && root && rest[0]) {
    const engineAt = rest.indexOf("--engine");
    const { markdown, failed } = reconcileCrfFolder(
      path.resolve(root),
      path.resolve(rest[0]),
      path.resolve(ALLOWLIST_FILE),
      engineAt >= 0 ? rest[engineAt + 1] : "CDISC CORE"
    );
    fs.writeFileSync(path.join(rest[0], "reconciliation.md"), markdown);
    console.log(markdown);
    return failed ? 1 : 0;
  }
  if (command === "annotate") {
    const file = path.resolve(root ?? RECORDED_FINDINGS_FILE);
    const recorded = JSON.parse(
      fs.readFileSync(file, "utf8")
    ) as RecordedFindings;
    const { explained, twins } = recordedAnnotations(readAnnotationSources());
    const { views, crf, ...head } = recorded;
    fs.writeFileSync(
      file,
      `${JSON.stringify({ ...head, explained, twins, views, crf }, null, 2)}\n`
    );
    console.log(`Updated the allowlist reasons and rule twins in ${file}.`);
    return 0;
  }
  if (command === "record" && root && rest[0]) {
    const option = (name: string) => {
      const at = rest.indexOf(name);
      return at >= 0 ? rest[at + 1] : undefined;
    };
    const tag = option("--core-tag");
    const commit = option("--core-commit");
    const crfInputs = option("--crf-inputs");
    const crfReports = option("--crf-reports");
    if (!tag || !commit || !crfInputs || !crfReports) {
      console.error(
        "record needs --core-tag, --core-commit, --crf-inputs and --crf-reports."
      );
      return 2;
    }
    const recorded = recordFindings(path.resolve(root), path.resolve(rest[0]), {
      tag,
      commit,
      crf: {
        inputsDir: path.resolve(crfInputs),
        reportsDir: path.resolve(crfReports),
      },
    });
    const out = path.resolve(option("--out") ?? RECORDED_FINDINGS_FILE);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(recorded, null, 2)}\n`);
    console.log(
      `Recorded CORE findings for ${CORE_VIEWS.length} views to ${out}.`
    );
    return 0;
  }
  if (command === "reconcile" && root && rest[0]) {
    const engineAt = rest.indexOf("--engine");
    const { markdown, failed } = reconcileFolder(
      path.resolve(root),
      path.resolve(rest[0]),
      path.resolve(ALLOWLIST_FILE),
      engineAt >= 0 ? rest[engineAt + 1] : "CDISC CORE"
    );
    fs.writeFileSync(path.join(rest[0], "reconciliation.md"), markdown);
    console.log(markdown);
    return failed ? 1 : 0;
  }
  console.error(
    [
      "Usage: tsx scripts/study-data-core.ts export <dir> [--ct-version YYYY-MM-DD]",
      "       tsx scripts/study-data-core.ts export-views <dir> [--ct-version YYYY-MM-DD]",
      "       tsx scripts/study-data-core.ts export-crf <dir> [--ct-version YYYY-MM-DD]",
      "       tsx scripts/study-data-core.ts record <dir> <reports> --core-tag <tag> --core-commit <sha> --crf-inputs <dir> --crf-reports <dir> [--out <file>]",
      "       tsx scripts/study-data-core.ts reconcile <dir> <reports> [--engine <label>]",
      "       tsx scripts/study-data-core.ts reconcile-crf <dir> <reports> [--engine <label>]",
      "       tsx scripts/study-data-core.ts annotate [<recorded-findings.json>]",
    ].join("\n")
  );
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
