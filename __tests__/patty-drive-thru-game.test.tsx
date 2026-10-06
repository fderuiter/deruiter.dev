import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { EVENT_CAPTIONS, LOOK_PRESETS } from "@/lib/patty-drive-thru";
import type { BoothStore } from "@/components/patty-drive-thru/store";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const scene = vi.hoisted(() => ({
  props: null as null | {
    store: BoothStore;
    onOpenRegister: () => void;
    onContextLost: () => void;
  },
}));

const sound = vi.hoisted(() => ({
  playSequence: vi.fn(),
  playNoise: vi.fn(),
  stopAll: vi.fn(),
}));

const scores = vi.hoisted(() => ({ record: vi.fn() }));

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
  getSoundEngine: () => sound,
}));

vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: scores.record,
}));

// The WebGL scene is replaced by a stub that hands the test its props.
vi.mock("next/dynamic", () => ({
  default: () =>
    function BoothSceneStub(props: NonNullable<typeof scene.props>) {
      scene.props = props;
      return <div data-testid="pdt-booth-canvas" />;
    },
}));

import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";
import { CabinetSetupContext } from "@/components/arcade/CabinetSetupContext";

/** Runs the shift loop in tenth-of-a-second frames. */
function advance(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    act(() => {
      if (frame.active) frame.callback?.(100);
    });
  }
}

function game(): HTMLElement {
  return screen.getByTestId("pdt-game");
}

function press(key: string, init: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(game(), { key, ...init });
}

function clockIn() {
  fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
}

beforeEach(() => {
  frame.callback = null;
  frame.active = false;
  scene.props = null;
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/arcade/patty-drive-thru");
});

afterEach(() => {
  cleanup();
});

describe("Patty's Drive-Thru game, flat view (#1813, #1814)", () => {
  it("opens on the diary page with Clock in focused", () => {
    render(
      <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
    );
    expect(screen.getByTestId("pdt-intro")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Clock in" })
    );
    expect(frame.active).toBe(false);
  });

  it("plays a car by keyboard: select, ring, bump", () => {
    render(
      <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
    );
    clockIn();
    expect(document.activeElement).toBe(game());
    expect(screen.getByTestId("pdt-clock").textContent).toBe("3:00");
    advance(2.5);

    const strip = screen.getByRole("toolbar", { name: "Open orders" });
    const tab = within(strip).getByRole("button", { name: /^Order 1/ });
    expect(tab.getAttribute("aria-pressed")).toBe("false");
    press("1");
    expect(tab.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Sides ›" }));
    expect(screen.getByText("Home › Sides")).toBeTruthy();
    press("Backspace");
    expect(screen.queryByText("Home › Sides")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sides ›" }));
    fireEvent.click(screen.getByRole("button", { name: "Fries" }));
    expect(screen.getByText("Rung")).toBeTruthy();

    press("b");
    expect(
      within(strip).queryByRole("button", { name: /^Order 1/ })
    ).toBeNull();
    expect(screen.getByTestId("pdt-caption").textContent).toContain(
      EVENT_CAPTIONS.bumped
    );
    expect(screen.getByRole("status").textContent).toContain(
      EVENT_CAPTIONS.bumped
    );
  });

  it("wipes the counter, and ignores modified keys and keys with nothing to act on", () => {
    render(
      <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
    );
    clockIn();
    press("w", { ctrlKey: true });
    expect(screen.getByTestId("pdt-caption").textContent).toBe("");
    press("9");
    press("r");
    press("c");
    press("Home");
    press("Enter");
    press("Tab");
    press("Escape");
    press("x");
    expect(screen.queryByTestId("pdt-booth-canvas")).toBeNull();
    press("W");
    expect(screen.getByTestId("pdt-caption").textContent).toContain(
      EVENT_CAPTIONS.wiped
    );
    expect(sound.playNoise).toHaveBeenCalledTimes(1);
  });

  it("re-enters a dropped drink and flags Dale for coffee from the keyboard", () => {
    render(
      <PattyDriveThruGame config={{ seed: "e2e-5" }} initialView="flat" />
    );
    clockIn();
    advance(2.5);
    press("1");
    press("c");
    expect(screen.getByTestId("pdt-caption").textContent).toContain(
      EVENT_CAPTIONS.coworkerFlagged
    );
    press("r");
    press("Home");
  });

  it("ends the shift on the pay stub, records the score and clocks in again", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "e2e-4", durationSec: 10 }}
        initialView="flat"
      />
    );
    clockIn();
    advance(10.5);
    const end = screen.getByTestId("pdt-end");
    expect(end.getAttribute("data-outcome")).toBe("completed");
    expect(screen.getByRole("heading", { name: "Made it to close" })).toBe(
      document.activeElement
    );
    expect(screen.getByTestId("pdt-net-pay").textContent).toMatch(/^-?\$/);
    expect(
      screen
        .getByRole("link", { name: "Read the notes behind this shift" })
        .getAttribute("href")
    ).toBe("/blog/notes-from-my-first-job");
    expect(scores.record).toHaveBeenCalledTimes(1);
    expect(scores.record).toHaveBeenCalledWith(
      "patty-drive-thru",
      expect.any(Number),
      expect.objectContaining({ outcome: "completed" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Work another shift" }));
    expect(screen.getByTestId("pdt-clock").textContent).toBe("0:10");
  });

  it("stops the clock while the cabinet's setup is open", () => {
    const setup = {
      config: {} as never,
      runRevision: 0,
      isSetupOpen: true,
      skipTitleScreen: false,
    };
    render(
      <CabinetSetupContext.Provider value={setup}>
        <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
      </CabinetSetupContext.Provider>
    );
    clockIn();
    expect(frame.active).toBe(false);
  });

  it("silences the booth when it unmounts", () => {
    const { unmount } = render(
      <PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="flat" />
    );
    clockIn();
    advance(2.5);
    expect(sound.playSequence).toHaveBeenCalled();
    unmount();
    expect(sound.stopAll).toHaveBeenCalled();
  });
});

describe("Patty's Drive-Thru game, 3D booth (#1813)", () => {
  it("replays a shift from the page's seed parameter", () => {
    window.history.replaceState(
      null,
      "",
      "/arcade/patty-drive-thru?seed=e2e-7"
    );
    render(<PattyDriveThruGame initialView="3d" />);
    clockIn();
    expect(scene.props?.store.getState().shift.config.seed).toBe("e2e-7");
  });

  it("ignores a malformed seed parameter", () => {
    window.history.replaceState(
      null,
      "",
      "/arcade/patty-drive-thru?seed=%3Cscript%3E"
    );
    render(<PattyDriveThruGame initialView="3d" />);
    clockIn();
    expect(scene.props?.store.getState().shift.config.seed).toMatch(
      /^first-job-/
    );
  });

  it("opens the register with Enter or Tab and leaves it with Escape", () => {
    render(<PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="3d" />);
    clockIn();
    expect(screen.getByTestId("pdt-booth-canvas")).toBeTruthy();
    expect(game().getAttribute("data-pdt-view")).toBe("3d");
    expect(screen.queryByTestId("pdt-register")).toBeNull();

    press("Enter");
    const register = screen.getByTestId("pdt-register");
    expect(register.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByTestId("pdt-register")).toBeNull();
    expect(document.activeElement).toBe(game());

    press("Tab", { shiftKey: true });
    expect(screen.queryByTestId("pdt-register")).toBeNull();
    press("Tab");
    expect(screen.getByTestId("pdt-register")).toBeTruthy();
    press("Escape");
    expect(screen.queryByTestId("pdt-register")).toBeNull();

    act(() => scene.props?.onOpenRegister());
    expect(screen.getByTestId("pdt-register")).toBeTruthy();
  });

  it("turns the head while A or D is held, and not while the register is open", () => {
    render(<PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="3d" />);
    clockIn();
    const store = scene.props?.store as BoothStore;
    press("a");
    advance(0.5);
    expect(store.getState().look.targetYaw).toBeGreaterThan(0);
    fireEvent.keyUp(game(), { key: "a" });
    const held = store.getState().look.targetYaw;
    advance(0.3);
    expect(store.getState().look.targetYaw).toBe(held);

    press("ArrowRight");
    press("ArrowLeft");
    advance(0.3);
    expect(store.getState().look.targetYaw).toBe(held);
    fireEvent.keyUp(game(), { key: "ArrowLeft" });
    advance(0.3);
    expect(store.getState().look.targetYaw).toBeLessThan(held);

    fireEvent.blur(game(), { relatedTarget: null });
    const released = store.getState().look.targetYaw;
    advance(0.3);
    expect(store.getState().look.targetYaw).toBe(released);

    act(() => scene.props?.onOpenRegister());
    const atRegister = store.getState().look.targetYaw;
    press("d");
    advance(0.3);
    expect(store.getState().look.targetYaw).toBe(atRegister);
  });

  it("turns the head with a drag, and treats a short press as a click", () => {
    render(<PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="3d" />);
    clockIn();
    const store = scene.props?.store as BoothStore;
    const stage = screen.getByTestId("pdt-stage");
    act(() => scene.props?.onOpenRegister());

    fireEvent.pointerDown(stage, {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 102, clientY: 101 });
    advance(0.1);
    expect(screen.getByTestId("pdt-register")).toBeTruthy();

    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 40, clientY: 80 });
    expect(screen.queryByTestId("pdt-register")).toBeNull();
    advance(0.1);
    expect(store.getState().look.targetYaw).toBeGreaterThan(
      LOOK_PRESETS.counter.yaw
    );
    fireEvent.pointerUp(stage, { pointerId: 1 });
    fireEvent.pointerDown(stage, {
      button: 2,
      pointerId: 3,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(stage, { pointerId: 3, clientX: 90, clientY: 0 });
    fireEvent.pointerCancel(stage, { pointerId: 3 });
  });

  it("falls back to the flat view when the WebGL context is lost", () => {
    render(<PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="3d" />);
    clockIn();
    act(() => scene.props?.onOpenRegister());
    act(() => scene.props?.onContextLost());
    expect(game().getAttribute("data-pdt-view")).toBe("flat");
    expect(screen.getByText(/The 3D booth stopped responding/)).toBeTruthy();
    expect(screen.queryByTestId("pdt-booth-canvas")).toBeNull();
  });

  it("switches between the 3D booth and the flat view", () => {
    render(<PattyDriveThruGame config={{ seed: "e2e-4" }} initialView="3d" />);
    clockIn();
    fireEvent.click(screen.getByRole("button", { name: "Flat view" }));
    expect(game().getAttribute("data-pdt-view")).toBe("flat");
    expect(screen.queryByText(/stopped responding/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "3D booth" }));
    expect(game().getAttribute("data-pdt-view")).toBe("3d");
  });
});
