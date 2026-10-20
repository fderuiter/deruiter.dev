// @vitest-environment jsdom
//
// Monkey C Mayhem on the iPad (#2122): the touch cabinet gives the watch a
// dock with hold keys for Jog, Sprint and Jump, tap keys for Action, Down,
// START and BACK, drives the Training Plan screens from the same keys, keeps
// Escape inside a run and pauses when the app is backgrounded. The desktop
// markup stays as it was.
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import {
  GARMIN_AUTO_PAUSE_EVENT,
  requestGarminAutoPause,
} from "@/components/garmin-watch/auto-pause";
import {
  GROUND_Y,
  pauseGame,
  pressAction,
  pressJump,
  releaseJump,
  setRunInput,
} from "@/lib/garmin/engine";
import { BASE_HEIGHT } from "@/lib/garmin/powerups";
import { PLAN_RUN_MODE, RACE_MODE_KEY } from "@/lib/garmin/race-store";
import { safeClear, safeSetRawItem } from "@/lib/safe-storage";

const frame = vi.hoisted(() => ({
  cb: null as null | ((deltaMs: number) => void),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("@/hooks/useAnimationFrame", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useAnimationFrame")>();
  return {
    ...actual,
    useAnimationFrame: (callback: (deltaMs: number) => void) => {
      frame.cb = callback;
    },
  };
});
vi.mock("@/lib/garmin/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin/engine")>();
  return {
    ...actual,
    // Runs start on a clear lane with GPS locked.
    startGame: vi.fn((...args: Parameters<typeof actual.startGame>) => ({
      ...actual.startGame(...args),
      gpsMs: 0,
      obstacles: [],
      foes: [],
      lastObstacleTime: Date.now() + 600_000,
      lastAllocTime: Date.now() + 600_000,
      isGrounded: true,
      playerY: GROUND_Y - BASE_HEIGHT,
    })),
    setRunInput: vi.fn(actual.setRunInput),
    pressJump: vi.fn(actual.pressJump),
    releaseJump: vi.fn(actual.releaseJump),
    pressAction: vi.fn(actual.pressAction),
    pauseGame: vi.fn(actual.pauseGame),
  };
});

function renderSim(touch: boolean) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <GarminWatchSimulator />
    </CabinetTouchContext.Provider>
  );
}

const root = () => document.querySelector(".garmin-sim") as HTMLElement;
const watch = () =>
  document.querySelector('[data-keyboard-boundary="true"]') as HTMLElement;
const face = () => screen.getByRole("img", { name: /Smartwatch display/ });
const dock = () => screen.getByTestId("garmin-touch-dock");
const dockKey = (id: string) =>
  dock().querySelector(`[data-dock-key="${id}"]`) as HTMLButtonElement;

/** Runs `n` frames of 1/60 s. */
function frames(n: number) {
  for (let i = 0; i < n; i++) act(() => frame.cb?.(1000 / 60));
}

/** The last input was a finger, so the dock is shown. */
function touchInput() {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch" })
    );
  });
}

/** Presses a hold key with a finger and returns the lift. */
function hold(id: string, pointerId = 7) {
  const key = dockKey(id);
  fireEvent.pointerDown(key, { pointerId, pointerType: "touch", button: 0 });
  return () =>
    fireEvent.pointerUp(key, { pointerId, pointerType: "touch", button: 0 });
}

/** The run input the engine was last given. */
const lastRunInput = () => vi.mocked(setRunInput).mock.calls.at(-1)?.[1];

function startRun() {
  fireEvent.click(dockKey("start"));
  frames(2);
  expect(face().getAttribute("aria-label")).toContain("Status: playing");
}

beforeEach(() => {
  frame.cb = null;
  safeClear();
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("Monkey C Mayhem on the desktop cabinet (#2122)", () => {
  it("keeps the bezel dock, the floating Fullscreen key and no touch class", () => {
    renderSim(false);
    expect(root().classList.contains("garmin-touch")).toBe(false);
    expect(screen.queryByTestId("garmin-touch-dock")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /full ?screen/i }).length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("START SIMULATION"));
    frames(2);
    expect(watch().hasAttribute("data-escape-docks")).toBe(false);
  });
});

describe("Monkey C Mayhem in the touch cabinet (#2122)", () => {
  it("puts every run action in a dock and drops the game's own Fullscreen key", () => {
    renderSim(true);
    touchInput();
    expect(root().classList.contains("garmin-touch")).toBe(true);
    expect(dock().getAttribute("data-mode")).toBe("run");
    for (const name of [
      "Jog (hold)",
      "Sprint (hold)",
      "Jump (hold for height)",
      "Action: Heat Bolt or Cape Spin",
      "Down: enter a station or slam",
      "Start run",
      "Back",
    ]) {
      expect(within(dock()).getByRole("button", { name })).toBeDefined();
    }
    // The cabinet's toolbar owns Fullscreen on a touch device.
    expect(screen.queryByRole("button", { name: /full ?screen/i })).toBeNull();
  });

  it("START starts the run and then pauses it, with its label following", () => {
    renderSim(true);
    touchInput();
    startRun();
    expect(dockKey("start").getAttribute("aria-label")).toBe("Pause run");
    fireEvent.click(dockKey("start"));
    expect(face().getAttribute("aria-label")).toContain("Status: paused");
    expect(dockKey("start").getAttribute("aria-label")).toBe("Resume run");
  });

  it("Jog and Sprint hold the pace while a finger is down, and the later finger wins", () => {
    renderSim(true);
    touchInput();
    startRun();
    const liftSprint = hold("sprint", 1);
    expect(lastRunInput()).toBe(1);
    const liftJog = hold("jog", 2);
    expect(lastRunInput()).toBe(-1);
    liftJog();
    // Sprint is still held, so the runner goes back to sprinting.
    expect(lastRunInput()).toBe(1);
    liftSprint();
    expect(lastRunInput()).toBe(0);
  });

  it("Jump presses on touch and lets go on lift, so a long press jumps higher", () => {
    renderSim(true);
    touchInput();
    startRun();
    const lift = hold("jump");
    expect(pressJump).toHaveBeenCalledTimes(1);
    expect(releaseJump).not.toHaveBeenCalled();
    lift();
    expect(releaseJump).toHaveBeenCalledTimes(1);
  });

  it("Action throws or spins, as X does", () => {
    renderSim(true);
    touchInput();
    startRun();
    fireEvent.click(dockKey("action"));
    expect(pressAction).toHaveBeenCalledTimes(1);
  });

  it("no dock key takes focus from the watch", () => {
    renderSim(true);
    touchInput();
    act(() => watch().focus());
    for (const id of ["start", "down", "back", "action"]) {
      const event = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      dockKey(id).dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(document.activeElement).toBe(watch());
  });

  it("a run in progress keeps Escape for itself, and Escape pauses it", () => {
    renderSim(true);
    touchInput();
    expect(watch().hasAttribute("data-escape-docks")).toBe(false);
    startRun();
    expect(watch().getAttribute("data-escape-docks")).toBe("true");
    fireEvent.keyDown(watch(), { key: "Escape" });
    expect(face().getAttribute("aria-label")).toContain("Status: paused");
    // Still docked while paused: Escape resumes.
    expect(watch().getAttribute("data-escape-docks")).toBe("true");
    fireEvent.keyDown(watch(), { key: "Escape" });
    expect(face().getAttribute("aria-label")).toContain("Status: playing");
  });

  it("the cabinet's auto-pause pauses a run and lets go of held keys", () => {
    renderSim(true);
    touchInput();
    startRun();
    hold("sprint");
    expect(lastRunInput()).toBe(1);
    act(() => requestGarminAutoPause());
    // Marked as the cabinet's own pause, so the face reads AUTO PAUSE (#2239).
    expect(pauseGame).toHaveBeenCalledWith(expect.anything(), undefined, true);
    expect(lastRunInput()).toBe(0);
    expect(face().getAttribute("aria-label")).toContain("Status: paused");
    // A second request leaves the paused run paused.
    act(() => window.dispatchEvent(new Event(GARMIN_AUTO_PAUSE_EVENT)));
    expect(face().getAttribute("aria-label")).toContain("Status: paused");
  });

  it("auto-pause does nothing before a run starts", () => {
    renderSim(true);
    act(() => requestGarminAutoPause());
    expect(pauseGame).not.toHaveBeenCalled();
    expect(face().getAttribute("aria-label")).toContain("Status: idle");
  });

  it("a Training Plan screen takes the dock as its arrows, Select, Back and bag", () => {
    safeSetRawItem(RACE_MODE_KEY, PLAN_RUN_MODE);
    renderSim(true);
    touchInput();
    expect(dock().getAttribute("data-mode")).toBe("plan");
    expect(dockKey("start").getAttribute("aria-label")).toBe("Select");
    expect(dockKey("jump").getAttribute("aria-label")).toBe("Up");
    expect(dockKey("action").getAttribute("aria-label")).toBe("Gear bag");
    expect(face().getAttribute("aria-label")).toContain("Morning Report");
    fireEvent.click(dockKey("start"));
    expect(face().getAttribute("aria-label")).toContain("Training Plan map");
    // On the map every key is a tap: holding Jog is one step left, not a run.
    fireEvent.click(dockKey("sprint"));
    expect(setRunInput).not.toHaveBeenCalled();
    fireEvent.click(dockKey("back"));
    expect(face().getAttribute("aria-label")).toContain("Morning Report");
  });
});
