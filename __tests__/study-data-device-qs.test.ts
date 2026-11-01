import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  prepareStudyHandoff,
  runConformance,
  runPipeline,
  type Dataset,
} from "@/lib/study-data";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";

/**
 * Device questionnaire scores (#3418). The TAVR versus SAVR study schedules
 * the Valve Symptom and Function Score (a fictional 0 to 100 instrument) at
 * baseline, 30 days, 6 months and 1 year, and names its overall summary
 * score through a biomedical concept. The handoff tabulates the QS activity
 * because the generator models that score, and SDTM QS is emitted only when
 * collected, so DEMO-301 is generated exactly as before.
 */

type Cell = string | number | null;

function find(
  datasets: readonly Dataset[],
  layer: Dataset["layer"],
  name: string
): Dataset | undefined {
  return datasets.find((each) => each.layer === layer && each.name === name);
}

function rows(dataset: Dataset | undefined): Record<string, Cell>[] {
  if (!dataset) return [];
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map((variable) => [
        variable.name,
        dataset.columns[variable.name][index] as Cell,
      ])
    )
  );
}

const handoff = prepareStudyHandoff(TAVR_SAVR_USDM);
const device = handoff.definition;
const run = runPipeline(device, { seed: 3418, nSubjects: 120 });
const qs = find(run.datasets, "sdtm", "QS");
const qsRows = rows(qs);

const vsfs = device.design.activities.find(
  (activity) => activity.domain === "QS"
)!;
const scheduledVisits = new Set(
  device.design.schedule
    .filter((cell) => cell.activityId === vsfs.id)
    .map(
      (cell) =>
        device.design.visits.find((visit) => visit.id === cell.visitId)!.name
    )
);

describe("tabulating the questionnaire", () => {
  it("reads the VSFS overall summary score from the study definition", () => {
    expect(vsfs.assessments).toEqual([
      expect.objectContaining({
        testCode: "VSFSOS",
        testName: "VSFS Overall Summary Score",
        category: "VSFS",
      }),
    ]);
    expect(vsfs.assessments[0]).not.toHaveProperty("unit");
  });

  it("tabulates QS through the domain list, with no study-specific branch", () => {
    const activity = handoff.report.activities.find(
      (each) => each.domain === "QS"
    )!;
    expect(activity.tabulated).toBe(true);
    expect(activity.tests).toEqual([
      expect.objectContaining({ testCode: "VSFSOS", category: "VSFS" }),
    ]);
    expect(handoff.report.notTabulatedDomains).not.toContain("QS");
  });
});

describe("the VSFS scores", () => {
  it("records each score as a declared VSFS test, in range", () => {
    expect(qsRows.length).toBeGreaterThan(100);
    for (const row of qsRows) {
      expect(row.QSTESTCD).toBe(vsfs.assessments[0].testCode);
      expect(row.QSTEST).toBe(vsfs.assessments[0].testName);
      expect(row.QSCAT).toBe(vsfs.assessments[0].category);
      expect(Number.isInteger(row.QSSTRESN)).toBe(true);
      expect(row.QSSTRESN as number).toBeGreaterThanOrEqual(0);
      expect(row.QSSTRESN as number).toBeLessThanOrEqual(100);
      expect(row.QSORRES).toBe(String(row.QSSTRESN));
      expect(row.QSSTRESC).toBe(row.QSORRES);
    }
  });

  it("scores only at the visits the questionnaire is scheduled at", () => {
    for (const row of qsRows) expect(scheduledVisits).toContain(row.VISIT);
  });

  it("flags one baseline per subject, before the procedure", () => {
    const flagged = qsRows.filter((row) => row.QSLOBXFL === "Y");
    const subjects = new Set(flagged.map((row) => row.USUBJID));
    expect(subjects.size).toBe(flagged.length);
    for (const row of flagged) expect(row.QSDY as number).toBeLessThan(1);
  });

  it("improves on average from baseline to one year", () => {
    const mean = (visit: string) => {
      const values = qsRows
        .filter((row) => String(row.VISIT).startsWith(visit))
        .map((row) => row.QSSTRESN as number);
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    expect(mean("1-Year") - mean("Screening")).toBeGreaterThan(10);
  });

  it("traces every QS row to a collected QS record", () => {
    const collected = new Set(
      rows(find(run.datasets, "collected", "QS")).map((row) => row.SRCID)
    );
    expect(collected.size).toBe(qsRows.length);
    for (let row = 0; row < qs!.rowCount; row += 1) {
      const lineage = qs!.lineage?.[row] ?? [];
      expect(lineage.filter((source) => collected.has(source))).toHaveLength(1);
    }
    expect(
      runConformance(run.datasets).findings.filter(
        (finding) => finding.ruleId === "SD-090"
      )
    ).toEqual([]);
  });
});

describe("a study without a questionnaire", () => {
  it("generates DEMO-301 byte for byte as before, with no QS", () => {
    const { datasets } = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 90,
    });
    expect(
      createHash("sha256").update(JSON.stringify(datasets)).digest("hex")
    ).toBe("29e9f35df2f6de37fc9c48dc6c3ba17dfa63b085d4a0f3c6fd22d19f4f2c1574");
    expect(datasets.some((dataset) => dataset.name === "QS")).toBe(false);
  });
});
