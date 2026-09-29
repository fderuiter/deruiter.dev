import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import vitestConfig from "../vitest.config.mjs";

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

    expect(thresholds["components/**"]).toBeDefined();
    expect(thresholds["components/**"].statements).toBeGreaterThanOrEqual(60);

    expect(thresholds["app/**"]).toBeDefined();
    expect(thresholds["app/**"].statements).toBeGreaterThanOrEqual(50);
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
