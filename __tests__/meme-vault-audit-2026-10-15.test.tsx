// @vitest-environment jsdom
//
// The Meme Vault 10/10 audit of 2026-10-15: Echo's play area is in view and
// before the scope (#2124), a miss marks the pad the vault wanted (#2125),
// Echo streaks unlock arcade trophies and the hub shows the best (#2126),
// and the room is described as the Echo game it is (#2127).
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";

const audio = vi.hoisted(() => ({
  muted: false,
  bypassActive: false,
  setMuted: vi.fn(),
}));

const meme = vi.hoisted(() => ({
  playMemeSound: vi.fn(),
}));

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      muted: audio.muted,
      bypassActive: audio.bypassActive,
      setMuted: audio.setMuted,
      playHover: vi.fn(),
    }),
  };
});

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: meme.playMemeSound,
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => true,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
  unlockMemeAudio: vi.fn(),
}));

import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { MEME_STORAGE_KEYS, SOUNDBOARD_BUTTONS } from "@/lib/meme-data";
import { getArcadeProgress } from "@/lib/arcade-achievements";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";
import { safeRemoveItem, safeSetRawItem } from "@/lib/safe-storage";

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

function renderVault() {
  return render(
    <A11yProvider>
      <ToastProvider>
        <MemeVaultClient />
      </ToastProvider>
    </A11yProvider>
  );
}

const status = () => screen.getByTestId("meme-echo-status").textContent ?? "";

/** Runs timers until the player's turn, returning the pads the vault played. */
function watchPlayback(): number[] {
  meme.playMemeSound.mockClear();
  for (let i = 0; i < 200 && !status().startsWith("Your turn"); i++) {
    act(() => {
      vi.advanceTimersByTime(50);
    });
  }
  expect(status()).toMatch(/^Your turn/);
  return meme.playMemeSound.mock.calls.map(([type]) =>
    SOUNDBOARD_BUTTONS.findIndex((b) => b.synthType === type)
  );
}

function pressKey(index: number, target: Window | HTMLElement = window) {
  act(() => {
    fireEvent.keyDown(target, { key: String(index + 1) });
  });
}

/** Plays Echo correctly until the streak reaches `target`. */
function playTo(target: number) {
  for (let streak = 0; streak < target; streak++) {
    for (const pad of watchPlayback()) pressKey(pad);
  }
}

describe("Meme Vault audit 2026-10-15", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    audio.muted = false;
    audio.bypassActive = false;
    meme.playMemeSound.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("#2124 play area", () => {
    it("puts Echo and the pads before the oscilloscope", () => {
      renderVault();
      const echo = screen.getByTestId("meme-echo");
      const scope = screen.getByTestId("meme-oscilloscope");
      const pad = screen.getByRole("button", { name: /Puppy Woof/ });
      expect(
        echo.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        pad.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("scrolls the play area into view when Echo starts below the fold", () => {
      renderVault();
      const area = screen.getByTestId("meme-echo").parentElement as HTMLElement;
      vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
        top: 900,
        bottom: 1400,
        height: 500,
        left: 0,
        right: 800,
        width: 800,
        x: 0,
        y: 900,
        toJSON: () => ({}),
      });
      const scrollBy = vi.fn();
      vi.stubGlobal("scrollBy", scrollBy);
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
      fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy.mock.calls[0][0].top).toBeGreaterThan(0);
    });

    it("leaves the page alone when the play area is already in view", () => {
      renderVault();
      const area = screen.getByTestId("meme-echo").parentElement as HTMLElement;
      vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
        top: 120,
        bottom: 620,
        height: 500,
        left: 0,
        right: 800,
        width: 800,
        x: 0,
        y: 120,
        toJSON: () => ({}),
      });
      const scrollBy = vi.fn();
      vi.stubGlobal("scrollBy", scrollBy);
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
      fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
      expect(scrollBy).not.toHaveBeenCalled();
    });
  });

  describe("#2125 a miss shows the right pad", () => {
    it("marks the expected pad and names it, until Echo starts again", () => {
      renderVault();
      fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
      const [expected] = watchPlayback();
      pressKey((expected + 1) % 8);

      const pad = SOUNDBOARD_BUTTONS[expected];
      const marked = document.querySelectorAll('[data-missed="true"]');
      expect(marked).toHaveLength(1);
      expect(marked[0].textContent).toContain(pad.label);
      expect(status()).toContain(
        `The vault played ${expected + 1} · ${pad.label}`
      );

      fireEvent.click(screen.getByRole("button", { name: "Play Echo again" }));
      expect(document.querySelectorAll('[data-missed="true"]')).toHaveLength(0);
    });
  });

  describe("#2126 Echo in the arcade", () => {
    it("unlocks Echo Chamber at a streak of five", () => {
      renderVault();
      fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
      playTo(4);
      expect(
        getArcadeProgress().unlockedTrophies.meme_vault_echo_5
      ).toBeUndefined();
      playTo(1);
      expect(screen.getByTestId("meme-echo-streak").textContent).toBe("5");
      expect(
        getArcadeProgress().unlockedTrophies.meme_vault_echo_5
      ).toBeDefined();
      expect(
        getArcadeProgress().unlockedTrophies.meme_vault_echo_10
      ).toBeUndefined();
    });

    it("awards both Echo trophies for a stored best of ten", () => {
      safeSetRawItem(MEME_STORAGE_KEYS.ECHO_BEST, "10");
      renderVault();
      const unlocked = getArcadeProgress().unlockedTrophies;
      expect(unlocked.meme_vault_echo_5).toBeDefined();
      expect(unlocked.meme_vault_echo_10).toBeDefined();
    });

    it("shows the Echo best on the hub's vault card", () => {
      vi.useRealTimers();
      safeSetRawItem(MEME_STORAGE_KEYS.ECHO_BEST, "7");
      render(<ArcadeHubClient />);
      expect(screen.getByTestId("hub-meme-echo-best").textContent).toBe(
        "Echo best: 7"
      );
    });
  });

  describe("#2127 the room is described as Echo", () => {
    it("names Echo in the hero and arcade data, with no CRT claim", () => {
      renderVault();
      expect(
        screen.getByRole("heading", { level: 1 }).parentElement?.textContent
      ).toMatch(/Echo/);
      const vault = ARCADE_GAMES_METADATA.find((g) => g.id === "meme-vault");
      expect(vault?.mechanics.join(" ")).toMatch(/Echo/);
      expect(vault?.techStack.join(" ")).not.toMatch(/CRT/);
    });
  });
});
