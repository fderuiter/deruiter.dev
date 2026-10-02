// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  meetsMinVersion,
  checkNodeVersion,
  checkNpmVersion,
  checkPrismaClientGenerated,
  checkSupportedPlatform,
  checkTsxExecution,
  runPreflight,
} from "../lib/dx/preflight";

describe("DX Runtime Preflight (#612)", () => {
  describe("meetsMinVersion", () => {
    it("passes when actual version exceeds the required minimum", () => {
      expect(meetsMinVersion("v22.22.2", ">=22.0.0")).toBe(true);
      expect(meetsMinVersion("v23.0.0", ">=22.0.0")).toBe(true);
    });

    it("passes when actual version exactly matches the required minimum", () => {
      expect(meetsMinVersion("v22.0.0", ">=22.0.0")).toBe(true);
    });

    it("fails when actual version is below the required minimum", () => {
      expect(meetsMinVersion("v18.19.0", ">=22.0.0")).toBe(false);
      expect(meetsMinVersion("v21.9.9", ">=22.0.0")).toBe(false);
    });
  });

  describe("checkNodeVersion / checkNpmVersion", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-preflight-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("reports pass for the currently running Node.js version against this repo's real package.json", () => {
      // Regression coverage: this repo's actual declared engines.node
      // (>=22.0.0) must not spuriously fail against the runtime this
      // suite itself executes under.
      const result = checkNodeVersion(path.resolve(process.cwd()));
      expect(result.status).toBe("pass");
    });

    it("fails with a clear message when the running Node.js version is below a declared engines.node minimum", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ engines: { node: ">=999.0.0" } })
      );

      const result = checkNodeVersion(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("999.0.0");
    });

    it("warns rather than fails when no engines.node is declared", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({}));

      const result = checkNodeVersion(tempDir);
      expect(result.status).toBe("warn");
    });

    it("fails with a clear message when the running npm version is below a declared engines.npm minimum", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ engines: { npm: ">=999.0.0" } })
      );

      const result = checkNpmVersion(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("999.0.0");
    });
  });

  describe("checkPrismaClientGenerated", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-preflight-test-"));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("fails when app/generated/prisma does not exist", () => {
      const result = checkPrismaClientGenerated(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("prisma generate");
    });

    it("fails when app/generated/prisma exists but is empty", () => {
      fs.mkdirSync(path.join(tempDir, "app", "generated", "prisma"), {
        recursive: true,
      });

      const result = checkPrismaClientGenerated(tempDir);
      expect(result.status).toBe("fail");
    });

    it("passes when app/generated/prisma exists with generated files", () => {
      const generatedDir = path.join(tempDir, "app", "generated", "prisma");
      fs.mkdirSync(generatedDir, { recursive: true });
      fs.writeFileSync(path.join(generatedDir, "index.js"), "// generated");

      const result = checkPrismaClientGenerated(tempDir);
      expect(result.status).toBe("pass");
    });

    it("passes against this repo's real, already-generated Prisma client", () => {
      const result = checkPrismaClientGenerated(path.resolve(process.cwd()));
      expect(result.status).toBe("pass");
    });
  });

  describe("checkTsxExecution", () => {
    it("passes and distinguishes real execution from a sandbox/IPC failure when tsx actually runs", () => {
      const result = checkTsxExecution(path.resolve(process.cwd()));
      expect(result.status).toBe("pass");
      expect(result.message).toContain("node --import tsx");
    });

    it("reports a sandbox/permission restriction distinctly from a generic failure when the runtime binary cannot be spawned", () => {
      // Regression: a spawn-level failure (binary missing/EACCES/EPERM) must
      // be reported as an environment restriction an agent should stop and
      // report, not conflated with a product/script defect message.
      const result = checkTsxExecution("/definitely/does/not/exist/preflight");
      expect(result.status).toBe("fail");
      expect(result.message.toLowerCase()).toMatch(
        /sandbox|environment|restriction/
      );
    });
  });

  describe("checkSupportedPlatform (#939)", () => {
    it.each(["linux", "darwin"] as const)("passes on %s", (platform) => {
      expect(checkSupportedPlatform(platform).status).toBe("pass");
    });

    it("fails on native Windows and points at WSL 2", () => {
      const result = checkSupportedPlatform("win32");
      expect(result.status).toBe("fail");
      expect(result.message).toContain("WSL 2");
      expect(result.message).toContain("CONTRIBUTING.md");
    });

    it("runs as part of the preflight report", () => {
      const report = runPreflight(path.resolve(process.cwd()));
      expect(report.checks.map((c) => c.id)).toContain("platform");
    });
  });

  describe("runPreflight", () => {
    it("reports ready=true when every check passes against this repo's real environment", () => {
      const report = runPreflight(path.resolve(process.cwd()));
      expect(report.ready).toBe(true);
      expect(report.checks.length).toBeGreaterThanOrEqual(4);
      expect(report.checks.every((c) => c.status !== "fail")).toBe(true);
    });

    it("reports ready=false when any single check fails", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dx-preflight-test-")
      );
      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ engines: { node: ">=999.0.0" } })
        );
        // No app/generated/prisma directory either -- multiple real failures.
        const report = runPreflight(tempDir);
        expect(report.ready).toBe(false);
        expect(report.checks.some((c) => c.status === "fail")).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
