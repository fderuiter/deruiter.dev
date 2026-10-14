/**
 * Lasting effects of protocol amendments in Clinical Trial Chaos (#2053).
 *
 * Most amendments act once when they fire (a station scramble, an SAE rush).
 * Two leave a rule in force that the shift has to work through:
 *
 * - `double-signature-audit`: the next `DOUBLE_SIGNATURE_CRF_COUNT` CRFs each
 *   need two signature steps, an authorship signature and an independent
 *   reviewer's countersignature.
 * - `gcp-spot-inspection`: the auditor parks at one station for the
 *   amendment's window, and a misroute to that station counts double toward
 *   suspicion.
 *
 * Every function here is pure and returns new state; the random source is a
 * parameter so tests stay deterministic.
 */
import { clamp } from "../game-utils";
import type {
  AmendmentOutcome,
  AmendmentType,
  AuditorState,
  BIMOInspectionReport,
  CDISCDomain,
  ProtocolAmendment,
} from "./types";

/** CRFs a double-signature audit covers. */
export const DOUBLE_SIGNATURE_CRF_COUNT = 3;

/** Suspicion multiplier for a misroute to the station under inspection. */
export const SPOT_INSPECTION_SUSPICION_MULTIPLIER = 2;

/** An open double-signature audit. */
export interface DoubleSignatureAudit {
  /** CRFs that must be countersigned before the audit closes. */
  required: number;
  /** CRFs countersigned so far. */
  countersigned: number;
}

/** A GCP spot inspection in progress. */
export interface SpotInspection {
  /** The station the auditor watches. */
  stationId: CDISCDomain;
  /** Seconds left in the inspection window. */
  timeRemaining: number;
  /** The window's full length. */
  durationSeconds: number;
  /** Misroutes to the watched station during the window. */
  misroutes: number;
}

/** Every lasting amendment rule in force, plus how earlier ones ended. */
export interface AmendmentEffectsState {
  doubleSignature: DoubleSignatureAudit | null;
  spotInspection: SpotInspection | null;
  outcomes: AmendmentOutcome[];
}

/** Title used in outcomes for each lasting amendment. */
const OUTCOME_TITLES: Readonly<Partial<Record<AmendmentType, string>>> = {
  "double-signature-audit": "Part 11 double-signature audit",
  "gcp-spot-inspection": "GCP spot inspection",
};

/**
 * An empty effects state for a new shift.
 *
 * @returns No rules in force and no outcomes.
 */
export function createAmendmentEffectsState(): AmendmentEffectsState {
  return { doubleSignature: null, spotInspection: null, outcomes: [] };
}

function spotInspectionOutcome(
  inspection: SpotInspection,
  ended: "window" | "shift"
): AmendmentOutcome {
  const misroutes =
    inspection.misroutes === 0
      ? "no misroutes"
      : inspection.misroutes === 1
        ? "1 misroute counted double"
        : `${inspection.misroutes} misroutes counted double`;
  return {
    type: "gcp-spot-inspection",
    title: OUTCOME_TITLES["gcp-spot-inspection"] as string,
    summary:
      ended === "window"
        ? `Inspector observed the ${inspection.stationId} station for ${Math.round(inspection.durationSeconds)}s: ${misroutes}.`
        : `Inspection of the ${inspection.stationId} station was still open when the shift ended: ${misroutes}.`,
    resolved: inspection.misroutes === 0,
  };
}

function doubleSignatureOutcome(
  audit: DoubleSignatureAudit,
  ended: "closed" | "shift"
): AmendmentOutcome {
  return {
    type: "double-signature-audit",
    title: OUTCOME_TITLES["double-signature-audit"] as string,
    summary:
      ended === "closed"
        ? `All ${audit.required} CRFs carried an author signature and an independent reviewer countersignature.`
        : `${audit.countersigned} of ${audit.required} CRFs were countersigned before the shift ended.`,
    resolved: ended === "closed",
  };
}

/**
 * Starts the lasting rule an amendment brings, if it brings one. A new
 * double-signature audit while one is open tops the requirement back up to
 * `DOUBLE_SIGNATURE_CRF_COUNT` uncountersigned CRFs. A new spot inspection
 * closes the previous one and picks a fresh station.
 *
 * @param state - The effects in force.
 * @param amendment - The amendment that just fired.
 * @param stationIds - Stations open on the floor.
 * @param random - Random source returning values in [0, 1).
 * @returns The effects with the new rule in force.
 */
export function beginAmendmentEffect(
  state: AmendmentEffectsState,
  amendment: Pick<ProtocolAmendment, "type" | "durationSeconds">,
  stationIds: readonly CDISCDomain[],
  random: () => number = Math.random
): AmendmentEffectsState {
  if (amendment.type === "double-signature-audit") {
    const open = state.doubleSignature;
    return {
      ...state,
      doubleSignature: {
        required: (open?.countersigned ?? 0) + DOUBLE_SIGNATURE_CRF_COUNT,
        countersigned: open?.countersigned ?? 0,
      },
    };
  }
  if (amendment.type === "gcp-spot-inspection") {
    if (stationIds.length === 0) return state;
    const index = clamp(
      Math.floor(random() * stationIds.length),
      0,
      stationIds.length - 1
    );
    const outcomes = state.spotInspection
      ? [
          ...state.outcomes,
          spotInspectionOutcome(state.spotInspection, "window"),
        ]
      : state.outcomes;
    const duration = Math.max(1, amendment.durationSeconds);
    return {
      ...state,
      outcomes,
      spotInspection: {
        stationId: stationIds[index],
        timeRemaining: duration,
        durationSeconds: duration,
        misroutes: 0,
      },
    };
  }
  return state;
}

/**
 * Signature steps the next CRF needs: two while a double-signature audit is
 * open, otherwise one.
 *
 * @param state - The effects in force.
 * @returns 1 or 2.
 */
export function getRequiredSignatureCount(state: AmendmentEffectsState): 1 | 2 {
  const audit = state.doubleSignature;
  return audit && audit.countersigned < audit.required ? 2 : 1;
}

/**
 * Records a CRF lock. While a double-signature audit is open the lock counts
 * as countersigned; the audit closes once its CRFs are all done.
 *
 * @param state - The effects in force.
 * @returns The new effects and whether this lock closed the audit.
 */
export function recordAmendmentLock(state: AmendmentEffectsState): {
  state: AmendmentEffectsState;
  auditClosed: boolean;
} {
  const audit = state.doubleSignature;
  if (!audit || audit.countersigned >= audit.required) {
    return { state, auditClosed: false };
  }
  const next = { ...audit, countersigned: audit.countersigned + 1 };
  if (next.countersigned >= next.required) {
    return {
      state: {
        ...state,
        doubleSignature: null,
        outcomes: [...state.outcomes, doubleSignatureOutcome(next, "closed")],
      },
      auditClosed: true,
    };
  }
  return { state: { ...state, doubleSignature: next }, auditClosed: false };
}

/**
 * Advances the spot inspection window.
 *
 * @param state - The effects in force.
 * @param deltaSeconds - Seconds to advance; 0 while clocks are held.
 * @returns The new effects and whether the inspection ended this frame.
 */
export function tickAmendmentEffects(
  state: AmendmentEffectsState,
  deltaSeconds: number
): { state: AmendmentEffectsState; inspectionEnded: SpotInspection | null } {
  const inspection = state.spotInspection;
  if (!inspection || !(deltaSeconds > 0)) {
    return { state, inspectionEnded: null };
  }
  const remaining = inspection.timeRemaining - deltaSeconds;
  if (remaining <= 0) {
    return {
      state: {
        ...state,
        spotInspection: null,
        outcomes: [
          ...state.outcomes,
          spotInspectionOutcome(inspection, "window"),
        ],
      },
      inspectionEnded: inspection,
    };
  }
  return {
    state: {
      ...state,
      spotInspection: { ...inspection, timeRemaining: remaining },
    },
    inspectionEnded: null,
  };
}

/**
 * Applies the spot inspection to a misroute. A misroute to the watched
 * station counts `SPOT_INSPECTION_SUSPICION_MULTIPLIER` times toward
 * suspicion and is tallied for the report; any other misroute is unchanged.
 *
 * @param state - The effects in force.
 * @param stationId - The station the CRF was wrongly routed to.
 * @param baseDelta - Suspicion the misroute adds on its own.
 * @returns The new effects, the suspicion to add, and whether it doubled.
 */
export function applySpotInspectionMisroute(
  state: AmendmentEffectsState,
  stationId: CDISCDomain,
  baseDelta: number
): { state: AmendmentEffectsState; suspicionDelta: number; doubled: boolean } {
  const inspection = state.spotInspection;
  if (!inspection || inspection.stationId !== stationId) {
    return { state, suspicionDelta: baseDelta, doubled: false };
  }
  return {
    state: {
      ...state,
      spotInspection: { ...inspection, misroutes: inspection.misroutes + 1 },
    },
    suspicionDelta: baseDelta * SPOT_INSPECTION_SUSPICION_MULTIPLIER,
    doubled: true,
  };
}

/**
 * Parks the auditor at the watched station: they stand still at `x` and
 * inspect. A coffee break, a pause or a Form 483 in progress is left alone.
 *
 * @param auditor - The auditor after this frame's patrol step.
 * @param x - Floor position of the watched station, from 0 to 1.
 * @param stationId - The watched station.
 * @returns The parked auditor.
 */
export function parkAuditorAtStation(
  auditor: AuditorState,
  x: number,
  stationId: CDISCDomain
): AuditorState {
  if (
    auditor.isPaused ||
    auditor.behavior === "coffee_break" ||
    auditor.behavior === "issuing_483"
  ) {
    return auditor;
  }
  return {
    ...auditor,
    x: clamp(Number.isFinite(x) ? x : auditor.x, 0, 1),
    behavior: "inspecting",
    targetStationId: stationId,
    inspectTimer: 0,
  };
}

/**
 * Every outcome for the report, including rules still open when the shift
 * ended.
 *
 * @param state - The effects at the end of the shift.
 * @returns Outcomes in the order they ended, open rules last.
 */
export function summarizeAmendmentOutcomes(
  state: AmendmentEffectsState
): AmendmentOutcome[] {
  const open: AmendmentOutcome[] = [];
  if (state.doubleSignature) {
    open.push(doubleSignatureOutcome(state.doubleSignature, "shift"));
  }
  if (state.spotInspection) {
    open.push(spotInspectionOutcome(state.spotInspection, "shift"));
  }
  return [...state.outcomes, ...open];
}

/**
 * Adds the endless Audit Year and the amendment outcomes to a BIMO report.
 *
 * @param report - The report from `buildInspectionReport`.
 * @param auditYear - The endless Audit Year reached, or null for a campaign.
 * @param effects - The amendment effects at the end of the shift.
 * @returns The annotated report.
 */
export function annotateInspectionReport(
  report: BIMOInspectionReport,
  auditYear: number | null,
  effects: AmendmentEffectsState
): BIMOInspectionReport {
  const outcomes = summarizeAmendmentOutcomes(effects);
  return {
    ...report,
    ...(auditYear !== null ? { auditYear } : {}),
    ...(outcomes.length > 0 ? { amendmentOutcomes: outcomes } : {}),
  };
}
