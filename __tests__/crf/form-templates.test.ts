// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  FORM_TEMPLATES_CORRUPT_BACKUP_KEY,
  FORM_TEMPLATES_STORAGE_KEY,
  MAX_FORM_TEMPLATES,
  MAX_TEMPLATE_PACKAGE_CHARS,
  captureFormTemplate,
  deleteFormTemplate,
  exportFormTemplates,
  importFormTemplates,
  instantiateFormTemplate,
  listFormTemplates,
  parseFormTemplatePackage,
  saveFormTemplate,
} from "@/lib/crf/form-templates";
import type {
  CRFField,
  CRFForm,
  CodelistDefinition,
  StudyProtocol,
} from "@/lib/crf/types";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function field(overrides: Partial<CRFField> = {}): CRFField {
  return {
    id: "f-1",
    variableName: "SYSBP",
    label: "Systolic",
    dataType: "number",
    columnSpan: 4,
    required: false,
    ...overrides,
  };
}

const codelists: CodelistDefinition[] = [
  { id: "cl-pos", name: "Position", options: [] },
  { id: "cl-unused", name: "Unused", options: [] },
];

function form(): CRFForm {
  return {
    id: "form-vs",
    name: "Vital Signs",
    domain: "VS",
    description: "Vitals",
    version: "1.0",
    isLocked: true,
    lockedBy: "pi",
    lockedAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: "sec-a",
        title: "Blood pressure",
        fields: [
          field({ codelistId: "cl-pos" }),
          field({ id: "f-2", variableName: "DIABP", label: "Diastolic" }),
        ],
      },
      {
        id: "sec-b",
        title: "Pulse",
        fields: [
          field({
            id: "f-3",
            variableName: "TOTAL",
            label: "Total",
            calculationFormula: "SYSBP + DIABP",
          }),
        ],
      },
    ],
    rules: [
      {
        id: "r-1",
        name: "Require diastolic",
        description: "",
        triggerFieldIds: ["f-1"],
        actionType: "require_field",
        targetFieldId: "f-3",
        conditions: [{ fieldId: "f-2", operator: "is_not_empty", value: "" }],
        logicalOperator: "AND",
      },
    ],
  };
}

function study(overrides: Partial<StudyProtocol> = {}): StudyProtocol {
  return fromPartial<StudyProtocol>({
    id: "s",
    forms: [],
    visits: [],
    codelists: [],
    ...overrides,
  });
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});
const store = () => storage as unknown as Storage;

describe("captureFormTemplate", () => {
  it("copies the form, keeps only referenced codelists and drops the lock", () => {
    const source = form();
    const template = captureFormTemplate({ form: source, codelists });
    expect(template.name).toBe("Vital Signs");
    expect(template.codelists.map((c) => c.id)).toEqual(["cl-pos"]);
    expect(template.form.isLocked).toBeUndefined();
    expect(template.form.lockedBy).toBeUndefined();
    expect(template.form.sections).toHaveLength(2);
    source.sections[0].fields[0].label = "MUTATED";
    expect(template.form.sections[0].fields[0].label).toBe("Systolic");
  });

  it("uses a custom name and trims it", () => {
    const template = captureFormTemplate({
      form: form(),
      codelists,
      name: "  My vitals  ",
    });
    expect(template.name).toBe("My vitals");
  });
});

describe("template store", () => {
  it("saves, lists newest first, replaces by id and deletes", () => {
    const a = captureFormTemplate({
      form: form(),
      codelists,
      name: "A",
      now: new Date("2026-01-01"),
    });
    const b = captureFormTemplate({
      form: form(),
      codelists,
      name: "B",
      now: new Date("2026-02-01"),
    });
    expect(saveFormTemplate(a, store()).status).toBe("saved");
    saveFormTemplate(b, store());
    expect(listFormTemplates(store()).map((t) => t.name)).toEqual(["B", "A"]);

    saveFormTemplate({ ...a, name: "A2" }, store());
    expect(listFormTemplates(store())).toHaveLength(2);
    expect(listFormTemplates(store()).some((t) => t.name === "A2")).toBe(true);

    deleteFormTemplate(a.id, store());
    expect(listFormTemplates(store()).map((t) => t.name)).toEqual(["B"]);
  });

  it("stops at the template limit but still allows replacing one", () => {
    for (let i = 0; i < MAX_FORM_TEMPLATES; i++) {
      saveFormTemplate(
        captureFormTemplate({ form: form(), codelists }),
        store()
      );
    }
    const extra = captureFormTemplate({ form: form(), codelists });
    expect(saveFormTemplate(extra, store())).toEqual({
      status: "limit",
      max: MAX_FORM_TEMPLATES,
    });
    const existing = listFormTemplates(store())[0];
    expect(
      saveFormTemplate({ ...existing, name: "Renamed" }, store()).status
    ).toBe("saved");
  });

  it("reports an error when the store rejects the write", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    expect(
      saveFormTemplate(captureFormTemplate({ form: form(), codelists }), full)
    ).toEqual({ status: "error", message: "quota" });
  });

  it("keeps an unreadable payload as a backup and reads as empty", () => {
    storage.setItem(FORM_TEMPLATES_STORAGE_KEY, "{broken");
    expect(listFormTemplates(store())).toEqual([]);
    expect(storage.getItem(FORM_TEMPLATES_CORRUPT_BACKUP_KEY)).toBe("{broken");
  });

  it("leaves out stored entries that fail validation", () => {
    const good = captureFormTemplate({ form: form(), codelists });
    storage.setItem(
      FORM_TEMPLATES_STORAGE_KEY,
      JSON.stringify({
        envelopeVersion: 1,
        savedAt: "x",
        templates: [good, { id: "bad" }, null],
      })
    );
    expect(listFormTemplates(store())).toHaveLength(1);
  });

  it("reads as empty when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(listFormTemplates(broken)).toEqual([]);
  });
});

describe("template packages", () => {
  it("round-trips with fresh ids", () => {
    const template = captureFormTemplate({ form: form(), codelists });
    const { templates, skipped } = parseFormTemplatePackage(
      exportFormTemplates([template])
    );
    expect(skipped).toBe(0);
    expect(templates).toHaveLength(1);
    expect(templates[0].id).not.toBe(template.id);
    expect(templates[0].form.sections[0].fields[0].label).toBe("Systolic");
  });

  it.each([
    ["not json", "nope"],
    ["wrong version", JSON.stringify({ packageVersion: 9, templates: [] })],
    ["no templates array", JSON.stringify({ packageVersion: 1 })],
    ["an array", "[]"],
  ])("rejects %s", (_name, text) => {
    expect(() => parseFormTemplatePackage(text)).toThrow(
      /not a form template package/
    );
  });

  it("rejects a package with no valid template", () => {
    expect(() =>
      parseFormTemplatePackage(
        JSON.stringify({ packageVersion: 1, templates: [{ id: "x" }] })
      )
    ).toThrow(/no valid form templates/);
  });

  it("rejects oversize input before parsing", () => {
    expect(() =>
      parseFormTemplatePackage("x".repeat(MAX_TEMPLATE_PACKAGE_CHARS + 1))
    ).toThrow(/too large/);
  });

  it("skips invalid templates and counts them", () => {
    const template = captureFormTemplate({ form: form(), codelists });
    const result = parseFormTemplatePackage(
      JSON.stringify({ packageVersion: 1, templates: [template, { id: "x" }] })
    );
    expect(result.templates).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("refuses variable names that are not plain identifiers", () => {
    const template = captureFormTemplate({ form: form(), codelists });
    template.form.sections[0].fields[0].variableName = "A.*";
    expect(() =>
      parseFormTemplatePackage(exportFormTemplates([template]))
    ).toThrow(/no valid form templates/);
  });

  it("refuses a template with no sections or too many fields", () => {
    const empty = captureFormTemplate({ form: form(), codelists });
    empty.form.sections = [];
    const big = captureFormTemplate({ form: form(), codelists });
    big.form.sections[0].fields = Array.from({ length: 1001 }, (_, i) =>
      field({ id: `f${i}`, variableName: `V${i}` })
    );
    expect(() =>
      parseFormTemplatePackage(exportFormTemplates([empty, big]))
    ).toThrow(/no valid form templates/);
  });

  it("imports into the store without replacing existing templates", () => {
    const existing = captureFormTemplate({
      form: form(),
      codelists,
      name: "Mine",
    });
    saveFormTemplate(existing, store());
    const out = importFormTemplates(exportFormTemplates([existing]), store());
    expect(out).toMatchObject({ imported: 1, skipped: 0 });
    const names = listFormTemplates(store()).map((t) => t.name);
    expect(names).toEqual(["Mine", "Mine"]);
    expect(new Set(listFormTemplates(store()).map((t) => t.id)).size).toBe(2);
  });

  it("imports only as many as fit", () => {
    for (let i = 0; i < MAX_FORM_TEMPLATES - 1; i++) {
      saveFormTemplate(
        captureFormTemplate({ form: form(), codelists }),
        store()
      );
    }
    const three = [1, 2, 3].map(() =>
      captureFormTemplate({ form: form(), codelists })
    );
    const out = importFormTemplates(exportFormTemplates(three), store());
    expect(out.imported).toBe(1);
    expect(out.skipped).toBe(2);
    expect(listFormTemplates(store())).toHaveLength(MAX_FORM_TEMPLATES);
    const none = importFormTemplates(exportFormTemplates(three), store());
    expect(none.imported).toBe(0);
    expect(none.result.status).toBe("limit");
  });
});

describe("instantiateFormTemplate", () => {
  const template = () => captureFormTemplate({ form: form(), codelists });

  it("gives every section, field, rule and the form a new id", () => {
    const t = template();
    const { form: copy } = instantiateFormTemplate(t, study());
    expect(copy.id).not.toBe(t.form.id);
    const ids = (f: CRFForm) => [
      ...f.sections.map((s) => s.id),
      ...f.sections.flatMap((s) => s.fields.map((x) => x.id)),
      ...f.rules.map((r) => r.id),
    ];
    const before = new Set(ids(t.form));
    expect(ids(copy).every((id) => !before.has(id))).toBe(true);
    expect(copy.sections.map((s) => s.title)).toEqual([
      "Blood pressure",
      "Pulse",
    ]);
  });

  it("remaps rule references across sections", () => {
    const { form: copy } = instantiateFormTemplate(template(), study());
    const [bp, pulse] = copy.sections;
    const rule = copy.rules[0];
    expect(rule.triggerFieldIds).toEqual([bp.fields[0].id]);
    expect(rule.targetFieldId).toBe(pulse.fields[0].id);
    expect(rule.conditions[0].fieldId).toBe(bp.fields[1].id);
  });

  it("renames colliding variables and follows them in formulas", () => {
    const existing = study({
      forms: [
        fromPartial<CRFForm>({
          id: "x",
          name: "X",
          sections: [
            {
              id: "s",
              title: "S",
              fields: [field({ id: "e1", variableName: "SYSBP" })],
            },
          ],
          rules: [],
        }),
      ],
    });
    const { form: copy } = instantiateFormTemplate(template(), existing);
    const renamed = copy.sections[0].fields[0].variableName;
    expect(renamed).not.toBe("SYSBP");
    expect(copy.sections[1].fields[0].calculationFormula).toContain(renamed);
    expect(copy.sections[0].fields[1].variableName).toBe("DIABP");
  });

  it("carries only codelists the study lacks", () => {
    expect(instantiateFormTemplate(template(), study()).codelists).toHaveLength(
      1
    );
    const has = study({ codelists: [codelists[0]] });
    expect(instantiateFormTemplate(template(), has).codelists).toEqual([]);
  });

  it("does not alter the template", () => {
    const t = template();
    const snapshot = JSON.stringify(t);
    instantiateFormTemplate(t, study());
    expect(JSON.stringify(t)).toBe(snapshot);
  });
});
