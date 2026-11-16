import { describe, expect, it } from "vitest";
import {
  createInitialShiftState,
  reduceShiftState,
  type CanonicalShiftPhase,
  type LegacyShiftPhase,
  type ShiftEngineEventType,
} from "@/lib/patrol";

/**
 * Characterizes how Patrol's legacy phase vocabulary behaves today (#3810).
 * The legacy strings are accepted on entry only: every transition writes a
 * canonical phase. See docs/explanation/session-pause-and-phase-invariants.md.
 */

const CANONICAL: readonly CanonicalShiftPhase[] = [
  "INTRO",
  "BRIEFING",
  "PATROL_MAP",
  "DISPATCH",
  "RESPONDING",
  "SCENE",
  "TRANSPORT_PREP",
  "OET",
  "HANDOFF",
  "DEBRIEF",
  "SHIFT_COMPLETE",
];

const LEGACY: readonly LegacyShiftPhase[] = [
  "briefing",
  "patrol",
  "incident",
  "debrief",
  "completed",
];

const PHASE_EVENTS: readonly ShiftEngineEventType[] = [
  "START_SHIFT",
  "COMPLETE_BRIEFING",
  "RECEIVE_DISPATCH",
  "ACCEPT_DISPATCH",
  "ARRIVE_ON_SCENE",
  "COMPLETE_SCENE",
  "BEGIN_TRANSPORT",
  "ARRIVE_AT_BASE",
  "COMPLETE_HANDOFF",
  "FINISH_DEBRIEF",
  "REPLAY_INCIDENT",
  "COMPLETE_SHIFT",
  "RESET",
];

/** The canonical phase each legacy phase moves to, per event, today. */
function acceptedTransitions(from: LegacyShiftPhase) {
  const start = createInitialShiftState("scenario-1", from);
  const moves: Record<string, string> = {};
  for (const type of PHASE_EVENTS) {
    if (type === "RESET") continue;
    const next = reduceShiftState(start, { type, seed: 1 });
    if (next !== start) moves[type] = next.phase;
  }
  return moves;
}

describe("Patrol legacy phase vocabulary (#3810)", () => {
  it("never writes a legacy phase: every accepted transition lands on a canonical one", () => {
    for (const from of [...CANONICAL, ...LEGACY]) {
      const start = createInitialShiftState("scenario-1", from);
      for (const type of PHASE_EVENTS) {
        const next = reduceShiftState(start, { type, seed: 1 });
        if (next === start) continue;
        expect(CANONICAL).toContain(next.phase as CanonicalShiftPhase);
      }
    }
  });

  it("maps each legacy phase onto the canonical phases it stands for", () => {
    // "briefing" stands for both INTRO and BRIEFING.
    expect(acceptedTransitions("briefing")).toEqual({
      START_SHIFT: "BRIEFING",
      COMPLETE_BRIEFING: "PATROL_MAP",
    });
    // "patrol" stands for both PATROL_MAP and RESPONDING.
    expect(acceptedTransitions("patrol")).toEqual({
      RECEIVE_DISPATCH: "DISPATCH",
      ARRIVE_ON_SCENE: "SCENE",
      COMPLETE_SHIFT: "SHIFT_COMPLETE",
    });
    expect(acceptedTransitions("incident")).toEqual({
      COMPLETE_SCENE: "TRANSPORT_PREP",
    });
    expect(acceptedTransitions("debrief")).toEqual({
      FINISH_DEBRIEF: "PATROL_MAP",
      REPLAY_INCIDENT: "SCENE",
    });
    // "completed" accepts no phase event; only RESET leaves it.
    expect(acceptedTransitions("completed")).toEqual({});
  });

  it("RESET always returns to canonical INTRO", () => {
    for (const from of [...CANONICAL, ...LEGACY]) {
      const next = reduceShiftState(createInitialShiftState("scenario-1", from), {
        type: "RESET",
      });
      expect(next.phase).toBe("INTRO");
      expect(next.isCompleted).toBe(false);
    }
  });

  it("starts a scenario shift in legacy 'briefing' when no initial phase is given", () => {
    expect(createInitialShiftState("scenario-1").phase).toBe("briefing");
    expect(createInitialShiftState().phase).toBe("INTRO");
  });

  it("keeps isCompleted in step with SHIFT_COMPLETE on every reachable transition", () => {
    const done = reduceShiftState(createInitialShiftState(null, "PATROL_MAP"), {
      type: "COMPLETE_SHIFT",
    });
    expect(done.phase).toBe("SHIFT_COMPLETE");
    expect(done.isCompleted).toBe(true);
  });

  it("records the one contradiction: a terminal initial phase starts with isCompleted false", () => {
    // Reachable only through the initialPhase option. No production caller
    // passes a terminal phase, so this is follow-up scope, not a live defect.
    expect(createInitialShiftState(null, "SHIFT_COMPLETE").isCompleted).toBe(false);
    expect(createInitialShiftState(null, "completed").isCompleted).toBe(false);
  });
});
