// @vitest-environment jsdom
//
// Retro Labyrinth save and resume (#3466): the session saves each room as it
// was entered, a resume restarts the saved room from its start (a boss room
// at the boss's opening), and the save is cleared when it no longer applies.
// The session is driven with no view mounted, as in the seam tests.
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
import {
  chooseRouteRoom,
  createRunSeed,
  drawRouteOptions,
  generateRoguelikeCampaign,
  routeRunLength,
  startRunRoute,
  type RunRoute,
} from "@/lib/dungeon";
import {
  RUN_SAVE_KEY,
  loadRun,
  requestRunResume,
  type RetroLabyrinthRunSave,
} from "@/lib/retro-labyrinth";
import { safeStorage } from "@/lib/safe-storage";

function installFrames() {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1)
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
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
  return {
    controller,
    view: () => hook.result.current.view,
    intents: () => hook.result.current.intents,
  };
}

const LIBRARY = generateRoguelikeCampaign();
const RUN_LENGTH = routeRunLength(LIBRARY);

/** A route that has entered `rooms` rooms, the last being the current one. */
function routeOf(rooms: number): RunRoute {
  let route = startRunRoute(createRunSeed(3466));
  while (route.path.length < rooms) {
    const [first] = drawRouteOptions(LIBRARY, route);
    route = chooseRouteRoom(LIBRARY, route, first);
  }
  return route;
}

/** The save a fresh session writes for its opening room. */
function openingSave(): RetroLabyrinthRunSave {
  renderSession();
  const save = loadRun();
  if (!save) throw new Error("the opening room was not saved");
  cleanup();
  return save;
}

function savedAt(
  rooms: number,
  overrides: Partial<RetroLabyrinthRunSave> = {}
): RetroLabyrinthRunSave {
  const route = routeOf(rooms);
  return {
    ...openingSave(),
    seed: route.seed,
    route: [...route.path],
    roomIndex: rooms - 1,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  safeStorage.clearCache();
  installFrames();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Retro Labyrinth run save (#3466)", () => {
  it("saves the opening room of a run, with the run's length", () => {
    const session = renderSession();
    const save = loadRun();
    expect(save).not.toBeNull();
    expect(save!.roomIndex).toBe(0);
    expect(save!.route).toHaveLength(1);
    expect(save!.runLength).toBe(RUN_LENGTH);
    expect(save!.seed).toBe(session.view().route.seed);
    expect(save!.hp).toBe(session.view().playerHp);
  });

  it("saves the room entry again, with the time played, when the page hides", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    const session = renderSession();
    const entryHp = loadRun()!.hp;

    vi.setSystemTime(new Date("2026-10-30T12:01:30Z"));
    act(() => session.controller.suspend());

    const save = loadRun()!;
    expect(save.elapsedMs).toBeGreaterThanOrEqual(90_000);
    expect(save.hp).toBe(entryHp);
    expect(save.roomIndex).toBe(0);
  });
});

describe("Retro Labyrinth resume (#3466)", () => {
  it("restarts the saved room from its start with the saved HP, Crypto and score", () => {
    const save = savedAt(2, { hp: 4, crypto: 77, score: 1234 });
    requestRunResume(save);

    const session = renderSession();
    const view = session.view();

    expect(view.roomIndex).toBe(1);
    expect(view.gameStatus).toBe("playing");
    expect(view.playerHp).toBe(4);
    expect(view.cryptoBounty).toBe(77);
    expect(view.score).toBe(1234);
    expect(view.playerPosition).toEqual({
      x: view.currentRoom.startX,
      y: view.currentRoom.startY,
    });
    expect(view.route.seed).toBe(save.seed);
    // The resumed room is saved again as entered.
    expect(loadRun()).toMatchObject({ roomIndex: 1, hp: 4, crypto: 77 });
  });

  it("uses a resume request once", () => {
    requestRunResume(savedAt(2));
    renderSession();
    cleanup();
    window.localStorage.clear();
    safeStorage.clearCache();

    const fresh = renderSession();
    expect(fresh.view().roomIndex).toBe(0);
  });

  it("opens a saved boss room at the boss's opening, with no volley in flight", () => {
    requestRunResume(savedAt(RUN_LENGTH));
    const before = performance.now();
    const session = renderSession();
    const { boss, roomIndex } = session.view();

    expect(roomIndex).toBe(RUN_LENGTH - 1);
    expect(boss).toBeDefined();
    expect(boss!.hp).toBe(boss!.maxHp);
    expect(boss!.defeated).toBe(false);
    expect(boss!.projectiles).toEqual([]);
    expect(boss!.holdFireUntilMs ?? 0).toBeGreaterThan(before);
  });
});

describe("Retro Labyrinth save clearing (#3466)", () => {
  it("discards the saved run when a new run starts, and saves the new Room 01", () => {
    requestRunResume(savedAt(3));
    const session = renderSession();
    const resumedSeed = loadRun()!.seed;

    act(() => session.intents().newRun());

    const save = loadRun()!;
    expect(save.roomIndex).toBe(0);
    expect(save.seed).not.toBe(resumedSeed);
    expect(session.view().roomIndex).toBe(0);
  });

  it("drops a save of an unknown version when the session starts", () => {
    window.localStorage.setItem(
      RUN_SAVE_KEY,
      JSON.stringify({ version: 99, roomIndex: 4 })
    );
    const remove = vi.spyOn(Storage.prototype, "removeItem");

    renderSession();

    expect(remove).toHaveBeenCalledWith(RUN_SAVE_KEY);
    // The new run's opening room replaces it.
    expect(loadRun()).toMatchObject({ version: 1, roomIndex: 0 });
  });

  it("keeps a valid save untouched when the session starts without a resume", () => {
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    renderSession();
    expect(remove).not.toHaveBeenCalledWith(RUN_SAVE_KEY);
  });
});
