import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { checkDeprecations } from "../scripts/check-deprecations";

describe("checkDeprecations lockfile auditor", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "deprecations-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("passes when package-lock.json has zero deprecated packages", () => {
    const lockfileContent = {
      name: "test-workspace",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: {
        "": { name: "test-workspace", version: "1.0.0" },
        "node_modules/clean-pkg": {
          version: "1.2.3",
          resolved:
            "https://registry.npmjs.org/clean-pkg/-/clean-pkg-1.2.3.tgz",
        },
      },
    };
    fs.writeFileSync(
      path.join(tempDir, "package-lock.json"),
      JSON.stringify(lockfileContent, null, 2)
    );

    const report = checkDeprecations(tempDir);
    expect(report.success).toBe(true);
    expect(report.deprecatedCount).toBe(0);
    expect(report.deprecatedPackages).toEqual([]);
    expect(report.totalPackages).toBe(1);
  });

  it("fails and details deprecated packages when explicit 'deprecated' field is present", () => {
    const lockfileContent = {
      name: "test-workspace",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: {
        "": { name: "test-workspace", version: "1.0.0" },
        "node_modules/clean-pkg": {
          version: "1.2.3",
        },
        "node_modules/deprecated-pkg": {
          version: "0.1.0",
          deprecated: "This package has been discontinued and is unsupported.",
        },
      },
    };
    fs.writeFileSync(
      path.join(tempDir, "package-lock.json"),
      JSON.stringify(lockfileContent, null, 2)
    );

    const report = checkDeprecations(tempDir);
    expect(report.success).toBe(false);
    expect(report.deprecatedCount).toBe(1);
    expect(report.deprecatedPackages).toEqual([
      {
        name: "deprecated-pkg",
        version: "0.1.0",
        reason: "This package has been discontinued and is unsupported.",
        location: "node_modules/deprecated-pkg",
      },
    ]);
  });

  it("passes on the current repository's lockfile", () => {
    const report = checkDeprecations(process.cwd());
    expect(report.success).toBe(true);
    expect(report.deprecatedCount).toBe(0);
    expect(report.deprecatedPackages).toEqual([]);
    expect(report.totalPackages).toBeGreaterThan(0);
  });
});
