// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETUP,
  IDLE_FRAME,
  LEVEL_SECONDS,
  RELAXED_LEVEL_SECONDS,
  clockLabel,
  createLevel,
  stepGame,
  type Frame,
  type GameEvent,
  type GameState,
  type Setup,
} from "@/lib/for-better-or-bulk";

/** The seed-12345 day from the playtest: Yes roses, helper off, standard clock. */
const SEED_12345: Setup = {
  ...DEFAULT_SETUP,
  cart: { roses: "yes", food: "enough", lanterns: true },
  seed: 12345,
};

function untilBrothers(state: GameState): GameState {
  let current = state;
  while (current.phase === "playing")
    current = stepGame(current, IDLE_FRAME).state;
  return current;
}

/** Steps a level to its end, collecting every event with the time it fired at. */
function playToEnd(
  start: GameState,
  frameAt: (tick: number) => Frame
): { state: GameState; fredReturnedAt: number | null; events: GameEvent[] } {
  let state = start;
  let fredReturnedAt: number | null = null;
  const events: GameEvent[] = [];
  while (state.phase !== "done") {
    const result = stepGame(state, frameAt(state.tick));
    state = result.state;
    events.push(...result.events);
    if (result.events.some((e) => e.type === "fred-returned")) {
      fredReturnedAt = state.time;
    }
  }
  return { state, fredReturnedAt, events };
}

describe("the clock label on an exact minute", () => {
  it("reads every minute of both clocks as that minute, never one before", () => {
    for (const duration of [LEVEL_SECONDS, RELAXED_LEVEL_SECONDS]) {
      for (let minute = 0; minute <= 420; minute++) {
        const time = (duration * minute) / 420;
        const wall = 9 * 60 + minute;
        const hour12 = ((Math.floor(wall / 60) + 11) % 12) + 1;
        const expected = `${hour12}:${String(wall % 60).padStart(2, "0")}`;
        expect(clockLabel(time, duration), `${duration}s at ${minute}`).toBe(
          expected
        );
      }
    }
  });
});

describe("Fred's return after leaving with his brothers", () => {
  it("returns him at the time the leave option promises (3:18 on seed 12345)", () => {
    const text = untilBrothers(createLevel(SEED_12345));
    expect(clockLabel(text.time + 70, text.duration)).toBe("3:18");
    const left = stepGame(text, {
      ...IDLE_FRAME,
      decision: { choice: "leave", commitment: null },
    }).state;
    expect(left.returnsAt).toBeCloseTo(180, 5);

    const { state, fredReturnedAt, events } = playToEnd(left, () => IDLE_FRAME);
    expect(fredReturnedAt).not.toBeNull();
    expect(fredReturnedAt).toBeCloseTo(180, 1);
    expect(events).toContainEqual({ type: "fred-returned" });
    expect(state.players.fred.presence).toBe("here");
    expect(state.returnsAt).toBeNull();
  });

  it("still returns him while Abbi works through the whole day", () => {
    const text = untilBrothers(createLevel(SEED_12345));
    const left = stepGame(text, {
      ...IDLE_FRAME,
      decision: { choice: "leave", commitment: null },
    }).state;
    const busy = (tick: number): Frame => ({
      inputs: {
        fred: IDLE_FRAME.inputs.fred,
        abbi: {
          moveX: Math.floor(tick / 30) % 2 === 0 ? 1 : -1,
          moveY: 0,
          interact: tick % 9 === 0,
          interactHeld: tick % 9 === 0,
          work: tick % 4 === 0,
        },
      },
    });
    const { fredReturnedAt, state } = playToEnd(left, busy);
    expect(fredReturnedAt).toBeCloseTo(180, 1);
    expect(state.players.fred.presence).toBe("here");
  });

  it("returns him on the relaxed clock too", () => {
    const relaxed: Setup = { ...SEED_12345, relaxed: true };
    const left = stepGame(untilBrothers(createLevel(relaxed)), {
      ...IDLE_FRAME,
      decision: { choice: "leave", commitment: null },
    }).state;
    const { fredReturnedAt } = playToEnd(left, () => IDLE_FRAME);
    expect(fredReturnedAt).toBeCloseTo(297, 1);
  });
});
