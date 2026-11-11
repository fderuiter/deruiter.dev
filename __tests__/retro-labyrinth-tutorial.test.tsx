// @vitest-environment jsdom
//
// Retro Labyrinth's guided tutorial (#3459): while it runs, the session plays
// a practice Room 01 that nothing can hurt and that is never saved, hears
// the player's actions, opens the Market anywhere, and when it ends puts back
// the run the player had saved.
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
} from "@/components/arcade/pause";
import {
  CabinetTutorialContext,
  type CabinetTutorialValue,
} from "@/components/arcade/tutorial";
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
} from "@/lib/dungeon";
import {
  RETRO_LABYRINTH_TUTORIAL_SIGNALS,
  loadRun,
  saveRun,
  type RetroLabyrinthRunSave,
} from "@/lib/retro-labyrinth";
import { safeStorage } from "@/lib/safe-storage";

const S = RETRO_LABYRINTH_TUTORIAL_SIGNALS;
const LIBRARY = generateRoguelikeCampaign();

/** A save made on entering the third room of a route. */
function savedThirdRoom(): RetroLabyrinthRunSave {
  let route = startRunRoute(createRunSeed(3459));
  while (route.path.length < 3) {
    const [first] = drawRouteOptions(LIBRARY, route);
    route = chooseRouteRoom(LIBRARY, route, first);
  }
  return {
    version: 1,
    seed: route.seed,
    route: [...route.path],
    roomIndex: 2,
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
    runLength: routeRunLength(LIBRARY),
  };
}

/** The session under a tutorial whose `active` flag the test sets. */
function renderTutorial() {
  const signal = vi.fn();
  const controller = createPauseController();
  const tutorialFor = (active: boolean): CabinetTutorialValue => ({
    active,
    stepId: active ? "move" : null,
    signal,
  });
  let value = tutorialFor(false);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CabinetPauseProvider controller={controller}>
      <CabinetTutorialContext.Provider value={value}>
        <RetroLabyrinthSessionProvider>{children}</RetroLabyrinthSessionProvider>
      </CabinetTutorialContext.Provider>
    </CabinetPauseProvider>
  );
  const hook = renderHook(() => useOptionalLabyrinthSession()!.session, {
    wrapper,
  });
  return {
    signal,
    setActive(active: boolean) {
      value = tutorialFor(active);
      hook.rerender();
    },
    view: () => hook.result.current.view,
    intents: () => hook.result.current.intents,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  safeStorage.clearCache();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1)
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Retro Labyrinth tutorial session (#3459)", () => {
  it("practises in Room 01 and hears a move, a tool, an EMP and the Market", () => {
    const { signal, setActive, view, intents } = renderTutorial();
    setActive(true);
    expect(view().roomIndex).toBe(0);
    expect(view().gameStatus).toBe("playing");
    // Practice opens the Market anywhere, not only at the rest stop.
    expect(view().marketOpen).toBe(true);

    act(() => intents().move("right"));
    expect(signal).toHaveBeenCalledWith(S.move);
    act(() => intents().fireTool(0));
    expect(signal).toHaveBeenCalledWith(S.tool);
    act(() => intents().emp());
    expect(signal).toHaveBeenCalledWith(S.emp);
    act(() => intents().openOverlay("darknet_shop"));
    expect(signal).toHaveBeenCalledWith(S.market);
    expect(view().gameStatus).toBe("darknet_shop");

    // Closing the Market goes straight back to the room, not to a pause.
    act(() => intents().closeOverlay());
    expect(view().gameStatus).toBe("playing");
  });

  it("sends nothing while no tutorial runs", () => {
    const { signal, intents } = renderTutorial();
    act(() => intents().move("right"));
    expect(signal).not.toHaveBeenCalled();
  });

  it("keeps a saved run stored while practising, and resumes it after", () => {
    const save = savedThirdRoom();
    saveRun(save);
    const { setActive, view } = renderTutorial();

    setActive(true);
    expect(view().roomIndex).toBe(0);
    expect(loadRun()?.seed).toBe(save.seed);
    expect(loadRun()?.roomIndex).toBe(2);

    setActive(false);
    expect(view().roomIndex).toBe(2);
    expect(view().score).toBe(900);
    expect(loadRun()?.seed).toBe(save.seed);
  });
});
