// @vitest-environment node
/**
 * SDTM CM (#2961): prior and concomitant medications, coded with the
 * study's fictional drug dictionary, including the rescue antihypertensive
 * the estimand's intercurrent event refers to.
 */
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  runPipeline,
  type CellValue,
  type Dataset,
} from "@/lib/study-data";

type Row = Record<string, CellValue>;

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });

function find(layer: string, name: string): Dataset {
  return run.datasets.find(
    (dataset) => dataset.layer === layer && dataset.name === name
  )!;
}

function rows(dataset: Dataset): Row[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][index]])
    )
  );
}

const cmDataset = find("sdtm", "CM");
const cm = rows(cmDataset);
const dm = new Map(rows(find("sdtm", "DM")).map((row) => [row.USUBJID, row]));
const ae = rows(find("sdtm", "AE"));

describe("SDTM CM (#2961)", () => {
  it("records medications for randomized subjects only", () => {
    expect(cm.length).toBeGreaterThan(0);
    for (const row of cm) expect(dm.get(row.USUBJID)?.ARMCD).not.toBeNull();
  });

  it("codes every medication with the fictional dictionary", () => {
    for (const row of cm) {
      expect(row.CMDECOD).toBe(String(row.CMTRT).toUpperCase());
      expect(row.CMCLAS).toEqual(expect.any(String));
      // Z is not an ATC first level, so no class code reads as a real one.
      expect(row.CMCLASCD).toMatch(/^Z\d{2}[A-Z]$/);
      expect(row).toMatchObject({ CMDOSU: "mg", CMROUTE: "ORAL" });
    }
  });

  it("ends the washed-out antihypertensive before first dose", () => {
    const washout = cm.filter((row) => row.CMDECOD === "RAMIPRIL");
    expect(washout.length).toBeGreaterThan(0);
    for (const row of washout) {
      expect(row.CMENDY as number).toBeLessThan(1);
      expect(row.CMENRTPT).toBeNull();
    }
  });

  it("marks long-term medications ongoing at the end of the study", () => {
    const ongoing = cm.filter((row) => row.CMENRTPT === "ONGOING");
    expect(ongoing.length).toBeGreaterThan(0);
    for (const row of ongoing) {
      expect(row.CMENDTC).toBeNull();
      expect(row.CMENTPT).toBe("END OF STUDY");
    }
    for (const row of cm.filter((item) => item.CMENRTPT === null))
      expect(row.CMENTPT).toBeNull();
  });

  it("dates medication remembered to the month without a study day or epoch", () => {
    const partial = cm.filter((row) =>
      /^\d{4}-\d{2}$/.test(String(row.CMSTDTC))
    );
    expect(partial.length).toBeGreaterThan(0);
    for (const row of partial) {
      expect(row.CMSTDY).toBeNull();
      expect(row.EPOCH).toBeNull();
    }
  });

  it("treats an adverse event with a medication over the same dates", () => {
    const treated = cm.filter(
      (row) => row.CMDECOD === "PARACETAMOL" || row.CMDECOD === "ONDANSETRON"
    );
    expect(treated.length).toBeGreaterThan(0);
    for (const row of treated) {
      const event = ae.find(
        (item) => item.USUBJID === row.USUBJID && item.AEDECOD === row.CMINDC
      )!;
      expect(event).toBeDefined();
      expect([row.CMSTDTC, row.CMENDTC]).toEqual([
        event.AESTDTC,
        event.AEENDTC,
      ]);
      expect(row.CMDOSFRQ).toBe("PRN");
    }
  });

  it("starts rescue medication on treatment, in the treatment epoch", () => {
    const rescue = cm.filter((row) => row.CMCAT === "RESCUE MEDICATION");
    expect(rescue.length).toBeGreaterThan(0);
    for (const row of rescue) {
      expect(row).toMatchObject({
        CMDECOD: "AMLODIPINE",
        CMINDC: "Hypertension",
        CMENRTPT: "ONGOING",
        EPOCH: "TREATMENT",
      });
      expect(row.CMSTDY as number).toBeGreaterThanOrEqual(15);
      expect(String(row.CMSTDTC) <= String(dm.get(row.USUBJID)!.RFENDTC)).toBe(
        true
      );
    }
    expect(
      cm
        .filter((row) => row.CMCAT !== "RESCUE MEDICATION")
        .every((row) => row.CMCAT === "GENERAL MEDICATION")
    ).toBe(true);
  });

  it("traces each record to the collected medication it came from", () => {
    const collected = rows(find("collected", "CM"));
    cm.forEach((row, index) => {
      const [source] = cmDataset.lineage![index]!;
      const record = collected.find((item) => item.SRCID === source)!;
      expect(record).toMatchObject({
        USUBJID: row.USUBJID,
        CMTRT: row.CMTRT,
        CMSTDTC: row.CMSTDTC,
      });
    });
  });
});
