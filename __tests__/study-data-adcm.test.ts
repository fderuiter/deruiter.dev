// @vitest-environment node
/**
 * ADaM ADCM (#2962): one OCCDS record per medication, with imputed analysis
 * dates, relative days, and the prior (PREFL), on-treatment (ONTRTFL) and
 * rescue (RESCUEFL) flags.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADAM_METHODS,
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

const adcmDataset = find("adam", "ADCM");
const adcm = rows(adcmDataset);
const cm = rows(find("sdtm", "CM"));

function record(subject: string, seq: number): Row {
  return adcm.find(
    (row) => row.USUBJID === `DEMO-301-${subject}` && row.ASEQ === seq
  )!;
}

describe("ADaM ADCM (#2962)", () => {
  it("has one record per CM record, in CM order", () => {
    expect(adcm.map((row) => [row.USUBJID, row.ASEQ])).toEqual(
      cm.map((row) => [row.USUBJID, row.CMSEQ])
    );
    expect(adcmDataset.class).toBe("OCCDS");
  });

  it("flags a medication started before and continued after first dose as both prior and on treatment, imputing its month-only start", () => {
    // CMSTDTC 2029-11, ongoing; first dose 2030-01-23 is 83 days later.
    expect(record("0012", 1)).toMatchObject({
      CMTRT: "Metformin",
      ASTDT: "2029-11-01",
      ASTDTF: "D",
      AENDT: null,
      ASTDY: -83,
      CMENRTPT: "ONGOING",
      PREFL: "Y",
      ONTRTFL: "Y",
      RESCUEFL: null,
      TRTSDT: "2030-01-23",
    });
  });

  it("flags a medication stopped for the washout as prior only", () => {
    // Stopped seven days before first dose (2030-01-15).
    expect(record("0008", 1)).toMatchObject({
      CMTRT: "Ramipril",
      ASTDTF: "D",
      AENDT: "2030-01-08",
      AENDTF: null,
      AENDY: -7,
      PREFL: "Y",
      ONTRTFL: null,
    });
  });

  it("flags a medication started on treatment as on treatment only, counting first dose as day 1", () => {
    // Paracetamol for an adverse event; first dose 2030-01-05.
    expect(record("0003", 2)).toMatchObject({
      ASTDT: "2030-03-31",
      ASTDTF: null,
      AENDT: "2030-04-03",
      ASTDY: 86,
      AENDY: 89,
      PREFL: null,
      ONTRTFL: "Y",
    });
  });

  it("flags rescue medication for analysis", () => {
    const rescue = adcm.filter((row) => row.RESCUEFL === "Y");
    expect(rescue.length).toBeGreaterThan(0);
    for (const row of rescue) {
      expect(row.CMCAT).toBe("RESCUE MEDICATION");
      expect(row).toMatchObject({ PREFL: null, ONTRTFL: "Y" });
    }
    expect(
      adcm.filter((row) => row.CMCAT === "RESCUE MEDICATION")
    ).toHaveLength(rescue.length);
  });

  it("gives every dosed subject's medication at least one timing flag and a never-dosed subject's none", () => {
    for (const row of adcm) {
      if (row.TRTSDT === null)
        expect(row).toMatchObject({ PREFL: null, ONTRTFL: null });
      else expect(row.PREFL === "Y" || row.ONTRTFL === "Y").toBe(true);
    }
  });

  it("cites a Define method for every derived variable", () => {
    for (const variable of adcmDataset.variables) {
      if (variable.origin !== "Derived") continue;
      expect(variable.method, variable.name).toBeDefined();
      expect(
        ADAM_METHODS[variable.method as keyof typeof ADAM_METHODS]
      ).toBeTruthy();
    }
  });

  it("passes the ADaM rules and raises no ADCM finding", () => {
    expect(
      run.findings.filter((finding) => finding.dataset === "ADCM")
    ).toEqual([]);
  });

  it("matches the seed-301 golden file", () => {
    const expected = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "__tests__/fixtures/study-data/adam/seed-301-adcm.json"
        ),
        "utf8"
      )
    );
    expect({
      rows: adcmDataset.rowCount,
      sha256: createHash("sha256")
        .update(JSON.stringify(adcmDataset))
        .digest("hex"),
    }).toEqual(expected);
  });
});
