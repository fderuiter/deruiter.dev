// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  enumerateStratumIntersections,
  generateBlockSchedule,
  previewSubjectIdMask,
  reduceAllocationRatios,
  validateRandomizationPlan,
  type BlockRandomizationRequest,
} from "@/lib/randomization";
import {
  PRESET_REPLACED_FIELDS,
  RANDOMIZATION_PRESET_IDS,
  RANDOMIZATION_PRESET_SUMMARIES,
  applyRandomizationPreset,
  createRandomizationPreset,
  findEditedDraftFields,
  isRandomizationPresetId,
  type RandomizationDesignDraft,
} from "@/lib/randomization/presets";

/** UI presets and their replacement contract (#4006, RND-WORKS-004 to 007). */

function asRequest(
  draft: RandomizationDesignDraft,
  seed = "PresetSeed2026"
): BlockRandomizationRequest {
  return {
    ...draft,
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "preset-plan",
    name: "Preset plan",
    provenance: {
      studyId: "synthetic",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    seed: { value: seed, source: "custom" },
  } as BlockRandomizationRequest;
}

describe("UI presets", () => {
  it("offers Simple, Standard and Complex with a summary each", () => {
    expect(RANDOMIZATION_PRESET_IDS).toEqual(["simple", "standard", "complex"]);
    expect(RANDOMIZATION_PRESET_SUMMARIES.map((s) => s.id)).toEqual([
      ...RANDOMIZATION_PRESET_IDS,
    ]);
    expect(isRandomizationPresetId("standard")).toBe(true);
    expect(isRandomizationPresetId("custom")).toBe(false);
    expect(isRandomizationPresetId(3)).toBe(false);
  });

  it("Simple: Treatment/Control 1:1, Site A/B, no factors, sizes 2/4, site-sequence mask", () => {
    const draft = createRandomizationPreset("simple");
    expect(draft.arms.map((a) => [a.label, a.allocationRatio])).toEqual([
      ["Treatment", 1],
      ["Control", 1],
    ]);
    expect(draft.sites.map((s) => s.label)).toEqual(["Site A", "Site B"]);
    expect(draft.factors).toEqual([]);
    expect(draft.blockSettings?.defaultRule.sizes).toEqual([2, 4]);
    expect(draft.subjectIdMask.pattern).toBe("{SITE}-{SEQ:3}");
  });

  it("Standard: Active/Placebo 1:1, sites 101/102/103, Age Group <65/>=65, sizes 4/6", () => {
    const draft = createRandomizationPreset("standard");
    expect(draft.arms.map((a) => [a.label, a.allocationRatio])).toEqual([
      ["Active", 1],
      ["Placebo", 1],
    ]);
    expect(draft.sites.map((s) => s.code)).toEqual(["101", "102", "103"]);
    expect(draft.factors).toHaveLength(1);
    expect(draft.factors[0].label).toBe("Age Group");
    expect(draft.factors[0].levels.map((l) => l.label)).toEqual([
      "<65",
      ">=65",
    ]);
    expect(draft.blockSettings?.defaultRule.sizes).toEqual([4, 6]);
  });

  it("Complex: 1:1:1 arms, four sites, three binary factors, sizes 3/6/9, RND:4 suffix and eight intersections", () => {
    const draft = createRandomizationPreset("complex");
    expect(draft.arms.map((a) => a.label)).toEqual([
      "High dose",
      "Low dose",
      "Placebo",
    ]);
    expect(draft.arms.every((a) => a.allocationRatio === 1)).toBe(true);
    expect(draft.sites.map((s) => s.code)).toEqual([
      "US-01",
      "US-02",
      "UK-01",
      "DE-01",
    ]);
    expect(draft.factors.map((f) => f.label)).toEqual([
      "Age",
      "Gender",
      "Region",
    ]);
    expect(draft.factors.every((f) => f.levels.length === 2)).toBe(true);
    expect(draft.blockSettings?.defaultRule.sizes).toEqual([3, 6, 9]);
    expect(draft.subjectIdMask.pattern).toMatch(/\{RND:4\}$/);
    expect(enumerateStratumIntersections(draft.factors)).toHaveLength(8);
  });

  it.each(RANDOMIZATION_PRESET_IDS)(
    "%s clears the seed and passes the shared validator once one is set",
    (id) => {
      const draft = createRandomizationPreset(id);
      expect(draft.seed).toBeNull();
      const result = validateRandomizationPlan(asRequest(draft));
      expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
      expect(result.ok).toBe(true);
    }
  );

  it.each(RANDOMIZATION_PRESET_IDS)(
    "%s generates a full schedule up to its enrollment target",
    (id) => {
      const draft = createRandomizationPreset(id);
      const result = generateBlockSchedule(asRequest(draft));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rows).toHaveLength(draft.enrollmentTarget);
      const ids = new Set(result.rows.map((row) => row.subjectId));
      expect(ids.size).toBe(result.rows.length);
    }
  );

  it.each(RANDOMIZATION_PRESET_IDS)(
    "%s uses unique stable ids and reduced 1:1 ratios",
    (id) => {
      const draft = createRandomizationPreset(id);
      const again = createRandomizationPreset(id);
      expect(again).toEqual(draft);
      for (const list of [draft.arms, draft.sites, draft.factors]) {
        const ids = list.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      const reduced = reduceAllocationRatios(draft.arms);
      expect(reduced.ok && reduced.ratios.every((r) => r === 1)).toBe(true);
      expect(previewSubjectIdMask(draft.subjectIdMask.pattern).ok).toBe(true);
    }
  );

  it("returns an independent copy each time", () => {
    const first = createRandomizationPreset("standard");
    (first.arms[0] as { label: string }).label = "Edited";
    expect(createRandomizationPreset("standard").arms[0].label).toBe("Active");
  });

  it("round-trips through JSON without loss", () => {
    for (const id of RANDOMIZATION_PRESET_IDS) {
      const draft = createRandomizationPreset(id);
      expect(JSON.parse(JSON.stringify(draft))).toEqual(draft);
    }
  });
});

describe("preset replacement contract", () => {
  it("applies at once when there is no current draft", () => {
    const result = applyRandomizationPreset({
      presetId: "simple",
      current: null,
      baseline: null,
    });
    expect(result.status).toBe("applied");
  });

  it("applies at once when the current draft is unedited", () => {
    const baseline = createRandomizationPreset("simple");
    const result = applyRandomizationPreset({
      presetId: "complex",
      current: createRandomizationPreset("simple"),
      baseline,
    });
    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.draft).toEqual(createRandomizationPreset("complex"));
    }
  });

  it("asks before replacing edited values and names them", () => {
    const baseline = createRandomizationPreset("standard");
    const current: RandomizationDesignDraft = {
      ...baseline,
      seed: { value: "Typed123", source: "custom" },
      enrollmentTarget: 40,
    };
    const result = applyRandomizationPreset({
      presetId: "simple",
      current,
      baseline,
    });
    expect(result).toEqual({
      status: "needs-confirmation",
      presetId: "simple",
      editedFields: ["seed", "enrollmentTarget"],
    });
  });

  it("treats a draft with no baseline as edited", () => {
    const fields = findEditedDraftFields(
      createRandomizationPreset("simple"),
      null
    );
    expect(fields).toContain("arms");
    expect(fields).not.toContain("seed");
    expect(fields).not.toContain("minimizationSettings");
  });

  it("leaves no stale override, minimization field or seed after a confirmed replacement", () => {
    const baseline = createRandomizationPreset("complex");
    const edited: RandomizationDesignDraft = {
      ...baseline,
      method: "MINIMIZATION",
      minimizationSettings: {
        virtualCohortSize: 50,
        biasedCoinProbability: 0.8,
      },
      blockSettings: {
        ...baseline.blockSettings!,
        siteOverrides: [
          {
            siteId: "site-us-01",
            rule: { mode: "fixed-sequence", sizes: [9] },
          },
        ],
      },
      seed: { value: "Typed123", source: "generated" },
    };
    const result = applyRandomizationPreset({
      presetId: "standard",
      current: edited,
      baseline,
      confirmed: true,
    });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.draft).toEqual(createRandomizationPreset("standard"));
    expect(result.draft.minimizationSettings).toBeUndefined();
    expect(result.draft.blockSettings?.siteOverrides).toBeUndefined();
    expect(result.draft.seed).toBeNull();
    const capKeys = new Set(
      enumerateStratumIntersections(result.draft.factors).map(
        (i) => i.stratumKey
      )
    );
    expect(result.draft.caps.strategy).toBe("manual");
    if (result.draft.caps.strategy === "manual") {
      for (const cap of result.draft.caps.intersectionCaps) {
        expect(capKeys.has(cap.stratumKey)).toBe(true);
      }
    }
  });

  it("covers every draft field", () => {
    const draft = createRandomizationPreset("simple");
    const keys = Object.keys(draft);
    for (const key of keys) {
      expect(PRESET_REPLACED_FIELDS as readonly string[]).toContain(key);
    }
  });
});
