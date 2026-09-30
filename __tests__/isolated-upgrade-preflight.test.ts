import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  checkToolchainUpgradePreflight,
  runPreflight,
} from "../lib/dx/preflight";

describe("Isolated Tool Upgrade Preflight Guards", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tool-preflight-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("passes all toolchain preflight checks against the repository workspace", () => {
    const results = checkToolchainUpgradePreflight(path.resolve(process.cwd()));
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === "pass")).toBe(true);

    const labels = results.map((r) => r.label);
    expect(labels).toContain("Toolchain Preflight: Vitest v5");
    expect(labels).toContain("Toolchain Preflight: jsdom v30");
    expect(labels).toContain("Toolchain Preflight: ESLint v10");
    expect(labels).toContain("Toolchain Preflight: TypeScript v7");
  });

  it("filters checks when a target tool is specified", () => {
    const vitestResult = checkToolchainUpgradePreflight(
      path.resolve(process.cwd()),
      "vitest"
    );
    expect(vitestResult).toHaveLength(1);
    expect(vitestResult[0].id).toBe("tool-vitest");

    const jsdomResult = checkToolchainUpgradePreflight(
      path.resolve(process.cwd()),
      "jsdom"
    );
    expect(jsdomResult).toHaveLength(1);
    expect(jsdomResult[0].id).toBe("tool-jsdom");

    const eslintResult = checkToolchainUpgradePreflight(
      path.resolve(process.cwd()),
      "eslint"
    );
    expect(eslintResult).toHaveLength(1);
    expect(eslintResult[0].id).toBe("tool-eslint");

    const tsResult = checkToolchainUpgradePreflight(
      path.resolve(process.cwd()),
      "typescript"
    );
    expect(tsResult).toHaveLength(1);
    expect(tsResult[0].id).toBe("tool-typescript");
  });

  it("returns warning for unknown tool parameter", () => {
    const result = checkToolchainUpgradePreflight(
      path.resolve(process.cwd()),
      "nonexistent-tool"
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("warn");
    expect(result[0].message).toContain("Unknown target tool");
  });

  it("fails preflight check when a tool configuration file is missing", () => {
    // Empty directory with minimal package.json
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-pkg",
        devDependencies: { vitest: "^4.0.0" },
      })
    );

    const results = checkToolchainUpgradePreflight(tempDir, "vitest");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("fail");
    expect(results[0].message).toContain(
      "vitest.config.ts configuration file missing"
    );
  });

  it("includes toolchain checks in runPreflight", () => {
    const report = runPreflight(path.resolve(process.cwd()), {
      tool: "vitest",
    });
    expect(report.ready).toBe(true);
    const vitestCheck = report.checks.find((c) => c.id === "tool-vitest");
    expect(vitestCheck).toBeDefined();
    expect(vitestCheck?.status).toBe("pass");
  });
});
