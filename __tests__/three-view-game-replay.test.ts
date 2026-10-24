// @vitest-environment node
//
// Replay fixtures for the three-view fixture game (#2355), recorded with the
// session replay helper (#2708). This is the pattern each game's seam issue
// follows: record two to four short runs on main through the action map, then
// the seam PR must reproduce every fixture exactly.
//
// Re-record (only for an intended gameplay change):
//   UPDATE_REPLAY_FIXTURES=1 npx vitest run __tests__/three-view-game-replay.test.ts
import { describe, expect, it } from "vitest";
import {
  expectReplayFixture,
  recordReplay,
  type ReplayAction,
} from "./helpers/session-replay";
import {
  COUNTER_ACTIONS,
  createCounterRunSession,
  type CounterAction,
} from "./fixtures/three-view-game/run-session";

const SEED = 2708;

/** Presses Add every 20 steps in [from, to). */
function adds(from: number, to: number): ReplayAction<CounterAction>[] {
  const actions: ReplayAction<CounterAction>[] = [];
  for (let at = from; at < to; at += 20) actions.push({ at, intent: "add" });
  return actions;
}

const RUNS: readonly {
  readonly name: string;
  readonly steps: number;
  readonly actions: readonly ReplayAction<CounterAction>[];
}[] = [
  // A steady player catches every blip for ten seconds.
  { name: "normal-run", steps: 600, actions: adds(20, 600) },
  // Nobody presses anything, so blips expire until the run is lost.
  { name: "loss", steps: 600, actions: [] },
  // Pause at two seconds, resume three seconds later, play on.
  {
    name: "pause-and-resume",
    steps: 480,
    actions: [
      ...adds(20, 120),
      { at: 120, intent: "pause" },
      { at: 300, intent: "pause" },
      ...adds(320, 480),
    ],
  },
];

function record(run: (typeof RUNS)[number]) {
  return recordReplay(() => createCounterRunSession(SEED), run.actions, {
    seed: SEED,
    steps: run.steps,
  });
}

describe("three-view fixture game replays (#2708)", () => {
  it.each(RUNS)("$name reproduces its fixture", async (run) => {
    for (const action of run.actions) {
      expect(COUNTER_ACTIONS.names).toContain(action.intent);
    }
    const first = record(run);
    expect(record(run)).toStrictEqual(first);
    await expectReplayFixture(`three-view-game/${run.name}`, first);
  });

  it("covers a normal run, a loss and a pause", () => {
    const [normal, loss, paused] = RUNS.map(record);
    expect(normal.state).toMatchObject({ status: "playing", lives: 3 });
    expect(loss.state).toMatchObject({ status: "lost", lives: 0, count: 0 });
    // Paused steps run no loop: 180 of the 480 steps are spent paused.
    expect(paused.state).toMatchObject({ status: "playing", step: 300 });
  });
});
