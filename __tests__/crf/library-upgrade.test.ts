// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  captureLibraryEntry,
  updateLibraryEntry,
  upsertLibraryEntry,
  listLibraryEntries,
  getLibraryEntryRevision,
  validateUniversalCrf,
  type CRFField,
  type CRFForm,
  type CodelistDefinition,
  type EditCheckRule,
  type PersonalLibraryEntry,
  type StudyProtocol,
  applyLibraryUpgrade,
  detectLibraryUpgrades,
  insertLibraryEntryWithLineage,
  previewLibraryUpgrade,
  type LibraryUpgradePreview,
} from "@/lib/crf";

/**
 * #681 — preview and apply a personal-library upgrade.
 *
 * Three versions are compared: the library version the study used (source),
 * the study's copy (current) and the newest library version (incoming).
 * All data is synthetic.
 */

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

const UNIT_CODELIST: CodelistDefinition = {
  id: "cl_unit",
  name: "Weight unit",
  options: [
    { code: "KG", label: "kg", order: 1 },
    { code: "LB", label: "lb", order: 2 },
  ],
};

function sourceStudy(): StudyProtocol {
  const rule: EditCheckRule = {
    id: "rule_wt",
    name: "Weight plausible",
    description: "",
    triggerFieldIds: ["fld_weight"],
    actionType: "raise_query",
    targetFieldId: "fld_weight",
    conditions: [{ fieldId: "fld_weight", operator: "gt", value: 300 }],
    logicalOperator: "AND",
    queryMessage: "Weight above 300",
  };
  const form: CRFForm = {
    id: "form_lib",
    name: "Library source",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec_anthro",
        title: "Anthropometrics",
        fields: [
          field({ id: "fld_height", variableName: "HEIGHT", label: "Height" }),
          field({ id: "fld_weight", variableName: "WEIGHT", label: "Weight" }),
          field({
            id: "fld_unit",
            variableName: "WTUNIT",
            label: "Unit",
            codelistId: "cl_unit",
          }),
        ],
      },
    ],
    rules: [rule],
  };
  return {
    id: "study_lib",
    protocolNumber: "LIB-001",
    studyName: "Library authoring study",
    phase: "Phase II",
    sponsor: "Synthetic Sponsor",
    therapeuticArea: "General Medicine",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [form],
    visits: [],
    codelists: [UNIT_CODELIST],
  } as StudyProtocol;
}

/** A target study that already has a HEIGHT variable, forcing a rename. */
function targetStudy(): StudyProtocol {
  return {
    id: "study_target",
    protocolNumber: "TGT-001",
    studyName: "Target study",
    phase: "Phase III",
    sponsor: "Synthetic Sponsor",
    therapeuticArea: "General Medicine",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [
      {
        id: "form_vs",
        name: "Vital signs",
        domain: "VS",
        description: "",
        version: "1.0",
        sections: [
          {
            id: "sec_existing",
            title: "Existing",
            fields: [
              field({ id: "fld_existing_height", variableName: "HEIGHT" }),
            ],
          },
        ],
        rules: [],
      },
      {
        id: "form_other",
        name: "Other form",
        domain: "XX",
        description: "",
        version: "1.0",
        sections: [{ id: "sec_o", title: "Other", fields: [] }],
        rules: [],
      },
    ],
    visits: [],
    codelists: [],
  } as StudyProtocol;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as object)) deepFreeze(child);
  }
  return value;
}

function blockSection(study: StudyProtocol, sectionId: string) {
  for (const form of study.forms) {
    const section = form.sections.find((s) => s.id === sectionId);
    if (section) return section;
  }
  throw new Error(`missing section ${sectionId}`);
}

function byVar(study: StudyProtocol, sectionId: string, variable: string) {
  return blockSection(study, sectionId).fields.find(
    (f) => f.variableName === variable
  );
}

describe("[#681] Personal-library three-way upgrade", () => {
  let storage: MockStorage;
  let entry: PersonalLibraryEntry;

  beforeEach(() => {
    storage = new MockStorage();
    const src = sourceStudy();
    entry = captureLibraryEntry({
      study: src,
      form: src.forms[0],
      sectionId: "sec_anthro",
      name: "Anthropometrics",
      now: new Date("2026-02-01T00:00:00.000Z"),
    });
    upsertLibraryEntry(entry, storage);
  });

  function insert() {
    return insertLibraryEntryWithLineage(
      entry,
      targetStudy(),
      "form_vs",
      new Date("2026-02-02T00:00:00.000Z")
    );
  }

  function publish(
    edit: (section: PersonalLibraryEntry["section"]) => void,
    changes: Partial<Pick<PersonalLibraryEntry, "rules" | "codelists">> = {}
  ) {
    const section = structuredClone(entry.section);
    edit(section);
    const result = updateLibraryEntry(
      entry.id,
      { section, ...changes },
      storage
    );
    if (result.status !== "updated") throw new Error("update failed");
    return listLibraryEntries(storage);
  }

  function ready(
    study: StudyProtocol,
    useId: string,
    entries: PersonalLibraryEntry[]
  ) {
    const result = previewLibraryUpgrade(study, useId, entries);
    if (result.status !== "ready")
      throw new Error(`not ready: ${result.status}`);
    return result.preview;
  }

  describe("library revisions", () => {
    it("keeps the outgoing version's content on every update", () => {
      const entries = publish((s) => {
        s.title = "Body measurements";
      });
      const stored = entries[0];
      expect(stored.version).toBe(2);
      expect(getLibraryEntryRevision(stored, 1)?.section.title).toBe(
        "Anthropometrics"
      );
      expect(getLibraryEntryRevision(stored, 2)?.section.title).toBe(
        "Body measurements"
      );
      expect(getLibraryEntryRevision(stored, 7)).toBeUndefined();
    });

    it("reads entries saved before revisions existed", () => {
      const legacy = { ...entry };
      delete legacy.revisions;
      upsertLibraryEntry(legacy, storage);
      expect(listLibraryEntries(storage)[0].revisions).toBeUndefined();
      expect(getLibraryEntryRevision(legacy, 1)?.version).toBe(1);
    });
  });

  describe("lineage and detection", () => {
    it("records which entry, version and identities a block came from", () => {
      const { study, use } = insert();
      expect(use.entryVersion).toBe(1);
      expect(study.libraryUses).toEqual([use]);
      expect(use.idMap.fld_height).toBeDefined();
      // HEIGHT collided at insertion, so the study holds a remapped name.
      expect(use.variableMap.HEIGHT).not.toBe("HEIGHT");
    });

    it("reports an available update without changing the study", () => {
      const { study, use } = insert();
      const before = JSON.stringify(study);
      const entries = publish((s) => {
        s.fields[1].label = "Body weight";
      });
      // Updating the library is not a background update of the study.
      expect(JSON.stringify(study)).toBe(before);

      const frozen = deepFreeze(study);
      const [availability] = detectLibraryUpgrades(frozen, entries);
      expect(availability.use.id).toBe(use.id);
      expect(availability.status).toBe("available");
      expect(availability.latestVersion).toBe(2);
      expect(previewLibraryUpgrade(frozen, use.id, entries).status).toBe(
        "ready"
      );
      expect(JSON.stringify(study)).toBe(before);
    });

    it("is up to date when the library has not moved", () => {
      const { study, use } = insert();
      expect(detectLibraryUpgrades(study, [entry])[0].status).toBe(
        "up_to_date"
      );
      expect(previewLibraryUpgrade(study, use.id, [entry]).status).toBe(
        "up_to_date"
      );
    });

    it("refuses to guess when the used version was not kept", () => {
      const { study, use } = insert();
      const bumped = { ...entry, version: 3, revisions: undefined };
      expect(previewLibraryUpgrade(study, use.id, [bumped]).status).toBe(
        "source_unavailable"
      );
    });

    it("reports a missing entry, a missing use and a missing section", () => {
      const { study, use } = insert();
      expect(previewLibraryUpgrade(study, use.id, []).status).toBe(
        "entry_missing"
      );
      expect(previewLibraryUpgrade(study, "nope", [entry]).status).toBe(
        "use_missing"
      );
      const entries = publish((s) => {
        s.title = "x";
      });
      const withoutSection = {
        ...study,
        forms: study.forms.map((f) => ({
          ...f,
          sections: f.sections.filter((s) => s.id !== use.sectionId),
        })),
      };
      expect(
        previewLibraryUpgrade(withoutSection, use.id, entries).status
      ).toBe("target_missing");
    });
  });

  describe("merged values are checked before they enter the study (#3676)", () => {
    function upgradeWith(
      edit: (section: PersonalLibraryEntry["section"]) => void,
      changes: Partial<Pick<PersonalLibraryEntry, "rules" | "codelists">> = {}
    ) {
      const inserted = insert();
      const entries = publish(edit, changes);
      const preview = ready(inserted.study, inserted.use.id, entries);
      return applyLibraryUpgrade(
        inserted.study,
        preview,
        entries,
        {},
        new Date("2026-03-01T00:00:00.000Z")
      );
    }

    it("applies a rule the editor can leave unnamed and without triggers", () => {
      // The rule editor lets an author clear a rule's name, and a new rule
      // starts with no trigger fields when its form has none. Those are
      // authoring gaps for the editor's checks to flag, not a corrupt
      // library value, so the upgrade carries them through.
      const result = upgradeWith(() => {}, {
        rules: [{ ...entry.rules[0], name: "", triggerFieldIds: [] }],
      });
      expect(result.status).toBe("applied");
    });

    it("applies values outside the CRF conformance limits", () => {
      const result = upgradeWith(
        (s) => {
          s.fields[1].label = "";
          s.fields[1].variableName = "WEIGHTKGS1";
          s.fields[1].columnSpan = 13;
        },
        {
          codelists: [
            {
              ...UNIT_CODELIST,
              options: [{ code: "", label: "kg", order: 1 }],
            },
          ],
        }
      );
      expect(result.status).toBe("applied");
    });

    it("refuses a merged field that is not a CRF field", () => {
      const result = upgradeWith((s) => {
        s.fields[1].dataType = "not_a_type" as CRFField["dataType"];
      });
      expect(result).toEqual({
        status: "unavailable",
        message: expect.stringMatching(
          /^The merged library field "fld_weight" is not a valid CRF field \(dataType: /
        ),
      });
    });

    it("refuses a merged field that lost a property the study type requires", () => {
      const result = upgradeWith((s) => {
        delete (s.fields[1] as Partial<CRFField>).columnSpan;
      });
      expect(result).toEqual({
        status: "unavailable",
        message: expect.stringContaining("(columnSpan missing)"),
      });
    });

    it("refuses a merged rule that is not an edit check", () => {
      const result = upgradeWith(() => {}, {
        rules: [
          {
            ...entry.rules[0],
            actionType: "explode" as EditCheckRule["actionType"],
          },
        ],
      });
      expect(result).toEqual({
        status: "unavailable",
        message: expect.stringMatching(
          /^The merged library rule "rule_wt" is not a valid CRF rule \(actionType: /
        ),
      });
    });

    it("refuses a merged codelist whose option code is not text", () => {
      const result = upgradeWith(() => {}, {
        codelists: [
          {
            ...UNIT_CODELIST,
            options: [{ code: 7 as unknown as string, label: "kg", order: 1 }],
          },
        ],
      });
      expect(result).toEqual({
        status: "unavailable",
        message: expect.stringMatching(
          /^The merged library codelist "cl_unit" is not a valid CRF codelist \(options\.0\.code: /
        ),
      });
    });

    it("refuses merged section properties without a title", () => {
      const result = upgradeWith((s) => {
        delete (s as Partial<typeof s>).title;
      });
      expect(result).toEqual({
        status: "unavailable",
        message: expect.stringContaining("is not a valid CRF section (title: "),
      });
    });
  });

  describe("nonconflicting upgrade", () => {
    it("takes library changes, keeps customizations and applies in one result", () => {
      const inserted = insert();
      const heightVar = inserted.use.variableMap.HEIGHT;
      // Local customization: the author relabels Height.
      const study: StudyProtocol = structuredClone(inserted.study);
      byVar(study, inserted.use.sectionId, heightVar)!.label =
        "Standing height";

      const entries = publish(
        (s) => {
          s.fields[1].label = "Body weight";
          s.fields.splice(
            2,
            0,
            field({ id: "fld_bmi", variableName: "BMI", label: "BMI" })
          );
        },
        {
          rules: [{ ...entry.rules[0], queryMessage: "Weight above 300 kg" }],
        }
      );

      const preview = ready(study, inserted.use.id, entries);
      expect(preview.fromVersion).toBe(1);
      expect(preview.toVersion).toBe(2);
      expect(preview.conflicts).toEqual([]);
      const kinds = Object.fromEntries(
        preview.changes.map((c) => [c.id, c.kind])
      );
      expect(kinds["field:fld_weight:label"]).toBe("incoming");
      expect(kinds["field:fld_height:label"]).toBe("local");
      expect(kinds["field:fld_bmi"]).toBe("incoming");
      expect(kinds["rule:rule_wt:queryMessage"]).toBe("incoming");
      // The insertion-time rename is lineage, not a customization.
      expect(kinds["field:fld_height:variableName"]).toBeUndefined();

      const snapshot = JSON.stringify(study);
      const result = applyLibraryUpgrade(
        study,
        preview,
        entries,
        {},
        new Date("2026-03-01T00:00:00.000Z")
      );
      expect(result.status).toBe("applied");
      if (result.status !== "applied") return;
      expect(JSON.stringify(study)).toBe(snapshot); // input untouched: undo is the old value

      const upgraded = result.study;
      const sectionId = inserted.use.sectionId;
      expect(byVar(upgraded, sectionId, heightVar)?.label).toBe(
        "Standing height"
      );
      expect(byVar(upgraded, sectionId, "WEIGHT")?.label).toBe("Body weight");
      expect(
        blockSection(upgraded, sectionId).fields.map((f) => f.variableName)
      ).toEqual([heightVar, "WEIGHT", "BMI", "WTUNIT"]);

      // Study identities are kept for existing elements.
      const weight = byVar(upgraded, sectionId, "WEIGHT")!;
      expect(weight.id).toBe(inserted.use.idMap.fld_weight);
      const rule = upgraded.forms[0].rules.find(
        (r) => r.id === inserted.use.idMap.rule_wt
      )!;
      expect(rule.queryMessage).toBe("Weight above 300 kg");
      expect(rule.targetFieldId).toBe(weight.id);
      expect(rule.conditions[0].fieldId).toBe(weight.id);

      // Provenance.
      expect(result.use.entryVersion).toBe(2);
      expect(result.use.insertedAt).toBe(inserted.use.insertedAt);
      expect(result.use.upgradeHistory).toEqual([result.record]);
      expect(result.record).toMatchObject({
        fromVersion: 1,
        toVersion: 2,
        appliedAt: "2026-03-01T00:00:00.000Z",
        previousIdMap: inserted.use.idMap,
        conflictCount: 0,
        localCustomizationCount: 1,
      });

      // Nothing left to upgrade, and the next version compares against v2.
      expect(detectLibraryUpgrades(upgraded, entries)[0].status).toBe(
        "up_to_date"
      );
      const again = previewLibraryUpgrade(upgraded, inserted.use.id, entries);
      expect(again.status).toBe("up_to_date");
    });

    it("survives native export and reopen with lineage intact", () => {
      const { study, use } = insert();
      const reopened = validateUniversalCrf(JSON.parse(JSON.stringify(study)));
      expect(reopened.success).toBe(true);
      expect(reopened.study?.libraryUses).toEqual([use]);
    });
  });

  describe("conflicting customization", () => {
    function conflicted() {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      byVar(study, inserted.use.sectionId, "WEIGHT")!.label = "Weight (local)";
      const entries = publish((s) => {
        s.fields[1].label = "Weight (library)";
      });
      return {
        inserted,
        study,
        entries,
        preview: ready(study, inserted.use.id, entries),
      };
    }

    it("detects a property both sides changed differently", () => {
      const { preview } = conflicted();
      expect(preview.conflicts.map((c) => c.id)).toEqual([
        "field:fld_weight:label",
      ]);
      expect(preview.conflicts[0]).toMatchObject({
        source: "Weight",
        current: "Weight (local)",
        incoming: "Weight (library)",
      });
    });

    it("refuses to apply until every conflict has an explicit resolution", () => {
      const { study, entries, preview } = conflicted();
      expect(applyLibraryUpgrade(study, preview, entries, {})).toEqual({
        status: "unresolved",
        unresolvedChangeIds: ["field:fld_weight:label"],
      });
    });

    it.each([
      ["current", "Weight (local)"],
      ["incoming", "Weight (library)"],
    ] as const)("resolution %s yields %s", (choice, label) => {
      const { inserted, study, entries, preview } = conflicted();
      const result = applyLibraryUpgrade(study, preview, entries, {
        "field:fld_weight:label": choice,
      });
      expect(result.status).toBe("applied");
      if (result.status !== "applied") return;
      expect(byVar(result.study, inserted.use.sectionId, "WEIGHT")?.label).toBe(
        label
      );
      expect(result.record.resolutions).toEqual({
        "field:fld_weight:label": choice,
      });
    });

    it("treats a library removal of a customized field as a conflict", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      byVar(study, inserted.use.sectionId, "WEIGHT")!.required = true;
      const entries = publish(
        (s) => {
          s.fields.splice(1, 1);
        },
        { rules: [] }
      );
      const preview = ready(study, inserted.use.id, entries);
      const fieldConflict = preview.conflicts.find(
        (c) => c.id === "field:fld_weight"
      );
      expect(fieldConflict?.action).toBe("remove");

      const keep = applyLibraryUpgrade(
        study,
        preview,
        entries,
        Object.fromEntries(preview.conflicts.map((c) => [c.id, "current"]))
      );
      expect(keep.status).toBe("applied");
      if (keep.status === "applied") {
        expect(
          byVar(keep.study, inserted.use.sectionId, "WEIGHT")
        ).toBeDefined();
      }
      const take = applyLibraryUpgrade(
        study,
        preview,
        entries,
        Object.fromEntries(preview.conflicts.map((c) => [c.id, "incoming"]))
      );
      expect(take.status).toBe("applied");
      if (take.status === "applied") {
        expect(
          byVar(take.study, inserted.use.sectionId, "WEIGHT")
        ).toBeUndefined();
      }
    });

    it("keeps a field the author removed when the library left it alone", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      const section = blockSection(study, inserted.use.sectionId);
      section.fields = section.fields.filter(
        (f) => f.variableName !== "WTUNIT"
      );
      const entries = publish((s) => {
        s.title = "Body measurements";
      });
      const preview = ready(study, inserted.use.id, entries);
      expect(preview.changes.find((c) => c.id === "field:fld_unit")?.kind).toBe(
        "local"
      );
      const result = applyLibraryUpgrade(study, preview, entries, {});
      if (result.status !== "applied") throw new Error(result.status);
      const upgraded = blockSection(result.study, inserted.use.sectionId);
      expect(upgraded.title).toBe("Body measurements");
      expect(upgraded.fields.some((f) => f.variableName === "WTUNIT")).toBe(
        false
      );
    });
  });

  describe("affected references and safety", () => {
    it("lists references outside the block that a change reaches", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      const weightId = inserted.use.idMap.fld_weight;
      study.forms[1].rules.push({
        id: "rule_external",
        name: "External weight check",
        description: "",
        triggerFieldIds: [weightId],
        actionType: "raise_query",
        targetFieldId: weightId,
        conditions: [{ fieldId: weightId, operator: "lt", value: 1 }],
        logicalOperator: "AND",
      } as EditCheckRule);
      study.forms[1].sections[0].fields.push(
        field({
          id: "fld_other_unit",
          variableName: "OTUNIT",
          codelistId: "cl_unit",
        })
      );

      const entries = publish(
        (s) => {
          s.fields[1].dataType = "number";
        },
        {
          codelists: [
            {
              ...UNIT_CODELIST,
              options: [
                ...UNIT_CODELIST.options,
                { code: "G", label: "g", order: 3 },
              ],
            },
          ],
        }
      );
      const preview = ready(study, inserted.use.id, entries);
      expect(preview.affectedReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            changeId: "field:fld_weight:dataType",
            kind: "rule",
            elementId: "rule_external",
            formName: "Other form",
          }),
          expect.objectContaining({
            changeId: "codelist:cl_unit:options",
            kind: "codelist_use",
            elementId: "fld_other_unit",
          }),
        ])
      );
      // Rules inside the block are merged, not reported as external.
      expect(
        preview.affectedReferences.some(
          (r) => r.elementId === inserted.use.idMap.rule_wt
        )
      ).toBe(false);
    });

    it("refuses a stale preview after the study changed", () => {
      const inserted = insert();
      const entries = publish((s) => {
        s.fields[0].label = "Height (cm)";
      });
      const preview = ready(inserted.study, inserted.use.id, entries);
      const edited: StudyProtocol = structuredClone(inserted.study);
      byVar(edited, inserted.use.sectionId, "WEIGHT")!.label = "Edited later";
      expect(applyLibraryUpgrade(edited, preview, entries, {}).status).toBe(
        "stale"
      );
    });

    it("refuses a preview whose library moved on", () => {
      const inserted = insert();
      const entries = publish((s) => {
        s.fields[0].label = "Height (cm)";
      });
      const preview = ready(inserted.study, inserted.use.id, entries);
      const later = publish((s) => {
        s.fields[0].label = "Height (in)";
      });
      expect(
        applyLibraryUpgrade(inserted.study, preview, later, {}).status
      ).toBe("stale");
    });

    it("preserves local fields and rules the library never owned", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      blockSection(study, inserted.use.sectionId).fields.push(
        field({ id: "fld_local", variableName: "LOCALX" })
      );
      const entries = publish((s) => {
        s.fields[0].label = "Height (cm)";
      });
      const preview = ready(study, inserted.use.id, entries);
      expect(preview.changes.every((c) => c.elementId !== "fld_local")).toBe(
        true
      );
      const result = applyLibraryUpgrade(study, preview, entries, {});
      if (result.status !== "applied") throw new Error(result.status);
      expect(
        byVar(result.study, inserted.use.sectionId, "LOCALX")
      ).toBeDefined();
    });
  });

  // #3485: branches the cases above leave untaken.
  describe("less common upgrades (#3485)", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    const kinds = (preview: LibraryUpgradePreview) =>
      Object.fromEntries(preview.changes.map((c) => [c.id, c.kind]));

    it("calls a change both sides made alike converged, and applies it", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      byVar(study, inserted.use.sectionId, "WEIGHT")!.label = "Body weight";
      const entries = publish((s) => {
        s.fields[1].label = "Body weight";
      });
      const preview = ready(study, inserted.use.id, entries);
      expect(kinds(preview)["field:fld_weight:label"]).toBe("converged");
      expect(preview.counts.converged).toBe(1);
      const change = preview.changes.find(
        (c) => c.id === "field:fld_weight:label"
      )!;
      expect(change.summary).toBe(
        "The study and the library made the same change to label of Body weight (WEIGHT)."
      );
      const result = applyLibraryUpgrade(study, preview, entries, {}, at);
      expect(result.status).toBe("applied");
    });

    it("takes a library removal of an untouched field and drops its codelist", () => {
      const inserted = insert();
      const entries = publish(
        (s) => {
          s.fields.splice(2, 1);
        },
        { codelists: [] }
      );
      const preview = ready(inserted.study, inserted.use.id, entries);
      expect(kinds(preview)["field:fld_unit"]).toBe("incoming");
      expect(
        preview.changes.find((c) => c.id === "field:fld_unit")!.summary
      ).toBe("The library removes Unit (WTUNIT).");
      expect(kinds(preview)["codelist:cl_unit"]).toBe("incoming");
      const result = applyLibraryUpgrade(
        inserted.study,
        preview,
        entries,
        {},
        at
      );
      if (result.status !== "applied") throw new Error(result.status);
      expect(
        byVar(result.study, inserted.use.sectionId, "WTUNIT")
      ).toBeUndefined();
      // Nothing refers to the codelist any more, so it goes too.
      expect(result.study.codelists.map((c) => c.id)).not.toContain("cl_unit");
    });

    it("records a field removed on both sides as converged", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      const section = blockSection(study, inserted.use.sectionId);
      section.fields = section.fields.filter(
        (f) => f.id !== inserted.use.idMap.fld_unit
      );
      const entries = publish((s) => {
        s.fields.splice(2, 1);
      });
      const preview = ready(study, inserted.use.id, entries);
      expect(kinds(preview)["field:fld_unit"]).toBe("converged");
      expect(
        preview.changes.find((c) => c.id === "field:fld_unit")!.summary
      ).toBe("Unit (WTUNIT) was removed in both the study and the library.");
    });

    it("adds a calculated field, a repeating table and a grouped rule from the library", () => {
      const inserted = insert();
      const heightVar = inserted.use.variableMap.HEIGHT;
      const entries = publish(
        (s) => {
          s.fields.push(
            field({
              id: "fld_bmi",
              variableName: "BMI",
              label: "BMI",
              dataType: "calculated" as CRFField["dataType"],
              calculationFormula: "WEIGHT / ((HEIGHT/100) * (HEIGHT/100))",
            }),
            field({
              id: "fld_table",
              variableName: "READS",
              label: "Repeat readings",
              dataType: "repeating_table" as CRFField["dataType"],
              repeatingColumns: [
                field({ id: "fld_read_time", variableName: "RDTIM" }),
              ],
            })
          );
        },
        {
          rules: [
            ...entry.rules,
            {
              id: "rule_grouped",
              name: "Grouped check",
              description: "",
              triggerFieldIds: ["fld_height", "fld_weight"],
              actionType: "raise_query",
              targetFieldId: "fld_weight",
              conditions: [
                {
                  fieldId: "fld_weight",
                  operator: "gt",
                  value: 0,
                  compareFieldId: "fld_height",
                },
              ],
              conditionGroups: [
                {
                  id: "grp",
                  logicalOperator: "OR",
                  conditions: [
                    {
                      fieldId: "fld_height",
                      operator: "lt",
                      value: 50,
                      compareFieldId: "fld_weight",
                    },
                  ],
                },
              ],
              logicalOperator: "AND",
            },
          ],
        }
      );
      const preview = ready(inserted.study, inserted.use.id, entries);
      expect(kinds(preview)).toMatchObject({
        "field:fld_bmi": "incoming",
        "field:fld_table": "incoming",
        "rule:rule_grouped": "incoming",
      });
      const result = applyLibraryUpgrade(
        inserted.study,
        preview,
        entries,
        {},
        at
      );
      if (result.status !== "applied")
        throw new Error(
          `${result.status}: ${"message" in result ? result.message : ""}`
        );
      const sectionId = inserted.use.sectionId;
      const bmi = byVar(result.study, sectionId, "BMI")!;
      // The formula follows the study's rename of HEIGHT.
      expect(bmi.calculationFormula).toBe(
        `WEIGHT / ((${heightVar}/100) * (${heightVar}/100))`
      );
      const table = byVar(result.study, sectionId, "READS")!;
      expect(table.repeatingColumns?.map((c) => c.variableName)).toEqual([
        "RDTIM",
      ]);
      expect(table.repeatingColumns?.[0].id).not.toBe("fld_read_time");
      const grouped = result.study.forms[0].rules.find(
        (r) => r.id === result.use.idMap.rule_grouped
      )!;
      const heightId = result.use.idMap.fld_height;
      const weightId = result.use.idMap.fld_weight;
      expect(grouped.triggerFieldIds).toEqual([heightId, weightId]);
      expect(grouped.conditions[0].compareFieldId).toBe(heightId);
      expect(grouped.conditionGroups?.[0].conditions[0]).toMatchObject({
        fieldId: heightId,
        compareFieldId: weightId,
      });
    });

    it("calls a field removed on one side and changed on the other a conflict", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      const section = blockSection(study, inserted.use.sectionId);
      section.fields = section.fields.filter(
        (f) => f.id !== inserted.use.idMap.fld_unit
      );
      const entries = publish((s) => {
        s.fields[2].label = "Weight unit";
      });
      const preview = ready(study, inserted.use.id, entries);
      const change = preview.changes.find((c) => c.id === "field:fld_unit")!;
      expect(change).toMatchObject({ kind: "conflict", action: "remove" });
      expect(change.summary).toBe(
        "Weight unit (WTUNIT) was removed on one side and changed on the other."
      );
      // Taking the library's side brings the field back.
      const result = applyLibraryUpgrade(
        study,
        preview,
        entries,
        { "field:fld_unit": "incoming" },
        at
      );
      if (result.status !== "applied") throw new Error(result.status);
      expect(byVar(result.study, inserted.use.sectionId, "WTUNIT")?.label).toBe(
        "Weight unit"
      );
    });

    it("adds a new library codelist and keeps a removed one the study still uses", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      // A field outside the block still uses the unit codelist.
      study.forms[1].sections[0].fields.push(
        field({
          id: "fld_other_unit",
          variableName: "OTUNIT",
          codelistId: "cl_unit",
        })
      );
      const route: CodelistDefinition = {
        id: "cl_route",
        name: "Route",
        options: [{ code: "PO", label: "Oral", order: 1 }],
      };
      const entries = publish(
        (s) => {
          s.fields[2].codelistId = "cl_route";
        },
        { codelists: [route] }
      );
      const preview = ready(study, inserted.use.id, entries);
      expect(
        preview.changes.find((c) => c.id === "codelist:cl_route")
      ).toMatchObject({
        kind: "incoming",
        action: "add",
        label: "Route",
      });
      const result = applyLibraryUpgrade(study, preview, entries, {}, at);
      if (result.status !== "applied")
        throw new Error(
          `${result.status}: ${"message" in result ? result.message : ""}`
        );
      const ids = result.study.codelists.map((c) => c.id);
      expect(ids).toContain("cl_route");
      expect(ids).toContain("cl_unit");
    });

    it("upgrades a block that holds a repeating table and a grouped rule", () => {
      const src = sourceStudy();
      src.forms[0].sections[0].fields.push(
        field({
          id: "fld_table",
          variableName: "READS",
          label: "Readings",
          dataType: "repeating_table" as CRFField["dataType"],
          repeatingColumns: [
            field({
              id: "fld_read_time",
              variableName: "RDTIM",
              label: "Time",
            }),
          ],
        })
      );
      src.forms[0].rules.push({
        id: "rule_grouped",
        name: "Grouped check",
        description: "",
        triggerFieldIds: ["fld_height"],
        actionType: "raise_query",
        targetFieldId: "fld_weight",
        conditions: [
          {
            fieldId: "fld_weight",
            operator: "gt",
            value: 0,
            compareFieldId: "fld_height",
          },
        ],
        conditionGroups: [
          {
            id: "grp",
            logicalOperator: "OR",
            conditions: [
              {
                fieldId: "fld_height",
                operator: "lt",
                value: 50,
                compareFieldId: "fld_weight",
              },
            ],
          },
        ],
        logicalOperator: "AND",
      } as EditCheckRule);
      const rich = captureLibraryEntry({
        study: src,
        form: src.forms[0],
        sectionId: "sec_anthro",
        name: "Anthropometrics with readings",
        now: new Date("2026-02-01T00:00:00.000Z"),
      });
      upsertLibraryEntry(rich, storage);
      const inserted = insertLibraryEntryWithLineage(
        rich,
        targetStudy(),
        "form_vs",
        new Date("2026-02-02T00:00:00.000Z")
      );
      const section = structuredClone(rich.section);
      section.fields[0].label = "Standing height";
      const updated = updateLibraryEntry(rich.id, { section }, storage);
      if (updated.status !== "updated") throw new Error("update failed");
      const entries = listLibraryEntries(storage);
      const preview = ready(inserted.study, inserted.use.id, entries);
      // Renamed at insertion, the column and rule are not customizations.
      expect(preview.changes.map((c) => `${c.id} ${c.kind}`)).toEqual([
        "field:fld_height:label incoming",
      ]);
      const result = applyLibraryUpgrade(
        inserted.study,
        preview,
        entries,
        {},
        at
      );
      if (result.status !== "applied") throw new Error(result.status);
      const grouped = result.study.forms[0].rules.find(
        (r) => r.id === result.use.idMap.rule_grouped
      )!;
      expect(grouped.conditionGroups?.[0].conditions[0].compareFieldId).toBe(
        result.use.idMap.fld_weight
      );
    });

    it("upgrades into a sparse study whose forms carry no rules or sections", () => {
      const target = targetStudy();
      const sparse = fromAny<StudyProtocol, unknown>({
        ...target,
        forms: [
          { ...target.forms[0], rules: undefined },
          { ...target.forms[1], sections: undefined, rules: undefined },
        ],
        codelists: undefined,
      });
      const inserted = insertLibraryEntryWithLineage(
        entry,
        sparse,
        "form_vs",
        new Date("2026-02-02T00:00:00.000Z")
      );
      const entries = publish((s) => {
        s.fields[0].label = "Standing height";
      });
      const preview = ready(inserted.study, inserted.use.id, entries);
      const result = applyLibraryUpgrade(
        inserted.study,
        preview,
        entries,
        {},
        at
      );
      expect(result.status).toBe("applied");
    });

    it("refuses to apply once the use or its entry is gone", () => {
      const inserted = insert();
      const entries = publish((s) => {
        s.fields[0].label = "Standing height";
      });
      const preview = ready(inserted.study, inserted.use.id, entries);
      expect(
        applyLibraryUpgrade(
          { ...inserted.study, libraryUses: undefined },
          preview,
          entries,
          {},
          at
        )
      ).toEqual({
        status: "unavailable",
        message: "This library block is no longer recorded in the study.",
      });
      const gone = applyLibraryUpgrade(inserted.study, preview, [], {}, at);
      expect(gone.status).toBe("unavailable");
      expect("message" in gone ? gone.message : "").toMatch(
        /no longer in your personal library/
      );
    });

    it("labels an unnamed library rule and codelist by their ids in the preview", () => {
      const inserted = insert();
      const entries = publish(() => {}, {
        rules: [{ ...entry.rules[0], name: "", queryMessage: "Too heavy" }],
        codelists: [
          { ...UNIT_CODELIST, name: "", options: [UNIT_CODELIST.options[0]] },
        ],
      });
      const preview = ready(inserted.study, inserted.use.id, entries);
      const byId = new Map(preview.changes.map((c) => [c.id, c]));
      expect(byId.get("rule:rule_wt:name")?.label).toBe("rule_wt");
      expect(byId.get("codelist:cl_unit:options")?.label).toBe("cl_unit");
    });

    it("finds an outside rule that reads a changed field through a condition group", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      const weightId = inserted.use.idMap.fld_weight;
      study.forms[1].rules.push(
        fromAny<EditCheckRule, unknown>({
          id: "rule_grouped_external",
          name: "",
          description: "",
          triggerFieldIds: undefined,
          actionType: "raise_query",
          targetFieldId: "fld_none",
          conditions: [],
          conditionGroups: [
            {
              id: "g",
              logicalOperator: "AND",
              conditions: [{ fieldId: weightId, operator: "gt", value: 1 }],
            },
          ],
          logicalOperator: "AND",
        })
      );
      const entries = publish((s) => {
        s.fields[1].unit = "kg";
      });
      const preview = ready(study, inserted.use.id, entries);
      expect(preview.affectedReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "rule",
            elementId: "rule_grouped_external",
            label: "rule_grouped_external",
          }),
        ])
      );
    });

    it("keeps a local rule in the block's form and maps a customized formula back", () => {
      const inserted = insert();
      const heightVar = inserted.use.variableMap.HEIGHT;
      const study: StudyProtocol = structuredClone(inserted.study);
      study.forms[0].rules.push({
        id: "rule_local",
        name: "Local check",
        description: "",
        triggerFieldIds: [],
        actionType: "raise_query",
        targetFieldId: inserted.use.idMap.fld_weight,
        conditions: [],
        logicalOperator: "AND",
      } as EditCheckRule);
      // The author gives Weight a formula naming the study's renamed HEIGHT.
      byVar(study, inserted.use.sectionId, "WEIGHT")!.calculationFormula =
        `${heightVar} * 0`;
      const entries = publish((s) => {
        s.fields[0].label = "Standing height";
      });
      const preview = ready(study, inserted.use.id, entries);
      const formula = preview.changes.find(
        (c) => c.id === "field:fld_weight:calculationFormula"
      )!;
      // Compared in the library's names, the customization reads HEIGHT.
      expect(formula.kind).toBe("local");
      expect(formula.current).toContain("HEIGHT * 0");
      const result = applyLibraryUpgrade(study, preview, entries, {}, at);
      if (result.status !== "applied") throw new Error(result.status);
      expect(result.study.forms[0].rules.map((r) => r.id)).toContain(
        "rule_local"
      );
    });

    it("renames a new library field whose variable the study already uses, and places it by its anchor", () => {
      const inserted = insert();
      const entries = publish((s) => {
        // Inserted after Height, and named like a variable outside the block.
        s.fields.splice(
          1,
          0,
          field({ id: "fld_existing", variableName: "HEIGHT", label: "Again" })
        );
      });
      const preview = ready(inserted.study, inserted.use.id, entries);
      const result = applyLibraryUpgrade(
        inserted.study,
        preview,
        entries,
        {},
        at
      );
      if (result.status !== "applied") throw new Error(result.status);
      const fields = blockSection(result.study, inserted.use.sectionId).fields;
      const added = fields.find((f) => f.label === "Again")!;
      expect(added.variableName).not.toBe("HEIGHT");
      expect(fields.indexOf(added)).toBe(1);
    });

    it("upgrades one block and leaves the study's other library uses alone", () => {
      const first = insert();
      const second = insertLibraryEntryWithLineage(
        entry,
        first.study,
        "form_other",
        new Date("2026-02-03T00:00:00.000Z")
      );
      const entries = publish((s) => {
        s.fields[0].label = "Standing height";
      });
      const preview = ready(second.study, first.use.id, entries);
      const result = applyLibraryUpgrade(
        second.study,
        preview,
        entries,
        {},
        at
      );
      if (result.status !== "applied") throw new Error(result.status);
      const uses = result.study.libraryUses ?? [];
      expect(uses.map((use) => [use.id, use.entryVersion])).toEqual([
        [first.use.id, 2],
        [second.use.id, 1],
      ]);
    });

    it("lists a calculation outside the block that reads a changed field", () => {
      const inserted = insert();
      const study: StudyProtocol = structuredClone(inserted.study);
      study.forms[1].sections[0].fields.push(
        field({
          id: "fld_dose",
          variableName: "DOSE",
          calculationFormula: "WEIGHT * 2",
        })
      );
      const entries = publish((s) => {
        s.fields[1].unit = "kg";
      });
      const preview = ready(study, inserted.use.id, entries);
      expect(preview.affectedReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            changeId: "field:fld_weight:unit",
            kind: "calculation",
            elementId: "fld_dose",
          }),
        ])
      );
    });
  });

  describe("property: merge picks the side that changed", () => {
    const labelEdit = fc.option(fc.string({ minLength: 1, maxLength: 6 }), {
      nil: undefined,
    });

    it("resolves every field label by the three-way rule", () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(labelEdit, labelEdit), {
            minLength: 3,
            maxLength: 3,
          }),
          fc.constantFrom("current" as const, "incoming" as const),
          (edits, choice) => {
            const local = new MockStorage();
            upsertLibraryEntry(entry, local);
            const inserted = insert();
            const study: StudyProtocol = structuredClone(inserted.study);
            const section = blockSection(study, inserted.use.sectionId);
            edits.forEach(([currentEdit], index) => {
              if (currentEdit !== undefined)
                section.fields[index].label = `c:${currentEdit}`;
            });
            const nextSection = structuredClone(entry.section);
            edits.forEach(([, incomingEdit], index) => {
              if (incomingEdit !== undefined)
                nextSection.fields[index].label = `i:${incomingEdit}`;
            });
            const anyIncoming = edits.some(([, i]) => i !== undefined);
            if (!anyIncoming) nextSection.description = "bump";
            updateLibraryEntry(entry.id, { section: nextSection }, local);
            const entries = listLibraryEntries(local);

            const result = previewLibraryUpgrade(
              study,
              inserted.use.id,
              entries
            );
            if (result.status !== "ready") return false;
            const preview: LibraryUpgradePreview = result.preview;
            const resolutions = Object.fromEntries(
              preview.conflicts.map((c) => [c.id, choice])
            );
            const applied = applyLibraryUpgrade(
              study,
              preview,
              entries,
              resolutions
            );
            if (applied.status !== "applied") return false;

            const merged = blockSection(
              applied.study,
              inserted.use.sectionId
            ).fields;
            return edits.every(([c, i], index) => {
              const original = entry.section.fields[index].label;
              const cur = c === undefined ? original : `c:${c}`;
              const inc = i === undefined ? original : `i:${i}`;
              let expected: string;
              if (cur === inc) expected = cur;
              else if (cur === original) expected = inc;
              else if (inc === original) expected = cur;
              else expected = choice === "current" ? cur : inc;
              return merged[index].label === expected;
            });
          }
        ),
        { numRuns: 60 }
      );
    });
  });
});
