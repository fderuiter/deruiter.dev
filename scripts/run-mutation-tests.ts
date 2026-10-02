#!/usr/bin/env node
/**
 * Stryker Mutation Testing Gateway Runner
 * Directly executes Stryker mutation testing using stryker.config.mjs.
 *
 * Optional flags (#1772), passed through to `stryker run`:
 *   --incremental  Reuse results from reports/stryker-incremental.json for
 *                  mutants whose source and covering tests are unchanged.
 *   --force        Run every mutant even in incremental mode, then rewrite
 *                  the incremental report.
 * With no flags it runs every mutant, as before. The score threshold in
 * stryker.config.mjs applies identically in every mode.
 */

import { execFileSync } from "child_process";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const strykerCli = path.resolve(
  workspaceRoot,
  "node_modules/@stryker-mutator/core/bin/stryker.js"
);

/** Flags this runner forwards to Stryker; anything else is rejected. */
export const MUTATION_GATE_FLAGS = ["--incremental", "--force"] as const;

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
  if (args.includes("--force") && !args.includes("--incremental")) {
    // Without --incremental every mutant already runs; --force is a no-op.
    return ["run"];
  }
  return ["run", ...new Set(args)];
}

export function runMutationGate(args: readonly string[] = []): void {
  const strykerArgs = buildStrykerArgs(args);
  console.log(
    `\n🧬 Executing Stryker Mutation Testing Gate (stryker ${strykerArgs.join(" ")})...`
  );
  try {
    execFileSync(process.execPath, [strykerCli, ...strykerArgs], {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_CONFIG_NATIVE_IGNORE_WARNING: "1",
      },
    });
    console.log("\n✅ Stryker Mutation Testing Gate passed.\n");
  } catch (_error) {
    console.error(
      "\n❌ Stryker mutation testing failed or fell below threshold."
    );
    process.exit(1);
  }
}

if (require.main === module) {
  try {
    runMutationGate(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
