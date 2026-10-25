/**
 * The risk signal log (#2631): every signal from raising to closing, kept
 * as an append-only list. Appending never changes an earlier entry; it
 * returns a new log with one more entry, after checking that the step
 * follows from the signal's state: raised, then assessed, then actioned any
 * number of times, then closed. A signal assessed as needing no action may
 * close straight from assessment, with the reason in its note.
 */
import type {
  RiskSignalEvent,
  RiskSignalLogEntry,
  RiskSignalLogFinding,
  RiskSignalSource,
} from "../../types";
import { RISK_SIGNAL_ACTIONS } from "./library";

/** What may follow each event; `none` is a signal not yet raised. */
const NEXT: Readonly<
  Record<RiskSignalEvent | "none", readonly RiskSignalEvent[]>
> = {
  none: ["raised"],
  raised: ["assessed"],
  assessed: ["actioned", "closed"],
  actioned: ["actioned", "closed"],
  closed: [],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A new entry, before the log gives it its sequence number. */
export type RiskSignalLogInput = Omit<RiskSignalLogEntry, "sequence">;

/** Why an entry cannot follow the entries before it, or `null` when it can. */
function problem(
  before: readonly RiskSignalLogEntry[],
  entry: RiskSignalLogInput
): string | null {
  if (!ISO_DATE.test(entry.on)) return `date ${entry.on} is not YYYY-MM-DD`;
  if (entry.by.trim() === "") return "an entry must say who recorded it";
  if (entry.note.trim() === "")
    return "an entry must say what was found, decided or done";
  const history = before.filter((e) => e.signalId === entry.signalId);
  const last = history.at(-1);
  const allowed = NEXT[last?.event ?? "none"];
  if (!allowed.includes(entry.event)) {
    return last === undefined
      ? `signal ${entry.signalId} must be raised before it is ${entry.event}`
      : `signal ${entry.signalId} cannot be ${entry.event} after it was ${last.event}`;
  }
  if (last !== undefined && entry.on < last.on) {
    return `signal ${entry.signalId} cannot step back from ${last.on} to ${entry.on}`;
  }
  if ((entry.event === "raised") !== (entry.source !== null)) {
    return "a source belongs on the raised entry, and only there";
  }
  if ((entry.event === "actioned") !== (entry.action !== null)) {
    return "an action belongs on actioned entries, and only there";
  }
  if (entry.action !== null && !(entry.action in RISK_SIGNAL_ACTIONS)) {
    return `unknown action ${entry.action}`;
  }
  return null;
}

/**
 * Appends one entry to a risk signal log.
 *
 * @param log - The log so far; it is not changed.
 * @param entry - The new entry, without its sequence number.
 * @returns A new, frozen log with the entry at the end.
 * @throws Error when the entry does not follow from the signal's state.
 */
export function appendRiskSignal(
  log: readonly RiskSignalLogEntry[],
  entry: RiskSignalLogInput
): readonly RiskSignalLogEntry[] {
  const reason = problem(log, entry);
  if (reason !== null) throw new Error(reason);
  return Object.freeze([
    ...log,
    Object.freeze({ ...entry, sequence: log.length + 1 }),
  ]);
}

/**
 * Checks a risk signal log, for example one read back from storage, against
 * the rules `appendRiskSignal` enforces.
 *
 * @param log - The log to check.
 * @returns One finding per entry that breaks a rule; empty when the log is sound.
 */
export function checkRiskSignalLog(
  log: readonly RiskSignalLogEntry[]
): RiskSignalLogFinding[] {
  const findings: RiskSignalLogFinding[] = [];
  log.forEach((entry, index) => {
    if (entry.sequence !== index + 1) {
      findings.push({
        sequence: entry.sequence,
        message: `entry ${index + 1} carries sequence ${entry.sequence}`,
      });
    }
    const reason = problem(log.slice(0, index), entry);
    if (reason !== null)
      findings.push({ sequence: entry.sequence, message: reason });
  });
  return findings;
}

/**
 * The state of each signal in a log: its last event.
 *
 * @param log - A risk signal log.
 * @returns Each signal id with its last event, in the order signals were raised.
 */
export function riskSignalStates(
  log: readonly RiskSignalLogEntry[]
): { readonly signalId: string; readonly event: RiskSignalEvent }[] {
  const states = new Map<string, RiskSignalEvent>();
  for (const entry of log) states.set(entry.signalId, entry.event);
  return [...states].map(([signalId, event]) => ({ signalId, event }));
}

/** A signal to raise: where it came from and what was found. */
export interface RaisedSignal {
  readonly source: RiskSignalSource;
  readonly note: string;
}

/** Who raises signals at a data cut. */
export const AUTOMATED_MONITORING = "Central monitoring (automated)";

/**
 * Raises signals in a new log, numbered per study in the order given.
 *
 * @param studyId - The study the signals belong to.
 * @param on - ISO 8601 date they are raised, the data cut.
 * @param signals - What to raise.
 * @returns A new, frozen log with one `raised` entry per signal.
 */
export function raiseRiskSignals(
  studyId: string,
  on: string,
  signals: readonly RaisedSignal[]
): readonly RiskSignalLogEntry[] {
  return signals.reduce<readonly RiskSignalLogEntry[]>(
    (log, signal, index) =>
      appendRiskSignal(log, {
        signalId: `${studyId}-SIG-${String(index + 1).padStart(3, "0")}`,
        event: "raised",
        on,
        by: AUTOMATED_MONITORING,
        note: signal.note,
        source: signal.source,
        action: null,
      }),
    Object.freeze([])
  );
}
