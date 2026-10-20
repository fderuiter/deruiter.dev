// @vitest-environment jsdom
//
// The cabinet's one pause service (#2357): pause reasons, suspend-to-save
// with one versioned run snapshot, the screen wake lock, WebGL context loss,
// the shared pause overlay and the P and Escape rule.
import React, { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { z } from "zod";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import {
  ArcadeSessionProvider,
  createArcadeStore,
  defineGameViews,
  type ArcadeSession,
} from "@/components/arcade/views";
import {
  CabinetPauseProvider,
  DISCARDED_RUN_NOTICE,
  createPauseController,
  useCabinetRunActive,
  useContextLossPause,
  useRunSnapshot,
  useScreenWakeLock,
} from "@/components/arcade/pause";
import { useCabinetAutoPause } from "@/components/arcade/mobile";
import { runSnapshotKey } from "@/lib/arcade";
import type { CounterState } from "./fixtures/three-view-game/session";

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
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

class MockStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

type Intent =
  { readonly type: "add" } | { readonly type: "set"; readonly count: number };

const counterState = z.object({ count: z.number().int() });

function reduce(state: CounterState, intent: Intent): CounterState {
  if (intent.type === "add") return { count: state.count + 1 };
  return { count: intent.count };
}

function makeSession(): ArcadeSession<CounterState, Intent> {
  const store = createArcadeStore<CounterState, Intent>({ count: 0 }, reduce);
  return {
    ...store,
    snapshot: () => store.getState(),
    restore: (data) =>
      store.dispatch({ type: "set", count: counterState.parse(data).count }),
    tuning: { assist: 0.5 },
  };
}

/** A real-time fixture game that saves its run and can open a sheet. */
function SavingSessionHolder({ children }: { children: ReactNode }) {
  const [session] = useState(makeSession);
  const run = useRunSnapshot(session, { schema: 1, state: counterState });
  useCabinetRunActive(true);
  const [sheet, setSheet] = useState(false);
  return (
    <ArcadeSessionProvider value={session}>
      {run.saved ? (
        <button type="button" onClick={run.resumeSaved}>
          Resume saved run
        </button>
      ) : null}
      {run.notice ? <p>{run.notice}</p> : null}
      <button type="button" onClick={() => setSheet(true)}>
        Open sheet
      </button>
      {sheet ? (
        <div role="dialog" aria-label="Sheet">
          <button type="button" onClick={() => setSheet(false)}>
            Close sheet
          </button>
        </div>
      ) : null}
      {children}
    </ArcadeSessionProvider>
  );
}

const views = defineGameViews({
  session: SavingSessionHolder,
  desktop: () => import("./fixtures/three-view-game/DesktopView"),
  tablet: () => import("./fixtures/three-view-game/TabletView"),
  phone: () => import("./fixtures/three-view-game/PhoneView"),
});

function setWindow(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

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

function renderCabinet() {
  render(
    <PlayCabinet
      gameId="fixture"
      title="Fixture Game"
      icon={<span>F</span>}
      instructions="Count to ten."
      controls={[{ key: "Space", action: "Add one" }]}
      importComponent={() => Promise.resolve({})}
      views={views}
    />
  );
}

function cabinetRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("[data-arcade-cabinet]");
  if (!root) throw new Error("no cabinet");
  return root;
}

function hidePage() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "hidden",
  });
  try {
    fireEvent(document, new Event("visibilitychange"));
  } finally {
    Reflect.deleteProperty(document, "visibilityState");
  }
}

function savedRun(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(runSnapshotKey("fixture"));
  return raw === null ? null : JSON.parse(raw);
}

function pressKey(key: string) {
  const target =
    document.activeElement instanceof HTMLElement &&
    cabinetRoot().contains(document.activeElement)
      ? document.activeElement
      : cabinetRoot();
  fireEvent.keyDown(target, { key });
}

interface MockSentinel {
  released: boolean;
  release: ReturnType<typeof vi.fn>;
}

function installWakeLock() {
  const sentinels: MockSentinel[] = [];
  const request = vi.fn(() => {
    const sentinel: MockSentinel = {
      released: false,
      release: vi.fn(() => {
        sentinel.released = true;
        return Promise.resolve();
      }),
    };
    sentinels.push(sentinel);
    return Promise.resolve(sentinel);
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  return { request, sentinels };
}

describe("cabinet pause service (#2357)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    announce.mockClear();
    window.history.replaceState(null, "", "/");
    setWindow(1280, 800);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MockStorage(),
    });
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
    Reflect.deleteProperty(navigator, "wakeLock");
    Reflect.deleteProperty(document, "fullscreenEnabled");
    window.history.replaceState(null, "", "/");
  });

  describe("suspend-to-save", () => {
    it("saves the run when the page hides and on pagehide, never on beforeunload", async () => {
      renderCabinet();
      await launch();
      fireEvent.click(await screen.findByRole("button", { name: "Add one" }));
      fireEvent.click(screen.getByRole("button", { name: "Add one" }));

      fireEvent(window, new Event("beforeunload"));
      expect(savedRun()).toBeNull();

      hidePage();
      expect(savedRun()).toMatchObject({
        schema: 1,
        view: "desktop",
        tuning: { assist: 0.5 },
        state: { count: 2 },
      });
      expect(typeof savedRun()?.savedAt).toBe("number");

      window.localStorage.clear();
      fireEvent(window, new Event("pagehide"));
      expect(savedRun()).toMatchObject({ state: { count: 2 } });
    });

    it("saves on every pause, and the hidden pause waits for Resume", async () => {
      renderCabinet();
      await launch();
      fireEvent.click(await screen.findByRole("button", { name: "Add one" }));
      hidePage();
      expect(cabinetRoot().getAttribute("data-paused")).toBe("true");
      expect(screen.getByText("Paused while you were away.")).toBeTruthy();

      window.localStorage.clear();
      pressKey("Escape");
      expect(savedRun()).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Resume" }));
      expect(cabinetRoot().getAttribute("data-paused")).toBe("false");
      pressKey("p");
      expect(savedRun()).toMatchObject({ state: { count: 1 } });
    });

    it("offers a saved run on the next visit and restores it", async () => {
      window.localStorage.setItem(
        runSnapshotKey("fixture"),
        JSON.stringify({
          schema: 1,
          savedAt: 1,
          view: "phone",
          tuning: {},
          state: { count: 7 },
        })
      );
      renderCabinet();
      await launch();
      expect(await screen.findByText("Desktop view: 0")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Resume saved run" }));
      expect(await screen.findByText("Desktop view: 7")).toBeTruthy();
    });

    it("keeps an offered save until the player chooses", async () => {
      const saved = JSON.stringify({
        schema: 1,
        savedAt: 1,
        view: "desktop",
        tuning: {},
        state: { count: 7 },
      });
      window.localStorage.setItem(runSnapshotKey("fixture"), saved);
      renderCabinet();
      await launch();
      await screen.findByText("Desktop view: 0");
      hidePage();
      expect(window.localStorage.getItem(runSnapshotKey("fixture"))).toBe(
        saved
      );
    });

    it.each([
      ["a schema mismatch", { schema: 9, state: { count: 7 } }],
      ["a parse error", { schema: 1, state: { count: "seven" } }],
    ])("discards %s with one notice and never throws", async (_label, save) => {
      window.localStorage.setItem(
        runSnapshotKey("fixture"),
        JSON.stringify({ savedAt: 1, view: "desktop", tuning: {}, ...save })
      );
      renderCabinet();
      await launch();
      expect(await screen.findByText("Desktop view: 0")).toBeTruthy();
      expect(screen.getAllByText(DISCARDED_RUN_NOTICE)).toHaveLength(1);
      expect(
        announce.mock.calls.filter(([text]) => text === DISCARDED_RUN_NOTICE)
      ).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Resume saved run" })).toBe(
        null
      );
      expect(savedRun()).toBeNull();
    });
  });

  describe("the P and Escape rule", () => {
    it("Escape pauses, then offers exit; P resumes", async () => {
      renderCabinet();
      await launch();
      fireEvent.click(await screen.findByRole("button", { name: "Add one" }));

      pressKey("Escape");
      const resume = screen.getByRole("button", { name: "Resume" });
      await waitFor(() => expect(document.activeElement).toBe(resume));
      expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();

      pressKey("Escape");
      expect(screen.getByText(/Leave the game\?/)).toBeTruthy();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Exit" })
      );
      // A third press never leaves on its own.
      pressKey("Escape");
      expect(document.querySelector("[data-arcade-cabinet]")).not.toBeNull();

      pressKey("P");
      expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
      expect(cabinetRoot().getAttribute("data-paused")).toBe("false");
    });

    it("an open sheet gets Escape first, and P waits for it", async () => {
      renderCabinet();
      await launch();
      fireEvent.click(
        await screen.findByRole("button", { name: "Open sheet" })
      );
      screen.getByRole("button", { name: "Close sheet" }).focus();

      pressKey("Escape");
      pressKey("p");
      expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
    });

    it("Exit on the overlay leaves the cabinet", async () => {
      renderCabinet();
      await launch();
      await screen.findByRole("button", { name: "Add one" });
      pressKey("p");
      fireEvent.click(screen.getByRole("button", { name: "Exit" }));
      expect(document.querySelector("[data-arcade-cabinet]")).toBeNull();
    });

    it("How to play shows the cabinet's instructions and controls", async () => {
      renderCabinet();
      await launch();
      await screen.findByRole("button", { name: "Add one" });
      pressKey("p");
      fireEvent.click(screen.getByRole("button", { name: "How to play" }));
      expect(screen.getByText("Count to ten.")).toBeTruthy();
    });
  });

  describe("view swap", () => {
    it("pauses with view-swap, opens a sheet on the phone and focuses Resume", async () => {
      renderCabinet();
      await launch();
      fireEvent.click(await screen.findByRole("button", { name: "Add one" }));

      await act(async () => {
        setWindow(390, 844);
        window.dispatchEvent(new Event("resize"));
      });
      await flush();

      expect(await screen.findByText("Phone view: 1")).toBeTruthy();
      expect(screen.getByText("Paused while the layout changed.")).toBeTruthy();
      expect(
        screen.getByTestId("pause-overlay").getAttribute("data-pause-layout")
      ).toBe("sheet");
      const resume = screen.getByRole("button", { name: "Resume" });
      await waitFor(() => expect(document.activeElement).toBe(resume));
    });

    it("hides the Fullscreen control in the phone view without element fullscreen", async () => {
      Object.defineProperty(document, "fullscreenEnabled", {
        configurable: true,
        get: () => false,
      });
      renderCabinet();
      await launch();
      await screen.findByText("Desktop view: 0");
      expect(
        screen.queryAllByRole("button", { name: /Enter Fullscreen/ })
      ).not.toHaveLength(0);

      await act(async () => {
        setWindow(390, 844);
        window.dispatchEvent(new Event("resize"));
      });
      await flush();
      await screen.findByText("Phone view: 0");
      expect(
        screen.queryAllByRole("button", { name: /Enter Fullscreen/ })
      ).toHaveLength(0);
    });
  });

  describe("screen wake lock", () => {
    it("holds the lock while the run plays, releases it on pause and takes it again on Resume", async () => {
      const { request, sentinels } = installWakeLock();
      renderCabinet();
      await launch();
      await screen.findByRole("button", { name: "Add one" });
      await flush();
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith("screen");

      pressKey("p");
      await flush();
      expect(sentinels[0].release).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Resume" }));
      await flush();
      expect(request).toHaveBeenCalledTimes(2);
    });

    it("runs without the API", async () => {
      renderCabinet();
      await launch();
      expect(await screen.findByText("Desktop view: 0")).toBeTruthy();
    });

    it("asks again when the page comes back while still active", async () => {
      vi.useRealTimers();
      const { request, sentinels } = installWakeLock();
      const { rerender } = renderHook(
        ({ active }) => useScreenWakeLock(active),
        { initialProps: { active: true } }
      );
      await flush();
      expect(request).toHaveBeenCalledTimes(1);

      // The browser drops the lock while the page is hidden.
      sentinels[0].released = true;
      fireEvent(document, new Event("visibilitychange"));
      await flush();
      expect(request).toHaveBeenCalledTimes(2);

      rerender({ active: false });
      expect(sentinels[1].release).toHaveBeenCalledTimes(1);
    });

    it("survives a refused request", async () => {
      vi.useRealTimers();
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: { request: vi.fn(() => Promise.reject(new Error("denied"))) },
      });
      const { unmount } = renderHook(() => useScreenWakeLock(true));
      await flush();
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("hooks", () => {
    it("pauses with hidden when the canvas loses its WebGL context", () => {
      vi.useRealTimers();
      const controller = createPauseController();
      const canvas = document.createElement("canvas");
      renderHook(() => useContextLossPause(canvas), {
        wrapper: ({ children }) => (
          <CabinetPauseProvider controller={controller}>
            {children}
          </CabinetPauseProvider>
        ),
      });
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      expect([...controller.getState().reasons]).toEqual(["hidden"]);
    });

    it("useCabinetAutoPause names the reason and suspends after a hide", () => {
      vi.useRealTimers();
      const calls: string[] = [];
      renderHook(() =>
        useCabinetAutoPause((reason) => calls.push(reason), {
          pauseOnBlur: false,
          onSuspend: () => calls.push("suspend"),
        })
      );
      hidePage();
      fireEvent(window, new Event("pagehide"));
      fireEvent(window, new Event("blur"));
      fireEvent(window, new Event("beforeunload"));
      expect(calls).toEqual(["hidden", "suspend", "hidden", "suspend"]);
    });
  });
});
