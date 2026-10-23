import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  deriveAdamDatasets,
  runPipeline,
  type CellValue,
  type Dataset,
} from "@/lib/study-data";

type Row = Record<string, CellValue>;

function records(dataset: Dataset): Row[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][index]])
    )
  );
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function withRows(dataset: Dataset, data: readonly Row[]): Dataset {
  return {
    ...dataset,
    rowCount: data.length,
    columns: Object.fromEntries(
      dataset.variables.map(({ name }) => [
        name,
        data.map((row) => row[name] ?? null),
      ])
    ),
    lineage: data.map((_, index) => [`fixture:${dataset.name}:${index + 1}`]),
  };
}

const seedRun = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 20 });
const dosed = records(
  seedRun.datasets.find((dataset) => dataset.name === "ADSL")!
).find((row) => row.SAFFL === "Y")!;
const subject = String(dosed.USUBJID);
const firstDose = String(dosed.TRTSDT);
const templates = new Map(
  seedRun.datasets
    .filter((dataset) => dataset.layer === "sdtm")
    .map((dataset) => [dataset.name, dataset])
);

function scenario(options: {
  start?: string;
  end?: string;
  action?: string;
  disposition?: string;
  dispositionDay?: number;
  contactDay?: number;
  lastDoseDay?: number;
  noAe?: boolean;
  otherDispositionDay?: number;
}) {
  const sdtm = ["DM", "EX", "SV", "AE", "VS", "LB", "DS"].map((name) => {
    const dataset = templates.get(name)!;
    const data = records(dataset).filter((row) => row.USUBJID === subject);
    return withRows(dataset, data);
  });
  const replace = (name: string, data: Row[]) => {
    const index = sdtm.findIndex((dataset) => dataset.name === name);
    sdtm[index] = withRows(sdtm[index], data);
  };
  const ae = sdtm.find((dataset) => dataset.name === "AE")!;
  const ex = sdtm.find((dataset) => dataset.name === "EX")!;
  const ds = sdtm.find((dataset) => dataset.name === "DS")!;
  const sv = sdtm.find((dataset) => dataset.name === "SV")!;
  const blank = (dataset: Dataset): Row =>
    Object.fromEntries(dataset.variables.map(({ name }) => [name, null]));
  if (options.lastDoseDay !== undefined) {
    replace(
      "EX",
      records(ex).map((row) => ({
        ...row,
        EXENDTC: addDays(firstDose, options.lastDoseDay!),
      }))
    );
  }
  replace(
    "AE",
    options.noAe
      ? []
      : [
          {
            ...blank(ae),
            STUDYID: DEMO_301_STUDY.studyId,
            DOMAIN: "AE",
            USUBJID: subject,
            AESEQ: 1,
            AETERM: "Headache",
            AEDECOD: "Headache",
            AEBODSYS: "Nervous system disorders",
            AEACN: options.action ?? "DRUG WITHDRAWN",
            AESTDTC: options.start ?? firstDose,
            AEENDTC: options.end ?? addDays(firstDose, 2),
          },
        ]
  );
  replace("DS", [
    {
      ...blank(ds),
      STUDYID: DEMO_301_STUDY.studyId,
      DOMAIN: "DS",
      USUBJID: subject,
      DSSEQ: 1,
      DSCAT: "DISPOSITION EVENT",
      DSDECOD: options.disposition ?? "ADVERSE EVENT",
      DSSTDTC: addDays(firstDose, options.dispositionDay ?? 10),
    },
    ...(options.otherDispositionDay === undefined
      ? []
      : [
          {
            ...blank(ds),
            STUDYID: DEMO_301_STUDY.studyId,
            DOMAIN: "DS",
            USUBJID: subject,
            DSSEQ: 2,
            DSCAT: "DISPOSITION EVENT",
            DSDECOD: "WITHDRAWAL BY SUBJECT",
            DSSTDTC: addDays(firstDose, options.otherDispositionDay),
          },
        ]),
  ]);
  replace("SV", [
    {
      ...blank(sv),
      STUDYID: DEMO_301_STUDY.studyId,
      DOMAIN: "SV",
      USUBJID: subject,
      VISITNUM: 99,
      VISIT: "UNSCHEDULED",
      SVSTDTC: addDays(firstDose, options.contactDay ?? 25),
    },
  ]);
  const result = deriveAdamDatasets(DEMO_301_STUDY, sdtm);
  const get = (name: string) =>
    records(result.datasets.find((dataset) => dataset.name === name)!);
  return { result, get };
}

describe("ADAE and ADTTE", () => {
  it("matches the seed-301 golden file", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    const expected = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "__tests__/fixtures/study-data/adam/seed-301-events.json"
        ),
        "utf8"
      )
    );
    const actual = Object.fromEntries(
      ["ADAE", "ADTTE"].map((name) => {
        const dataset = run.datasets.find(
          (value) => value.name === name && value.layer === "adam"
        )!;
        return [
          name,
          {
            rows: dataset.rowCount,
            sha256: createHash("sha256")
              .update(JSON.stringify(dataset))
              .digest("hex"),
          },
        ];
      })
    );
    expect(actual).toEqual(expected);
  });

  it("counts a same-day AE with corroborated withdrawal as an event on day 1", () => {
    const { get } = scenario({ start: firstDose });
    expect(get("ADAE")[0]).toMatchObject({
      TRTEMFL: "Y",
      AOCCFL: "Y",
      ASTDT: firstDose,
      ASTDTF: null,
    });
    expect(get("ADTTE")[0]).toMatchObject({
      CNSR: 0,
      AVAL: 1,
      ADT: firstDose,
      SRCDOM: "AE",
      SRCSEQ: 1,
      DSSEQ: 1,
    });
  });

  it("does not count an AE starting before first dose", () => {
    const { result, get } = scenario({ start: addDays(firstDose, -1) });
    expect(get("ADAE")[0].TRTEMFL).toBe("N");
    expect(get("ADTTE")[0].CNSR).toBe(1);
    expect(
      result.findings.some((finding) => finding.ruleId === "DEMO301-TTE-LINK")
    ).toBe(true);
  });

  it("includes the last safety-window day and excludes the next day", () => {
    const lastDay = scenario({
      start: addDays(firstDose, 24),
      end: addDays(firstDose, 25),
      lastDoseDay: 10,
      contactDay: 40,
      dispositionDay: 30,
    });
    const nextDay = scenario({
      start: addDays(firstDose, 25),
      end: addDays(firstDose, 26),
      lastDoseDay: 10,
      contactDay: 40,
      dispositionDay: 30,
    });
    expect(lastDay.get("ADAE")[0].TRTEMFL).toBe("Y");
    expect(nextDay.get("ADAE")[0].TRTEMFL).toBe("N");
  });

  it("imputes month-only start and end dates and caps the end at last contact", () => {
    const { get } = scenario({
      start: firstDose.slice(0, 7),
      end: firstDose.slice(0, 7),
      contactDay: 19,
      disposition: "COMPLETED",
      dispositionDay: 10,
    });
    expect(get("ADAE")[0]).toMatchObject({
      ASTDT: firstDose,
      ASTDTF: "D",
      AENDT: addDays(firstDose, 19),
      AENDTF: "D",
      TRTEMFL: "Y",
    });
  });

  it("reports an impossible imputed interval and leaves analysis end missing", () => {
    const { result, get } = scenario({
      start: addDays(firstDose, 20),
      end: firstDose.slice(0, 7),
      contactDay: 5,
    });
    expect(get("ADAE")[0].AENDT).toBeNull();
    expect(
      result.findings.some((finding) => finding.ruleId === "DEMO301-AE-DATE")
    ).toBe(true);
  });

  it("censors at competing discontinuation rather than later contact", () => {
    const { get } = scenario({
      noAe: true,
      disposition: "WITHDRAWAL BY SUBJECT",
      dispositionDay: 10,
      contactDay: 25,
    });
    expect(get("ADTTE")[0]).toMatchObject({
      CNSR: 1,
      ADT: addDays(firstDose, 10),
      AVAL: 11,
      SRCDOM: "DS",
      SRCSEQ: 1,
      CNSDTDSC: "Discontinuation for another reason",
    });
  });

  it("censors before a later corroborated event but counts a same-day event", () => {
    const earlier = scenario({
      start: addDays(firstDose, 10),
      end: addDays(firstDose, 11),
      dispositionDay: 12,
      otherDispositionDay: 5,
    });
    const sameDay = scenario({
      start: addDays(firstDose, 10),
      end: addDays(firstDose, 11),
      dispositionDay: 10,
      otherDispositionDay: 10,
    });
    expect(earlier.get("ADTTE")[0]).toMatchObject({
      CNSR: 1,
      AVAL: 6,
      SRCDOM: "DS",
      SRCSEQ: 2,
    });
    expect(sameDay.get("ADTTE")[0]).toMatchObject({
      CNSR: 0,
      AVAL: 11,
      SRCDOM: "AE",
      DSSEQ: 1,
    });
  });

  it("censors at last contact and identifies an SV record with its visit key", () => {
    const { get } = scenario({
      noAe: true,
      disposition: "COMPLETED",
      dispositionDay: 10,
      contactDay: 25,
    });
    expect(get("ADTTE")[0]).toMatchObject({
      CNSR: 1,
      ADT: addDays(firstDose, 25),
      AVAL: 26,
      SRCDOM: "SV",
      SRCVAR: "VISITNUM",
      SRCSEQ: null,
      SRCVAL: 99,
    });
  });
});
