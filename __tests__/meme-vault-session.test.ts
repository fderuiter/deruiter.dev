// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

const meme = vi.hoisted(() => ({
  playMemeSound: vi.fn(),
  stopAllMemeSounds: vi.fn(),
  unlockMemeAudio: vi.fn(),
}));

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: meme.playMemeSound,
  stopAllMemeSounds: meme.stopAllMemeSounds,
  unlockMemeAudio: meme.unlockMemeAudio,
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => true,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
}));

import {
  useMemeVaultSession,
  vaultEvents,
  type MemeVaultEvent,
  type VaultMoment,
} from "@/components/arcade/meme-vault/useMemeVaultSession";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { emitAppEvent, onAppEvent } from "@/lib/event-bus";
import {
  SOUNDBOARD_BUTTONS,
  getUnlockedAchievements,
  unlockAchievement,
} from "@/lib/meme-data";
import { safeClear } from "@/lib/safe-storage";

/**
 * The Meme Vault session hook on its own (#3432): each intent, the named
 * events, and the Konami trophy, which only typing the code awards (#1328).
 * The site-wide Konami listener lives in RetroChaosOverlay; the vault's
 * Retro Chaos button is a shortcut to the show that earns nothing.
 */

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    A11yProvider,
    null,
    React.createElement(ToastProvider, null, children)
  );
}

function renderSession() {
  const events: MemeVaultEvent[] = [];
  const hook = renderHook(
    () => useMemeVaultSession({ onEvent: (event) => events.push(event) }),
    { wrapper }
  );
  return { ...hook, events };
}

type Session = ReturnType<typeof renderSession>["result"];

/** Runs Echo's timers until the player's turn. */
function untilTurn(result: Session) {
  for (
    let i = 0;
    i < 200 && result.current.echo.round?.phase !== "input";
    i++
  ) {
    act(() => {
      vi.advanceTimersByTime(50);
    });
  }
  expect(result.current.echo.round?.phase).toBe("input");
}

beforeEach(() => {
  safeClear();
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useMemeVaultSession intents", () => {
  it("pressPad plays a sample, lights its pad and earns the sampler trophy", () => {
    const { result, events } = renderSession();
    act(() => result.current.pressPad(2));

    const pad = SOUNDBOARD_BUTTONS[2];
    expect(meme.unlockMemeAudio).toHaveBeenCalled();
    expect(meme.playMemeSound).toHaveBeenCalledWith(pad.synthType);
    expect(result.current.activeSound).toBe(pad.id);
    expect(events).toContainEqual({ type: "padLit", padId: pad.id });
    expect(events).toContainEqual({ type: "trophy", id: "soundboard-maestro" });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.activeSound).toBeNull();
  });

  it("startEcho plays a sequence, then hands the player the turn", () => {
    const { result, events } = renderSession();
    act(() => result.current.startEcho());

    expect(meme.unlockMemeAudio).toHaveBeenCalled();
    expect(result.current.echo.round?.phase).toBe("showing");
    expect(events).toContainEqual({ type: "echoWatch", length: 1 });
    untilTurn(result);
    expect(events).toContainEqual({ type: "echoTurn", length: 1 });
  });

  it("a right pad on Echo's turn plays the next, longer sequence", () => {
    const { result, events } = renderSession();
    act(() => result.current.startEcho());
    untilTurn(result);
    const expected = result.current.echo.round?.sequence[0] ?? 0;

    act(() => result.current.pressPad(expected));
    expect(events).toContainEqual({ type: "echoWatch", length: 2 });
  });

  it("a wrong pad on Echo's turn is a miss that names the expected pad", () => {
    const { result, events } = renderSession();
    act(() => result.current.startEcho());
    untilTurn(result);
    const expected = result.current.echo.round?.sequence[0] ?? 0;
    const wrong = (expected + 1) % SOUNDBOARD_BUTTONS.length;

    act(() => result.current.pressPad(wrong));
    expect(result.current.echo.round?.phase).toBe("over");
    expect(events).toContainEqual({
      type: "echoMiss",
      expected: SOUNDBOARD_BUTTONS[expected].id,
    });
  });

  it("stopEcho ends Echo", () => {
    const { result } = renderSession();
    act(() => result.current.startEcho());
    act(() => result.current.stopEcho());
    expect(result.current.echo.round).toBeNull();
  });

  it("stopAll ends Echo and every sound, and puts out the lit pad", () => {
    const { result } = renderSession();
    act(() => result.current.pressPad(0));
    act(() => result.current.startEcho());
    act(() => result.current.stopAll());

    expect(result.current.echo.round).toBeNull();
    expect(result.current.activeSound).toBeNull();
    expect(meme.stopAllMemeSounds).toHaveBeenCalled();
  });

  it("allowSound wakes suspended audio, as a gesture does", () => {
    const { result } = renderSession();
    act(() => result.current.allowSound());
    expect(meme.unlockMemeAudio).toHaveBeenCalledTimes(1);
  });
});

describe("useMemeVaultSession Konami sequence (#1328)", () => {
  it("the Retro Chaos shortcut starts the show but awards no trophy", () => {
    const { result, events } = renderSession();
    const chaos = vi.fn();
    const off = onAppEvent("trigger_retro_chaos", chaos);

    act(() => result.current.triggerChaosMode());

    off();
    expect(chaos).toHaveBeenCalledTimes(1);
    expect(meme.playMemeSound).toHaveBeenCalledWith("fanfare");
    expect(getUnlockedAchievements()).not.toContain("konami-hero");
    expect(events.some((e) => e.type === "trophy")).toBe(false);
  });

  it("names the Konami trophy when typing the code unlocks it elsewhere", () => {
    const { result, events } = renderSession();
    act(() => {
      unlockAchievement("konami-hero");
    });

    expect(events).toContainEqual({ type: "trophy", id: "konami-hero" });
    expect(result.current.unlockedIds).toContain("konami-hero");
    expect(result.current.stampId).toBe("konami-hero");
  });

  it("ignores an unknown trophy id", () => {
    const { events } = renderSession();
    act(() => {
      emitAppEvent("meme_achievement_unlocked", { id: "not-a-trophy" });
    });
    expect(events).toEqual([]);
  });
});

describe("vaultEvents", () => {
  const quiet: VaultMoment = {
    litId: null,
    phase: null,
    length: 0,
    missedId: null,
  };

  it("emits nothing for the first moment or an unchanged one", () => {
    expect(vaultEvents(null, { ...quiet, litId: "a" })).toEqual([]);
    expect(vaultEvents(quiet, quiet)).toEqual([]);
  });

  it("emits a lit pad once, not again while it stays lit", () => {
    const lit = { ...quiet, litId: "a" };
    expect(vaultEvents(quiet, lit)).toEqual([{ type: "padLit", padId: "a" }]);
    expect(vaultEvents(lit, lit)).toEqual([]);
  });
});
