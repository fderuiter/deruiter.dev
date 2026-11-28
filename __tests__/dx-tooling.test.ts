// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { spawnSync } from "child_process";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import { validateEnv, getEnv } from "../lib/env";
import {
  validateCommitMessage,
  validateBranchName,
  checkGitHygieneConfig,
} from "../lib/dx/git-guard";
import {
  getDeclaredEnvKeys,
  parseEnvFile,
  generateEnvExampleContent,
  checkEnvironmentVariables,
  checkRawEnvironmentAccess,
} from "../lib/dx/env-guard";
import {
  extractExports,
  scanDeadCode,
  checkDeadCode,
} from "../lib/dx/dead-code";
import * as bundleGuard from "../lib/dx/bundle-guard";
import { handleAnalyzeCommand } from "../scripts/dx";
import {
  checkServiceResultTypes,
  checkSetStateInEffectCeiling,
  checkTechnicalGuideSchemaParity,
  checkWorkspaceIdeConfig,
  findServiceContractViolations,
} from "../lib/dx/doctor";
import {
  OFFLINE_DEBUG_DATABASE_URL,
  REQUIRED_TYPESCRIPT_TSDK,
  REQUIRED_VSCODE_EXTENSIONS,
  TSC_WATCH_PROBLEM_MATCHER,
  WORKSPACE_EXCLUDED_PATHS,
  shouldSkipWorkspaceDirectory,
} from "../lib/dx/workspace-config";

describe("Developer Experience (DX) Tooling Suite", () => {
  const root = path.resolve(process.cwd());

  describe("1. Environment Schema & Drift Sentinel", () => {
    it("validates server and client environment schemas", () => {
      const validMockEnv = {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      };

      const result = validateEnv(validMockEnv);
      expect(result.success).toBe(true);
      expect(result.data.DATABASE_URL).toBe(
        "postgresql://user:pass@localhost:5432/db"
      );
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    });

    it("catches malformed environment variables", () => {
      const invalidMockEnv = {
        UPSTASH_REDIS_REST_URL: "not-a-valid-url",
        NEXT_PUBLIC_APP_URL: "also-not-a-url",
      };

      const result = validateEnv(invalidMockEnv);
      expect(result.success).toBe(false);
      expect(result.errors["UPSTASH_REDIS_REST_URL"]).toBeDefined();
      expect(result.errors["NEXT_PUBLIC_APP_URL"]).toBeDefined();
    });

    it("extracts all declared schema keys including DX keys", () => {
      const { serverKeys, clientKeys, allKeys } = getDeclaredEnvKeys();
      expect(serverKeys).toContain("DATABASE_URL");
      expect(serverKeys).toContain("CRON_SECRET");
      expect(serverKeys).toContain("npm_config_user_agent");
      expect(serverKeys).toContain("PLAYWRIGHT_BROWSERS_PATH");
      expect(clientKeys).toContain("NEXT_PUBLIC_APP_URL");
      expect(allKeys.length).toBeGreaterThan(5);
    });

    it("parses DX environment keys cleanly via validateEnv and getEnv", () => {
      const mockDxEnv = {
        npm_config_user_agent: "npm/10.8.2 node/v22.0.0 linux x64",
        PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
      };

      const result = validateEnv(mockDxEnv);
      expect(result.success).toBe(true);
      expect(result.data.npm_config_user_agent).toBe(
        "npm/10.8.2 node/v22.0.0 linux x64"
      );
      expect(result.data.PLAYWRIGHT_BROWSERS_PATH).toBe("/ms-playwright");

      expect(getEnv()).toBeDefined();
    });

    it("parses .env key-value pairs accurately", () => {
      const sample = `
        # Comment line
        DATABASE_URL="postgresql://localhost:5432/db"
        PORT=3000
        EMPTY=
      `;
      const tempPath = path.join(root, "scratch", "temp-env-test.env");
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      fs.writeFileSync(tempPath, sample, "utf-8");

      const parsed = parseEnvFile(tempPath);
      expect(parsed.DATABASE_URL).toBe("postgresql://localhost:5432/db");
      expect(parsed.PORT).toBe("3000");
      expect(parsed.EMPTY).toBe("");

      fs.unlinkSync(tempPath);
    });

    it("generates a clean .env.example without leaking secrets", () => {
      const generated = generateEnvExampleContent();
      expect(generated).toContain("DATABASE_URL=");
      expect(generated).toContain("UPSTASH_REDIS_REST_URL=");
      expect(generated).not.toMatch(/npg_[A-Za-z0-9]{12,}/); // Must never contain a Neon role password
    });

    it("passes checkEnvironmentVariables diagnostic check", () => {
      const result = checkEnvironmentVariables(root, false);
      expect(result.status).toBe("pass");
      expect(result.id).toBe("env-schema-parity");
    });

    it("verifies zero raw process.env accesses across app, lib, components, and hooks", () => {
      const result = checkRawEnvironmentAccess(root);
      expect(result.violations).toEqual([]);
    });

    it("audits lib/dx/ modules and flags raw process.env accesses", () => {
      const tempDir = path.join(root, "scratch", "temp-env-audit-test");
      const tempDxFile = path.join(tempDir, "lib", "dx", "mock-tool.ts");
      fs.mkdirSync(path.dirname(tempDxFile), { recursive: true });
      fs.writeFileSync(
        tempDxFile,
        "export const agent = process.env.npm_config_user_agent;\n",
        "utf-8"
      );

      try {
        const result = checkRawEnvironmentAccess(tempDir);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations[0]).toContain("lib/dx/mock-tool.ts");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("2. Conventional Commits & Git Hygiene Guard", () => {
    it("validates compliant Conventional Commit messages", () => {
      const validMessages = [
        "feat(proof): add modus ponens inference operator",
        "fix(dx): resolve doctor environment parity check",
        "docs: update architecture diagrams",
        "dx(cli): enhance interactive commit wizard",
        "refactor(crf): simplify recursive descent AST evaluator",
        "perf(layout): optimize pretext canvas caching",
        "test(engine): add property fuzzing for deduction ledger",
        "chore(deps): bump tailwindcss",
        "feat(auth)!: replace session cookie format",
      ];

      for (const msg of validMessages) {
        const result = validateCommitMessage(msg);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.parsed).toBeDefined();
      }
    });

    it("rejects non-compliant commit messages with actionable errors", () => {
      const invalidCases = [
        { msg: "", expected: "empty" },
        { msg: "Updated some files", expected: "Header must follow format" },
        { msg: "invalidtype: add something", expected: "Invalid type" },
        { msg: "feat: Upper Case Subject", expected: "lowercase" },
        { msg: "fix: ended with a period.", expected: "period" },
        {
          msg: "feat(very-long-scope): " + "a".repeat(110),
          expected: "exceeds 100 characters",
        },
      ];

      for (const { msg, expected } of invalidCases) {
        const result = validateCommitMessage(msg);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes(expected))).toBe(true);
      }
    });

    it("allows standard git merge and SemVer release commits while rejecting non-conventional v* prose", () => {
      expect(
        validateCommitMessage("Merge branch 'main' into feat/dx").valid
      ).toBe(true);
      expect(
        validateCommitMessage('Revert "feat: something broken"').valid
      ).toBe(true);
      expect(validateCommitMessage("v1.0.0").valid).toBe(true);
      expect(validateCommitMessage("v1.2.3").valid).toBe(true);
      expect(validateCommitMessage("v1.2.3-rc.1+build.4").valid).toBe(true);
      expect(
        validateCommitMessage("verify broken non-conventional msg").valid
      ).toBe(false);
      expect(validateCommitMessage("v1.2.3 non-conventional prose").valid).toBe(
        false
      );
    });

    it("accepts domain acronyms (CDISC, USDM, README, CI, SQL) while rejecting title-cased subjects", () => {
      for (const validMsg of [
        "feat: CDISC SDTM export",
        "feat: USDM study version",
        "docs: README quickstart",
        "ci: CI shard cache",
        "perf: SQL query plan",
      ]) {
        const result = validateCommitMessage(validMsg);
        expect(result.valid, validMsg).toBe(true);
        expect(result.errors).toEqual([]);
      }

      for (const invalidMsg of [
        "feat: Upper Case Subject",
        "docs: A single capital letter",
      ]) {
        const result = validateCommitMessage(invalidMsg);
        expect(result.valid, invalidMsg).toBe(false);
        expect(result.errors.join("\n")).toContain("lowercase");
      }
    });

    it("validates messages containing shell metacharacters such as backticks, subshell syntax, or semicolons", () => {
      const metacharacterMessages = [
        "fix(dx): support `code_symbol` in commit header",
        "feat(a11y): prevent $(rm -rf /) subshell evaluation",
        "chore(deps): update package; echo injected",
        "refactor(crf): handling \"double quotes\" and 'single quotes'",
      ];

      for (const msg of metacharacterMessages) {
        const result = validateCommitMessage(msg);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it("validates branch names against team conventions", () => {
      expect(validateBranchName("main").valid).toBe(true);
      expect(validateBranchName("feat/add-dx-suite").valid).toBe(true);
      expect(validateBranchName("fix/proof-ast-bug").valid).toBe(true);
      expect(validateBranchName("dx/commit-wizard").valid).toBe(true);
      expect(
        validateBranchName("jules/add-anthropic-google-secret-detectors").valid
      ).toBe(true);

      const invalidBranch = validateBranchName("random_branch_name");
      expect(invalidBranch.valid).toBe(false);
      expect(invalidBranch.error).toContain("Expected prefixes");
    });

    // ci/ matches the Conventional Commits ci type, for workflow changes.
    it("accepts ci/ branches, and still rejects near-misses", () => {
      expect(validateBranchName("ci/core-staleness-main").valid).toBe(true);
      expect(validateBranchName("ci-core-staleness").valid).toBe(false);
      expect(validateBranchName("cicd/core-staleness").valid).toBe(false);
      expect(validateBranchName("ci/Uppercase").valid).toBe(false);
      expect(validateBranchName("no-prefix").error).toContain("ci/");
    });

    it("accepts test/, dev/ and Jules agent branches, and still rejects near-misses", () => {
      expect(validateBranchName("test/crf-autosave").valid).toBe(true);
      expect(validateBranchName("dev/scratch-spike").valid).toBe(true);
      expect(
        validateBranchName(
          "jules/test-dungeon-tsp-jm1-18c22370-cdca-4c40-9ea9-0770e0597b82"
        ).valid
      ).toBe(true);
      expect(
        validateBranchName(
          "jules/feat/public-route-drift-checks-jm1-a48796dc-f2e1-4304-8c10-7d53506719e2"
        ).valid
      ).toBe(true);

      expect(validateBranchName("jules-cleanup").valid).toBe(false);
      expect(validateBranchName("Jules/Uppercase").valid).toBe(false);
      expect(validateBranchName("jules/Uppercase").valid).toBe(false);
      expect(validateBranchName("stitch/feat/example").valid).toBe(false);
      expect(validateBranchName("stitch/fix/example").valid).toBe(false);
    });

    it("rejects claude/ cloud branches and points them to dx/", () => {
      const cloudBranch = validateBranchName("claude/project-thread-4n2nl3");
      expect(cloudBranch.valid).toBe(false);
      expect(cloudBranch.error).toContain("dx/<slug>");
      expect(validateBranchName("dx/project-thread-4n2nl3").valid).toBe(true);
    });

    it("passes checkGitHygieneConfig diagnostic check", () => {
      const result = checkGitHygieneConfig(root, false);
      expect(result.status).toBe("pass");
      expect(result.id).toBe("git-hygiene-config");
    });

    it("repairs missing hooks, 0o755 modes, and worktree .husky/_ links so an immediate recheck passes", () => {
      const tempMain = fs.mkdtempSync(
        path.join(os.tmpdir(), "git-hygiene-main-")
      );
      const tempWorktree = path.join(
        os.tmpdir(),
        `git-hygiene-wt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      );

      try {
        const git = (...args: string[]) =>
          spawnSync("git", args, { cwd: tempMain, encoding: "utf-8" });
        git("init", "-q");
        git("config", "user.email", "test@example.com");
        git("config", "user.name", "Test");
        git("config", "commit.gpgsign", "false");
        fs.writeFileSync(path.join(tempMain, "seed.txt"), "seed\n");
        git("add", "seed.txt");
        git("commit", "-qm", "chore: seed");

        // Missing hooks on main checkout fail first, repair on fix=true, then pass immediately.
        expect(checkGitHygieneConfig(tempMain, false).status).toBe("fail");
        expect(checkGitHygieneConfig(tempMain, true).status).toBe("fixed");
        expect(checkGitHygieneConfig(tempMain, false).status).toBe("pass");

        // Degrade modes to 0o644 on a Husky hook, Claude hook, and git-guardrail.sh.
        const extraClaudeHook = path.join(
          tempMain,
          ".claude",
          "hooks",
          "session-start.sh"
        );
        fs.writeFileSync(extraClaudeHook, "#!/usr/bin/env bash\nexit 0\n", {
          encoding: "utf-8",
          mode: 0o644,
        });
        if (process.platform !== "win32") {
          fs.chmodSync(path.join(tempMain, ".husky", "pre-push"), 0o644);
          fs.chmodSync(extraClaudeHook, 0o644);
          fs.chmodSync(
            path.join(tempMain, "scripts", "git-guardrail.sh"),
            0o644
          );

          const modeFailure = checkGitHygieneConfig(tempMain, false);
          expect(modeFailure.status).toBe("fail");
          expect(modeFailure.details?.join("\n")).toContain(".husky/pre-push");
          expect(modeFailure.details?.join("\n")).toContain(
            ".claude/hooks/session-start.sh"
          );
          expect(modeFailure.details?.join("\n")).toContain(
            "scripts/git-guardrail.sh"
          );

          expect(checkGitHygieneConfig(tempMain, true).status).toBe("fixed");
          expect(checkGitHygieneConfig(tempMain, false).status).toBe("pass");
          expect(
            fs.statSync(path.join(tempMain, "scripts", "git-guardrail.sh"))
              .mode & 0o777
          ).toBe(0o755);
        }

        // Create a linked git worktree and verify .husky/_ symlink repair.
        fs.mkdirSync(path.join(tempMain, ".husky", "_"), { recursive: true });
        git(
          "worktree",
          "add",
          "-q",
          "-b",
          "feat/worktree-hygiene",
          tempWorktree
        );

        const wtInitial = checkGitHygieneConfig(tempWorktree, false);
        expect(wtInitial.status).toBe("fail");
        expect(wtInitial.details?.join("\n")).toContain(".husky/_");

        const wtFixed = checkGitHygieneConfig(tempWorktree, true);
        expect(wtFixed.status).toBe("fixed");
        expect(checkGitHygieneConfig(tempWorktree, false).status).toBe("pass");

        const wtHuskyLink = path.join(tempWorktree, ".husky", "_");
        expect(fs.lstatSync(wtHuskyLink).isSymbolicLink()).toBe(true);
        expect(fs.realpathSync(wtHuskyLink)).toBe(
          fs.realpathSync(path.join(tempMain, ".husky", "_"))
        );
      } finally {
        fs.rmSync(tempWorktree, { recursive: true, force: true });
        fs.rmSync(tempMain, { recursive: true, force: true });
      }
    });
  });

  describe("3. Dead Code & Export Scanner", () => {
    it("extracts named exports accurately from TypeScript source", () => {
      const sampleCode = `
        export const API_VERSION = "v1";
        export function computeTotal(a: number, b: number): number {
          return a + b;
        }
        export type UserRole = "admin" | "user";
        export interface ConfigOptions {
          debug: boolean;
        }
        export class EngineService {}
        export enum Status {
          Active = "ACTIVE"
        }
        export default function App() {}
      `;

      const exports = extractExports("/path/sample.ts", sampleCode);
      const names = exports.map((e) => e.name);

      expect(names).toContain("API_VERSION");
      expect(names).toContain("computeTotal");
      expect(names).toContain("UserRole");
      expect(names).toContain("ConfigOptions");
      expect(names).toContain("EngineService");
      expect(names).toContain("Status");
      expect(names).toContain("default");
    });

    it("scans workspace files and reports dead code findings cleanly", () => {
      const report = scanDeadCode(root);
      expect(report.totalScannedFiles).toBeGreaterThan(10);
      expect(report.totalExports).toBeGreaterThan(50);
      expect(Array.isArray(report.unusedExports)).toBe(true);
    });

    it("passes or cleanly warns in checkDeadCode diagnostic check", () => {
      const result = checkDeadCode(root);
      expect(["pass", "warn"]).toContain(result.status);
      expect(result.id).toBe("dead-code-scanner");
    });
  });

  describe("4. Bundle Performance Budget Guard", () => {
    it("inspects bundle chunks without throwing", () => {
      const report = bundleGuard.inspectBundleChunks(root);
      expect(typeof report.isBuilt).toBe("boolean");
      expect(Array.isArray(report.chunks)).toBe(true);
      expect(Array.isArray(report.violations)).toBe(true);
    });

    it("passes checkBundleBudgets diagnostic check when compliant or unbuilt", () => {
      const emptyDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dx-bundle-empty-")
      );
      try {
        const result = bundleGuard.checkBundleBudgets(emptyDir);
        expect(result.status).toBe("pass");
        expect(result.id).toBe("bundle-performance-budgets");
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("measures App Router rootMainFiles and shared HTML chunks and returns fail on breaches", () => {
      const tempBuildRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "dx-bundle-app-router-")
      );
      try {
        const chunksDir = path.join(tempBuildRoot, ".next", "static", "chunks");
        const appHtmlDir = path.join(tempBuildRoot, ".next", "server", "app");
        fs.mkdirSync(path.join(appHtmlDir, "about"), { recursive: true });
        fs.mkdirSync(chunksDir, { recursive: true });

        const rootNames = [
          "webpack-1.js",
          "root-a.js",
          "root-b.js",
          "root-c.js",
          "root-d.js",
          "main-app-1.js",
        ];
        for (const [idx, name] of rootNames.entries()) {
          fs.writeFileSync(
            path.join(chunksDir, name),
            `console.log("root-${idx}-${"a".repeat(256)}");\n`
          );
        }
        fs.writeFileSync(
          path.join(chunksDir, "shared-layout.js"),
          `console.log("shared-${"b".repeat(512)}");\n`
        );
        fs.writeFileSync(
          path.join(chunksDir, "route-only.js"),
          `console.log("route-only-${"c".repeat(512)}");\n`
        );
        fs.writeFileSync(
          path.join(chunksDir, "polyfills-1.js"),
          `console.log("polyfill-${"d".repeat(512)}");\n`
        );
        // Unused Pages Router chunk must NOT inflate App Router initial shared JS.
        fs.writeFileSync(
          path.join(chunksDir, "main-unused-pages.js"),
          `console.log("unused-pages-${"e".repeat(1024)}");\n`
        );
        // Lazy ELK vendor chunk under 500 KB ceiling should pass.
        fs.writeFileSync(
          path.join(chunksDir, "elk-lazy.js"),
          `/* elk.alg.common */ console.log("${"f".repeat(1024)}");\n`
        );

        fs.writeFileSync(
          path.join(tempBuildRoot, ".next", "build-manifest.json"),
          JSON.stringify({
            polyfillFiles: ["static/chunks/polyfills-1.js"],
            rootMainFiles: rootNames.map((n) => `static/chunks/${n}`),
            pages: { "/_app": [] },
          })
        );

        const sharedScripts = [...rootNames, "shared-layout.js"]
          .map(
            (n) => `<script src="/_next/static/chunks/${n}" async=""></script>`
          )
          .join("");
        fs.writeFileSync(
          path.join(appHtmlDir, "index.html"),
          `<html><head><script src="/_next/static/chunks/polyfills-1.js" noModule=""></script>${sharedScripts}<script src="/_next/static/chunks/route-only.js" async=""></script></head></html>`
        );
        fs.writeFileSync(
          path.join(appHtmlDir, "about", "page.html"),
          `<html><head>${sharedScripts}</head></html>`
        );
        fs.writeFileSync(
          path.join(appHtmlDir, "_not-found.html"),
          `<html><head></head></html>`
        );

        const report = bundleGuard.inspectBundleChunks(tempBuildRoot, {
          filter: ".js",
          limit: 20,
        });
        expect(report.isBuilt).toBe(true);
        expect(report.violations).toEqual([]);
        expect(report.rootMainFilesGzipBytes).toBeGreaterThan(0);
        expect(report.initialSharedGzipBytes).toBeGreaterThan(
          report.rootMainFilesGzipBytes ?? 0
        );
        const initialNames = report.chunks
          .filter((c) => c.isInitial)
          .map((c) => c.name)
          .sort();
        expect(initialNames).toEqual([...rootNames, "shared-layout.js"].sort());
        expect(bundleGuard.checkBundleBudgets(tempBuildRoot).status).toBe(
          "pass"
        );

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        bundleGuard.printBundleReport(report, { limit: 2 });
        logSpy.mockRestore();

        // Exceed 220 KB rootMainFiles ceiling and 525 KB shared ceiling with incompressible bytes -> status "fail".
        fs.writeFileSync(
          path.join(chunksDir, "root-a.js"),
          crypto.randomBytes(240 * 1024)
        );
        fs.writeFileSync(
          path.join(chunksDir, "shared-layout.js"),
          crypto.randomBytes(310 * 1024)
        );

        const failingCheck = bundleGuard.checkBundleBudgets(tempBuildRoot);
        expect(failingCheck.status).toBe("fail");
        expect(failingCheck.details?.join("\n")).toContain(
          "rootMainFiles bundle"
        );
        expect(failingCheck.details?.join("\n")).toContain(
          "Initial shared bundle"
        );
      } finally {
        fs.rmSync(tempBuildRoot, { recursive: true, force: true });
      }
    });

    it("fails handleAnalyzeCommand --strict when .next is missing or standalone bundle exceeds 80KB", () => {
      const spyInspect = vi
        .spyOn(bundleGuard, "inspectBundleChunks")
        .mockReturnValue({
          isBuilt: false,
          totalChunks: 0,
          totalRawBytes: 0,
          totalGzipBytes: 0,
          rootMainFilesGzipBytes: 0,
          initialSharedGzipBytes: 0,
          chunks: [],
          violations: [],
        });
      const spyExit = vi
        .spyOn(process, "exit")
        .mockImplementation((code?: string | number | null | undefined) => {
          throw new Error(`process.exit(${code})`);
        });
      const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        expect(() => handleAnalyzeCommand(["--strict"])).toThrow(
          "process.exit(1)"
        );
        expect(() => handleAnalyzeCommand(["--strict", "--json"])).toThrow(
          "process.exit(1)"
        );

        spyInspect.mockReturnValue({
          isBuilt: true,
          totalChunks: 1,
          totalRawBytes: 1024,
          totalGzipBytes: 512,
          rootMainFilesGzipBytes: 512,
          initialSharedGzipBytes: 512,
          chunks: [],
          violations: [],
        });
        const spyStandalone = vi
          .spyOn(bundleGuard, "inspectStandaloneBundle")
          .mockReturnValue({
            exists: true,
            sizeBytes: 85 * 1024,
            violation:
              "Standalone JavaScript asset '.next/standalone-engine/garmin-engine.js' (85.0 kB) exceeds maximum budget of 80.0 kB.",
          });
        try {
          expect(() => handleAnalyzeCommand(["--strict"])).toThrow(
            "process.exit(1)"
          );
        } finally {
          spyStandalone.mockRestore();
        }
      } finally {
        spyInspect.mockRestore();
        spyExit.mockRestore();
        spyLog.mockRestore();
      }
    });

    it("runs handleAnalyzeCommand without strict flag and does not exit on violations", () => {
      const spyInspect = vi
        .spyOn(bundleGuard, "inspectBundleChunks")
        .mockReturnValue({
          isBuilt: true,
          totalChunks: 1,
          totalRawBytes: 500000,
          totalGzipBytes: 400000,
          initialSharedGzipBytes: 400000,
          chunks: [
            {
              name: "oversized-chunk.js",
              relativePath: "static/chunks/oversized-chunk.js",
              rawBytes: 500000,
              gzipBytes: 400000,
              isInitial: true,
            },
          ],
          violations: [
            "Chunk 'oversized-chunk.js' (400.0 kB gzip) exceeds maximum chunk budget of 350 kB.",
          ],
        });

      const spyExit = vi
        .spyOn(process, "exit")
        .mockImplementation((code?: string | number | null | undefined) => {
          throw new Error(`process.exit(${code})`);
        });

      expect(() => handleAnalyzeCommand([])).not.toThrow();

      spyInspect.mockRestore();
      spyExit.mockRestore();
    });

    it("runs handleAnalyzeCommand with strict flag and exits with code 1 on violations", () => {
      const spyInspect = vi
        .spyOn(bundleGuard, "inspectBundleChunks")
        .mockReturnValue({
          isBuilt: true,
          totalChunks: 1,
          totalRawBytes: 500000,
          totalGzipBytes: 400000,
          initialSharedGzipBytes: 400000,
          chunks: [
            {
              name: "oversized-chunk.js",
              relativePath: "static/chunks/oversized-chunk.js",
              rawBytes: 500000,
              gzipBytes: 400000,
              isInitial: true,
            },
          ],
          violations: [
            "Chunk 'oversized-chunk.js' (400.0 kB gzip) exceeds maximum chunk budget of 350 kB.",
          ],
        });

      const spyExit = vi
        .spyOn(process, "exit")
        .mockImplementation((code?: string | number | null | undefined) => {
          throw new Error(`process.exit(${code})`);
        });

      expect(() => handleAnalyzeCommand(["--strict"])).toThrow(
        "process.exit(1)"
      );

      spyInspect.mockRestore();
      spyExit.mockRestore();
    });

    it("runs handleAnalyzeCommand with strict flag and passes cleanly when no violations exist", () => {
      const spyInspect = vi
        .spyOn(bundleGuard, "inspectBundleChunks")
        .mockReturnValue({
          isBuilt: true,
          totalChunks: 1,
          totalRawBytes: 10000,
          totalGzipBytes: 5000,
          initialSharedGzipBytes: 5000,
          chunks: [
            {
              name: "small-chunk.js",
              relativePath: "static/chunks/small-chunk.js",
              rawBytes: 10000,
              gzipBytes: 5000,
              isInitial: true,
            },
          ],
          violations: [],
        });

      const spyExit = vi
        .spyOn(process, "exit")
        .mockImplementation((code?: string | number | null | undefined) => {
          throw new Error(`process.exit(${code})`);
        });

      expect(() => handleAnalyzeCommand(["--strict"])).not.toThrow();

      spyInspect.mockRestore();
      spyExit.mockRestore();
    });
  });

  describe("5. IDE & Workspace Configuration Integrity", () => {
    const createIdeFixture = (): string => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dx-ide-config-test-")
      );
      const result = checkWorkspaceIdeConfig(tempDir, true);
      expect(result.status).toBe("fixed");
      return tempDir;
    };

    it("verifies that all .vscode files, .claude/launch.json, .editorconfig, and Prettier configs exist", () => {
      expect(fs.existsSync(path.join(root, ".editorconfig"))).toBe(true);
      expect(fs.existsSync(path.join(root, ".prettierrc"))).toBe(true);
      expect(fs.existsSync(path.join(root, ".prettierignore"))).toBe(true);
      expect(fs.existsSync(path.join(root, ".vscode", "settings.json"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(root, ".vscode", "extensions.json"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(root, ".vscode", "launch.json"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(root, ".vscode", "tasks.json"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(root, ".claude", "launch.json"))).toBe(
        true
      );
    });

    it("passes checkWorkspaceIdeConfig diagnostic check", () => {
      const result = checkWorkspaceIdeConfig(root, false);
      expect(result.status).toBe("pass");
      expect(result.id).toBe("workspace-ide-config");
    });

    it("catches invalid editor formatters and mismatched rulers in .vscode/settings.json", () => {
      const tempDir = createIdeFixture();
      try {
        fs.writeFileSync(
          path.join(tempDir, ".vscode", "settings.json"),
          JSON.stringify(
            {
              "editor.formatOnSave": true,
              "editor.defaultFormatter": "vscode.typescript-language-features",
              "editor.rulers": [100, 120],
            },
            null,
            2
          ),
          "utf-8"
        );

        const failed = checkWorkspaceIdeConfig(tempDir, false);
        expect(failed.status).toBe("fail");
        expect(failed.fixable).toBe(true);
        expect(failed.details?.join("\n")).toContain("editor.defaultFormatter");
        expect(failed.details?.join("\n")).toContain("editor.rulers");

        const fixed = checkWorkspaceIdeConfig(tempDir, true);
        expect(fixed.status).toBe("fixed");
        expect(checkWorkspaceIdeConfig(tempDir, false).status).toBe("pass");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("catches invalid or missing extension recommendations in .vscode/extensions.json", () => {
      const tempDir = createIdeFixture();
      try {
        fs.writeFileSync(
          path.join(tempDir, ".vscode", "extensions.json"),
          JSON.stringify(
            {
              recommendations: [
                "dbaeumer.vscode-eslint",
                "davidlday.vscode-markdownlint",
                "not-a-valid-id",
              ],
            },
            null,
            2
          ),
          "utf-8"
        );

        const failed = checkWorkspaceIdeConfig(tempDir, false);
        expect(failed.status).toBe("fail");
        expect(failed.details?.join("\n")).toContain(
          "davidlday.vscode-markdownlint"
        );
        expect(failed.details?.join("\n")).toContain("esbenp.prettier-vscode");
        expect(failed.details?.join("\n")).toContain(
          "EditorConfig.EditorConfig"
        );
        expect(failed.details?.join("\n")).toContain(
          "DavidAnson.vscode-markdownlint"
        );
        expect(failed.details?.join("\n")).toContain("not-a-valid-id");

        const fixed = checkWorkspaceIdeConfig(tempDir, true);
        expect(fixed.status).toBe("fixed");
        expect(checkWorkspaceIdeConfig(tempDir, false).status).toBe("pass");

        const repaired = JSON.parse(
          fs.readFileSync(
            path.join(tempDir, ".vscode", "extensions.json"),
            "utf-8"
          )
        ) as { recommendations: string[] };
        expect(repaired.recommendations).toContain(
          "DavidAnson.vscode-markdownlint"
        );
        expect(repaired.recommendations).toContain("esbenp.prettier-vscode");
        expect(repaired.recommendations).toContain("EditorConfig.EditorConfig");
        expect(repaired.recommendations).not.toContain(
          "davidlday.vscode-markdownlint"
        );
        expect(repaired.recommendations).not.toContain("not-a-valid-id");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("catches missing .prettierignore generated entries and broad .claude or .agents ignores", () => {
      const tempDir = createIdeFixture();
      try {
        fs.writeFileSync(
          path.join(tempDir, "lint-staged.config.cjs"),
          'const GENERATED_ARTIFACTS = new Set(["public/custom-generated.js"]);\n',
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".prettierignore"),
          "node_modules\n.claude\n.agents\napp/theme.css\npublic/garmin-engine.js\n",
          "utf-8"
        );

        const failed = checkWorkspaceIdeConfig(tempDir, false);
        expect(failed.status).toBe("fail");
        expect(failed.details?.join("\n")).toContain(
          "ignores '.claude' broadly instead of '.claude/worktrees'"
        );
        expect(failed.details?.join("\n")).toContain(
          "ignores '.agents' broadly instead of '.agents/worktrees'"
        );
        expect(failed.details?.join("\n")).toContain("lib/design-manifest.ts");
        expect(failed.details?.join("\n")).toContain(
          "public/icon-maskable-512.png"
        );
        expect(failed.details?.join("\n")).toContain("app/theme.css");
        expect(failed.details?.join("\n")).toContain("public/garmin-engine.js");
        expect(failed.details?.join("\n")).toContain(
          "public/third-party-notices.txt"
        );
        expect(failed.details?.join("\n")).toContain(
          "public/custom-generated.js"
        );

        const fixed = checkWorkspaceIdeConfig(tempDir, true);
        expect(fixed.status).toBe("fixed");
        expect(checkWorkspaceIdeConfig(tempDir, false).status).toBe("pass");
        const repairedIgnore = fs.readFileSync(
          path.join(tempDir, ".prettierignore"),
          "utf-8"
        );
        expect(repairedIgnore).toContain(".agents/worktrees");
        expect(repairedIgnore).toContain(".claude/worktrees");
        expect(repairedIgnore).toContain("public/icon-maskable-512.png");
        expect(repairedIgnore).not.toMatch(/^\.agents$/m);
        expect(repairedIgnore).not.toMatch(/^\.claude$/m);
        expect(repairedIgnore).not.toContain("app/theme.css");
        expect(repairedIgnore).not.toContain("public/garmin-engine.js");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("synthesizes canonical tsdk, [*.md] editorconfig, tasks, and launch configs that pass recheck and preserve custom user keys", () => {
      const tempDir = createIdeFixture();
      try {
        expect(checkWorkspaceIdeConfig(tempDir, false).status).toBe("pass");

        const generatedSettings = JSON.parse(
          fs.readFileSync(
            path.join(tempDir, ".vscode", "settings.json"),
            "utf-8"
          )
        ) as Record<string, unknown>;
        expect(generatedSettings["typescript.tsdk"]).toBe(
          REQUIRED_TYPESCRIPT_TSDK
        );
        expect(
          fs.existsSync(
            path.join(
              root,
              String(generatedSettings["typescript.tsdk"]),
              "tsserver.js"
            )
          )
        ).toBe(true);

        const filesExclude = generatedSettings["files.exclude"] as Record<
          string,
          unknown
        >;
        const searchExclude = generatedSettings["search.exclude"] as Record<
          string,
          unknown
        >;
        expect(searchExclude["**/.agents"]).toBeUndefined();
        for (const excludedPath of WORKSPACE_EXCLUDED_PATHS) {
          expect(filesExclude[excludedPath]).toBe(true);
          expect(searchExclude[excludedPath]).toBe(true);
        }

        const generatedExtensions = JSON.parse(
          fs.readFileSync(
            path.join(tempDir, ".vscode", "extensions.json"),
            "utf-8"
          )
        ) as { recommendations: string[] };
        expect(generatedExtensions.recommendations).toEqual([
          ...REQUIRED_VSCODE_EXTENSIONS,
        ]);
        expect(REQUIRED_VSCODE_EXTENSIONS).toHaveLength(9);

        const generatedEditorConfig = fs.readFileSync(
          path.join(tempDir, ".editorconfig"),
          "utf-8"
        );
        expect(generatedEditorConfig).toContain("[*.md]");
        expect(generatedEditorConfig).toContain(
          "trim_trailing_whitespace = false"
        );

        const diagRegex = new RegExp(TSC_WATCH_PROBLEM_MATCHER.pattern.regexp);
        const beginsRegex = new RegExp(
          TSC_WATCH_PROBLEM_MATCHER.background.beginsPattern.regexp
        );
        const endsRegex = new RegExp(
          TSC_WATCH_PROBLEM_MATCHER.background.endsPattern.regexp
        );
        const diagMatch = diagRegex.exec(
          "[tsc] app/page.tsx(14,9): error TS2322: Type 'string' is not assignable to type 'number'."
        );
        expect(diagMatch?.[1]).toBe("app/page.tsx");
        expect(diagMatch?.[2]).toBe("14");
        expect(diagMatch?.[3]).toBe("9");
        expect(diagMatch?.[4]).toBe("error");
        expect(diagMatch?.[5]).toBe("2322");
        expect(
          beginsRegex.test(
            "[tsc] 01:25:41 PM - Starting compilation in watch mode..."
          )
        ).toBe(true);
        expect(
          endsRegex.test(
            "[tsc] 01:25:45 PM - Found 0 errors. Watching for file changes."
          )
        ).toBe(true);

        // Mutate settings, extensions, tasks, and launch configs with custom keys + drift
        fs.writeFileSync(
          path.join(tempDir, ".vscode", "settings.json"),
          JSON.stringify(
            {
              "editor.formatOnSave": true,
              "editor.defaultFormatter": "esbenp.prettier-vscode",
              "editor.rulers": [80],
              "customUser.flag": "keep-me",
              "files.exclude": {
                "**/custom-cache": true,
                "**/.agents": true,
              },
              "search.exclude": {
                "**/custom-search": true,
                "**/.agents": true,
              },
            },
            null,
            2
          ),
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".vscode", "extensions.json"),
          JSON.stringify(
            {
              recommendations: ["custom.extension-id"],
              unwantedRecommendations: ["foo.bar"],
            },
            null,
            2
          ),
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".vscode", "tasks.json"),
          JSON.stringify(
            {
              version: "2.0.0",
              tasks: [
                {
                  type: "npm",
                  script: "dev",
                  isBackground: true,
                  problemMatcher: ["$tsc-watch"],
                  label: "npm: dev",
                },
                {
                  type: "shell",
                  command: "echo custom",
                  label: "custom: echo",
                },
              ],
            },
            null,
            2
          ),
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".vscode", "launch.json"),
          JSON.stringify(
            {
              version: "0.2.0",
              configurations: [
                {
                  name: "Vitest: Debug Current Test File",
                  type: "node",
                  request: "launch",
                  runtimeExecutable: "npx",
                  runtimeArgs: ["vitest", "run", "${relativeFile}"],
                },
                {
                  name: "Custom Node Tool",
                  type: "node",
                  request: "launch",
                  runtimeExecutable: "npx",
                  runtimeArgs: ["tsx", "scripts/dx.ts"],
                },
              ],
            },
            null,
            2
          ),
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".claude", "launch.json"),
          JSON.stringify(
            {
              version: "0.0.1",
              configurations: [
                {
                  name: "portfolio-dev",
                  runtimeExecutable: "npx",
                  runtimeArgs: ["next", "dev"],
                  port: 3000,
                },
              ],
            },
            null,
            2
          ),
          "utf-8"
        );

        const drifted = checkWorkspaceIdeConfig(tempDir, false);
        expect(drifted.status).toBe("fail");
        expect(drifted.fixable).toBe(true);
        const driftText = drifted.details?.join("\n") ?? "";
        expect(driftText).toContain("typescript.tsdk");
        expect(driftText).toContain("**/.agents");
        expect(driftText).toContain("$tsc-watch");
        expect(driftText).toContain("--no-install");
        expect(driftText).toContain("portfolio-dev");

        expect(checkWorkspaceIdeConfig(tempDir, true).status).toBe("fixed");
        expect(checkWorkspaceIdeConfig(tempDir, false).status).toBe("pass");

        const repairedSettings = JSON.parse(
          fs.readFileSync(
            path.join(tempDir, ".vscode", "settings.json"),
            "utf-8"
          )
        ) as Record<string, unknown>;
        expect(repairedSettings["customUser.flag"]).toBe("keep-me");
        expect(repairedSettings["typescript.tsdk"]).toBe(
          REQUIRED_TYPESCRIPT_TSDK
        );
        expect(
          (repairedSettings["files.exclude"] as Record<string, unknown>)[
            "**/custom-cache"
          ]
        ).toBe(true);
        expect(
          (repairedSettings["search.exclude"] as Record<string, unknown>)[
            "**/custom-search"
          ]
        ).toBe(true);
        expect(
          (repairedSettings["search.exclude"] as Record<string, unknown>)[
            "**/.agents"
          ]
        ).toBeUndefined();

        const repairedExtensions = JSON.parse(
          fs.readFileSync(
            path.join(tempDir, ".vscode", "extensions.json"),
            "utf-8"
          )
        ) as {
          recommendations: string[];
          unwantedRecommendations: string[];
        };
        expect(repairedExtensions.recommendations).toContain(
          "custom.extension-id"
        );
        expect(repairedExtensions.unwantedRecommendations).toEqual(["foo.bar"]);

        const repairedLaunch = JSON.parse(
          fs.readFileSync(path.join(tempDir, ".vscode", "launch.json"), "utf-8")
        ) as {
          configurations: Array<{
            name: string;
            runtimeArgs?: string[];
            env?: Record<string, string>;
          }>;
        };
        const playwrightCfg = repairedLaunch.configurations.find(
          (c) => c.name === "Playwright: Debug Synthetic Probes"
        );
        expect(playwrightCfg?.runtimeArgs).toContain("--no-install");
        expect(playwrightCfg?.runtimeArgs).toContain("--project=chromium");
        expect(playwrightCfg?.env?.DATABASE_URL).toBe(
          OFFLINE_DEBUG_DATABASE_URL
        );
        const customCfg = repairedLaunch.configurations.find(
          (c) => c.name === "Custom Node Tool"
        );
        expect(customCfg?.runtimeArgs).toContain("--no-install");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fails on corrupt JSON in launch/tasks/.claude configs and repairs missing [*.md] rules in .editorconfig", () => {
      for (const relJson of [
        path.join(".vscode", "launch.json"),
        path.join(".vscode", "tasks.json"),
        path.join(".claude", "launch.json"),
      ]) {
        const tempDir = createIdeFixture();
        try {
          fs.writeFileSync(path.join(tempDir, relJson), "{ bad json", "utf-8");
          const result = checkWorkspaceIdeConfig(tempDir, false);
          expect(result.status).toBe("fail");
          expect(result.fixable).toBe(false);
          expect(result.details?.join("\n")).toContain(
            `${relJson.replace(/\\/g, "/")} is not valid JSON.`
          );
        } finally {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }

      const editorDir = createIdeFixture();
      try {
        fs.writeFileSync(
          path.join(editorDir, ".editorconfig"),
          [
            "root = true",
            "",
            "[*]",
            "indent_style = space",
            "indent_size = 2",
            "end_of_line = lf",
            "charset = utf-8",
            "trim_trailing_whitespace = true",
            "insert_final_newline = true",
            "",
            "[*.py]",
            "indent_size = 4",
            "",
          ].join("\n"),
          "utf-8"
        );

        const failed = checkWorkspaceIdeConfig(editorDir, false);
        expect(failed.status).toBe("fail");
        expect(failed.fixable).toBe(true);
        expect(failed.details?.join("\n")).toContain("[*.md]");

        expect(checkWorkspaceIdeConfig(editorDir, true).status).toBe("fixed");
        expect(checkWorkspaceIdeConfig(editorDir, false).status).toBe("pass");

        const repaired = fs.readFileSync(
          path.join(editorDir, ".editorconfig"),
          "utf-8"
        );
        expect(repaired).toContain("[*.md]");
        expect(repaired).toContain("trim_trailing_whitespace = false");
        expect(repaired).toContain("[*.py]");
      } finally {
        fs.rmSync(editorDir, { recursive: true, force: true });
      }
    });

    it("ignores .agents/worktrees, .claude/worktrees, .stryker-tmp, docs/reference/api, and app/generated/prisma across DX tree walkers", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dx-tree-exclusions-test-")
      );
      try {
        // Seed canonical prisma schema and .env.example so checkTechnicalGuideSchemaParity runs cleanly
        fs.mkdirSync(path.join(tempDir, "prisma"), { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "prisma", "schema.prisma"),
          [
            "model CaseStudy {",
            "  id   String @id",
            "  slug String @unique",
            "}",
            "",
          ].join("\n"),
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".env.example"),
          generateEnvExampleContent(),
          "utf-8"
        );
        fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "components"), { recursive: true });
        fs.mkdirSync(path.join(tempDir, "lib", "services"), {
          recursive: true,
        });

        const staleModelMarkdown = [
          "# Generated Doc",
          "",
          "```prisma",
          "model CaseStudy {",
          "  id String @id",
          "}",
          "```",
          "",
        ].join("\n");

        const suppressionSource = [
          "export function IgnoredWidget() {",
          "  // eslint-disable-next-line react-hooks/set-state-in-effect",
          "  return null;",
          "}",
          "",
        ].join("\n");

        const badServiceSource = [
          'import { logger } from "@/lib/logger";',
          'import { sanitizeError } from "@/lib/error-sanitization";',
          "export function broken(err: unknown) {",
          '  logger.error("boom", sanitizeError(err));',
          '  throw new Error("unhandled");',
          "}",
          "",
        ].join("\n");

        for (const excluded of WORKSPACE_EXCLUDED_PATHS) {
          const absDir = path.join(tempDir, excluded);
          fs.mkdirSync(absDir, { recursive: true });
          expect(shouldSkipWorkspaceDirectory(tempDir, absDir)).toBe(true);
          fs.writeFileSync(
            path.join(absDir, "StaleGuide.md"),
            staleModelMarkdown,
            "utf-8"
          );
          fs.writeFileSync(
            path.join(absDir, "IgnoredSuppression.tsx"),
            suppressionSource,
            "utf-8"
          );
          fs.writeFileSync(
            path.join(absDir, "bad-service.ts"),
            badServiceSource,
            "utf-8"
          );
        }

        // Also seed nested worktree/stryker folders under scanned roots (components/ and lib/services/)
        for (const nested of [
          path.join(tempDir, "components", ".agents", "worktrees", "wt-1"),
          path.join(tempDir, "components", ".claude", "worktrees", "wt-1"),
          path.join(tempDir, "components", ".stryker-tmp", "sandbox-1"),
          path.join(tempDir, "lib", "services", ".agents", "worktrees", "wt-1"),
          path.join(tempDir, "lib", "services", ".claude", "worktrees", "wt-1"),
          path.join(tempDir, "lib", "services", ".stryker-tmp", "sandbox-1"),
        ]) {
          fs.mkdirSync(nested, { recursive: true });
          expect(shouldSkipWorkspaceDirectory(tempDir, nested)).toBe(true);
          fs.writeFileSync(
            path.join(nested, "IgnoredSuppression.tsx"),
            suppressionSource,
            "utf-8"
          );
          fs.writeFileSync(
            path.join(nested, "bad-service.ts"),
            badServiceSource,
            "utf-8"
          );
        }

        // Tracked skills under .agents/skills are NOT excluded
        const skillsDir = path.join(tempDir, ".agents", "skills", "tdd");
        fs.mkdirSync(skillsDir, { recursive: true });
        expect(shouldSkipWorkspaceDirectory(tempDir, skillsDir)).toBe(false);

        expect(checkTechnicalGuideSchemaParity(tempDir, false).status).toBe(
          "pass"
        );
        expect(checkSetStateInEffectCeiling(tempDir, 0).status).toBe("pass");
        expect(findServiceContractViolations(tempDir)).toEqual([]);
        expect(checkServiceResultTypes(tempDir, false).status).toBe("pass");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
