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
  PACKAGE_FIXED_TIMESTAMP,
  SDTM_DEFINE_PATH,
  SDTM_PACKAGE_DIR,
  STANDARD_VERSIONS,
  buildStudyDataPackage,
  runConformance,
  runPipeline,
} from "../lib/study-data";

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
  const run = runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
  });
  const built = await buildStudyDataPackage(run, {
    generatedAt: PACKAGE_FIXED_TIMESTAMP,
  });
  const written: string[] = [];
  const write = (relative: string, bytes: Uint8Array | string) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    written.push(relative);
  };
  for (const file of built.files) {
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
        declaredCt,
        validatedCt: ct,
      },
      null,
      2
    )}\n`
  );
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

/** Why a CORE finding is accepted, from the allowlist file. */
export interface AllowlistEntry {
  readonly target: CoreTarget["id"];
  readonly coreId: string;
  readonly dataset: string;
  readonly category: "defect" | "by-design" | "ct-cache" | "core-limitation";
  /** The issue tracking a defect; required for `defect`. */
  readonly issue?: number;
  readonly reason: string;
}

/** The allowlist file, relative to the workspace root. */
export const ALLOWLIST_FILE = "scripts/study-data-core-allowlist.json";

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
    if (!CORE_TARGETS.some((target) => target.id === entry.target)) {
      throw new TypeError(`${where} has an unknown target "${entry.target}".`);
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
    (entry) => ran.includes(entry.target) && !used.has(issueKey(entry))
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
      "       tsx scripts/study-data-core.ts reconcile <dir> <reports> [--engine <label>]",
    ].join("\n")
  );
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
