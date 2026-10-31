/**
 * The messy-data scenario library (#2605): named faults layered onto the
 * synthetic collected data, each declaring what the pipeline should do
 * with it. A scenario edits the records of one subject, chosen
 * deterministically, so scenarios compose without touching each other and
 * every other subject stays byte for byte as generated.
 */
import type {
  AppliedScenario,
  CellValue,
  Dataset,
  MessyDataScenario,
  ScenarioId,
} from "../../types";

type Row = Record<string, CellValue>;

interface SubjectView {
  readonly subject: string;
  /** First dose date (EXSTDTC), or null for a screen failure. */
  readonly firstDose: string | null;
  /** Rows of each collected domain that belong to the subject. */
  readonly rows: (domain: string) => readonly Row[];
}

interface ScenarioRule extends MessyDataScenario {
  readonly eligible: (view: SubjectView) => boolean;
  /** Returns the subject's replacement rows for each domain it changes. */
  readonly apply: (view: SubjectView) => Readonly<Record<string, Row[]>>;
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isFullDate(value: CellValue): value is string {
  return typeof value === "string" && FULL_DATE.test(value);
}

function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The subject's first AE row whose field holds a complete date. */
function firstAeWith(view: SubjectView, field: string): Row | undefined {
  return view.rows("AE").find((row) => isFullDate(row[field]));
}

function replaceAe(
  view: SubjectView,
  target: Row,
  change: (row: Row) => Row
): Record<string, Row[]> {
  return {
    AE: view.rows("AE").map((row) => (row === target ? change(row) : row)),
  };
}

/** Completers only: an edited AE then cannot move a discontinuation event. */
function completed(view: SubjectView): boolean {
  return view.rows("DS").some((row) => row.DSDECOD === "COMPLETED");
}

function isPostDose(view: SubjectView, row: Row, field: string): boolean {
  const value = row[field];
  return view.firstDose !== null && isFullDate(value) && value > view.firstDose;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function daysFrom(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00.000Z`) -
      Date.parse(`${start}T00:00:00.000Z`)) /
      86_400_000
  );
}

/** The subject's rows with `copy` inserted directly after `target`. */
function insertAfter(rows: readonly Row[], target: Row, copy: Row): Row[] {
  return rows.flatMap((row) => (row === target ? [row, copy] : [row]));
}

/** The scheduled visit a scenario can add an unscheduled visit beside. */
function onTargetVisit(view: SubjectView): Row | undefined {
  if (view.rows("SV").some((row) => row.VISITNUM === 99)) return undefined;
  return view
    .rows("SV")
    .find(
      (row) =>
        row.STATUS === "COMPLETED" &&
        typeof row.PLANDY === "number" &&
        row.PLANDY > 1 &&
        row.ACTDY === row.PLANDY &&
        isFullDate(row.SVDTC) &&
        view.rows("VS").some((vs) => vs.VISITNUM === row.VISITNUM)
    );
}

/**
 * When a completer's participation can be ended early: two days after their
 * second attended post-dose visit, provided at least two planned visits
 * would then be lost and every adverse event has ended by that date.
 */
function earlyStop(view: SubjectView): string | null {
  if (!completed(view) || view.firstDose === null) return null;
  const attended = view
    .rows("SV")
    .filter(
      (row) =>
        typeof row.ACTDY === "number" && row.ACTDY > 1 && isFullDate(row.SVDTC)
    )
    .map((row) => String(row.SVDTC))
    .sort();
  if (attended.length < 2) return null;
  const stop = shiftDays(attended[1]!, 2);
  const stopDay = daysFrom(view.firstDose, stop) + 1;
  const lost = view
    .rows("SV")
    .filter((row) => typeof row.PLANDY === "number" && row.PLANDY > stopDay);
  const aesEnded = view
    .rows("AE")
    .every(
      (row) =>
        isFullDate(row.AESTDTC) &&
        isFullDate(row.AEENDTC) &&
        row.AEENDTC <= stop
    );
  return lost.length >= 2 && aesEnded ? stop : null;
}

/**
 * Ends the subject's participation on `stop` for `reason`: exposure stops,
 * the final disposition event changes, and visits, measurements and
 * medications that would have followed are not collected.
 */
function endParticipation(
  view: SubjectView,
  stop: string,
  reason: string
): Record<string, Row[]> {
  const stopDay = daysFrom(view.firstDose!, stop) + 1;
  const kept = (field: string) => (row: Row) =>
    isFullDate(row[field]) ? row[field] <= stop : false;
  return {
    EX: view.rows("EX").map((row) => ({ ...row, EXENDTC: stop })),
    DS: view
      .rows("DS")
      .map((row) =>
        row.DSSCAT === "DISPOSITION EVENT"
          ? { ...row, DSDECOD: reason, DSSTDTC: stop }
          : row
      ),
    SV: view
      .rows("SV")
      .filter((row) =>
        isFullDate(row.SVDTC)
          ? row.SVDTC <= stop
          : typeof row.PLANDY === "number" && row.PLANDY <= stopDay
      ),
    VS: view.rows("VS").filter(kept("VSDTC")),
    LB: view.rows("LB").filter(kept("LBDTC")),
    // A medication remembered to the month began long before the study.
    CM: view
      .rows("CM")
      .filter((row) => !isFullDate(row.CMSTDTC) || row.CMSTDTC <= stop),
  };
}

/** The QT and RR records of one ECG: one subject, date and visit. */
interface Ecg {
  readonly date: string;
  readonly qt: Row;
  readonly rr: Row;
}

/** The subject's ECGs with a QT and a positive RR, in collection order. */
function ecgs(view: SubjectView): Ecg[] {
  const byEcg = new Map<string, Partial<Record<string, Row>>>();
  for (const row of view.rows("EG")) {
    if (!isFullDate(row.EGDTC)) continue;
    const key = `${row.EGDTC}|${String(row.VISITNUM)}`;
    byEcg.set(key, { ...byEcg.get(key), [String(row.EGTESTCD)]: row });
  }
  return [...byEcg.values()].flatMap((tests) => {
    const { QTAG: qt, RRAG: rr } = tests;
    return qt &&
      rr &&
      typeof qt.EGORRES === "number" &&
      typeof rr.EGORRES === "number" &&
      rr.EGORRES > 0
      ? [{ date: String(qt.EGDTC), qt, rr }]
      : [];
  });
}

/** The subject's first post-dose ECG with a QT and an RR. */
function postDoseEcg(view: SubjectView): Ecg | undefined {
  return ecgs(view).find((ecg) => isPostDose(view, ecg.qt, "EGDTC"));
}

const RULES: readonly ScenarioRule[] = [
  {
    id: "impossible-date",
    title: "Impossible date",
    description:
      "An adverse event onset is recorded as 30 February, a date that does not exist.",
    expected: {
      findings: ["SD-017"],
      derivation:
        "AESTDY stays missing rather than being computed from a rolled-over date, and ADAE leaves ASTDT missing without imputing it.",
    },
    eligible: (view) =>
      completed(view) && firstAeWith(view, "AESTDTC") !== undefined,
    apply(view) {
      const target = firstAeWith(view, "AESTDTC")!;
      const year = String(target.AESTDTC).slice(0, 4);
      return replaceAe(view, target, (row) => ({
        ...row,
        AESTDTC: `${year}-02-30`,
      }));
    },
  },
  {
    id: "partial-end-date",
    title: "Partial end date",
    description:
      "An adverse event end date is recorded to the month only, as a site might when the day is unknown.",
    expected: {
      findings: [],
      derivation:
        "ADAE imputes AENDT to the end of that month, capped at the last contact date, and flags the imputed day (AENDTF = D).",
    },
    eligible: (view) =>
      completed(view) && firstAeWith(view, "AEENDTC") !== undefined,
    apply(view) {
      const target = firstAeWith(view, "AEENDTC")!;
      return replaceAe(view, target, (row) => ({
        ...row,
        AEENDTC: String(row.AEENDTC).slice(0, 7),
      }));
    },
  },
  {
    id: "ae-before-first-dose",
    title: "Adverse event before first dose",
    description:
      "A post-dose adverse event is moved to three days before the first dose.",
    expected: {
      findings: ["SD-034"],
      derivation:
        "The event stays in AE with a negative AESTDY and is not treatment-emergent in ADAE (TRTEMFL = N).",
    },
    eligible: (view) =>
      completed(view) &&
      view.rows("AE").some((row) => isPostDose(view, row, "AESTDTC")),
    apply(view) {
      const target = view
        .rows("AE")
        .find((row) => isPostDose(view, row, "AESTDTC"))!;
      const start = shiftDays(view.firstDose!, -3);
      return replaceAe(view, target, (row) => ({
        ...row,
        AESTDTC: start,
        AEENDTC: shiftDays(start, 1),
        AEREL: "NOT RELATED",
      }));
    },
  },
  {
    id: "missing-baseline",
    title: "Missing baseline",
    description:
      "Every vital signs record on or before the first dose is removed, so the subject has no baseline value.",
    expected: {
      findings: [],
      derivation:
        "ADVS keeps the subject's post-baseline records with BASE and CHG missing and no baseline flag; nothing is carried back or imputed.",
    },
    eligible: (view) =>
      view.firstDose !== null &&
      view.rows("VS").some((row) => !isPostDose(view, row, "VSDTC")) &&
      view.rows("VS").some((row) => isPostDose(view, row, "VSDTC")),
    apply: (view) => ({
      VS: view.rows("VS").filter((row) => isPostDose(view, row, "VSDTC")),
    }),
  },
  {
    id: "no-post-baseline",
    title: "No post-baseline value",
    description:
      "Every vital signs and laboratory record after the first dose is removed; the visits still happened.",
    expected: {
      findings: [],
      derivation:
        "ADVS and ADLB keep only the baseline records, so the subject has no change from baseline and drops out of by-visit summaries.",
    },
    eligible: (view) =>
      view.rows("VS").some((row) => isPostDose(view, row, "VSDTC")) &&
      view.rows("VS").some((row) => !isPostDose(view, row, "VSDTC")),
    apply: (view) => ({
      VS: view.rows("VS").filter((row) => !isPostDose(view, row, "VSDTC")),
      LB: view.rows("LB").filter((row) => !isPostDose(view, row, "LBDTC")),
    }),
  },
  {
    id: "off-codelist-extensible",
    title: "Off-codelist term, extensible list",
    description:
      "Causality is recorded as UNASSESSABLE, a term the sponsor-defined, extensible AEREL list does not hold.",
    expected: {
      findings: ["SD-023"],
      derivation:
        "The value is kept as collected and flagged as a warning to review as a codelist extension; nothing downstream fails.",
    },
    eligible: (view) => view.rows("AE").length > 0,
    apply(view) {
      const target = view.rows("AE")[0]!;
      return replaceAe(view, target, (row) => ({
        ...row,
        AEREL: "UNASSESSABLE",
      }));
    },
  },
  {
    id: "off-codelist-non-extensible",
    title: "Off-codelist term, non-extensible list",
    description:
      "Sex is recorded as FEMALE, the decode, instead of the submission value F. The SEX codelist is not extensible.",
    expected: {
      findings: ["SD-021"],
      derivation:
        "The value is kept as collected and reported as an error, since a non-extensible codelist admits no other value.",
    },
    eligible: (view) => view.rows("DM").some((row) => row.SEX === "F"),
    apply: (view) => ({
      DM: view
        .rows("DM")
        .map((row) => (row.SEX === "F" ? { ...row, SEX: "FEMALE" } : row)),
    }),
  },
  {
    id: "duplicate-record",
    title: "Duplicate record",
    description:
      "A post-dose vital signs measurement is entered twice, with the same date, test and result.",
    expected: {
      findings: ["SD-036"],
      derivation:
        "Both records are kept in VS and ADVS, but only one carries ANL01FL at that analysis visit, so the measurement is never summarized twice.",
    },
    eligible: (view) =>
      view.rows("VS").some((row) => isPostDose(view, row, "VSDTC")),
    apply(view) {
      const target = view
        .rows("VS")
        .find((row) => isPostDose(view, row, "VSDTC"))!;
      return {
        VS: insertAfter(view.rows("VS"), target, {
          ...target,
          SRCID: `${String(target.SRCID)}:dup`,
        }),
      };
    },
  },
  {
    id: "unit-change",
    title: "Unit change mid-study",
    description:
      "After the first dose the laboratory reports glucose in mg/dL instead of mmol/L, with values converted at the site.",
    expected: {
      findings: ["SD-039"],
      derivation:
        "SDTM converts LBSTRESN back to mmol/L, so ADLB AVAL, BASE and CHG are the same as if the unit had never changed.",
    },
    eligible: (view) =>
      view
        .rows("LB")
        .some(
          (row) =>
            row.LBTESTCD === "GLUC" &&
            row.LBORRESU === "mmol/L" &&
            isPostDose(view, row, "LBDTC")
        ) &&
      view
        .rows("LB")
        .some(
          (row) =>
            row.LBTESTCD === "GLUC" &&
            isFullDate(row.LBDTC) &&
            !isPostDose(view, row, "LBDTC")
        ),
    apply: (view) => ({
      LB: view.rows("LB").map((row) =>
        row.LBTESTCD === "GLUC" &&
        row.LBORRESU === "mmol/L" &&
        typeof row.LBORRES === "number" &&
        isPostDose(view, row, "LBDTC")
          ? {
              ...row,
              LBORRES: round1(row.LBORRES * 18.016),
              LBORRESU: "mg/dL",
            }
          : row
      ),
    }),
  },
  {
    id: "lab-retest-same-day",
    title: "Same-day laboratory retest",
    description:
      "A post-dose laboratory test is repeated later the same day and gives a slightly different result.",
    expected: {
      findings: [],
      derivation:
        "Both results are kept in LB and ADLB at the same analysis visit; ANL01FL goes to the first result of the day (the lower LBSEQ) and the retest stays unflagged.",
    },
    eligible: (view) =>
      view
        .rows("LB")
        .some(
          (row) =>
            typeof row.LBORRES === "number" && isPostDose(view, row, "LBDTC")
        ),
    apply(view) {
      const target = view
        .rows("LB")
        .find(
          (row) =>
            typeof row.LBORRES === "number" && isPostDose(view, row, "LBDTC")
        )!;
      const original = target.LBORRES as number;
      const retest = round1(original * 1.05);
      return {
        LB: insertAfter(view.rows("LB"), target, {
          ...target,
          SRCID: `${String(target.SRCID)}:retest`,
          LBORRES: retest === original ? round1(original + 0.1) : retest,
        }),
      };
    },
  },
  {
    id: "unscheduled-visit-in-window",
    title: "Unscheduled visit inside a window",
    description:
      "The day after a scheduled visit held on its target day, the subject returns for an unscheduled visit and vital signs are measured again.",
    expected: {
      findings: [],
      derivation:
        "SDTM keeps the visit as VISITNUM 99 UNSCHEDULED. ADVS assigns its records to the analysis visit whose window contains them, and ANL01FL stays on the scheduled record, which is closer to the target day.",
    },
    eligible: (view) => onTargetVisit(view) !== undefined,
    apply(view) {
      const visit = onTargetVisit(view)!;
      const date = shiftDays(String(visit.SVDTC), 1);
      const unscheduled: Row = {
        ...visit,
        SRCID: `${String(visit.SRCID)}:unscheduled`,
        VISITNUM: 99,
        VISIT: "UNSCHEDULED",
        PLANDY: null,
        ACTDY: (visit.ACTDY as number) + 1,
        SVDTC: date,
        STATUS: "UNSCHEDULED",
      };
      const measured = view
        .rows("VS")
        .filter((row) => row.VISITNUM === visit.VISITNUM);
      const last = measured.at(-1)!;
      const repeats = measured.map((row) => ({
        ...row,
        SRCID: `${String(row.SRCID)}:unscheduled`,
        VISITNUM: 99,
        VISIT: "UNSCHEDULED",
        VSDTC: date,
        VSORRES:
          typeof row.VSORRES === "number"
            ? round1(row.VSORRES + 1)
            : row.VSORRES,
      }));
      return {
        SV: insertAfter(view.rows("SV"), visit, unscheduled),
        VS: view
          .rows("VS")
          .flatMap((row) => (row === last ? [row, ...repeats] : [row])),
      };
    },
  },
  {
    id: "rescreened-subject",
    title: "Rescreened subject",
    description:
      "A screen failure is screened again four weeks later and the site records the second screening under the same subject number.",
    expected: {
      findings: ["SD-035", "AD-002"],
      derivation:
        "DM and ADSL each hold two records for the subject. The pipeline keeps both rather than merging them silently, and the run fails conformance until the rescreen is given its own subject number.",
    },
    eligible: (view) =>
      view.rows("DM").some((row) => row.SCREENFL === "FAIL") &&
      view.rows("DS").some((row) => row.DSDECOD === "SCREEN FAILURE"),
    apply(view) {
      const later = (value: CellValue) =>
        isFullDate(value) ? shiftDays(value, 28) : value;
      const again = (row: Row): Row => ({
        ...row,
        SRCID: `${String(row.SRCID)}:rescreen`,
      });
      const dm = view.rows("DM")[0]!;
      const ds = view.rows("DS");
      return {
        DM: [
          ...view.rows("DM"),
          { ...again(dm), CONSENTDTC: later(dm.CONSENTDTC) },
        ],
        DS: [
          ...ds,
          ...ds.map((row) => ({ ...again(row), DSSTDTC: later(row.DSSTDTC) })),
        ],
      };
    },
  },
  {
    id: "death-during-treatment",
    title: "Death during treatment",
    description:
      "A subject dies two days after their second post-dose visit, while still on treatment; no later visits take place.",
    expected: {
      findings: [],
      derivation:
        "DM records the death with DTHFL = Y and DTHDTC, the date of the DEATH disposition event. ADSL ends treatment on the date of death (TRTEDT), sets DTHDT to it, and records EOSSTT = DISCONTINUED and DCSREAS = DEATH. ADTTE censors time to discontinuation for an adverse event at the death, as discontinuation for another reason.",
    },
    eligible: (view) => earlyStop(view) !== null,
    apply: (view) => endParticipation(view, earlyStop(view)!, "DEATH"),
  },
  {
    id: "withdrawal-before-week-12",
    title: "Withdrawal before Week 12",
    description:
      "A subject withdraws consent two days after their second post-dose visit, before the Week 12 primary visit.",
    expected: {
      findings: [],
      derivation:
        "ADSL records EOSSTT = DISCONTINUED and DCSREAS = WITHDRAWAL BY SUBJECT. ADVS carries the last on-treatment value forward to the missed visits as DTYPE = LOCF records, none of them flagged ANL01FL.",
    },
    eligible: (view) => earlyStop(view) !== null,
    apply: (view) =>
      endParticipation(view, earlyStop(view)!, "WITHDRAWAL BY SUBJECT"),
  },
  {
    id: "randomized-not-dosed",
    title: "Randomized, never dosed",
    description:
      "A subject is randomized and withdraws the same day, before the first dose: no exposure record and no later visit.",
    expected: {
      findings: [],
      derivation:
        "DM keeps the randomized arm in ARMCD and ARM, leaves ACTARMCD and ACTARM missing with ARMNRS = ASSIGNED, NOT TREATED, and SE holds only the screening element. ADSL keeps TRT01P as the randomized arm, with SAFFL = N and ITTFL = N, since the Full Analysis Set needs a dose (ADR 0069). CDISC CORE reports RFENDTC missing although ARM is set (CORE-000191): RFENDTC is last exposure, as RFXENDTC is, and filling it would break CORE-000192, which wants RFENDTC blank whenever ARMNRS is set.",
    },
    // A subject with no adverse event or medication for one, so nothing
    // dated after the dose that never happened is left behind.
    eligible: (view) =>
      completed(view) &&
      view.rows("EX").length > 0 &&
      isFullDate(view.rows("RAND")[0]?.RANDDTC ?? null) &&
      view.rows("AE").length === 0 &&
      !view.rows("CM").some((row) => row.CMAENO),
    apply(view) {
      const randomized = String(view.rows("RAND")[0]!.RANDDTC);
      const kept = (field: string) => (row: Row) =>
        isFullDate(row[field]) ? row[field] <= randomized : false;
      return {
        EX: [],
        DS: view.rows("DS").map((row) =>
          row.DSSCAT === "DISPOSITION EVENT"
            ? {
                ...row,
                DSDECOD: "WITHDRAWAL BY SUBJECT",
                DSSTDTC: randomized,
              }
            : row
        ),
        SV: view
          .rows("SV")
          .filter((row) =>
            isFullDate(row.SVDTC)
              ? row.SVDTC <= randomized
              : typeof row.PLANDY === "number" && row.PLANDY <= 1
          ),
        VS: view.rows("VS").filter(kept("VSDTC")),
        LB: view.rows("LB").filter(kept("LBDTC")),
        EG: view.rows("EG").filter(kept("EGDTC")),
        // Rescue medication starts on treatment, so it goes too.
        CM: view
          .rows("CM")
          .filter(
            (row) => !isFullDate(row.CMSTDTC) || row.CMSTDTC <= randomized
          ),
      };
    },
  },
  {
    id: "unplanned-treatment",
    title: "Unplanned treatment",
    description:
      "A subject is dispensed Demoxacin 40 mg, a dose no arm of the protocol plans, for the whole treatment period.",
    expected: {
      findings: [],
      derivation:
        "DM keeps the randomized arm in ARMCD and ARM, leaves ACTARMCD and ACTARM missing with ARMNRS = UNPLANNED TREATMENT and ACTARMUD = the treatment received, and SE records the treatment period as an unplanned element (ETCD = UNPLAN). ADSL keeps TRT01P as the randomized arm and sets TRT01A to the treatment received. The safety tables have a column only for each planned treatment, so they leave the subject out (#3673). CDISC CORE reports RFENDTC set although ARMNRS is (CORE-000192), a rule written for screen failures; an assigned, treated subject needs RFENDTC under CORE-000191.",
    },
    eligible: (view) => completed(view) && view.rows("EX").length > 0,
    apply: (view) => ({
      EX: view.rows("EX").map((row) => ({ ...row, EXTRT: "Demoxacin 40 mg" })),
    }),
  },
  {
    id: "qtcf-outlier",
    title: "QTcF outlier on treatment",
    description:
      "At the first post-dose ECG, the QT interval is raised so that QTcF reaches 530 ms, more than 60 ms above the subject's baseline.",
    expected: {
      findings: ["AD-014"],
      derivation:
        "ADEG derives QTcF from the raised QT and flags the record CRIT1FL = Y (QTcF > 500 ms) and CRIT2FL = Y (increase from baseline > 60 ms), the ICH E14 categorical thresholds. The collected QT is kept as recorded.",
    },
    eligible: (view) =>
      postDoseEcg(view) !== undefined &&
      ecgs(view).some((ecg) => !isPostDose(view, ecg.qt, "EGDTC")),
    apply(view) {
      const { qt, rr } = postDoseEcg(view)!;
      // QTcF = QT / (RR / 1000)^(1/3); rounding QT up keeps QTcF >= 530.
      const raised = Math.ceil(530 * Math.cbrt((rr.EGORRES as number) / 1000));
      return {
        EG: view
          .rows("EG")
          .map((row) => (row === qt ? { ...row, EGORRES: raised } : row)),
      };
    },
  },
  {
    id: "ecg-missing-rr",
    title: "ECG without an RR interval",
    description:
      "The RR interval of the first post-dose ECG is not recorded; the QT, PR, QRS and heart rate of that ECG are.",
    expected: {
      findings: ["AD-015"],
      derivation:
        "ADEG keeps the ECG's other intervals but derives no QTcF for it, since Fridericia's correction needs RR, and nothing is imputed. The analysis reviewer guide lists the ECG under AD-015 as an injected finding.",
    },
    eligible: (view) => postDoseEcg(view) !== undefined,
    apply(view) {
      const { rr } = postDoseEcg(view)!;
      return { EG: view.rows("EG").filter((row) => row !== rr) };
    },
  },
];

/** Every scenario, in the order they are applied. */
export const MESSY_DATA_SCENARIOS: readonly MessyDataScenario[] = RULES.map(
  ({ id, title, description, expected }) => ({
    id,
    title,
    description,
    expected,
  })
);

function rowsOf(dataset: Dataset): Row[] {
  return Array.from({ length: dataset.rowCount }, (_, index) => {
    const row: Row = {};
    for (const variable of dataset.variables)
      row[variable.name] = dataset.columns[variable.name]?.[index] ?? null;
    return row;
  });
}

function withRows(dataset: Dataset, rows: readonly Row[]): Dataset {
  const columns: Record<string, CellValue[]> = {};
  for (const variable of dataset.variables)
    columns[variable.name] = rows.map((row) => row[variable.name] ?? null);
  return { ...dataset, columns, rowCount: rows.length };
}

/**
 * Applies scenarios to the collected datasets. Scenarios run in library
 * order whatever order they are given in, and each takes the first eligible
 * subject that no earlier scenario has changed. A scenario with no eligible
 * subject changes nothing and reports a null subject.
 *
 * @param collected - The generated collected datasets.
 * @param ids - The scenarios to apply. Duplicates are ignored.
 * @returns The changed datasets and the subject each scenario changed.
 * @throws RangeError for an unknown scenario id.
 */
export function applyScenarios(
  collected: readonly Dataset[],
  ids: readonly ScenarioId[]
): {
  readonly datasets: readonly Dataset[];
  readonly applied: readonly AppliedScenario[];
} {
  for (const id of ids)
    if (!RULES.some((rule) => rule.id === id))
      throw new RangeError(`Unknown messy-data scenario ${String(id)}.`);
  const wanted = new Set(ids);
  const rows = new Map(
    collected.map((dataset) => [dataset.name, rowsOf(dataset)])
  );
  const subjects = (rows.get("DM") ?? []).map((row) => String(row.USUBJID));
  const used = new Set<string>();
  const applied: AppliedScenario[] = [];

  const view = (subject: string): SubjectView => {
    const ex = (rows.get("EX") ?? []).find((row) => row.USUBJID === subject);
    return {
      subject,
      firstDose: isFullDate(ex?.EXSTDTC ?? null) ? String(ex!.EXSTDTC) : null,
      rows: (domain) =>
        (rows.get(domain) ?? []).filter((row) => row.USUBJID === subject),
    };
  };

  for (const rule of RULES) {
    if (!wanted.has(rule.id)) continue;
    const subject = subjects.find(
      (candidate) => !used.has(candidate) && rule.eligible(view(candidate))
    );
    applied.push({ id: rule.id, subject: subject ?? null });
    if (subject === undefined) continue;
    used.add(subject);
    for (const [domain, replacement] of Object.entries(
      rule.apply(view(subject))
    )) {
      // Every rule replaces rows of a domain the subject already has, so
      // the subject's block goes back where it was and row order is stable.
      const current = rows.get(domain) ?? [];
      const position = Math.max(
        0,
        current.findIndex((row) => row.USUBJID === subject)
      );
      const others = current.filter((row) => row.USUBJID !== subject);
      rows.set(domain, [
        ...others.slice(0, position),
        ...replacement,
        ...others.slice(position),
      ]);
    }
  }

  return {
    datasets: collected.map((dataset) =>
      withRows(dataset, rows.get(dataset.name) ?? [])
    ),
    applied,
  };
}
