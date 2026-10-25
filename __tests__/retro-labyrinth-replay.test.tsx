// @vitest-environment jsdom
//
// Replay fixtures for Retro Labyrinth (#2376), recorded on main with the
// session replay helper (#2708) before the session seam moves the game out
// of `components/RetroLabyrinth.tsx`. The seam must reproduce every fixture
// exactly.
//
// The runs drive the room the way a player does: key presses on the
// playfield, one animation frame per step. Since the seam the keys reach the
// session through the action map, and the room's view reads it back. The
// recorded state is what the player and a screen reader can read: the
// telemetry group's grid, cells and outputs, and the playfield's text.
//
// Re-record (only for an intended gameplay change):
//   UPDATE_REPLAY_FIXTURES=1 npx vitest run __tests__/retro-labyrinth-replay.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  expectReplayFixture,
  recordReplay,
  type ReplayAction,
  type ReplaySession,
} from "./helpers/session-replay";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playSuccess: () => {},
      playNote: () => {},
      playHover: () => {},
    }),
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: () => Promise.resolve(true) }),
}));

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { safeStorage } from "@/lib/safe-storage";

/** A key the player presses on the playfield, as `KeyboardEvent.key`. */
type LabyrinthKey = string;

/** The physical key a real keyboard sends with each `key` the runs use. */
const KEY_CODES: Readonly<Record<string, string>> = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  " ": "Space",
  "1": "Digit1",
  "2": "Digit2",
  "3": "Digit3",
  "4": "Digit4",
  c: "KeyC",
  p: "KeyP",
  r: "KeyR",
  Enter: "Enter",
  Escape: "Escape",
};

const SEED = 2376;

/** The shortest walk from the start to the exit of the first room. */
const TO_EXIT: readonly LabyrinthKey[] = [
  ...Array<LabyrinthKey>(2).fill("ArrowRight"),
  ...Array<LabyrinthKey>(2).fill("ArrowDown"),
  ...Array<LabyrinthKey>(2).fill("ArrowRight"),
  ...Array<LabyrinthKey>(2).fill("ArrowUp"),
  ...Array<LabyrinthKey>(8).fill("ArrowRight"),
  ...Array<LabyrinthKey>(6).fill("ArrowDown"),
];

const mounted: { root: Root; container: HTMLElement }[] = [];

function labyrinthSession(): ReplaySession<HTMLElement, LabyrinthKey> {
  // Every run starts from a first visit: no high score, profile or settings.
  localStorage.clear();
  safeStorage.clearCache();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => {
    root.render(<RetroLabyrinth isMounted />);
  });
  const playfield = () => {
    const found = container.querySelector<HTMLElement>(
      '[data-field-manual="retro-labyrinth"]'
    );
    if (!found) throw new Error("the playfield is not rendered");
    return found;
  };
  return {
    getState: () => container,
    dispatch: (key) => {
      const code = KEY_CODES[key];
      if (!code) throw new Error(`no key code for ${JSON.stringify(key)}`);
      // A player clicks the playfield first, and keys only act inside it.
      const target = playfield();
      if (!target.contains(document.activeElement)) target.focus();
      const init = { key, code, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent("keydown", init));
      target.dispatchEvent(new KeyboardEvent("keyup", init));
    },
    act: (work) => act(work),
  };
}

/** What a player and a screen reader can read off the game. */
function readGame(container: HTMLElement) {
  const telemetry = container.querySelector<HTMLElement>(
    '[aria-label="Dungeon Telemetry and Status"]'
  );
  if (!telemetry) throw new Error("the telemetry group is not rendered");
  const data: Record<string, string> = {};
  for (const name of telemetry.getAttributeNames().sort()) {
    if (name.startsWith("data-")) data[name] = telemetry.getAttribute(name)!;
  }
  const outputs = Array.from(telemetry.querySelectorAll("output")).map(
    (output) => (output.textContent ?? "").replace(/\s+/g, " ").trim()
  );
  const text = (container.textContent ?? "").replace(/\s+/g, " ").trim();
  return { data, outputs, text };
}

afterEach(() => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!;
    act(() => root.unmount());
    container.remove();
  }
  localStorage.clear();
});

function readOutputs(state: unknown): readonly unknown[] {
  return typeof state === "object" &&
    state !== null &&
    "outputs" in state &&
    Array.isArray(state.outputs)
    ? state.outputs
    : [];
}

function presses(
  at: number,
  keys: readonly LabyrinthKey[],
  every = 6
): ReplayAction<LabyrinthKey>[] {
  return keys.map((intent, index) => ({ at: at + index * every, intent }));
}

const RUNS: readonly {
  readonly name: string;
  readonly steps: number;
  readonly actions: readonly ReplayAction<LabyrinthKey>[];
}[] = [
  // Walk the first room's shortest path into its two drones, taking hits.
  { name: "walk", steps: 400, actions: presses(10, TO_EXIT, 5) },
  // Stand in the drones until the trace ends the run, then retry with R.
  {
    name: "caught",
    steps: 1500,
    actions: [...presses(10, TO_EXIT, 5), { at: 1400, intent: "r" }],
  },
  // EMP the drones, run to the exit, then Enter past the reward into room 2.
  {
    name: "emp-dash",
    steps: 600,
    actions: [
      { at: 5, intent: " " },
      ...presses(8, TO_EXIT, 3),
      ...presses(300, ["Enter", "Enter", "Enter"], 30),
    ],
  },
  // Fire tools, press an empty slot, toggle the scanlines.
  {
    name: "tools",
    steps: 300,
    actions: presses(
      10,
      ["1", "2", "4", "c", "ArrowRight", "3", "ArrowRight", "1"],
      12
    ),
  },
  // Pause with P four seconds in, resume with Escape, walk on.
  {
    name: "pause",
    steps: 480,
    actions: [
      ...presses(10, TO_EXIT.slice(0, 6), 5),
      { at: 60, intent: "p" },
      { at: 300, intent: "Escape" },
      ...presses(320, TO_EXIT.slice(6), 5),
    ],
  },
];

function record(run: (typeof RUNS)[number]) {
  return recordReplay(labyrinthSession, run.actions, {
    seed: SEED,
    steps: run.steps,
    select: readGame,
  });
}

describe("Retro Labyrinth replays (#2376)", () => {
  it.each(RUNS)("$name reproduces its fixture", async (run) => {
    const first = record(run);
    expect(record(run)).toStrictEqual(first);
    await expectReplayFixture(`retro-labyrinth/${run.name}`, first);
  });

  it("covers damage, a retry, a cleared room, the tools and a pause", () => {
    const outputs = (name: string) => {
      const run = RUNS.find((candidate) => candidate.name === name)!;
      return readOutputs(record(run).state);
    };
    expect(outputs("walk")).toContain("Cyberdeck Integrity: 5 / 80 HP");
    expect(outputs("caught")).toContain("Player Location: Grid (1, 1)");
    expect(outputs("emp-dash")).toContain("Stage: 2");
    expect(outputs("tools")).toContain("Player Location: Grid (3, 1)");
    expect(outputs("pause")).toContain("Player Location: Grid (11, 7)");
  });
});
