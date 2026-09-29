// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { getNeuroProvenance, isNeuroSelectionValid } from "@/lib/neuro";

describe("neuro provenance", () => {
  it("labels 2D slices and QA as synthetic for every dataset", () => {
    for (const ds of ["case_study", "mni152", "oasis"] as const) {
      const p = getNeuroProvenance(ds, "X");
      expect(p.volume).toMatch(/synthetic/i);
      expect(p.qa).toMatch(/synthetic/i);
    }
  });

  it("flags real-scan datasets as a mixed-source pairing", () => {
    expect(getNeuroProvenance("mni152", "MNI152").isMixedSource).toBe(true);
    expect(getNeuroProvenance("mni152", "MNI152").mesh).toContain("MNI152");
    expect(getNeuroProvenance("case_study").isMixedSource).toBe(false);
  });

  it("only allows real datasets with the sandbox", () => {
    expect(isNeuroSelectionValid("mni152", "sandbox")).toBe(true);
    expect(isNeuroSelectionValid("mni152", "dura_inclusion")).toBe(false);
    expect(isNeuroSelectionValid("oasis", "dura_inclusion")).toBe(false);
    expect(isNeuroSelectionValid("case_study", "dura_inclusion")).toBe(true);
  });
});
