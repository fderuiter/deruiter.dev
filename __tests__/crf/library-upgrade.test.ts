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
  type CRFSection,
  type CRFForm,
  type CodelistDefinition,
  type EditCheckRule,
  type PersonalLibraryEntry,
  type StudyProtocol,
} from "@/lib/crf";
import {
  applyLibraryUpgrade,
  detectLibraryUpgrades,
  insertLibraryEntryWithLineage,
  previewLibraryUpgrade,
  type LibraryUpgradePreview,
} from "@/lib/crf/library-upgrade";

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
    edit: (section: CRFSection) => void,
    changes: Partial<Pick<PersonalLibraryEntry, "rules" | "codelists">> = {}
  ) {
    const section = structuredClone(entry.section!);
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
      expect(getLibraryEntryRevision(stored, 1)?.section?.title).toBe(
        "Anthropometrics"
      );
      expect(getLibraryEntryRevision(stored, 2)?.section?.title).toBe(
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
            const nextSection = structuredClone(entry.section!);
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
              const original = entry.section!.fields[index].label;
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
