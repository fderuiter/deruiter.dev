import { describe, it, expect } from "vitest";
import {
  analyzeScenarioImpact,
  assessScenarioFreshness,
  collectScenarioDependencies,
  exportUniversalCrfJson,
  fingerprintScenarioDependencies,
  getScenarioStanding,
  loadStudyDraft,
  parseUniversalCrf,
  rerunScenarios,
  runFormTest,
  runScenario,
  runScenarioWithDependencies,
  saveScenarioFromReport,
  saveStudyDraft,
  snapshotExpectationsFromReport,
  upsertScenario,
  SCENARIO_DEPENDENCY_VERSION,
} from "@/lib/crf";
import type { StudyProtocol } from "@/lib/crf";
/**
 * #679 — explain which saved tests an amendment affects.
 *
 * Each demonstration builds a study with two saved, freshly-run scenarios
 * that depend on disjoint parts of the form, applies one amendment, and
 * checks that only the dependent scenario goes stale, with a reason naming
 * the changed object.
 */

import {
  NOW,
  SCOPE,
  amend,
  bmiScenario,
  buildStudy,
  fieldOf,
  ranStudy,
} from "./scenario-impact-fixtures";

function assess(study: StudyProtocol, scenarioId: string) {
  const scenario = (study.testScenarios || []).find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`fixture scenario ${scenarioId} missing`);
  return assessScenarioFreshness(scenario, study);
}

describe("[#679] Saved test impact of amendments", () => {
  describe("Baseline", () => {
    it("records per-dependency fingerprints and reads as current after a run", () => {
      const study = ranStudy();
      const bmi = study.testScenarios?.find((s) => s.id === "scn_bmi");
      expect(bmi?.lastRun?.dependencies?.version).toBe(
        SCENARIO_DEPENDENCY_VERSION
      );
      expect(assess(study, "scn_bmi")).toMatchObject({
        freshness: "current",
        standing: "passing",
        reasons: [],
        label: "Current: passing",
      });
      expect(assess(study, "scn_preg").standing).toBe("passing");
    });

    it("connects calculation, condition, codelist and visit dependencies", () => {
      const study = ranStudy();
      const keys = (id: string) =>
        collectScenarioDependencies(
          study.testScenarios!.find((s) => s.id === id)!,
          study
        ).map((ref) => ref.key);

      expect(keys("scn_bmi")).toEqual(
        expect.arrayContaining([
          "field:bmi",
          "field:height",
          "field:weight",
          "visit:v_screen",
        ])
      );
      expect(keys("scn_bmi")).not.toContain("rule:rule_hide_preg");
      expect(keys("scn_bmi")).not.toContain("codelist:CL_SEX");

      expect(keys("scn_preg")).toEqual(
        expect.arrayContaining([
          "field:pregtest",
          "field:sex",
          "rule:rule_hide_preg",
          "codelist:CL_SEX",
          "visit:v_screen",
        ])
      );
      expect(keys("scn_preg")).not.toContain("field:bmi");
    });

    it("is order-independent: re-serializing the study changes nothing", () => {
      const study = ranStudy();
      const scenario = study.testScenarios![0];
      const reordered = amend(study, (draft) => {
        draft.codelists[0].options.reverse();
        draft.forms[0].sections[0].fields.reverse();
      });
      expect(fingerprintScenarioDependencies(scenario, reordered)).toEqual(
        fingerprintScenarioDependencies(scenario, study)
      );
    });
  });

  describe("Demonstration: formula change", () => {
    it("marks only the calculation scenario stale, naming the formula", () => {
      const study = amend(ranStudy(), (draft) => {
        fieldOf(draft, "bmi").calculationFormula =
          "round(WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100)))";
      });

      const bmi = assess(study, "scn_bmi");
      expect(bmi.freshness).toBe("stale");
      expect(bmi.standing).toBe("stale");
      expect(bmi.reasons).toHaveLength(1);
      expect(bmi.reasons[0]).toMatchObject({
        dependency: { kind: "field", id: "bmi" },
        change: "changed",
        aspects: ["formula"],
        navigation: { mode: "designer", formId: "form_vs", fieldId: "bmi" },
      });
      expect(bmi.reasons[0].message).toBe(
        "The calculation formula of field BMI changed."
      );
      expect(bmi.label).toBe(
        "Stale: The calculation formula of field BMI changed"
      );

      expect(assess(study, "scn_preg").freshness).toBe("current");
    });

    it("follows a formula input: changing an input's unit stales the calculation", () => {
      const study = amend(ranStudy(), (draft) => {
        fieldOf(draft, "weight").unit = "lb";
      });
      const bmi = assess(study, "scn_bmi");
      expect(bmi.freshness).toBe("stale");
      expect(bmi.reasons[0]).toMatchObject({
        dependency: { kind: "field", id: "weight" },
        aspects: ["type"],
      });
    });
  });

  describe("Demonstration: rule change", () => {
    it("marks only the rule's scenario stale, naming the rule", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.forms[0].rules[0].conditions[0].value = "MALE";
      });

      const preg = assess(study, "scn_preg");
      expect(preg.freshness).toBe("stale");
      expect(preg.reasons).toHaveLength(1);
      expect(preg.reasons[0]).toMatchObject({
        dependency: { kind: "rule", id: "rule_hide_preg" },
        change: "changed",
        aspects: ["logic"],
        objectLabel: "Hide pregnancy test for male subjects",
        navigation: { mode: "rules", formId: "form_vs" },
      });
      expect(assess(study, "scn_bmi").freshness).toBe("current");
    });

    it("reports a newly added rule aimed at an asserted field", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.forms[0].rules.push({
          id: "rule_show_preg",
          name: "Show pregnancy test for female subjects",
          description: "",
          triggerFieldIds: ["sex"],
          actionType: "show_field",
          targetFieldId: "pregtest",
          conditions: [{ fieldId: "sex", operator: "eq", value: "F" }],
          logicalOperator: "AND",
        });
      });
      const preg = assess(study, "scn_preg");
      expect(preg.freshness).toBe("stale");
      expect(preg.reasons[0]).toMatchObject({
        dependency: { kind: "rule", id: "rule_show_preg" },
        change: "added",
      });
      expect(preg.reasons[0].message).toBe(
        "The rule Show pregnancy test for female subjects now affects this test."
      );
    });
  });

  describe("Demonstration: codelist change", () => {
    it("stales a scenario whose rule reads a coded field when the codes change", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.codelists[0].options[0].code = "1";
        draft.codelists[0].options[1].code = "2";
      });

      const preg = assess(study, "scn_preg");
      expect(preg.freshness).toBe("stale");
      expect(preg.reasons).toHaveLength(1);
      expect(preg.reasons[0]).toMatchObject({
        dependency: { kind: "codelist", id: "CL_SEX" },
        aspects: ["codes"],
        objectLabel: "Sex",
        // Codelists are edited from a field that uses them.
        navigation: { mode: "designer", formId: "form_vs", fieldId: "sex" },
      });
      expect(assess(study, "scn_bmi").freshness).toBe("current");
    });

    it("red-green: the form-level check alone misses the codelist change", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.codelists[0].options[0].code = "1";
      });
      const scenario = study.testScenarios!.find((s) => s.id === "scn_preg")!;
      // Pre-#679 behaviour: whole-form fingerprint does not see codelists.
      expect(getScenarioStanding(scenario, study.forms[0])).toBe("passing");
      // Post-#679: the dependency-aware assessment does.
      expect(assessScenarioFreshness(scenario, study).standing).toBe("stale");
    });
  });

  describe("Demonstration: visit change", () => {
    it("stales scenarios recorded at a visit whose window changes", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.visits[0].windowAfter = 7;
      });
      for (const id of ["scn_bmi", "scn_preg"]) {
        const result = assess(study, id);
        expect(result.freshness).toBe("stale");
        expect(result.reasons[0]).toMatchObject({
          dependency: { kind: "visit", id: "v_screen" },
          aspects: ["timing"],
          navigation: { mode: "matrix", visitId: "v_screen" },
        });
      }
    });

    it("stales scenarios when the visit stops collecting the form", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.visits[0].assignedFormIds = [];
      });
      expect(assess(study, "scn_bmi").reasons[0].aspects).toEqual([
        "assignment",
      ]);
    });

    it("ignores an unrelated visit", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.visits[1].targetDay = 35;
        draft.visits[1].assignedFormIds = ["form_vs"];
      });
      expect(assess(study, "scn_bmi").freshness).toBe("current");
      expect(assess(study, "scn_preg").freshness).toBe("current");
    });
  });

  describe("Demonstration: nonsemantic edit", () => {
    it("label, name and decode edits do not invalidate computational evidence", () => {
      const study = amend(ranStudy(), (draft) => {
        fieldOf(draft, "bmi").label = "Body mass index (kg/m²)";
        fieldOf(draft, "sex").description = "As reported by the subject";
        fieldOf(draft, "height").placeholder = "cm";
        fieldOf(draft, "height").columnSpan = 12;
        draft.forms[0].rules[0].name = "Pregnancy test hidden for males";
        draft.forms[0].rules[0].queryMessage = "Reworded";
        draft.codelists[0].options[0].label = "Male (assigned at birth)";
        draft.codelists[0].name = "Sex at birth";
        draft.visits[0].name = "Screening visit";
        draft.forms[0].name = "Vital signs";
      });
      const report = analyzeScenarioImpact(study);
      expect(report.counts).toEqual({
        current: 2,
        stale: 0,
        unknown: 0,
        never_run: 0,
      });
      expect(report.affected).toEqual([]);
      expect(report.changedObjects).toEqual([]);
    });
  });

  describe("Aspects a scenario cannot observe", () => {
    it("requiredness and range limits of a formula input do not stale a calculation", () => {
      const study = amend(ranStudy(), (draft) => {
        fieldOf(draft, "weight").required = true;
        fieldOf(draft, "weight").minValue = 30;
        fieldOf(draft, "height").maxValue = 250;
      });
      expect(assess(study, "scn_bmi").freshness).toBe("current");
    });

    it("requiredness does stale a scenario that asserts it", () => {
      let study = upsertScenario(buildStudy(), {
        ...bmiScenario(),
        id: "scn_req",
        name: "Weight is optional",
        expectations: [
          { kind: "field_required", fieldId: "weight", expected: false },
        ],
      });
      study = rerunScenarios(study, ["scn_req"], NOW).study;
      expect(assess(study, "scn_req").standing).toBe("passing");

      const amended = amend(study, (draft) => {
        fieldOf(draft, "weight").required = true;
      });
      const result = assess(amended, "scn_req");
      expect(result.freshness).toBe("stale");
      expect(result.reasons[0].aspects).toEqual(["requirement"]);
    });
  });

  describe("Impact list and selected rerun", () => {
    it("indexes changed objects to the scenarios they affect", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.visits[0].targetDay = 1;
        fieldOf(draft, "bmi").calculationFormula = "WEIGHT";
      });
      const report = analyzeScenarioImpact(study);
      expect(report.counts.stale).toBe(2);

      const visit = report.changedObjects.find(
        (o) => o.dependency.key === "visit:v_screen"
      );
      expect(visit?.affectedScenarioIds.sort()).toEqual([
        "scn_bmi",
        "scn_preg",
      ]);
      const formula = report.changedObjects.find(
        (o) => o.dependency.key === "field:bmi"
      );
      expect(formula?.affectedScenarioIds).toEqual(["scn_bmi"]);
      expect(formula?.navigation).toEqual({
        mode: "designer",
        formId: "form_vs",
        fieldId: "bmi",
      });
    });

    it("reruns only the selected affected tests", () => {
      const amended = amend(ranStudy(), (draft) => {
        draft.visits[0].windowBefore = 1;
      });
      const later = new Date("2026-10-02T09:00:00.000Z");
      const { study, summaries, skipped } = rerunScenarios(
        amended,
        ["scn_bmi"],
        later
      );

      expect(skipped).toEqual([]);
      expect(summaries).toEqual([
        {
          scenarioId: "scn_bmi",
          name: "BMI derives from height and weight",
          standing: "passing",
          passed: 1,
          failed: 0,
        },
      ]);
      expect(assess(study, "scn_bmi").freshness).toBe("current");
      expect(assess(study, "scn_bmi").lastRanAt).toBe(later.toISOString());
      // Not selected: still stale, never promoted to current.
      expect(assess(study, "scn_preg").freshness).toBe("stale");
    });

    it("a rerun that now fails reports failing, not the old pass", () => {
      const amended = amend(ranStudy(), (draft) => {
        fieldOf(draft, "bmi").calculationFormula = "WEIGHT";
      });
      const { study, summaries } = rerunScenarios(amended, ["scn_bmi"], NOW);
      expect(summaries[0].standing).toBe("failing");
      expect(assess(study, "scn_bmi").label).toBe("Current: failing");
    });

    it("skips scenarios whose form was removed and reports them stale", () => {
      const amended = amend(ranStudy(), (draft) => {
        draft.forms = [];
      });
      const result = assess(amended, "scn_bmi");
      expect(result.freshness).toBe("stale");
      expect(result.rerunnable).toBe(false);
      expect(result.reasons[0].change).toBe("removed");

      const { skipped, summaries } = rerunScenarios(
        amended,
        ["scn_bmi", "missing"],
        NOW
      );
      expect(summaries).toEqual([]);
      expect(skipped.map((s) => s.scenarioId)).toEqual(["scn_bmi", "missing"]);
    });

    it("reports a removed input field as removed", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.forms[0].sections[0].fields =
          draft.forms[0].sections[0].fields.filter((f) => f.id !== "height");
      });
      const bmi = assess(study, "scn_bmi");
      expect(bmi.reasons).toEqual([
        expect.objectContaining({
          dependency: expect.objectContaining({ key: "field:height" }),
          change: "removed",
          message: "The field height was removed.",
        }),
      ]);
    });
  });

  describe("Backward compatibility with already-saved evidence", () => {
    function legacyStudy(): StudyProtocol {
      // Evidence produced by the #677 API, which has no dependency snapshot.
      const study = upsertScenario(buildStudy(), bmiScenario());
      const { scenario } = runScenario(bmiScenario(), study.forms[0], NOW);
      return upsertScenario(study, scenario);
    }

    it("reads legacy evidence as unknown, never as a current pass", () => {
      const result = assess(legacyStudy(), "scn_bmi");
      expect(result.freshness).toBe("unknown");
      expect(result.standing).toBe("unknown");
      expect(result.label).toMatch(/^Unverified/);
    });

    it("reads legacy evidence as stale when its form fingerprint differs", () => {
      const study = amend(legacyStudy(), (draft) => {
        fieldOf(draft, "bmi").calculationFormula = "WEIGHT";
      });
      const result = assess(study, "scn_bmi");
      expect(result.freshness).toBe("stale");
      expect(result.reasons[0].dependency.kind).toBe("form");
    });

    it("treats an unrecognised snapshot version as unverifiable", () => {
      const study = amend(ranStudy(), (draft) => {
        draft.testScenarios![0].lastRun!.dependencies!.version = 999;
      });
      expect(assess(study, draft0Id(study)).freshness).toBe("unknown");
    });

    it("loads legacy evidence from the localStorage draft", () => {
      const store = new Map<string, string>();
      const storage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      };
      expect(saveStudyDraft(legacyStudy(), storage).status).toBe("saved");
      const loaded = loadStudyDraft(storage);
      expect(loaded.status).toBe("recovered");
      if (loaded.status !== "recovered") return;
      const reopened = loaded.study;
      expect(assess(reopened, "scn_bmi").freshness).toBe("unknown");
    });

    it("keeps dependency snapshots through native export and reopen", () => {
      const reopened = parseUniversalCrf(exportUniversalCrfJson(ranStudy()));
      const scenario = reopened.testScenarios?.find((s) => s.id === "scn_bmi");
      expect(scenario?.lastRun?.dependencies?.version).toBe(
        SCENARIO_DEPENDENCY_VERSION
      );
      expect(assess(reopened as StudyProtocol, "scn_bmi").freshness).toBe(
        "current"
      );
    });
  });

  describe("Saving a test run as a scenario", () => {
    it("pins the observed outcomes and is immediately current", () => {
      const study = buildStudy();
      const form = study.forms[0];
      const inputs = { height: 180, weight: 81, sex: "F" };
      const values = Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [`TEST-001_v_screen_${k}`, v])
      );
      const report = runFormTest(form, values, SCOPE);
      const expectations = snapshotExpectationsFromReport(report, form);
      expect(expectations).toEqual(
        expect.arrayContaining([
          {
            kind: "calculation",
            fieldId: "bmi",
            expectedStatus: "success",
            expectedValue: 25,
          },
          { kind: "rule_result", ruleId: "rule_hide_preg", expected: "false" },
          { kind: "field_visible", fieldId: "pregtest", expected: true },
        ])
      );

      const saved = saveScenarioFromReport(study, {
        name: "Female baseline",
        form,
        report,
        inputs,
        scope: SCOPE,
        now: NOW,
      });
      expect(saved.study.testScenarios).toHaveLength(1);
      expect(assess(saved.study, saved.scenario.id).standing).toBe("passing");
    });

    it("refuses to run a scenario against a missing form", () => {
      expect(() =>
        runScenarioWithDependencies(bmiScenario(), {
          ...buildStudy(),
          forms: [],
        })
      ).toThrow(/not part of study/);
    });
  });
});

function draft0Id(study: StudyProtocol): string {
  return study.testScenarios![0].id;
}
