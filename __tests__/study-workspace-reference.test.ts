import { describe, expect, it } from "vitest";
import {
  getUsdmV4EncounterSchedule,
  validateUsdmV4Document,
} from "@/lib/clinical-standards";
import { exportStudyToUsdmObject, importStudyFromUsdm } from "@/lib/crf";
import { DEVICE_CARDIOVASCULAR_IMPLANT_PRESET } from "@/lib/crf/presets";
import { prepareStudyHandoff } from "@/lib/study-data";
import { TAVR_DEVICE_USDM, importUsdmStudy } from "@/lib/study-workspace";

const version = (TAVR_DEVICE_USDM.study.versions ?? [])[0];
const design = (version.studyDesigns ?? [])[0];
const primaryEndpoint = (design.objectives ?? [])
  .flatMap((objective) => objective.endpoints ?? [])
  .find((endpoint) => endpoint.level.decode === "Primary Endpoint");

describe("the TAVR device reference study", () => {
  it("is a valid USDM v4 document", async () => {
    expect(await validateUsdmV4Document(TAVR_DEVICE_USDM)).toEqual([]);
  });

  it("opens as a workspace without asking which version or design", async () => {
    const result = await importUsdmStudy({ document: TAVR_DEVICE_USDM });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.report.schemaIssues).toEqual([]);
      expect(result.report.counts).toMatchObject({
        arms: 1,
        endpoints: 2,
        estimands: 1,
      });
    }
  });

  it("carries no CRF Studio private extensions", () => {
    const urls = [
      ...JSON.stringify(TAVR_DEVICE_USDM).matchAll(/"url":\s*"([^"]+)"/g),
    ].map((match) => match[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => url.includes("/crf-studio/"))).toEqual([]);
  });

  it("names the valve as a medical device next to its intervention", () => {
    const intervention = (version.studyInterventions ?? [])[0];
    expect(intervention.type.decode).toMatch(/Device/);
    const devices = (version as { medicalDevices?: { name: string }[] })
      .medicalDevices;
    expect(devices?.map((device) => device.name)).toEqual([intervention.name]);
  });

  it("estimates the primary endpoint in the attempted-implant population", () => {
    expect(primaryEndpoint?.name).toBe("VARC-3 early safety composite");
    const [estimand] = design.estimands ?? [];
    expect(estimand.variableOfInterestId).toBe(primaryEndpoint?.id);
    const population = (design.analysisPopulations ?? []).find(
      (candidate) => candidate.id === estimand.analysisPopulationId
    );
    expect(population?.name).toBe("Attempted implant population");
    expect(estimand.populationSummary).toMatch(/Clopper-Pearson/);
    expect(estimand.intercurrentEvents.map((event) => event.strategy)).toEqual([
      "Composite variable",
      "Treatment policy",
      "Hypothetical",
    ]);
  });

  it("collects what the primary endpoint needs at the 30-day visit", () => {
    const thirtyDay = getUsdmV4EncounterSchedule(design).find(
      (entry) => entry.encounterId === "v_dev_30d"
    );
    expect(thirtyDay?.activityIds).toEqual(
      expect.arrayContaining(["form_ae_dev", "form_de_dev", "act_dev_cec"])
    );
  });

  it("tabulates the same vital signs tests as CRF Studio's preset export", () => {
    const tests = (usdm: unknown) =>
      prepareStudyHandoff(usdm).report.activities.find(
        (activity) => activity.domain === "VS"
      )?.tests;
    expect(tests(TAVR_DEVICE_USDM)).toEqual(
      tests(exportStudyToUsdmObject(DEVICE_CARDIOVASCULAR_IMPLANT_PRESET))
    );
    expect(tests(TAVR_DEVICE_USDM)?.length).toBeGreaterThan(0);
  });

  it("reports the device domains as not yet tabulated, and tabulates adjudication (#3417)", () => {
    const { activities } = prepareStudyHandoff(TAVR_DEVICE_USDM).report;
    const untabulated = activities
      .filter((activity) => !activity.tabulated)
      .map((activity) => activity.domain);
    expect(untabulated).toEqual(expect.arrayContaining(["DI", "DU", "DE"]));
    expect(untabulated).not.toContain("CE");
    expect(
      activities.filter((activity) => activity.domain === "CE")
    ).not.toHaveLength(0);
  });

  it("opens in CRF Studio with its seven visits", () => {
    const study = importStudyFromUsdm(TAVR_DEVICE_USDM);
    expect(study.visits).toHaveLength(7);
    expect(
      study.visits.find((visit) => visit.id === "v_dev_30d")?.assignedFormIds
    ).toContain("act_dev_cec");
  });
});
