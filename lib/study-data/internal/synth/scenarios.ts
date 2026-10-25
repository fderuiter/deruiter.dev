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
