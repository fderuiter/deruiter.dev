#!/usr/bin/env node
/**
 * Stryker Mutation Testing Gateway Runner
 * Directly executes Stryker mutation testing using
 * config/stryker/stryker.config.mjs.
 *
 * Optional flags (#1772), passed through to `stryker run`:
 *   --incremental  Reuse results from reports/stryker-incremental.json for
 *                  mutants whose source and covering tests are unchanged.
 *   --force        Run every mutant even in incremental mode, then rewrite
 *                  the incremental report.
 *   --engines      Run the weekly game engine scope (#2529) from
 *                  config/stryker/stryker.engines.config.mjs instead, then hold every
 *                  mutated file to its own floor in that config's
 *                  `fileBreaks`.
 *   --garmin       Run the weekly Garmin engine scope (#2564) from
 *                  config/stryker/stryker.garmin.config.mjs the same way.
 *   --study-data   Run the weekly study data derivation scope (#2607) from
 *                  config/stryker/stryker.study-data.config.mjs the same way. Pass one
 *                  scope at most.
 * With no flags it runs every mutant, as before. The score threshold in
 * config/stryker/stryker.config.mjs applies identically in every mode.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const workspaceRoot = path.resolve(__dirname, "..");
const strykerCli = path.resolve(
  workspaceRoot,
  "node_modules/@stryker-mutator/core/bin/stryker.js"
);

/** Flags this runner forwards to Stryker; anything else is rejected. */
export const MUTATION_GATE_FLAGS = [
  "--incremental",
  "--force",
  "--engines",
  "--garmin",
  "--study-data",
] as const;

/** The PR mutation gate's scope, used when no weekly scope is named. */
const BASE_CONFIG = "config/stryker/stryker.config.mjs";

/**
 * Weekly scopes that run from their own config and hold a break per file
 * (#2529). The Garmin engine has its own scope (#2564) because its 4,000
 * mutants would push the shared engine job past its time bound, and the
 * study data derivations (#2607) for the same reason.
 */
const SCOPE_CONFIGS: Record<string, string> = {
  "--engines": "config/stryker/stryker.engines.config.mjs",
  "--garmin": "config/stryker/stryker.garmin.config.mjs",
  "--study-data": "config/stryker/stryker.study-data.config.mjs",
};

/** Validates runner arguments and returns the `stryker run` argv. */
export function buildStrykerArgs(args: readonly string[]): string[] {
  const unknown = args.filter(
    (arg) => !(MUTATION_GATE_FLAGS as readonly string[]).includes(arg)
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown mutation gate option(s): ${unknown.join(", ")}. Allowed: ${MUTATION_GATE_FLAGS.join(", ")}.`
    );
  }
  const scopes = Object.keys(SCOPE_CONFIGS).filter((flag) =>
    args.includes(flag)
  );
  if (scopes.length > 1) {
    throw new Error(
      `Pick one mutation scope, not ${scopes.join(" and ")}: each runs as its own job.`
    );
  }
  const config = scopes.length > 0 ? SCOPE_CONFIGS[scopes[0]] : BASE_CONFIG;
  const modes = [...new Set(args)].filter((arg) => !(arg in SCOPE_CONFIGS));
  if (modes.includes("--force") && !modes.includes("--incremental")) {
    // Without --incremental every mutant already runs; --force is a no-op.
    return ["run", config];
  }
  return ["run", config, ...modes];
}

/** The slice of Stryker's JSON report the per-file floors read. */
export interface MutationReport {
  files: Record<string, { mutants: { status: string }[] }>;
}

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

/**
 * Each file's mutation score as Stryker computes it: detected mutants over
 * valid ones (compile and runtime errors and ignored mutants don't count).
 */
export function fileScores(report: MutationReport): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [file, { mutants }] of Object.entries(report.files)) {
    const detected = mutants.filter((m) => DETECTED.has(m.status)).length;
    const valid =
      detected + mutants.filter((m) => UNDETECTED.has(m.status)).length;
    scores[file.split(path.sep).join("/")] =
      valid === 0 ? 100 : (detected / valid) * 100;
  }
  return scores;
}

/** Files below their floor, or missing from the report, one line each. */
export function fileBreakFailures(
  scores: Record<string, number>,
  breaks: Record<string, number>
): string[] {
  return Object.entries(breaks).flatMap(([file, floor]) => {
    const score = scores[file];
    if (score === undefined) return [`${file}: not in the report`];
    return score < floor
      ? [`${file}: ${score.toFixed(2)}% is below its break of ${floor}%`]
      : [];
  });
}

async function checkScopeFileBreaks(config: string): Promise<void> {
  const { fileBreaks, ENGINES_JSON_REPORT } = (await import(
    pathToFileURL(path.join(workspaceRoot, config)).href
  )) as { fileBreaks: Record<string, number>; ENGINES_JSON_REPORT: string };
  const report = JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, ENGINES_JSON_REPORT), "utf8")
  ) as MutationReport;
  const scores = fileScores(report);
  for (const file of Object.keys(fileBreaks)) {
    console.log(
      `  ${file}: ${scores[file]?.toFixed(2) ?? "missing"}% (break ${fileBreaks[file]})`
    );
  }
  const failures = fileBreakFailures(scores, fileBreaks);
  if (failures.length > 0) {
    console.error(
      `\n❌ Per-file mutation breaks failed:\n${failures.join("\n")}`
    );
    process.exit(1);
  }
}

export async function runMutationGate(
  args: readonly string[] = []
): Promise<void> {
  const strykerArgs = buildStrykerArgs(args);
  console.log(
    `\n🧬 Executing Stryker Mutation Testing Gate (stryker ${strykerArgs.join(" ")})...`
  );
  try {
    execFileSync(process.execPath, [strykerCli, ...strykerArgs], {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: process.env,
    });
  } catch (_error) {
    console.error(
      "\n❌ Stryker mutation testing failed or fell below threshold."
    );
    process.exit(1);
  }
  const scope = Object.keys(SCOPE_CONFIGS).find((flag) => args.includes(flag));
  if (scope) await checkScopeFileBreaks(SCOPE_CONFIGS[scope]);
  console.log("\n✅ Stryker Mutation Testing Gate passed.\n");
}

if (require.main === module) {
  runMutationGate(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
