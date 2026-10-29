#!/usr/bin/env node
/**
 * The study command line (epic #3071, step 5): the same workspace
 * operations the Clinical Study Studio screens call, from a terminal.
 *
 * Usage:
 *   npm run study -- <command> [args] [--json]
 *
 * Every command shares one contract. A file that is named must exist and
 * parse; nothing falls back to an example study. `--out`, `--version` and
 * `--design` need a value, and a following flag is not one. With `--json`,
 * stdout is one JSON object and diagnostics go to stderr. Exit codes: 0 ok, 1
 * findings at error level, 2 bad input, 3 revision conflict. Writes go to
 * a temporary file first and are renamed into place, so a failed run never
 * leaves half a file. `npm run crf` keeps working; `study crf ...` runs the
 * same CLI.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exportStudyUsdm,
  importUsdmStudy,
  openStudyWorkspace,
  serializeStudyWorkspace,
  type StudyContentCounts,
  type StudyWorkspace,
} from "../lib/study-workspace";

/** Exit codes shared by every study command. */
export const EXIT = {
  ok: 0,
  findings: 1,
  badInput: 2,
  conflict: 3,
} as const;

/** What a command printed and how it ended. */
export interface StudyCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ParsedArgs {
  readonly positional: string[];
  readonly flags: Map<string, string | true>;
  /** The first value-taking flag given without a value, e.g. `--out`. */
  readonly missingValue: string | null;
}

const VALUE_FLAGS = new Set(["out", "version", "design"]);

/**
 * Splits arguments into positionals and flags. A value-taking flag never
 * swallows the next flag: `--out --json` is a missing value, not an output
 * file named `--json` (#3618). The run reports it before reading or writing
 * anything, and `--json` still selects the JSON error.
 */
function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  let missingValue: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (!VALUE_FLAGS.has(name)) {
        flags.set(name, true);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags.set(name, argv[++i]);
      } else {
        missingValue ??= arg;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags, missingValue };
}

function flagValue(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

class StudyInputError extends Error {}

function readInput(file: string | undefined, label: string): string {
  if (!file) throw new StudyInputError(`missing ${label} file`);
  if (file === "-") return fs.readFileSync(0, "utf-8");
  if (!fs.existsSync(file)) throw new StudyInputError(`no such file: ${file}`);
  return fs.readFileSync(file, "utf-8");
}

/** Writes through a temporary file and a rename, so readers never see half a file. */
function writeAtomic(file: string, text: string): void {
  const temp = path.join(
    path.dirname(path.resolve(file)),
    `.${path.basename(file)}.${process.pid}.tmp`
  );
  fs.writeFileSync(temp, text, "utf-8");
  fs.renameSync(temp, file);
}

function openWorkspaceFile(file: string | undefined): StudyWorkspace {
  const opened = openStudyWorkspace(readInput(file, "workspace"));
  if (opened.status !== "ok") {
    throw new StudyInputError(
      `${file} is not a study workspace (${opened.problem})`
    );
  }
  return opened.workspace;
}

function studyName(workspace: StudyWorkspace): string {
  return workspace.usdm.study.name;
}

function formatCounts(counts: StudyContentCounts): string {
  return Object.entries(counts)
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
}

type Output = { text: string; json: Record<string, unknown> };

async function importCommand(args: ParsedArgs): Promise<Output> {
  const file = args.positional[1];
  const version = flagValue(args, "version");
  const design = flagValue(args, "design");
  if ((version === undefined) !== (design === undefined)) {
    throw new StudyInputError("give --version and --design together");
  }
  const result = await importUsdmStudy(
    { text: readInput(file, "USDM") },
    {
      fileName: file === "-" ? undefined : path.basename(file ?? ""),
      selection:
        version && design
          ? { studyVersionId: version, studyDesignId: design }
          : undefined,
    }
  );
  if (result.status === "rejected") {
    throw new StudyInputError(
      result.problems.map((problem) => problem.message).join("; ")
    );
  }
  if (result.status === "needs-selection") {
    const choices = result.choices
      .map(
        (choice) =>
          `  --version ${choice.studyVersionId} --design ${choice.designs
            .map((d) => d.id)
            .join("|")}`
      )
      .join("\n");
    throw new StudyInputError(
      `the file holds more than one study version or design; choose one:\n${choices}`
    );
  }
  const { workspace, report } = result;
  const out = flagValue(args, "out");
  const dryRun = args.flags.has("dry-run");
  if (out && !dryRun) writeAtomic(out, serializeStudyWorkspace(workspace));
  return {
    text: [
      `Imported ${studyName(workspace)} as revision ${workspace.revision.id}`,
      `  version ${workspace.selection.studyVersionId}, design ${workspace.selection.studyDesignId}`,
      `  ${formatCounts(report.counts)}`,
      `  schema issues ${report.schemaIssues.length}, preserved items ${report.preserved.length}`,
      out ? (dryRun ? `  dry run: ${out} not written` : `  wrote ${out}`) : "",
    ]
      .filter(Boolean)
      .join("\n"),
    json: {
      study: studyName(workspace),
      selection: workspace.selection,
      revision: workspace.revision,
      report,
      written: out && !dryRun ? out : null,
    },
  };
}

async function infoCommand(args: ParsedArgs): Promise<Output> {
  const file = args.positional[1];
  const workspace = openWorkspaceFile(file);
  const reread = await importUsdmStudy(
    { document: workspace.usdm },
    { selection: workspace.selection }
  );
  const counts = reread.status === "ok" ? reread.report.counts : null;
  return {
    text: [
      `${studyName(workspace)} (${file})`,
      `  revision ${workspace.revision.id}: ${workspace.revision.note}`,
      `  version ${workspace.selection.studyVersionId}, design ${workspace.selection.studyDesignId}`,
      `  source ${workspace.source.fileName ?? "unnamed"}, sha256 ${workspace.source.sha256.slice(0, 12)}`,
      counts ? `  ${formatCounts(counts)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    json: {
      study: studyName(workspace),
      selection: workspace.selection,
      revision: workspace.revision,
      source: {
        fileName: workspace.source.fileName,
        sha256: workspace.source.sha256,
      },
      counts,
    },
  };
}

function exportCommand(args: ParsedArgs): Output {
  const workspace = openWorkspaceFile(args.positional[1]);
  const usdm = `${JSON.stringify(exportStudyUsdm(workspace), null, 2)}\n`;
  const out = flagValue(args, "out");
  if (!out) return { text: usdm.trimEnd(), json: { usdm: JSON.parse(usdm) } };
  writeAtomic(out, usdm);
  return {
    text: `Wrote revision ${workspace.revision.id} of ${studyName(workspace)} to ${out}`,
    json: { written: out, revision: workspace.revision },
  };
}

const HELP = `study: work with a USDM study workspace

Usage: npm run study -- <command> [args] [--json]

Commands:
  import <usdm.json|-> [--out ws.study.json] [--version V --design D] [--dry-run]
                     Open a USDM v4 file as a workspace at revision R1
  info <ws.study.json>
                     Show the study, revision, selection and content counts
  export <ws.study.json> [--out usdm.json]
                     Write the working USDM document
  crf <args>         Run the CRF Studio CLI (same as npm run crf)

Exit codes: 0 ok, 1 findings at error level, 2 bad input, 3 revision conflict.`;

/**
 * Runs one study command and returns what it printed, without touching
 * `process`, so tests and the CLI share one path.
 */
export async function runStudyCommand(
  argv: readonly string[]
): Promise<StudyCommandResult> {
  const args = parseArgs(argv);
  const json = args.flags.has("json");
  const command = args.positional[0];
  try {
    if (args.missingValue) {
      throw new StudyInputError(`${args.missingValue} needs a value`);
    }
    let output: Output;
    if (command === "import") output = await importCommand(args);
    else if (command === "info") output = await infoCommand(args);
    else if (command === "export") output = exportCommand(args);
    else if (!command || command === "help" || args.flags.has("help")) {
      return { exitCode: EXIT.ok, stdout: `${HELP}\n`, stderr: "" };
    } else {
      throw new StudyInputError(`unknown command: ${command}\n\n${HELP}`);
    }
    return {
      exitCode: EXIT.ok,
      stdout: `${json ? JSON.stringify(output.json) : output.text}\n`,
      stderr: "",
    };
  } catch (error) {
    if (!(error instanceof StudyInputError)) throw error;
    return {
      exitCode: EXIT.badInput,
      stdout: json ? `${JSON.stringify({ error: error.message })}\n` : "",
      stderr: `study: ${error.message}\n`,
    };
  }
}

function runCrf(argv: readonly string[]): number {
  const crf = path.join(path.dirname(fileURLToPath(import.meta.url)), "crf.ts");
  const child = spawnSync(
    process.execPath,
    [...process.execArgv, crf, ...argv],
    { stdio: "inherit" }
  );
  return child.status ?? EXIT.badInput;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "crf") {
    process.exitCode = runCrf(argv.slice(1));
    return;
  }
  const result = await runStudyCommand(argv);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main();
}
