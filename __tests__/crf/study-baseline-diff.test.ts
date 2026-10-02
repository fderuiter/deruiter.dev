// @vitest-environment node
import { describe, it, expect } from "vitest";
import { compareStudyToBaseline } from "@/lib/crf/study-baseline-diff";
import type {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  EditCheckRule,
  CodelistDefinition,
  StudyVisit,
} from "@/lib/crf/types";

// Regression coverage for #676: authors must be able to compare a working
// draft against a named baseline snapshot across every supported category
// (fields, rules, formulas, codelists, sections, study metadata, schedule
// relationships), matching objects by stable id rather than array position
// or label, so a rename/move is one "modified" entry, never a delete+add.

function buildField(overrides: Partial<CRFField> = {}): CRFField {
  return {
    id: "f-systolic",
    variableName: "SYSBP",
    label: "Systolic Blood Pressure",
    dataType: "number",
    columnSpan: 4,
    required: true,
    ...overrides,
  };
}

function buildSection(overrides: Partial<CRFSection> = {}): CRFSection {
  return {
    id: "sec-vitals",
    title: "Vital Signs",
    fields: [buildField()],
    ...overrides,
  };
}

function buildRule(overrides: Partial<EditCheckRule> = {}): EditCheckRule {
  return {
    id: "rule-1",
    name: "Require Diastolic When Systolic Present",
    description: "",
    triggerFieldIds: ["f-systolic"],
    actionType: "require_field",
    targetFieldId: "f-diastolic",
    conditions: [
      { fieldId: "f-systolic", operator: "is_not_empty", value: "" },
    ],
    logicalOperator: "AND",
    ...overrides,
  };
}

function buildForm(overrides: Partial<CRFForm> = {}): CRFForm {
  return {
    id: "form-vs",
    name: "Vital Signs",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [buildSection()],
    rules: [buildRule()],
    ...overrides,
  };
}

function buildCodelist(
  overrides: Partial<CodelistDefinition> = {}
): CodelistDefinition {
  return {
    id: "cl-sex",
    name: "Sex",
    options: [
      { code: "M", label: "Male", order: 0 },
      { code: "F", label: "Female", order: 1 },
    ],
    ...overrides,
  };
}

function buildVisit(overrides: Partial<StudyVisit> = {}): StudyVisit {
  return {
    id: "v-screen",
    oid: "SE.SCREENING",
    name: "Screening",
    visitType: "Scheduled",
    targetDay: 0,
    windowBefore: 3,
    windowAfter: 3,
    assignedFormIds: ["form-vs"],
    ...overrides,
  };
}

function buildStudy(overrides: Partial<StudyProtocol> = {}): StudyProtocol {
  return {
    id: "study-1",
    protocolNumber: "ONC-2026-003",
    studyName: "Phase III Study",
    phase: "Phase III",
    sponsor: "Acme Oncology",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [buildForm()],
    visits: [buildVisit()],
    codelists: [buildCodelist()],
    ...overrides,
  };
}

const baselineMeta = {
  id: "base-1",
  versionTag: "v1.0",
  label: "Interim Lock",
};

describe("compareStudyToBaseline (#676)", () => {
  it("reports no differences for an identical study", () => {
    const study = buildStudy();
    const result = compareStudyToBaseline(study, buildStudy(), baselineMeta);

    expect(result.entries).toEqual([]);
    expect(result.summary.hasChanges).toBe(false);
    expect(result.summary.totalChanges).toBe(0);
    expect(result.baselineVersionTag).toBe("v1.0");
  });

  it("ignores lastModified-only differences (not a meaningful change)", () => {
    const baseline = buildStudy({ lastModified: "2026-01-01T00:00:00.000Z" });
    const current = buildStudy({ lastModified: "2026-02-02T00:00:00.000Z" });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    expect(result.summary.hasChanges).toBe(false);
  });

  it("detects a study metadata change", () => {
    const baseline = buildStudy({ sponsor: "Acme Oncology" });
    const current = buildStudy({ sponsor: "Acme Global Oncology" });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);

    const entry = result.entries.find((e) => e.category === "study_metadata");
    expect(entry).toBeDefined();
    expect(entry?.changeType).toBe("modified");
    expect(entry?.oldValue).toBe("Acme Oncology");
    expect(entry?.newValue).toBe("Acme Global Oncology");
    expect(result.summary.byCategory.study_metadata.modified).toBe(1);
  });

  it("detects an added form and a removed form", () => {
    const baseline = buildStudy({
      forms: [buildForm({ id: "form-a", name: "Form A" })],
    });
    const current = buildStudy({
      forms: [buildForm({ id: "form-b", name: "Form B" })],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);

    const added = result.entries.find(
      (e) => e.category === "form" && e.changeType === "added"
    );
    const removed = result.entries.find(
      (e) => e.category === "form" && e.changeType === "removed"
    );
    expect(added?.id).toBe("form-b");
    expect(removed?.id).toBe("form-a");
  });

  it("treats a same-id form rename as one modified entry, not add+remove", () => {
    const baseline = buildStudy({
      forms: [buildForm({ name: "Vital Signs" })],
    });
    const current = buildStudy({
      forms: [buildForm({ name: "Vital Signs (Renamed)" })],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);

    const formEntries = result.entries.filter((e) => e.category === "form");
    expect(formEntries).toHaveLength(1);
    expect(formEntries[0].changeType).toBe("modified");
    expect(formEntries[0].changedFields).toContain("name");
  });

  it("detects an added section and a removed section within a persisting form", () => {
    const baseline = buildStudy({
      forms: [
        buildForm({
          sections: [buildSection({ id: "sec-a", title: "Section A" })],
        }),
      ],
    });
    const current = buildStudy({
      forms: [
        buildForm({
          sections: [buildSection({ id: "sec-b", title: "Section B" })],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const sectionEntries = result.entries.filter(
      (e) => e.category === "section"
    );
    expect(
      sectionEntries.some((e) => e.changeType === "added" && e.id === "sec-b")
    ).toBe(true);
    expect(
      sectionEntries.some((e) => e.changeType === "removed" && e.id === "sec-a")
    ).toBe(true);
  });

  it("detects a field added to and removed from a persisting section", () => {
    const baseline = buildStudy({
      forms: [
        buildForm({
          sections: [buildSection({ fields: [buildField({ id: "f-old" })] })],
        }),
      ],
    });
    const current = buildStudy({
      forms: [
        buildForm({
          sections: [buildSection({ fields: [buildField({ id: "f-new" })] })],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const fieldEntries = result.entries.filter((e) => e.category === "field");
    expect(
      fieldEntries.some((e) => e.changeType === "added" && e.id === "f-new")
    ).toBe(true);
    expect(
      fieldEntries.some((e) => e.changeType === "removed" && e.id === "f-old")
    ).toBe(true);
  });

  it("treats a field moved between sections as one modified entry", () => {
    const baseline = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({
              id: "sec-a",
              title: "Section A",
              fields: [buildField()],
            }),
            buildSection({ id: "sec-b", title: "Section B", fields: [] }),
          ],
        }),
      ],
    });
    const current = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({ id: "sec-a", title: "Section A", fields: [] }),
            buildSection({
              id: "sec-b",
              title: "Section B",
              fields: [buildField()],
            }),
          ],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const fieldEntries = result.entries.filter((e) => e.category === "field");
    expect(fieldEntries).toHaveLength(1);
    expect(fieldEntries[0].changeType).toBe("modified");
    expect(fieldEntries[0].changedFields).toContain("section");
    expect(fieldEntries[0].sectionId).toBe("sec-b");
  });

  it("preserves affected-uses context for a deleted field referenced by a rule", () => {
    const baseline = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({ fields: [buildField({ id: "f-systolic" })] }),
          ],
          rules: [buildRule({ triggerFieldIds: ["f-systolic"] })],
        }),
      ],
    });
    const current = buildStudy({
      forms: [
        buildForm({
          sections: [buildSection({ fields: [] })],
          rules: [buildRule({ triggerFieldIds: ["f-systolic"] })],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const removedField = result.entries.find(
      (e) => e.category === "field" && e.changeType === "removed"
    );
    expect(removedField?.affectedUses).toBeDefined();
    expect(removedField?.affectedUses?.[0]).toMatch(/Require Diastolic/);
  });

  it("detects a rule change", () => {
    const baseline = buildStudy({
      forms: [buildForm({ rules: [buildRule({ querySeverity: "warning" })] })],
    });
    const current = buildStudy({
      forms: [buildForm({ rules: [buildRule({ querySeverity: "error" })] })],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const ruleEntry = result.entries.find((e) => e.category === "rule");
    expect(ruleEntry?.changeType).toBe("modified");
    expect(ruleEntry?.changedFields).toContain("querySeverity");
  });

  it("reports a calculated field's formula change as its own formula-category entry", () => {
    const baseline = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({
              fields: [
                buildField({
                  id: "f-bmi",
                  dataType: "calculated",
                  calculationFormula: "weight / (height * height)",
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const current = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({
              fields: [
                buildField({
                  id: "f-bmi",
                  dataType: "calculated",
                  calculationFormula: "weight / ((height/100) * (height/100))",
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const formulaEntry = result.entries.find((e) => e.category === "formula");
    expect(formulaEntry).toBeDefined();
    expect(formulaEntry?.changeType).toBe("modified");
    expect(formulaEntry?.oldValue).toBe("weight / (height * height)");
    expect(formulaEntry?.newValue).toBe(
      "weight / ((height/100) * (height/100))"
    );
    // The field's own dataType/label are unchanged, so no generic field entry.
    expect(result.entries.some((e) => e.category === "field")).toBe(false);
  });

  it("detects an added and modified codelist, preserving affected-uses on deletion", () => {
    const baseline = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({
              fields: [
                buildField({
                  id: "f-sex",
                  variableName: "SEX",
                  label: "Sex",
                  codelistId: "cl-sex",
                }),
              ],
            }),
          ],
        }),
      ],
      codelists: [buildCodelist()],
    });
    const current = buildStudy({
      forms: [
        buildForm({
          sections: [
            buildSection({
              fields: [
                buildField({
                  id: "f-sex",
                  variableName: "SEX",
                  label: "Sex",
                  codelistId: "cl-sex",
                }),
              ],
            }),
          ],
        }),
      ],
      codelists: [
        buildCodelist({
          id: "cl-race",
          name: "Race",
          options: [{ code: "W", label: "White", order: 0 }],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const codelistEntries = result.entries.filter(
      (e) => e.category === "codelist"
    );
    const added = codelistEntries.find((e) => e.changeType === "added");
    const removed = codelistEntries.find((e) => e.changeType === "removed");
    expect(added?.id).toBe("cl-race");
    expect(removed?.id).toBe("cl-sex");
    expect(removed?.affectedUses?.[0]).toMatch(/f-sex|Sex/i);
  });

  it("detects a codelist option change as a modification", () => {
    const baseline = buildStudy({ codelists: [buildCodelist()] });
    const current = buildStudy({
      codelists: [
        buildCodelist({
          options: [
            { code: "M", label: "Male", order: 0 },
            { code: "F", label: "Female", order: 1 },
            { code: "U", label: "Unknown/Not Reported", order: 2 },
          ],
        }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const entry = result.entries.find((e) => e.category === "codelist");
    expect(entry?.changeType).toBe("modified");
    expect(entry?.changedFields).toContain("options");
  });

  it("detects a schedule (visit) change", () => {
    const baseline = buildStudy({ visits: [buildVisit({ windowAfter: 3 })] });
    const current = buildStudy({ visits: [buildVisit({ windowAfter: 5 })] });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const entry = result.entries.find((e) => e.category === "schedule");
    expect(entry?.id).toBe("v-screen");
    expect(entry?.changeType).toBe("modified");
    expect(entry?.changedFields).toContain("windowAfter");
  });

  it("detects an added visit and a removed visit", () => {
    const baseline = buildStudy({
      visits: [buildVisit({ id: "v-1", name: "Visit 1" })],
    });
    const current = buildStudy({
      visits: [buildVisit({ id: "v-2", name: "Visit 2" })],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);
    const scheduleEntries = result.entries.filter(
      (e) => e.category === "schedule"
    );
    expect(
      scheduleEntries.some((e) => e.changeType === "added" && e.id === "v-2")
    ).toBe(true);
    expect(
      scheduleEntries.some((e) => e.changeType === "removed" && e.id === "v-1")
    ).toBe(true);
  });

  it("summarizes counts correctly across multiple simultaneous changes", () => {
    const baseline = buildStudy({
      studyName: "Original Name",
      forms: [buildForm({ rules: [buildRule({ querySeverity: "info" })] })],
      codelists: [buildCodelist()],
    });
    const current = buildStudy({
      studyName: "Renamed Study",
      forms: [buildForm({ rules: [buildRule({ querySeverity: "error" })] })],
      codelists: [
        buildCodelist(),
        buildCodelist({ id: "cl-race", name: "Race", options: [] }),
      ],
    });
    const result = compareStudyToBaseline(current, baseline, baselineMeta);

    expect(result.summary.hasChanges).toBe(true);
    expect(result.summary.addedCount).toBe(1); // new codelist
    expect(result.summary.modifiedCount).toBe(2); // study metadata + rule
    expect(result.summary.removedCount).toBe(0);
    expect(result.summary.totalChanges).toBe(
      result.summary.addedCount +
        result.summary.removedCount +
        result.summary.modifiedCount
    );
  });
});
