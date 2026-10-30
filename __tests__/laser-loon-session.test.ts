import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLaserLoonSession } from "@/components/laser-loon/useLaserLoonSession";
import { LOON_MAX_HITS } from "@/lib/laser-loon";

/**
 * The Laser Loon session hook on its own (#3436): advancing through acts and
 * resetting the run, without rendering the cabinet.
 */

afterEach(cleanup);

/** A desktop cabinet: no touch, no reduced motion. */
const DESKTOP = {
  touch: false,
  touchHint: false,
  prefersReducedMotion: false,
  initialScreenShake: true,
};

describe("useLaserLoonSession", () => {
  it("starts an act at full health, then advances to the next act's intro", () => {
    const { result } = renderHook(() => useLaserLoonSession(DESKTOP));

    act(() => result.current.startAct(1));
    expect(result.current.currentActNum).toBe(1);
    expect(result.current.gameState).toBe("playing");
    expect(result.current.hitsLeft).toBe(LOON_MAX_HITS);
    expect(result.current.actKills).toBe(0);
    expect(result.current.isPaused).toBe(false);

    act(() => result.current.advanceToNextAct());
    expect(result.current.currentActNum).toBe(2);
    expect(result.current.gameState).toBe("act-intro");
    expect(result.current.actKills).toBe(0);
    expect(result.current.currentAct).toBeDefined();
  });

  it("starts the next act where the intro left off", () => {
    const { result } = renderHook(() => useLaserLoonSession(DESKTOP));
    act(() => result.current.startAct(1));
    act(() => result.current.advanceToNextAct());
    act(() => result.current.startAct(result.current.currentActNum));
    expect(result.current.currentActNum).toBe(2);
    expect(result.current.gameState).toBe("playing");
  });

  it("resets the run to idle with a clean score and no boss", () => {
    const { result } = renderHook(() => useLaserLoonSession(DESKTOP));
    act(() => result.current.startGame());
    act(() => result.current.resetGame());

    expect(result.current.gameState).toBe("idle");
    expect(result.current.score).toBe(0);
    expect(result.current.combo).toBe(0);
    expect(result.current.maxCombo).toBe(0);
    expect(result.current.multiplier).toBe(1);
    expect(result.current.ultimateMeter).toBe(0);
    expect(result.current.bossActive).toBe(false);
    expect(result.current.activePowerUpType).toBeNull();
    expect(result.current.isPaused).toBe(false);
  });

  it("keeps the campaign as the default mode across a reset", () => {
    const { result } = renderHook(() => useLaserLoonSession(DESKTOP));
    expect(result.current.mode).toBe("campaign");
    act(() => result.current.resetGame());
    expect(result.current.mode).toBe("campaign");
  });
});
