// @vitest-environment jsdom
//
// Phone Back and browser Back in the cabinet (#2545): one history entry per
// launch, popstate walking the Escape ladder, a re-push on every step that
// keeps the cabinet open, a toolbar Exit that pops the entry, and a reload
// while launched that leaves nothing to trap Back.
import React, { useEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { defineGameViews } from "@/components/arcade/views";
import {
  CABINET_HISTORY_KEY,
  createCabinetHistory,
  isCabinetHistoryState,
  resolveBack,
  type BackOutcome,
  type CabinetHistoryTarget,
} from "@/components/arcade/pause";
import { EDGE_KEEP_OUT_PX, inEdgeKeepOut } from "@/components/arcade/mobile";
import { CounterSessionHolder } from "./fixtures/three-view-game/session";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

/** A session history: entries, an index, and Back that fires popstate. */
class FakeHistory implements CabinetHistoryTarget {
  entries: unknown[] = [{ __NA: true, tree: "page" }];
  index = 0;
  readonly calls: string[] = [];
  onPop: () => void = () => {};

  get state(): unknown {
    return this.entries[this.index];
  }
  get length(): number {
    return this.entries.length;
  }
  pushState(data: unknown) {
    this.calls.push("push");
    this.entries = [...this.entries.slice(0, this.index + 1), data];
    this.index += 1;
  }
  replaceState(data: unknown) {
    this.calls.push("replace");
    this.entries[this.index] = data;
  }
  back() {
    this.calls.push("back");
    if (this.index === 0) return;
    this.index -= 1;
    this.onPop();
  }
  /** The player's Back: the same traversal, from outside the cabinet. */
  playerBack() {
    this.back();
    this.calls.pop();
  }
  forward() {
    if (this.index >= this.entries.length - 1) return;
    this.index += 1;
    this.onPop();
  }
}

function machine(outcomes: BackOutcome[] = []) {
  const history = new FakeHistory();
  const onBack = vi.fn(() => outcomes.shift() ?? "exit");
  const cabinet = createCabinetHistory({
    slug: "fixture",
    getHistory: () => history,
  });
  history.onPop = () => cabinet.handlePopState(onBack);
  return { history, onBack, cabinet };
}

describe("cabinet history state machine (#2545)", () => {
  it("adds no entry before Launch", () => {
    const { history, cabinet } = machine();
    cabinet.discardStale();
    expect(history.length).toBe(1);
    expect(history.calls).toEqual([]);
    expect(cabinet.isPushed()).toBe(false);
  });

  it("pushes one entry on Launch, keeping the router's state", () => {
    const { history, cabinet } = machine();
    cabinet.push();
    cabinet.push();
    expect(history.length).toBe(2);
    expect(history.calls).toEqual(["push"]);
    expect(history.state).toMatchObject({
      __NA: true,
      tree: "page",
      [CABINET_HISTORY_KEY]: "fixture",
    });
    expect(isCabinetHistoryState(history.state, "fixture")).toBe(true);
    expect(isCabinetHistoryState(history.state, "other")).toBe(false);
  });

  it("walks the ladder on Back and pushes the entry again while it stays", () => {
    const { history, onBack, cabinet } = machine(["stay", "stay", "exit"]);
    cabinet.push();

    history.playerBack();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(history.index).toBe(1);
    expect(isCabinetHistoryState(history.state, "fixture")).toBe(true);

    history.playerBack();
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(history.index).toBe(1);

    history.playerBack();
    expect(onBack).toHaveBeenCalledTimes(3);
    expect(history.index).toBe(0);
    expect(cabinet.isPushed()).toBe(false);
    expect(isCabinetHistoryState(history.state, "fixture")).toBe(false);

    // The cabinet is closed: the next Back is the page's own.
    history.playerBack();
    expect(onBack).toHaveBeenCalledTimes(3);
  });

  it("pops the entry when the cabinet exits by its toolbar", () => {
    const { history, onBack, cabinet } = machine();
    cabinet.push();
    cabinet.release();
    expect(history.calls).toEqual(["push", "back"]);
    expect(history.index).toBe(0);
    // The cabinet's own pop is not a Back.
    expect(onBack).not.toHaveBeenCalled();
    // A second release has nothing to pop.
    cabinet.release();
    expect(history.calls).toEqual(["push", "back"]);
  });

  it("leaves history alone after Back already exited", () => {
    const { history, cabinet } = machine(["exit"]);
    cabinet.push();
    history.playerBack();
    cabinet.release();
    expect(history.calls).toEqual(["push"]);
  });

  it("strips a reload's stale entry so it never traps Back", () => {
    // The page was reloaded while launched: the entry from the old document
    // is current, and the new cabinet is not launched.
    const { history, onBack, cabinet } = machine();
    history.entries.push({
      __NA: true,
      tree: "page",
      [CABINET_HISTORY_KEY]: "fixture",
      arcadeCabinetLaunch: "old",
    });
    history.index = 1;

    cabinet.discardStale();
    expect(history.calls).toEqual(["replace"]);
    expect(history.state).toEqual({ __NA: true, tree: "page" });

    history.playerBack();
    expect(history.index).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
    expect(history.calls).toEqual(["replace"]);
  });

  it("strips an old entry reached by Forward with no cabinet open", () => {
    const { history, onBack, cabinet } = machine(["exit"]);
    cabinet.push();
    history.playerBack();
    history.forward();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(isCabinetHistoryState(history.state, "fixture")).toBe(false);
  });

  it("forgets the entry on unmount without moving history", () => {
    const { history, cabinet } = machine();
    cabinet.push();
    cabinet.abandon();
    cabinet.release();
    expect(history.calls).toEqual(["push"]);
  });

  it("does nothing without a history", () => {
    const cabinet = createCabinetHistory({
      slug: "fixture",
      getHistory: () => null,
    });
    expect(() => {
      cabinet.discardStale();
      cabinet.push();
      cabinet.handlePopState(() => "stay");
      cabinet.release();
    }).not.toThrow();
    expect(cabinet.isPushed()).toBe(false);
  });

  it("Back is the Escape ladder with exit in place of offer-exit", () => {
    expect(resolveBack({ sheetOpen: true, overlayOpen: false })).toBe(
      "close-sheet"
    );
    expect(resolveBack({ sheetOpen: true, overlayOpen: true })).toBe(
      "close-sheet"
    );
    expect(resolveBack({ sheetOpen: false, overlayOpen: false })).toBe("pause");
    expect(resolveBack({ sheetOpen: false, overlayOpen: true })).toBe("exit");
  });

  it("keeps drag origins out of the 24px edge zone", () => {
    expect(EDGE_KEEP_OUT_PX).toBe(24);
    expect(inEdgeKeepOut(10, 844)).toBe(true);
    expect(inEdgeKeepOut(30, 844)).toBe(false);
    expect(inEdgeKeepOut(830, 844)).toBe(true);
    expect(inEdgeKeepOut(50, 844, 47, 47)).toBe(true);
    expect(inEdgeKeepOut(72, 844, 47, 47)).toBe(false);
  });
});

/** A fixture game with a sheet that closes on its own Escape. */
function SheetSessionHolder({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    if (!sheet) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sheet]);
  return (
    <CounterSessionHolder>
      <button type="button" onClick={() => setSheet(true)}>
        Open sheet
      </button>
      {sheet ? (
        <div role="dialog" aria-label="Sheet">
          <button type="button">Inside the sheet</button>
        </div>
      ) : null}
      {children}
    </CounterSessionHolder>
  );
}

const views = defineGameViews({
  session: SheetSessionHolder,
  desktop: () => import("./fixtures/three-view-game/DesktopView"),
  tablet: () => import("./fixtures/three-view-game/TabletView"),
  phone: () => import("./fixtures/three-view-game/PhoneView"),
});

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function launch() {
  const button = screen.getByRole("button", { name: /Launch Cabinet/i });
  await act(async () => {
    fireEvent.mouseEnter(button);
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  vi.useRealTimers();
  await flush();
}

function renderCabinet(extra: {
  withViews?: boolean;
  onAutoPause?: () => void;
}) {
  render(
    <PlayCabinet
      gameId="fixture"
      title="Fixture Game"
      icon={<span>F</span>}
      instructions="Count to ten."
      controls={[{ key: "Space", action: "Add one" }]}
      importComponent={() => Promise.resolve({})}
      onAutoPause={extra.onAutoPause}
      {...(extra.withViews === false ? {} : { views })}
    >
      {extra.withViews === false ? (
        <div data-keyboard-boundary="true" tabIndex={-1}>
          Legacy game
        </div>
      ) : null}
    </PlayCabinet>
  );
}

const cabinetOpen = () =>
  document.querySelector("[data-arcade-cabinet]") !== null;
const launchedEntry = () =>
  isCabinetHistoryState(window.history.state, "fixture");

/** The player's Back, and the popstate it fires. */
async function pressBack() {
  const popped = new Promise<void>((resolve) =>
    window.addEventListener("popstate", () => resolve(), { once: true })
  );
  act(() => {
    window.history.back();
  });
  await popped;
  await flush();
}

describe("PlayCabinet phone Back (#2545)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("adds no history entry until Launch, then exactly one", async () => {
    const before = window.history.length;
    renderCabinet({});
    expect(window.history.length).toBe(before);
    expect(launchedEntry()).toBe(false);

    await launch();
    expect(window.history.length).toBe(before + 1);
    expect(launchedEntry()).toBe(true);
  });

  it("Back closes the sheet, then pauses, then exits to Launch", async () => {
    renderCabinet({});
    await launch();
    fireEvent.click(await screen.findByRole("button", { name: "Add one" }));
    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    screen.getByRole("button", { name: "Inside the sheet" }).focus();

    await pressBack();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Sheet" })).toBeNull()
    );
    expect(cabinetOpen()).toBe(true);
    expect(launchedEntry()).toBe(true);
    // Back's Escape belonged to the sheet: the cabinet did not pause.
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
    expect(screen.getByText(/view: 1/)).toBeTruthy();

    await pressBack();
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    expect(launchedEntry()).toBe(true);
    expect(screen.getByText(/view: 1/)).toBeTruthy();

    await pressBack();
    expect(cabinetOpen()).toBe(false);
    expect(launchedEntry()).toBe(false);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /Launch Cabinet/i })
      )
    );
  });

  it("Exit from the toolbar pops the entry and returns focus to Launch", async () => {
    renderCabinet({});
    await launch();
    await screen.findByRole("button", { name: "Add one" });

    const popped = new Promise<void>((resolve) =>
      window.addEventListener("popstate", () => resolve(), { once: true })
    );
    fireEvent.click(screen.getAllByTitle("Reset / Power Off Cabinet")[0]);
    await popped;
    await flush();

    expect(cabinetOpen()).toBe(false);
    expect(launchedEntry()).toBe(false);
    // The player is back on the pre-Launch entry, so Back leaves the page.
    expect(window.history.state).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Launch Cabinet/i })
    );
  });

  it("a reload while launched leaves no entry that traps Back", () => {
    window.history.pushState(
      { [CABINET_HISTORY_KEY]: "fixture", arcadeCabinetLaunch: "old" },
      ""
    );
    renderCabinet({});
    expect(launchedEntry()).toBe(false);
    expect(cabinetOpen()).toBe(false);
  });

  it("without views, Back pauses and says so, and a second Back exits", async () => {
    const onAutoPause = vi.fn();
    renderCabinet({ withViews: false, onAutoPause });
    await launch();
    await screen.findByText("Legacy game");

    await pressBack();
    expect(onAutoPause).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cabinet-back-hint").textContent).toMatch(
      /Back again to exit/
    );
    expect(cabinetOpen()).toBe(true);
    expect(launchedEntry()).toBe(true);

    await pressBack();
    expect(cabinetOpen()).toBe(false);
    expect(launchedEntry()).toBe(false);
  });

  it("without views, touching the game disarms the second Back", async () => {
    renderCabinet({ withViews: false, onAutoPause: vi.fn() });
    await launch();
    await screen.findByText("Legacy game");

    await pressBack();
    expect(screen.getByTestId("cabinet-back-hint")).toBeTruthy();
    fireEvent.pointerDown(screen.getByText("Legacy game"));
    await flush();
    expect(screen.queryByTestId("cabinet-back-hint")).toBeNull();

    await pressBack();
    expect(cabinetOpen()).toBe(true);
    expect(screen.getByTestId("cabinet-back-hint")).toBeTruthy();
  });

  it("Back during the warmup cancels the launch", async () => {
    renderCabinet({});
    const button = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(launchedEntry()).toBe(true);
    vi.useRealTimers();

    await pressBack();
    expect(launchedEntry()).toBe(false);
    expect(
      screen.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeTruthy();
    expect(screen.queryByText(/Warming up CRT display/)).toBeNull();
  });
});
