#!/usr/bin/env node
import { execSync } from "child_process";
import { validateBranchName } from "../lib/dx/git-guard";
import { colors } from "../lib/dx/utils";

function getCurrentBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return "HEAD";
  }
}

/**
 * Renders the failure, naming the command that produces a conforming name.
 *
 * Learning a branch name is wrong is only useful alongside the remedy: at push
 * time the work is already finished, which is the worst moment to rename.
 */
export function formatBranchFailure(branch: string, error: string): string {
  return [
    `${colors.brightRed}❌ Git branch validation failed:${colors.reset}`,
    `  ${colors.red}${error}${colors.reset}`,
    "",
    `  ${colors.brightCyan}Generate a conforming branch and move this work onto it:${colors.reset}`,
    `    ${colors.cyan}npm run dx branch${colors.reset}`,
    "",
    `  ${colors.brightCyan}Or rename the current branch in place:${colors.reset}`,
    `    ${colors.cyan}git branch -m ${branch} fix/<short-description>${colors.reset}`,
    "",
    `  ${colors.gray}To bypass intentionally, set ALLOW_DANGEROUS_GIT=1.${colors.reset}`,
  ].join("\n");
}

function main() {
  if (process.env.ALLOW_DANGEROUS_GIT === "1") {
    process.exit(0);
  }

  const args = process.argv.slice(2);
  const warnOnly = args.includes("--warn");
  const branch =
    args.find((arg) => !arg.startsWith("--")) || getCurrentBranch();
  const result = validateBranchName(branch);

  if (result.valid) {
    if (!warnOnly) {
      console.log(
        `${colors.brightGreen}✔ Branch '${branch}' conforms to naming conventions.${colors.reset}`
      );
    }
    process.exit(0);
  }

  if (warnOnly) {
    // At checkout the branch is new and renaming is free, so this informs
    // rather than blocks; `git checkout -b` is often exploratory.
    console.warn(
      `\n${colors.yellow}⚠ Branch '${branch}' does not follow the naming convention.${colors.reset}`
    );
    console.warn(
      `  ${colors.gray}Expected one of feat/, fix/, chore/, refactor/, docs/, perf/, dx/, test/, dev/, jules/.${colors.reset}`
    );
    console.warn(
      `  ${colors.gray}Renaming now is free; a push will reject it later.${colors.reset}`
    );
    console.warn(`  ${colors.cyan}npm run dx branch${colors.reset}\n`);
    process.exit(0);
  }

  console.error(`\n${formatBranchFailure(branch, result.error ?? "")}\n`);
  process.exit(1);
}

// Keyed on being the entry point rather than on VITEST: the hook that invokes
// this runs inside the test suite, and an env-keyed guard made the validator a
// silent no-op there — the exact "wired to nothing" failure it guards against.
if (require.main === module) {
  main();
}
