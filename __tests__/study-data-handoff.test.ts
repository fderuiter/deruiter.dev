import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STUDY_PRESETS,
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_SDTM_STRESU_EXTENSION_URL,
  USDM_SDTM_TESTCD_EXTENSION_URL,
  exportStudyToUsdmObject,
  validateUsdmV4Document,
  type UsdmV4Document,
} from "@/lib/crf";
import {
  DEMO_301_STUDY,
  DEMO_301_USDM,
  PACKAGE_FIXED_TIMESTAMP,
  StudyDefinitionError,
  buildDefine,
  buildStudyDataPackage,
  buildTlfOutputs,
  createLineageIndex,
  prepareStudyHandoff,
  runPipeline,
  type HandoffReport,
} from "@/lib/study-data";

const GOLDEN: Record<string, HandoffReport> = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "__tests__/fixtures/study-data/handoff/crf-presets.json"
    ),
    "utf8"
  )
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** DEMO-301 with one study design edit applied to a copy. */
function editedDemo(edit: (doc: UsdmV4Document) => void): UsdmV4Document {
  const doc = clone(DEMO_301_USDM);
  edit(doc);
  return doc;
}

function version(doc: UsdmV4Document) {
  const found = doc.study.versions?.[0];
  if (!found) throw new Error("no study version");
  return found;
}

function design(doc: UsdmV4Document) {
  const found = version(doc).studyDesigns?.[0];
  if (!found) throw new Error("no study design");
  return found;
}

function concept(doc: UsdmV4Document, id: string) {
  const found = version(doc).biomedicalConcepts?.find((bc) => bc.id === id);
  if (!found) throw new Error(`no concept ${id}`);
  return found;
}

describe("CRF Studio to study-data handoff (contract C2)", () => {
  it("has a golden report for every CRF Studio preset", () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(
      STUDY_PRESETS.map((preset) => preset.id).sort()
    );
  });

  it.each(STUDY_PRESETS.map((preset) => [preset.id, preset] as const))(
    "runs the %s export through the whole pipeline",
    async (id, preset) => {
      const usdm = exportStudyToUsdmObject(preset.study);
      expect(await validateUsdmV4Document(usdm)).toEqual([]);
      const before = JSON.stringify(usdm);

      const { definition, report } = prepareStudyHandoff(usdm);
      expect(JSON.stringify(usdm)).toBe(before);
      expect(report).toEqual(GOLDEN[id]);
      expect(definition.studyId).toBe(report.studyId);

      const run = runPipeline(definition, { seed: 2595, nSubjects: 24 });
      const outputs = buildTlfOutputs(definition, run);
      expect(outputs.tables.length).toBeGreaterThan(0);
      for (const layer of ["sdtm", "adam"] as const) {
        const define = buildDefine(run, {
          layer,
          createdAt: PACKAGE_FIXED_TIMESTAMP,
        });
        expect(define.itemGroups.length).toBeGreaterThan(0);
      }
      createLineageIndex(definition, run, outputs);
      const pkg = await buildStudyDataPackage(run, {
        generatedAt: PACKAGE_FIXED_TIMESTAMP,
      });
      expect(pkg.files.length).toBeGreaterThan(0);

      for (const domain of ["VS", "LB"] as const) {
        const planned = new Set(
          report.activities
            .filter((activity) => activity.domain === domain)
            .flatMap((activity) => activity.tests.map((test) => test.testCode))
        );
        const dataset = run.datasets.find(
          (candidate) => candidate.layer === "sdtm" && candidate.name === domain
        );
        expect(new Set(dataset?.columns[`${domain}TESTCD`] ?? [])).toEqual(
          planned
        );
      }
    }
  );

  it("reads the oncology preset's blood pressure and lab test codes from their aCRF annotations (#2757)", () => {
    const preset = STUDY_PRESETS.find((item) => item.id === "oncology_recist");
    if (!preset) throw new Error("no oncology preset");
    const { report } = prepareStudyHandoff(
      exportStudyToUsdmObject(preset.study)
    );
    const tested = (domain: string) =>
      report.activities
        .filter((activity) => activity.domain === domain)
        .flatMap((activity) => activity.tests.map((test) => test.testCode));
    expect(tested("VS")).toEqual(expect.arrayContaining(["SYSBP", "DIABP"]));
    expect(tested("LB")).toEqual(["ALT", "AST", "BILI", "CREAT", "PLAT"]);
    expect(report.tabulatedDomains).toContain("LB");
    const skipped = report.activities.flatMap(
      (activity) => activity.skippedConcepts
    );
    expect(
      skipped
        .filter((concept) => concept.reason === "no-test-code")
        .map((concept) => concept.conceptId)
    ).toEqual(["bc_vs_vsdat", "bc_lb_lbdat", "bc_lb_lbfast"]);
    expect(skipped).toContainEqual(
      expect.objectContaining({ conceptId: "bc_lb_anc", testCode: "NEUT" })
    );
  });

  it("lists every exported activity once, tabulated or with a reason", () => {
    for (const preset of STUDY_PRESETS) {
      const usdm = exportStudyToUsdmObject(preset.study);
      const { report } = prepareStudyHandoff(usdm);
      expect(report.activities.map((activity) => activity.id)).toEqual(
        design(usdm).activities?.map((activity) => activity.id)
      );
      for (const activity of report.activities) {
        expect(activity.tabulated).toBe(activity.reason === undefined);
      }
    }
  });
});

describe("prepareStudyHandoff", () => {
  it("leaves a study the pipeline already runs unchanged", () => {
    const { definition, report } = prepareStudyHandoff(DEMO_301_USDM);
    expect(definition).toEqual(DEMO_301_STUDY);
    expect(report.assumptions).toEqual([]);
    expect(report.unplannedEncounters).toEqual([]);
    expect(report.notTabulatedDomains).toEqual([]);
    expect(report.tabulatedDomains).toEqual([
      "DM",
      "EX",
      "VS",
      "LB",
      "EG",
      "AE",
      "DS",
    ]);
    expect(
      report.activities.every(
        (activity) =>
          activity.tabulated && activity.skippedConcepts.length === 0
      )
    ).toBe(true);
  });

  it("lists an activity in a domain the generator does not produce instead of failing", () => {
    const doc = editedDemo((d) => {
      const vs = design(d).activities?.find((a) => a.id === "act_vs");
      vs!.extensionAttributes = [
        {
          id: "act_vs_domain",
          url: USDM_SDTM_DOMAIN_EXTENSION_URL,
          valueString: "DI",
          instanceType: "ExtensionAttribute",
        },
      ];
    });
    const { definition, report } = prepareStudyHandoff(doc);
    expect(report.activities.find((a) => a.id === "act_vs")).toMatchObject({
      domain: "DI",
      tabulated: false,
      reason: "domain-not-generated",
    });
    expect(report.notTabulatedDomains).toEqual(["DI"]);
    expect(report.tabulatedDomains).not.toContain("VS");
    expect(definition.design.activities.map((a) => a.id)).not.toContain(
      "act_vs"
    );
    expect(
      definition.design.schedule.some((cell) => cell.activityId === "act_vs")
    ).toBe(false);
  });

  it("lists an activity without an SDTM domain as not tabulated", () => {
    const doc = editedDemo((d) => {
      const dm = design(d).activities?.find((a) => a.id === "act_dm");
      dm!.extensionAttributes = [];
    });
    expect(
      prepareStudyHandoff(doc).report.activities.find((a) => a.id === "act_dm")
    ).toMatchObject({ domain: null, tabulated: false, reason: "no-domain" });
  });

  it("drops concepts with no test code or an unmodelled test, and reads the code from an aCRF annotation", () => {
    const doc = editedDemo((d) => {
      concept(d, "bc_pulse").extensionAttributes = [];
      const weight = concept(d, "bc_weight");
      weight.extensionAttributes = [
        {
          id: "bc_weight_crf",
          url: "https://deruiter.dev/usdm/extensions/crf-studio/biomedical-concept",
          valueString: JSON.stringify({
            properties: {
              unit: "lb",
              cdashMetadata: { acrfAnnotation: "VS.VSORRES [VSTESTCD=WEIGHT]" },
            },
          }),
          instanceType: "ExtensionAttribute",
        },
      ];
      concept(d, "bc_diabp").extensionAttributes = [
        {
          id: "bc_diabp_testcd",
          url: USDM_SDTM_TESTCD_EXTENSION_URL,
          valueString: "TEMP",
          instanceType: "ExtensionAttribute",
        },
        {
          id: "bc_diabp_stresu",
          url: USDM_SDTM_STRESU_EXTENSION_URL,
          valueString: "C",
          instanceType: "ExtensionAttribute",
        },
      ];
    });
    const { definition, report } = prepareStudyHandoff(doc);
    const vs = report.activities.find((a) => a.id === "act_vs");
    expect(vs?.tests).toEqual([
      { conceptId: "bc_sysbp", testCode: "SYSBP", unit: "mmHg" },
      {
        conceptId: "bc_weight",
        testCode: "WEIGHT",
        unit: "kg",
        sourceUnit: "lb",
      },
    ]);
    expect(vs?.skippedConcepts).toEqual([
      {
        conceptId: "bc_diabp",
        name: "Diastolic Blood Pressure",
        reason: "test-not-modelled",
        testCode: "TEMP",
      },
      { conceptId: "bc_pulse", name: "Pulse Rate", reason: "no-test-code" },
    ]);
    expect(
      definition.design.activities
        .find((a) => a.id === "act_vs")
        ?.assessments.map((a) => [a.testCode, a.unit])
    ).toEqual([
      ["SYSBP", "mmHg"],
      ["WEIGHT", "kg"],
    ]);
  });

  it("marks a VS or LB activity with no modelled test as not tabulated", () => {
    const doc = editedDemo((d) => {
      for (const id of ["bc_sysbp", "bc_diabp", "bc_pulse", "bc_weight"]) {
        concept(d, id).extensionAttributes = [];
      }
    });
    const { report } = prepareStudyHandoff(doc);
    expect(report.activities.find((a) => a.id === "act_vs")).toMatchObject({
      tabulated: false,
      reason: "no-modelled-tests",
      tests: [],
    });
    expect(report.notTabulatedDomains).toEqual(["VS"]);
  });

  it("supplies an arm, epochs and cells when the design has none, and says so", () => {
    const doc = editedDemo((d) => {
      const studyDesign = design(d);
      studyDesign.arms = [];
      studyDesign.epochs = [];
      studyDesign.studyCells = [];
      for (const timeline of studyDesign.scheduleTimelines ?? []) {
        for (const instance of timeline.instances ?? []) {
          instance.epochId = null;
        }
      }
    });
    const { definition, report } = prepareStudyHandoff(doc);
    expect(report.assumptions).toEqual([
      "epochs-from-study-day",
      "single-arm",
      "elements-per-epoch",
    ]);
    expect(definition.design.arms.map((arm) => arm.armCode)).toEqual(["TRT"]);
    expect(definition.design.epochs.map((epoch) => epoch.name)).toEqual([
      "SCREENING",
      "TREATMENT",
    ]);
    for (const visit of definition.design.visits) {
      expect(visit.epochId).toBe(
        visit.targetDay < 1
          ? "handoff_epoch_screening"
          : "handoff_epoch_treatment"
      );
    }
    expect(definition.design.cells).toHaveLength(2);
    const run = runPipeline(definition, { seed: 1, nSubjects: 6 });
    const ta = run.datasets.find((dataset) => dataset.name === "TA");
    expect(ta?.rowCount).toBe(2);
  });

  it("leaves out an encounter no timing reaches and names it", () => {
    const doc = editedDemo((d) => {
      const studyDesign = design(d);
      const timeline = studyDesign.scheduleTimelines![0];
      const template = timeline.instances![1];
      studyDesign.encounters = [
        ...(studyDesign.encounters ?? []),
        {
          ...studyDesign.encounters![1],
          id: "enc_unscheduled",
          name: "Unscheduled",
          previousId: null,
          nextId: null,
          scheduledAtId: null,
        },
      ];
      timeline.instances = [
        ...timeline.instances!,
        { ...template, id: "sai_unscheduled", encounterId: "enc_unscheduled" },
      ];
    });
    const { definition, report } = prepareStudyHandoff(doc);
    expect(report.unplannedEncounters).toEqual([
      { id: "enc_unscheduled", name: "Unscheduled" },
    ]);
    expect(definition.design.visits.map((visit) => visit.id)).not.toContain(
      "enc_unscheduled"
    );
  });

  it("keeps the source document on the definition", () => {
    const doc = editedDemo(() => {});
    expect(prepareStudyHandoff(doc).definition.usdm).toBe(doc);
  });

  it.each([
    ["a non-object", null],
    ["a USDM v3 document", { usdmVersion: "3.0.0", study: {} }],
    [
      "a study without a design",
      { usdmVersion: "4.0.0", study: { versions: [{}] } },
    ],
  ])("rejects %s with a StudyDefinitionError", (_label, doc) => {
    expect(() => prepareStudyHandoff(doc)).toThrow(StudyDefinitionError);
  });
});

describe("validateUsdmV4Document", () => {
  it("accepts DEMO-301 and reports schema issues for a malformed document", async () => {
    expect(await validateUsdmV4Document(DEMO_301_USDM)).toEqual([]);
    const issues = await validateUsdmV4Document({ usdmVersion: "4.0.0" });
    expect(issues.length).toBeGreaterThan(0);
  });
});
