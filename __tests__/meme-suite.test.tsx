// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Configure React 19 act environment
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MEME_QUOTES,
  SOUNDBOARD_BUTTONS,
  EASTER_EGG_ACHIEVEMENTS,
  STATUS_TICKER_ITEMS,
  FORTUNES,
  ASCII_COWSAY,
  ASCII_DUCK,
  ASCII_LASER_LOON,
  ASCII_TRAIN,
  getUnlockedAchievements,
  unlockAchievement,
  isVaultUnlocked,
  setVaultUnlocked,
} from "@/lib/meme-data";
import {
  playMemeSound,
  isSoundAllowed,
  getMemeSoundDuration,
  type MemeSoundType,
} from "@/lib/meme-audio";
import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { FooterStatusTicker } from "@/components/FooterStatusTicker";
import { RetroChaosOverlay } from "@/components/RetroChaosOverlay";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { AudioProvider } from "@/components/providers/AudioProvider";

describe("Meme Data & ASCII Generator Invariants", () => {
  it("should have populated meme quotes across all 4 categories", () => {
    expect(MEME_QUOTES.length).toBeGreaterThanOrEqual(8);
    const categories = new Set(MEME_QUOTES.map((q) => q.category));
    expect(categories.has("dev")).toBe(true);
    expect(categories.has("medtech")).toBe(true);
    expect(categories.has("lore")).toBe(true);
    expect(categories.has("classic")).toBe(true);

    expect(STATUS_TICKER_ITEMS.length).toBeGreaterThanOrEqual(5);
    expect(FORTUNES.length).toBeGreaterThanOrEqual(5);
    expect(typeof isSoundAllowed()).toBe("boolean");
  });

  it("should define 8 soundboard buttons with valid synth types", () => {
    expect(SOUNDBOARD_BUTTONS.length).toBe(8);
    SOUNDBOARD_BUTTONS.forEach((btn) => {
      expect(btn.id).toBeTruthy();
      expect(btn.label).toBeTruthy();
      expect(btn.emoji).toBeTruthy();
      expect(btn.synthType).toBeTruthy();
    });
  });

  it("should define at least 6 collectible easter egg achievements", () => {
    expect(EASTER_EGG_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(6);
    EASTER_EGG_ACHIEVEMENTS.forEach((ach) => {
      expect(ach.id).toBeTruthy();
      expect(ach.title).toBeTruthy();
      expect(ach.description).toBeTruthy();
      expect(ach.hint).toBeTruthy();
    });
  });

  it("should format ASCII art correctly", () => {
    const cowsay = ASCII_COWSAY("Test Message");
    expect(cowsay).toContain("Test Message");
    expect(cowsay).toContain("(oo)\\_______");

    const duck = ASCII_DUCK();
    expect(duck).toContain(' __/_  `.  .-"""-.');
    expect(duck).toContain("___Y");
    expect(duck).toContain("(_,___/...-` (_/_/");

    const loon = ASCII_LASER_LOON();
    expect(loon).toContain("L A K E   M I N N E T O N K A");
    expect(loon).toContain("Purify yourself in the waters");
    expect(loon).toContain("P E W !");
    expect(loon).toContain("*ZAP!*");

    const train = ASCII_TRAIN();
    expect(train).toContain("DEV  EXPRESS");
  });
});

describe("Meme Storage & Achievement Tracking", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
      get length() {
        return storage.size;
      },
    });
  });

  it("should manage achievement unlocking without duplicates", () => {
    expect(getUnlockedAchievements()).toEqual([]);

    const unlocked = unlockAchievement("konami-hero");
    expect(unlocked).toBe(true);
    expect(getUnlockedAchievements()).toContain("konami-hero");

    const duplicateUnlock = unlockAchievement("konami-hero");
    expect(duplicateUnlock).toBe(false);
    expect(getUnlockedAchievements().length).toBe(1);
  });

  it("should manage meme vault unlock state", () => {
    expect(isVaultUnlocked()).toBe(false);
    setVaultUnlocked(true);
    expect(isVaultUnlocked()).toBe(true);
    setVaultUnlocked(false);
    expect(isVaultUnlocked()).toBe(false);
  });
});

describe("Meme Web Audio Synthesizer", () => {
  beforeEach(() => {
    const mockOscillator = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockBiquadFilter = {
      type: "bandpass",
      frequency: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      Q: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockBufferSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockAudioBuffer = {
      getChannelData: vi.fn(() => new Float32Array(4410)),
    };

    const mockAudioContext = vi.fn().mockImplementation(function (
      this: Record<string, unknown>
    ) {
      this.state = "running";
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = {};
      this.createOscillator = vi.fn(() => mockOscillator);
      this.createGain = vi.fn(() => mockGain);
      this.createBiquadFilter = vi.fn(() => mockBiquadFilter);
      this.createBufferSource = vi.fn(() => mockBufferSource);
      this.createBuffer = vi.fn(() => mockAudioBuffer);
      this.resume = vi.fn().mockResolvedValue(undefined);
      this.close = vi.fn().mockResolvedValue(undefined);
    });

    vi.stubGlobal("AudioContext", mockAudioContext);
  });

  it("should synthesize all sound effects without throwing", () => {
    const soundTypes: MemeSoundType[] = [
      "bark",
      "laser",
      "friday-alarm",
      "matrix-glitch",
      "teapot-whistle",
      "modem",
      "fda-siren",
      "level-up",
      "fanfare",
    ];

    soundTypes.forEach((type) => {
      expect(() => playMemeSound(type)).not.toThrow();
    });
  });

  it("should provide exact positive durations for all soundboard types", () => {
    const soundTypes: MemeSoundType[] = [
      "bark",
      "laser",
      "friday-alarm",
      "matrix-glitch",
      "teapot-whistle",
      "modem",
      "fda-siren",
      "level-up",
      "fanfare",
    ];

    soundTypes.forEach((type) => {
      const duration = getMemeSoundDuration(type);
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe("number");
    });

    expect(getMemeSoundDuration("modem")).toBe(1250);
    expect(getMemeSoundDuration("teapot-whistle")).toBe(850);
    expect(getMemeSoundDuration("bark")).toBe(450);
  });
});

describe("Meme UI Components Rendering", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
      get length() {
        return storage.size;
      },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("should render FooterStatusTicker with clickable Duck mascot", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <A11yProvider>
          <AudioProvider>
            <FooterStatusTicker />
          </AudioProvider>
        </A11yProvider>
      );
    });

    expect(container.textContent).toContain("Footnotes:");
    const petButton = container.querySelector(
      "button[aria-label='Pet Duck the puppy']"
    );
    expect(petButton).toBeTruthy();

    if (petButton) {
      act(() => {
        (petButton as HTMLButtonElement).click();
      });
      expect(getUnlockedAchievements()).toContain("duck-whisperer");
    }
  });

  it("should render MemeVaultClient and trigger soundboard interactions", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <A11yProvider>
          <AudioProvider>
            <MemeVaultClient />
          </AudioProvider>
        </A11yProvider>
      );
    });

    expect(container.textContent).toContain(
      "Developer Soundboard & Meme Vault"
    );
    expect(container.textContent).toContain("8-Channel Retro Soundboard");
    expect(container.textContent).toContain("Easter Egg Trophy Case");
    expect(container.textContent).toContain("Web Audio Synthesis Engine");

    const soundButtons = container.querySelectorAll(
      "button[aria-label^='Play ']"
    );
    expect(soundButtons.length).toBe(8);

    act(() => {
      (soundButtons[0] as HTMLButtonElement).click();
    });

    expect(getUnlockedAchievements()).toContain("soundboard-maestro");

    // Launch chaos button
    const chaosBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Launch Retro Chaos Mode")
    );
    expect(chaosBtn).toBeTruthy();
    if (chaosBtn) {
      act(() => {
        chaosBtn.click();
      });
      // The button is a shortcut; only the typed code earns the trophy (#1328).
      expect(getUnlockedAchievements()).not.toContain("konami-hero");
    }
  });

  it("should render RetroChaosOverlay on demand", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <A11yProvider>
          <AudioProvider>
            <RetroChaosOverlay />
          </AudioProvider>
        </A11yProvider>
      );
    });

    // Initially closed
    expect(container.querySelector("[role='dialog']")).toBeNull();

    // Trigger event
    act(() => {
      window.dispatchEvent(new CustomEvent("trigger_retro_chaos"));
    });

    expect(container.querySelector("[role='dialog']")).toBeTruthy();
    expect(container.textContent).toContain("Retro Chaos Mode On");
  });
});
