import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { renderHook } from "@testing-library/react";
import { gameSoundFrequencies, type GameSoundName } from "@/lib/game-audio";
import {
  RetroAudioEngine,
  retroAudio,
  useRetroAudioCleanup,
} from "@/lib/dungeon/audio";
import {
  playSyntheticTone,
  playValidationSound,
  playChoiceIncorrectSound,
  playSignatureVerifiedSound,
  playAuditErrorBuzz,
  playAmendmentSirenSound,
  playForm483AlarmSound,
  playPowerUpSound,
  playPneumaticChuteSound,
  startProceduralBGM,
  updateBGMTempo,
  stopProceduralBGM,
  useClinicalAudioCleanup,
  useProceduralBGM,
} from "@/lib/clinical-trial-chaos/sound-effects";
import { getSoundEngine } from "@/lib/audio/sound-engine";

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

interface MockOscillator {
  type: OscillatorType;
  frequency: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

interface MockGain {
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

describe("Game Audio & SoundEngine Core Integration (__tests__/game-audio.test.ts)", () => {
  let mockStorage: MockStorage;
  let createdOscillators: MockOscillator[];
  let createdGains: MockGain[];
  let mockAudioContext: {
    state: AudioContextState;
    currentTime: number;
    sampleRate: number;
    destination: Record<string, unknown>;
    resume: ReturnType<typeof vi.fn>;
    suspend: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    createOscillator: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
  };

  const createMockOscillator = (): MockOscillator => {
    const osc: MockOscillator = {
      type: "sine",
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    createdOscillators.push(osc);
    return osc;
  };

  const createMockGain = (): MockGain => {
    const gain: MockGain = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    createdGains.push(gain);
    return gain;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockStorage();
    createdOscillators = [];
    createdGains = [];

    mockStorage.setItem("sound_muted", "false");
    mockStorage.setItem("sound_volume", "0.5");

    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    mockAudioContext = {
      state: "running",
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      suspend: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockImplementation(createMockOscillator),
      createGain: vi.fn().mockImplementation(createMockGain),
    };

    const MockAudioContextConstructor = vi.fn().mockImplementation(function (
      this: Record<string, unknown>
    ) {
      Object.assign(this, mockAudioContext);
      return mockAudioContext;
    });

    vi.stubGlobal("AudioContext", MockAudioContextConstructor);
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "AudioContext", {
        value: MockAudioContextConstructor,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    // Reset SoundEngine singleton state for isolation
    const soundEngine = getSoundEngine();
    soundEngine.setMuted(false);
    soundEngine.setVolume(0.5);
    retroAudio.setMuted(false);
  });

  afterEach(() => {
    stopProceduralBGM();
    retroAudio.stopAll();
    retroAudio.setMuted(false);
    getSoundEngine().stopAll();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockStorage.clear();
  });

  describe("1. Architectural Invariants & Import Hygiene", () => {
    it("should export correct frequencies for all standard game sound cues", () => {
      const expectedKeys: GameSoundName[] = [
        "action",
        "warning",
        "success",
        "failure",
      ];
      expectedKeys.forEach((key) => {
        expect(gameSoundFrequencies[key]).toBeGreaterThan(0);
        expect(typeof gameSoundFrequencies[key]).toBe("number");
      });
      expect(gameSoundFrequencies.action).toBe(659.25);
      expect(gameSoundFrequencies.warning).toBe(293.66);
      expect(gameSoundFrequencies.success).toBe(880);
      expect(gameSoundFrequencies.failure).toBe(196);
    });

    it("verifies lib/dungeon/audio.ts does NOT import from @/components/providers/AudioProvider", () => {
      const filePath = path.resolve(process.cwd(), "lib/dungeon/audio.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toContain("@/components/providers/AudioProvider");
      expect(content).not.toContain("AudioProvider");
    });

    it("verifies lib/clinical-trial-chaos/sound-effects.ts does NOT import from @/components/providers/AudioProvider", () => {
      const filePath = path.resolve(
        process.cwd(),
        "lib/clinical-trial-chaos/sound-effects.ts"
      );
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toContain("@/components/providers/AudioProvider");
      expect(content).not.toContain("AudioProvider");
    });
  });

  describe("2. RetroAudioEngine (lib/dungeon/audio)", () => {
    it("instantiates RetroAudioEngine and exposes retroAudio singleton", () => {
      expect(retroAudio).toBeInstanceOf(RetroAudioEngine);
      expect(retroAudio.getMuted()).toBe(false);
    });

    it("plays individual tones through SoundEngine", () => {
      retroAudio.playTone(440, 100, "square", 0.1);
      expect(createdOscillators.length).toBe(1);
      expect(createdOscillators[0].type).toBe("square");
      expect(
        createdOscillators[0].frequency.setValueAtTime
      ).toHaveBeenCalledWith(440, expect.any(Number));
    });

    it("synthesizes step, port scan, and exploit blast SFX", () => {
      retroAudio.playStep();
      expect(createdOscillators.length).toBe(1);

      retroAudio.playPortScan();
      expect(createdOscillators.length).toBe(2);

      retroAudio.playExploitBlast();
      expect(createdOscillators.length).toBe(3);
    });

    it("synthesizes arpeggiated SFX: critical hit, hack success, alert pulse, and pickup chime", () => {
      retroAudio.playCriticalHit();
      retroAudio.playAlertPulse();
      retroAudio.playPickup();
      retroAudio.playHackSuccess();

      // Fast-forward scheduled timeouts for arpeggios
      vi.advanceTimersByTime(500);

      expect(createdOscillators.length).toBeGreaterThanOrEqual(10);
    });

    it("manages local muted state and stops all audio when muted", () => {
      retroAudio.playTone(440, 200);
      expect(createdOscillators.length).toBe(1);

      retroAudio.setMuted(true);
      expect(retroAudio.getMuted()).toBe(true);
      expect(createdOscillators[0].stop).toHaveBeenCalled();
      expect(createdOscillators[0].disconnect).toHaveBeenCalled();

      // Subsequent sounds suppressed
      retroAudio.playTone(880, 200);
      expect(createdOscillators.length).toBe(1);
    });

    it("stops all active sources when retroAudio.stopAll() is called", () => {
      retroAudio.playTone(440, 500);
      retroAudio.playTone(550, 500);
      expect(createdOscillators.length).toBe(2);

      retroAudio.stopAll();
      createdOscillators.forEach((osc) => {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      });
    });

    it("cleans up active retro audio on hook unmount via useRetroAudioCleanup", () => {
      const stopAllSpy = vi.spyOn(retroAudio, "stopAll");
      const { unmount } = renderHook(() => useRetroAudioCleanup());

      expect(stopAllSpy).not.toHaveBeenCalled();
      unmount();
      expect(stopAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Clinical Trial Chaos Sound Effects (lib/clinical-trial-chaos/sound-effects)", () => {
    it("plays individual synthetic tones with default parameters", () => {
      playSyntheticTone(523.25, 0.1, "triangle", 0.2);
      expect(createdOscillators.length).toBe(1);
      expect(createdOscillators[0].type).toBe("triangle");
    });

    it("triggers validation, choice incorrect, signature verified, and audit buzz sounds", () => {
      playValidationSound();
      playChoiceIncorrectSound();
      playSignatureVerifiedSound();
      playAuditErrorBuzz();

      vi.advanceTimersByTime(300);
      expect(createdOscillators.length).toBeGreaterThanOrEqual(7);
    });

    it("triggers amendment siren, form 483 alarm, power up, and pneumatic chute sounds", () => {
      playAmendmentSirenSound();
      playForm483AlarmSound();
      playPowerUpSound();
      playPneumaticChuteSound();

      vi.advanceTimersByTime(500);
      expect(createdOscillators.length).toBeGreaterThanOrEqual(10);
    });

    it("runs procedural BGM loop with tempo adjustment based on suspicion", () => {
      startProceduralBGM(200);
      expect(createdOscillators.length).toBeGreaterThanOrEqual(1);

      // Advance one beat
      vi.advanceTimersByTime(200);
      expect(createdOscillators.length).toBeGreaterThanOrEqual(2);

      // Adjust tempo with higher suspicion
      updateBGMTempo(80);
      vi.advanceTimersByTime(180);
      expect(createdOscillators.length).toBeGreaterThanOrEqual(3);

      stopProceduralBGM();
      const countAfterStop = createdOscillators.length;
      vi.advanceTimersByTime(500);
      expect(createdOscillators.length).toBe(countAfterStop);
    });

    it("cleans up clinical procedural audio on unmount via useClinicalAudioCleanup", () => {
      startProceduralBGM(200);
      const { unmount } = renderHook(() => useClinicalAudioCleanup());

      unmount();
      const count = createdOscillators.length;
      vi.advanceTimersByTime(500);
      expect(createdOscillators.length).toBe(count);
    });

    it("manages procedural BGM lifecycle through useProceduralBGM hook", () => {
      const { rerender, unmount } = renderHook(
        ({ enabled, suspicion }) => useProceduralBGM(enabled, suspicion),
        { initialProps: { enabled: false, suspicion: 0 } }
      );

      expect(createdOscillators.length).toBe(0);

      rerender({ enabled: true, suspicion: 20 });
      expect(createdOscillators.length).toBeGreaterThanOrEqual(1);

      rerender({ enabled: false, suspicion: 20 });
      const count = createdOscillators.length;
      vi.advanceTimersByTime(500);
      expect(createdOscillators.length).toBe(count);

      unmount();
    });
  });

  describe("4. Centralized Active Oscillator Tracking & stopAll()", () => {
    it("tracks active oscillators generated by game SFX and stops them immediately via SoundEngine.stopAll()", () => {
      const engine = getSoundEngine();
      retroAudio.playStep();
      playValidationSound();
      playPowerUpSound();

      vi.advanceTimersByTime(100);
      const activeCount = createdOscillators.length;
      expect(activeCount).toBeGreaterThanOrEqual(3);

      engine.stopAll();

      createdOscillators.forEach((osc) => {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      });
    });

    it("suppresses all game audio when SoundEngine is globally muted or accessibility bypass is active", () => {
      const engine = getSoundEngine();
      engine.setMuted(true);

      createdOscillators = [];
      retroAudio.playStep();
      playValidationSound();
      playSyntheticTone(440, 0.1);
      startProceduralBGM();

      vi.advanceTimersByTime(300);
      expect(createdOscillators.length).toBe(0);
    });
  });
});
