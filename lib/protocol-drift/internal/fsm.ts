/**
 * The workbench state machine. Only the transitions listed here are legal;
 * anything else throws a ProtocolDriftStateError.
 */
import type { SimulationState } from "../types";

/** Thrown when a command asks for an illegal state transition. */
export class ProtocolDriftStateError extends Error {
  readonly from: SimulationState;
  readonly to: SimulationState;

  constructor(from: SimulationState, to: SimulationState) {
    super(`Illegal transition: ${from} -> ${to}`);
    this.name = "ProtocolDriftStateError";
    this.from = from;
    this.to = to;
  }
}

/** Legal next states for each state. */
export const FSM_TRANSITIONS: Readonly<
  Record<SimulationState, readonly SimulationState[]>
> = {
  BRIEF: ["DRAFT"],
  DRAFT: ["VALIDATE"],
  VALIDATE: ["DRAFT", "DEPLOY_READY"],
  DEPLOY_READY: ["PAUSED", "DRAFT"],
  PAUSED: ["RUNNING", "DRAFT", "LOCK_REVIEW", "WAVE_REVIEW"],
  RUNNING: ["PAUSED", "WAVE_REVIEW"],
  WAVE_REVIEW: ["PAUSED", "RUNNING", "DRAFT"],
  LOCK_REVIEW: ["PAUSED", "LOCKED"],
  LOCKED: [],
};

/** True when moving from one state to another is legal. */
export function canTransition(
  from: SimulationState,
  to: SimulationState
): boolean {
  return FSM_TRANSITIONS[from].includes(to);
}

/** Returns the target state, or throws ProtocolDriftStateError. */
export function transition(
  from: SimulationState,
  to: SimulationState
): SimulationState {
  if (!canTransition(from, to)) {
    throw new ProtocolDriftStateError(from, to);
  }
  return to;
}

/** States in which the clock may advance. */
export function clockAdvances(state: SimulationState): boolean {
  return state === "RUNNING" || state === "PAUSED";
}
