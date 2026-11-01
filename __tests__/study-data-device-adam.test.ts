import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  buildDefine,
  checkDefineParity,
  deriveAdamDatasets,
  prepareStudyHandoff,
  runPipeline,
  valueListOid,
  type CellValue,
  type Dataset,
} from "@/lib/study-data";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";

/**
 * Device ADaM (#3420). The TAVR versus SAVR study's hierarchical composite
 * is death, disabling stroke, valve-related or heart-failure
 * rehospitalisation, then the change in the VSFS overall summary score at
 * 1 year, each time censored at 365 days. ADTTE, ADQS and ADHCE follow the
 * study's own hierarchy spec, selected by its endpoint ids, while DEMO-301
 * keeps its spec and its ADaM output byte for byte.
 */

type Row = Record<string, CellValue>;

function records(dataset: Dataset | undefined): Row[] {
  if (!dataset) return [];
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

function blank(dataset: Dataset): Row {
  return Object.fromEntries(
    dataset.variables.map(({ name }) => [name, null])
  ) as Row;
}

const device = prepareStudyHandoff(TAVR_SAVR_USDM).definition;
const seedRun = runPipeline(device, { seed: 3420, nSubjects: 12 });
const adsl = records(
  seedRun.datasets.find(
    (dataset) => dataset.layer === "adam" && dataset.name === "ADSL"
  )
);
const enrolled = adsl.find((row) => row.ITTFL === "Y")!;
const subject = String(enrolled.USUBJID);
/** The index procedure: ADaM day 1. */
const day1 = String(enrolled.TRTSDT);
/** The ISO date of ADaM day `day`, where day 1 is the index procedure. */
const onDay = (day: number) => addDays(day1, day > 0 ? day - 1 : day);
const templates = new Map(
  seedRun.datasets
    .filter((dataset) => dataset.layer === "sdtm")
    .map((dataset) => [dataset.name, dataset])
);

const VISITS = {
  screening: {
    VISITNUM: 1,
    VISIT: "Screening & Baseline Evaluation (Day -30 to -1)",
  },
  day30: { VISITNUM: 4, VISIT: "30-Day Follow-up" },
  year1: { VISITNUM: 6, VISIT: "1-Year Primary Endpoint Visit" },
} as const;

/**
 * The seeded study with one subject's SDTM: its own DM and EX, and the
 * clinical events, death, contacts and scores a case gives, on ADaM days.
 */
function scenario(options: {
  events?: readonly { decod: string; day: number }[];
  deathDay?: number;
  contactDay: number;
  scores: readonly { visit: keyof typeof VISITS; day: number; score: number }[];
}) {
  const sdtm = [...templates.values()].map((dataset) => {
    const own = records(dataset).filter((row) => row.USUBJID === subject);
    return withRows(dataset, own);
  });
  const replace = (name: string, data: readonly Row[]) => {
    const at = sdtm.findIndex((dataset) => dataset.name === name);
    sdtm[at] = withRows(templates.get(name)!, data);
  };
  const of = (name: string, row: Row): Row => ({
    ...blank(templates.get(name)!),
    STUDYID: device.studyId,
    DOMAIN: name,
    USUBJID: subject,
    ...row,
  });
  const dm = records(sdtm.find((dataset) => dataset.name === "DM"));
  replace("DM", [
    {
      ...dm[0],
      DTHDTC: options.deathDay === undefined ? null : onDay(options.deathDay),
      DTHFL: options.deathDay === undefined ? null : "Y",
    },
  ]);
  replace(
    "CE",
    (options.events ?? []).map(({ decod, day }, index) =>
      of("CE", {
        CESEQ: index + 1,
        CETERM: decod,
        CEDECOD: decod,
        CECAT: "CLINICAL EVENTS COMMITTEE ADJUDICATED",
        CESTDTC: onDay(day),
      })
    )
  );
  replace("DS", [
    of("DS", {
      DSSEQ: 1,
      DSCAT: "DISPOSITION EVENT",
      DSDECOD: options.deathDay === undefined ? "COMPLETED" : "DEATH",
      DSTERM: options.deathDay === undefined ? "COMPLETED" : "DEATH",
      DSSTDTC: onDay(options.deathDay ?? options.contactDay),
    }),
  ]);
  replace("SV", [
    of("SV", {
      VISITNUM: 99,
      VISIT: "UNSCHEDULED",
      SVSTDTC: onDay(options.contactDay),
    }),
  ]);
  replace(
    "QS",
    options.scores.map(({ visit, day, score }, index) =>
      of("QS", {
        QSSEQ: index + 1,
        QSTESTCD: "VSFSOS",
        QSTEST: "VSFS Overall Summary Score",
        QSCAT: "VSFS",
        QSORRES: String(score),
        QSSTRESC: String(score),
        QSSTRESN: score,
        ...VISITS[visit],
        QSDTC: onDay(day),
      })
    )
  );
  const result = deriveAdamDatasets(device, sdtm);
  const get = (name: string) =>
    records(result.datasets.find((dataset) => dataset.name === name));
  const pick = (name: string, columns: readonly string[]) =>
    get(name).map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column]]))
    );
  return { result, get, pick };
}

const TTE = [
  "PARAMCD",
  "ADT",
  "AVAL",
  "CNSR",
  "EVNTDESC",
  "CNSDTDSC",
  "SRCDOM",
  "SRCSEQ",
];
const HCE = [
  "PARAMCD",
  "PARAMN",
  "ADT",
  "AVAL",
  "AVALU",
  "CNSR",
  "ANL01FL",
  "SRCDOM",
];

describe("a subject with a stroke, a late rehospitalisation and a 1-year score", () => {
  const { get, pick } = scenario({
    events: [
      // Before the procedure: not an event of the endpoint.
      { decod: "DISABLING STROKE", day: -5 },
      { decod: "DISABLING STROKE", day: 69 },
      { decod: "DISABLING STROKE", day: 200 },
      // Day 400 is after the 1-year follow-up.
      { decod: "REHOSPITALISATION", day: 400 },
    ],
    contactDay: 386,
    scores: [
      { visit: "screening", day: -3, score: 50 },
      { visit: "day30", day: 30, score: 64 },
      { visit: "year1", day: 381, score: 71 },
    ],
  });

  it("derives ADTTE from CE and DS, censored at day 365", () => {
    expect(pick("ADTTE", TTE)).toEqual([
      {
        PARAMCD: "TTADISC",
        ADT: onDay(386),
        AVAL: 386,
        CNSR: 1,
        EVNTDESC: "Censored",
        CNSDTDSC: "Last known study contact",
        SRCDOM: "DS",
        SRCSEQ: 1,
      },
      {
        PARAMCD: "TTDTH",
        ADT: onDay(365),
        AVAL: 365,
        CNSR: 1,
        EVNTDESC: "Censored",
        CNSDTDSC: "End of 365-day follow-up",
        SRCDOM: "DS",
        SRCSEQ: 1,
      },
      {
        PARAMCD: "TTSTROKE",
        ADT: onDay(69),
        AVAL: 69,
        CNSR: 0,
        EVNTDESC: "First adjudicated disabling stroke",
        CNSDTDSC: null,
        SRCDOM: "CE",
        SRCSEQ: 2,
      },
      {
        PARAMCD: "TTREHOSP",
        ADT: onDay(365),
        AVAL: 365,
        CNSR: 1,
        EVNTDESC: "Censored",
        CNSDTDSC: "End of 365-day follow-up",
        SRCDOM: "DS",
        SRCSEQ: 1,
      },
    ]);
  });

  it("derives ADQS VSFSOS with BASE and CHG", () => {
    expect(
      pick("ADQS", [
        "PARAMCD",
        "AVISIT",
        "ADY",
        "AVAL",
        "ABLFL",
        "BASE",
        "CHG",
        "ANL01FL",
        "DTYPE",
      ])
    ).toEqual([
      {
        PARAMCD: "VSFSOS",
        AVISIT: VISITS.screening.VISIT,
        ADY: -3,
        AVAL: 50,
        ABLFL: "Y",
        BASE: 50,
        CHG: 0,
        ANL01FL: "Y",
        DTYPE: null,
      },
      {
        PARAMCD: "VSFSOS",
        AVISIT: VISITS.day30.VISIT,
        ADY: 30,
        AVAL: 64,
        ABLFL: null,
        BASE: 50,
        CHG: 14,
        ANL01FL: "Y",
        DTYPE: null,
      },
      // No 6-month score: carried forward from day 30, not for analysis.
      {
        PARAMCD: "VSFSOS",
        AVISIT: "6-Month Hemodynamic Follow-up",
        ADY: 30,
        AVAL: 64,
        ABLFL: null,
        BASE: 50,
        CHG: 14,
        ANL01FL: null,
        DTYPE: "LOCF",
      },
      {
        PARAMCD: "VSFSOS",
        AVISIT: VISITS.year1.VISIT,
        ADY: 381,
        AVAL: 71,
        ABLFL: null,
        BASE: 50,
        CHG: 21,
        ANL01FL: "Y",
        DTYPE: null,
      },
    ]);
    expect(get("ADQS")[0]).not.toHaveProperty("AVALU");
  });

  it("records the device hierarchy in ADHCE", () => {
    expect(pick("ADHCE", HCE)).toEqual([
      {
        PARAMCD: "HCEDTH",
        PARAMN: 1,
        ADT: onDay(365),
        AVAL: 365,
        AVALU: "DAYS",
        CNSR: 1,
        ANL01FL: "Y",
        SRCDOM: "DS",
      },
      {
        PARAMCD: "HCESTRK",
        PARAMN: 2,
        ADT: onDay(69),
        AVAL: 69,
        AVALU: "DAYS",
        CNSR: 0,
        ANL01FL: "Y",
        SRCDOM: "CE",
      },
      {
        PARAMCD: "HCEREHOS",
        PARAMN: 3,
        ADT: onDay(365),
        AVAL: 365,
        AVALU: "DAYS",
        CNSR: 1,
        ANL01FL: "Y",
        SRCDOM: "DS",
      },
      {
        PARAMCD: "HCEVSFS",
        PARAMN: 4,
        ADT: onDay(381),
        AVAL: 21,
        AVALU: "POINTS",
        CNSR: null,
        ANL01FL: "Y",
        SRCDOM: "QS",
      },
    ]);
  });
});

describe("a subject who dies before 1 year", () => {
  const { pick } = scenario({
    events: [{ decod: "REHOSPITALISATION", day: 120 }],
    deathDay: 248,
    contactDay: 180,
    scores: [
      { visit: "screening", day: -3, score: 43 },
      { visit: "day30", day: 23, score: 69 },
    ],
  });

  it("counts the death and censors the other events at it", () => {
    expect(pick("ADTTE", TTE).slice(1)).toEqual([
      {
        PARAMCD: "TTDTH",
        ADT: onDay(248),
        AVAL: 248,
        CNSR: 0,
        EVNTDESC: "Death",
        CNSDTDSC: null,
        SRCDOM: "DM",
        SRCSEQ: null,
      },
      {
        PARAMCD: "TTSTROKE",
        ADT: onDay(248),
        AVAL: 248,
        CNSR: 1,
        EVNTDESC: "Censored",
        CNSDTDSC: "Last known study contact",
        SRCDOM: "DS",
        SRCSEQ: 1,
      },
      {
        PARAMCD: "TTREHOSP",
        ADT: onDay(120),
        AVAL: 120,
        CNSR: 0,
        EVNTDESC: "First adjudicated rehospitalisation",
        CNSDTDSC: null,
        SRCDOM: "CE",
        SRCSEQ: 1,
      },
    ]);
  });

  it("leaves the 1-year score missing, so the pair ties on it", () => {
    const year1 = pick("ADQS", ["AVISIT", "ANL01FL", "DTYPE"]).filter(
      (row) => row.AVISIT === VISITS.year1.VISIT
    );
    expect(year1).toEqual([
      { AVISIT: VISITS.year1.VISIT, ANL01FL: null, DTYPE: "LOCF" },
    ]);
    expect(pick("ADHCE", HCE)[3]).toEqual({
      PARAMCD: "HCEVSFS",
      PARAMN: 4,
      ADT: null,
      AVAL: null,
      AVALU: "POINTS",
      CNSR: null,
      ANL01FL: null,
      SRCDOM: null,
    });
  });
});

describe("a death after 1 year", () => {
  it("is censored at day 365", () => {
    const { pick } = scenario({
      deathDay: 370,
      contactDay: 370,
      scores: [{ visit: "screening", day: -3, score: 60 }],
    });
    expect(
      pick("ADTTE", TTE).find((row) => row.PARAMCD === "TTDTH")
    ).toMatchObject({
      ADT: onDay(365),
      AVAL: 365,
      CNSR: 1,
      CNSDTDSC: "End of 365-day follow-up",
    });
  });
});

describe("the seeded device study", () => {
  const run = runPipeline(device, { seed: 3420, nSubjects: 120 });
  const get = (name: string) =>
    records(
      run.datasets.find(
        (dataset) => dataset.layer === "adam" && dataset.name === name
      )
    );
  const adtte = get("ADTTE");
  const adhce = get("ADHCE");
  const ce = records(
    run.datasets.find(
      (dataset) => dataset.layer === "sdtm" && dataset.name === "CE"
    )
  );

  it("uses its own hierarchy spec", () => {
    expect([...new Set(adtte.map((row) => row.PARAMCD))]).toEqual([
      "TTADISC",
      "TTDTH",
      "TTSTROKE",
      "TTREHOSP",
    ]);
    expect([...new Set(adhce.map((row) => row.PARAMCD))]).toEqual([
      "HCEDTH",
      "HCESTRK",
      "HCEREHOS",
      "HCEVSFS",
    ]);
    const methods = (name: string) =>
      run.datasets
        .find((dataset) => dataset.layer === "adam" && dataset.name === name)!
        .variables.flatMap((variable) =>
          variable.method ? [variable.method] : []
        );
    expect(methods("ADTTE")).toContain("ADTTE_CENSOR_1Y");
    expect(methods("ADTTE")).not.toContain("ADTTE_CENSOR");
    expect(methods("ADHCE")).toContain("ADHCE_COMPONENT_1Y");
  });

  it("never counts a hierarchy time past day 365", () => {
    const timed = adtte.filter((row) => row.PARAMCD !== "TTADISC");
    expect(timed.length).toBeGreaterThan(0);
    for (const row of timed) {
      expect(row.AVAL).toBeLessThanOrEqual(365);
      expect(row.ADT).toBe(addDays(String(row.STARTDT), Number(row.AVAL) - 1));
    }
  });

  it("dates each stroke and rehospitalisation event at its first CE record", () => {
    for (const [paramcd, decod] of [
      ["TTSTROKE", "DISABLING STROKE"],
      ["TTREHOSP", "REHOSPITALISATION"],
    ] as const) {
      const events = adtte.filter(
        (row) => row.PARAMCD === paramcd && row.CNSR === 0
      );
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        const first = ce
          .filter(
            (row) =>
              row.USUBJID === event.USUBJID &&
              row.CEDECOD === decod &&
              String(row.CESTDTC) >= String(event.STARTDT)
          )
          .sort((a, b) =>
            String(a.CESTDTC).localeCompare(String(b.CESTDTC))
          )[0];
        expect(event).toMatchObject({
          ADT: first.CESTDTC,
          SRCDOM: "CE",
          SRCSEQ: first.CESEQ,
        });
      }
    }
  });

  it("describes ADQS and the device parameters in Define-XML", () => {
    const define = buildDefine(run, {
      layer: "adam",
      createdAt: "2026-11-01T12:00:00.000Z",
    });
    expect(checkDefineParity(define, run.datasets)).toEqual([]);
    expect(define.itemGroups.map((group) => group.name)).toContain("ADQS");
    const list = define.valueLists.find(
      (item) => item.oid === valueListOid("ADHCE", "AVAL")
    )!;
    expect(list.itemRefs).toHaveLength(4);
    const methodOf = (oid: string | undefined) =>
      define.methods.find((method) => method.oid === oid)?.description ?? "";
    expect(methodOf(list.itemRefs[3].methodOid)).toContain(
      "ADQS.CHG of the 1-year primary analysis record"
    );
    const descriptions = define.methods
      .map((method) => method.description)
      .join(" ");
    expect(descriptions).toContain("TTSTROKE");
    expect(descriptions).toContain("at day 365");
    expect(descriptions).not.toContain("SBP Change");
    expect(
      define.codeLists
        .find((codelist) => codelist.id === "ADQS.PARAMCD")
        ?.terms.map((term) => term.codedValue)
    ).toEqual(["VSFSOS"]);
  });
});

describe("DEMO-301", () => {
  it("keeps its hierarchy and its ADaM output byte for byte", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    const adam = run.datasets.filter((dataset) => dataset.layer === "adam");
    expect(adam.map((dataset) => dataset.name)).toEqual([
      "ADSL",
      "ADVS",
      "ADLB",
      "ADEG",
      "ADAE",
      "ADCM",
      "ADTTE",
      "ADHCE",
    ]);
    // The hash of main before #3420.
    expect(
      createHash("sha256").update(JSON.stringify(adam)).digest("hex")
    ).toBe("62cc311a81ddc64b9b697d2d7355cc325f2f5cf1a181de7a3658c3205d330d94");
  });
});
