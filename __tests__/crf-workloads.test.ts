import { describe, expect, it } from "vitest";
import {
  CRF_WORKLOAD_SPECS,
  amendCrfWorkload,
  generateCrfWorkload,
  getCrfWorkloadSpec,
  summarizeCrfWorkload,
  type CrfWorkloadId,
} from "@/lib/dx/crf-workloads";
import {
  compareStudyToBaseline,
  runScenariosForForm,
  validateStudyCompliance,
  validateUniversalCrf,
} from "@/lib/crf";

const IDS: CrfWorkloadId[] = ["small", "typical", "stress"];

describe("CRF synthetic workloads (#682)", () => {
  it("defines the three sizes the capacity report measures", () => {
    expect(
      CRF_WORKLOAD_SPECS.map(({ id, forms, fields }) => ({ id, forms, fields }))
    ).toEqual([
      { id: "small", forms: 5, fields: 100 },
      { id: "typical", forms: 30, fields: 1_000 },
      { id: "stress", forms: 100, fields: 5_000 },
    ]);
  });

  it.each(IDS)(
    "generates the %s workload byte-identically on every call",
    (id) => {
      expect(JSON.stringify(generateCrfWorkload(id))).toBe(
        JSON.stringify(generateCrfWorkload(id))
      );
    }
  );

  it.each(IDS)(
    "gives the %s workload its declared size and a representative shape",
    (id) => {
      const spec = getCrfWorkloadSpec(id);
      const summary = summarizeCrfWorkload(generateCrfWorkload(id));
      expect(summary.forms).toBe(spec.forms);
      expect(summary.fields).toBe(spec.fields);
      expect(summary.visits).toBe(spec.scheduledVisits + 2);
      expect(summary.repeatingVisits).toBe(1);
      expect(summary.formRules).toBe(spec.forms * spec.rulesPerForm);
      expect(summary.scenarios).toBe(spec.forms * spec.scenariosPerForm);
      expect(summary.repeatingTableFields).toBe(spec.forms);
      expect(summary.repeatingColumns).toBe(spec.forms * 4);
      expect(summary.calculatedFields).toBe(spec.forms);
      expect(summary.logForms).toBeGreaterThan(0);
      expect(summary.repeatingSections).toBeGreaterThan(0);
    }
  );

  it("produces different documents for different sizes", () => {
    const fingerprints = new Set(
      IDS.map((id) => JSON.stringify(generateCrfWorkload(id)).length)
    );
    expect(fingerprints.size).toBe(3);
  });

  it("is a valid, conformance-clean study whose saved scenarios all pass", () => {
    const study = generateCrfWorkload("small");
    expect(validateUniversalCrf(study).errors).toEqual([]);
    expect(validateStudyCompliance(study)).toEqual([]);
    for (const form of study.forms) {
      for (const summary of runScenariosForForm(study, form.id).summaries) {
        expect(summary).toMatchObject({ standing: "passing", failed: 0 });
      }
    }
  });

  it("applies a known amendment without mutating the input", () => {
    const study = generateCrfWorkload("small");
    const before = JSON.stringify(study);
    const { study: amended, amendments } = amendCrfWorkload(study, 3);
    expect(JSON.stringify(study)).toBe(before);
    expect(amendments).toHaveLength(3);
    const diff = compareStudyToBaseline(amended, study, {
      id: "b",
      versionTag: "v1.0",
      label: "pristine",
    });
    expect(
      diff.entries.filter((entry) => entry.category === "field")
    ).toHaveLength(3);
  });

  it("rejects an unknown workload id", () => {
    expect(() => getCrfWorkloadSpec("huge" as CrfWorkloadId)).toThrow(
      /Unknown CRF workload/
    );
  });
});
