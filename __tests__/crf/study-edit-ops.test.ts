// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  type CRFField,
  type CRFForm,
  type StudyProtocol,
  type TestScenario,
  getOncologyPresetSync,
} from "@/lib/crf";
import {
  assignFormToVisit,
  createNextVisit,
  createSection,
  injectForm,
  loadInitialStudy,
  loadRecoveredDraftSavedAt,
  resolveInsertionTarget,
  scenarioStaleness,
  unassignFormFromVisit,
  withUniqueVariableNames,
} from "@/components/crf/study-edit-ops";

const freshness = vi.hoisted(() => ({
  assess: vi.fn(),
}));
const draft = vi.hoisted(() => ({ load: vi.fn() }));
const storage = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/crf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crf")>();
  return {
    ...actual,
    assessScenarioFreshness: freshness.assess,
    loadStudyDraft: draft.load,
  };
});

vi.mock("@/lib/safe-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safe-storage")>();
  return { ...actual, safeGetRawItem: storage.get };
});

function field(
  id: string,
  variableName: string,
  extra: Partial<CRFField> = {}
) {
  return fromPartial<CRFField>({ id, variableName, label: id, ...extra });
}

function form(sections: { id: string; fields: CRFField[] }[]): CRFForm {
  return fromPartial<CRFForm>({
    id: "form_a",
    sections: sections.map((s) => ({ ...s, title: s.id })),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("resolveInsertionTarget", () => {
  const twoSections = form([
    { id: "s1", fields: [field("a", "A"), field("b", "B")] },
    { id: "s2", fields: [field("c", "C")] },
  ]);

  it("keeps an explicit section and index", () => {
    expect(
      resolveInsertionTarget(twoSections, "a", { sectionId: "s2", index: 0 })
    ).toEqual({ sectionId: "s2", index: 0 });
  });

  it("lands right after the selected field", () => {
    expect(resolveInsertionTarget(twoSections, "c")).toEqual({
      sectionId: "s2",
      index: 1,
    });
  });

  it("keeps an explicit index when only the section comes from the selection", () => {
    expect(resolveInsertionTarget(twoSections, "a", { index: 0 })).toEqual({
      sectionId: "s1",
      index: 0,
    });
  });

  it("falls back to the first section when nothing is selected or the selection is gone", () => {
    expect(resolveInsertionTarget(twoSections, null)).toEqual({
      sectionId: "s1",
      index: undefined,
    });
    expect(resolveInsertionTarget(twoSections, "missing")).toEqual({
      sectionId: "s1",
      index: undefined,
    });
  });

  it("returns no section for a form without sections", () => {
    expect(resolveInsertionTarget(form([]), null)).toEqual({
      sectionId: undefined,
      index: undefined,
    });
  });
});

describe("withUniqueVariableNames", () => {
  const existing = form([
    {
      id: "s1",
      fields: [
        field("a", "AGE"),
        field("t", "TABLE", {
          repeatingColumns: [field("tc", "DOSE")],
        }),
      ],
    },
  ]);

  it("leaves a new variable name alone", () => {
    const result = withUniqueVariableNames(existing, field("n", "SEX"));
    expect(result.variableName).toBe("SEX");
    expect(result).not.toHaveProperty("repeatingColumns");
  });

  it("renames a field whose name is taken, ignoring case", () => {
    const result = withUniqueVariableNames(existing, field("n", "age"));
    expect(result.variableName).not.toBe("age");
    expect(result.variableName.toUpperCase()).not.toBe("AGE");
  });

  it("renames clashing repeating columns and gives them fresh ids", () => {
    const result = withUniqueVariableNames(
      existing,
      field("n", "NEWTABLE", {
        repeatingColumns: [field("c1", "DOSE"), field("c2", "UNIT")],
      })
    );
    const [dose, unit] = result.repeatingColumns!;
    expect(dose.variableName).not.toBe("DOSE");
    expect(dose.id).not.toBe("c1");
    expect(unit.variableName).toBe("UNIT");
    expect(unit.id).not.toBe("c2");
  });

  it("keeps an empty repeating-column list as it is", () => {
    const result = withUniqueVariableNames(
      existing,
      field("n", "EMPTY", { repeatingColumns: [] })
    );
    expect(result.repeatingColumns).toEqual([]);
  });
});

describe("visit edits", () => {
  const study = getOncologyPresetSync();

  it("assigns a form to one visit only once", () => {
    const once = assignFormToVisit(study, "v_c2d1", "form_recist_onc");
    expect(
      once.visits.find((v) => v.id === "v_c2d1")?.assignedFormIds
    ).toContain("form_recist_onc");
    expect(once.visits.find((v) => v.id === "v_eos")).toBe(
      study.visits.find((v) => v.id === "v_eos")
    );

    const twice = assignFormToVisit(once, "v_c2d1", "form_recist_onc");
    expect(twice.visits.find((v) => v.id === "v_c2d1")).toBe(
      once.visits.find((v) => v.id === "v_c2d1")
    );
  });

  it("unassigns a form from one visit", () => {
    const result = unassignFormFromVisit(study, "v_screen", "form_dm_onc");
    expect(
      result.visits.find((v) => v.id === "v_screen")?.assignedFormIds
    ).not.toContain("form_dm_onc");
    expect(result.visits.find((v) => v.id === "v_c1d1")).toBe(
      study.visits.find((v) => v.id === "v_c1d1")
    );
  });

  it("schedules the next visit 28 days on with every non-log form", () => {
    const visit = createNextVisit(study, 42);
    expect(visit).toMatchObject({
      id: "v_visit_42",
      oid: "SE.VISIT_7",
      name: "Visit 7 (Day 168)",
      targetDay: 168,
    });
    expect(visit.assignedFormIds).not.toContain("form_ae_onc");
    expect(visit.assignedFormIds).toContain("form_dm_onc");
  });
});

describe("injectForm", () => {
  const study = getOncologyPresetSync();
  const newForm = fromPartial<CRFForm>({ id: "form_new", sections: [] });

  it("adds the form and its codelists to one visit", () => {
    const result = injectForm(study, newForm, "v_screen", [
      fromPartial({ id: "CL_NEW" }),
    ]);
    expect(result.forms.at(-1)).toBe(newForm);
    expect(
      result.visits.find((v) => v.id === "v_screen")?.assignedFormIds
    ).toContain("form_new");
    expect(result.visits.find((v) => v.id === "v_c1d1")).toBe(
      study.visits.find((v) => v.id === "v_c1d1")
    );
    expect(result.codelists.at(-1)?.id).toBe("CL_NEW");
  });

  it("leaves visits and codelists untouched when none are given", () => {
    const result = injectForm(study, newForm, undefined, []);
    expect(result.visits).toBe(study.visits);
    expect(result.codelists).toBe(study.codelists);
  });
});

describe("createSection", () => {
  it("numbers the section after the form's existing ones", () => {
    const sections = createSection(
      form([
        { id: "s1", fields: [] },
        { id: "s2", fields: [] },
      ]),
      7
    );
    expect(sections).toEqual({ id: "sec_7", title: "Section 3", fields: [] });
  });
});

describe("scenarioStaleness", () => {
  const scenario = fromPartial<TestScenario>({ id: "t1" });
  const study = fromPartial<StudyProtocol>({});

  it("defers to the package's own check for a never-run test", () => {
    freshness.assess.mockReturnValue({ freshness: "never_run" });
    expect(scenarioStaleness(scenario, study)).toBeUndefined();
  });

  it("marks a current test fresh", () => {
    freshness.assess.mockReturnValue({ freshness: "current" });
    expect(scenarioStaleness(scenario, study)).toEqual({ stale: false });
  });

  it("explains a stale test with its first reason, else its label", () => {
    freshness.assess.mockReturnValue({
      freshness: "stale",
      label: "Stale",
      reasons: [{ message: "Field AGE changed" }],
    });
    expect(scenarioStaleness(scenario, study)).toEqual({
      stale: true,
      reason: "Field AGE changed",
    });

    freshness.assess.mockReturnValue({
      freshness: "stale",
      label: "Stale",
      reasons: [],
    });
    expect(scenarioStaleness(scenario, study)).toEqual({
      stale: true,
      reason: "Stale",
    });
  });
});

describe("startup study", () => {
  it("uses the preset and no recovery time on the server", () => {
    expect(loadRecoveredDraftSavedAt()).toBeNull();
    expect(loadInitialStudy().studyName).toBe(
      getOncologyPresetSync().studyName
    );
    expect(draft.load).not.toHaveBeenCalled();
  });

  describe("in a browser", () => {
    it("reopens a recovered draft", () => {
      vi.stubGlobal("window", {});
      const recovered = fromPartial<StudyProtocol>({ studyName: "Mine" });
      draft.load.mockReturnValue({
        status: "recovered",
        study: recovered,
        savedAt: "2026-10-20T07:00:00Z",
      });
      expect(loadInitialStudy()).toBe(recovered);
      expect(loadRecoveredDraftSavedAt()).toBe("2026-10-20T07:00:00Z");
    });

    it("applies cached default branding to the preset", () => {
      vi.stubGlobal("window", {});
      draft.load.mockReturnValue({ status: "empty" });
      storage.get.mockReturnValue(JSON.stringify({ sponsorName: "Acme" }));
      expect(loadInitialStudy().branding).toEqual({ sponsorName: "Acme" });
      expect(loadRecoveredDraftSavedAt()).toBeNull();
    });

    it("ignores unreadable cached branding", () => {
      vi.stubGlobal("window", {});
      draft.load.mockReturnValue({ status: "empty" });
      storage.get.mockReturnValue("{not json");
      expect(loadInitialStudy().branding).toEqual(
        getOncologyPresetSync().branding
      );
    });

    it("uses the plain preset when nothing is cached", () => {
      vi.stubGlobal("window", {});
      draft.load.mockReturnValue({ status: "empty" });
      storage.get.mockReturnValue(null);
      expect(loadInitialStudy().studyName).toBe(
        getOncologyPresetSync().studyName
      );
    });
  });
});
