// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { compareStudyToBaseline } from "@/lib/crf/study-baseline-diff";
import type {
  StudyProtocol,
  CRFForm,
  CRFField,
  CodelistDefinition,
  EditCheckRule,
  StudyVisit,
  StudyArm,
} from "@/lib/crf/types";

// Cross-study comparison: two studies share no ids, so objects are paired by
// name and id references compare by what they point at. Same-study
// comparison keeps matching by id only.

function field(overrides: Partial<CRFField> = {}): CRFField {
  return {
    id: "f-sys",
    variableName: "SYSBP",
    label: "Systolic Blood Pressure",
    dataType: "number",
    columnSpan: 4,
    required: true,
    ...overrides,
  };
}

function rule(overrides: Partial<EditCheckRule> = {}): EditCheckRule {
  return {
    id: "r-1",
    name: "Require Diastolic",
    description: "",
    triggerFieldIds: ["f-sys"],
    actionType: "require_field",
    targetFieldId: "f-dia",
    conditions: [{ fieldId: "f-sys", operator: "is_not_empty", value: "" }],
    logicalOperator: "AND",
    ...overrides,
  };
}

function form(overrides: Partial<CRFForm> = {}): CRFForm {
  return {
    id: "form-vs",
    name: "Vital Signs",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec-vs",
        title: "Vital Signs",
        fields: [
          field({ codelistId: "cl-pos" }),
          field({ id: "f-dia", variableName: "DIABP", label: "Diastolic" }),
        ],
      },
    ],
    rules: [rule()],
    ...overrides,
  };
}

function codelist(overrides: Partial<CodelistDefinition> = {}) {
  return {
    id: "cl-pos",
    name: "Position",
    options: [{ code: "SIT", label: "Sitting", order: 0 }],
    ...overrides,
  };
}

function visit(overrides: Partial<StudyVisit> = {}): StudyVisit {
  return {
    id: "v-1",
    oid: "SE.SCREENING",
    name: "Screening",
    visitType: "Scheduled",
    targetDay: 0,
    windowBefore: 0,
    windowAfter: 0,
    assignedFormIds: ["form-vs"],
    ...overrides,
  };
}

function study(overrides: Partial<StudyProtocol> = {}): StudyProtocol {
  return {
    id: "study-a",
    protocolNumber: "P-1",
    studyName: "Study",
    phase: "Phase I",
    sponsor: "Acme",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [form()],
    visits: [visit()],
    codelists: [codelist()],
    ...overrides,
  };
}

/** The same study under entirely different ids. */
function reId(source: StudyProtocol, id = "study-b"): StudyProtocol {
  const ids = new Set<string>();
  JSON.stringify(source, (key, value) => {
    if (key === "id" && typeof value === "string") ids.add(value);
    return value;
  });
  let json = JSON.stringify(source);
  for (const old of ids) {
    json = json.split(`"${old}"`).join(`"b-${old}"`);
  }
  return { ...(JSON.parse(json) as StudyProtocol), id };
}

const meta = { id: "other", versionTag: "file", label: "other.json" };
const kinds = (r: ReturnType<typeof compareStudyToBaseline>) =>
  r.entries.map((e) => `${e.category}:${e.changeType}:${e.label}`);

describe("cross-study comparison", () => {
  it("reports no change for the same content under different ids", () => {
    const result = compareStudyToBaseline(study(), reId(study()), meta);
    expect(result.entries).toEqual([]);
  });

  it("reports a field label edit as one modified entry", () => {
    const baseline = reId(study());
    const current = study();
    current.forms[0].sections[0].fields[0].label = "Systolic BP (mmHg)";
    const result = compareStudyToBaseline(current, baseline, meta);
    expect(kinds(result)).toEqual(["field:modified:Systolic BP (mmHg)"]);
    expect(result.entries[0].changedFields).toEqual(["label"]);
  });

  it("reports added and removed fields, forms and codelists", () => {
    const baseline = reId(study());
    const current = study();
    current.forms[0].sections[0].fields.push(
      field({ id: "f-hr", variableName: "HR", label: "Heart rate" })
    );
    current.forms[0].sections[0].fields.splice(1, 1); // drop DIABP
    current.forms.push(form({ id: "form-ae", name: "Adverse Events" }));
    current.codelists = [];
    const got = kinds(compareStudyToBaseline(current, baseline, meta));
    expect(got).toContain("field:added:Heart rate");
    expect(got).toContain("field:removed:Diastolic");
    expect(got).toContain("form:added:Adverse Events");
    expect(got).toContain("codelist:removed:Position");
  });

  it("pairs a renamed form by its domain and name only when unambiguous", () => {
    const baseline = reId(study());
    const current = study();
    current.forms = [form({ name: "Vital Signs" }), form({ id: "form-vs2" })];
    // Two forms named "Vital Signs" in the current study: ambiguous, so the
    // baseline form is reported removed and both are added.
    const got = kinds(compareStudyToBaseline(current, baseline, meta));
    expect(got.filter((k) => k.startsWith("form:added"))).toHaveLength(2);
    expect(got.filter((k) => k.startsWith("form:removed"))).toHaveLength(1);
  });

  it("does not depend on array order when pairing", () => {
    const baseline = reId(study());
    const current = study();
    current.forms[0].sections[0].fields.reverse();
    expect(compareStudyToBaseline(current, baseline, meta).entries).toEqual([]);
  });

  it("compares codelist references by codelist name", () => {
    const baseline = reId(study());
    const current = study();
    // Same codelist, field now points at a different one.
    current.codelists.push(codelist({ id: "cl-other", name: "Other" }));
    current.forms[0].sections[0].fields[0].codelistId = "cl-other";
    const result = compareStudyToBaseline(current, baseline, meta);
    const fieldEntry = result.entries.find((e) => e.category === "field");
    expect(fieldEntry?.changedFields).toEqual(["codelistId"]);
    expect(fieldEntry?.oldValue).toEqual({ codelistId: "codelist:Position" });
    expect(fieldEntry?.newValue).toEqual({ codelistId: "codelist:Other" });
  });

  it("does not flag visit form assignments or rule field references", () => {
    const baseline = reId(study());
    const current = study();
    const result = compareStudyToBaseline(current, baseline, meta);
    expect(result.entries.filter((e) => e.category === "schedule")).toEqual([]);
    expect(result.entries.filter((e) => e.category === "rule")).toEqual([]);
  });

  it("still sees a rule that now targets another field", () => {
    const baseline = reId(study());
    const current = study();
    current.forms[0].rules[0].targetFieldId = "f-sys";
    const result = compareStudyToBaseline(current, baseline, meta);
    const entry = result.entries.find((e) => e.category === "rule");
    expect(entry?.changeType).toBe("modified");
    expect(entry?.changedFields).toEqual(["targetFieldId"]);
  });

  it("relabels arm form assignments", () => {
    const withArms = (s: StudyProtocol): StudyProtocol => ({
      ...s,
      arms: [fromPartial<StudyArm>({ id: "arm-1", name: "Active" })],
      visits: [
        visit({
          armFormAssignments: { "arm-1": ["form-vs"] },
          armIds: ["arm-1"],
        }),
      ],
    });
    const base = withArms(study());
    const result = compareStudyToBaseline(base, reId(base), meta);
    expect(result.entries).toEqual([]);
  });

  it("lists baseline rules that referenced a removed field", () => {
    const baseline = reId(study());
    const current = study();
    current.forms[0].sections[0].fields.splice(1, 1);
    const removed = compareStudyToBaseline(
      current,
      baseline,
      meta
    ).entries.find((e) => e.changeType === "removed" && e.category === "field");
    expect(removed?.affectedUses?.join(" ")).toContain("Require Diastolic");
  });

  it("matches by id only within one study", () => {
    const baseline = study();
    const current = study();
    current.forms[0].sections[0].fields[0].id = "f-new";
    const got = kinds(compareStudyToBaseline(current, baseline, meta));
    expect(got).toContain("field:added:Systolic Blood Pressure");
    expect(got).toContain("field:removed:Systolic Blood Pressure");
  });

  it("can be forced either way with the crossStudy option", () => {
    const baseline = reId(study());
    const byId = compareStudyToBaseline(study(), baseline, meta, {
      crossStudy: false,
    });
    expect(byId.entries.length).toBeGreaterThan(0);
    const same = study();
    const byName = compareStudyToBaseline(same, reId(same, same.id), meta, {
      crossStudy: true,
    });
    expect(byName.entries).toEqual([]);
  });

  it("tolerates missing names and titles", () => {
    const baseline = reId(study());
    const current = study();
    (current.forms[0].sections[0] as { title?: string }).title = undefined;
    expect(() => compareStudyToBaseline(current, baseline, meta)).not.toThrow();
  });
});
