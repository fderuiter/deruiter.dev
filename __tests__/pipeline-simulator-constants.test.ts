// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as pipelineSimulator from "../lib/clinical-tools/pipeline-simulator";

// #3165: the first step of the Protocol Drift rebrand (#3164). Later steps
// read the name and the routes from this module, so the values are pinned.
describe("Trial Data Pipeline Simulator constants", () => {
  it("exports exactly the four agreed values", () => {
    expect(Object.fromEntries(Object.entries(pipelineSimulator))).toEqual({
      PIPELINE_SIMULATOR_NAME: "Trial Data Pipeline Simulator",
      PIPELINE_SIMULATOR_PATH: "/clinical/pipeline-simulator",
      PIPELINE_SIMULATOR_LEGACY_PATH: "/protocol-drift",
      PIPELINE_SIMULATOR_TAGLINE:
        "Design the pipeline. See where the data breaks.",
    });
  });
});
