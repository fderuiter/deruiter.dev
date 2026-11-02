// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  CI_ONLY_TESTS,
  NON_IMPORTABLE_COVERAGE,
  getStagedTestableFiles,
  resolveNonImportableTests,
  stagedVitestArgs,
} from "../scripts/test-staged";

const workspaceRoot = path.resolve(__dirname, "..");

/**
 * `vitest related` resolves tests through the module graph, so a file nothing
 * imports selects nothing. `scripts/build.js` runs on every build and had zero
 * commit-time coverage as a result.
 */
describe("Pre-commit test scope for non-importable paths", () => {
  it("isolates temporary Git repositories in tests from the hook checkout", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "staged-hook-isolation-")
    );
    const repo = path.join(root, "repo");
    const shimDir = path.join(root, "bin");
    fs.mkdirSync(repo);
    fs.mkdirSync(shimDir);
    const env = { ...process.env };
    for (const key of execFileSync("git", ["rev-parse", "--local-env-vars"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n"))
      delete env[key];
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: repo,
        env,
        encoding: "utf8",
      }).trim();
    try {
      git("init", "-q");
      git("config", "user.name", "Hook Checkout");
      fs.writeFileSync(
        path.join(repo, "sample.ts"),
        "export const sample = 1;\n"
      );
      git("add", "sample.ts");
      fs.writeFileSync(
        path.join(shimDir, "npx"),
        '#!/bin/sh\nset -eu\ngit init --bare -q "$ISOLATED_PROBE_DIR"\ngit -C "$ISOLATED_PROBE_DIR" config user.name "Temporary Fixture"\n',
        { mode: 0o755 }
      );
      execFileSync(
        process.execPath,
        [
          path.join(workspaceRoot, "node_modules/tsx/dist/cli.mjs"),
          path.join(workspaceRoot, "scripts/test-staged.ts"),
        ],
        {
          cwd: repo,
          env: {
            ...env,
            GIT_DIR: path.join(repo, ".git"),
            GIT_INDEX_FILE: path.join(repo, ".git/index"),
            ISOLATED_PROBE_DIR: path.join(root, "probe"),
            PATH: `${shimDir}:${env.PATH ?? ""}`,
          },
          stdio: "pipe",
        }
      );
      expect(git("config", "core.bare")).toBe("false");
      expect(git("config", "user.name")).toBe("Hook Checkout");
      expect(git("diff", "--cached", "--name-only")).toBe("sample.ts");
      expect(fs.existsSync(path.join(root, "probe/HEAD"))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("selects the build suite when the build script is staged", () => {
    const selected = resolveNonImportableTests(workspaceRoot, [
      "scripts/build.js",
    ]);
    expect(selected).toContain("__tests__/build.test.ts");
  });

  it("covers the other build-adjacent scripts suites", () => {
    const selected = resolveNonImportableTests(workspaceRoot, [
      "scripts/build.js",
    ]);
    expect(selected).toContain("__tests__/build-script-env-loading.test.ts");
    expect(selected).toContain("__tests__/build-data-source-integrity.test.ts");
  });

  it("selects hook coverage when a husky hook is staged", () => {
    const selected = resolveNonImportableTests(workspaceRoot, [
      ".husky/pre-push",
    ]);
    expect(selected).toContain("__tests__/husky-hook-wiring.test.ts");
    expect(selected).toContain("__tests__/git-guardrail.test.ts");
  });

  it("selects config coverage when root configuration is staged", () => {
    const selected = resolveNonImportableTests(workspaceRoot, ["package.json"]);
    expect(selected.length).toBeGreaterThan(0);
  });

  it("recognizes staged ESM TypeScript alongside existing source types", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "staged-esm-"));
    const env = { ...process.env };
    for (const key of execFileSync("git", ["rev-parse", "--local-env-vars"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n"))
      delete env[key];
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo, env });
      for (const name of [
        "vitest.config.mts",
        "example.ts",
        "example.js",
        "notes.md",
      ])
        fs.writeFileSync(path.join(repo, name), "");
      execFileSync("git", ["add", "."], { cwd: repo, env });
      expect(getStagedTestableFiles(repo).sort()).toEqual([
        "example.js",
        "example.ts",
        "vitest.config.mts",
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("does not pass the staged Vitest config to related as a graph input", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "staged-config-"));
    const bin = path.join(root, "bin");
    const repo = path.join(root, "repo");
    fs.mkdirSync(bin);
    fs.mkdirSync(repo);
    fs.mkdirSync(path.join(repo, "__tests__"));
    const env = { ...process.env };
    for (const key of execFileSync("git", ["rev-parse", "--local-env-vars"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n"))
      delete env[key];
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo, env });
      fs.writeFileSync(path.join(repo, "vitest.config.mts"), "");
      for (const name of [
        "vitest-config-esm.test.ts",
        "coverage-policy-governance.test.ts",
      ])
        fs.writeFileSync(path.join(repo, "__tests__", name), "");
      execFileSync("git", ["add", "vitest.config.mts"], { cwd: repo, env });
      fs.writeFileSync(
        path.join(bin, "npx"),
        '#!/bin/sh\nprintf "%s\n" "$@" > "$ARGS_FILE"\n',
        { mode: 0o755 }
      );
      const argsFile = path.join(root, "args");
      execFileSync(
        process.execPath,
        [
          path.join(workspaceRoot, "node_modules/tsx/dist/cli.mjs"),
          path.join(workspaceRoot, "scripts/test-staged.ts"),
        ],
        {
          cwd: repo,
          env: {
            ...env,
            PATH: `${bin}:${env.PATH ?? ""}`,
            ARGS_FILE: argsFile,
          },
          stdio: "pipe",
        }
      );
      const args = fs.readFileSync(argsFile, "utf8").trim().split("\n");
      expect(args).not.toContain("vitest.config.mts");
      expect(args).toContain("__tests__/vitest-config-esm.test.ts");
      expect(args).toContain("__tests__/coverage-policy-governance.test.ts");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("selects Vitest configuration and coverage policy checks for the ESM config", () => {
    const selected = resolveNonImportableTests(workspaceRoot, [
      "vitest.config.mts",
    ]);
    expect(selected).toContain("__tests__/vitest-config-esm.test.ts");
    expect(selected).toContain("__tests__/coverage-policy-governance.test.ts");
    expect(selected.length).toBeLessThan(40);
  });

  it("stays out of the way for ordinary source changes", () => {
    // The bounded scope from ADR 0033 is the point; this must not become a
    // full-suite run for every commit.
    expect(
      resolveNonImportableTests(workspaceRoot, [
        "components/ui/InlineMarkdown.tsx",
        "lib/sentry-policy.ts",
      ])
    ).toEqual([]);
  });

  it("leaves the recorded CORE findings check to npm test and CI (#3664)", () => {
    expect(CI_ONLY_TESTS).toEqual([
      "__tests__/study-data-core-recorded.test.ts",
    ]);
    expect(stagedVitestArgs(["lib/study-data/index.ts"])).toEqual([
      "vitest",
      "related",
      "--run",
      "--passWithNoTests",
      "--exclude",
      "__tests__/study-data-core-recorded.test.ts",
      "lib/study-data/index.ts",
    ]);
  });

  it("keeps every CI-only test in the suite npm test and CI run", () => {
    const config = fs.readFileSync(
      path.join(workspaceRoot, "vitest.config.mts"),
      "utf8"
    );
    for (const test of CI_ONLY_TESTS) {
      expect(fs.existsSync(path.join(workspaceRoot, test))).toBe(true);
      expect(config).not.toContain(path.basename(test));
    }
    const ci = fs.readFileSync(
      path.join(workspaceRoot, ".github/workflows/ci.yml"),
      "utf8"
    );
    expect(ci).not.toMatch(/test:staged|test-staged/u);
  });

  it("passes the CI-only exclusions with a staged study-data change", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "staged-ci-only-"));
    const bin = path.join(root, "bin");
    const repo = path.join(root, "repo");
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(repo, "lib/study-data"), { recursive: true });
    const env = { ...process.env };
    for (const key of execFileSync("git", ["rev-parse", "--local-env-vars"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n"))
      delete env[key];
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo, env });
      fs.writeFileSync(path.join(repo, "lib/study-data/index.ts"), "");
      execFileSync("git", ["add", "."], { cwd: repo, env });
      fs.writeFileSync(
        path.join(bin, "npx"),
        '#!/bin/sh\nprintf "%s\n" "$@" > "$ARGS_FILE"\n',
        { mode: 0o755 }
      );
      const argsFile = path.join(root, "args");
      execFileSync(
        process.execPath,
        [
          path.join(workspaceRoot, "node_modules/tsx/dist/cli.mjs"),
          path.join(workspaceRoot, "scripts/test-staged.ts"),
        ],
        {
          cwd: repo,
          env: {
            ...env,
            PATH: `${bin}:${env.PATH ?? ""}`,
            ARGS_FILE: argsFile,
          },
          stdio: "pipe",
        }
      );
      expect(fs.readFileSync(argsFile, "utf8").trim().split("\n")).toEqual(
        stagedVitestArgs(["lib/study-data/index.ts"])
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the selection bounded well below the full suite", () => {
    const selected = resolveNonImportableTests(workspaceRoot, [
      "scripts/build.js",
    ]);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThan(40);
  });

  it("returns only existing test files", () => {
    const selected = resolveNonImportableTests(workspaceRoot, [
      "scripts/build.js",
      ".husky/pre-commit",
      "package.json",
    ]);
    for (const file of selected) {
      expect(file.startsWith("__tests__/")).toBe(true);
      expect(/\.test\.tsx?$/u.test(file)).toBe(true);
    }
  });

  it("declares coverage for every non-importable path class", () => {
    const patterns = NON_IMPORTABLE_COVERAGE.map((entry) => entry.match.source);
    expect(patterns.some((p) => p.includes("scripts"))).toBe(true);
    expect(patterns.some((p) => p.includes("husky"))).toBe(true);
    expect(patterns.some((p) => p.includes("package"))).toBe(true);
  });
});
