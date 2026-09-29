import { describe, it, expect, beforeEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  captureLibraryEntry,
  listLibraryEntries,
  upsertLibraryEntry,
  updateLibraryEntry,
  deleteLibraryEntry,
  loadPersonalLibrary,
  savePersonalLibrary,
  resolveLibraryStorage,
  previewLibraryInsertion,
  instantiateLibraryEntry,
  insertLibraryEntryIntoStudy,
  PERSONAL_LIBRARY_STORAGE_KEY,
  PERSONAL_LIBRARY_CORRUPT_BACKUP_KEY,
  type PersonalLibraryEntry,
  type CRFField,
  type CRFForm,
  type CodelistDefinition,
  type EditCheckRule,
  type StudyProtocol,
} from "@/lib/crf";

/**
 * #678 — save and reuse versioned personal clinical blocks.
 *
 * The journey the acceptance criteria name is exercised end to end:
 * save, reopen the library, insert twice, then customize one copy and prove
 * the others did not move.
 */

/** Minimal in-memory Storage, isolated per test. */
class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function field(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "text",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

const SEX_CODELIST: CodelistDefinition = {
  id: "cl_sex",
  name: "Sex",
  nciCodelistCode: "C66731",
  options: [
    { code: "F", label: "Female" },
    { code: "M", label: "Male" },
  ],
} as CodelistDefinition;

const OTHER_CODELIST: CodelistDefinition = {
  id: "cl_unused",
  name: "Unused",
  options: [{ code: "X", label: "X" }],
} as CodelistDefinition;

function buildForm(): CRFForm {
  const height = field({ id: "fld_height", variableName: "HEIGHT" });
  const weight = field({ id: "fld_weight", variableName: "WEIGHT" });
  const bmi = field({
    id: "fld_bmi",
    variableName: "BMI",
    dataType: "calculated",
    calculationFormula: "WEIGHT / ((HEIGHT/100) * (HEIGHT/100))",
  });
  const sex = field({
    id: "fld_sex",
    variableName: "SEX",
    codelistId: "cl_sex",
  });
  const unrelated = field({ id: "fld_other", variableName: "OTHER" });

  const dependentRule: EditCheckRule = {
    id: "rule_bmi_range",
    name: "Query implausible BMI",
    description: "",
    triggerFieldIds: ["fld_weight"],
    actionType: "raise_query",
    targetFieldId: "fld_bmi",
    conditions: [{ fieldId: "fld_height", operator: "lt", value: 50 }],
    conditionGroups: [
      {
        id: "grp_1",
        logicalOperator: "AND",
        conditions: [
          {
            fieldId: "fld_weight",
            operator: "gt",
            value: 0,
            compareFieldId: "fld_height",
          },
        ],
      },
    ],
    groupLogicalOperator: "AND",
    logicalOperator: "AND",
    queryMessage: "Check BMI inputs",
  };

  const unrelatedRule: EditCheckRule = {
    id: "rule_unrelated",
    name: "Unrelated",
    description: "",
    triggerFieldIds: ["fld_other"],
    actionType: "raise_query",
    targetFieldId: "fld_other",
    conditions: [{ fieldId: "fld_other", operator: "is_empty", value: "" }],
    logicalOperator: "AND",
  };

  return {
    id: "form_vs",
    name: "Vitals",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec_anthro",
        title: "Anthropometrics",
        fields: [height, weight, bmi, sex],
      },
      { id: "sec_other", title: "Other", fields: [unrelated] },
    ],
    rules: [dependentRule, unrelatedRule],
  };
}

function buildStudy(): StudyProtocol {
  return {
    id: "study_1",
    protocolNumber: "TST-001",
    studyName: "Test Study",
    phase: "Phase II",
    sponsor: "Sponsor",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: new Date().toISOString(),
    forms: [buildForm()],
    visits: [],
    codelists: [SEX_CODELIST, OTHER_CODELIST],
  } as StudyProtocol;
}

describe("[#678] Versioned personal clinical block library", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  function capture(): PersonalLibraryEntry {
    const study = buildStudy();
    return captureLibraryEntry({
      study,
      form: study.forms[0],
      sectionId: "sec_anthro",
      name: "Anthropometrics block",
      assumptions: "Height in cm, weight in kg.",
    });
  }

  describe("Capturing fields, dependent rules, codelists, assumptions and provenance", () => {
    it("captures the section's fields", () => {
      const entry = capture();
      expect(entry.section.fields.map((f) => f.variableName)).toEqual([
        "HEIGHT",
        "WEIGHT",
        "BMI",
        "SEX",
      ]);
    });

    it("pulls in only the rules that depend on the captured fields", () => {
      const entry = capture();
      expect(entry.rules.map((r) => r.id)).toEqual(["rule_bmi_range"]);
    });

    it("pulls in only the codelists the captured fields reference", () => {
      const entry = capture();
      expect(entry.codelists.map((c) => c.id)).toEqual(["cl_sex"]);
    });

    it("records assumptions and provenance", () => {
      const entry = capture();

      expect(entry.assumptions).toBe("Height in cm, weight in kg.");
      expect(entry.provenance).toMatchObject({
        sourceStudyId: "study_1",
        sourceStudyName: "Test Study",
        sourceFormId: "form_vs",
        sourceFormName: "Vitals",
        sourceSectionId: "sec_anthro",
      });
      expect(entry.version).toBe(1);
    });

    it("owns deep copies so later edits to the source study cannot reach it", () => {
      const study = buildStudy();
      const entry = captureLibraryEntry({
        study,
        form: study.forms[0],
        sectionId: "sec_anthro",
      });

      study.forms[0].sections[0].fields[0].label = "MUTATED";
      expect(entry.section.fields[0].label).not.toBe("MUTATED");
    });

    it("refuses to capture a section that is not part of the form", () => {
      const study = buildStudy();
      expect(() =>
        captureLibraryEntry({
          study,
          form: study.forms[0],
          sectionId: "sec_missing",
        })
      ).toThrow(/not part of form/);
    });
  });

  describe("Local persistence", () => {
    it("round-trips entries through storage", () => {
      const entry = capture();
      expect(upsertLibraryEntry(entry, storage).status).toBe("saved");

      const reopened = listLibraryEntries(storage);
      expect(reopened).toHaveLength(1);
      expect(reopened[0].name).toBe("Anthropometrics block");
      expect(reopened[0].rules).toHaveLength(1);
    });

    it("reports a full store as an error instead of throwing", () => {
      const full = new MockStorage();
      full.setItem = () => {
        throw new Error("QuotaExceededError");
      };

      const result = savePersonalLibrary([capture()], full);
      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message).toContain("QuotaExceeded");
      }
    });

    it("reports an unavailable store when no usable Storage exists", () => {
      // Mirrors a server render or a browser with site data blocked, where
      // localStorage is absent or its accessors are not callable.
      const brokenStorage = fromAny<Storage, unknown>({ getItem: undefined });
      expect(resolveLibraryStorage(brokenStorage)).toBe(brokenStorage);

      const originalWindow = globalThis.window;
      // @ts-expect-error deliberately removing window for this assertion
      delete globalThis.window;
      try {
        expect(savePersonalLibrary([])).toEqual({ status: "unavailable" });
        expect(loadPersonalLibrary()).toEqual({ status: "empty" });
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it("preserves a corrupt payload for recovery rather than discarding it", () => {
      storage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, "{not json");

      expect(loadPersonalLibrary(storage).status).toBe("corrupt");
      expect(storage.getItem(PERSONAL_LIBRARY_CORRUPT_BACKUP_KEY)).toBe(
        "{not json"
      );
      // A corrupt library reads as empty rather than crashing the studio.
      expect(listLibraryEntries(storage)).toEqual([]);
    });

    it("treats a version-mismatched envelope as corrupt", () => {
      storage.setItem(
        PERSONAL_LIBRARY_STORAGE_KEY,
        JSON.stringify({ envelopeVersion: 99, savedAt: "x", entries: [] })
      );
      expect(loadPersonalLibrary(storage).status).toBe("corrupt");
    });

    it("deletes an entry without disturbing the others", () => {
      const first = capture();
      const second = { ...capture(), name: "Second" };
      upsertLibraryEntry(first, storage);
      upsertLibraryEntry(second, storage);

      deleteLibraryEntry(first.id, storage);
      const remaining = listLibraryEntries(storage);
      expect(remaining.map((e) => e.id)).toEqual([second.id]);
    });
  });

  describe("Previewing content and conflicts before insertion", () => {
    it("summarizes what will arrive", () => {
      const entry = capture();
      const preview = previewLibraryInsertion(entry, {
        ...buildStudy(),
        forms: [],
        codelists: [],
      } as StudyProtocol);

      expect(preview.fieldCount).toBe(4);
      expect(preview.ruleCount).toBe(1);
      expect(preview.codelistCount).toBe(1);
      expect(preview.conflicts).toHaveLength(0);
    });

    it("reports variable-name collisions and the name each will take", () => {
      const entry = capture();
      // Inserting back into the study it came from collides on every variable.
      const preview = previewLibraryInsertion(entry, buildStudy());

      const variableConflicts = preview.conflicts.filter(
        (c) => c.kind === "variable_name"
      );
      expect(variableConflicts).toHaveLength(4);
      for (const conflict of variableConflicts) {
        expect(conflict.resolution).not.toBe(conflict.existing);
        expect(conflict.detail).toMatch(/already exists/);
      }
    });

    it("reports that an existing codelist definition will be kept", () => {
      const entry = capture();
      const preview = previewLibraryInsertion(entry, buildStudy());

      const codelistConflict = preview.conflicts.find(
        (c) => c.kind === "codelist_id"
      );
      expect(codelistConflict?.existing).toBe("cl_sex");
      expect(codelistConflict?.detail).toMatch(
        /existing definition will be kept/
      );
    });

    it("predicts the same names the insertion actually produces", () => {
      const entry = capture();
      const study = buildStudy();
      const preview = previewLibraryInsertion(entry, study);
      const { instantiated } = insertLibraryEntryIntoStudy(
        entry,
        study,
        "form_vs"
      );

      expect(instantiated.section.fields.map((f) => f.variableName)).toEqual(
        preview.variableNames
      );
    });
  });

  describe("Insertion allocates distinct identities and remaps references", () => {
    it("gives every field and rule a fresh id", () => {
      const entry = capture();
      const result = instantiateLibraryEntry(entry);

      expect(result.section.id).not.toBe(entry.section.id);
      for (const [index, f] of result.section.fields.entries()) {
        expect(f.id).not.toBe(entry.section.fields[index].id);
      }
      expect(result.rules[0].id).not.toBe(entry.rules[0].id);
    });

    it("remaps rule targets, triggers and grouped field-to-field conditions", () => {
      const entry = capture();
      const result = instantiateLibraryEntry(entry);
      const rule = result.rules[0];
      const newIds = new Set(result.section.fields.map((f) => f.id));

      expect(newIds.has(rule.targetFieldId)).toBe(true);
      expect(rule.triggerFieldIds.every((id) => newIds.has(id))).toBe(true);
      expect(newIds.has(rule.conditions[0].fieldId)).toBe(true);

      const grouped = rule.conditionGroups?.[0].conditions[0];
      expect(newIds.has(grouped?.fieldId as string)).toBe(true);
      expect(newIds.has(grouped?.compareFieldId as string)).toBe(true);
    });

    it("rewrites calculation formulas when variables are renamed", () => {
      const entry = capture();
      const result = instantiateLibraryEntry(entry, {
        existingVariableNames: ["HEIGHT", "WEIGHT", "BMI", "SEX"],
      });

      const bmi = result.section.fields.find(
        (f) => f.calculationFormula
      ) as CRFField;
      // Original names were taken, so the formula must not still reference them.
      expect(bmi.calculationFormula).not.toMatch(/\bWEIGHT\b/);
      expect(bmi.calculationFormula).not.toMatch(/\bHEIGHT\b/);
      expect(bmi.calculationFormula).toContain(result.variableMap.WEIGHT);
      expect(bmi.calculationFormula).toContain(result.variableMap.HEIGHT);
    });

    it("reuses a codelist the study already has rather than duplicating it", () => {
      const entry = capture();
      const result = instantiateLibraryEntry(entry, {
        existingCodelistIds: ["cl_sex"],
      });
      expect(result.codelists).toHaveLength(0);
    });

    it("carries a genuinely new codelist across", () => {
      const entry = capture();
      const result = instantiateLibraryEntry(entry, {
        existingCodelistIds: [],
      });
      expect(result.codelists.map((c) => c.id)).toEqual(["cl_sex"]);
    });

    it("records the source entry and the exact version inserted", () => {
      const entry = capture();
      const result = instantiateLibraryEntry(entry);

      expect(result.source).toMatchObject({
        entryId: entry.id,
        entryName: entry.name,
        entryVersion: entry.version,
      });
    });
  });

  describe("The named journey: save, reopen, insert twice, customize one", () => {
    it("keeps the two insertions and the library entry fully independent", () => {
      // Save.
      const entry = capture();
      upsertLibraryEntry(entry, storage);

      // Reopen the library.
      const [reopened] = listLibraryEntries(storage);
      expect(reopened.id).toBe(entry.id);

      // Insert twice into a clean study.
      let study = {
        ...buildStudy(),
        forms: [{ ...buildForm(), sections: [], rules: [] }],
        codelists: [],
      } as StudyProtocol;

      const first = insertLibraryEntryIntoStudy(reopened, study, "form_vs");
      study = first.study;
      const second = insertLibraryEntryIntoStudy(reopened, study, "form_vs");
      study = second.study;

      expect(study.forms[0].sections).toHaveLength(2);

      // Distinct identity between the two copies.
      const [copyA, copyB] = study.forms[0].sections;
      expect(copyA.id).not.toBe(copyB.id);
      expect(
        copyA.fields.some((f) => copyB.fields.some((g) => g.id === f.id))
      ).toBe(false);

      // Second insertion's variables were remapped around the first.
      expect(copyB.fields.map((f) => f.variableName)).not.toEqual(
        copyA.fields.map((f) => f.variableName)
      );

      // The shared codelist arrived once, not twice.
      expect(study.codelists.filter((c) => c.id === "cl_sex")).toHaveLength(1);

      // Customize exactly one copy.
      copyA.fields[0].label = "Customized height";

      expect(copyB.fields[0].label).not.toBe("Customized height");
      expect(reopened.section.fields[0].label).not.toBe("Customized height");
    });

    it("leaves already-inserted content untouched when the library entry is later edited", () => {
      const entry = capture();
      upsertLibraryEntry(entry, storage);

      const study = {
        ...buildStudy(),
        forms: [{ ...buildForm(), sections: [], rules: [] }],
        codelists: [],
      } as StudyProtocol;
      const inserted = insertLibraryEntryIntoStudy(entry, study, "form_vs");

      // Edit the library entry after the insertion.
      const updated = updateLibraryEntry(
        entry.id,
        {
          name: "Renamed block",
          section: {
            ...entry.section,
            title: "Renamed section",
            fields: [field({ id: "fld_new", variableName: "NEWVAR" })],
          },
        },
        storage
      );

      expect(updated.status).toBe("updated");
      if (updated.status === "updated") {
        expect(updated.entry.version).toBe(2);
      }

      // The inserted copy still reflects version 1.
      const insertedSection = inserted.study.forms[0].sections[0];
      expect(insertedSection.title).toBe("Anthropometrics");
      expect(insertedSection.fields).toHaveLength(4);
      expect(inserted.instantiated.source.entryVersion).toBe(1);
    });

    it("reports a missing entry on update rather than creating one", () => {
      expect(updateLibraryEntry("nope", { name: "x" }, storage).status).toBe(
        "missing"
      );
    });

    it("refuses to insert into a form that is not part of the study", () => {
      const entry = capture();
      expect(() =>
        insertLibraryEntryIntoStudy(entry, buildStudy(), "form_missing")
      ).toThrow(/not part of study/);
    });

    it("does not mutate the study passed in", () => {
      const entry = capture();
      const study = buildStudy();
      const sectionCountBefore = study.forms[0].sections.length;

      insertLibraryEntryIntoStudy(entry, study, "form_vs");

      expect(study.forms[0].sections).toHaveLength(sectionCountBefore);
    });
  });
});
