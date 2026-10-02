// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BACK_DOOR_BOUNDS,
  activeCodeBurst,
  applyKongToy,
  createInitialDuckGameState,
  dragDuckTo,
  giveTreat,
  performTrick,
  releaseDuck,
  startDraggingDuck,
  stepDuckGame,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

const TICKS_PER_SECOND = 60;
const MAX_TICKS = TICKS_PER_SECOND * 300;

/** Deterministic Math.random so each seed replays the same sprint. */
function seedRandom(seed: number) {
  let value = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  });
}

function startSprint(level: number): WorkingWithDuckState {
  return { ...createInitialDuckGameState(level), status: "running" };
}

function playIdle(level: number): WorkingWithDuckState {
  let state = startSprint(level);
  for (let t = 0; t < MAX_TICKS && state.status === "running"; t++) {
    state = stepDuckGame(state);
  }
  return state;
}

/** Answers each interruption after one second and taps Code Burst twice a second. */
function playAttentively(level: number): WorkingWithDuckState {
  let state = startSprint(level);
  let unhandledTicks = 0;
  for (let t = 1; t <= MAX_TICKS && state.status === "running"; t++) {
    state = stepDuckGame(state);
    const duckState = state.duck.state;
    const needsPlayer =
      duckState === "SNIFFING_POTTY" ||
      duckState === "SNEAKY_CHEW" ||
      duckState === "ZOOMIES" ||
      duckState === "NO_TAKE_THROW";
    unhandledTicks = needsPlayer ? unhandledTicks + 1 : 0;
    if (unhandledTicks >= TICKS_PER_SECOND) {
      unhandledTicks = 0;
      if (duckState === "SNIFFING_POTTY") {
        state = startDraggingDuck(state);
        state = dragDuckTo(
          state,
          BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width / 2,
          BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height / 2
        );
        state = releaseDuck(state);
      } else if (duckState === "SNEAKY_CHEW") {
        state = applyKongToy(state, state.duck.x, state.duck.y);
      } else if (duckState === "NO_TAKE_THROW") {
        state = giveTreat(state);
      } else {
        state = performTrick(state, "SIT");
      }
    }
    if (t % 30 === 0) state = activeCodeBurst(state);
  }
  return state;
}

describe("Working With Duck idle balance (#1176)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([1, 2, 3, 4, 5])(
    "an idle player cannot finish sprint %i",
    (level) => {
      for (const seed of [1, 7, 42, 1234, 99991]) {
        seedRandom(seed);
        expect(playIdle(level).status).not.toBe("won");
        vi.restoreAllMocks();
      }
    }
  );

  it.each([1, 2, 3, 4, 5])(
    "a player who handles Duck finishes sprint %i",
    (level) => {
      for (const seed of [1, 7, 42, 1234, 99991]) {
        seedRandom(seed);
        expect(playAttentively(level).status).toBe("won");
        vi.restoreAllMocks();
      }
    }
  );
});
