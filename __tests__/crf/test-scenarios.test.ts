import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  createScenario,
  updateScenario,
  resetScenarioEvidence,
  runScenario,
  runScenariosForForm,
  fingerprintForm,
  isEvidenceStale,
  getScenarioStanding,
  describeExpectationResult,
  projectScenarioInputs,
  listScenarios,
  getScenariosForForm,
  upsertScenario,
  removeScenario,
  DEFAULT_TEST_SCOPE,
  UniversalCrfProtocolSchema,
  exportUniversalCrfJson,
  parseUniversalCrf,
  type CRFField,
  type CRFForm,
  type EditCheckRule,
  type ScenarioExpectation,
  type StudyProtocol,
} from "@/lib/crf";

/**
 * #677 — named test scenarios and their run evidence.
 *
 * The distinction these tests exist to protect is definition versus evidence:
 * a scenario's assertions are durable, but a green result is only meaningful
 * against the form revision it was produced on. Stale evidence must read as
 * "nobody knows yet", never as a pass.
 */

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

const HIDE_PREG: EditCheckRule = {
  id: "rule_hide_preg",
  name: "Hide pregnancy test for male subjects",
  description: "",
  triggerFieldIds: ["sex"],
  actionType: "hide_field",
  targetFieldId: "pregtest",
  conditions: [{ fieldId: "sex", operator: "eq", value: "M" }],
  logicalOperator: "AND",
};

function buildForm(): CRFForm {
  return {
    id: "form_dm",
    name: "Demographics",
    domain: "DM",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec_1",
        title: "Subject",
        fields: [
          field({ id: "sex", variableName: "SEX", required: true }),
          field({ id: "pregtest", variableName: "PREGTEST" }),
          field({ id: "q1", variableName: "Q1", dataType: "number" }),
          field({ id: "q2", variableName: "Q2", dataType: "number" }),
          field({
            id: "total",
            variableName: "TOTAL",
            dataType: "calculated",
            calculationFormula: "Q1 + Q2",
          }),
        ],
      },
    ],
    rules: [HIDE_PREG],
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
    codelists: [],
  } as StudyProtocol;
}

const MALE_EXPECTATIONS: ScenarioExpectation[] = [
  { kind: "field_visible", fieldId: "pregtest", expected: false },
  { kind: "rule_result", ruleId: "rule_hide_preg", expected: "true" },
  {
    kind: "calculation",
    fieldId: "total",
    expectedStatus: "success",
    expectedValue: 7,
  },
];

function maleScenario() {
  return createScenario({
    name: "Male subject hides pregnancy test",
    formId: "form_dm",
    scope: DEFAULT_TEST_SCOPE,
    inputs: { sex: "M", q1: 3, q2: 4 },
    expectations: MALE_EXPECTATIONS,
  });
}

describe("[#677] Named test scenarios and run evidence", () => {
  describe("Definitions are separate from evidence", () => {
    it("starts with no evidence at all", () => {
      const scenario = maleScenario();
      expect(scenario.lastRun).toBeUndefined();
      expect(getScenarioStanding(scenario, buildForm())).toBe("never_run");
    });

    it("attaches evidence on a run without altering the definition", () => {
      const scenario = maleScenario();
      const { scenario: ran } = runScenario(scenario, buildForm());

      expect(ran.lastRun).toBeDefined();
      expect(ran.inputs).toEqual(scenario.inputs);
      expect(ran.expectations).toEqual(scenario.expectations);
      // The original object is untouched.
      expect(scenario.lastRun).toBeUndefined();
    });

    it("discards evidence when the assertions themselves change", () => {
      const { scenario: ran } = runScenario(maleScenario(), buildForm());
      expect(ran.lastRun).toBeDefined();

      const edited = updateScenario(ran, {
        expectations: [
          { kind: "field_visible", fieldId: "pregtest", expected: true },
        ],
      });
      // The old evidence answered a different question.
      expect(edited.lastRun).toBeUndefined();
    });

    it("keeps evidence through a rename, which changes no assertion", () => {
      const { scenario: ran } = runScenario(maleScenario(), buildForm());
      const renamed = updateScenario(ran, { name: "Renamed" });

      expect(renamed.lastRun).toBeDefined();
      expect(renamed.name).toBe("Renamed");
    });

    it("clears evidence on request without touching the definition", () => {
      const { scenario: ran } = runScenario(maleScenario(), buildForm());
      const reset = resetScenarioEvidence(ran);

      expect(reset.lastRun).toBeUndefined();
      expect(reset.expectations).toEqual(ran.expectations);
    });
  });

  describe("Expected versus actual, linked to fields and rules", () => {
    it("passes every expectation on a matching run", () => {
      const { scenario: ran } = runScenario(maleScenario(), buildForm());

      expect(ran.lastRun?.passed).toBe(3);
      expect(ran.lastRun?.failed).toBe(0);
      expect(getScenarioStanding(ran, buildForm())).toBe("passing");
    });

    it("reports a readable expected-versus-actual for a failure", () => {
      const scenario = createScenario({
        name: "Wrong expectation",
        formId: "form_dm",
        scope: DEFAULT_TEST_SCOPE,
        inputs: { sex: "F" },
        expectations: [
          { kind: "field_visible", fieldId: "pregtest", expected: false },
        ],
      });
      const { scenario: ran } = runScenario(scenario, buildForm());
      const result = ran.lastRun!.results[0];

      expect(result.satisfied).toBe(false);
      expect(result.expectedLabel).toBe("hidden");
      expect(result.actualLabel).toBe("visible");
      expect(describeExpectationResult(result)).toBe(
        "Field pregtest: expected hidden, got visible."
      );
    });

    it("links each result to the field or rule it concerns", () => {
      const { scenario: ran } = runScenario(maleScenario(), buildForm());
      const results = ran.lastRun!.results;

      expect(results[0]).toMatchObject({
        subjectId: "pregtest",
        subjectKind: "field",
      });
      expect(results[1]).toMatchObject({
        subjectId: "rule_hide_preg",
        subjectKind: "rule",
      });
    });

    it("checks a calculation's value as well as its status", () => {
      const scenario = createScenario({
        name: "Wrong total",
        formId: "form_dm",
        scope: DEFAULT_TEST_SCOPE,
        inputs: { q1: 3, q2: 4 },
        expectations: [
          {
            kind: "calculation",
            fieldId: "total",
            expectedStatus: "success",
            expectedValue: 99,
          },
        ],
      });
      const { scenario: ran } = runScenario(scenario, buildForm());

      expect(ran.lastRun?.failed).toBe(1);
      expect(ran.lastRun?.results[0].actualLabel).toBe("success with value 7");
    });

    it("asserts an undecidable rule as undecidable", () => {
      const scenario = createScenario({
        name: "Missing input",
        formId: "form_dm",
        scope: DEFAULT_TEST_SCOPE,
        inputs: {},
        expectations: [
          {
            kind: "rule_result",
            ruleId: "rule_hide_preg",
            expected: "missing",
          },
        ],
      });
      const { scenario: ran } = runScenario(scenario, buildForm());

      expect(ran.lastRun?.passed).toBe(1);
      expect(ran.lastRun?.results[0].actualLabel).toMatch(/cannot be decided/);
    });

    it("says so when an expectation names something that is not on the form", () => {
      const scenario = createScenario({
        name: "Dangling reference",
        formId: "form_dm",
        scope: DEFAULT_TEST_SCOPE,
        expectations: [
          { kind: "field_visible", fieldId: "ghost", expected: true },
          { kind: "rule_result", ruleId: "ghost_rule", expected: "true" },
        ],
      });
      const { scenario: ran } = runScenario(scenario, buildForm());

      expect(ran.lastRun?.failed).toBe(2);
      expect(ran.lastRun?.results[0].actualLabel).toBe(
        "not present on this form"
      );
      expect(ran.lastRun?.results[1].actualLabel).toBe("no rule with this id");
    });
  });

  describe("Evidence goes stale when the source revision differs", () => {
    it("is stale before it has ever run", () => {
      expect(isEvidenceStale(maleScenario(), buildForm())).toBe(true);
    });

    it("is current immediately after a run", () => {
      const form = buildForm();
      const { scenario: ran } = runScenario(maleScenario(), form);
      expect(isEvidenceStale(ran, form)).toBe(false);
    });

    it("goes stale when a rule the form carries is amended", () => {
      const form = buildForm();
      const { scenario: ran } = runScenario(maleScenario(), form);

      const amended: CRFForm = {
        ...form,
        rules: [
          {
            ...HIDE_PREG,
            conditions: [{ fieldId: "sex", operator: "eq", value: "F" }],
          },
        ],
      };

      expect(isEvidenceStale(ran, amended)).toBe(true);
      // Stale is distinct from failing: the old result is not reported as a pass.
      expect(getScenarioStanding(ran, amended)).toBe("stale");
      expect(ran.lastRun?.failed).toBe(0);
    });

    it("goes stale when a field's requiredness changes", () => {
      const form = buildForm();
      const { scenario: ran } = runScenario(maleScenario(), form);

      const amended: CRFForm = {
        ...form,
        sections: [
          {
            ...form.sections[0],
            fields: form.sections[0].fields.map((f) =>
              f.id === "pregtest" ? { ...f, required: true } : f
            ),
          },
        ],
      };

      expect(isEvidenceStale(ran, amended)).toBe(true);
    });

    it("does not go stale on a cosmetic edit that cannot change behaviour", () => {
      const form = buildForm();
      const { scenario: ran } = runScenario(maleScenario(), form);

      const relabelled: CRFForm = {
        ...form,
        name: "Renamed form",
        sections: [
          {
            ...form.sections[0],
            title: "Renamed section",
            fields: form.sections[0].fields.map((f) => ({
              ...f,
              label: `${f.label} (updated wording)`,
            })),
          },
        ],
      };

      expect(isEvidenceStale(ran, relabelled)).toBe(false);
    });

    it("fingerprints independently of key order", () => {
      const form = buildForm();
      const reordered: CRFForm = {
        ...form,
        sections: [
          {
            ...form.sections[0],
            fields: form.sections[0].fields.map((f) => {
              const copy = { ...f } as Record<string, unknown>;
              // Rebuild with reversed key order.
              return fromAny<CRFField, unknown>(
                Object.fromEntries(Object.entries(copy).reverse())
              );
            }),
          },
        ],
      };

      expect(fingerprintForm(reordered)).toBe(fingerprintForm(form));
    });
  });

  describe("Scenarios live on the study document", () => {
    it("adds, lists and filters scenarios by form", () => {
      let study = buildStudy();
      const a = maleScenario();
      const b = createScenario({
        name: "Other form",
        formId: "form_other",
        scope: DEFAULT_TEST_SCOPE,
      });

      study = upsertScenario(study, a);
      study = upsertScenario(study, b);

      expect(listScenarios(study)).toHaveLength(2);
      expect(getScenariosForForm(study, "form_dm").map((s) => s.id)).toEqual([
        a.id,
      ]);
    });

    it("replaces a scenario rather than duplicating it", () => {
      let study = buildStudy();
      const scenario = maleScenario();
      study = upsertScenario(study, scenario);
      study = upsertScenario(study, { ...scenario, name: "Renamed" });

      expect(listScenarios(study)).toHaveLength(1);
      expect(listScenarios(study)[0].name).toBe("Renamed");
    });

    it("removes a scenario without disturbing the others", () => {
      let study = buildStudy();
      const a = maleScenario();
      const b = createScenario({
        name: "Second",
        formId: "form_dm",
        scope: DEFAULT_TEST_SCOPE,
      });
      study = upsertScenario(upsertScenario(study, a), b);

      study = removeScenario(study, a.id);
      expect(listScenarios(study).map((s) => s.id)).toEqual([b.id]);
    });

    it("does not mutate the study it is given", () => {
      const study = buildStudy();
      upsertScenario(study, maleScenario());
      expect(study.testScenarios).toBeUndefined();
    });

    it("runs every scenario on a form in one action", () => {
      let study = buildStudy();
      study = upsertScenario(study, maleScenario());
      study = upsertScenario(
        study,
        createScenario({
          name: "Female subject shows pregnancy test",
          formId: "form_dm",
          scope: DEFAULT_TEST_SCOPE,
          inputs: { sex: "F" },
          expectations: [
            { kind: "field_visible", fieldId: "pregtest", expected: true },
          ],
        })
      );

      const { study: after, summaries } = runScenariosForForm(study, "form_dm");

      expect(summaries).toHaveLength(2);
      expect(summaries.every((s) => s.standing === "passing")).toBe(true);
      expect(listScenarios(after).every((s) => s.lastRun !== undefined)).toBe(
        true
      );
    });

    it("refuses to run against a form that is not part of the study", () => {
      expect(() => runScenariosForForm(buildStudy(), "nope")).toThrow(
        /not part of study/
      );
    });
  });

  describe("Surviving native export and reopen", () => {
    it("round-trips scenarios and their evidence through the study schema", () => {
      let study = buildStudy();
      const { scenario: ran } = runScenario(maleScenario(), buildForm());
      study = upsertScenario(study, ran);

      // Serialize exactly as a native export would, then reopen.
      const exported = JSON.parse(JSON.stringify(study));
      const parsed = UniversalCrfProtocolSchema.safeParse(exported);

      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      const reopened = parsed.data.testScenarios;
      expect(reopened).toHaveLength(1);
      expect(reopened[0].name).toBe(ran.name);
      expect(reopened[0].expectations).toHaveLength(3);
      expect(reopened[0].lastRun?.passed).toBe(3);
      expect(reopened[0].lastRun?.formFingerprint).toBe(
        ran.lastRun?.formFingerprint
      );
    });

    it("accepts a study that carries no scenarios at all", () => {
      const parsed = UniversalCrfProtocolSchema.safeParse(
        JSON.parse(JSON.stringify(buildStudy()))
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.testScenarios).toEqual([]);
      }
    });

    it("rejects an expectation with an unrecognized kind", () => {
      const study = JSON.parse(JSON.stringify(buildStudy()));
      study.testScenarios = [
        {
          ...maleScenario(),
          expectations: [{ kind: "not_a_kind", fieldId: "x", expected: true }],
        },
      ];

      expect(UniversalCrfProtocolSchema.safeParse(study).success).toBe(false);
    });

    it("survives the real native export and reopen functions", () => {
      let study = buildStudy();
      const { scenario: ran } = runScenario(maleScenario(), buildForm());
      study = upsertScenario(study, ran);

      // The actual serializer the studio uses, not just the schema.
      const json = exportUniversalCrfJson(study);
      expect(json).toContain("testScenarios");

      const reopened = parseUniversalCrf(json);
      const scenarios = reopened.testScenarios || [];

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].id).toBe(ran.id);
      expect(scenarios[0].lastRun?.formFingerprint).toBe(
        ran.lastRun?.formFingerprint
      );

      // And the reopened evidence is still recognised as current, because the
      // form came back unchanged alongside it.
      const reopenedForm = reopened.forms.find((f) => f.id === "form_dm")!;
      expect(isEvidenceStale(scenarios[0], reopenedForm)).toBe(false);
    });

    it("keeps inputs portable by storing them unscoped", () => {
      const scenario = maleScenario();
      // Stored by field id...
      expect(Object.keys(scenario.inputs).sort()).toEqual(["q1", "q2", "sex"]);
      // ...and projected into the scoped shape only at run time.
      const projected = projectScenarioInputs(scenario);
      expect(
        projected[
          `${DEFAULT_TEST_SCOPE.subjectId}_${DEFAULT_TEST_SCOPE.visitId}_sex`
        ]
      ).toBe("M");
    });

    it("replays the same scenario under a different synthetic subject", () => {
      const scenario = maleScenario();
      const moved = updateScenario(scenario, {
        scope: { subjectId: "TEST-999", visitId: "other" },
      });
      const { scenario: ran } = runScenario(moved, buildForm());

      // Same assertions, same outcome, different record.
      expect(ran.lastRun?.failed).toBe(0);
    });
  });
});
