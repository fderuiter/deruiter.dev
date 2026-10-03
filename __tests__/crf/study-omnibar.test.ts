import { describe, it, expect } from "vitest";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { StudyProtocol } from "@/lib/crf/types";
import { ALL_SLASH_COMMANDS } from "@/lib/crf/smart-blocks-engine";
import {
  buildStudyOmnibarIndex,
  getVisitNamesForForm,
  groupOmnibarResults,
  isUnsupportedDictionaryQuery,
  resolveOmnibarInsertionTarget,
  scoreOmnibarEntry,
  searchStudyOmnibar,
  verifyStarterInsertion,
  OMNIBAR_CATEGORY_ORDER,
} from "@/lib/crf/study-omnibar";

const study: StudyProtocol = ONCOLOGY_RECIST_PRESET;
const vsForm = study.forms.find((f) => f.id === "form_vs_onc")!;
const target = { formId: vsForm.id, sectionId: vsForm.sections[0].id };

describe("Study Omnibar search model (#544)", () => {
  it("indexes forms, fields and visits with the context that owns them", () => {
    const index = buildStudyOmnibarIndex(study);

    const weight = index.find((e) => e.id === "field:form_vs_onc:f_weight")!;
    expect(weight.category).toBe("field");
    expect(weight.detail).toBe("WEIGHT");
    expect(weight.context).toBe(
      `Vital Signs & Physical Metrics (VS) › ${vsForm.sections[0].title}`
    );
    expect(weight.action).toEqual({
      kind: "open_field",
      formId: "form_vs_onc",
      sectionId: vsForm.sections[0].id,
      fieldId: "f_weight",
    });

    const dm = index.find((e) => e.id === "form:form_dm_onc")!;
    expect(dm.context).toContain("Visits: Screening (Day -28 to -1)");

    const screening = index.find((e) => e.id === "visit:v_screen")!;
    expect(screening.context).toContain("Demographics & Informed Consent");
    expect(screening.action).toEqual({
      kind: "open_visit",
      visitId: "v_screen",
    });

    expect(index.filter((e) => e.category === "field")).toHaveLength(
      study.forms.reduce(
        (n, f) => n + f.sections.reduce((m, s) => m + s.fields.length, 0),
        0
      )
    );
  });

  it("names forms that no visit collects instead of inventing a schedule", () => {
    const ae = buildStudyOmnibarIndex(study).find(
      (e) => e.id === "form:form_ae_onc"
    )!;
    expect(ae.context).toContain("Not scheduled at any visit");
  });

  it("collects visits from default, alternate and per-arm form assignments", () => {
    const withArms: StudyProtocol = {
      ...study,
      visits: [
        { ...study.visits[0], assignedFormIds: [], formIds: ["form_ae_onc"] },
        {
          ...study.visits[1],
          assignedFormIds: [],
          armFormAssignments: { arm_a: ["form_ae_onc"] },
        },
        { ...study.visits[2], assignedFormIds: [] },
      ],
    };
    expect(getVisitNamesForForm(withArms, "form_ae_onc")).toEqual([
      study.visits[0].name,
      study.visits[1].name,
    ]);
  });

  it("offers insert actions only with a target form, naming where they land", () => {
    expect(
      buildStudyOmnibarIndex(study).some((e) => e.category === "insert")
    ).toBe(false);

    const inserts = buildStudyOmnibarIndex(study, {
      insertionTarget: target,
    }).filter((e) => e.category === "insert");
    expect(inserts.map((e) => e.id)).toContain("insert:vitals");
    const vitals = inserts.find((e) => e.id === "insert:vitals")!;
    expect(vitals.context).toBe(
      `Insert into Vital Signs & Physical Metrics (VS) › ${vsForm.sections[0].title}`
    );
    expect(vitals.action).toMatchObject({ kind: "insert", formId: vsForm.id });
  });

  it("verifies starter insertions by dry run without mutating the study", () => {
    const before = JSON.stringify(study);
    for (const command of ALL_SLASH_COMMANDS) {
      expect(verifyStarterInsertion(study, target, command)).toBe(true);
    }
    expect(JSON.stringify(study)).toBe(before);
  });

  it("does not offer insertion into a locked or missing form", () => {
    const locked: StudyProtocol = {
      ...study,
      forms: study.forms.map((f) =>
        f.id === vsForm.id ? { ...f, isLocked: true } : f
      ),
    };
    expect(
      buildStudyOmnibarIndex(locked, { insertionTarget: target }).some(
        (e) => e.category === "insert"
      )
    ).toBe(false);
    expect(
      verifyStarterInsertion(
        study,
        { formId: "missing" },
        ALL_SLASH_COMMANDS[0]
      )
    ).toBe(false);
  });

  it("ranks fuzzy matches by prefix, subsequence and small typos", () => {
    const index = buildStudyOmnibarIndex(study, { insertionTarget: target });

    expect(searchStudyOmnibar(index, "weight")[0].entry.id).toBe(
      "field:form_vs_onc:f_weight"
    );
    // Ordered subsequence of the variable name.
    expect(searchStudyOmnibar(index, "vsdt")[0].entry.id).toBe(
      "field:form_vs_onc:f_vsdat"
    );
    // One-letter typo.
    expect(
      searchStudyOmnibar(index, "demographcs").map((r) => r.entry.id)
    ).toContain("form:form_dm_onc");
    // Slash command syntax reaches the starter block.
    expect(searchStudyOmnibar(index, "/vitals")[0].entry.id).toBe(
      "insert:vitals"
    );
    // Every token must match.
    expect(searchStudyOmnibar(index, "weight zzzz")).toHaveLength(0);
  });

  it("scopes results to one category and groups them by best match", () => {
    const index = buildStudyOmnibarIndex(study, { insertionTarget: target });
    const visits = searchStudyOmnibar(index, "", "visit");
    expect(visits).toHaveLength(study.visits.length);
    expect(visits.every((r) => r.entry.category === "visit")).toBe(true);

    const groups = groupOmnibarResults(searchStudyOmnibar(index, "screening"));
    expect(groups[0].category).toBe("visit");
    expect(groups[0].label).toBe("Visits");

    const limited = groupOmnibarResults(searchStudyOmnibar(index, ""), 3);
    expect(limited.map((g) => g.category)).toEqual(
      OMNIBAR_CATEGORY_ORDER.filter((c) => index.some((e) => e.category === c))
    );
    const fields = limited.find((g) => g.category === "field")!;
    expect(fields.results).toHaveLength(3);
    expect(fields.hiddenCount).toBe(
      index.filter((e) => e.category === "field").length - 3
    );
  });

  it("exposes the export entry points and studio views as actions", () => {
    const index = buildStudyOmnibarIndex(study);
    expect(
      searchStudyOmnibar(index, "export").map((r) => r.entry.action)
    ).toEqual(
      expect.arrayContaining([
        { kind: "open_export_document" },
        { kind: "switch_mode", mode: "export" },
      ])
    );
    expect(searchStudyOmnibar(index, "matrix")[0].entry.action).toEqual({
      kind: "switch_mode",
      mode: "matrix",
    });
  });

  it("never advertises MedDRA or WHODrug lookup and flags such queries", () => {
    const index = buildStudyOmnibarIndex(study, { insertionTarget: target });
    const text = JSON.stringify(index).toLowerCase();
    expect(text).not.toContain("meddra");
    expect(text).not.toContain("whodrug");
    expect(searchStudyOmnibar(index, "meddra")).toHaveLength(0);
    expect(searchStudyOmnibar(index, "whodrug")).toHaveLength(0);

    expect(isUnsupportedDictionaryQuery("MedDRA")).toBe(true);
    expect(isUnsupportedDictionaryQuery("code with whodrug")).toBe(true);
    expect(isUnsupportedDictionaryQuery("medd")).toBe(true);
    expect(isUnsupportedDictionaryQuery("weight")).toBe(false);
    expect(isUnsupportedDictionaryQuery("")).toBe(false);
  });

  it("resolves the insertion target like the slash palette", () => {
    expect(resolveOmnibarInsertionTarget(study, "missing")).toBeUndefined();
    expect(resolveOmnibarInsertionTarget(study, vsForm.id)).toEqual({
      formId: vsForm.id,
      sectionId: vsForm.sections[0].id,
    });
    expect(resolveOmnibarInsertionTarget(study, vsForm.id, "f_weight")).toEqual(
      {
        formId: vsForm.id,
        sectionId: vsForm.sections[0].id,
        index:
          vsForm.sections[0].fields.findIndex((f) => f.id === "f_weight") + 1,
      }
    );
  });

  it("treats an empty query as matching everything", () => {
    const [entry] = buildStudyOmnibarIndex(study);
    expect(scoreOmnibarEntry("  ", entry)).toBeGreaterThan(0);
  });
});
