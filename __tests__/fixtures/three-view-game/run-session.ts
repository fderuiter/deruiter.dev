/**
 * A real-time run for the three-view fixture game (#2355), so the session
 * replay helper (#2708) has a seeded, fixed-step session to record.
 *
 * Blips appear on the counter from the session's seeded stream, once per
 * fixed step at a per-second rate. Pressing Add catches the blip closest to
 * expiring and adds one to the count; a blip that expires costs a life, and
 * the run is lost at zero lives. Pause stops the loop, as the pause service
 * does, so paused steps change nothing.
 *
 * The replay action stream uses the action map's names, so a fixture
 * recorded here is written in what a player can press.
 */
import {
  createRng,
  createStepClock,
  defineActions,
  stepChance,
  type ActionName,
  type RngSeed,
  type SessionRng,
  type StepClock,
} from "@/lib/arcade";
import type { CounterState } from "./session";

/** The fixture game's action map. */
export const COUNTER_ACTIONS = defineActions({
  add: { kind: "press", keys: ["Space"], label: "Add one" },
  pause: { kind: "press", keys: ["KeyP"], label: "Pause" },
});

/** An action the player can press: `add` or `pause` (which toggles). */
export type CounterAction = ActionName<typeof COUNTER_ACTIONS>;

/** Blips appear this many times a second on average. */
const BLIP_RATE = 1.5;
/** A new blip lives between these many seconds. */
const BLIP_TTL_MIN = 0.6;
const BLIP_TTL_MAX = 1.4;
const START_LIVES = 3;

/** One blip waiting to be caught. */
export interface CounterBlip {
  readonly id: number;
  /** Seconds left before it expires. */
  readonly ttl: number;
}

/** The run's state: the counter plus what the loop adds. */
export interface CounterRunState extends CounterState {
  readonly lives: number;
  readonly status: "playing" | "paused" | "lost";
  /** Fixed steps the loop has run; paused steps are not counted. */
  readonly step: number;
  readonly blips: readonly CounterBlip[];
  readonly nextBlipId: number;
}

/** The run's session, with `step` to drive its loop one fixed step headlessly. */
export interface CounterRunSession {
  readonly getState: () => CounterRunState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly dispatch: (action: CounterAction) => void;
  readonly rng: SessionRng;
  readonly clock: StepClock;
  /** Runs one fixed step of the loop, or nothing while paused or lost. */
  readonly step: () => void;
}

/**
 * Creates a fresh run.
 *
 * @param seed - The gameplay stream's seed.
 * @returns The session.
 */
export function createCounterRunSession(seed: RngSeed = 0): CounterRunSession {
  const rng = createRng(seed);
  const clock = createStepClock();
  const listeners = new Set<() => void>();
  let state: CounterRunState = {
    count: 0,
    lives: START_LIVES,
    status: "playing",
    step: 0,
    blips: [],
    nextBlipId: 1,
  };

  const commit = (next: CounterRunState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const catchBlip = () => {
    if (state.status !== "playing" || state.blips.length === 0) return;
    let closest = 0;
    state.blips.forEach((blip, index) => {
      if (blip.ttl < state.blips[closest].ttl) closest = index;
    });
    commit({
      ...state,
      count: state.count + 1,
      blips: state.blips.filter((_, index) => index !== closest),
    });
  };

  const togglePause = () => {
    if (state.status === "lost") return;
    commit({
      ...state,
      status: state.status === "paused" ? "playing" : "paused",
    });
  };

  const step = () => {
    if (state.status !== "playing") return;
    const dt = clock.dt;
    const aged = state.blips.map((blip) => ({ ...blip, ttl: blip.ttl - dt }));
    const alive = aged.filter((blip) => blip.ttl > 0);
    const lives = Math.max(0, state.lives - (aged.length - alive.length));
    let nextBlipId = state.nextBlipId;
    if (lives > 0 && rng.chance(stepChance(BLIP_RATE, dt))) {
      alive.push({
        id: nextBlipId,
        ttl: rng.range(BLIP_TTL_MIN, BLIP_TTL_MAX),
      });
      nextBlipId += 1;
    }
    clock.tick();
    commit({
      ...state,
      lives,
      status: lives > 0 ? "playing" : "lost",
      step: clock.getStep(),
      blips: alive,
      nextBlipId,
    });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action) {
      if (action === "add") catchBlip();
      else togglePause();
    },
    rng,
    clock,
    step,
  };
}
