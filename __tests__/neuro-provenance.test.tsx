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

  it("clears mixed-source warnings when 3D surfaces and 2D slices derive from the same uploaded scan", () => {
    const niftiProv = getNeuroProvenance("mni152", "MNI152", {
      fileName: "sub-01_T1w.nii.gz",
      dimensions: { width: 192, height: 224, depth: 160 },
      spacing: { x: 0.9, y: 0.9, z: 1.2 },
      format: "nifti",
    });
    expect(niftiProv.isMixedSource).toBe(false);
    expect(niftiProv.mesh).toContain("sub-01_T1w.nii.gz");
    expect(niftiProv.volume).toContain("192x224x160");
    expect(niftiProv.volume).toContain("0.9x0.9x1.2 mm");
    expect(niftiProv.qa).toContain("sub-01_T1w.nii.gz");

    const mgzProv = getNeuroProvenance("oasis", "OASIS", {
      fileName: "T1.mgz",
      dimensions: { width: 256, height: 256, depth: 256 },
      spacing: { x: 1, y: 1, z: 1 },
      format: "mgz",
    });
    expect(mgzProv.isMixedSource).toBe(false);
    expect(mgzProv.volume).toContain("FreeSurfer MGZ");
  });
});
