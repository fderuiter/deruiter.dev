import { describe, expect, it } from "vitest";
import {
  getUsdmV4EncounterSchedule,
  validateUsdmV4Document,
} from "@/lib/clinical-standards";
import { importStudyFromUsdm } from "@/lib/crf";
import { prepareStudyHandoff } from "@/lib/study-data";
import {
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  importUsdmStudy,
} from "@/lib/study-workspace";

const version = (TAVR_SAVR_USDM.study.versions ?? [])[0];
const design = (version.studyDesigns ?? [])[0];
const endpoints = (design.objectives ?? []).flatMap(
  (objective) => objective.endpoints ?? []
);
const [estimand] = design.estimands ?? [];

describe("the randomised TAVR versus SAVR reference study", () => {
  it("is a valid USDM v4 document", async () => {
    expect(await validateUsdmV4Document(TAVR_SAVR_USDM)).toEqual([]);
  });

  it("opens as a workspace with two arms and one estimand", async () => {
    const result = await importUsdmStudy({ document: TAVR_SAVR_USDM });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.report.schemaIssues).toEqual([]);
      expect(result.report.counts).toMatchObject({ arms: 2, estimands: 1 });
    }
  });

  it("compares the TAVR arm with an active surgical comparator", () => {
    expect(design.arms.map((arm) => [arm.id, arm.type.decode])).toEqual([
      ["arm_rct_tavr", "Experimental Arm"],
      ["arm_rct_savr", "Active Comparator Arm"],
    ]);
    // Each arm runs through every epoch, receiving its own intervention.
    for (const arm of design.arms) {
      const cells = design.studyCells.filter((cell) => cell.armId === arm.id);
      expect(cells.map((cell) => cell.epochId)).toEqual(
        design.epochs.map((epoch) => epoch.id)
      );
    }
    const procedureInterventions = design.arms.map((arm) => {
      const cell = design.studyCells.find(
        (candidate) =>
          candidate.armId === arm.id && candidate.epochId === "ep_rct_proc"
      );
      return (design.elements ?? [])
        .filter((element) => cell?.elementIds.includes(element.id))
        .flatMap((element) => element.studyInterventionIds ?? []);
    });
    expect(procedureInterventions).toEqual([
      ["int_rct_tavr"],
      ["int_rct_savr"],
    ]);
  });

  it("is randomised 1:1, stratified by surgical risk", () => {
    expect(design.model.decode).toBe("Parallel Study");
    expect((design.characteristics ?? []).map((c) => c.decode)).toEqual([
      "Randomized",
      "Stratified Randomisation",
      "Multicentre",
    ]);
    const scheme = (
      design as {
        extensionAttributes?: { url: string; valueString?: string }[];
      }
    ).extensionAttributes?.find((attribute) =>
      attribute.url.endsWith("/randomisation")
    );
    expect(JSON.parse(scheme?.valueString ?? "{}")).toMatchObject({
      ratio: { arm_rct_tavr: 1, arm_rct_savr: 1 },
      strata: [{ adslVariable: "STRAT1R", levels: expect.any(Array) }],
    });
  });

  it("states the hierarchy in the primary endpoint and lists each level in order", () => {
    const primary = endpoints.filter(
      (endpoint) => endpoint.level.decode === "Primary Endpoint"
    );
    expect(primary.map((endpoint) => endpoint.id)).toEqual(["ep_rct_hce"]);
    expect(primary[0].text).toMatch(/less than 5 points counting as a tie/);
    const components = (design.objectives ?? []).find(
      (objective) => objective.id === "obj_rct_components"
    );
    expect(components?.endpoints?.map((endpoint) => endpoint.id)).toEqual([
      "ep_rct_death",
      "ep_rct_stroke",
      "ep_rct_rehosp",
      "ep_rct_vsfs",
    ]);
  });

  it("estimates the win ratio in all randomised participants, as randomised", () => {
    expect(estimand.variableOfInterestId).toBe("ep_rct_hce");
    expect(estimand.interventionIds).toEqual(["int_rct_tavr", "int_rct_savr"]);
    const population = (design.analysisPopulations ?? []).find(
      (candidate) => candidate.id === estimand.analysisPopulationId
    );
    expect(population?.text).toMatch(/All randomised participants/);
    expect(estimand.populationSummary).toMatch(/Win ratio/);
    expect(estimand.intercurrentEvents.map((event) => event.strategy)).toEqual([
      "Composite variable",
      "Treatment policy",
      "Hypothetical",
    ]);
  });

  it("collects the questionnaire at baseline and 1 year and adjudicates events at every follow-up", () => {
    const schedule = getUsdmV4EncounterSchedule(design);
    const at = (encounterId: string) =>
      schedule.find((entry) => entry.encounterId === encounterId)
        ?.activityIds ?? [];
    expect(at("v_rct_screen")).toEqual(
      expect.arrayContaining(["act_rct_vsfs", "act_rct_rand"])
    );
    expect(at("v_rct_1y")).toEqual(
      expect.arrayContaining(["act_rct_vsfs", "act_rct_cec", "form_ae_rct"])
    );
    for (const visit of [
      "v_rct_30d",
      "v_rct_6m",
      "v_rct_1y",
      "v_rct_unsched",
    ]) {
      expect(at(visit)).toContain("act_rct_cec");
    }
  });

  it("shares no ids with the single-arm device study", () => {
    const ids = (document: unknown) =>
      new Set(
        [...JSON.stringify(document).matchAll(/"id":\s*"([^"]+)"/g)]
          .map((match) => match[1])
          .filter((id) => /_dev|_rct/.test(id))
      );
    const single = ids(TAVR_DEVICE_USDM);
    expect([...ids(TAVR_SAVR_USDM)].filter((id) => single.has(id))).toEqual([]);
  });

  it("tabulates the adjudication (#3417) and questionnaire (#3418) domains", () => {
    const { report } = prepareStudyHandoff(TAVR_SAVR_USDM);
    expect(report.notTabulatedDomains).not.toContain("CE");
    expect(report.notTabulatedDomains).not.toContain("QS");
    expect(report.tabulatedDomains).toEqual(
      expect.arrayContaining(["CE", "QS"])
    );
  });

  it("opens in CRF Studio with both arms' shared visits", () => {
    const study = importStudyFromUsdm(TAVR_SAVR_USDM);
    expect(study.visits).toHaveLength(7);
    expect(
      study.visits.find((visit) => visit.id === "v_rct_1y")?.assignedFormIds
    ).toEqual(expect.arrayContaining(["act_rct_vsfs", "act_rct_cec"]));
  });
});
