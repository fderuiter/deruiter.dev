import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CODE_FILE = /\.(?:[cm]?js|jsx|tsx?)$/u;

/**
 * Paths that are executed rather than imported, mapped to the tests covering them.
 *
 * `vitest related` resolves tests through the module graph. Nothing imports
 * `scripts/build.js`, so staging it selected zero tests — including the suite
 * written specifically to test it. That blind spot is how a regression in the
 * build script reached `main` and printed a live connection string on failure.
 */
export const NON_IMPORTABLE_COVERAGE: Array<{
  match: RegExp;
  testNameMatches: RegExp[];
}> = [
  {
    match: /^scripts\//u,
    testNameMatches: [
      /^build/u,
      /script/u,
      /^dx-/u,
      /guardrail/u,
      /drift/u,
      /openapi/u,
      /compile-docs/u,
    ],
  },
  {
    match: /^\.husky\//u,
    testNameMatches: [
      /hook-wiring/u,
      /guardrail/u,
      /commit-wizard/u,
      /gate-ordering/u,
    ],
  },
  {
    match:
      /^(?:package\.json|vitest\.config\.ts|next\.config\.ts|tsconfig\.json|eslint\.config\.[cm]?js|prisma\.config\.ts)$/u,
    testNameMatches: [
      /package-manager-config/u,
      /gate-ordering/u,
      /dx-tooling/u,
    ],
  },
];

/** Returns staged files (added/copied/modified/renamed). */
export function getStagedFiles(cwd: string): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd, encoding: "utf-8" }
  );

  return output
    .split("\n")
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

/** Returns staged files relevant to the test module graph. */
export function getStagedTestableFiles(cwd: string): string[] {
  return getStagedFiles(cwd).filter((file) => CODE_FILE.test(file));
}

/**
 * Resolves tests covering staged paths that no module imports.
 *
 * @param cwd - Workspace root.
 * @param stagedFiles - Staged paths, repository-relative.
 * @returns Repository-relative test paths, which may be empty.
 */
export function resolveNonImportableTests(
  cwd: string,
  stagedFiles: string[]
): string[] {
  const testsDirectory = path.join(cwd, "__tests__");
  if (!fs.existsSync(testsDirectory)) return [];

  const matchers = NON_IMPORTABLE_COVERAGE.filter((entry) =>
    stagedFiles.some((file) => entry.match.test(file))
  ).flatMap((entry) => entry.testNameMatches);

  if (matchers.length === 0) return [];

  return fs
    .readdirSync(testsDirectory)
    .filter((name) => /\.test\.tsx?$/u.test(name))
    .filter((name) => matchers.some((matcher) => matcher.test(name)))
    .map((name) => path.posix.join("__tests__", name))
    .sort();
}

/**
 * Runs vitest's related-tests mode scoped to the staged module graph, per
 * AGENTS.md's pre-commit testing invariant. Avoids the full-suite run that
 * makes `.husky/pre-commit` too slow to be committable (#648).
 */
export function runStagedTests(cwd: string): void {
  const staged = getStagedFiles(cwd);
  const graphFiles = staged.filter((file) => CODE_FILE.test(file));
  const nonImportable = resolveNonImportableTests(cwd, staged);
  const files = Array.from(new Set([...graphFiles, ...nonImportable]));

  if (files.length === 0) {
    console.log(
      "No staged source or test files affect the module graph — skipping."
    );
    return;
  }

  if (nonImportable.length > 0) {
    console.log(
      `Including ${nonImportable.length} test file(s) covering staged paths that nothing imports.`
    );
  }

  // Git hooks export checkout-local variables. Keep them while reading the
  // staged index above, then remove them from the test process: tests that
  // initialize a temporary repository must not modify this checkout's Git
  // configuration or index. Git supplies the authoritative variable list.
  const testEnv: NodeJS.ProcessEnv = { ...process.env };
  const gitLocalVariables = execFileSync(
    "git",
    ["rev-parse", "--local-env-vars"],
    { cwd, encoding: "utf8" }
  );
  for (const key of gitLocalVariables.trim().split(/\r?\n/u)) {
    delete testEnv[key];
  }

  execFileSync(
    "npx",
    ["vitest", "related", "--run", "--passWithNoTests", ...files],
    {
      cwd,
      stdio: "inherit",
      env: testEnv,
    }
  );
}

if (require.main === module) {
  try {
    runStagedTests(process.cwd());
  } catch (error) {
    const status = (error as { status?: number | null }).status;
    process.exitCode = typeof status === "number" ? status : 1;
  }
}
