// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { spawnSync } from "child_process";
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
import { checkWorkspaceIdeConfig } from "../lib/dx/doctor";

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

    it("passes checkBundleBudgets diagnostic check", () => {
      const result = bundleGuard.checkBundleBudgets(root);
      expect(["pass", "warn"]).toContain(result.status);
      expect(result.id).toBe("bundle-performance-budgets");
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

    it("verifies that all .vscode files, .editorconfig, and Prettier configs exist", () => {
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

    it("catches missing .prettierignore generated entries and broad .claude ignores", () => {
      const tempDir = createIdeFixture();
      try {
        fs.writeFileSync(
          path.join(tempDir, "lint-staged.config.cjs"),
          'const GENERATED_ARTIFACTS = new Set(["public/custom-generated.js"]);\n',
          "utf-8"
        );
        fs.writeFileSync(
          path.join(tempDir, ".prettierignore"),
          "node_modules\n.claude\n",
          "utf-8"
        );

        const failed = checkWorkspaceIdeConfig(tempDir, false);
        expect(failed.status).toBe("fail");
        expect(failed.details?.join("\n")).toContain(
          "ignores '.claude' broadly instead of '.claude/worktrees'"
        );
        expect(failed.details?.join("\n")).toContain("lib/design-manifest.ts");
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
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
