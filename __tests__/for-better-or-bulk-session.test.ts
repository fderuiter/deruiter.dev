// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useForBetterOrBulkSession } from "@/components/for-better-or-bulk/useForBetterOrBulkSession";
import { FBB_AUTO_PAUSE_EVENT } from "@/components/for-better-or-bulk/auto-pause";
import {
  DEFAULT_SETUP,
  TICK_SECONDS,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { safeClear } from "@/lib/safe-storage";

/**
 * The For Better or Bulk session hook on its own (#3440): one frame for two
 * players, built from both players' keys, and the pause when the tab hides,
 * without the venue canvas.
 */

const TICK_MS = TICK_SECONDS * 1000;
const SETUP: Setup = { ...DEFAULT_SETUP, seed: 7 };

function renderSession() {
  const boundaryRef = { current: null };
  return renderHook(() =>
    useForBetterOrBulkSession({
      initialSetup: SETUP,
      initialMode: "solo",
      loud: false,
      touch: false,
      boundaryRef,
    })
  );
}

type Session = ReturnType<typeof renderSession>["result"];

function startDay(result: Session, mode: "solo" | "coop") {
  act(() => result.current.start(SETUP, mode));
  expect(result.current.phase).toBe("playing");
  expect(result.current.mode).toBe(mode);
}

function positions(result: Session) {
  const players = result.current.stateRef.current?.players;
  if (!players) throw new Error("no day in progress");
  return { fred: players.fred.x, abbi: players.abbi.x };
}

beforeEach(() => safeClear());
afterEach(() => cleanup());

describe("useForBetterOrBulkSession frames", () => {
  it("moves both players in one co-op frame, each from their own keys", () => {
    const { result } = renderSession();
    startDay(result, "coop");
    const before = positions(result);

    // Fred walks right on D, Abbi left on the left arrow, in the same frame.
    act(() => {
      result.current.touchKey("KeyD", true);
      result.current.touchKey("ArrowLeft", true);
    });
    let draw = false;
    act(() => {
      draw = result.current.advanceFrame(TICK_MS);
    });

    expect(draw).toBe(true);
    const after = positions(result);
    expect(after.fred).toBeGreaterThan(before.fred);
    expect(after.abbi).toBeLessThan(before.abbi);
    expect(result.current.view?.tick).toBe(1);
  });

  it("moves only the active player in a solo frame", () => {
    const { result } = renderSession();
    startDay(result, "solo");
    const before = positions(result);
    act(() => result.current.touchKey("KeyD", true));
    act(() => {
      result.current.advanceFrame(TICK_MS);
    });

    expect(result.current.active).toBe("abbi");
    const after = positions(result);
    expect(after.abbi).toBeGreaterThan(before.abbi);
    expect(after.fred).toBe(before.fred);
  });

  it("runs whole ticks only, carrying the rest to the next frame", () => {
    const { result } = renderSession();
    startDay(result, "coop");
    act(() => {
      result.current.advanceFrame(TICK_MS / 2);
    });
    expect(result.current.stateRef.current?.tick).toBe(0);
    act(() => {
      result.current.advanceFrame(TICK_MS / 2 + 0.001);
    });
    expect(result.current.stateRef.current?.tick).toBe(1);
  });

  it("draws nothing before a day starts", () => {
    const { result } = renderSession();
    let draw = true;
    act(() => {
      draw = result.current.advanceFrame(TICK_MS);
    });
    expect(draw).toBe(false);
  });
});

describe("useForBetterOrBulkSession pause on hide", () => {
  it("pauses a day in progress when the tab hides, and says so", () => {
    const { result } = renderSession();
    startDay(result, "coop");
    act(() => result.current.touchKey("KeyD", true));

    act(() => {
      window.dispatchEvent(new Event(FBB_AUTO_PAUSE_EVENT));
    });

    expect(result.current.userPaused).toBe(true);
    expect(result.current.paused).toBe(true);
    expect(result.current.announcement).toBe(
      "Paused. Choose Resume to continue."
    );
    // Keys held when the clock stopped are let go.
    expect(result.current.held.current.size).toBe(0);
  });

  it("ignores the hide event on the setup screen", () => {
    const { result } = renderSession();
    act(() => {
      window.dispatchEvent(new Event(FBB_AUTO_PAUSE_EVENT));
    });
    expect(result.current.userPaused).toBe(false);
  });
});
