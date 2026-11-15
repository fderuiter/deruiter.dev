import type {
  Arm,
  CardFace,
  KmFigure,
  PopulationSnapshot,
  PopulationType,
} from "../types";

/** The Kaplan–Meier checks a figure is validated against. */
export type KmCheck =
  | "TIME_ORIGIN"
  | "MONOTONIC"
  | "ESTIMATE"
  | "CENSOR_TICK"
  | "AT_RISK"
  | "PARENT_AT_RISK"
  | "PARENT_EVENTS";

/** One discrepancy between a KM draft and what its records support. */
export interface KmFinding {
  /** Stable identifier: `<check>@<arm>` plus `t<milestone>` where it applies. */
  id: string;
  check: KmCheck;
  arm: Arm;
  /** The milestone time the finding sits at, or null for the whole curve. */
  milestone: number | null;
  observed: string;
  expected: string;
  evidence: string;
}

/** What one arm's records support, re-derived from the snapshot. */
export interface KmArmExpected {
  arm: Arm;
  /** Subjects in the figure's population with a record: at risk at the origin. */
  n: number;
  events: number;
  /** The true step function, `[time, survival]`, from `[0, 1]`. */
  curve: [number, number][];
  /** Distinct right-censoring times, ascending. */
  censorTicks: number[];
  /** Subjects at risk at each milestone. */
  atRisk: number[];
  /** Survival at each milestone, to three decimals. */
  estimates: number[];
}

/** The validator's output for one KM figure, findings in a stable order. */
export interface KmReport {
  snapshotId: string;
  arms: KmArmExpected[];
  findings: KmFinding[];
}

/** Displayed and expected survival are compared to three decimals. */
export const KM_DECIMALS = 3;

const ARM_NAMES: Readonly<Record<Arm, string>> = {
  PLACEBO: "Placebo",
  ACTIVE: "Active",
};

const round = (v: number) => Number(v.toFixed(KM_DECIMALS));
const fmt = (v: number) => v.toFixed(KM_DECIMALS);

/**
 * The Kaplan–Meier product-limit estimate for one arm's records. At a time
 * with both events and censorings, the events are counted first, so a subject
 * censored at t is still at risk at t. Pure.
 */
export function kaplanMeier(
  records: readonly { time: number; event: boolean }[]
): [number, number][] {
  const curve: [number, number][] = [[0, 1]];
  const eventTimes = [
    ...new Set(records.filter((r) => r.event).map((r) => r.time)),
  ].sort((a, b) => a - b);
  let survival = 1;
  for (const t of eventTimes) {
    const atRisk = records.filter((r) => r.time >= t).length;
    const deaths = records.filter((r) => r.event && r.time === t).length;
    survival *= 1 - deaths / atRisk;
    curve.push([t, survival]);
  }
  return curve;
}

/** A step function's value at time t: the last step at or before t. */
export function stepAt(curve: readonly [number, number][], t: number): number {
  let value = curve[0]?.[1] ?? 1;
  for (const [x, y] of curve) {
    if (x <= t) value = y;
  }
  return value;
}

/** The leading integer of a table cell such as "6" or "2 (33.3)". */
function leadingInt(value: string | undefined): number | null {
  const match = /^\s*(\d+)/.exec(value ?? "");
  return match ? Number(match[1]) : null;
}

/** A parent Table face row's value in an arm's column, or null. */
function parentValue(
  face: CardFace | undefined,
  rowLabel: string,
  arm: Arm
): number | null {
  if (face?.kind !== "TABLE") return null;
  const col = face.columns.findIndex(
    (c) => c.trim().toLowerCase() === ARM_NAMES[arm].toLowerCase()
  );
  const row = face.rows.find((r) => r.label === rowLabel);
  return col === -1 || !row ? null : leadingInt(row.values[col]);
}

/** What one arm's records support in the figure's population. */
function expectedFor(
  km: KmFigure,
  snapshot: PopulationSnapshot,
  population: PopulationType,
  arm: Arm
): KmArmExpected {
  const members = new Map(
    snapshot.subjects
      .filter((s) => s.arm === arm && s.populations.includes(population))
      .map((s) => [s.id, s])
  );
  const records = km.records.filter((r) => members.has(r.subjectId));
  const curve = kaplanMeier(records);
  return {
    arm,
    n: records.length,
    events: records.filter((r) => r.event).length,
    curve,
    censorTicks: [
      ...new Set(records.filter((r) => !r.event).map((r) => r.time)),
    ].sort((a, b) => a - b),
    atRisk: km.milestones.map((t) => records.filter((r) => r.time >= t).length),
    estimates: km.milestones.map((t) => round(stepAt(curve, t))),
  };
}

/**
 * Validates a KM figure draft against the snapshot its records belong to and
 * its parent Table's face. It asserts a fixed time origin, a non-increasing
 * step function, survival estimates, censoring ticks, the Number-at-Risk row
 * at every milestone, and that the subjects at risk at the origin and the
 * event count reconcile with the parent Table. Deterministic and pure.
 */
export function validateKm(
  km: KmFigure,
  snapshot: PopulationSnapshot,
  population: PopulationType,
  parentFace?: CardFace
): KmReport {
  const findings: KmFinding[] = [];
  const arms: KmArmExpected[] = [];
  for (const shown of km.displayed) {
    const { arm } = shown;
    const name = ARM_NAMES[arm];
    const exp = expectedFor(km, snapshot, population, arm);
    arms.push(exp);
    const add = (
      check: KmCheck,
      milestone: number | null,
      observed: string,
      expected: string,
      evidence: string
    ) =>
      findings.push({
        id: `${check}@${arm}${milestone === null ? "" : `t${milestone}`}`,
        check,
        arm,
        milestone,
        observed,
        expected,
        evidence,
      });

    const [x0, y0] = shown.curve[0] ?? [Number.NaN, Number.NaN];
    if (km.timeOrigin !== 0 || x0 !== 0 || y0 !== 1) {
      add(
        "TIME_ORIGIN",
        null,
        `t0=${km.timeOrigin}, starts (${x0}, ${y0})`,
        "t0=0, starts (0, 1)",
        `${name}: the curve must start at the fixed origin, time 0 with every subject event-free.`
      );
    }

    const rise = shown.curve.findIndex(
      ([x, y], i) =>
        i > 0 && (y > shown.curve[i - 1][1] || x < shown.curve[i - 1][0])
    );
    if (rise !== -1) {
      // findIndex returned rise > 0, so both points exist.
      const [x, y] = shown.curve[rise]!;
      add(
        "MONOTONIC",
        null,
        `(${x}, ${fmt(y)}) after (${shown.curve[rise - 1][0]}, ${fmt(shown.curve[rise - 1][1])})`,
        "non-increasing survival",
        `${name}: a Kaplan–Meier curve never rises; survival can only step down at an event.`
      );
    }

    km.milestones.forEach((t, i) => {
      const observed = round(stepAt(shown.curve, t));
      if (observed !== exp.estimates[i]) {
        add(
          "ESTIMATE",
          t,
          fmt(observed),
          fmt(exp.estimates[i]),
          `${name} at ${t} ${km.timeUnit}: the product-limit estimate from ${exp.n} records is ${fmt(exp.estimates[i])}.`
        );
      }
    });

    const ticks = [...new Set(shown.censorTicks)].sort((a, b) => a - b);
    if (ticks.join(",") !== exp.censorTicks.join(",")) {
      add(
        "CENSOR_TICK",
        null,
        ticks.join(", ") || "none",
        exp.censorTicks.join(", ") || "none",
        `${name}: ticks mark right-censored subjects only, at the times they were censored; events are steps, not ticks.`
      );
    }

    km.milestones.forEach((t, i) => {
      if (shown.atRisk[i] !== exp.atRisk[i]) {
        add(
          "AT_RISK",
          t,
          `${shown.atRisk[i]}`,
          `${exp.atRisk[i]}`,
          `${name} at ${t} ${km.timeUnit}: subjects still under observation (time ≥ ${t}), including anyone with an event or censoring at ${t}.`
        );
      }
    });

    const parentN = parentValue(parentFace, km.parent.atRiskRow, arm);
    if (parentN !== null && parentN !== exp.n) {
      add(
        "PARENT_AT_RISK",
        null,
        `${exp.n} at risk at t0`,
        `${parentN} (${km.parent.atRiskRow})`,
        `${name}: the figure's origin must reconcile with the parent table's ${km.parent.atRiskRow} row.`
      );
    }
    const parentEvents = parentValue(parentFace, km.parent.eventsRow, arm);
    if (parentEvents !== null && parentEvents !== exp.events) {
      add(
        "PARENT_EVENTS",
        null,
        `${exp.events} events`,
        `${parentEvents} (${km.parent.eventsRow})`,
        `${name}: the figure's events must reconcile with the parent table's ${km.parent.eventsRow} row.`
      );
    }
  }
  return { snapshotId: snapshot.id, arms, findings };
}
