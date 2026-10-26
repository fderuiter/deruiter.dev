// @vitest-environment node
/**
 * SDTM MH (#2963): medical history taken at screening, coded with the
 * study's fictional event dictionary. The study's own condition is recorded
 * for every subject, and the condition behind each long-term medication
 * matches the medication page.
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

const mhDataset = find("sdtm", "MH");
const mh = rows(mhDataset);
const dm = rows(find("sdtm", "DM"));
const cm = rows(find("sdtm", "CM"));
const sv = rows(find("sdtm", "SV"));

describe("SDTM MH (#2963)", () => {
  it("records hypertension as the primary diagnosis of every screened subject", () => {
    const primary = mh.filter((row) => row.MHCAT === "PRIMARY DIAGNOSIS");
    expect(primary.map((row) => row.USUBJID).sort()).toEqual(
      dm.map((row) => row.USUBJID).sort()
    );
    for (const row of primary)
      expect(row).toMatchObject({
        MHTERM: "Hypertension",
        MHDECOD: "Hypertension",
        MHBODSYS: "Vascular disorders",
        MHENRTPT: "ONGOING",
        MHENTPT: "SCREENING",
      });
    expect(dm.some((row) => row.ARMNRS === "SCREEN FAILURE")).toBe(true);
  });

  it("codes every condition with the fictional dictionary", () => {
    for (const row of mh) {
      expect(row.MHDECOD).toEqual(expect.any(String));
      expect(row.MHBODSYS).toEqual(expect.any(String));
    }
    expect(
      new Set(mh.map((row) => `${row.MHTERM} -> ${row.MHDECOD}`))
    ).toContain(
      "Gastro-oesophageal reflux disease -> Gastrooesophageal reflux disease"
    );
  });

  it("names the condition behind each long-term medication, from the same month", () => {
    const longTerm = cm.filter(
      (row) =>
        row.CMENRTPT === "ONGOING" &&
        row.CMCAT === "GENERAL MEDICATION" &&
        row.CMINDC !== "Cardiovascular prophylaxis"
    );
    expect(longTerm.length).toBeGreaterThan(0);
    for (const medication of longTerm) {
      const condition = mh.find(
        (row) =>
          row.USUBJID === medication.USUBJID && row.MHTERM === medication.CMINDC
      );
      expect(condition?.MHSTDTC).toBe(medication.CMSTDTC);
      expect(condition?.MHENRTPT).toBe("ONGOING");
    }
  });

  it("dates hypertension from the antihypertensive stopped for the washout", () => {
    const washout = cm.filter((row) => row.CMDECOD === "RAMIPRIL");
    expect(washout.length).toBeGreaterThan(0);
    for (const medication of washout)
      expect(
        mh.find(
          (row) =>
            row.USUBJID === medication.USUBJID &&
            row.MHCAT === "PRIMARY DIAGNOSIS"
        )?.MHSTDTC
      ).toBe(medication.CMSTDTC);
  });

  it("ends resolved conditions before screening and leaves them unflagged", () => {
    const resolved = mh.filter((row) => row.MHENDTC !== null);
    expect(resolved.length).toBeGreaterThan(0);
    for (const row of resolved) {
      expect(["Appendicitis", "Pneumonia"]).toContain(row.MHTERM);
      expect(String(row.MHENDTC) < String(row.MHDTC)).toBe(true);
      expect(row.MHENRTPT).toBeNull();
      expect(row.MHENTPT).toBeNull();
    }
  });

  it("collects history at the screening visit, before first dose", () => {
    for (const row of mh) {
      const screening = sv.find(
        (visit) => visit.USUBJID === row.USUBJID && visit.VISITNUM === 1
      );
      expect(row.MHDTC).toBe(screening?.SVSTDTC);
      if (row.MHDY !== null) expect(row.MHDY as number).toBeLessThan(1);
    }
  });

  it("traces each record to the collected history it came from", () => {
    const collected = rows(find("collected", "MH"));
    mh.forEach((row, index) => {
      const [source] = mhDataset.lineage![index]!;
      const record = collected.find((item) => item.SRCID === source)!;
      expect(record).toMatchObject({
        USUBJID: row.USUBJID,
        MHTERM: row.MHTERM,
        MHSTDTC: row.MHSTDTC,
      });
    });
  });
});
