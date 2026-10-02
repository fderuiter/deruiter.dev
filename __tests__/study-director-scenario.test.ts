import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCENARIO,
  createScenarioFromPreset,
  createStudyFromScenario,
  exportScenarioJson,
  parseScenarioJson,
  validateScenario,
  type StudyScenario,
} from "@/lib/study-director";

describe("study director scenario management", () => {
  it("validates the default preset scenario", () => {
    const result = validateScenario(DEFAULT_SCENARIO);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setup.id).toBe("24-081");
    }
  });

  it("rejects invalid scenario schema structures", () => {
    const invalid = {
      version: 1,
      id: "test",
      name: "Bad",
      setup: {
        // missing required fields
        id: "test",
      },
      sites: [],
      team: [],
    };
    const result = validateScenario(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid scenario schema");
    }
  });

  it("parses and validates valid scenario JSON strings", () => {
    const jsonStr = JSON.stringify(DEFAULT_SCENARIO);
    const parsed = parseScenarioJson(jsonStr);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe(DEFAULT_SCENARIO.name);
    }
  });

  it("returns error on malformed JSON string", () => {
    const result = parseScenarioJson("{ bad json }");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("JSON parse error");
    }
  });

  it("exports scenario JSON text", () => {
    const exported = exportScenarioJson(DEFAULT_SCENARIO);
    expect(typeof exported).toBe("string");
    expect(exported).toContain('"version": 1');
    expect(exported).toContain('"24-081"');
  });

  it("creates custom scenarios with overrides using createScenarioFromPreset", () => {
    const custom = createScenarioFromPreset({
      name: "High Risk Trial",
      setup: {
        ...DEFAULT_SCENARIO.setup,
        regulatoryRisk: "high",
        budget: 500000,
      },
    });

    expect(custom.name).toBe("High Risk Trial");
    expect(custom.setup.regulatoryRisk).toBe("high");
    expect(custom.setup.budget).toBe(500000);
    // Preserves default clinical phase
    expect(custom.setup.clinicalPhase).toBe("I");
  });

  it("initializes a StudyState from a custom scenario", () => {
    const customScenario: StudyScenario = {
      ...DEFAULT_SCENARIO,
      id: "custom-001",
      name: "Custom Trial Alpha",
      setup: {
        ...DEFAULT_SCENARIO.setup,
        id: "custom-001",
        budget: 350000,
        regulatoryRisk: "high",
      },
    };

    const state = createStudyFromScenario(
      customScenario,
      "seed-custom",
      "calm"
    );
    expect(state.seed).toBe("seed-custom");
    expect(state.setup.id).toBe("custom-001");
    expect(state.difficulty).toBe("calm");
    expect(state.status).toBe("running");
  });
});
