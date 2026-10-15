import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  createLevel,
  DEFAULT_SETUP,
  getHint,
  getPrompt,
  interactKeyName,
  workKeyName,
  type Frame,
  type GameState,
} from "@/lib/for-better-or-bulk";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import {
  STICK_DEAD_ZONE,
  stickCodes,
  TOUCH_KEYS,
} from "@/components/for-better-or-bulk/touch-input";
import { requestFbbAutoPause } from "@/components/for-better-or-bulk/auto-pause";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const engine = vi.hoisted(() => ({ inputs: [] as Frame[] }));

vi.mock("@/components/for-better-or-bulk/sfx", () => ({
  playSfx: vi.fn(),
}));

vi.mock("@/lib/for-better-or-bulk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/for-better-or-bulk")>();
  return {
    ...actual,
    stepGame: (state: GameState, input: Frame) => {
      engine.inputs.push(input);
      return actual.stepGame(state, input);
    },
  };
});

vi.mock("@/hooks/useAnimationFrame", () => ({
  useAnimationFrame: (
    callback: (deltaMs: number) => void,
    options: { isActive?: boolean } = {}
  ) => {
    frame.callback = callback;
    frame.active = options.isActive ?? true;
  },
}));

import { ForBetterOrBulkGame } from "@/components/for-better-or-bulk/ForBetterOrBulkGame";

/** Runs the loop in quarter-second frames until a condition holds. */
function runUntil(done: () => boolean, maxFrames = 400) {
  for (let i = 0; i < maxFrames && !done(); i++) {
    act(() => {
      if (frame.active) frame.callback?.(250);
    });
  }
}

/** Runs the loop for a number of quarter-second frames. */
function runFrames(count: number) {
  runUntil(() => false, count);
}

function game(): HTMLElement {
  return screen.getByTestId("fbb-game");
}

function renderTouch(props: React.ComponentProps<typeof ForBetterOrBulkGame>) {
  return render(
    <CabinetTouchContext.Provider value={true}>
      <ForBetterOrBulkGame {...props} />
    </CabinetTouchContext.Provider>
  );
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
}

/** Gives a drag pad a 100px box at the origin, so a finger's offset has a size. */
function sizePad(pad: HTMLElement) {
  vi.spyOn(pad, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 100 })
  );
}

function lastInput(): Frame {
  const last = engine.inputs[engine.inputs.length - 1];
  if (!last) throw new Error("no engine step ran");
  return last;
}

const SOLO: typeof DEFAULT_SETUP = { ...DEFAULT_SETUP, assist: false };

describe("For Better or Bulk drag pad directions (#2123)", () => {
  const keys = TOUCH_KEYS.fred;

  it("holds nothing inside the dead zone or for a bad offset", () => {
    expect(stickCodes(0, 0, keys)).toEqual([]);
    expect(stickCodes(STICK_DEAD_ZONE * 0.9, 0, keys)).toEqual([]);
    expect(stickCodes(Number.NaN, 0.5, keys)).toEqual([]);
    expect(stickCodes(Number.POSITIVE_INFINITY, 0, keys)).toEqual([]);
  });

  it("snaps to eight directions, a diagonal holding two keys", () => {
    expect(stickCodes(1, 0, keys)).toEqual(["KeyD"]);
    expect(stickCodes(-1, 0.1, keys)).toEqual(["KeyA"]);
    expect(stickCodes(0, -1, keys)).toEqual(["KeyW"]);
    expect(stickCodes(0.05, 1, keys)).toEqual(["KeyS"]);
    expect(stickCodes(0.7, 0.7, keys)).toEqual(["KeyS", "KeyD"]);
    expect(stickCodes(-0.7, -0.7, keys)).toEqual(["KeyW", "KeyA"]);
    expect(stickCodes(-0.7, 0.7, TOUCH_KEYS.abbi)).toEqual([
      "ArrowDown",
      "ArrowLeft",
    ]);
  });
});

describe("For Better or Bulk touch copy (#2123)", () => {
  it("names the dock's keys on touch and the keyboard's otherwise", () => {
    expect(interactKeyName("fred", true, true)).toBe("Use");
    expect(workKeyName("abbi", false, true)).toBe("Work");
    expect(interactKeyName("fred", true)).toBe("E");
    expect(workKeyName("abbi", false)).toBe("F or Shift");
  });

  it("tells the idle partner's line to Swap rather than Tab on touch", () => {
    const state = createLevel(SOLO);
    expect(getPrompt(state, "fred", { waiting: true }).status).toContain(
      "Tab to switch to him."
    );
    expect(
      getPrompt(state, "fred", { waiting: true, touch: true }).status
    ).toContain("Swap to switch to him.");
  });

  it("coaches with the Work key on touch", () => {
    const level = createLevel(SOLO);
    // Roses waiting on the arrange table: the coach says which key to hold.
    const state: GameState = {
      ...level,
      stations: level.stations.map((station) =>
        station.kind === "arrange"
          ? { ...station, item: { kind: "roses", madeBy: null } }
          : station
      ),
    };
    const keyboard = getHint(state, "abbi") ?? "";
    const touch = getHint(state, "abbi", { touch: true }) ?? "";
    expect(keyboard).toMatch(/F or Shift/);
    expect(touch).toMatch(/hold Work/);
    expect(touch).not.toMatch(/F or Shift/);
  });
});

describe("For Better or Bulk in the touch cabinet (#2123)", () => {
  beforeEach(() => {
    frame.callback = null;
    frame.active = false;
    engine.inputs = [];
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("leaves the desktop cabinet as it was: no dock, no touch class, Escape is the cabinet's", () => {
    render(<ForBetterOrBulkGame initialSetup={SOLO} />);
    expect(screen.getByText(/Tab swaps between Fred and Abbi/)).toBeTruthy();
    start();
    expect(screen.queryByTestId("fbb-touch-dock")).toBeNull();
    expect(game().className).not.toContain("fbb-touch");
    expect(game().getAttribute("data-escape-docks")).toBeNull();
    expect(game().getAttribute("data-fbb-phase")).toBeNull();
    expect(screen.getByTestId("fbb-active").textContent).toContain(
      "Tab to swap"
    );
  });

  it("names the on-screen keys on the plan screen", () => {
    renderTouch({ initialSetup: SOLO });
    expect(game().className).toContain("fbb-touch");
    expect(game().getAttribute("data-fbb-phase")).toBe("setup");
    expect(
      screen.getByText("Play both. Swap changes between Fred and Abbi.")
    ).toBeTruthy();
    expect(screen.getByText("Two players, one iPad")).toBeTruthy();
    expect(screen.queryByText(/WASD/)).toBeNull();
  });

  it("shows the dock during a day, keeps Escape in the game, and names Swap and Use", () => {
    renderTouch({ initialSetup: SOLO });
    start();
    expect(screen.getByTestId("fbb-touch-dock").dataset.mode).toBe("solo");
    expect(game().getAttribute("data-fbb-phase")).toBe("playing");
    expect(game().getAttribute("data-escape-docks")).toBe("true");
    expect(screen.getByTestId("fbb-active").textContent).toContain(
      "Swap plays Fred"
    );
    expect(screen.getByTestId("fbb-active").textContent).not.toMatch(/Tab/);
    // The idle partner's line names the dock's Swap key.
    expect(screen.getByTestId("fbb-prompt-fred").textContent).toContain(
      "Swap to switch to him."
    );
    expect(screen.getByTestId("fbb-coach").textContent).not.toMatch(
      /F or Shift|E or Enter/
    );
    // Escape still pauses through the game's own keys.
    fireEvent.keyDown(game(), { key: "Escape", code: "Escape" });
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
  });

  it("swaps people from the dock, and says so when the partner is out", () => {
    renderTouch({ initialSetup: SOLO });
    start();
    const swap = screen.getByTestId("fbb-swap");
    expect(swap.getAttribute("aria-label")).toBe("Swap to Fred");
    fireEvent.click(swap);
    expect(screen.getByTestId("fbb-active").textContent).toContain("Fred");
    expect(screen.getByRole("status").textContent).toBe("Now playing as Fred.");
    expect(screen.getByTestId("fbb-swap").getAttribute("aria-label")).toBe(
      "Swap to Abbi"
    );
    fireEvent.click(screen.getByTestId("fbb-swap"));
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");

    runUntil(() => screen.queryByTestId("fbb-brothers") !== null, 4000);
    fireEvent.click(screen.getByRole("button", { name: /Go with them/ }));
    const out = screen.getByTestId("fbb-swap");
    expect(out.getAttribute("aria-disabled")).toBe("true");
    expect(out.getAttribute("aria-label")).toBe(
      "Swap: Fred is out with his brothers"
    );
    fireEvent.click(out);
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    expect(screen.getByRole("status").textContent).toBe(
      "Fred is out with his brothers."
    );
  });

  it("walks Abbi with the drag pad and takes a lantern with Use", () => {
    renderTouch({ initialSetup: SOLO });
    start();
    const pad = screen.getByTestId("fbb-stick-abbi");
    sizePad(pad);
    const prompt = () =>
      screen.getByTestId("fbb-prompt-abbi").textContent ?? "";
    // A finger resting left of the centre walks left, as ArrowLeft does.
    fireEvent.pointerDown(pad, { pointerId: 7, clientX: 5, clientY: 50 });
    expect(pad.hasAttribute("data-active")).toBe(true);
    runUntil(() => prompt().includes("Take the lantern from the LAMP crate"));
    expect(lastInput().inputs.abbi.moveX).toBe(-1);
    expect(lastInput().inputs.abbi.moveY).toBe(0);
    // A second finger cannot take over a pad in use.
    fireEvent.pointerDown(pad, { pointerId: 8, clientX: 95, clientY: 50 });
    fireEvent.pointerUp(pad, { pointerId: 8 });
    expect(pad.hasAttribute("data-active")).toBe(true);
    fireEvent.pointerUp(pad, { pointerId: 7 });
    expect(pad.hasAttribute("data-active")).toBe(false);
    runFrames(1);
    expect(lastInput().inputs.abbi.moveX).toBe(0);
    expect(prompt()).toContain("Use: Take the lantern from the LAMP crate");

    const use = screen.getByTestId("fbb-use-abbi");
    fireEvent.pointerDown(use, { pointerId: 9 });
    fireEvent.pointerUp(use, { pointerId: 9 });
    runUntil(() => prompt().includes("carrying"), 4);
    expect(prompt()).toContain("Abbi is carrying a paper lantern.");
  });

  it("drags on a diagonal and turns as the finger moves", () => {
    renderTouch({ initialSetup: SOLO });
    start();
    const pad = screen.getByTestId("fbb-stick-abbi");
    sizePad(pad);
    fireEvent.pointerDown(pad, { pointerId: 3, clientX: 90, clientY: 90 });
    runFrames(1);
    expect(lastInput().inputs.abbi).toMatchObject({ moveX: 1, moveY: 1 });
    fireEvent.pointerMove(pad, { pointerId: 3, clientX: 50, clientY: 5 });
    runFrames(1);
    expect(lastInput().inputs.abbi).toMatchObject({ moveX: 0, moveY: -1 });
    // A move from a finger that is not on the pad is ignored.
    fireEvent.pointerMove(pad, { pointerId: 4, clientX: 95, clientY: 50 });
    runFrames(1);
    expect(lastInput().inputs.abbi).toMatchObject({ moveX: 0, moveY: -1 });
    fireEvent.pointerCancel(pad, { pointerId: 3 });
    runFrames(1);
    expect(lastInput().inputs.abbi).toMatchObject({ moveX: 0, moveY: 0 });
  });

  it("holds Work while a finger is on it, and lets go on lift", () => {
    renderTouch({ initialSetup: SOLO });
    start();
    const work = screen.getByTestId("fbb-work-abbi");
    fireEvent.pointerDown(work, { pointerId: 2 });
    runFrames(2);
    expect(lastInput().inputs.abbi.work).toBe(true);
    fireEvent.pointerUp(work, { pointerId: 2 });
    runFrames(1);
    expect(lastInput().inputs.abbi.work).toBe(false);
  });

  it("lets a pause end a walk, and takes no dock key while paused", () => {
    renderTouch({ initialSetup: SOLO });
    start();
    const pad = screen.getByTestId("fbb-stick-abbi");
    sizePad(pad);
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: 5, clientY: 50 });
    // On touch, Pause is in the dock rather than the header.
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    fireEvent.click(screen.getByTestId("fbb-pause"));
    expect(pad.hasAttribute("data-active")).toBe(false);
    fireEvent.pointerDown(screen.getByTestId("fbb-use-abbi"), {
      pointerId: 5,
    });
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    runFrames(1);
    expect(lastInput().inputs.abbi).toMatchObject({
      moveX: 0,
      interact: false,
    });
  });

  it("gives each person their own pad, Use and Work in co-op", () => {
    renderTouch({ initialSetup: SOLO, initialMode: "coop" });
    start();
    expect(screen.getByTestId("fbb-touch-dock").dataset.mode).toBe("coop");
    expect(
      document.querySelector('[aria-label="Fred\'s controls"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Abbi\'s controls"]')
    ).not.toBeNull();
    expect(screen.queryByTestId("fbb-swap")).toBeNull();
    expect(
      screen.getByText("Fred on the left · Abbi on the right")
    ).toBeTruthy();
    const fredPad = screen.getByTestId("fbb-stick-fred");
    const abbiPad = screen.getByTestId("fbb-stick-abbi");
    sizePad(fredPad);
    sizePad(abbiPad);
    // Two fingers, one on each pad, walk both people at once.
    fireEvent.pointerDown(fredPad, { pointerId: 1, clientX: 95, clientY: 50 });
    fireEvent.pointerDown(abbiPad, { pointerId: 2, clientX: 50, clientY: 95 });
    fireEvent.pointerDown(screen.getByTestId("fbb-work-fred"), {
      pointerId: 3,
    });
    runFrames(1);
    expect(lastInput().inputs.fred).toMatchObject({
      moveX: 1,
      moveY: 0,
      work: true,
    });
    expect(lastInput().inputs.abbi).toMatchObject({
      moveX: 0,
      moveY: 1,
      work: false,
    });
    // Each person's prompt names their own Use key.
    expect(screen.getByTestId("fbb-prompt-fred").textContent).not.toMatch(
      /\bE:|Enter:/
    );
  });

  it("pauses a running day when the cabinet asks, and only then", () => {
    renderTouch({ initialSetup: SOLO });
    act(() => requestFbbAutoPause());
    expect(screen.getByRole("button", { name: "Start setup" })).toBeTruthy();
    start();
    act(() => requestFbbAutoPause());
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
    expect(frame.active).toBe(false);
    // A second request while paused keeps it paused.
    act(() => requestFbbAutoPause());
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
  });
});
