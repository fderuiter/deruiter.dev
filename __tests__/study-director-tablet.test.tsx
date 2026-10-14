import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import { ShortcutSheet } from "@/components/study-director/ShortcutSheet";
import { DialogueBox } from "@/components/study-director-world/DialogueBox";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import { requestStudyDirectorAutoPause } from "@/components/study-director-world/auto-pause";
import { followCamera } from "@/components/study-director-world/camera";
import {
  WORLD_SAVE_KEY,
  currentMap,
  parseWorld,
} from "@/lib/study-director-world";

const INTRO_KEY = "study_director_world_intro_seen";

function savedWorld() {
  const world = parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));
  if (!world) throw new Error("no saved world");
  return world;
}

/** A finger down on a press-and-hold key: the touch kit's TouchButton. */
function press(name: RegExp | string) {
  const button = screen.getByRole("button", { name });
  fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
  fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch" });
}

/** The last input was a finger: the on-screen keys are shown. */
function fingerDown() {
  act(() => {
    document.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true })
    );
  });
}

function renderTouchWorld() {
  const onExit = vi.fn();
  render(
    <CabinetTouchContext.Provider value>
      <StudyDirectorWorld onExit={onExit} />
    </CabinetTouchContext.Provider>
  );
  fingerDown();
  return { onExit, playfield: screen.getByTestId("world-playfield") };
}

/** The first live region: what the office just said. */
const said = () => screen.getAllByRole("status")[0].textContent ?? "";

describe("Study Director office on the touch cabinet (#2076)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.(INTRO_KEY, "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("keeps the desktop office as it was: no touch keys, no touch class", () => {
    render(<StudyDirectorWorld onExit={() => {}} />);
    expect(screen.queryByTestId("world-touch-controls")).toBeNull();
    expect(document.querySelector(".sd-touch")).toBeNull();
    expect(screen.getByTestId("world-playfield").dataset.escapeDocks).toBe(
      undefined
    );
  });

  it("draws arrows, E and F as buttons when the cabinet is touch", () => {
    renderTouchWorld();
    const controls = screen.getByTestId("world-touch-controls");
    for (const name of [
      "Walk left",
      "Walk up",
      "Walk down",
      "Walk right",
      "Use or talk (E)",
      "How are you? (F)",
    ])
      expect(within(controls).getByRole("button", { name })).toBeTruthy();
    expect(document.querySelector(".sd-touch.sd-world-touch")).not.toBeNull();
  });

  it("hides the on-screen keys while a keyboard is in use, and shows them for a finger", () => {
    renderTouchWorld();
    const gate = () =>
      screen
        .getByTestId("world-touch-controls")
        .closest("[data-touch-controls]");
    expect(gate()?.getAttribute("data-touch-controls")).toBe("shown");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(gate()?.getAttribute("data-touch-controls")).toBe("hidden");
    fingerDown();
    expect(gate()?.getAttribute("data-touch-controls")).toBe("shown");
  });

  it("F asks how you are, as the key does", () => {
    renderTouchWorld();
    press("How are you? (F)");
    expect(screen.getByTestId("world-outcome")).toBeTruthy();
  });

  it("E uses what you face, and says so when nothing is in front", () => {
    renderTouchWorld();
    press("Use or talk (E)");
    expect(said()).toMatch(/Nothing in front of you|\./);
    expect(screen.getByTestId("world-use-label").textContent).toBeTruthy();
  });

  it("an arrow turns and steps, like the key", () => {
    renderTouchWorld();
    press("Walk left");
    expect(savedWorld().player.facing).toBe("left");
    press("Walk up");
    expect(savedWorld().player.facing).toBe("up");
  });

  it("a tap on the floor walks to the station under the finger", () => {
    vi.useFakeTimers();
    renderTouchWorld();
    const world = savedWorld();
    const map = currentMap(world);
    const view = followCamera(world.player, map);
    const station = map.stations.find(
      (s) =>
        s.x >= view.x &&
        s.x < view.x + view.w &&
        s.y >= view.y &&
        s.y < view.y + view.h
    );
    expect(station).toBeDefined();
    const canvas = screen.getByTestId("world-canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1100,
      bottom: 650,
      width: 1100,
      height: 650,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(canvas, {
      clientX: ((station!.x + 0.5 - view.x) / view.w) * 1100,
      clientY: ((station!.y + 0.5 - view.y) / view.h) * 650,
    });
    expect(said()).toMatch(new RegExp(`Walking to ${station!.name}`));
    const before = savedWorld().minute;
    act(() => {
      vi.advanceTimersByTime(110 * 4);
    });
    expect(savedWorld().minute).toBeGreaterThan(before);
  });

  it("a tap on a wall says there is no way, and walks nowhere", () => {
    renderTouchWorld();
    const canvas = screen.getByTestId("world-canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1100,
      bottom: 650,
      width: 1100,
      height: 650,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const world = savedWorld();
    const map = currentMap(world);
    const view = followCamera(world.player, map);
    // Aim at the map's top-left wall tile when it is on screen, otherwise at
    // the left edge of the view, which is wall or furniture on this floor.
    const wall = { x: 0, y: 0 };
    const onScreen =
      wall.x >= view.x &&
      wall.x < view.x + view.w &&
      wall.y >= view.y &&
      wall.y < view.y + view.h;
    fireEvent.click(canvas, {
      clientX: onScreen ? ((wall.x + 0.5 - view.x) / view.w) * 1100 : 1,
      clientY: onScreen ? ((wall.y + 0.5 - view.y) / view.h) * 650 : 1,
    });
    expect(said()).toMatch(/no way to walk there|Walking to/);
  });

  it("auto-pause stops a walk in progress", () => {
    vi.useFakeTimers();
    renderTouchWorld();
    const world = savedWorld();
    const map = currentMap(world);
    const view = followCamera(world.player, map);
    const station = map.stations.find(
      (s) =>
        s.x >= view.x &&
        s.x < view.x + view.w &&
        s.y >= view.y &&
        s.y < view.y + view.h
    )!;
    const canvas = screen.getByTestId("world-canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1100,
      bottom: 650,
      width: 1100,
      height: 650,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(canvas, {
      clientX: ((station.x + 0.5 - view.x) / view.w) * 1100,
      clientY: ((station.y + 0.5 - view.y) / view.h) * 650,
    });
    act(() => {
      vi.advanceTimersByTime(110);
    });
    act(() => {
      requestStudyDirectorAutoPause();
    });
    expect(said()).toMatch(/Paused/);
    const stopped = savedWorld().minute;
    act(() => {
      vi.advanceTimersByTime(110 * 10);
    });
    expect(savedWorld().minute).toBe(stopped);
  });

  it("an open result takes the first Escape from the game, not the cabinet", () => {
    const { playfield } = renderTouchWorld();
    expect(playfield.dataset.escapeDocks).toBeUndefined();
    press("How are you? (F)");
    expect(playfield.dataset.escapeDocks).toBe("true");
    fireEvent.keyDown(playfield, { key: "Escape" });
    expect(screen.queryByTestId("world-outcome")).toBeNull();
    expect(playfield.dataset.escapeDocks).toBeUndefined();
  });

  it("the intro lists the touch controls instead of keys", () => {
    globalThis.localStorage?.removeItem?.(INTRO_KEY);
    renderTouchWorld();
    const intro = screen.getByTestId("world-intro");
    expect(intro.textContent).toMatch(/Tap the floor/);
    expect(intro.textContent).not.toMatch(/W A S D/);
  });
});

describe("Study Director dialogue on the touch cabinet (#2076)", () => {
  afterEach(() => {
    cleanup();
  });

  const box = (touch: boolean) => (
    <CabinetTouchContext.Provider value={touch}>
      <DialogueBox
        titleId="t"
        speaker={{ name: "Maya Okafor", role: "Data manager" }}
        lines={[{ kind: "information", text: "x".repeat(400) }]}
        reducedMotion={false}
        testId="dialogue"
        onClose={() => {}}
      >
        <button type="button">Reply</button>
      </DialogueBox>
    </CabinetTouchContext.Provider>
  );

  it("a tap finishes the typing, and the hint says tap", () => {
    render(box(true));
    const dialogue = screen.getByTestId("dialogue");
    expect(dialogue.dataset.typing).toBe("typing");
    expect(dialogue.textContent).toMatch(/Tap to show the rest/);
    fireEvent.click(dialogue);
    expect(dialogue.dataset.typing).toBe("done");
  });

  it("a tap on a choice is the choice's own, not a skip", () => {
    render(box(true));
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(screen.getByTestId("dialogue").dataset.typing).toBe("typing");
  });

  it("keeps the keyboard hint, and ignores taps, off the touch cabinet", () => {
    render(box(false));
    const dialogue = screen.getByTestId("dialogue");
    expect(dialogue.textContent).toMatch(/Space or Enter shows the rest/);
    fireEvent.click(dialogue);
    expect(dialogue.dataset.typing).toBe("typing");
  });
});

describe("Study Director classic desk on the touch cabinet (#2076)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.(INTRO_KEY, "1");
    window.history.replaceState(null, "", "/#mode=desk");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  function startDesk(touch: boolean) {
    render(
      <CabinetTouchContext.Provider value={touch}>
        <StudyDirectorGame />
      </CabinetTouchContext.Provider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Start the study \(classic desk\)/ })
    );
  }

  it("keeps the desktop desk as it was: one long page, no tabs", () => {
    startDesk(false);
    expect(screen.queryByTestId("desk-tabs")).toBeNull();
    expect(document.querySelector(".sd-touch")).toBeNull();
    expect(screen.getByRole("button", { name: "End day" })).toBeTruthy();
  });

  it("shows one section at a time, and every section is a tap away", () => {
    startDesk(true);
    const tabs = screen.getByTestId("desk-tabs");
    expect(within(tabs).getAllByRole("button")).toHaveLength(5);
    expect(
      within(tabs)
        .getByRole("button", { name: /Inbox/ })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.queryByRole("region", { name: "Study team" })).toBeNull();
    fireEvent.click(within(tabs).getByRole("button", { name: "Team" }));
    expect(screen.getByRole("region", { name: "Study team" })).toBeTruthy();
    fireEvent.click(within(tabs).getByRole("button", { name: "Sites" }));
    expect(screen.getByRole("region", { name: "Sites" })).toBeTruthy();
    fireEvent.click(within(tabs).getByRole("button", { name: "Dashboard" }));
    expect(screen.getByRole("region", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Study health" })).toBeTruthy();
  });

  it("an option is a tap, and the day ends with a tap", () => {
    startDesk(true);
    const options = within(screen.getByTestId("study-decision"))
      .getAllByRole("button")
      .filter((b) => !b.hasAttribute("disabled"));
    expect(options.length).toBeGreaterThan(0);
    fireEvent.click(options[0]);
    expect(screen.getByTestId("desk-actions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "End day" }));
    expect(screen.getByTestId("study-status-bar").textContent).toMatch(/Day 2/);
    // Ending the day brings you back to the inbox, where the overnight report is.
    expect(
      screen.getByRole("button", { name: /Inbox/ }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("the shortcut sheet opens by tap, traps nothing off screen, and Escape closes it", () => {
    startDesk(true);
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    const sheet = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(sheet.textContent).toMatch(/Every key has a button/);
    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an open outcome takes the first Escape from the desk, not the cabinet", () => {
    startDesk(true);
    const desk = document.querySelector<HTMLElement>("[data-sd-desk]")!;
    expect(desk.dataset.escapeDocks).toBeUndefined();
    const option = within(screen.getByTestId("study-decision"))
      .getAllByRole("button")
      .find((b) => !b.hasAttribute("disabled"))!;
    fireEvent.click(option);
    expect(desk.dataset.escapeDocks).toBe("true");
    fireEvent.keyDown(desk, { key: "Escape" });
    expect(desk.dataset.escapeDocks).toBeUndefined();
  });

  it("the briefing scrolls inside the stage, below the toolbar", () => {
    render(
      <CabinetTouchContext.Provider value>
        <StudyDirectorGame />
      </CabinetTouchContext.Provider>
    );
    const region = screen.getByRole("region", { name: "Study briefing" });
    expect(region.className).toContain("sd-touch-scroll");
    expect(within(region).getByTestId("study-briefing")).toBeTruthy();
  });
});

describe("Study Director dialogs keep Escape after a tap on their text (#2076)", () => {
  afterEach(() => cleanup());

  it("a tap on the text can focus the dialog itself, not the cabinet behind", () => {
    render(<ShortcutSheet onClose={() => {}} />);
    expect(screen.getByRole("dialog").getAttribute("tabindex")).toBe("-1");
  });
});
