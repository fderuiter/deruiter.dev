#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";

/**
 * The CI memory budget for a cold whole-program typecheck (#2014, #2743).
 *
 * Under TypeScript 6 the budget was a V8 heap ceiling passed to node. The
 * TypeScript 7 compiler is a Go binary, so `--max-old-space-size` no longer
 * reaches it. Instead this runs the same check with `--extendedDiagnostics`
 * and fails when the compiler's own "Memory used" figure exceeds the budget.
 * Growth still fails the pull request before it can reach the production
 * build's standalone type-check phase (scripts/build.js Phase 1.4).
 *
 * Measured 2026-10-27 on a 4-core runner with `--checkers 2`: 2.45 GB
 * reported, 3.0 GB peak resident (ADR 0072).
 */
export const TYPECHECK_MEMORY_BUDGET_MB = 3072;

/** The pinned TypeScript 7 entry point; `.bin/tsc` may be TypeScript 6. */
export const TSC7 = path.join(
  "node_modules",
  "@typescript",
  "native",
  "bin",
  "tsc"
);

/** A cold, single-pass check: incremental state would hide most of the work. */
export const TYPECHECK_BUDGET_ARGS = [
  TSC7,
  "--noEmit",
  "--incremental",
  "false",
  "--checkers",
  "2",
  "--extendedDiagnostics",
];

/** Reads "Memory used: 2452909K" from extended diagnostics, in megabytes. */
export function parseMemoryUsedMb(output: string): number | null {
  const match = /^Memory used:\s+(\d+)K\s*$/m.exec(output);
  return match ? Math.round(Number(match[1]) / 1024) : null;
}

function main() {
  const result = spawnSync(process.execPath, TYPECHECK_BUDGET_ARGS, {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const usedMb = parseMemoryUsedMb(result.stdout ?? "");
  if (usedMb === null) {
    console.error(
      "typecheck:budget: no 'Memory used' line in the compiler output."
    );
    process.exit(1);
  }
  if (usedMb > TYPECHECK_MEMORY_BUDGET_MB) {
    console.error(
      `typecheck:budget: the compiler used ${usedMb} MB, over the ${TYPECHECK_MEMORY_BUDGET_MB} MB budget. ` +
        "See ADR 0072 before raising it."
    );
    process.exit(1);
  }
  console.log(
    `typecheck:budget: ${usedMb} MB of ${TYPECHECK_MEMORY_BUDGET_MB} MB.`
  );
}

if (require.main === module) {
  main();
}
