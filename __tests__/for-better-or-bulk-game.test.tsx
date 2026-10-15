import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  DEFAULT_SETUP,
  ITEM_LABELS,
  bankText,
  LEFT_LINE,
  RELAXED_LEVEL_SECONDS,
  availableCommitments,
  createLevel,
  type Frame,
  type GameEvent,
  type GameState,
} from "@/lib/for-better-or-bulk";
import { BrothersDialog } from "@/components/for-better-or-bulk/BrothersDialog";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import {
  seedName,
  throttleFloorFull,
} from "@/components/for-better-or-bulk/messages";
import { FBB_LOUD_QUERY } from "@/components/for-better-or-bulk/bursts";
import { fromPartial } from "@total-typescript/shoehorn";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const scores = vi.hoisted(() => ({ record: vi.fn() }));

const sfx = vi.hoisted(() => ({ play: vi.fn() }));

vi.mock("@/components/for-better-or-bulk/sfx", () => ({
  playSfx: sfx.play,
}));

/** Lets a test end the level on the next engine step, whatever the plan. */
const engine = vi.hoisted(() => ({
  finishNext: false,
  /** The finish time the forced end reports; null leaves the day unfinished. */
  finishedAt: null as number | null,
  inputs: [] as Frame[],
}));

vi.mock("@/lib/for-better-or-bulk", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/for-better-or-bulk")>();
  return {
    ...actual,
    stepGame: (state: GameState, input: Frame) => {
      engine.inputs.push(input);
      const result = actual.stepGame(state, input);
      if (!engine.finishNext) return result;
      engine.finishNext = false;
      return {
        ...result,
        state: {
          ...result.state,
          phase: "done" as const,
          ...(engine.finishedAt === null
            ? {}
            : { finishedAt: engine.finishedAt }),
        },
      };
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

vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: scores.record,
}));

import { ForBetterOrBulkGame } from "@/components/for-better-or-bulk/ForBetterOrBulkGame";

/** Runs the loop in quarter-second frames until a condition holds. */
function runUntil(done: () => boolean, maxFrames = 4000) {
  for (let i = 0; i < maxFrames && !done(); i++) {
    // The ceremony playback is not a frame: a viewer skips it.
    const playback = screen.queryByTestId("fbb-playback");
    if (playback) {
      fireEvent.click(
        within(playback).getByRole("button", {
          name: /Skip|Continue to the receipt/,
        })
      );
      continue;
    }
    act(() => {
      if (frame.active) frame.callback?.(250);
    });
  }
}

function game(): HTMLElement {
  return screen.getByTestId("fbb-game");
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
}

/** Answers the loud query with `loud`, and every other query with no match. */
function stubLoud(loud: boolean) {
  window.matchMedia = vi.fn((query: string) =>
    fromPartial<MediaQueryList>({
      matches: loud && query === FBB_LOUD_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
}

describe("For Better or Bulk cabinet (#1906)", () => {
  beforeEach(() => {
    frame.callback = null;
    frame.active = false;
    engine.finishNext = false;
    engine.inputs = [];
    scores.record.mockClear();
    sfx.play.mockClear();
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=8");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
    delete (window as Partial<Window>).matchMedia;
  });

  it("marks the cabinet loud only when the viewer allows motion and the screen is wide", () => {
    stubLoud(true);
    render(<ForBetterOrBulkGame />);
    expect(game().getAttribute("data-fbb-loud")).toBe("on");
  });

  it("is not loud without the media match, so no bursts render", () => {
    stubLoud(false);
    render(<ForBetterOrBulkGame />);
    expect(game().getAttribute("data-fbb-loud")).toBe("off");
  });

  it("shows the brothers' burst only in the loud cabinet", () => {
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    stubLoud(true);
    const { unmount } = render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    expect(screen.getByText("The brothers are texting")).toBeTruthy();
    unmount();

    stubLoud(false);
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    expect(screen.queryByText("The brothers are texting")).toBeNull();
  });

  it("plays the brothers' sound at 1x", () => {
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    expect(sfx.play).toHaveBeenCalledWith("brothers");
  });

  it("plays no sound above 1x", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    expect(sfx.play).not.toHaveBeenCalled();
  });

  it("starts on the plan screen within budget", () => {
    render(<ForBetterOrBulkGame />);
    expect(screen.getByTestId("fbb-setup")).toBeTruthy();
    expect(screen.getByTestId("fbb-total").textContent).toContain(
      "$2,960 of $3,400 (venue"
    );
    expect(screen.getByRole("button", { name: "Start setup" })).toHaveProperty(
      "disabled",
      false
    );
  });

  it("refuses an over-budget cart and a missing website feature", () => {
    render(<ForBetterOrBulkGame />);
    fireEvent.click(screen.getByRole("radio", { name: /^Yes/ }));
    fireEvent.click(screen.getByRole("radio", { name: /^Lots/ }));
    expect(screen.getByRole("alert").textContent).toContain(
      "over the $3,400 budget"
    );
    expect(screen.getByRole("button", { name: "Start setup" })).toHaveProperty(
      "disabled",
      true
    );
    fireEvent.click(screen.getByRole("radio", { name: /^Enough/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^FAQ/ }));
    expect(screen.getByRole("alert").textContent).toContain("Pick exactly 2");
    expect(
      screen.getByRole("checkbox", { name: /^Registry scraper/ })
    ).toHaveProperty("disabled", false);
  });

  it("runs the clock, swaps people with Tab and pauses with Escape", () => {
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-canvas")).toBeTruthy();
    expect(screen.getByTestId("fbb-clock").textContent).toBe("9:00");
    runUntil(() => screen.getByTestId("fbb-clock").textContent !== "9:00");
    expect(screen.getByTestId("fbb-clock").textContent).not.toBe("9:00");

    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab" });
    expect(screen.getByTestId("fbb-active").textContent).toContain("Fred");
    expect(screen.getByRole("status").textContent).toBe("Now playing as Fred.");

    fireEvent.keyDown(game(), { key: "Escape", code: "Escape" });
    expect(frame.active).toBe(false);
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Resume" })[1]);
    expect(frame.active).toBe(true);
  });

  it("walks Abbi to the lantern crate with the arrows and takes one with Enter", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const prompt = () =>
      screen.getByTestId("fbb-prompt-abbi").textContent ?? "";
    fireEvent.keyDown(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    runUntil(
      () => prompt().includes("Take the lantern from the LAMP crate"),
      20
    );
    fireEvent.keyUp(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    expect(prompt()).toContain("Take the lantern from the LAMP crate");
    fireEvent.keyDown(game(), { key: "Enter", code: "Enter" });
    runUntil(() => prompt().includes("carrying"), 2);
    expect(prompt()).toContain("Abbi is carrying a paper lantern.");
  });

  it("stops for the brothers' text, records the choice and ends on the receipt", () => {
    // Normal speed: only an unsped run reaches the leaderboard.
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    const dialog = screen.getByRole("dialog", {
      name: "Text from Fred's brothers",
    });
    expect(frame.active).toBe(false);
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Go with them/ })
    );
    expect(screen.queryByTestId("fbb-brothers")).toBeNull();

    runUntil(() => screen.queryByTestId("fbb-receipt") !== null);
    expect(screen.getByTestId("fbb-title").textContent).toBe("Married Anyway");
    expect(screen.getByTestId("fbb-follow-through").textContent).toContain(
      LEFT_LINE
    );
    expect(scores.record).toHaveBeenCalledWith("for-better-or-bulk", 0, {
      title: "Married Anyway",
    });

    fireEvent.click(screen.getByRole("button", { name: "Change the plan" }));
    expect(screen.getByTestId("fbb-setup")).toBeTruthy();
  });

  it("keeps a sped-up run off the leaderboard (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Go with them/,
      })
    );
    runUntil(() => screen.queryByTestId("fbb-receipt") !== null);
    expect(screen.getByTestId("fbb-receipt")).toBeTruthy();
    expect(scores.record).not.toHaveBeenCalled();
  });

  it("ends the level when a swap lands on the step that finishes it (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    // An E press has not reached the engine yet when Tab is pressed.
    fireEvent.keyDown(game(), { key: "Enter", code: "Enter" });
    engine.finishNext = true;
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab" });
    expect(screen.getByTestId("fbb-playback")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByTestId("fbb-receipt")).toBeTruthy();
  });

  it("ignores held Tab and Escape repeats (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab", repeat: true });
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    fireEvent.keyDown(game(), { key: "Escape", code: "Escape", repeat: true });
    expect(frame.active).toBe(true);
    expect(screen.queryByText(/^Paused at/)).toBeNull();
  });

  it("still moves on a tap shorter than one tick (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    fireEvent.keyDown(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    fireEvent.keyUp(game(), { key: "ArrowLeft", code: "ArrowLeft" });
    engine.inputs = [];
    act(() => frame.callback?.(40));
    expect(engine.inputs[0]?.inputs.abbi.moveX).toBe(-1);
    expect(engine.inputs.slice(1).every((f) => f.inputs.abbi.moveX === 0)).toBe(
      true
    );
  });

  it("pauses with Escape from the Pause button (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const pause = screen.getByRole("button", { name: "Pause" });
    pause.focus();
    fireEvent.keyDown(pause, { key: "Escape", code: "Escape" });
    expect(frame.active).toBe(false);
  });

  it("pauses on a click outside, not when a focused control is removed (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const pause = screen.getByRole("button", { name: "Pause" });
    fireEvent.blur(pause, { relatedTarget: null });
    expect(frame.active).toBe(true);
    fireEvent.blur(game(), { relatedTarget: null });
    expect(frame.active).toBe(false);
  });

  it("keeps focus on the boundary after a mouse pause and resume (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    screen.getByRole("button", { name: "Pause" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(document.activeElement).toBe(game());
    expect(screen.getByRole("region", { name: /^Paused at/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Resume" })[0]);
    expect(document.activeElement).toBe(game());
    expect(frame.active).toBe(true);
  });

  it("moves focus to the brothers' heading as the text opens, and keeps it there (#1963)", async () => {
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    render(<ForBetterOrBulkGame />);
    start();
    // Start moves focus to the cabinet on the next frame; let that land before the text opens.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    const heading = screen.getByRole("heading", {
      name: "Text from Fred's brothers",
    });
    // Focus lands on the heading at once, not after the focus trap's own timer.
    expect(document.activeElement).toBe(heading);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(document.activeElement).toBe(heading);
    fireEvent.click(screen.getByRole("button", { name: /Take a short break/ }));
    expect(document.activeElement).toBe(heading);
  });

  it("hands focus back to the element focused before the text opened, not the heading (#1963)", async () => {
    const state = { ...createLevel(DEFAULT_SETUP), phase: "brothers" as const };
    const before = <button type="button">Before the text</button>;
    const { rerender } = render(<>{before}</>);
    screen.getByRole("button", { name: "Before the text" }).focus();
    rerender(
      <>
        {before}
        <BrothersDialog state={state} onDecide={vi.fn()} />
      </>
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Text from Fred's brothers" })
    );
    rerender(<>{before}</>);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Before the text" })
    );
  });

  it("sends a KeyF press from the game boundary to the engine as work, and leaves fullscreen alone (#1963)", async () => {
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    render(
      <PlayCabinet
        gameId="for-better-or-bulk"
        title="For Better or Bulk"
        icon={<span />}
        instructions="Play"
        controls={[]}
        importComponent={() => Promise.resolve({})}
        fullscreenKey={false}
        singleTitleScreen={false}
      >
        <ForBetterOrBulkGame />
      </PlayCabinet>
    );
    const launch = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.mouseEnter(launch);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(launch);
    });
    await screen.findByRole(
      "button",
      { name: "Start setup" },
      { timeout: 5000 }
    );
    start();
    const cabinet = document.querySelector(
      '[data-arcade-cabinet="for-better-or-bulk"]'
    );
    expect(cabinet?.getAttribute("data-fullscreen")).toBe("false");

    engine.inputs = [];
    fireEvent.keyDown(game(), { key: "f", code: "KeyF" });
    runUntil(() => engine.inputs.some((frame) => frame.inputs.abbi.work), 40);
    expect(engine.inputs.some((frame) => frame.inputs.abbi.work)).toBe(true);
    expect(cabinet?.getAttribute("data-fullscreen")).toBe("false");
    fireEvent.keyUp(game(), { key: "f", code: "KeyF" });

    engine.inputs = [];
    fireEvent.keyDown(game(), { key: "F", code: "KeyF", shiftKey: true });
    runUntil(() => engine.inputs.some((frame) => frame.inputs.abbi.work), 40);
    expect(engine.inputs.some((frame) => frame.inputs.abbi.work)).toBe(true);
    expect(cabinet?.getAttribute("data-fullscreen")).toBe("false");
  });

  /** Runs focus moves at once, and records each window.scrollTo call. */
  function stubScroll() {
    const scroll = vi.fn<(options: ScrollToOptions) => void>();
    window.scrollTo = ((options: ScrollToOptions) =>
      scroll(options)) as typeof window.scrollTo;
    vi.stubGlobal("requestAnimationFrame", (task: FrameRequestCallback) => {
      task(0);
      return 1;
    });
    return scroll;
  }

  it("scrolls the cabinet top below the navbar when a level starts (#1927, #2145)", () => {
    const original = window.scrollTo;
    try {
      const scroll = stubScroll();
      render(<ForBetterOrBulkGame />);
      // scrollIntoView ignored this margin inside the cabinet (#2145), so the
      // page is scrolled by hand to the cabinet top minus its scroll margin.
      game().style.scrollMarginTop = "112px";
      game().getBoundingClientRect = () =>
        fromPartial<DOMRect>({ top: 500, bottom: 1100, left: 0, right: 0 });
      start();
      expect(document.activeElement).toBe(game());
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith({
        top: 500 - 112,
        behavior: "smooth",
      });
    } finally {
      window.scrollTo = original;
    }
  });

  it("scrolls without animation when the viewer prefers reduced motion (#1927)", () => {
    const original = window.scrollTo;
    window.matchMedia = vi.fn((query: string) =>
      fromPartial<MediaQueryList>({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    try {
      const scroll = stubScroll();
      render(<ForBetterOrBulkGame />);
      start();
      expect(scroll).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "auto" })
      );
    } finally {
      window.scrollTo = original;
    }
  });

  it("pauses when focus leaves the cabinet (#1914)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    fireEvent.blur(game(), { relatedTarget: document.body });
    expect(frame.active).toBe(false);
    expect(screen.getByText(/^Paused at/)).toBeTruthy();
  });

  it("says what Abbi carries and how Fred is, from the level (#1914)", () => {
    const level = createLevel(DEFAULT_SETUP);
    const holding = {
      ...level,
      players: {
        ...level.players,
        abbi: {
          ...level.players.abbi,
          holding: { kind: "roses" as const, madeBy: null },
        },
      },
    };
    const { unmount } = render(
      <BrothersDialog state={holding} onDecide={vi.fn()} />
    );
    expect(
      screen.getByText(new RegExp(`Abbi is carrying ${ITEM_LABELS.roses}`))
    ).toBeTruthy();
    expect(screen.getByText(/The wedding is still on\./)).toBeTruthy();
    unmount();

    const free = {
      ...level,
      players: {
        ...level.players,
        fred: { ...level.players.fred, calm: true },
      },
    };
    render(<BrothersDialog state={free} onDecide={vi.fn()} />);
    expect(screen.getByText(/Abbi has her hands free/)).toBeTruthy();
    expect(screen.queryByText(/carrying|chairs/)).toBeNull();
    // The line is about the wedding whatever the mood, so it does not change.
    expect(screen.getByText(/The wedding is still on\./)).toBeTruthy();
  });

  it("offers a break only with a promise about work that is in the plan", () => {
    render(<ForBetterOrBulkGame />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Paper lanterns/ }));
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(screen.getByRole("button", { name: /Take a short break/ }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: "The lanterns" })
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "The chairs" }));
    expect(screen.queryByTestId("fbb-brothers")).toBeNull();
    expect(frame.active).toBe(true);
  });

  it("gives the return time for a leave and a break on either clock", () => {
    const standard = createLevel(DEFAULT_SETUP);
    const atText = { ...standard, phase: "brothers" as const, time: 110 };
    const { unmount } = render(
      <BrothersDialog state={atText} onDecide={vi.fn()} />
    );
    expect(
      screen.getByRole("button", { name: /Go with them/ }).textContent
    ).toContain("Back around 3:18.");
    unmount();

    const relaxedText = {
      ...createLevel({ ...DEFAULT_SETUP, relaxed: true }),
      phase: "brothers" as const,
      time: 181.5,
    };
    expect(relaxedText.duration).toBe(RELAXED_LEVEL_SECONDS);
    render(<BrothersDialog state={relaxedText} onDecide={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Go with them/ }).textContent
    ).toContain("Back around 3:18.");
    fireEvent.click(screen.getByRole("button", { name: /Take a short break/ }));
    expect(screen.getByText(/Back around 2:15, calmer/)).toBeTruthy();
  });
});

describe("For Better or Bulk coach strip and counts", () => {
  beforeEach(() => {
    frame.callback = null;
    frame.active = false;
    window.localStorage.clear();
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=8");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("shows the active person's next step and counts what is left in each crate", () => {
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-coach").textContent).toContain(
      "Grab roses from the ROSE crate on the left."
    );
    expect(screen.getByTestId("fbb-stock").textContent).toBe(
      "Roses 6 · Hot dogs 1 · Wings 1 · Mac 1 · Quinoa 1 · Lanterns 4 · Chairs 8"
    );
  });

  it("gives both people a hint in co-op, and each starts on a different job (#1931)", () => {
    render(<ForBetterOrBulkGame initialMode="coop" />);
    start();
    const lines = within(screen.getByTestId("fbb-coach"))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Fred: Grab roses from the ROSE crate/);
    expect(lines[1]).toMatch(/^Abbi: Grab raw (hot dogs|wings) from the /);
    expect(lines[1]).not.toContain("roses");
  });

  it("leaves co-op Tab to the browser, and Pause is the first control after the cabinet (#1931)", () => {
    render(<ForBetterOrBulkGame initialMode="coop" />);
    start();
    expect(fireEvent.keyDown(game(), { key: "Tab", code: "Tab" })).toBe(true);
    const controls = [...game().querySelectorAll<HTMLElement>("button")];
    expect(controls[0].textContent).toBe("Pause");
    const tips = screen.getByRole("button", { name: "Hide tips" });
    expect(
      controls[0].compareDocumentPosition(tips) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it.each(["solo", "coop"] as const)(
    "never intercepts Shift+Tab in %s play, so it can leave the cabinet (#1931)",
    (mode) => {
      render(<ForBetterOrBulkGame initialMode={mode} />);
      start();
      expect(
        fireEvent.keyDown(game(), { key: "Tab", code: "Tab", shiftKey: true })
      ).toBe(true);
      const pause = screen.getByRole("button", { name: "Pause" });
      pause.focus();
      expect(
        fireEvent.keyDown(pause, { key: "Tab", code: "Tab", shiftKey: true })
      ).toBe(true);
    }
  );

  it("keeps solo Tab as the swap while both people are present (#1931)", () => {
    render(<ForBetterOrBulkGame />);
    start();
    expect(fireEvent.keyDown(game(), { key: "Tab", code: "Tab" })).toBe(false);
  });

  it("hides the strip, remembers the choice, and shows it again on request", () => {
    const { unmount } = render(<ForBetterOrBulkGame />);
    start();
    fireEvent.click(screen.getByRole("button", { name: "Hide tips" }));
    expect(screen.queryByTestId("fbb-coach")).toBeNull();
    expect(window.localStorage.getItem("fbb_hide_tips")).toBe("1");
    unmount();

    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.queryByTestId("fbb-coach")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show tips" }));
    expect(screen.getByTestId("fbb-coach")).toBeTruthy();
    expect(window.localStorage.getItem("fbb_hide_tips")).toBe("0");
  });

  it("shows Fred as out with his brothers while he is away", () => {
    render(<ForBetterOrBulkGame initialMode="coop" />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(screen.getByRole("button", { name: /Go with them/ }));
    const coach = screen.getByTestId("fbb-coach");
    // His absence is said once, in his prompt, not repeated in the coach list.
    expect(coach.textContent).not.toContain("Fred is out with his brothers.");
    expect(coach.textContent).not.toContain("Fred: ");
    expect(screen.getByTestId("fbb-prompt-fred").textContent).toContain(
      "Fred is out with his brothers."
    );
  });

  it("hides the strip when a stale saved choice is overridden and the save fails", () => {
    window.localStorage.setItem("fbb_hide_tips", "0");
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-coach")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide tips" }));
    expect(screen.queryByTestId("fbb-coach")).toBeNull();
    expect(setItem).toHaveBeenCalled();
    setItem.mockRestore();
    // A save that works again clears the session choice, so Show tips persists.
    fireEvent.click(screen.getByRole("button", { name: "Show tips" }));
    expect(screen.getByTestId("fbb-coach")).toBeTruthy();
    expect(window.localStorage.getItem("fbb_hide_tips")).toBe("0");
  });

  it("still renders the cabinet when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-game")).toBeTruthy();
    expect(screen.getByTestId("fbb-coach")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide tips" }));
    expect(screen.queryByTestId("fbb-coach")).toBeNull();
  });
});

describe("For Better or Bulk floor-full toasts", () => {
  it("shows one floor-full line per person every 3 seconds of game time", () => {
    const shown: Partial<Record<"fred" | "abbi", number>> = {};
    const full = (player: "fred" | "abbi"): GameEvent => ({
      type: "floor-full",
      player,
    });
    expect(throttleFloorFull([full("fred")], 10, shown)).toHaveLength(1);
    expect(throttleFloorFull([full("fred")], 11, shown)).toHaveLength(0);
    expect(throttleFloorFull([full("abbi")], 11, shown)).toHaveLength(1);
    expect(throttleFloorFull([full("fred")], 12.9, shown)).toHaveLength(0);
    expect(throttleFloorFull([full("fred")], 13, shown)).toHaveLength(1);
  });

  it("passes every other event through", () => {
    const events: GameEvent[] = [
      { type: "brothers-text" },
      { type: "floor-full", player: "fred" },
    ];
    expect(throttleFloorFull(events, 0, {})).toEqual(events);
  });
});

describe("For Better or Bulk day seed on the page (#1918)", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("selects the seed from the link, and clears the link for the standard day", () => {
    window.history.replaceState(
      null,
      "",
      "/arcade/for-better-or-bulk?speed=1&seed=17"
    );
    render(<ForBetterOrBulkGame />);
    const radios = screen.getAllByRole("radio");
    const checked = (name: RegExp) =>
      radios
        .find((r) => name.test(r.textContent ?? ""))
        ?.getAttribute("aria-checked");
    expect(checked(/^Seed 17/)).toBe("true");
    expect(checked(/^Standard day/)).toBe("false");
    expect(checked(/^Today/)).toBe("false");

    fireEvent.click(screen.getByRole("radio", { name: /Standard day/ }));
    expect(new URLSearchParams(window.location.search).has("seed")).toBe(false);
    expect(window.location.search).toContain("speed=1");
    expect(
      screen
        .getByRole("radio", { name: /Standard day/ })
        .getAttribute("aria-checked")
    ).toBe("true");
  });

  it("does not put a seeded run on the standard board", () => {
    scores.record.mockClear();
    window.history.replaceState(
      null,
      "",
      "/arcade/for-better-or-bulk?speed=1&seed=7"
    );
    render(<ForBetterOrBulkGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Go with them/,
      })
    );
    runUntil(() => screen.queryByTestId("fbb-receipt") !== null);
    expect(screen.getByTestId("fbb-receipt")).toBeTruthy();
    expect(scores.record).not.toHaveBeenCalled();
  });
});

describe("For Better or Bulk solo swap line and the helper's line in the panel", () => {
  beforeEach(() => {
    stubLoud(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the idle partner's swap line in the solo panel, with no buttons under it", () => {
    render(<ForBetterOrBulkGame />);
    start();
    const fred = screen.getByTestId("fbb-prompt-fred");
    expect(fred.textContent).toBe("Fred is waiting. Tab to switch to him.");
    expect(within(fred).queryByRole("button")).toBeNull();
  });

  it("keeps the idle partner out of the panel on a helper day", () => {
    render(
      <ForBetterOrBulkGame
        initialSetup={{ ...DEFAULT_SETUP, assist: true, seed: 12345 }}
      />
    );
    start();
    expect(screen.queryByTestId("fbb-prompt-fred")).toBeNull();
    expect(screen.getByTestId("fbb-prompt-abbi")).toBeTruthy();
  });

  it("shows the helper's job line in the side panel, after the prompts, after the start and after several steps", () => {
    render(
      <ForBetterOrBulkGame
        initialSetup={{ ...DEFAULT_SETUP, assist: true, seed: 12345 }}
      />
    );
    start();
    // The line must be on screen in the prompt column, below the prompt it
    // follows, and not hidden by any ancestor (jsdom does not lay out, so this
    // checks the rendered tree and the computed display and visibility).
    const expectOnPanel = () => {
      const line = screen.getByTestId("fbb-helper");
      const prompt = screen.getByTestId("fbb-prompt-abbi");
      expect(line.textContent).toMatch(/^(Fred|Abbi) .+\.$/);
      expect(line.parentElement).toBe(prompt.parentElement);
      expect(
        prompt.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      for (let el: HTMLElement | null = line; el; el = el.parentElement) {
        expect(el.hidden).toBe(false);
        expect(el.getAttribute("aria-hidden")).not.toBe("true");
        const style = window.getComputedStyle(el);
        expect(style.display).not.toBe("none");
        expect(style.visibility).not.toBe("hidden");
      }
    };
    expectOnPanel();
    const stepsBefore = engine.inputs.length;
    for (let i = 0; i < 12; i++) {
      act(() => {
        if (frame.active) frame.callback?.(250);
      });
    }
    expect(engine.inputs.length).toBeGreaterThan(stepsBefore);
    expectOnPanel();
  });
});

describe("For Better or Bulk side panel: helper, partner and day (fbb round)", () => {
  beforeEach(() => {
    stubLoud(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("names the day in the header and shows the helper's status with the helper on", () => {
    render(
      <ForBetterOrBulkGame
        initialSetup={{ ...DEFAULT_SETUP, assist: true, seed: 12345 }}
      />
    );
    start();
    expect(screen.getByTestId("fbb-seed-name").textContent).toMatch(
      /^Seed 12345 · rush at \d{1,2}:\d{2}, shower at \d{1,2}:\d{2}$/
    );
    expect(screen.getByTestId("fbb-active").textContent).toContain(
      "Tab to swap · Shift+Tab to leave · Escape to pause"
    );
    // The job line is not a live region: the status region announces its kind changes.
    expect(
      screen.getByTestId("fbb-helper").getAttribute("aria-live")
    ).toBeNull();
    expect(screen.getByTestId("fbb-helper").textContent).toMatch(
      /^(Fred|Abbi) .+\.$/
    );
    // The idle line is readable text, not the dim token, and is announced once at the start.
    expect(screen.getByTestId("fbb-helper").className).toContain(
      "text-[var(--fbb-text)]"
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Fred starts helping after Abbi places the first item."
    );
  });

  it("says the helper rule once on the setup screen (#2147)", () => {
    render(<ForBetterOrBulkGame />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Helper for the other person/ })
    );
    const text = screen.getByTestId("fbb-setup").textContent ?? "";
    expect(
      text.split("Helper days don't earn trophies or a board score.").length - 1
    ).toBe(1);
    expect(screen.queryByTestId("fbb-no-rewards")).toBeNull();
  });

  it("keeps the no-trophy line on the side panel during a helper day", () => {
    render(
      <ForBetterOrBulkGame
        initialSetup={{ ...DEFAULT_SETUP, assist: true, seed: 12345 }}
      />
    );
    start();
    expect(screen.getByTestId("fbb-no-rewards").textContent).toContain(
      "earn trophies or a board score"
    );
  });

  it("lists the header's times in clock order, with the ceremony last", () => {
    render(
      <ForBetterOrBulkGame initialSetup={{ ...DEFAULT_SETUP, seed: 12345 }} />
    );
    start();
    const seedText = screen.getByTestId("fbb-seed-name").textContent ?? "";
    const minutes = [...seedText.matchAll(/(\d{1,2}):(\d{2})/g)].map(
      (m) => Number(m[1]) * 60 + Number(m[2])
    );
    expect(minutes.length).toBe(2);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    const header = screen.getByTestId("fbb-clock").parentElement;
    const spans = [...(header?.querySelectorAll("span") ?? [])].map(
      (s) => s.textContent ?? ""
    );
    const timed = spans.filter((s) => /\d{1,2}:\d{2}/.test(s));
    expect(timed.at(-1)).toBe("Ceremony at 4:00");
    expect(timed).toContain(seedText);
  });

  it("names the standard day and hides the helper line when the helper is off", () => {
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-seed-name").textContent).toBe(
      "Standard day"
    );
    expect(screen.queryByTestId("fbb-helper")).toBeNull();
  });

  it("keeps Fred visible with his return time while Abbi plays alone", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(screen.getByRole("button", { name: /Go with them/ }));
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    const fred = screen.getByTestId("fbb-prompt-fred").textContent ?? "";
    expect(fred).toContain("Fred is out with his brothers.");
    expect(fred).toContain("Back around 3:18.");
  });

  it("does not let Tab hand the keys to a partner who is out", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.click(screen.getByRole("button", { name: /Go with them/ }));
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    // The hint says why Tab does not swap (round 16, round 18 S-1).
    expect(screen.getByTestId("fbb-active").textContent).toContain(
      "Fred is out, so Tab does nothing"
    );
    // With one person out there is no swap, and Tab keeps focus on the game
    // so the arrows still move Abbi.
    expect(fireEvent.keyDown(game(), { key: "Tab", code: "Tab" })).toBe(false);
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    expect(screen.getByRole("status").textContent).toBe(
      "Fred is out with his brothers."
    );
  });

  it("offers the leave option with the promise that Abbi works alone", () => {
    const atText = {
      ...createLevel(DEFAULT_SETUP),
      phase: "brothers" as const,
      time: 110,
    };
    render(<BrothersDialog state={atText} onDecide={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Go with them/ }).textContent
    ).toContain("Abbi works alone until Fred is back.");
  });

  it("shows the shower's start toast on the cabinet", () => {
    render(
      <ForBetterOrBulkGame initialSetup={{ ...DEFAULT_SETUP, seed: 12345 }} />
    );
    start();
    const shower = bankText("shower-start");
    runUntil(
      () =>
        screen.queryAllByText(shower).length > 0 ||
        screen.queryByTestId("fbb-brothers") !== null
    );
    // The visible toast is a list item; the live region repeats the same words.
    const toasts = screen
      .getAllByText(shower)
      .filter((node) => node.tagName === "LI");
    expect(toasts).toHaveLength(1);
  });

  it("shows the guest rush's start toast and announces it (#1927)", () => {
    render(
      <ForBetterOrBulkGame initialSetup={{ ...DEFAULT_SETUP, seed: 12345 }} />
    );
    start();
    const rush = bankText("rush-start");
    runUntil(
      () =>
        screen.queryAllByText(rush).length > 0 ||
        screen.queryByTestId("fbb-brothers") !== null
    );
    const toasts = screen
      .getAllByText(rush)
      .filter((node) => node.tagName === "LI");
    expect(toasts).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain(rush);
  });
});

describe("For Better or Bulk day names", () => {
  it("names the standard day, today's seed, or the seed number", () => {
    expect(seedName(0, 99)).toBe("Standard day");
    expect(seedName(99, 99)).toBe("Today's seed");
    expect(seedName(12345, 99)).toBe("Seed 12345");
  });
});

describe("the brothers' text (round 8, B1)", () => {
  /** The level at the brothers' text, with every category still open. */
  const atText = { ...createLevel(DEFAULT_SETUP), phase: "brothers" as const };

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("puts focus on the dialog heading, not on Stay and help", async () => {
    render(<BrothersDialog state={atText} onDecide={vi.fn()} />);
    const heading = screen.getByRole("heading", {
      name: "Text from Fred's brothers",
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: /Stay and help/ })
    );
  });

  it("ignores an interact key in the first half second, and then lets it choose", () => {
    const SETTLE_MS = 500;
    const opened = 1_000_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(opened);
    const onDecide = vi.fn();
    render(<BrothersDialog state={atText} onDecide={onDecide} />);
    const stay = screen.getByRole("button", { name: /Stay and help/ });

    now.mockReturnValue(opened + SETTLE_MS - 1);
    expect(fireEvent.keyDown(stay, { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(stay, { key: " " })).toBe(false);
    expect(fireEvent.keyUp(stay, { key: "e" })).toBe(false);
    expect(onDecide).not.toHaveBeenCalled();

    now.mockReturnValue(opened + SETTLE_MS);
    expect(fireEvent.keyDown(stay, { key: "Enter" })).toBe(true);
    expect(onDecide).not.toHaveBeenCalled();
  });

  it("lets a mouse click choose at once, inside the settle time", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const onDecide = vi.fn();
    render(<BrothersDialog state={atText} onDecide={onDecide} />);
    fireEvent.click(screen.getByRole("button", { name: /Stay and help/ }));
    expect(onDecide).toHaveBeenCalledWith({ choice: "stay", commitment: null });
  });

  it("does not choose on Escape", () => {
    const onDecide = vi.fn();
    render(<BrothersDialog state={atText} onDecide={onDecide} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("heading"), { key: "Escape" });
    expect(onDecide).not.toHaveBeenCalled();
  });

  it("leaves out a promise whose categories are already complete (S6)", () => {
    const level = createLevel(DEFAULT_SETUP);
    const lanternsDone = {
      ...level,
      targets: level.targets.map((t) =>
        t.category === "lanterns"
          ? {
              ...t,
              status: "filled" as const,
              filled: Array.from({ length: t.capacity }, () => ({
                kind: "lantern" as const,
                madeBy: null,
              })),
            }
          : t
      ),
    };
    expect(availableCommitments(level)).toContain("lanterns");
    expect(availableCommitments(lanternsDone)).not.toContain("lanterns");
    expect(availableCommitments(lanternsDone)).toContain("chairs");
  });

  it("does not put the pause sheet over the text when Escape is pressed (round 8, B1)", () => {
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    render(<ForBetterOrBulkGame />);
    start();
    runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
    fireEvent.keyDown(game(), { key: "Escape" });
    expect(screen.queryByText(/^Paused at/)).toBeNull();
    expect(screen.getByTestId("fbb-brothers")).toBeTruthy();
  });

  it("shows the text and its toast together, and the level stops while it is up", () => {
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=1");
    for (const mode of ["solo", "coop"] as const) {
      const { unmount } = render(<ForBetterOrBulkGame initialMode={mode} />);
      start();
      runUntil(() => screen.queryByTestId("fbb-brothers") !== null);
      expect(screen.getByTestId("fbb-brothers")).toBeTruthy();
      const toast = Array.from(document.querySelectorAll("li")).some(
        (li) => li.textContent === "Fred's brothers are texting."
      );
      expect(toast).toBe(true);
      expect(frame.active).toBe(false);
      unmount();
    }
  });
});

/** Runs the solo level until Abbi's phone line shows, clicking Stay if the brothers' text stops it. */
function runUntilPhoneLine() {
  runUntil(() => {
    const dialog = screen.queryByTestId("fbb-brothers");
    if (dialog) {
      fireEvent.click(
        within(dialog).getByRole("button", { name: /Stay and help/ })
      );
    }
    return screen.queryAllByText(/is on the phone/).length > 0;
  });
}

describe("solo keys and prompts (round 9)", () => {
  beforeEach(() => {
    frame.callback = null;
    frame.active = false;
    engine.finishNext = false;
    engine.inputs = [];
    stubLoud(false);
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk?speed=8");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    delete (window as Partial<Window>).matchMedia;
  });

  it("records F as Abbi's work key in solo, and does not give it to Fred", () => {
    render(<ForBetterOrBulkGame />);
    start();
    expect(screen.getByTestId("fbb-active").textContent).toContain("Abbi");
    fireEvent.keyDown(game(), { key: "f", code: "KeyF" });
    act(() => {
      frame.callback?.(250);
    });
    fireEvent.keyUp(game(), { key: "f", code: "KeyF" });
    const held = engine.inputs.filter((f) => f.inputs.abbi.work);
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((f) => !f.inputs.fred.work)).toBe(true);
  });

  it("shows Abbi's phone line while she is at the keys, and still while she is idle", () => {
    render(<ForBetterOrBulkGame />);
    start();
    runUntilPhoneLine();
    expect(screen.getByTestId("fbb-prompt-abbi").textContent).toMatch(
      /Abbi is on the phone \(about \d+ min left\): What should we get you\?/
    );
    fireEvent.keyDown(game(), { key: "Tab", code: "Tab" });
    expect(screen.getByTestId("fbb-active").textContent).toContain("Fred");
    expect(screen.getByTestId("fbb-prompt-abbi").textContent).toMatch(
      /Abbi is on the phone \(about \d+ min left\)/
    );
  });
});

describe("the brothers' options share one resting look (round 9)", () => {
  const atText = { ...createLevel(DEFAULT_SETUP), phase: "brothers" as const };

  afterEach(() => {
    cleanup();
  });

  it("gives Stay and help no highlight of its own before focus", () => {
    render(<BrothersDialog state={atText} onDecide={vi.fn()} />);
    const stay = screen.getByRole("button", { name: /Stay and help/ });
    const leave = screen.getByRole("button", { name: /Go with them/ });
    const breakButton = screen.getByRole("button", {
      name: /Take a short break/,
    });
    expect(stay.className).toBe(leave.className);
    expect(stay.className).toBe(breakButton.className);
    expect(stay.className).not.toMatch(/(^|\s)border-\[var\(--fbb-accent\)\]/);
    expect(document.activeElement).not.toBe(stay);
  });

  it("names the break button with a short label and the promise as its description (round 15)", () => {
    render(<BrothersDialog state={atText} onDecide={vi.fn()} />);
    const breakButton = screen.getByRole("button", {
      name: "Take a short break.",
    });
    const detail = document.getElementById(
      breakButton.getAttribute("aria-describedby") ?? ""
    );
    expect(detail?.textContent).toBe("(Promise to come back for something.)");
  });
});

describe("For Better or Bulk time challenge (#2056)", () => {
  beforeEach(() => {
    frame.callback = null;
    frame.active = false;
    engine.finishNext = false;
    engine.finishedAt = null;
    scores.record.mockClear();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/arcade/for-better-or-bulk");
  });

  afterEach(() => {
    cleanup();
    engine.finishedAt = null;
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  /** Plays a solo standard day that ends with everything set at `finishedAt`. */
  function finishDay(finishedAt: number) {
    start();
    engine.finishedAt = finishedAt;
    engine.finishNext = true;
    runUntil(() => screen.queryByTestId("fbb-receipt") !== null);
  }

  it("records a finished solo day's time as a best that persists, and keeps the board score as placements", () => {
    render(<ForBetterOrBulkGame />);
    expect(screen.getByTestId("fbb-best-time").textContent).toContain(
      "No best time yet"
    );
    finishDay(110);
    expect(screen.getByTestId("fbb-run-time").textContent).toBe(
      "Everything set at 12:51, 21 minutes under par."
    );
    expect(screen.getByTestId("fbb-best-time").textContent).toContain(
      "New best"
    );
    expect(scores.record).toHaveBeenCalledWith(
      "for-better-or-bulk",
      expect.any(Number),
      expect.anything()
    );
    // A reload shows the best on the setup screen.
    cleanup();
    render(<ForBetterOrBulkGame />);
    expect(screen.getByTestId("fbb-best-time").textContent).toBe(
      "Your best: 12:51."
    );
    finishDay(130);
    expect(screen.getByTestId("fbb-best-time").textContent).toBe(
      "Your best: 12:51."
    );
  });

  it("does not record a helper day", () => {
    render(
      <ForBetterOrBulkGame initialSetup={{ ...DEFAULT_SETUP, assist: true }} />
    );
    finishDay(90);
    expect(screen.getByTestId("fbb-no-best").textContent).toBe(
      "Helper days don't set a best time."
    );
    expect(window.localStorage.getItem("fbb_best_times")).toBeNull();
  });
});
