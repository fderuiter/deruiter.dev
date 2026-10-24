// @vitest-environment node
/**
 * Independent QC of the study-data derivations (#2596).
 *
 * Production/QC double programming: each derivation below is written again
 * from its specification (SDTM IG 3.4 for study day, ADaM IG 1.3 and the
 * DEMO-301 methods recorded in Define-XML for the analysis datasets), without
 * reusing pipeline code, and compared row for row with the pipeline output
 * across many seeds.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  buildStudyDataPackage,
  buildTlfOutputs,
  runPipeline,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type TlfTable,
} from "@/lib/study-data";

type Row = Record<string, CellValue>;

const QC_SEEDS = 200;
const QC_SUBJECTS = 24;

const table = (run: PipelineRun, layer: string, name: string): Row[] => {
  const dataset = run.datasets.find(
    (item: Dataset) => item.layer === layer && item.name === name
  );
  if (!dataset) throw new Error(`${layer}.${name} is missing`);
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name: variable }) => [
        variable,
        dataset.columns[variable][index],
      ])
    )
  );
};

const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
};

// --- dates -----------------------------------------------------------------

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a complete ISO 8601 date, else null. */
const dayNumber = (value: CellValue): number | null => {
  if (typeof value !== "string") return null;
  const match = FULL_DATE.exec(value.slice(0, 10));
  if (!match || (value.length > 10 && value[10] !== "T")) return null;
  return (
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
    86_400_000
  );
};

const isoDate = (day: number): string =>
  new Date(day * 86_400_000).toISOString().slice(0, 10);

/**
 * SDTM IG 3.4 section 4.4.4: --DY is the date minus the reference start date,
 * plus one on or after the reference date. There is no day 0.
 */
const studyDay = (date: CellValue, reference: CellValue): number | null => {
  const d = dayNumber(date);
  const r = dayNumber(reference);
  if (d === null || r === null) return null;
  return d >= r ? d - r + 1 : d - r;
};

// --- QC derivations ----------------------------------------------------------

interface Mismatch {
  check: string;
  key: string;
  expected: unknown;
  actual: unknown;
}

const STUDY_DAY_VARIABLES: Array<[string, string, string]> = [
  ["SV", "SVSTDTC", "SVSTDY"],
  ["EX", "EXSTDTC", "EXSTDY"],
  ["AE", "AESTDTC", "AESTDY"],
  ["VS", "VSDTC", "VSDY"],
  ["LB", "LBDTC", "LBDY"],
  ["DS", "DSSTDTC", "DSSTDY"],
];

function qcStudyDays(run: PipelineRun, out: Mismatch[]) {
  const reference = new Map(
    table(run, "sdtm", "DM").map((row) => [row.USUBJID, row.RFSTDTC])
  );
  for (const [domain, dateVar, dayVar] of STUDY_DAY_VARIABLES) {
    table(run, "sdtm", domain).forEach((row, index) => {
      const expected = studyDay(
        row[dateVar],
        reference.get(row.USUBJID) ?? null
      );
      if (row[dayVar] !== expected) {
        out.push({
          check: `${domain}.${dayVar}`,
          key: `${row.USUBJID} row ${index}`,
          expected,
          actual: row[dayVar],
        });
      }
    });
  }
}

interface Visit {
  name: string;
  visitNum: number;
  targetDay: number;
}

/** Postbaseline visits at which the protocol schedules the domain. */
const scheduledVisits = (domain: string): Visit[] => {
  const { activities, schedule, visits } = DEMO_301_STUDY.design;
  const activityIds = new Set(
    activities.filter((a) => a.domain === domain).map((a) => a.id)
  );
  const visitIds = new Set(
    schedule.filter((s) => activityIds.has(s.activityId)).map((s) => s.visitId)
  );
  return visits
    .filter((visit) => visitIds.has(visit.id) && visit.targetDay > 1)
    .map(({ name, visitNum, targetDay }) => ({ name, visitNum, targetDay }));
};

/**
 * BDS checks for ADVS and ADLB. Observed rows (DTYPE missing) are compared
 * for ADY, ABLFL, BASE, CHG and PCHG; the LOCF rows are rebuilt from the
 * primary analysis rows and compared as a set.
 */
function qcBds(
  run: PipelineRun,
  name: "ADVS" | "ADLB",
  sourceDomain: "VS" | "LB",
  out: Mismatch[]
) {
  const adsl = new Map(table(run, "adam", "ADSL").map((r) => [r.USUBJID, r]));
  const source = new Map(
    table(run, "sdtm", sourceDomain).map((r) => [
      `${r.USUBJID}|${r[`${sourceDomain}SEQ`]}`,
      r,
    ])
  );
  const rows = table(run, "adam", name);
  const observed = rows.filter((row) => row.DTYPE === null);

  for (const [key, group] of groupBy(
    observed,
    (row) => `${row.USUBJID}|${row.PARAMCD}`
  )) {
    const subject = adsl.get(group[0].USUBJID)!;
    const first = dayNumber(subject.TRTSDT);

    // ADaM IG 1.3: ADY counts from TRTSDT the same way --DY counts from RFSTDTC.
    for (const row of group) {
      const ady = studyDay(row.ADT, subject.TRTSDT);
      if (row.ADY !== ady) {
        out.push({ check: `${name}.ADY`, key, expected: ady, actual: row.ADY });
      }
    }

    // Baseline: the latest nonmissing assessment on or before first dose. On
    // the first-dose day only the protocol's baseline visit qualifies, since
    // other same-day assessments may follow the dose.
    let baseline: Row | undefined;
    if (first !== null) {
      for (const row of group) {
        const day = dayNumber(row.ADT);
        if (row.AVAL === null || day === null || day > first) continue;
        const visit = source.get(`${row.USUBJID}|${row.SRCSEQ}`)?.VISIT;
        if (day === first && visit !== "BASELINE") continue;
        const best = baseline ? dayNumber(baseline.ADT)! : -Infinity;
        if (
          !baseline ||
          day > best ||
          (day === best && Number(row.SRCSEQ) < Number(baseline.SRCSEQ))
        ) {
          baseline = row;
        }
      }
    }

    for (const row of group) {
      const isBase = row === baseline;
      const ablfl = isBase ? "Y" : null;
      if (row.ABLFL !== ablfl) {
        out.push({
          check: `${name}.ABLFL`,
          key: `${key}|${row.ADT}|${row.SRCSEQ}`,
          expected: ablfl,
          actual: row.ABLFL,
        });
      }
      // BASE is constant within the parameter once a baseline exists, and
      // CHG is AVAL minus BASE on every record that has both (MT.BDS_CHANGE).
      const expectBase = baseline ? baseline.AVAL : null;
      if (row.BASE !== expectBase) {
        out.push({
          check: `${name}.BASE`,
          key: `${key}|${row.ADT}|${row.SRCSEQ}`,
          expected: expectBase,
          actual: row.BASE,
        });
      }
      const chg =
        typeof row.AVAL === "number" && typeof expectBase === "number"
          ? row.AVAL - expectBase
          : null;
      const pchg =
        chg !== null && typeof expectBase === "number" && expectBase !== 0
          ? (100 * chg) / expectBase
          : null;
      if (!close(row.CHG, chg) || !close(row.PCHG, pchg)) {
        out.push({
          check: `${name}.CHG/PCHG`,
          key: `${key}|${row.ADT}|${row.SRCSEQ}`,
          expected: [chg, pchg],
          actual: [row.CHG, row.PCHG],
        });
      }
    }
  }

  // LOCF: for each scheduled postbaseline visit without a primary analysis
  // row, carry forward the latest postbaseline observation (scheduled or
  // not) dated before the visit's target day.
  const scheduled = scheduledVisits(sourceDomain);
  const expectedLocf: string[] = [];
  for (const [key, group] of groupBy(
    observed,
    (row) => `${row.USUBJID}|${row.PARAMCD}`
  )) {
    const covered = new Set(
      group.filter((row) => row.ANL01FL === "Y").map((row) => row.AVISITN)
    );
    const post = group.filter(
      (row) => typeof row.ADY === "number" && row.ADY > 1 && row.AVAL !== null
    );
    for (const visit of scheduled) {
      if (covered.has(visit.visitNum)) continue;
      const before = post
        .filter((row) => (row.ADY as number) < visit.targetDay)
        .sort(
          (a, b) =>
            (a.ADY as number) - (b.ADY as number) ||
            Number(a.SRCSEQ) - Number(b.SRCSEQ)
        );
      const carried = before.at(-1);
      if (carried) {
        expectedLocf.push(
          `${key}|${visit.visitNum}|${visit.name}|${carried.AVAL}`
        );
      }
    }
  }
  const actualLocf = rows
    .filter((row) => row.DTYPE === "LOCF")
    .map(
      (row) =>
        `${row.USUBJID}|${row.PARAMCD}|${row.AVISITN}|${row.AVISIT}|${row.AVAL}`
    );
  compareSets(`${name}.LOCF`, expectedLocf, actualLocf, out);
  for (const row of rows.filter((r) => r.DTYPE === "LOCF")) {
    if (row.ANL01FL !== null) {
      out.push({
        check: `${name}.LOCF.ANL01FL`,
        key: `${row.USUBJID}|${row.PARAMCD}|${row.AVISITN}`,
        expected: null,
        actual: row.ANL01FL,
      });
    }
  }
}

const close = (actual: CellValue, expected: number | null) =>
  expected === null
    ? actual === null
    : typeof actual === "number" && Math.abs(actual - expected) < 1e-6;

function compareSets(
  check: string,
  expected: string[],
  actual: string[],
  out: Mismatch[]
) {
  const want = [...expected].sort();
  const got = [...actual].sort();
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    out.push({
      check,
      key: "set",
      expected: want.filter((item) => !got.includes(item)),
      actual: got.filter((item) => !want.includes(item)),
    });
  }
}

/** Last known study contact: the latest complete date the subject has in SDTM. */
function lastContact(run: PipelineRun): Map<CellValue, number> {
  const latest = new Map<CellValue, number>();
  const dates: Array<[string, string[]]> = [
    ["SV", ["SVSTDTC", "SVENDTC"]],
    ["EX", ["EXSTDTC", "EXENDTC"]],
    ["VS", ["VSDTC"]],
    ["LB", ["LBDTC"]],
    ["DS", ["DSSTDTC"]],
  ];
  for (const [domain, variables] of dates) {
    for (const row of table(run, "sdtm", domain)) {
      for (const variable of variables) {
        const day = dayNumber(row[variable]);
        if (day !== null && day > (latest.get(row.USUBJID) ?? -Infinity)) {
          latest.set(row.USUBJID, day);
        }
      }
    }
  }
  return latest;
}

const MONTH_ONLY = /^(\d{4})-(\d{2})$/;

/**
 * ADAE: start and end imputation, the treatment-emergent flag, and the first
 * occurrence flags.
 */
function qcAdae(run: PipelineRun, out: Mismatch[]) {
  const adsl = new Map(table(run, "adam", "ADSL").map((r) => [r.USUBJID, r]));
  const ae = new Map(
    table(run, "sdtm", "AE").map((r) => [`${r.USUBJID}|${r.AESEQ}`, r])
  );
  const contact = lastContact(run);
  const adae = table(run, "adam", "ADAE");

  const derived = adae.map((row) => {
    const source = ae.get(`${row.USUBJID}|${row.SRCSEQ}`)!;
    const subject = adsl.get(row.USUBJID)!;
    const first = dayNumber(subject.TRTSDT);
    const last = dayNumber(subject.TRTEDT);
    const lstalv = contact.get(row.USUBJID) ?? null;

    let astdt = dayNumber(source.AESTDTC);
    let astdtf: string | null = null;
    const startMonth = MONTH_ONLY.exec(String(source.AESTDTC ?? ""));
    if (astdt === null && startMonth) {
      const monthStart =
        Date.UTC(+startMonth[1], +startMonth[2] - 1, 1) / 86_400_000;
      const monthEnd = Date.UTC(+startMonth[1], +startMonth[2], 0) / 86_400_000;
      astdt =
        first !== null && first >= monthStart && first <= monthEnd
          ? first
          : monthStart;
      astdtf = "D";
    }

    let aendt = dayNumber(source.AEENDTC);
    let aendtf: string | null = null;
    const endMonth = MONTH_ONLY.exec(String(source.AEENDTC ?? ""));
    if (aendt === null && endMonth) {
      const monthEnd = Date.UTC(+endMonth[1], +endMonth[2], 0) / 86_400_000;
      aendt = lstalv !== null ? Math.min(monthEnd, lstalv) : monthEnd;
      aendtf = "D";
    }

    // Treatment-emergent: from first dose through 14 days after last dose,
    // capped at last known study contact.
    const windowEnd =
      last === null ? null : Math.min(last + 14, lstalv ?? Infinity);
    const trtemfl =
      astdt !== null &&
      first !== null &&
      windowEnd !== null &&
      astdt >= first &&
      astdt <= windowEnd
        ? "Y"
        : "N";
    return { row, astdt, astdtf, aendt, aendtf, trtemfl, lstalv };
  });

  for (const d of derived) {
    const key = `${d.row.USUBJID}|AESEQ ${d.row.SRCSEQ}`;
    const pairs: Array<[string, CellValue, CellValue]> = [
      ["ASTDT", d.astdt === null ? null : isoDate(d.astdt), d.row.ASTDT],
      ["ASTDTF", d.astdtf, d.row.ASTDTF],
      ["AENDT", d.aendt === null ? null : isoDate(d.aendt), d.row.AENDT],
      ["AENDTF", d.aendtf, d.row.AENDTF],
      ["TRTEMFL", d.trtemfl, d.row.TRTEMFL],
      [
        "LSTALVDT",
        d.lstalv === null ? null : isoDate(d.lstalv),
        d.row.LSTALVDT,
      ],
    ];
    for (const [variable, expected, actual] of pairs) {
      if (expected !== actual) {
        out.push({ check: `ADAE.${variable}`, key, expected, actual });
      }
    }
  }

  // First occurrence among treatment-emergent events, ordered by analysis
  // start date and then AE sequence.
  const teae = derived
    .filter((d) => d.trtemfl === "Y")
    .sort(
      (a, b) =>
        a.astdt! - b.astdt! || Number(a.row.SRCSEQ) - Number(b.row.SRCSEQ)
    );
  const firsts = {
    AOCCFL: new Set<Row>(),
    AOCCSFL: new Set<Row>(),
    AOCCPFL: new Set<Row>(),
  };
  const seen = { AOCCFL: new Set(), AOCCSFL: new Set(), AOCCPFL: new Set() };
  for (const { row } of teae) {
    const keys = {
      AOCCFL: row.USUBJID,
      AOCCSFL: `${row.USUBJID}|${row.AEBODSYS}`,
      AOCCPFL: `${row.USUBJID}|${row.AEBODSYS}|${row.AEDECOD}`,
    };
    for (const flag of ["AOCCFL", "AOCCSFL", "AOCCPFL"] as const) {
      if (!seen[flag].has(keys[flag])) {
        seen[flag].add(keys[flag]);
        firsts[flag].add(row);
      }
    }
  }
  for (const { row } of derived) {
    for (const flag of ["AOCCFL", "AOCCSFL", "AOCCPFL"] as const) {
      const expected = firsts[flag].has(row) ? "Y" : null;
      if (row[flag] !== expected) {
        out.push({
          check: `ADAE.${flag}`,
          key: `${row.USUBJID}|AESEQ ${row.SRCSEQ}`,
          expected,
          actual: row[flag],
        });
      }
    }
  }
}

/**
 * ADTTE: time to the first treatment-emergent AE leading to withdrawal, with
 * censoring at last contact or at discontinuation for another reason.
 */
function qcAdtte(run: PipelineRun, out: Mismatch[]) {
  const adsl = table(run, "adam", "ADSL");
  const adae = groupBy(table(run, "adam", "ADAE"), (r) => String(r.USUBJID));
  const ds = groupBy(table(run, "sdtm", "DS"), (r) => String(r.USUBJID));
  const contact = lastContact(run);
  const adtte = new Map(table(run, "adam", "ADTTE").map((r) => [r.USUBJID, r]));

  const dosed = adsl.filter((row) => row.SAFFL === "Y");
  if (adtte.size !== dosed.length) {
    out.push({
      check: "ADTTE.subjects",
      key: "count",
      expected: dosed.length,
      actual: adtte.size,
    });
  }
  for (const subject of dosed) {
    const row = adtte.get(subject.USUBJID);
    const start = dayNumber(subject.TRTSDT)!;
    const disposition = (ds.get(String(subject.USUBJID)) ?? []).filter(
      (r) => r.DSCAT === "DISPOSITION EVENT"
    );
    const aeWithdrawal = disposition.find((r) => r.DSDECOD === "ADVERSE EVENT");
    const event = aeWithdrawal
      ? (adae.get(String(subject.USUBJID)) ?? [])
          .filter((r) => r.TRTEMFL === "Y" && r.AEACN === "DRUG WITHDRAWN")
          .sort(
            (a, b) =>
              dayNumber(a.ASTDT)! - dayNumber(b.ASTDT)! ||
              Number(a.SRCSEQ) - Number(b.SRCSEQ)
          )[0]
      : undefined;

    let adt: number;
    let cnsr: number;
    if (event) {
      adt = dayNumber(event.ASTDT)!;
      cnsr = 0;
    } else {
      const other = disposition
        .filter(
          (r) => r.DSDECOD !== "COMPLETED" && r.DSDECOD !== "ADVERSE EVENT"
        )
        .map((r) => dayNumber(r.DSSTDTC))
        .filter((day): day is number => day !== null);
      adt = Math.min(contact.get(subject.USUBJID)!, ...other);
      cnsr = 1;
    }
    const expected = {
      STARTDT: subject.TRTSDT,
      ADT: isoDate(adt),
      AVAL: adt - start + 1,
      CNSR: cnsr,
    };
    const actual = row && {
      STARTDT: row.STARTDT,
      ADT: row.ADT,
      AVAL: row.AVAL,
      CNSR: row.CNSR,
    };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      out.push({
        check: "ADTTE",
        key: String(subject.USUBJID),
        expected,
        actual,
      });
    }
  }
}

// --- tables ----------------------------------------------------------------

/** Textbook sample statistics, n - 1 denominator for the SD. */
const describeValues = (values: number[]) => {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const sd =
    n > 1
      ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1))
      : null;
  const median =
    n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return { n, mean, sd, median, min: sorted[0], max: sorted[n - 1] };
};

/** True when the displayed text is the value rounded to its shown decimals. */
const shows = (text: string, value: number | null) => {
  if (value === null) return text === "" || text === "-" || text === "NE";
  const decimals = text.split(".")[1]?.length ?? 0;
  return Math.abs(Number(text) - value) <= 0.5 * 10 ** -decimals + 1e-9;
};

/** "n (pct)" or "0", compared as a count and a one-decimal percentage. */
const showsCount = (text: string, n: number, bigN: number) => {
  if (n === 0) return text === "0";
  const match = /^(\d+) \(([\d.]+)\)$/.exec(text);
  return (
    match !== null &&
    Number(match[1]) === n &&
    shows(match[2], (100 * n) / bigN)
  );
};

const titleCase = (visit: string) =>
  visit.charAt(0) + visit.slice(1).toLowerCase();

function qcTables(run: PipelineRun, out: Mismatch[]) {
  const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
  const find = (number: string): TlfTable =>
    outputs.tables.find((item) => item.number === number)!;
  const arms = DEMO_301_STUDY.design.arms.map((arm) => arm.name);
  const safety = table(run, "adam", "ADSL").filter((r) => r.SAFFL === "Y");
  const inArm = (arm: string) => safety.filter((r) => r.TRT01A === arm);
  const bigN = arms.map((arm) => inArm(arm).length);
  const fail = (
    check: string,
    key: string,
    expected: unknown,
    actual: unknown
  ) => out.push({ check, key, expected, actual });
  const rowCells = (t: TlfTable, section: string, label: string) =>
    t.sections
      .find((item) => item.label === section)
      ?.rows.find((item) => item.label === label)
      ?.cells.map((cell) => cell.text);

  const checkStats = (
    t: TlfTable,
    section: string,
    values: number[][],
    check: string
  ) => {
    values.forEach((list, index) => {
      if (list.length === 0) return;
      const stats = describeValues(list);
      for (const [label, value] of [
        ["n", stats.n],
        ["Mean", stats.mean],
        ["SD", stats.sd],
        ["Median", stats.median],
        ["Min", stats.min],
        ["Max", stats.max],
      ] as const) {
        const text = rowCells(t, section, label)?.[index];
        if (text === undefined || !shows(text, value)) {
          fail(check, `${section} ${label} ${arms[index]}`, value, text);
        }
      }
    });
  };

  // Table 14.1.1: demographics on the Safety Set by treatment received.
  const demog = find("14.1.1");
  const shownN = demog.columns.map((column) => column.bigN);
  if (JSON.stringify(shownN) !== JSON.stringify(bigN)) {
    fail("14.1.1.N", "columns", bigN, shownN);
  }
  checkStats(
    demog,
    "Age (years)",
    arms.map((arm) => inArm(arm).map((r) => r.AGE as number)),
    "14.1.1.age"
  );
  const ageGroup = (age: number) =>
    age < 40 ? "<40" : age < 65 ? "40-64" : "65+";
  for (const [section, label, keep] of [
    [
      "Age group (years), n (%)",
      "<40",
      (r: Row) => ageGroup(r.AGE as number) === "<40",
    ],
    [
      "Age group (years), n (%)",
      "40-64",
      (r: Row) => ageGroup(r.AGE as number) === "40-64",
    ],
    [
      "Age group (years), n (%)",
      "65+",
      (r: Row) => ageGroup(r.AGE as number) === "65+",
    ],
    ["Sex, n (%)", "Female", (r: Row) => r.SEX === "F"],
    ["Sex, n (%)", "Male", (r: Row) => r.SEX === "M"],
  ] as const) {
    arms.forEach((arm, index) => {
      const n = inArm(arm).filter(keep).length;
      const text = rowCells(demog, section, label)?.[index];
      if (text === undefined || !showsCount(text, n, bigN[index])) {
        fail("14.1.1.count", `${label} ${arm}`, n, text);
      }
    });
  }

  // Baseline blood pressure, from this file's own baseline selection.
  const advs = table(run, "adam", "ADVS");
  const baselineOf = (paramcd: string) =>
    new Map(
      advs
        .filter((r) => r.PARAMCD === paramcd && r.ABLFL === "Y")
        .map((r) => [r.USUBJID, r.AVAL as number])
    );
  for (const [paramcd, section] of [
    ["SYSBP", "Baseline systolic blood pressure (mmHg)"],
    ["DIABP", "Baseline diastolic blood pressure (mmHg)"],
  ]) {
    const base = baselineOf(paramcd);
    checkStats(
      demog,
      section,
      arms.map((arm) =>
        inArm(arm)
          .map((r) => base.get(r.USUBJID))
          .filter((v): v is number => v !== undefined)
      ),
      "14.1.1.baseline"
    );
  }

  // Table 14.2.1: systolic blood pressure by visit, primary analysis rows.
  const sbp = find("14.2.1");
  const safetyIds = new Set(safety.map((r) => r.USUBJID));
  const primary = advs.filter(
    (r) =>
      r.PARAMCD === "SYSBP" && r.ANL01FL === "Y" && safetyIds.has(r.USUBJID)
  );
  const byArm = (rows: Row[], value: (r: Row) => CellValue) =>
    arms.map((arm) =>
      rows
        .filter((r) => r.TRT01A === arm)
        .map(value)
        .filter((v): v is number => typeof v === "number")
    );
  checkStats(
    sbp,
    "Baseline, observed value",
    byArm(
      primary.filter((r) => r.ABLFL === "Y"),
      (r) => r.AVAL
    ),
    "14.2.1.baseline"
  );
  for (const visit of scheduledVisits("VS")) {
    const atVisit = primary.filter((r) => r.AVISITN === visit.visitNum);
    const label = titleCase(visit.name);
    checkStats(
      sbp,
      `${label}, observed value`,
      byArm(atVisit, (r) => r.AVAL),
      "14.2.1.observed"
    );
    checkStats(
      sbp,
      `${label}, change from baseline`,
      byArm(atVisit, (r) => r.CHG),
      "14.2.1.change"
    );
  }

  // Table 14.3.1: subjects with a TEAE, once per SOC and once per PT.
  const teaeTable = find("14.3.1");
  const teae = table(run, "adam", "ADAE").filter(
    (r) => r.TRTEMFL === "Y" && safetyIds.has(r.USUBJID)
  );
  const subjects = (rows: Row[]) => new Set(rows.map((r) => r.USUBJID)).size;
  const [any, ...socs] = teaeTable.sections;
  arms.forEach((arm, index) => {
    const n = subjects(teae.filter((r) => r.TRT01A === arm));
    if (!showsCount(any.cells?.[index]?.text ?? "", n, bigN[index])) {
      fail("14.3.1.any", arm, n, any.cells?.[index]?.text);
    }
  });
  const shownSocs = socs.map((section) => section.label).sort();
  const expectedSocs = [...new Set(teae.map((r) => String(r.AEBODSYS)))].sort();
  if (JSON.stringify(shownSocs) !== JSON.stringify(expectedSocs)) {
    fail("14.3.1.socs", "labels", expectedSocs, shownSocs);
  }
  for (const section of socs) {
    const inSoc = teae.filter((r) => r.AEBODSYS === section.label);
    const terms = [...new Set(inSoc.map((r) => String(r.AEDECOD)))].sort();
    const shownTerms = section.rows.map((r) => r.label).sort();
    if (JSON.stringify(terms) !== JSON.stringify(shownTerms)) {
      fail("14.3.1.terms", section.label, terms, shownTerms);
    }
    arms.forEach((arm, index) => {
      const n = subjects(inSoc.filter((r) => r.TRT01A === arm));
      if (!showsCount(section.cells?.[index]?.text ?? "", n, bigN[index])) {
        fail(
          "14.3.1.soc",
          `${section.label} ${arm}`,
          n,
          section.cells?.[index]?.text
        );
      }
      for (const term of section.rows) {
        const m = subjects(
          inSoc.filter((r) => r.TRT01A === arm && r.AEDECOD === term.label)
        );
        if (!showsCount(term.cells[index].text, m, bigN[index])) {
          fail("14.3.1.pt", `${term.label} ${arm}`, m, term.cells[index].text);
        }
      }
    });
  }
}

function qc(run: PipelineRun): Mismatch[] {
  const out: Mismatch[] = [];
  qcStudyDays(run, out);
  qcBds(run, "ADVS", "VS", out);
  qcBds(run, "ADLB", "LB", out);
  qcAdae(run, out);
  qcAdtte(run, out);
  qcTables(run, out);
  return out;
}

describe("independent QC of the study-data derivations (#2596)", () => {
  it("agrees with the pipeline on DEMO-301 seed 301", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    expect(qc(run)).toEqual([]);
  });

  it(`agrees with the pipeline row for row on ${QC_SEEDS} seeds`, () => {
    // Tally the cases the comparison reached, so a generator change that
    // stops producing them cannot leave the QC passing vacuously. The
    // generator writes no partial AE end dates and no discontinuation for a
    // reason other than an adverse event, so end-date imputation and
    // censoring at such a discontinuation are not reached yet (messy-data
    // scenarios, #2605).
    const reached = {
      events: 0,
      imputedStarts: 0,
      nonEmergent: 0,
      locf: 0,
      sameDayBaseline: 0,
    };
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), (seed) => {
        const run = runPipeline(DEMO_301_STUDY, {
          seed,
          nSubjects: QC_SUBJECTS,
        });
        const mismatches = qc(run);
        const adtte = table(run, "adam", "ADTTE");
        const adae = table(run, "adam", "ADAE");
        reached.events += adtte.filter((r) => r.CNSR === 0).length;
        reached.imputedStarts += adae.filter((r) => r.ASTDTF !== null).length;
        reached.nonEmergent += adae.filter((r) => r.TRTEMFL !== "Y").length;
        for (const name of ["ADVS", "ADLB"]) {
          const rows = table(run, "adam", name);
          reached.locf += rows.filter((r) => r.DTYPE === "LOCF").length;
          reached.sameDayBaseline += rows.filter(
            (r) => r.ABLFL === "Y" && r.ADY === 1
          ).length;
        }
        if (mismatches.length > 0) {
          throw new Error(
            `seed ${seed}: ${JSON.stringify(mismatches.slice(0, 5))}`
          );
        }
      }),
      { numRuns: QC_SEEDS, seed: 2596 }
    );
    for (const [name, count] of Object.entries(reached)) {
      expect(count, name).toBeGreaterThan(0);
    }
  }, 120_000);

  it("gives identical runs and table outputs for the same seed", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffff_ffff }),
        fc.integer({ min: 1, max: 40 }),
        (seed, nSubjects) => {
          const first = runPipeline(DEMO_301_STUDY, { seed, nSubjects });
          const again = runPipeline(DEMO_301_STUDY, { seed, nSubjects });
          // The run manifest lists no outputs before packaging, so compare
          // every dataset, finding and conformance result as well.
          expect(again.manifest).toEqual(first.manifest);
          expect(JSON.stringify(again)).toBe(JSON.stringify(first));
          expect(JSON.stringify(buildTlfOutputs(DEMO_301_STUDY, again))).toBe(
            JSON.stringify(buildTlfOutputs(DEMO_301_STUDY, first))
          );
        }
      ),
      { numRuns: 25, seed: 25960 }
    );
  }, 60_000);

  it("gives byte-identical package manifests for the same seed", async () => {
    for (const seed of [1, 2596, 0xfffffffe]) {
      const options = { seed, nSubjects: 12 };
      const generatedAt = "2026-10-24T12:00:00.000Z";
      const first = await buildStudyDataPackage(
        runPipeline(DEMO_301_STUDY, options),
        { generatedAt }
      );
      const again = await buildStudyDataPackage(
        runPipeline(DEMO_301_STUDY, options),
        { generatedAt }
      );
      expect(again.manifestSha256).toBe(first.manifestSha256);
      expect(again.packageManifest).toEqual(first.packageManifest);
    }
  }, 60_000);
});
