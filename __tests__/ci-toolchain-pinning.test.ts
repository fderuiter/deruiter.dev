// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TYPECHECK_BUDGET_ARGS } from "../scripts/typecheck-budget";

/**
 * A GitHub Actions `run:` step is a plain shell; unlike an `npm run` script it
 * does not put `node_modules/.bin` on PATH. A bare `tsc` therefore resolves to
 * whatever the runner image happens to ship globally rather than the compiler
 * pinned in package-lock.json, so the gate silently stops checking the code
 * against the toolchain the project actually uses.
 *
 * That is not hypothetical: CI once failed a typecheck on a lib.dom change
 * absent from the pinned TypeScript, an error no lockfile-faithful install
 * could reproduce.
 */
describe("CI Workflow Toolchain Pinning", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");

  /** Binaries supplied by devDependencies, never by the runner image. */
  const projectBinaries = [
    "tsc",
    "eslint",
    "vitest",
    "prisma",
    "next",
    "playwright",
    "depcruise",
    "markdownlint",
    "tsx",
    "typedoc",
  ];

  const workflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

  it("finds workflow files to inspect", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it.each(workflowFiles)(
    "%s invokes project binaries through npm or npx, never bare",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const offenders: string[] = [];

      let insideRunBlock = false;
      let runBlockIndent = 0;

      for (const rawLine of content.split("\n")) {
        const line = rawLine.replace(/\s+$/, "");
        if (line.trim() === "") continue;

        const indent = line.length - line.trimStart().length;
        const trimmed = line.trim();

        // A `run: |` opens a block whose body is indented further.
        const blockRun = trimmed.match(/^run:\s*[|>][-+]?\s*$/);
        if (blockRun) {
          insideRunBlock = true;
          runBlockIndent = indent;
          continue;
        }

        // A single-line `run: <command>`.
        const inlineRun = trimmed.match(/^run:\s*(\S.*)$/);
        if (inlineRun) {
          insideRunBlock = false;
          const first = inlineRun[1].trim().split(/\s+/)[0];
          if (projectBinaries.includes(first)) {
            offenders.push(inlineRun[1].trim());
          }
          continue;
        }

        if (insideRunBlock) {
          if (indent <= runBlockIndent) {
            insideRunBlock = false;
          } else {
            const first = trimmed.split(/\s+/)[0];
            if (projectBinaries.includes(first)) {
              offenders.push(trimmed);
            }
            continue;
          }
        }
      }

      expect(offenders).toEqual([]);
    }
  );

  it("runs the typecheck gate through the pinned compiler", () => {
    const ciPath = path.join(workflowDir, "ci.yml");
    const ci = fs.readFileSync(ciPath, "utf8");
    const typeCheckStep = ci
      .split("- name:")
      .find((section) => section.includes("Type Check"));

    expect(typeCheckStep).toBeDefined();
    expect(typeCheckStep).toContain("npm run typecheck");
    expect(typeCheckStep).not.toMatch(/^\s*tsc\s/m);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    // `next typegen` first, so the check covers the generated route types that
    // Next's own in-build checker used to (#2100). The compiler is TypeScript 7
    // by its explicit path: `.bin/tsc` can link to the TypeScript 6 copy that
    // ESLint, TypeDoc and Next.js load as a library (ADR 0072).
    expect(pkg.scripts.typecheck).toBe(
      "next typegen && node node_modules/@typescript/native/bin/tsc --noEmit --checkers 2"
    );
  });

  /**
   * ADR 0072: TypeScript 7 ships no JavaScript API until 7.1, so `typescript`
   * stays the 6.0 compatibility package for every tool that imports it, and
   * the TypeScript 7 compiler sits beside it under an alias. Swapping either
   * one silently breaks linting, TypeDoc and the Next.js build, or puts the
   * type check back on TypeScript 6.
   */
  it("pins TypeScript 7 as the compiler and TypeScript 6 as the library", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies["@typescript/native"]).toMatch(
      /^npm:typescript@\^7\./
    );
    expect(pkg.devDependencies.typescript).toMatch(
      /^npm:@typescript\/typescript6@\^6\./
    );
  });

  /**
   * The 6.0 compatibility package ships no tsserver, so VS Code's built-in
   * TypeScript support (the fallback when the TypeScript 7 extension is off,
   * and the only host for the Next.js language service plugin) needs the
   * real 6.0 install it re-exports.
   */
  it("points the editor fallback at a TypeScript 6 install with a tsserver", () => {
    const settings = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), ".vscode/settings.json"), "utf8")
    ) as Record<string, string>;
    const tsdk = settings["typescript.tsdk"];
    expect(tsdk).toBe("node_modules/@typescript/old/lib");
    expect(fs.existsSync(path.join(process.cwd(), tsdk, "tsserver.js"))).toBe(
      true
    );
  });

  it("never runs a bare tsc from a package script", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    const bare = Object.entries(pkg.scripts).filter(([, script]) =>
      /(^|[\s"&|;])tsc(\s|"|$)/.test(script)
    );
    expect(bare).toEqual([]);
  });

  /**
   * #2014, #2743, ADR 0072: CI checks the whole program cold and fails when
   * the compiler reports more memory than the budget, so growth fails the
   * pull request before it reaches the production build's type-check phase.
   * The TypeScript 7 compiler is a Go binary, so a V8 heap flag no longer
   * bounds it; the budget reads the compiler's own "Memory used" figure.
   */
  it("runs a cold typecheck in CI under a memory budget", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["typecheck:budget"]).toBe(
      "next typegen && tsx scripts/typecheck-budget.ts"
    );

    expect(TYPECHECK_BUDGET_ARGS).toEqual(
      expect.arrayContaining([
        "--incremental",
        "false",
        "--extendedDiagnostics",
      ])
    );
    const checkers = TYPECHECK_BUDGET_ARGS.indexOf("--checkers");
    expect(TYPECHECK_BUDGET_ARGS[checkers + 1]).toBe("2");

    const ci = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8");
    const typeCheckStep = ci
      .split("- name:")
      .find((section) => section.includes("Type Check"));
    expect(typeCheckStep).toContain("npm run typecheck:budget");
  });

  /**
   * #1771: the browser jobs run in the official Playwright image instead of
   * downloading browsers. The image's browsers must be the ones the locked
   * @playwright/test drives, so a Dependabot bump of either one fails here
   * until the other follows.
   */
  describe("Playwright container image (#1771)", () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8")
    ) as { packages: Record<string, { version?: string }> };
    const locked = lock.packages["node_modules/@playwright/test"]?.version;
    const imagePattern =
      /image: mcr\.microsoft\.com\/playwright:v([\d.]+)-noble@sha256:[0-9a-f]{64}$/gm;

    it("finds the locked @playwright/test version", () => {
      expect(locked).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it.each(workflowFiles)(
      "%s uses an image tag equal to the locked @playwright/test version",
      (file) => {
        const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
        for (const match of content.matchAll(imagePattern)) {
          expect(match[1]).toBe(locked);
        }
        expect(content).not.toMatch(
          /mcr\.microsoft\.com\/playwright:(?!v[\d.]+-noble@sha256:)/
        );
      }
    );

    it("runs every ci.yml job that drives a browser inside that image", () => {
      const ci = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8");
      const lines = ci.split("\n");
      const headers = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /^ {2}[a-z][a-z0-9-]*:$/.test(line));
      const browserJobs = headers
        .map(({ line, index }, i) => ({
          job: line.trim().replace(/:$/, ""),
          block: lines
            .slice(index, headers[i + 1]?.index ?? lines.length)
            .join("\n"),
        }))
        .filter(({ block }) =>
          /playwright test|bench:pages|test:ci:shard/.test(block)
        );
      expect(browserJobs.map(({ job }) => job).sort()).toEqual(
        [
          "bench-gate",
          "cross-device-matrix",
          "device-gate",
          "heavy-gate",
          "unit-gate",
        ].sort()
      );
      for (const { job, block } of browserJobs) {
        expect(block, job).toMatch(imagePattern);
        expect(block, job).toMatch(/options: --user 1001 --ipc=host/);
        expect(block, job).toMatch(/runs-on: ubuntu-latest/);
      }
    });
  });
});
