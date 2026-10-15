// @vitest-environment jsdom
//
// Patty's Drive-Thru on the iPad (#2116): the touch cabinet moves the wipe and
// pause into a dock with hold-to-turn keys and a register key, turns the
// register into a sheet, keeps Escape inside the game, pauses when the app is
// backgrounded and caps the canvas pixel ratio. The desktop markup stays as it
// was.
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
import type { BoothStore } from "@/components/patty-drive-thru/store";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const scene = vi.hoisted(() => ({
  store: null as null | BoothStore,
  canvas: null as null | Record<string, unknown>,
}));

vi.mock("@/hooks/useAnimationFrame", () => ({
  useAnimationFrame: (
    callback: (deltaMs: number) => void,
    options: { isActive?: boolean } = {}
  ) => {
    frame.callback = callback;
    frame.active = options.isActive ?? true;
  },
}));

vi.mock("@/lib/audio/sound-engine", () => ({
  getSoundEngine: () => ({
    playSequence: vi.fn(),
    playNoise: vi.fn(),
    stopAll: vi.fn(),
  }),
}));

// The WebGL scene is replaced by a stub that hands the test the booth store.
vi.mock("next/dynamic", () => ({
  default: () =>
    function BoothSceneStub(props: { store: BoothStore }) {
      scene.store = props.store;
      return <div data-testid="pdt-booth-canvas" />;
    },
}));

// The real BoothScene is rendered against a stub canvas, to read its props.
vi.mock("@react-three/fiber", () => ({
  Canvas: (props: Record<string, unknown>) => {
    scene.canvas = props;
    return null;
  },
}));
vi.mock("@/components/patty-drive-thru/BoothWorld", () => ({
  BOOTH_CAMERA: { fov: 70 },
  BoothWorld: () => null,
}));

import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";
import BoothScene from "@/components/patty-drive-thru/BoothScene";
import {
  PATTY_AUTO_PAUSE_EVENT,
  requestPattyAutoPause,
} from "@/components/patty-drive-thru/auto-pause";
import { createBoothStore } from "@/components/patty-drive-thru/store";

/** A shift nobody has to play to reach its first dilemma. */
const CALM = {
  seed: "ui-calm",
  durationSec: 180,
  idleRatePerSec: 0,
  sosLossExpired: 0,
};

function renderGame(
  touch: boolean,
  view: "3d" | "flat" = "3d",
  config: Parameters<typeof PattyDriveThruGame>[0]["config"] = {
    seed: "e2e-4",
  }
) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <PattyDriveThruGame config={config} initialView={view} />
    </CabinetTouchContext.Provider>
  );
}

/** Runs the shift loop in tenth-of-a-second frames. */
function advance(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    act(() => {
      if (frame.active) frame.callback?.(100);
    });
  }
}

const game = () => screen.getByTestId("pdt-game");

function clockIn() {
  fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
}

/** The last input was a finger, so the dock is shown. */
function touchInput() {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch" })
    );
  });
}

/** Presses a hold-to-turn key with a finger and returns the lift. */
function holdKey(name: RegExp | string) {
  const key = screen.getByRole("button", { name });
  fireEvent.pointerDown(key, { pointerId: 7, pointerType: "touch", button: 0 });
  return () =>
    fireEvent.pointerUp(key, { pointerId: 7, pointerType: "touch", button: 0 });
}

const yaw = () => scene.store!.getState().look.yaw;

beforeEach(() => {
  frame.callback = null;
  frame.active = false;
  scene.store = null;
  scene.canvas = null;
  window.history.replaceState(null, "", "/arcade/patty-drive-thru");
});

afterEach(() => cleanup());

describe("Patty's Drive-Thru on the desktop cabinet (#2116)", () => {
  it("keeps the HUD wipe button, the keyboard hint and the inline register", () => {
    renderGame(false);
    clockIn();
    expect(game().classList.contains("pdt-touch")).toBe(false);
    expect(screen.queryByTestId("pdt-touch-dock")).toBeNull();
    expect(game().hasAttribute("data-escape-docks")).toBe(false);
    expect(screen.getByRole("button", { name: "Wipe counter" })).toBeDefined();
    expect(game().textContent).toMatch(/Enter or Tab: use the register/);
    fireEvent.keyDown(game(), { key: "Enter" });
    expect(screen.getByTestId("pdt-register")).toBeDefined();
    expect(screen.queryByTestId("pdt-register-sheet")).toBeNull();
    fireEvent.keyDown(game(), { key: "p" });
    expect(screen.getByTestId("pdt-paused")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Patty's Drive-Thru in the touch cabinet (#2116)", () => {
  it("puts the wipe, register, pause and turn keys in a dock", () => {
    renderGame(true);
    expect(game().classList.contains("pdt-touch")).toBe(true);
    // No dock before the shift: the diary page has its own buttons.
    expect(screen.queryByTestId("pdt-touch-dock")).toBeNull();
    clockIn();
    touchInput();
    const dock = screen.getByTestId("pdt-touch-dock");
    for (const name of [
      "Turn left",
      "Turn right",
      "Wipe counter",
      "Use the register",
      "Pause shift",
    ]) {
      expect(within(dock).getByRole("button", { name })).toBeDefined();
    }
    // The wipe moved out of the HUD to sit beside the thumbs.
    expect(
      within(screen.getByTestId("pdt-hud")).queryByRole("button", {
        name: "Wipe counter",
      })
    ).toBeNull();
  });

  it("holding a turn key swings the head until the finger lifts", () => {
    renderGame(true);
    clockIn();
    touchInput();
    advance(0.2);
    const start = yaw();
    const lift = holdKey("Turn left");
    advance(1);
    const turned = yaw();
    expect(turned).toBeGreaterThan(start + 0.3);
    lift();
    advance(1.5);
    const settled = yaw();
    advance(1);
    expect(yaw()).toBeCloseTo(settled, 2);
    // And the other way.
    const liftRight = holdKey("Turn right");
    advance(2);
    expect(yaw()).toBeLessThan(settled - 0.3);
    liftRight();
  });

  it("the A and D keys still turn beside the dock, and the dock keys do not clash with them", () => {
    renderGame(true);
    clockIn();
    touchInput();
    advance(0.2);
    const start = yaw();
    fireEvent.keyDown(game(), { key: "a" });
    // The key press hid the dock; the next touch brings it back.
    touchInput();
    // A finger on the other turn key and a key held together cancel out.
    const lift = holdKey("Turn right");
    advance(1);
    expect(Math.abs(yaw() - start)).toBeLessThan(0.05);
    lift();
    advance(1);
    expect(yaw()).toBeGreaterThan(start + 0.3);
    fireEvent.keyUp(game(), { key: "a" });
  });

  it("the register key opens a modal sheet with the register inside", () => {
    renderGame(true);
    clockIn();
    touchInput();
    fireEvent.click(screen.getByRole("button", { name: "Use the register" }));
    const sheet = screen.getByTestId("pdt-register-sheet");
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(within(sheet).getByTestId("pdt-register")).toBeDefined();
    // Every keyed action is a button in the sheet.
    for (const name of [/Re-enter drink/, /Bump order/, /Back$/, /Home/]) {
      expect(within(sheet).getByRole("button", { name })).toBeDefined();
    }
    fireEvent.click(
      within(sheet).getByRole("button", { name: "Back to booth" })
    );
    expect(screen.queryByTestId("pdt-register-sheet")).toBeNull();
    expect(document.activeElement).toBe(game());
  });

  it("a dilemma is answered from inside the open register sheet", () => {
    renderGame(true, "3d", CALM);
    clockIn();
    touchInput();
    fireEvent.click(screen.getByRole("button", { name: "Use the register" }));
    // Runs the loop, wiping now and then so the manager stays quiet.
    let i = 0;
    for (; i < 900 && !screen.queryByTestId("pdt-dilemma"); i++) {
      advance(0.1);
      if (i % 30 === 0) fireEvent.keyDown(game(), { key: "w" });
    }
    expect(i).toBeLessThan(900);
    const sheet = screen.getByTestId("pdt-register-sheet");
    const prompts = screen.getAllByTestId("pdt-dilemma");
    expect(prompts).toHaveLength(1);
    // The prompt rides inside the open sheet, not behind its backdrop, and
    // its answers are buttons there.
    expect(sheet.contains(prompts[0])).toBe(true);
    const answers = within(prompts[0]).getAllByRole("button");
    expect(answers).toHaveLength(2);
    fireEvent.click(answers[0]);
    expect(screen.queryByTestId("pdt-dilemma")).toBeNull();
  });

  it("hands Escape to the game only while a shift runs", () => {
    renderGame(true);
    expect(game().hasAttribute("data-escape-docks")).toBe(false);
    clockIn();
    expect(game().getAttribute("data-escape-docks")).toBe("true");
  });

  it("Escape right after Enter opens the register closes it, without a pause", () => {
    renderGame(true);
    clockIn();
    game().focus();
    fireEvent.keyDown(game(), { key: "Enter" });
    expect(screen.getByTestId("pdt-register-sheet")).toBeDefined();
    // Focus has not moved into the sheet yet: the key still lands on the booth.
    fireEvent.keyDown(game(), { key: "Escape" });
    expect(screen.queryByTestId("pdt-register-sheet")).toBeNull();
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
  });

  it("Escape inside the sheet closes only the register", () => {
    renderGame(true);
    clockIn();
    fireEvent.keyDown(game(), { key: "Tab" });
    const sheet = screen.getByTestId("pdt-register-sheet");
    const inside = within(sheet).getByRole("button", { name: /Bump order/ });
    fireEvent.keyDown(inside, { key: "Escape" });
    expect(screen.queryByTestId("pdt-register-sheet")).toBeNull();
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
  });

  it("Escape with nothing open pauses, and the pause is a dialog that Escape resumes", () => {
    renderGame(true);
    clockIn();
    fireEvent.keyDown(game(), { key: "Escape" });
    const dialog = screen.getByRole("dialog", { name: /Shift paused/i });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(frame.active).toBe(false);
    fireEvent.keyDown(game(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(frame.active).toBe(true);
  });

  it("Escape from the Resume button resumes once, not twice", () => {
    renderGame(true);
    clockIn();
    fireEvent.keyDown(game(), { key: "p" });
    const resume = screen.getByRole("button", { name: "Resume shift" });
    fireEvent.keyDown(resume, { key: "Escape" });
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
  });

  it("P straight followed by Escape resumes with the cabinet's shift intact", () => {
    renderGame(true);
    clockIn();
    fireEvent.keyDown(game(), { key: "p" });
    expect(screen.getByTestId("pdt-paused")).toBeDefined();
    fireEvent.keyDown(game(), { key: "Escape" });
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
  });

  it("the pause key and Resume shift work by tap", () => {
    renderGame(true);
    clockIn();
    touchInput();
    fireEvent.click(screen.getByRole("button", { name: "Pause shift" }));
    expect(screen.getByRole("dialog", { name: /Shift paused/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Resume shift" }));
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
  });

  it("the wipe key wipes the counter", () => {
    renderGame(true);
    clockIn();
    touchInput();
    advance(1);
    const before = scene.store!.getState().shift.wipeReadyAt;
    fireEvent.click(screen.getByRole("button", { name: "Wipe counter" }));
    expect(scene.store!.getState().shift.wipeReadyAt).toBeGreaterThan(before);
  });

  it("pauses a running shift when the app is backgrounded", () => {
    renderGame(true);
    // Idle: nothing to pause.
    act(() => requestPattyAutoPause());
    expect(screen.queryByTestId("pdt-paused")).toBeNull();
    clockIn();
    act(() => {
      window.dispatchEvent(new Event(PATTY_AUTO_PAUSE_EVENT));
    });
    expect(screen.getByRole("dialog", { name: /Shift paused/i })).toBeDefined();
    expect(frame.active).toBe(false);
  });

  it("the flat view keeps only the wipe and the pause in the dock", () => {
    renderGame(true, "flat");
    clockIn();
    touchInput();
    const dock = screen.getByTestId("pdt-touch-dock");
    expect(within(dock).getAllByRole("button")).toHaveLength(2);
    expect(
      within(dock).getByRole("button", { name: "Wipe counter" })
    ).toBeDefined();
    expect(
      within(dock).getByRole("button", { name: "Pause shift" })
    ).toBeDefined();
    // The register is inline, with the orders, and not a sheet.
    expect(screen.queryByTestId("pdt-register-sheet")).toBeNull();
    expect(screen.getByTestId("pdt-register")).toBeDefined();
    expect(screen.getByTestId("pdt-key-legend").className).toContain("sr-only");
  });
});

describe("Patty's Drive-Thru canvas pixel ratio (#2116)", () => {
  const props = () =>
    ({
      store: createBoothStore({ seed: "e2e-4" }),
      onOpenRegister: vi.fn(),
      onContextLost: vi.fn(),
    }) as const;

  it("keeps the desktop range", () => {
    render(<BoothScene {...props()} />);
    expect(scene.canvas?.dpr).toEqual([1, 1.75]);
  });

  it("caps the touch cabinet's canvas lower, for the iPad mini", () => {
    render(
      <CabinetTouchContext.Provider value={true}>
        <BoothScene {...props()} />
      </CabinetTouchContext.Provider>
    );
    const dpr = scene.canvas?.dpr as [number, number];
    expect(dpr[0]).toBe(1);
    expect(dpr[1]).toBeLessThanOrEqual(1.5);
  });
});
