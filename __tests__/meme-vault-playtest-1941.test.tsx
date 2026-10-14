// @vitest-environment jsdom
//
// Meme Vault playtest fixes (#1941): a reduced-motion visitor can opt into
// sound, a muted press says so and earns nothing, 6/6 has a payoff, and the
// React button keeps a real name.
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
  muted: true,
  bypassActive: false,
  bypassReason: null as "reduced-motion" | "contrast" | null,
  setMuted: vi.fn(),
  setReducedMotionOptIn: vi.fn(),
  allowed: false,
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
      bypassReason: audio.bypassReason,
      setMuted: audio.setMuted,
      setReducedMotionOptIn: audio.setReducedMotionOptIn,
    }),
  };
});

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: vi.fn(),
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => audio.allowed,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
  unlockMemeAudio: vi.fn(),
}));

import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { SoundEngine } from "@/lib/audio/sound-engine";
import {
  EASTER_EGG_ACHIEVEMENTS,
  getUnlockedAchievements,
  unlockAchievement,
} from "@/lib/meme-data";

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

function mockMedia(matching: string[]) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matching.some((m) => query.includes(m)),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe("SoundEngine reduced-motion opt-in (#1941)", () => {
  afterEach(() => mockMedia([]));

  it("lets a page opt into sound when reduced motion is the only bypass", () => {
    mockMedia(["prefers-reduced-motion"]);
    const engine = new SoundEngine({ initialMuted: false });
    expect(engine.getBypassReason()).toBe("reduced-motion");
    expect(engine.isSoundAllowed()).toBe(false);

    engine.setReducedMotionOptIn(true);
    expect(engine.isBypassActive()).toBe(false);
    expect(engine.isSoundAllowed()).toBe(true);

    engine.setReducedMotionOptIn(false);
    expect(engine.isSoundAllowed()).toBe(false);
  });

  it("keeps contrast modes silent even with the opt-in", () => {
    mockMedia(["prefers-reduced-motion", "forced-colors"]);
    const engine = new SoundEngine({ initialMuted: false });
    expect(engine.getBypassReason()).toBe("contrast");
    engine.setReducedMotionOptIn(true);
    expect(engine.isBypassActive()).toBe(true);
  });
});

describe("Meme Vault playtest fixes (#1941)", () => {
  function renderVault() {
    return render(
      <A11yProvider>
        <ToastProvider>
          <MemeVaultClient />
        </ToastProvider>
      </A11yProvider>
    );
  }

  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    audio.muted = true;
    audio.bypassActive = false;
    audio.bypassReason = null;
    audio.allowed = false;
    audio.setMuted.mockClear();
    audio.setReducedMotionOptIn.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("says a muted press was silent and keeps Soundboard Maestro locked", () => {
    renderVault();
    fireEvent.click(screen.getAllByRole("button", { name: /^Play / })[0]);
    expect(getUnlockedAchievements()).not.toContain("soundboard-maestro");
    expect(screen.getByTestId("meme-silent-press").textContent).toContain(
      "That pad played silently"
    );
  });

  it("offers Play sound anyway under reduced motion and clears it on unmount", () => {
    audio.bypassActive = true;
    audio.bypassReason = "reduced-motion";
    const { unmount } = renderVault();

    const optIn = screen.getAllByRole("button", {
      name: "Play sound anyway",
    })[0];
    fireEvent.click(optIn);
    expect(audio.setReducedMotionOptIn).toHaveBeenCalledWith(true);
    expect(audio.setMuted).toHaveBeenCalledWith(false);

    unmount();
    expect(audio.setReducedMotionOptIn).toHaveBeenLastCalledWith(false);
  });

  it("does not offer the opt-in for high contrast", () => {
    audio.bypassActive = true;
    audio.bypassReason = "contrast";
    renderVault();
    expect(screen.queryByRole("button", { name: "Play sound anyway" })).toBe(
      null
    );
    expect(document.body.textContent).toContain(
      "Sound is off while high contrast is on."
    );
  });

  it("names the React button after a reaction", () => {
    renderVault();
    const react = screen.getAllByRole("button", { name: "React to quote" })[0];
    fireEvent.click(react);
    expect(react.getAttribute("aria-label")).toBe("React to quote (1)");
  });

  it("marks the vault cleared when every trophy is found", () => {
    audio.allowed = true;
    renderVault();
    expect(screen.queryByTestId("meme-vault-cleared")).toBeNull();
    act(() => {
      for (const a of EASTER_EGG_ACHIEVEMENTS) unlockAchievement(a.id);
    });
    expect(screen.getByTestId("meme-vault-cleared").textContent).toBe(
      "Vault cleared"
    );
    expect(document.body.textContent).toContain("All 6 trophies found");
  });
});
