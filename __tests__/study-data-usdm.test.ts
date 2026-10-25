import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  DEMO_301_USDM,
  StudyDefinitionError,
  readStudyDefinition,
} from "@/lib/study-data";
import { importStudyFromUsdm } from "@/lib/crf";
import { validateUsdmV4 } from "./helpers/usdm-v4-schema";

const design = DEMO_301_STUDY.design;

function clone(): typeof DEMO_301_USDM {
  return structuredClone(DEMO_301_USDM);
}

describe("DEMO-301 USDM v4.0 document", () => {
  it("validates against the official USDM v4.0.0 schema", () => {
    expect(validateUsdmV4(DEMO_301_USDM)).toEqual([]);
  });

  it("survives a JSON round trip unchanged and still validates", () => {
    const parsed = JSON.parse(JSON.stringify(DEMO_301_USDM));
    expect(validateUsdmV4(parsed)).toEqual([]);
    expect(readStudyDefinition(parsed).design).toEqual(design);
  });

  it("has a unique id on every identifiable object", () => {
    const ids: string[] = [];
    JSON.stringify(DEMO_301_USDM, (key, value) => {
      if (key === "id" && typeof value === "string") ids.push(value);
      return value;
    });
    const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    expect(duplicates).toEqual([]);
  });

  it("is labelled as fictional", () => {
    expect(DEMO_301_USDM.study.description).toMatch(/fictional/i);
    expect(DEMO_301_USDM.study.description).toMatch(/synthetic/i);
  });

  // CDISC CORE USDM 4.0 rules CORE-000973, -001054, -001065, -001071,
  // -000875 and -001076.
  describe("design and governance content", () => {
    const version = DEMO_301_USDM.study.versions![0];
    const studyDesign = version.studyDesigns![0];
    const roles = version.roles ?? [];

    it("has one sponsor role, for the fictional sponsor and its study id", () => {
      const sponsors = roles.filter((r) => r.code.code === "C70793");
      expect(sponsors).toHaveLength(1);
      expect(sponsors[0].appliesToIds).toEqual([version.id]);
      const [orgId] = sponsors[0].organizationIds!;
      expect(version.organizations!.find((o) => o.id === orgId)?.name).toMatch(
        /fictional/
      );
      expect(
        version.studyIdentifiers.filter((i) => i.scopeId === orgId)
      ).toHaveLength(1);
    });

    it("masks at least two roles on the double-blind design", () => {
      expect(studyDesign.blindingSchema?.standardCode.code).toBe("C15228");
      const masked = roles.filter(
        (r) => r.appliesToIds?.includes(studyDesign.id) && r.masking?.isMasked
      );
      expect(masked.map((r) => r.name)).toEqual([
        "Investigator",
        "Study Subject",
      ]);
    });

    it("plans both sexes for the population", () => {
      expect(
        studyDesign.population.plannedSex?.map((c) => [c.code, c.decode])
      ).toEqual([
        ["C16576", "Female"],
        ["C20197", "Male"],
      ]);
    });

    it("administers each study intervention through a procedure", () => {
      const procedures = studyDesign.activities!.flatMap(
        (a) => a.definedProcedures ?? []
      );
      expect(procedures.map((p) => p.studyInterventionId)).toEqual(
        studyDesign.studyInterventionIds
      );
    });

    it("gives every activity a procedure, concept or concept surrogate", () => {
      const surrogateIds = new Set(version.bcSurrogates!.map((s) => s.id));
      for (const activity of studyDesign.activities!) {
        const references = [
          ...(activity.definedProcedures ?? []),
          ...(activity.biomedicalConceptIds ?? []),
          ...(activity.bcSurrogateIds ?? []),
        ];
        expect(references, activity.name).not.toHaveLength(0);
        for (const id of activity.bcSurrogateIds ?? []) {
          expect(surrogateIds).toContain(id);
        }
      }
    });
  });
});

describe("readStudyDefinition(DEMO-301)", () => {
  it("reads the study identity and design metadata", () => {
    expect(DEMO_301_STUDY.studyId).toBe("DEMO-301");
    expect(DEMO_301_STUDY.title).toMatch(
      /Randomised, Double-Blind, Placebo-Controlled/
    );
    expect(DEMO_301_STUDY.usdm).toBe(DEMO_301_USDM);
    expect(design.phase).toBe("Phase III Trial");
    expect(design.model).toBe("Parallel Study");
    expect(design.blinding).toBe("Double Blind Study");
    expect(design.plannedEnrollment).toBe(90);
  });

  it("reads three arms: placebo, low and high dose", () => {
    expect(design.arms.map((a) => [a.armCode, a.name, a.type.decode])).toEqual([
      ["PBO", "Placebo", "Placebo Comparator Arm"],
      ["DMX10", "Demoxacin 10 mg", "Experimental Arm"],
      ["DMX20", "Demoxacin 20 mg", "Experimental Arm"],
    ]);
  });

  it("reads epochs, elements and one study cell per arm and epoch", () => {
    expect(design.epochs.map((e) => e.name)).toEqual([
      "SCREENING",
      "TREATMENT",
      "FOLLOW-UP",
    ]);
    expect(design.cells).toHaveLength(
      design.arms.length * design.epochs.length
    );
    const treatmentElements = design.cells
      .filter((c) => c.epochId === "epoch_treatment")
      .map((c) => c.elementIds[0]);
    expect(new Set(treatmentElements).size).toBe(3);
    expect(design.elements.map((e) => e.elementCode)).toEqual([
      "SCRN",
      "PBO",
      "DMX10",
      "DMX20",
      "FU",
    ]);
  });

  it("resolves visit study days and windows from the timeline", () => {
    expect(
      design.visits.map((v) => [
        v.visitNum,
        v.name,
        v.targetDay,
        v.windowBefore,
        v.windowAfter,
      ])
    ).toEqual([
      [1, "SCREENING", -14, 14, 13],
      [2, "BASELINE", 1, 0, 0],
      [3, "WEEK 2", 15, 3, 3],
      [4, "WEEK 4", 29, 3, 3],
      [5, "WEEK 8", 57, 5, 5],
      [6, "WEEK 12", 85, 5, 5],
      [7, "END OF STUDY", 99, 3, 7],
    ]);
    expect(design.visits.map((v) => v.epochId)).toEqual([
      "epoch_screening",
      ...Array(5).fill("epoch_treatment"),
      "epoch_followup",
    ]);
  });

  it("reads the activities, their domains and their tests", () => {
    expect(design.activities.map((a) => a.domain)).toEqual([
      "DM",
      "VS",
      "LB",
      "LB",
      "EX",
      "AE",
      "DS",
    ]);
    const vs = design.activities.find((a) => a.domain === "VS")!;
    expect(vs.assessments.map((t) => [t.testCode, t.nciCode, t.unit])).toEqual([
      ["SYSBP", "C25298", "mmHg"],
      ["DIABP", "C25299", "mmHg"],
      ["PULSE", "C49676", "beats/min"],
      ["WEIGHT", "C25208", "kg"],
    ]);
    const lbTests = design.activities
      .filter((a) => a.domain === "LB")
      .flatMap((a) => a.assessments.map((t) => t.testCode));
    expect(lbTests).toEqual([
      "ALT",
      "AST",
      "BILI",
      "CREAT",
      "GLUC",
      "HGB",
      "WBC",
      "PLAT",
    ]);
  });

  it("builds the schedule of activities", () => {
    const at = (visitId: string) =>
      design.schedule
        .filter((s) => s.visitId === visitId)
        .map((s) => s.activityId);
    expect(at("enc_screening")).toContain("act_dm");
    expect(at("enc_baseline")).toEqual(
      expect.arrayContaining(["act_vs", "act_lb_chem", "act_ex"])
    );
    expect(at("enc_week2")).not.toContain("act_lb_chem");
    expect(at("enc_week12")).toContain("act_ds");
    for (const visit of design.visits) {
      expect(at(visit.id)).toContain("act_vs");
    }
  });

  it("reads the primary and secondary endpoints and their estimands", () => {
    const endpoints = design.objectives.flatMap((o) => o.endpoints);
    const primary = endpoints.find(
      (e) => e.level.decode === "Primary Endpoint"
    );
    expect(primary?.text).toBe(
      "Change from baseline in seated systolic blood pressure at Week 12."
    );
    const secondary = endpoints.filter(
      (e) => e.level.decode === "Secondary Endpoint"
    );
    expect(secondary.map((e) => e.text)).toContain(
      "Time from first dose to the first treatment-emergent adverse event leading to discontinuation of study drug."
    );
    const primaryEstimand = design.estimands.find(
      (e) => e.endpointId === primary?.id
    );
    expect(primaryEstimand?.analysisPopulationId).toBe("pop_fas");
    expect(primaryEstimand?.intercurrentEvents.map((i) => i.strategy)).toEqual([
      "Treatment policy",
      "Hypothetical",
    ]);
    expect(design.analysisPopulations.map((p) => p.name)).toEqual([
      "Full Analysis Set",
      "Safety Set",
    ]);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(readStudyDefinition(DEMO_301_USDM))).toBe(
      JSON.stringify(DEMO_301_STUDY)
    );
  });
});

describe("readStudyDefinition errors", () => {
  it.each([
    ["a non-object", 42, /JSON object/],
    [
      "a USDM 3 document",
      { schemaVersion: "3.0.0", study: {} },
      /usdmVersion 4/,
    ],
    [
      "a study without versions",
      { usdmVersion: "4.0.0", study: { name: "X" } },
      /no version/,
    ],
  ])("rejects %s", (_label, input, message) => {
    expect(() => readStudyDefinition(input)).toThrow(StudyDefinitionError);
    expect(() => readStudyDefinition(input)).toThrow(message);
  });

  it("rejects an activity without an SDTM domain", () => {
    const doc = clone();
    doc.study.versions![0].studyDesigns![0].activities![0].extensionAttributes =
      [];
    expect(() => readStudyDefinition(doc)).toThrow(/no SDTM domain/);
  });

  it("rejects a schedule that names an unknown activity", () => {
    const doc = clone();
    const timeline =
      doc.study.versions![0].studyDesigns![0].scheduleTimelines![0];
    timeline.instances![0].activityIds = ["act_missing"];
    expect(() => readStudyDefinition(doc)).toThrow(/unknown activity/);
  });

  it("rejects a visit whose timing never reaches the anchor", () => {
    const doc = clone();
    const timing =
      doc.study.versions![0].studyDesigns![0].scheduleTimelines![0].timings![2];
    timing.relativeToScheduledInstanceId = "nowhere";
    expect(() => readStudyDefinition(doc)).toThrow(/reaches the anchor/);
  });
});

describe("DEMO-301 in CRF Studio", () => {
  it("imports through the CRF Studio USDM v4 reader with the same schedule", () => {
    const study = importStudyFromUsdm(DEMO_301_USDM);
    expect(study.protocolNumber).toBe("DEMO-301");
    expect(study.arms?.map((a) => a.id)).toEqual(design.arms.map((a) => a.id));
    expect(
      study.visits.map((v) => [
        v.id,
        v.targetDay,
        v.windowBefore,
        v.windowAfter,
      ])
    ).toEqual(
      design.visits.map((v) => [
        v.id,
        v.targetDay,
        v.windowBefore,
        v.windowAfter,
      ])
    );
    expect(study.forms.map((f) => f.domain)).toEqual(
      design.activities.map((a) => a.domain)
    );
  });
});
