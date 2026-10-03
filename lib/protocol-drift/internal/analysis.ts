/**
 * The Analysis Lane: SnapshotHandoff deep-freezes current SDTM rows, and
 * PairAndDerive pairs sitting and standing pressures within one visit.
 * Missing or ambiguous pairs are NOT EVALUABLE; cross-visit joins are
 * rejected as TRACE violations and never produce a row.
 */
import { ORTHOSTATIC_THRESHOLDS, STUDY_ID } from "../presets";
import type {
  ADaMVitalSignRecord,
  PairAndDeriveResult,
  SDTMVitalSignRecord,
  TraceViolation,
} from "../types";
import { formatDisplay } from "./chips";

/** Recursively freezes a value and returns it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * SnapshotHandoff: copies the current (non-superseded) SDTM VS rows and
 * deep-freezes the copy, so nothing in the Analysis Lane can mutate the
 * tabulation ledger.
 */
export function snapshotHandoff(
  records: readonly SDTMVitalSignRecord[]
): readonly SDTMVitalSignRecord[] {
  const copy = records.filter((r) => !r.superseded).map((r) => ({ ...r }));
  return deepFreeze(copy);
}

/** The key that identifies one visit instance. */
export function visitKey(usubjid: string, visitnum: number): string {
  return `${usubjid}|${visitnum}`;
}

type DropParam = "OSBPDRP" | "ODBPDRP";

const PARAM_NAMES = {
  OSBPDRP: "Orthostatic Systolic Pressure Drop",
  ODBPDRP: "Orthostatic Diastolic Pressure Drop",
} as const;

/**
 * Pairs one sitting and one standing record. Returns a TRACE violation when
 * they belong to different subjects, visits or tests, or the positions are
 * wrong; otherwise the derived ADVS row.
 */
export function pairMeasurements(
  sitting: SDTMVitalSignRecord,
  standing: SDTMVitalSignRecord
): ADaMVitalSignRecord | TraceViolation {
  if (
    sitting.USUBJID !== standing.USUBJID ||
    sitting.VISITNUM !== standing.VISITNUM ||
    sitting.VSTESTCD !== standing.VSTESTCD ||
    sitting.VSPOS !== "SITTING" ||
    standing.VSPOS !== "STANDING" ||
    sitting.VSTESTCD === "PULSE"
  ) {
    return {
      code: "TRACE",
      USUBJID: sitting.USUBJID,
      sittingRecordId: sitting.recordId,
      standingRecordId: standing.recordId,
      message: `Cross-visit or mismatched pairing rejected: ${sitting.USUBJID} ${sitting.VISIT} ${sitting.VSTESTCD}/${sitting.VSPOS} with ${standing.USUBJID} ${standing.VISIT} ${standing.VSTESTCD}/${standing.VSPOS}`,
    };
  }
  const param: DropParam = sitting.VSTESTCD === "SYSBP" ? "OSBPDRP" : "ODBPDRP";
  const aval = sitting.VSSTRESN - standing.VSSTRESN;
  const precision =
    sitting.precision > standing.precision
      ? sitting.precision
      : standing.precision;
  const threshold =
    param === "OSBPDRP"
      ? ORTHOSTATIC_THRESHOLDS.sbpDrop
      : ORTHOSTATIC_THRESHOLDS.dbpDrop;
  return {
    rowId: `advs-${sitting.USUBJID}-d${sitting.VISITNUM}-${param}`,
    STUDYID: STUDY_ID,
    USUBJID: sitting.USUBJID,
    PARAMCD: param,
    PARAM: PARAM_NAMES[param],
    AVISIT: sitting.VISIT,
    AVISITN: sitting.VISITNUM,
    AVAL: aval,
    AVALC: formatDisplay(aval, precision),
    BASE: sitting.VSSTRESN,
    CHG: standing.VSSTRESN - sitting.VSSTRESN,
    CRIT1: "Orthostatic Hypotension",
    CRIT1FL: aval >= threshold ? "Y" : "N",
    ANL01FL: "Y",
    sourceSittingRecordId: sitting.recordId,
    sourceStandingRecordId: standing.recordId,
    derivationRule: "ORTHO_DELTA_V1",
    stale: false,
    marker: "A",
    precision,
  };
}

function notEvaluable(
  usubjid: string,
  visitnum: number,
  visit: string,
  paramcd: ADaMVitalSignRecord["PARAMCD"],
  reason: string,
  sittingId: string | null
): ADaMVitalSignRecord {
  return {
    rowId: `advs-${usubjid}-d${visitnum}-${paramcd}-NE`,
    STUDYID: STUDY_ID,
    USUBJID: usubjid,
    PARAMCD: paramcd,
    PARAM:
      paramcd === "ORTHOST"
        ? "Orthostatic Assessment Status"
        : PARAM_NAMES[paramcd],
    AVISIT: visit,
    AVISITN: visitnum,
    AVAL: null,
    AVALC: "NOT EVALUABLE",
    BASE: null,
    CHG: null,
    ANL01FL: "N",
    sourceSittingRecordId: sittingId,
    sourceStandingRecordId: null,
    derivationRule: "ORTHO_DELTA_V1",
    stale: false,
    marker: "A",
    precision: 0,
    reason,
  };
}

/** Options for PairAndDerive. */
export interface PairOptions {
  /** "visit" joins on USUBJID x VISITNUM; "subject" is the cross-visit trap. */
  joinKey?: "visit" | "subject";
}

/**
 * PairAndDerive over a snapshot. Visits without any standing measurement
 * yield one ORTHOST NOT EVALUABLE entry; a parameter with zero or several
 * candidates yields a per-parameter NOT EVALUABLE entry. With joinKey
 * "subject" every cross-visit candidate pair is rejected as TRACE.
 */
export function pairAndDerive(
  snapshot: readonly SDTMVitalSignRecord[],
  options: PairOptions = {}
): PairAndDeriveResult {
  const current = snapshot.filter((r) => !r.superseded);
  const visits = new Map<string, SDTMVitalSignRecord[]>();
  for (const r of current) {
    const k = visitKey(r.USUBJID, r.VISITNUM);
    visits.set(k, [...(visits.get(k) ?? []), r]);
  }
  const keys = Array.from(visits.keys()).sort((a, b) => {
    const [sa, va] = a.split("|");
    const [sb, vb] = b.split("|");
    return sa === sb ? Number(va) - Number(vb) : sa < sb ? -1 : 1;
  });
  const adamRows: ADaMVitalSignRecord[] = [];
  const unpaired: ADaMVitalSignRecord[] = [];
  const traceViolations: TraceViolation[] = [];

  for (const k of keys) {
    const recs = visits.get(k) as SDTMVitalSignRecord[];
    const { USUBJID, VISITNUM, VISIT } = recs[0];
    const pick = (test: string, pos: string) =>
      recs.filter((r) => r.VSTESTCD === test && r.VSPOS === pos);
    const standing = recs.filter((r) => r.VSPOS === "STANDING");
    const sitSbp = pick("SYSBP", "SITTING");
    if (standing.length === 0) {
      unpaired.push(
        notEvaluable(
          USUBJID,
          VISITNUM,
          VISIT,
          "ORTHOST",
          recs[0].protocolVersion === "v1"
            ? "Collected under protocol v1: no standing measurement exists"
            : "No standing measurement recorded for this visit",
          sitSbp[0]?.recordId ?? null
        )
      );
      continue;
    }
    for (const [test, param] of [
      ["SYSBP", "OSBPDRP"],
      ["DIABP", "ODBPDRP"],
    ] as const) {
      const sit = pick(test, "SITTING");
      const stand = pick(test, "STANDING");
      if (sit.length !== 1 || stand.length !== 1) {
        unpaired.push(
          notEvaluable(
            USUBJID,
            VISITNUM,
            VISIT,
            param,
            `Expected exactly one sitting and one standing ${test}; found ${sit.length} and ${stand.length}`,
            sit[0]?.recordId ?? null
          )
        );
        continue;
      }
      adamRows.push(pairMeasurements(sit[0], stand[0]) as ADaMVitalSignRecord);
    }
  }

  if (options.joinKey === "subject") {
    const sitting = current.filter(
      (r) => r.VSPOS === "SITTING" && r.VSTESTCD !== "PULSE"
    );
    const standing = current.filter((r) => r.VSPOS === "STANDING");
    for (const s of sitting) {
      for (const t of standing) {
        if (
          s.USUBJID === t.USUBJID &&
          s.VSTESTCD === t.VSTESTCD &&
          s.VISITNUM !== t.VISITNUM
        ) {
          traceViolations.push(pairMeasurements(s, t) as TraceViolation);
        }
      }
    }
  }

  return { adamRows, unpaired, traceViolations };
}
