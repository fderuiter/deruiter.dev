// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  scanFile,
  scanRepositoryFile,
  scanRepositoryText,
  scanText,
  shouldScanRepositoryPath,
} from "../lib/security-scan";
import { checkSecretLeaks } from "../lib/dx/doctor";
import { auditCurrentTree } from "../scripts/audit-secret-history";
import { shouldScanFile } from "../scripts/validate-commit";

const workspaceRoot = path.resolve(__dirname, "..");

describe("Static Regex Guards - scanText", () => {
  it("detects database connection string pattern with credentials", () => {
    const text = [
      "We connected using postgresql",
      "://admin:superSecretPass123@db.example.net:5432/production",
    ].join("");
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("database-url-credentialed");
    expect(matches[0].line).toBe(1);
  });

  it("detects database connection string pattern without credentials", () => {
    const text =
      "Connecting to postgresql://db.fixture.internal:5432/my_local_db";
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("database-url-bare");
    expect(matches[0].line).toBe(1);
  });

  it("detects generic secret and password patterns with high entropy", () => {
    const text = `
      const config = {
        api_key: "abc123xyz456foo199",
        someOtherField: "normal value"
      };
    `;
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("generic-assigned-secret");
    expect(matches[0].line).toBe(3);
  });

  it("detects AWS Access Keys", () => {
    const key = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    const text = `Set environment variable AWS_ACCESS_KEY_ID = ${key}`;
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("aws-access-key");
    expect(matches[0].line).toBe(1);
  });

  it("detects GitHub Access Tokens", () => {
    const token = ["ghp_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ01234"].join("");
    const text = `Check out using token: ${token}`;
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("github-token");
    expect(matches[0].line).toBe(1);
  });

  it("detects Private Keys", () => {
    const text = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0G...
-----END RSA PRIVATE KEY-----
    `;
    const matches = scanText(text, "some/other/file.ts");
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("private-key-pem");
    expect(matches[0].line).toBe(2);
  });

  it("does not trigger on safe text and code", () => {
    const text = `
      import dotenv from "dotenv";
      const connectionString = process.env.DATABASE_URL;
      const api_key = "short"; // Too short to match high entropy regex limit of 16
      console.log("Welcome to the Portfolio App");
    `;
    const matches = scanText(text);
    expect(matches).toHaveLength(0);
  });

  it("detects generic secret patterns in template literals (backticks)", () => {
    const text = "const api_key = `superSecretToken12345`;";
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("generic-assigned-secret");
    expect(matches[0].line).toBe(1);
  });

  it("allows the AWS-published example key (well-known, not a real credential)", () => {
    const text =
      "Set environment variable AWS_ACCESS_KEY_ID = AKIAIOSFODNN7EXAMPLE";
    const matches = scanText(text);
    expect(matches).toHaveLength(0);
  });

  it("handles scanFile on non-existent or empty files gracefully", () => {
    const matchesNonExistent = scanFile("this-file-does-not-exist.txt");
    expect(matchesNonExistent).toEqual([]);
  });

  describe("Pre-Commit Git Guard - shouldScanFile & Unified Repository Policy", () => {
    it("returns false for lockfiles and vendor/build directories", () => {
      expect(shouldScanFile("package-lock.json")).toBe(false);
      expect(shouldScanFile("bun.lock")).toBe(false);
      expect(shouldScanFile("bun.lockb")).toBe(false);
      expect(shouldScanFile("yarn.lock")).toBe(false);
      expect(shouldScanFile("pnpm-lock.yaml")).toBe(false);
      expect(shouldScanFile("node_modules/lodash/index.js")).toBe(false);
      expect(shouldScanFile("foo/node_modules/bar.js")).toBe(false);
      expect(shouldScanFile(".next/server/page.js")).toBe(false);
      expect(shouldScanFile("dist/bundle.js")).toBe(false);
      expect(shouldScanFile("build/output.js")).toBe(false);
      expect(shouldScanFile("docs/reference/api/index.md")).toBe(false);
      expect(shouldScanFile(".claude/worktrees/wt-1/leak.ts")).toBe(false);
      expect(shouldScanRepositoryPath("coverage/lcov.info")).toBe(false);
    });

    it("keeps .env*, __tests__/, .husky/, shell scripts, workflows, SVGs, and source files in scope", () => {
      expect(shouldScanFile(".env.example")).toBe(true);
      expect(shouldScanFile(".env.local")).toBe(true);
      expect(shouldScanFile("__tests__/validation.test.ts")).toBe(true);
      expect(shouldScanFile(".husky/pre-push")).toBe(true);
      expect(shouldScanFile("scripts/deploy.sh")).toBe(true);
      expect(shouldScanFile(".github/workflows/ci.yml")).toBe(true);
      expect(shouldScanFile("app/icon.svg")).toBe(true);
      expect(shouldScanFile("lib/auth.ts")).toBe(true);
      expect(shouldScanFile("app/dashboard/page.tsx")).toBe(true);
      expect(shouldScanFile("scripts/seed.js")).toBe(true);
      expect(shouldScanFile("")).toBe(false);
      expect(shouldScanFile(workspaceRoot)).toBe(false);
      expect(shouldScanFile(path.join(workspaceRoot, "lib/auth.ts"))).toBe(
        true
      );
      expect(shouldScanFile("/external/workspace/src/index.ts")).toBe(true);
    });

    it("skips NUL-containing binary buffers and files while running surface-appropriate detectors", () => {
      const token = ["ghp_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ01234"].join("");
      const binaryBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]),
        Buffer.from(token, "utf-8"),
      ]);
      expect(scanRepositoryText(binaryBuffer, "public/image.png")).toEqual([]);
      expect(scanRepositoryText(`prefix\0${token}`, "public/icon.ico")).toEqual(
        []
      );
      expect(scanRepositoryText(token, "package-lock.json")).toEqual([]);
      expect(scanRepositoryText(token)).toHaveLength(1);
      expect(
        scanRepositoryFile(
          path.join(workspaceRoot, "package-lock.json"),
          "package-lock.json"
        )
      ).toEqual([]);
      expect(
        scanRepositoryFile(
          path.join(workspaceRoot, "__nonexistent_scan_target__.ts"),
          "missing.ts"
        )
      ).toEqual([]);
      expect(scanRepositoryFile(workspaceRoot, "scripts")).toEqual([]);

      // Bare URLs and generic assigned strings run outside __tests__/ only.
      const bareUrl = [
        "postgresql",
        "://db.fixture.internal:5432/my_local_db",
      ].join("");
      expect(scanRepositoryText(bareUrl, "lib/db.ts")).toHaveLength(1);
      expect(scanRepositoryText(bareUrl, "__tests__/db.test.ts")).toEqual([]);

      // High-confidence historyAudit detectors run inside __tests__/ too.
      expect(scanRepositoryText(token, "__tests__/leak.test.ts")).toHaveLength(
        1
      );
    });

    it("fails validate-commit.ts, checkSecretLeaks, and auditCurrentTree on synthetic credentials or UPSTASH_REDIS_REST_TOKEN leaks across formerly skipped paths", () => {
      const syntheticGhp = ["ghp_", "Zq9Xw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe"].join(
        ""
      );
      const syntheticUpstash = [
        "UPSTASH_REDIS_REST_TOKEN",
        '="AX99 syntheticUpstashRestTokenLeak1234"'.replace(" ", "_"),
      ].join("");

      const targetFiles = [
        ".env.example",
        ".env.local",
        "__tests__/leak.test.ts",
        ".husky/pre-push",
        "scripts/deploy.sh",
        ".github/workflows/ci.yml",
      ];

      const tsxBin = path.join(
        workspaceRoot,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "tsx.cmd" : "tsx"
      );

      for (const payload of [
        `const leaked = "${syntheticGhp}";\n`,
        `${syntheticUpstash}\n`,
      ]) {
        const tempRepo = fs.mkdtempSync(
          path.join(os.tmpdir(), "unified-scan-parity-")
        );
        try {
          const git = (...args: string[]) =>
            spawnSync("git", args, { cwd: tempRepo, encoding: "utf-8" });
          git("init", "-q");
          git("config", "user.email", "test@example.com");
          git("config", "user.name", "Test");
          git("config", "commit.gpgsign", "false");

          // Verify each file individually fails checkSecretLeaks and auditCurrentTree,
          // then stage all 6 files together to verify validate-commit.ts flags every one.
          for (const relFile of targetFiles) {
            const singleDir = fs.mkdtempSync(
              path.join(os.tmpdir(), "unified-scan-single-")
            );
            try {
              const singlePath = path.join(singleDir, relFile);
              fs.mkdirSync(path.dirname(singlePath), { recursive: true });
              fs.writeFileSync(singlePath, payload, "utf-8");
              expect(checkSecretLeaks(singleDir).status, relFile).toBe("fail");
            } finally {
              fs.rmSync(singleDir, { recursive: true, force: true });
            }

            const fullPath = path.join(tempRepo, relFile);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, payload, "utf-8");
            git("add", "-f", "--", relFile);
          }

          const treeFindings = auditCurrentTree(tempRepo);
          for (const relFile of targetFiles) {
            expect(
              treeFindings.some((f) => f.file === relFile),
              relFile
            ).toBe(true);
          }

          const env: NodeJS.ProcessEnv = {
            ...process.env,
            GIT_DIR: path.join(tempRepo, ".git"),
            GIT_WORK_TREE: tempRepo,
          };
          delete env.GIT_INDEX_FILE;
          delete env.GIT_PREFIX;
          delete env.VITEST;

          const commitResult = spawnSync(
            tsxBin,
            [path.join(workspaceRoot, "scripts/validate-commit.ts")],
            {
              cwd: workspaceRoot,
              encoding: "utf-8",
              shell: process.platform === "win32",
              env,
            }
          );
          expect(commitResult.status).toBe(1);
          expect(commitResult.stderr).not.toContain(syntheticGhp);
          for (const relFile of targetFiles) {
            expect(commitResult.stderr, relFile).toContain(
              `staged file: ${relFile}`
            );
          }
        } finally {
          fs.rmSync(tempRepo, { recursive: true, force: true });
        }
      }

      // Canonical .env.example passes cleanly across scanRepositoryFile.
      expect(
        scanRepositoryFile(
          path.join(workspaceRoot, ".env.example"),
          ".env.example"
        )
      ).toEqual([]);
    });
  });
});
