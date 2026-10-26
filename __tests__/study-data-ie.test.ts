// @vitest-environment node
/**
 * SDTM IE (#2964): the eligibility criteria a screen failure did not meet,
 * keyed to TI. Each failed criterion is visible in the subject's own
 * screening data, and an enrolled subject has no IE record.
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

const ieDataset = find("sdtm", "IE");
const ie = rows(ieDataset);
const ti = rows(find("sdtm", "TI"));
const dm = rows(find("sdtm", "DM"));
const ds = rows(find("sdtm", "DS"));
const sv = rows(find("sdtm", "SV"));
const vs = rows(find("sdtm", "VS"));
const lb = rows(find("sdtm", "LB"));

const screenFailures = ds
  .filter((row) => row.DSDECOD === "SCREEN FAILURE")
  .map((row) => row.USUBJID);

/** The subject's one screening result for a test. */
function screening(findings: Row[], prefix: string, subject: CellValue) {
  const row = findings.find(
    (item) =>
      item.USUBJID === subject &&
      item.VISITNUM === 1 &&
      item[`${prefix}TESTCD`] === (prefix === "VS" ? "SYSBP" : "CREAT")
  );
  return Number(row?.[`${prefix}STRESN`]);
}

/** CKD-EPI 2021 eGFR, creatinine in umol/L. */
function egfr(creatinine: number, age: number, sex: CellValue): number {
  const scr = creatinine / 88.4;
  const female = sex === "F";
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  return (
    142 *
    Math.min(scr / kappa, 1) ** alpha *
    Math.max(scr / kappa, 1) ** -1.2 *
    0.9938 ** age *
    (female ? 1.012 : 1)
  );
}

describe("SDTM IE (#2964)", () => {
  it("records at least one criterion for every screen failure and none for enrolled subjects", () => {
    expect(screenFailures.length).toBeGreaterThan(0);
    expect(new Set(ie.map((row) => row.USUBJID))).toEqual(
      new Set(screenFailures)
    );
  });

  it("resolves every criterion to TI, with the result its category implies", () => {
    const byCode = new Map(ti.map((row) => [row.IETESTCD, row]));
    for (const row of ie) {
      const criterion = byCode.get(row.IETESTCD);
      expect(criterion, String(row.IETESTCD)).toBeDefined();
      expect(row.IETEST).toBe(criterion!.IETEST);
      expect(row.IECAT).toBe(criterion!.IECAT);
      expect(row.IEORRES).toBe(row.IECAT === "INCLUSION" ? "N" : "Y");
      expect(row.IESTRESC).toBe(row.IEORRES);
    }
    expect(new Set(ie.map((row) => row.IETESTCD)).size).toBe(ti.length);
  });

  it("shows each failed criterion in the subject's screening data", () => {
    for (const row of ie) {
      const subject = dm.find((item) => item.USUBJID === row.USUBJID)!;
      const age = Number(subject.AGE);
      if (row.IETESTCD === "INC01") expect(age).toBeGreaterThan(75);
      if (row.IETESTCD === "INC02") {
        const systolic = screening(vs, "VS", row.USUBJID);
        expect(systolic < 140 || systolic > 159, String(systolic)).toBe(true);
      }
      if (row.IETESTCD === "EXC01")
        expect(
          egfr(screening(lb, "LB", row.USUBJID), age, subject.SEX)
        ).toBeLessThan(45);
    }
  });

  it("collects eligibility at the screening visit, in the screening epoch", () => {
    for (const row of ie) {
      const visit = sv.find(
        (item) => item.USUBJID === row.USUBJID && item.VISITNUM === 1
      );
      expect(row).toMatchObject({
        VISITNUM: 1,
        VISIT: "SCREENING",
        EPOCH: "SCREENING",
        IEDTC: visit?.SVSTDTC,
      });
    }
  });

  it("numbers each subject's records from 1", () => {
    const counts = new Map<CellValue, number>();
    for (const row of ie) {
      const next = (counts.get(row.USUBJID) ?? 0) + 1;
      counts.set(row.USUBJID, next);
      expect(row.IESEQ).toBe(next);
    }
  });

  it("traces each record to the collected eligibility record it came from", () => {
    const collected = rows(find("collected", "IE"));
    ie.forEach((row, index) => {
      const [source] = ieDataset.lineage![index]!;
      expect(collected.find((item) => item.SRCID === source)).toMatchObject({
        USUBJID: row.USUBJID,
        IETESTCD: row.IETESTCD,
        IECAT: row.IECAT,
      });
    });
  });

  it("passes the IE conformance rules", () => {
    expect(run.findings.filter((finding) => finding.dataset === "IE")).toEqual(
      []
    );
  });
});
