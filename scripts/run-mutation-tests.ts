#!/usr/bin/env node
/**
 * Stryker Mutation Testing Gateway Runner
 * Directly executes Stryker mutation testing using stryker.config.mjs.
 */

import { execFileSync } from "child_process";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const strykerCli = path.resolve(
  workspaceRoot,
  "node_modules/@stryker-mutator/core/bin/stryker.js"
);

export function runMutationGate(): void {
  console.log("\n🧬 Executing Stryker Mutation Testing Gate...");
  try {
    execFileSync(process.execPath, [strykerCli, "run"], {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: process.env,
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
  runMutationGate();
}
