// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import { inspectStandaloneBundle } from "../lib/dx/bundle-guard";
import { buildStandaloneEngine } from "../scripts/build-standalone-engine";

describe("Standalone JavaScript Engine Build & 80KB Size Guard", () => {
  const root = process.cwd();

  it("compiles the engine into .next/standalone-engine/garmin-engine.js under 80KB without public duplicates", async () => {
    const tempWorkspace = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-standalone-test-")
    );
    const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
    const defaultOutDir = path.join(
      tempWorkspace,
      ".next",
      "standalone-engine"
    );

    try {
      const output = execFileSync(
        process.execPath,
        [
          tsxCli,
          path.join(root, "scripts", "build-standalone-engine.ts"),
          "--source-root",
          root,
          "--output-dir",
          defaultOutDir,
        ],
        { cwd: root, encoding: "utf-8" }
      );

      expect(output).toContain("Standalone Engine Build & Size Check Passed");
      expect(fs.existsSync(path.join(defaultOutDir, "garmin-engine.js"))).toBe(
        true
      );
      expect(
        fs.existsSync(path.join(defaultOutDir, "monkey-c-mayhem.js"))
      ).toBe(false);

      const garminStats = fs.statSync(
        path.join(defaultOutDir, "garmin-engine.js")
      );
      expect(garminStats.size).toBeGreaterThan(0);
      expect(garminStats.size).toBeLessThanOrEqual(80 * 1024);

      const report = inspectStandaloneBundle(tempWorkspace);
      expect(report.exists).toBe(true);
      expect(report.sizeBytes).toBe(garminStats.size);
      expect(report.violation).toBeUndefined();
    } finally {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  it("leaves no tracked standalone bundles under public/ and reports exists=false before build", async () => {
    expect(fs.existsSync(path.join(root, "public", "garmin-engine.js"))).toBe(
      false
    );
    expect(fs.existsSync(path.join(root, "public", "monkey-c-mayhem.js"))).toBe(
      false
    );

    const emptyWorkspace = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-standalone-empty-")
    );
    try {
      expect(inspectStandaloneBundle(emptyWorkspace)).toEqual({
        exists: false,
        sizeBytes: 0,
      });

      const outputs = await buildStandaloneEngine({
        rootDir: root,
        outputDir: path.join(emptyWorkspace, ".next", "standalone-engine"),
      });
      expect(Object.keys(outputs)).toEqual(["garmin-engine.js"]);
    } finally {
      fs.rmSync(emptyWorkspace, { recursive: true, force: true });
    }
  });

  it("detects size budget violations when .next/standalone-engine/garmin-engine.js exceeds 80KB", () => {
    const tempWorkspace = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-standalone-oversize-")
    );
    try {
      const standaloneDir = path.join(
        tempWorkspace,
        ".next",
        "standalone-engine"
      );
      fs.mkdirSync(standaloneDir, { recursive: true });
      fs.writeFileSync(
        path.join(standaloneDir, "garmin-engine.js"),
        Buffer.alloc(85 * 1024, "x")
      );

      const report = inspectStandaloneBundle(tempWorkspace);
      expect(report.exists).toBe(true);
      expect(report.violation).toContain(
        ".next/standalone-engine/garmin-engine.js"
      );
      expect(report.violation).toContain("exceeds maximum budget of 80.0 kB");
    } finally {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });
});
