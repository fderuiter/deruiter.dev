// @vitest-environment jsdom
//
// Retro Labyrinth save and resume (#3466): the session saves each room after
// Room 01 as it was entered, a resume restarts the saved room from its start
// (a boss room at the boss's opening), and the save is cleared when a new run
// starts or the save can't be read.
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
  saveRun,
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

/** A save made on entering the last room of a route `rooms` long. */
function savedAt(
  rooms: number,
  overrides: Partial<RetroLabyrinthRunSave> = {}
): RetroLabyrinthRunSave {
  const route = routeOf(rooms);
  return {
    version: 1,
    seed: route.seed,
    route: [...route.path],
    roomIndex: rooms - 1,
    hp: 60,
    maxHp: 80,
    ram: 24,
    maxRam: 24,
    crypto: 40,
    ammo: { npm_install: 3 },
    loadout: { bonusWeapons: [], passives: [] },
    classId: "script_kiddie",
    activeWeaponId: "npm_install",
    firmware: {
      maxRamTier: 0,
      scanSpeedTier: 0,
      exploitRadiusTier: 0,
      startChipsTier: 0,
    },
    score: 900,
    elapsedMs: 10_000,
    runLength: RUN_LENGTH,
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
  it("saves nothing for Room 01, where every run starts", () => {
    const session = renderSession();
    expect(session.view().roomIndex).toBe(0);
    expect(loadRun()).toBeNull();
  });

  it("saves the room entry again, with the time played, when the page hides", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    requestRunResume(savedAt(2, { hp: 5 }));
    const session = renderSession();

    vi.setSystemTime(new Date("2026-10-30T12:01:30Z"));
    act(() => session.controller.suspend());

    const save = loadRun()!;
    expect(save.elapsedMs).toBeGreaterThanOrEqual(100_000);
    expect(save.hp).toBe(5);
    expect(save.roomIndex).toBe(1);
    expect(save.runLength).toBe(RUN_LENGTH);
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
  it("discards the saved run when a new run starts", () => {
    requestRunResume(savedAt(3));
    const session = renderSession();
    expect(loadRun()).not.toBeNull();

    act(() => session.intents().newRun());

    expect(loadRun()).toBeNull();
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
    expect(window.localStorage.getItem(RUN_SAVE_KEY)).toBeNull();
  });

  it("keeps a valid save untouched when the session starts without a resume", () => {
    const save = savedAt(3);
    saveRun(save);
    const remove = vi.spyOn(Storage.prototype, "removeItem");

    renderSession();

    expect(remove).not.toHaveBeenCalledWith(RUN_SAVE_KEY);
    expect(loadRun()?.seed).toBe(save.seed);
  });
});
