// @vitest-environment jsdom
//
// Retro Labyrinth's session seam (#2376): the session owns the run and its
// rules, and a view only reads `view` and calls `intents`. These tests drive
// the session with no view mounted.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playSuccess: () => {},
      playNote: () => {},
      playHover: () => {},
    }),
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: () => Promise.resolve(true) }),
}));

import {
  CabinetPauseProvider,
  createPauseController,
  type PauseController,
} from "@/components/arcade/pause";
import {
  RetroLabyrinthSessionProvider,
  useOptionalLabyrinthSession,
} from "@/components/retro-labyrinth/RetroLabyrinthSession";
import type { LabyrinthEvent } from "@/components/retro-labyrinth/useRetroLabyrinthSession";
import { findActionConflicts } from "@/lib/arcade";
import { RUN_LOADOUT_SLOTS } from "@/lib/dungeon";
import { LABYRINTH_ACTIONS, LABYRINTH_CONTROLS } from "@/lib/retro-labyrinth";
import { safeStorage } from "@/lib/safe-storage";

/** Animation frames, run by hand. */
function installFrames() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      pending.delete(id);
    })
  );
  return {
    pending: () => pending.size,
    tick(time: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(time);
      });
    },
  };
}

function renderSession(controller: PauseController = createPauseController()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CabinetPauseProvider controller={controller}>
      <RetroLabyrinthSessionProvider>{children}</RetroLabyrinthSessionProvider>
    </CabinetPauseProvider>
  );
  const hook = renderHook(() => useOptionalLabyrinthSession()!.session, {
    wrapper,
  });
  const events: LabyrinthEvent[] = [];
  const unsubscribe = hook.result.current.subscribe((event) =>
    events.push(event)
  );
  return {
    controller,
    events,
    unsubscribe,
    session: () => hook.result.current,
    view: () => hook.result.current.view,
    intents: () => hook.result.current.intents,
  };
}

let frames: ReturnType<typeof installFrames>;

beforeEach(() => {
  window.localStorage.clear();
  safeStorage.clearCache();
  frames = installFrames();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Retro Labyrinth session (#2376)", () => {
  it("starts a run in Room 01 at the start tile", () => {
    const { view } = renderSession();
    expect(view().gameStatus).toBe("playing");
    expect(view().gameMode).toBe("roguelike");
    expect(view().roomIndex).toBe(0);
    expect(view().playerPosition).toEqual({ x: 1, y: 1 });
  });

  it("moves the player one step per move intent", () => {
    const { view, intents } = renderSession();
    act(() => intents().move("right"));
    expect(view().playerPosition).toEqual({ x: 2, y: 1 });
    expect(view().movesCount).toBe(1);
    // A wall holds the player where they are.
    act(() => intents().move("up"));
    expect(view().playerPosition).toEqual({ x: 2, y: 1 });
  });

  it("pauses and resumes on P, and a paused room ignores moves", () => {
    const { view, intents } = renderSession();
    let handled = false;
    act(() => {
      handled = intents().togglePause();
    });
    expect(handled).toBe(true);
    expect(view().gameStatus).toBe("paused");

    act(() => intents().move("right"));
    expect(view().playerPosition).toEqual({ x: 1, y: 1 });

    act(() => {
      intents().togglePause();
    });
    expect(view().gameStatus).toBe("playing");
  });

  it("runs the loop only while a view paints the room", () => {
    const { session } = renderSession();
    expect(frames.pending()).toBe(0);
    let stop: () => void = () => {};
    act(() => {
      stop = session().onFrame(() => {});
    });
    expect(frames.pending()).toBe(1);
    act(() => stop());
    expect(frames.pending()).toBe(0);
  });

  it("stops the loop while the room is paused, and starts it again on resume", () => {
    const { intents, session } = renderSession();
    act(() => {
      session().onFrame(() => {});
    });
    frames.tick(0);
    expect(frames.pending()).toBe(1);

    act(() => intents().pause());
    expect(frames.pending()).toBe(0);

    act(() => intents().resume());
    expect(frames.pending()).toBe(1);
  });

  it("paints each frame to every painter until it unsubscribes", () => {
    const { session } = renderSession();
    const first = vi.fn();
    const second = vi.fn();
    let stopFirst: () => void = () => {};
    act(() => {
      stopFirst = session().onFrame(first);
      session().onFrame(second);
    });
    frames.tick(0);
    frames.tick(16);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    expect(first.mock.calls[1][0].state.playerPosition).toEqual({
      x: 1,
      y: 1,
    });

    stopFirst();
    frames.tick(32);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(3);
  });

  it("mirrors the cabinet's pause service both ways", () => {
    const { view, intents, controller } = renderSession();
    // A hidden tab pauses a running room.
    act(() => controller.pause("hidden"));
    expect(view().gameStatus).toBe("paused");
    // Resume on the cabinet resumes the room.
    act(() => controller.resume());
    expect(view().gameStatus).toBe("playing");
    // The room's own pause shows on the cabinet.
    act(() => intents().pause());
    expect(controller.getState().paused).toBe(true);
    act(() => intents().resume());
    expect(controller.getState().paused).toBe(false);
  });

  it("releases an automatic pause at once when no room is running", () => {
    const { view, intents, controller } = renderSession();
    act(() => intents().openOverlay("class_select"));
    expect(view().gameStatus).toBe("class_select");
    act(() => controller.pause("hidden"));
    expect(view().gameStatus).toBe("class_select");
    expect(controller.getState().paused).toBe(false);
  });

  it("says once what an empty tool slot did, as a tool result", () => {
    const { events, intents, view } = renderSession();
    // The Script Kiddie carries three tools, so slot 5 is empty.
    act(() => intents().fireTool(4));
    const results = events.filter((event) => event.type === "toolResult");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ tool: null, success: false });
    expect(view().gameStatus).toBe("playing");
  });

  it("names the tool it fired in its tool result", () => {
    const { events, intents } = renderSession();
    act(() => intents().fireTool(0));
    const results = events.filter((event) => event.type === "toolResult");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ tool: "npm_install" });
  });

  it("sends no more events after an unsubscribe", () => {
    const { events, intents, unsubscribe } = renderSession();
    unsubscribe();
    act(() => intents().fireTool(4));
    expect(events).toEqual([]);
  });

  it("opens and closes an overlay back to a paused room", () => {
    const { view, intents } = renderSession();
    act(() => intents().openOverlay("class_select"));
    expect(view().gameStatus).toBe("class_select");
    act(() => intents().closeOverlay());
    // A room that was running comes back paused (#1669).
    expect(view().gameStatus).toBe("paused");
  });

  it("toggles the scanlines with the CRT intent", () => {
    const { view, intents } = renderSession();
    const before = view().crtCalibration.scanlinesEnabled;
    act(() => intents().toggleCrt());
    expect(view().crtCalibration.scanlinesEnabled).toBe(!before);
  });

  it("answers Enter and R only on a card", () => {
    const { intents } = renderSession();
    let confirmed = true;
    let retried = true;
    act(() => {
      confirmed = intents().confirm();
      retried = intents().retryRoom();
    });
    expect(confirmed).toBe(false);
    expect(retried).toBe(false);
  });
});

describe("Retro Labyrinth action map (#2376)", () => {
  it("binds no key twice and leaves the cabinet its keys", () => {
    expect(findActionConflicts(LABYRINTH_ACTIONS)).toEqual([]);
  });

  it("binds one tool key per loadout slot", () => {
    const tools = LABYRINTH_ACTIONS.names.filter((name) =>
      name.startsWith("tool-")
    );
    expect(tools).toHaveLength(RUN_LOADOUT_SLOTS);
  });

  it("generates the cabinet's control list from the bindings", () => {
    expect(LABYRINTH_CONTROLS).toEqual([
      { key: "WASD / Arrows", action: "Move" },
      { key: "1-5", action: "Fire Class Tools" },
      { key: "Space", action: "EMP Burst" },
      { key: "M", action: "Market" },
      { key: "C", action: "CRT Scanlines" },
      { key: "P / Esc", action: "Pause" },
      { key: "Enter / R", action: "Continue / Retry" },
    ]);
  });
});
