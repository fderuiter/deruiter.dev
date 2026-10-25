import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  deriveAdamDatasets,
  runPipeline,
  type CellValue,
  type Dataset,
  type StudyDefinition,
} from "@/lib/study-data";

// #2607: hand-built SDTM for the derivation edges the seeded study rarely
// produces: baseline and analysis-visit ties, age-group boundaries, LOCF
// ordering, repeat AE occurrences, partial dates and censoring before
// first dose.

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

const templates = new Map(
  runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 4 })
    .datasets.filter((dataset) => dataset.layer === "sdtm")
    .map((dataset) => [dataset.name, dataset])
);
const FIRST_DOSE = "2030-01-10";
const SUBJECT = "DEMO-301-9001";

function blank(name: string): Row {
  return Object.fromEntries(
    templates.get(name)!.variables.map(({ name: variable }) => [variable, null])
  );
}

function dm(overrides: Row = {}): Row {
  return {
    ...blank("DM"),
    STUDYID: DEMO_301_STUDY.studyId,
    DOMAIN: "DM",
    USUBJID: SUBJECT,
    AGE: 50,
    SEX: "F",
    ARMCD: "DMX10",
    ARM: "Demoxacin 10 mg",
    ...overrides,
  };
}

function ex(overrides: Row = {}): Row {
  return {
    ...blank("EX"),
    STUDYID: DEMO_301_STUDY.studyId,
    DOMAIN: "EX",
    USUBJID: SUBJECT,
    EXSEQ: 1,
    EXTRT: "Demoxacin 10 mg",
    EXSTDTC: FIRST_DOSE,
    EXENDTC: addDays(FIRST_DOSE, 83),
    ...overrides,
  };
}

function vs(seq: number, day: number, value: number, overrides: Row = {}) {
  return {
    ...blank("VS"),
    STUDYID: DEMO_301_STUDY.studyId,
    DOMAIN: "VS",
    USUBJID: SUBJECT,
    VSSEQ: seq,
    VSTESTCD: "SYSBP",
    VSTEST: "Systolic Blood Pressure",
    VSSTRESN: value,
    VSSTRESU: "mmHg",
    VSDTC: addDays(FIRST_DOSE, day),
    VISIT: day < 0 ? "SCREENING" : "WEEK 2",
    ...overrides,
  };
}

function ae(seq: number, overrides: Row = {}): Row {
  return {
    ...blank("AE"),
    STUDYID: DEMO_301_STUDY.studyId,
    DOMAIN: "AE",
    USUBJID: SUBJECT,
    AESEQ: seq,
    AETERM: "Headache",
    AEDECOD: "Headache",
    AEBODSYS: "Nervous system disorders",
    AEACN: "DOSE NOT CHANGED",
    AESTDTC: addDays(FIRST_DOSE, 3),
    AEENDTC: addDays(FIRST_DOSE, 4),
    ...overrides,
  };
}

function ds(seq: number, decod: string, day: number): Row {
  return {
    ...blank("DS"),
    STUDYID: DEMO_301_STUDY.studyId,
    DOMAIN: "DS",
    USUBJID: SUBJECT,
    DSSEQ: seq,
    DSCAT: "DISPOSITION EVENT",
    DSDECOD: decod,
    DSSTDTC: addDays(FIRST_DOSE, day),
  };
}

function sv(visitNum: number, day: number): Row {
  return {
    ...blank("SV"),
    STUDYID: DEMO_301_STUDY.studyId,
    DOMAIN: "SV",
    USUBJID: SUBJECT,
    VISITNUM: visitNum,
    VISIT: "UNSCHEDULED",
    SVSTDTC: addDays(FIRST_DOSE, day),
  };
}

function derive(
  data: Partial<Record<"DM" | "EX" | "VS" | "LB" | "AE" | "DS" | "SV", Row[]>>,
  definition: StudyDefinition = DEMO_301_STUDY
) {
  const sdtm = (["DM", "EX", "SV", "AE", "VS", "LB", "DS"] as const).map(
    (name) =>
      withRows(
        templates.get(name)!,
        data[name] ?? (name === "DM" ? [dm()] : name === "EX" ? [ex()] : [])
      )
  );
  const result = deriveAdamDatasets(definition, sdtm);
  const get = (name: string) =>
    records(result.datasets.find((dataset) => dataset.name === name)!);
  return { result, get };
}

describe("ADSL edges (#2607)", () => {
  it.each([
    [39, "<40", 1],
    [40, "40-64", 2],
    [64, "40-64", 2],
    [65, "65+", 3],
    [null, null, null],
  ])("groups age %s as %s", (age, group, groupNumber) => {
    const [row] = derive({ DM: [dm({ AGE: age })] }).get("ADSL");
    expect(row).toMatchObject({ AGEGR1: group, AGEGR1N: groupNumber });
  });

  it("prefers the BASELINE visit, then the lower sequence, on the latest pre-dose date", () => {
    const sameDate = addDays(FIRST_DOSE, -2);
    const { get } = derive({
      VS: [
        vs(1, -5, 150),
        vs(2, -2, 140, { VSDTC: sameDate }),
        vs(3, -2, 130, { VSDTC: sameDate, VISIT: "BASELINE" }),
        vs(4, 0, 120, { VISIT: "BASELINE" }),
        vs(5, 0, 110),
        vs(6, 14, 125),
      ],
    });
    // Day 0 here is first dose: a BASELINE record on that day counts,
    // any other visit on that day does not.
    expect(get("ADSL")[0].BSYSBP).toBe(120);
    const withoutDoseDay = derive({
      VS: [
        vs(2, -2, 140, { VSDTC: sameDate }),
        vs(3, -2, 130, { VSDTC: sameDate, VISIT: "BASELINE" }),
        vs(5, 0, 110),
        vs(6, 14, 125),
      ],
    });
    expect(withoutDoseDay.get("ADSL")[0].BSYSBP).toBe(130);
    const lowerSequence = derive({
      VS: [
        vs(7, -2, 140, { VSDTC: sameDate }),
        vs(3, -2, 135, { VSDTC: sameDate }),
        vs(6, 14, 125),
      ],
    });
    expect(lowerSequence.get("ADSL")[0].BSYSBP).toBe(135);
    expect(
      lowerSequence
        .get("ADVS")
        .filter((row) => row.ABLFL === "Y")
        .map((row) => row.SRCSEQ)
    ).toEqual([3]);
  });

  it("ignores pre-dose records with no result or no date when choosing a baseline", () => {
    const { get } = derive({
      VS: [
        vs(1, -6, 150),
        vs(2, -3, null as unknown as number, { VSSTRESN: null }),
        vs(3, -1, 140, { VSDTC: null }),
        vs(4, 14, 125),
      ],
    });
    expect(get("ADSL")[0]).toMatchObject({ BSYSBP: 150, EFFFL: "Y" });
  });

  it("leaves numeric treatment codes missing for an arm or treatment outside the design", () => {
    const [row] = derive({
      DM: [dm({ ARMCD: "OTHER", ARM: "Other arm" })],
      EX: [ex({ EXTRT: "Rescue medication" })],
    }).get("ADSL");
    expect(row).toMatchObject({
      TRT01P: "Other arm",
      TRT01PN: null,
      TRT01A: "Rescue medication",
      TRT01AN: null,
      SAFFL: "Y",
    });
  });

  it("takes first dose from the earliest dated exposure and last dose from the latest end", () => {
    const [row] = derive({
      EX: [
        ex({ EXSEQ: 2, EXSTDTC: addDays(FIRST_DOSE, 30), EXENDTC: null }),
        ex({ EXSEQ: 3, EXSTDTC: null, EXENDTC: addDays(FIRST_DOSE, 90) }),
        ex({ EXSEQ: 1, EXENDTC: addDays(FIRST_DOSE, 29) }),
      ],
    }).get("ADSL");
    expect(row).toMatchObject({
      TRTSDT: FIRST_DOSE,
      TRTEDT: addDays(FIRST_DOSE, 90),
    });
  });

  it("derives end-of-study status from the disposition event", () => {
    const status = (decod: string) =>
      derive({ DS: [ds(1, decod, 90)] }).get("ADSL")[0];
    expect(status("COMPLETED")).toMatchObject({
      EOSSTT: "COMPLETED",
      DCSREAS: null,
    });
    expect(status("SCREEN FAILURE")).toMatchObject({
      EOSSTT: "SCREEN FAILURE",
      DCSREAS: null,
    });
    expect(status("LOST TO FOLLOW-UP")).toMatchObject({
      EOSSTT: "DISCONTINUED",
      DCSREAS: "LOST TO FOLLOW-UP",
    });
    expect(derive({}).get("ADSL")[0]).toMatchObject({
      EOSSTT: null,
      DCSREAS: null,
    });
  });

  it("dates a death from DM.DTHDTC only when it is a full date (#2787)", () => {
    const death = (DTHDTC: CellValue) =>
      derive({ DM: [dm({ DTHDTC, DTHFL: DTHDTC ? "Y" : null })] }).get(
        "ADSL"
      )[0].DTHDT;
    expect(death(addDays(FIRST_DOSE, 40))).toBe(addDays(FIRST_DOSE, 40));
    // ADaMIG 1.3 would impute a partial date and flag it in DTHDTF; the
    // pipeline does not impute, so the date stays missing.
    expect(death("2030-02")).toBeNull();
    expect(death(null)).toBeNull();
  });
});

describe("ADVS edges (#2607)", () => {
  it("flags the record nearest the target day, then the earlier date, then the lower sequence", () => {
    // WEEK 2 targets study day 15 with a window of 12 to 18; offsets are
    // from first dose, so offset 14 is study day 15.
    const { get } = derive({
      VS: [
        vs(1, -3, 150),
        vs(2, 12, 131),
        vs(3, 16, 129),
        vs(4, 16, 128),
        vs(5, 11, 160),
      ],
    });
    const week2 = get("ADVS").filter((row) => row.AVISIT === "WEEK 2");
    expect(
      week2.filter((row) => row.ANL01FL === "Y").map((row) => row.SRCSEQ)
    ).toEqual([2]);
    const later = derive({
      VS: [vs(1, -3, 150), vs(4, 15, 128), vs(3, 15, 129)],
    });
    expect(
      later
        .get("ADVS")
        .filter((row) => row.ANL01FL === "Y" && row.AVISIT === "WEEK 2")
        .map((row) => row.SRCSEQ)
    ).toEqual([3]);
  });

  it("assigns an observation in overlapping windows to the nearer, then earlier, visit", () => {
    const definition: StudyDefinition = {
      ...DEMO_301_STUDY,
      design: {
        ...DEMO_301_STUDY.design,
        visits: DEMO_301_STUDY.design.visits.map((visit) =>
          visit.name === "WEEK 2" || visit.name === "WEEK 4"
            ? { ...visit, windowBefore: 10, windowAfter: 10 }
            : visit
        ),
      },
    };
    // Study day 22 is 7 days from both WEEK 2 (15) and WEEK 4 (29).
    const tie = derive({ VS: [vs(1, -3, 150), vs(2, 21, 130)] }, definition);
    expect(tie.get("ADVS").find((row) => row.SRCSEQ === 2)).toMatchObject({
      AVISIT: "WEEK 2",
      ADY: 22,
    });
    const nearer = derive({ VS: [vs(1, -3, 150), vs(2, 23, 130)] }, definition);
    expect(nearer.get("ADVS").find((row) => row.SRCSEQ === 2)).toMatchObject({
      AVISIT: "WEEK 4",
      ADY: 24,
    });
  });

  it("carries the latest earlier result forward, the higher sequence on a tie, after observed rows", () => {
    const { get } = derive({
      VS: [vs(1, -3, 150), vs(2, 14, 131), vs(3, 30, 129), vs(4, 30, 127)],
    });
    const advs = get("ADVS");
    const week8 = advs.filter((row) => row.AVISIT === "WEEK 8");
    expect(week8).toHaveLength(1);
    expect(week8[0]).toMatchObject({ DTYPE: "LOCF", SRCSEQ: 4, AVAL: 127 });
    const week4 = advs.filter((row) => row.AVISIT === "WEEK 4");
    expect(week4.map((row) => row.DTYPE)).toEqual([null, null]);
    expect(advs.map((row) => row.ASEQ)).toEqual(
      advs.map((_, index) => index + 1)
    );
  });

  it("defaults population flags for a subject missing from ADSL and skips unidentified rows", () => {
    const { get } = derive({
      VS: [
        vs(1, -3, 150, { USUBJID: "DEMO-301-9999" }),
        vs(2, -3, 140, { USUBJID: null }),
      ],
    });
    const advs = get("ADVS");
    expect(advs).toHaveLength(1);
    expect(advs[0]).toMatchObject({
      USUBJID: "DEMO-301-9999",
      TRT01P: null,
      TRT01A: null,
      SAFFL: "N",
      ITTFL: "N",
      EFFFL: "N",
      ADY: null,
      AVISIT: "UNSCHEDULED",
      AVISITN: 99,
    });
  });
});

describe("ADAE edges (#2607)", () => {
  it("flags only the first treatment-emergent occurrence per subject, SOC and term", () => {
    const { get } = derive({
      AE: [
        ae(2, { AESTDTC: addDays(FIRST_DOSE, 5) }),
        ae(1),
        ae(3, {
          AESTDTC: addDays(FIRST_DOSE, 5),
          AEDECOD: "Migraine",
          AETERM: "Migraine",
        }),
        ae(4, { AESTDTC: addDays(FIRST_DOSE, -2) }),
      ],
      SV: [sv(3, 20)],
    });
    const flags = Object.fromEntries(
      get("ADAE").map((row) => [
        row.ASEQ,
        [row.TRTEMFL, row.AOCCFL, row.AOCCSFL, row.AOCCPFL],
      ])
    );
    expect(flags).toEqual({
      1: ["Y", "Y", "Y", "Y"],
      2: ["Y", null, null, null],
      3: ["Y", null, null, "Y"],
      4: ["N", null, null, null],
    });
  });

  it("leaves unusable partial dates missing and imputes a month end before last contact", () => {
    const month = addDays(FIRST_DOSE, 0).slice(0, 7);
    const { get } = derive({
      AE: [
        ae(1, { AESTDTC: "2030", AEENDTC: `${month.slice(0, 5)}13` }),
        ae(2, { AESTDTC: "", AEENDTC: month }),
      ],
      SV: [sv(3, 60)],
    });
    const [yearOnly, empty] = get("ADAE");
    expect(yearOnly).toMatchObject({
      ASTDT: null,
      ASTDTF: null,
      AENDT: null,
      AENDTF: null,
      TRTEMFL: "N",
    });
    expect(empty).toMatchObject({
      ASTDT: null,
      AENDT: "2030-01-31",
      AENDTF: "D",
    });
  });

  it("imputes a month-only start to the first of the month when first dose is in another month", () => {
    const [row] = derive({
      AE: [ae(1, { AESTDTC: "2030-02", AEENDTC: null })],
      SV: [sv(3, 60)],
    }).get("ADAE");
    expect(row).toMatchObject({
      ASTDT: "2030-02-01",
      ASTDTF: "D",
      AENDT: null,
      TRTEMFL: "Y",
    });
  });

  it("defaults treatment and population for an AE of a subject missing from ADSL", () => {
    const { get } = derive({
      AE: [ae(1, { USUBJID: "DEMO-301-9999", AEBODSYS: null, AEDECOD: null })],
    });
    expect(get("ADAE")[0]).toMatchObject({
      USUBJID: "DEMO-301-9999",
      TRT01P: null,
      TRT01A: null,
      SAFFL: "N",
      ITTFL: "N",
      TRTEMFL: "N",
    });
  });

  it("flags an uncoded emergent AE as its own SOC and term", () => {
    const { get } = derive({
      AE: [ae(1, { AEBODSYS: null, AEDECOD: null }), ae(2)],
      SV: [sv(3, 20)],
    });
    expect(
      get("ADAE").map((row) => [row.AOCCFL, row.AOCCSFL, row.AOCCPFL])
    ).toEqual([
      ["Y", "Y", "Y"],
      [null, "Y", "Y"],
    ]);
  });

  it("treats a subject with no exposure as never emergent", () => {
    const [row] = derive({ EX: [], AE: [ae(1)] }).get("ADAE");
    expect(row).toMatchObject({
      TRTEMFL: "N",
      TRTSDT: null,
      TRTEDT: null,
      SAFFL: "N",
      LSTALVDT: null,
    });
  });
});

describe("ADTTE edges (#2607)", () => {
  it("prefers a disposition contact over a visit on the same day", () => {
    const [row] = derive({
      DS: [ds(1, "COMPLETED", 40)],
      SV: [sv(6, 40), sv(5, 30)],
    }).get("ADTTE");
    expect(row).toMatchObject({
      CNSR: 1,
      SRCDOM: "DS",
      SRCVAR: "DSSEQ",
      SRCSEQ: 1,
      AVAL: 41,
    });
  });

  it("clamps a censoring date before first dose to the start date", () => {
    const [row] = derive({ SV: [sv(1, -5)] }).get("ADTTE");
    expect(row).toMatchObject({
      CNSR: 1,
      ADT: FIRST_DOSE,
      AVAL: 1,
      SRCDOM: "SV",
    });
  });

  it("leaves the analysis date missing when a dosed subject has no contact at all", () => {
    const [row] = derive({}).get("ADTTE");
    expect(row).toMatchObject({
      CNSR: 1,
      ADT: null,
      AVAL: null,
      SRCDOM: "DS",
      SRCVAR: "DSSTDTC",
      SRCSEQ: null,
      SRCVAL: null,
      CNSDTDSC: "Last known study contact",
    });
  });

  it("uses the earliest competing discontinuation when there are several", () => {
    const [row] = derive({
      DS: [ds(2, "LOST TO FOLLOW-UP", 30), ds(1, "WITHDRAWAL BY SUBJECT", 20)],
      SV: [sv(6, 45)],
    }).get("ADTTE");
    expect(row).toMatchObject({
      CNSR: 1,
      ADT: addDays(FIRST_DOSE, 20),
      SRCSEQ: 1,
      CNSDTDSC: "Discontinuation for another reason",
    });
  });

  it("takes the earliest corroborated withdrawal AE, the lower sequence on a tie", () => {
    const withdrawn = { AEACN: "DRUG WITHDRAWN" };
    const { get } = derive({
      AE: [
        ae(3, { ...withdrawn, AESTDTC: addDays(FIRST_DOSE, 8) }),
        ae(2, { ...withdrawn, AESTDTC: addDays(FIRST_DOSE, 6) }),
        ae(1, { ...withdrawn, AESTDTC: addDays(FIRST_DOSE, 6) }),
      ],
      DS: [ds(1, "ADVERSE EVENT", 9)],
      SV: [sv(4, 9)],
    });
    expect(get("ADTTE")[0]).toMatchObject({
      CNSR: 0,
      SRCDOM: "AE",
      SRCSEQ: 1,
      AVAL: 7,
      DSSEQ: 1,
    });
  });

  it("ignores undated visits and disposition records with no decode or date", () => {
    const [row] = derive({
      DS: [
        { ...ds(2, "WITHDRAWAL BY SUBJECT", 0), DSSTDTC: null },
        { ...ds(3, "COMPLETED", 0), DSDECOD: null, DSSTDTC: null },
        ds(1, "LOST TO FOLLOW-UP", 30),
      ],
      SV: [{ ...sv(5, 0), SVSTDTC: null }, sv(4, 25)],
    }).get("ADTTE");
    expect(row).toMatchObject({
      CNSR: 1,
      ADT: addDays(FIRST_DOSE, 30),
      SRCDOM: "DS",
      SRCSEQ: 1,
      CNSDTDSC: "Discontinuation for another reason",
    });
  });

  it("does not create a row for a subject who was never dosed", () => {
    expect(derive({ EX: [] }).get("ADTTE")).toEqual([]);
  });
});
