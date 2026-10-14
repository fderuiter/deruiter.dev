// @vitest-environment jsdom
//
// Laser Loon on the iPad (#2081): the touch cabinet swaps the desktop panels
// for an on-screen dock and a menu sheet, steers by finger or Pencil, fires
// from its own key, and pauses when the app is backgrounded. The desktop
// markup stays as it was.
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import {
  LASER_LOON_AUTO_PAUSE_EVENT,
  requestLaserLoonAutoPause,
} from "@/components/laser-loon/auto-pause";
import { LaserLoon } from "@/components/LaserLoon";

const playNote = vi.hoisted(() => vi.fn());

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote,
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playLaser: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

/** A ruby shot plays this note first. */
const RUBY_SHOT = 740;
const shots = () =>
  playNote.mock.calls.filter(([frequency]) => frequency === RUBY_SHOT).length;

let now = 10_000;

function renderLoon(touch: boolean) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <LaserLoon />
    </CabinetTouchContext.Provider>
  );
}

/** Starts the campaign and engages the first act, so the run is live. */
function startRun() {
  fireEvent.click(
    screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
  );
  fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));
}

/** Opens the Act 1 story card. */
function startRunToIntro() {
  fireEvent.click(
    screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
  );
}

/** The last input was a finger, so the dock is shown. */
function touchInput() {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch" })
    );
  });
}

const arena = () =>
  screen.getByRole("application", { name: /Laser Loon Arcade Game/i });

/** Each press lands past the weapon's fire interval. */
function tick() {
  now += 1000;
}

describe("Laser Loon on the desktop cabinet (#2081)", () => {
  beforeEach(() => {
    playNote.mockClear();
  });
  afterEach(() => cleanup());

  it("keeps the options panel, the footer strip and the old dock", () => {
    const { container } = renderLoon(false);
    expect(container.querySelector(".ll-touch")).toBeNull();
    expect(
      container.querySelector("details.arcade-shooter-options")
    ).not.toBeNull();
    expect(container.querySelector(".arcade-shooter-footer")).not.toBeNull();
    expect(screen.queryByTestId("loon-touch-controls")).toBeNull();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });

  it("measures nothing and keeps the story headline at level 4", () => {
    const { container } = renderLoon(false);
    startRunToIntro();
    expect(
      container
        .querySelector<HTMLElement>("[data-keyboard-boundary]")!
        .style.getPropertyValue("--ll-hud-h")
    ).toBe("");
    expect(
      screen.getByRole("heading", { level: 4, name: /LOCAL LOON DEVELOPS/i })
    ).toBeDefined();
  });

  it("a click on the arena shoots, and Escape does not claim the cabinet's Escape", () => {
    const { container } = renderLoon(false);
    startRun();
    expect(
      container
        .querySelector("[data-keyboard-boundary]")
        ?.hasAttribute("data-escape-docks")
    ).toBe(false);
    vi.spyOn(performance, "now").mockImplementation(() => now);
    tick();
    fireEvent.pointerDown(arena(), { pointerId: 1, pointerType: "mouse" });
    expect(shots()).toBe(1);
  });
});

describe("Laser Loon in the touch cabinet (#2081)", () => {
  beforeEach(() => {
    playNote.mockClear();
    now = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("scopes its layout to ll-touch and swaps the desktop panels for the dock and a Menu", () => {
    const { container } = renderLoon(true);
    expect(container.querySelector(".arcade-shooter.ll-touch")).not.toBeNull();
    expect(
      container.querySelector("details.arcade-shooter-options")
    ).toBeNull();
    expect(container.querySelector(".arcade-shooter-footer")).toBeNull();
    const dock = screen.getByTestId("loon-touch-controls");
    for (const name of [
      "Optic 1: Ruby",
      "Optic 2: Pulse",
      "Optic 3: Aurora",
      "Optic 4: Cryo",
      "Fire (hold)",
    ]) {
      expect(dock.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
    }
    expect(dock.querySelector('[aria-label^="Loon Tremolo"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Menu" })).toBeDefined();
  });

  it("the optic keys pick the laser like keys 1 to 4", () => {
    renderLoon(true);
    touchInput();
    const ruby = screen.getByRole("button", { name: "Optic 1: Ruby" });
    const aurora = screen.getByRole("button", { name: "Optic 3: Aurora" });
    expect(ruby.getAttribute("aria-pressed")).toBe("true");
    fireEvent.pointerDown(aurora, { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(aurora, { pointerId: 1, pointerType: "touch" });
    expect(aurora.getAttribute("aria-pressed")).toBe("true");
    expect(ruby.getAttribute("aria-pressed")).toBe("false");
  });

  it("a finger or the Pencil on the arena aims without shooting; the Fire key shoots", () => {
    renderLoon(true);
    touchInput();
    startRun();
    for (const pointerType of ["touch", "pen"]) {
      tick();
      fireEvent.pointerDown(arena(), { pointerId: 3, pointerType });
      fireEvent.pointerMove(arena(), { pointerId: 3, pointerType });
      fireEvent.pointerUp(arena(), { pointerId: 3, pointerType });
    }
    expect(shots()).toBe(0);

    tick();
    const fire = screen.getByRole("button", { name: "Fire (hold)" });
    fireEvent.pointerDown(fire, { pointerId: 4, pointerType: "touch" });
    expect(shots()).toBe(1);
    fireEvent.pointerUp(fire, { pointerId: 4, pointerType: "touch" });
  });

  it("a mouse or trackpad on the iPad still clicks to shoot", () => {
    renderLoon(true);
    startRun();
    tick();
    fireEvent.pointerDown(arena(), { pointerId: 1, pointerType: "mouse" });
    expect(shots()).toBe(1);
  });

  it("Fire does nothing on the title screen", () => {
    renderLoon(true);
    touchInput();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Fire (hold)" }), {
      pointerId: 1,
      pointerType: "touch",
    });
    expect(shots()).toBe(0);
  });

  it("pauses a run when the cabinet asks, and leaves the title screen alone", () => {
    renderLoon(true);
    act(() => requestLaserLoonAutoPause());
    expect(screen.queryByText("GAME PAUSED")).toBeNull();

    startRun();
    expect(screen.getByRole("button", { name: "Pause Game" })).toBeDefined();
    act(() => requestLaserLoonAutoPause());
    expect(screen.getByText("GAME PAUSED")).toBeDefined();
    // The HUD key now offers Resume.
    expect(screen.getByRole("button", { name: "Resume Game" })).toBeDefined();
  });

  it("listens for the auto-pause event only while mounted", () => {
    const { unmount } = renderLoon(true);
    unmount();
    const listener = vi.fn();
    window.addEventListener(LASER_LOON_AUTO_PAUSE_EVENT, listener);
    requestLaserLoonAutoPause();
    window.removeEventListener(LASER_LOON_AUTO_PAUSE_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("a run in progress claims Escape for the pause, and a paused one does not", () => {
    const { container } = renderLoon(true);
    const boundary = container.querySelector("[data-keyboard-boundary]")!;
    expect(boundary.getAttribute("data-escape-docks")).toBeNull();
    startRun();
    expect(boundary.getAttribute("data-escape-docks")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause Game" }));
    expect(boundary.getAttribute("data-escape-docks")).toBeNull();
  });

  it("the Menu sheet is a dialog; Escape closes it and a mode choice closes it too", () => {
    renderLoon(true);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog", { name: "Laser Loon menu" });
    expect(sheet).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "Campaign" })
        .getAttribute("aria-pressed")
    ).toBe("true");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", cancelable: true })
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "Laser Loon menu" })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Arcade Survival" }));
    expect(
      screen.queryByRole("dialog", { name: "Laser Loon menu" })
    ).toBeNull();
  });

  it("Escape in the Menu sheet during a run closes the sheet and does not pause the run", () => {
    renderLoon(true);
    startRun();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const close = screen.getByRole("button", { name: "Close menu" });
    // A key from inside the sheet bubbles through the playfield's own handler.
    fireEvent.keyDown(close, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Laser Loon menu" })
    ).toBeNull();
    expect(screen.queryByText("GAME PAUSED")).toBeNull();
    expect(screen.getByRole("button", { name: "Pause Game" })).toBeDefined();
  });

  it("measures the status strip so overlays start under it, and the act story heads at level 2", () => {
    const { container } = renderLoon(true);
    startRunToIntro();
    const playfield = container.querySelector<HTMLElement>(
      "[data-keyboard-boundary]"
    )!;
    expect(playfield.style.getPropertyValue("--ll-hud-h")).not.toBe("");
    expect(
      screen.getByRole("heading", { level: 2, name: /LOCAL LOON DEVELOPS/i })
    ).toBeDefined();
  });

  it("the Menu sheet holds the Museum, the audio switch and the shake switch", () => {
    renderLoon(true);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const audio = screen.getByRole("button", { name: /Audio: On/ });
    fireEvent.click(audio);
    expect(screen.getByRole("button", { name: /Audio: Muted/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Screen shake/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Flag Museum" }));
    expect(
      screen.queryByRole("dialog", { name: "Laser Loon menu" })
    ).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Minnesota Flag Redesign Museum" })
    ).toBeDefined();
  });

  it("keys read as taps after a touch, and as keys after a key press", () => {
    renderLoon(true);
    expect(
      screen.getAllByText(/START CAMPAIGN \[SPACE\]/).length
    ).toBeGreaterThan(0);
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "touch" })
      );
    });
    expect(screen.queryByText(/\[SPACE\]/)).toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });
    expect(
      screen.getAllByText(/START CAMPAIGN \[SPACE\]/).length
    ).toBeGreaterThan(0);
  });

  it("the dock hides while a keyboard is in use and returns on the next touch", () => {
    renderLoon(true);
    const gate = () =>
      screen
        .getByTestId("loon-touch-controls")
        .closest("[data-touch-controls]")!;
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "pen" })
      );
    });
    expect(gate().getAttribute("data-touch-controls")).toBe("shown");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(gate().getAttribute("data-touch-controls")).toBe("hidden");
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "touch" })
      );
    });
    expect(gate().getAttribute("data-touch-controls")).toBe("shown");
  });

  it("the keyboard shortcuts all work, and the dock hides while they are used", () => {
    renderLoon(true);
    touchInput();
    startRun();
    const boundary = document.querySelector("[data-keyboard-boundary]")!;
    fireEvent.keyDown(boundary, { key: "3" });
    expect(
      screen
        .getByRole("button", { name: "Optic 3: Aurora", hidden: true })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen
        .getByTestId("loon-touch-controls")
        .closest("[data-touch-controls]")
        ?.getAttribute("data-touch-controls")
    ).toBe("hidden");
    fireEvent.keyDown(boundary, { key: "p" });
    expect(screen.getByText("GAME PAUSED")).toBeDefined();
  });
});
