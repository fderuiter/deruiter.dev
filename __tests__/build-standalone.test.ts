// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import { inspectStandaloneBundle } from "../lib/dx/bundle-guard";
import { fromPartial } from "@total-typescript/shoehorn";

describe("Standalone JavaScript Engine Build & 50KB Size Guard", () => {
  const root = process.cwd();

  it("compiles the engine into standalone Vanilla JS assets under 50KB via build-standalone-engine script", () => {
    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-standalone-test-")
    );
    const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

    try {
      const output = execFileSync(
        process.execPath,
        [
          tsxCli,
          path.join(root, "scripts", "build-standalone-engine.ts"),
          "--source-root",
          root,
          "--output-dir",
          outputDir,
        ],
        { cwd: root, encoding: "utf-8" }
      );

      expect(output).toContain("Standalone Engine Build & Size Check Passed");
      expect(fs.existsSync(path.join(outputDir, "garmin-engine.js"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(outputDir, "monkey-c-mayhem.js"))).toBe(
        true
      );

      const garminStats = fs.statSync(path.join(outputDir, "garmin-engine.js"));
      const monkeyStats = fs.statSync(
        path.join(outputDir, "monkey-c-mayhem.js")
      );

      expect(garminStats.size).toBeGreaterThan(0);
      expect(garminStats.size).toBeLessThanOrEqual(50 * 1024);
      expect(monkeyStats.size).toBeGreaterThan(0);
      expect(monkeyStats.size).toBeLessThanOrEqual(50 * 1024);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("inspects standalone bundle size cleanly via bundle-guard", () => {
    const report = inspectStandaloneBundle(root);
    expect(report.exists).toBe(true);
    expect(report.sizeBytes).toBeGreaterThan(0);
    expect(report.sizeBytes).toBeLessThanOrEqual(50 * 1024);
    expect(report.violation).toBeUndefined();
  });

  it("detects size budget violations when standalone asset exceeds 50KB", () => {
    const spyStat = vi.spyOn(fs, "statSync").mockReturnValue(
      fromPartial<fs.Stats>({
        size: 55 * 1024, // 55KB
      })
    );

    const report = inspectStandaloneBundle(root);
    expect(report.exists).toBe(true);
    expect(report.violation).toContain("exceeds maximum budget of 50.0 kB");

    spyStat.mockRestore();
  });
});
