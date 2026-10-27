// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  conformanceLayers,
  coreRuleStates,
  loadRecordedCoreFindings,
  RULE_STATES,
} from "@/lib/study-data";

const rule = (status: string) => ({ status, cdisc: "", fda: "", message: "" });

describe("coreRuleStates (#2992 step 6)", () => {
  it("maps CORE statuses to matrix states", () => {
    const { outcomes } = coreRuleStates(
      {
        "CORE-1": rule("SUCCESS"),
        "CORE-2": rule("SKIPPED"),
        "CORE-3": rule("ISSUE REPORTED"),
        "CORE-4": rule("EXECUTION ERROR"),
        "CORE-5": rule("SOMETHING NEW"),
      },
      {},
      {}
    );
    expect(outcomes).toEqual({
      pass: 1,
      "not-applicable": 1,
      fail: 1,
      "execution-error": 2,
    });
  });

  it("counts a failing rule as explained only when every dataset it fails on is", () => {
    const explanation = { category: "by-design", reason: "x" };
    const { explainedFailures } = coreRuleStates(
      {
        "CORE-1": rule("ISSUE REPORTED"),
        "CORE-2": rule("ISSUE REPORTED"),
        "CORE-3": rule("ISSUE REPORTED"),
      },
      {
        "CORE-1 AE": 4,
        "CORE-1 CM": 2,
        "CORE-2 AE": 1,
        "CORE-2 LB": 3,
        "CORE-3 VS": 0,
      },
      {
        "CORE-1 AE": explanation,
        "CORE-1 CM": explanation,
        "CORE-2 AE": explanation,
      }
    );
    // CORE-2 has an unexplained LB finding; CORE-3 has no findings to explain.
    expect(explainedFailures).toBe(1);
  });
});

describe("conformanceLayers (#2992 step 6)", async () => {
  const recorded = await loadRecordedCoreFindings();
  const layers = conformanceLayers(recorded);
  const byId = Object.fromEntries(layers.map((l) => [l.id, l]));
  const total = (id: string) =>
    Object.values(byId[id].outcomes).reduce((a, b) => a + (b ?? 0), 0);

  it("lists the layers from file structure up to the site's own rules", () => {
    expect(layers.map((l) => l.id)).toEqual([
      "schema",
      "terminology",
      "core-sdtmig",
      "core-fda",
      "fda-other",
      "core-usdm",
      "core-adamig",
      "local",
    ]);
  });

  it("counts every recorded CORE rule exactly once", () => {
    expect(total("core-sdtmig")).toBe(
      Object.keys(recorded.rules.sdtm).length
    );
    expect(total("core-usdm")).toBe(Object.keys(recorded.rules.usdm).length);
    expect(total("core-fda")).toBeGreaterThan(0);
    expect(total("core-fda")).toBeLessThan(total("core-sdtmig"));
  });

  it("has a recorded reason for every rule CORE fails, as the page says", () => {
    for (const id of ["core-sdtmig", "core-fda", "core-usdm"]) {
      expect(byId[id].explainedFailures, id).toBe(byId[id].outcomes.fail ?? 0);
    }
  });

  it("shows what is not run as its own state, not as a pass", () => {
    expect(byId["core-adamig"]).toMatchObject({
      outcomes: {},
      state: "unsupported",
    });
    expect(byId["fda-other"]).toMatchObject({
      outcomes: {},
      state: "not-evaluated",
    });
  });

  it("uses only the defined states", () => {
    for (const layer of layers) {
      for (const state of Object.keys(layer.outcomes)) {
        expect(RULE_STATES).toContain(state);
      }
    }
  });

  it("points every piece of evidence at a file in the repository", () => {
    for (const layer of layers) {
      for (const item of layer.evidence) {
        expect(
          fs.existsSync(path.resolve(process.cwd(), item.path)),
          item.path
        ).toBe(true);
      }
    }
  });
});
