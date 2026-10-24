// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import path from "path";
import fs from "fs";
import type defaultConfig from "../vitest.config.mjs";

/**
 * CI's sharded unit runs (#1775) set VITEST_COVERAGE_THRESHOLDS so each shard
 * defers thresholds to the merge job; this suite may run inside such a shard.
 * It governs the thresholds every unsharded run and the merge enforce, so it
 * loads the config with that variable cleared.
 */
let vitestConfig: typeof defaultConfig;
beforeAll(async () => {
  const deferred = process.env.VITEST_COVERAGE_THRESHOLDS;
  delete process.env.VITEST_COVERAGE_THRESHOLDS;
  try {
    vi.resetModules();
    vitestConfig = (await import("../vitest.config.mjs")).default;
  } finally {
    if (deferred !== undefined) {
      process.env.VITEST_COVERAGE_THRESHOLDS = deferred;
    }
  }
});

const workspaceRoot = path.resolve(__dirname, "..");

describe("Coverage Policy Governance & Threshold Guardrails", () => {
  it("enforces path-scoped thresholds on all governed non-UI source families", () => {
    const thresholds = vitestConfig.test?.coverage?.thresholds;
    expect(thresholds).toBeDefined();

    // Governed non-UI source families must be explicitly defined
    const GOVERNED_NON_UI_FAMILIES = ["lib/**", "hooks/**"];

    for (const family of GOVERNED_NON_UI_FAMILIES) {
      const familyConfig = (
        thresholds as Record<string, Record<string, number>>
      )[family];
      expect(
        familyConfig,
        `Non-UI source family '${family}' must have an explicit coverage threshold entry`
      ).toBeDefined();

      expect(familyConfig.statements).toBeGreaterThanOrEqual(80);
      expect(familyConfig.lines).toBeGreaterThanOrEqual(80);
      expect(familyConfig.functions).toBeGreaterThanOrEqual(80);
      expect(familyConfig.branches).toBeGreaterThanOrEqual(70);
    }
  });

  it("retains intended path-scoped UI coverage tiers without ungated blanket overrides", () => {
    const thresholds = vitestConfig.test?.coverage?.thresholds as Record<
      string,
      Record<string, number>
    >;
    expect(thresholds).toBeDefined();

    // Ratchet floors (#2513): these only go up.
    expect(thresholds["components/**"]).toMatchObject({
      statements: expect.any(Number),
      branches: expect.any(Number),
      lines: expect.any(Number),
      functions: expect.any(Number),
    });
    expect(thresholds["components/**"].statements).toBeGreaterThanOrEqual(79);
    expect(thresholds["components/**"].branches).toBeGreaterThanOrEqual(75);
    expect(thresholds["components/**"].lines).toBeGreaterThanOrEqual(81);
    expect(thresholds["components/**"].functions).toBeGreaterThanOrEqual(74);

    expect(thresholds["app/**"]).toBeDefined();
    expect(thresholds["app/**"].statements).toBeGreaterThanOrEqual(65);
    expect(thresholds["app/**"].branches).toBeGreaterThanOrEqual(53);
    expect(thresholds["app/**"].lines).toBeGreaterThanOrEqual(67);
    expect(thresholds["app/**"].functions).toBeGreaterThanOrEqual(59);
  });

  it("maintains strict thresholds for critical domain modules", () => {
    const thresholds = vitestConfig.test?.coverage?.thresholds as Record<
      string,
      Record<string, number>
    >;
    expect(thresholds).toBeDefined();

    const trialAndError = thresholds["lib/trial-and-error/**"];
    expect(trialAndError).toBeDefined();
    expect(trialAndError.statements).toBeGreaterThanOrEqual(95);
    expect(trialAndError.lines).toBeGreaterThanOrEqual(95);
    expect(trialAndError.functions).toBeGreaterThanOrEqual(95);
    expect(trialAndError.branches).toBeGreaterThanOrEqual(95);

    // #2607: the study data derivations ratchet up from 2026-10-24's level.
    const studyData = thresholds["lib/study-data/**"];
    expect(studyData).toBeDefined();
    expect(studyData.statements).toBeGreaterThanOrEqual(96);
    expect(studyData.lines).toBeGreaterThanOrEqual(96);
    expect(studyData.functions).toBeGreaterThanOrEqual(99);
    expect(studyData.branches).toBeGreaterThanOrEqual(86);
  });

  it("prevents silent degradation or un-scoped global threshold overrides in vitest.config.mts", () => {
    const configContent = fs.readFileSync(
      path.join(workspaceRoot, "vitest.config.mts"),
      "utf8"
    );

    // Verify raw config text structure to prevent silent regression
    expect(configContent).toContain('"lib/**"');
    expect(configContent).toContain('"hooks/**"');
    expect(configContent).toContain('"components/**"');
    expect(configContent).toContain('"app/**"');
  });
});
