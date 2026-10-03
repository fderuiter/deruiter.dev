import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { renderHook } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";

import {
  playMemeSound,
  getMemeSoundDuration,
  isSoundAllowed,
  stopAllMemeSounds,
  getMemeAnalyser,
  connectMemeAnalyser,
  releaseMemeAnalyser,
  MEME_SCOPE_FFT_SIZE,
  useMemeAudioCleanup,
  type MemeSoundType,
} from "@/lib/meme-audio";
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

interface MockBufferSource {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

interface MockBiquadFilter {
  type: BiquadFilterType;
  frequency: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  Q: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

describe("Meme Audio & SoundEngine Core Integration (__tests__/meme-audio.test.ts)", () => {
  let mockStorage: MockStorage;
  let createdOscillators: MockOscillator[];
  let createdBufferSources: MockBufferSource[];
  let createdGains: MockGain[];
  let createdFilters: MockBiquadFilter[];
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
    createBiquadFilter: ReturnType<typeof vi.fn>;
    createBufferSource: ReturnType<typeof vi.fn>;
    createBuffer: ReturnType<typeof vi.fn>;
    createAnalyser: ReturnType<typeof vi.fn>;
  };
  let createdAnalysers: Array<{
    context: unknown;
    fftSize: number;
    smoothingTimeConstant: number;
    connect: ReturnType<typeof vi.fn>;
  }>;

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

  const createMockBufferSource = (): MockBufferSource => {
    const source: MockBufferSource = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    createdBufferSources.push(source);
    return source;
  };

  const createMockFilter = (): MockBiquadFilter => {
    const filter: MockBiquadFilter = {
      type: "bandpass",
      frequency: {
        value: 1000,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      Q: {
        value: 1,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    createdFilters.push(filter);
    return filter;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = new MockStorage();
    createdOscillators = [];
    createdBufferSources = [];
    createdGains = [];
    createdFilters = [];
    createdAnalysers = [];

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
      createBiquadFilter: vi.fn().mockImplementation(createMockFilter),
      createBufferSource: vi.fn().mockImplementation(createMockBufferSource),
      // The engine keeps the first context it made, so the analyser reports
      // whichever context it was created on.
      createAnalyser: vi.fn(function (this: unknown) {
        const analyser = {
          context: this,
          fftSize: 2048,
          smoothingTimeConstant: 0.8,
          connect: vi.fn(),
        };
        createdAnalysers.push(analyser);
        return analyser;
      }),
      createBuffer: vi
        .fn()
        .mockImplementation(
          (channels: number, length: number, sampleRate: number) => {
            const channelData = new Float32Array(length);
            return fromPartial<AudioBuffer>({
              numberOfChannels: channels,
              length,
              sampleRate,
              duration: length / sampleRate,
              getChannelData: vi.fn().mockReturnValue(channelData),
            });
          }
        ),
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

    const soundEngine = getSoundEngine();
    soundEngine.setMuted(false);
    soundEngine.setVolume(0.5);
  });

  afterEach(() => {
    releaseMemeAnalyser();
    stopAllMemeSounds();
    getSoundEngine().stopAll();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockStorage.clear();
  });

  describe("1. Architectural Invariants & Import Hygiene", () => {
    it("verifies lib/meme-audio.ts does NOT import from @/components/providers/AudioProvider", () => {
      const filePath = path.resolve(process.cwd(), "lib/meme-audio.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toContain("@/components/providers/AudioProvider");
      expect(content).not.toContain("AudioProvider");
    });

    it("verifies all 9 meme sound types provide valid non-zero durations", () => {
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
      expect(getMemeSoundDuration("friday-alarm")).toBe(400);
      expect(getMemeSoundDuration("level-up")).toBe(380);
      expect(getMemeSoundDuration("fanfare")).toBe(380);
      expect(getMemeSoundDuration("fda-siren")).toBe(280);
      expect(getMemeSoundDuration("laser")).toBe(220);
      expect(getMemeSoundDuration("matrix-glitch")).toBe(220);
    });
  });

  describe("2. Synthesizer Execution & SoundEngine Integration", () => {
    it("synthesizes all meme sound types cleanly without unhandled exceptions", () => {
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

    it("delegates isSoundAllowed() directly to SoundEngine", () => {
      const engine = getSoundEngine();
      expect(isSoundAllowed()).toBe(true);

      engine.setMuted(true);
      expect(isSoundAllowed()).toBe(false);

      engine.setMuted(false);
      expect(isSoundAllowed()).toBe(true);
    });

    it("tracks active oscillators and buffer sources in SoundEngine during multi-stage sounds", () => {
      playMemeSound("bark");
      expect(createdOscillators.length).toBeGreaterThanOrEqual(1);
      expect(createdBufferSources.length).toBeGreaterThanOrEqual(1);

      playMemeSound("teapot-whistle");
      expect(createdOscillators.length).toBeGreaterThanOrEqual(3);

      playMemeSound("modem");
      expect(createdOscillators.length).toBeGreaterThanOrEqual(5);
    });

    it("stops all active meme sounds via stopAllMemeSounds() and SoundEngine.stopAll()", () => {
      playMemeSound("bark");
      playMemeSound("modem");
      playMemeSound("teapot-whistle");

      expect(createdOscillators.length).toBeGreaterThanOrEqual(5);
      expect(createdBufferSources.length).toBeGreaterThanOrEqual(2);

      stopAllMemeSounds();

      createdOscillators.forEach((osc) => {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      });

      createdBufferSources.forEach((src) => {
        expect(src.stop).toHaveBeenCalled();
        expect(src.disconnect).toHaveBeenCalled();
      });
    });

    it("triggers stopAllMemeSounds on hook unmount via useMemeAudioCleanup", () => {
      playMemeSound("laser");
      const { unmount } = renderHook(() => useMemeAudioCleanup());

      unmount();
      createdOscillators.forEach((osc) => {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe("3. Governance & Accessibility Enforcement", () => {
    it("suppresses sound playback when SoundEngine is muted", () => {
      const engine = getSoundEngine();
      engine.setMuted(true);

      createdOscillators = [];
      createdBufferSources = [];

      playMemeSound("bark");
      playMemeSound("laser");
      playMemeSound("modem");

      expect(createdOscillators.length).toBe(0);
      expect(createdBufferSources.length).toBe(0);
    });

    it("suppresses sound playback when accessibility bypass (reduced motion) is active", () => {
      if (typeof window !== "undefined") {
        Object.defineProperty(window, "matchMedia", {
          writable: true,
          value: vi.fn().mockImplementation((query: string) => ({
            matches: query.includes("prefers-reduced-motion"),
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

      createdOscillators = [];
      createdBufferSources = [];

      playMemeSound("bark");
      playMemeSound("laser");

      expect(createdOscillators.length).toBe(0);
      expect(createdBufferSources.length).toBe(0);
    });
  });
  describe("4. Oscilloscope tap (#1526)", () => {
    it("opens no analyser when other pages play meme sounds", () => {
      playMemeSound("laser");
      expect(getMemeAnalyser()).toBeNull();
      expect(getSoundEngine().getOutputTap()).toBeNull();
      expect(createdAnalysers).toHaveLength(0);
    });

    it("routes sounds through one analyser once the vault connects it", () => {
      const analyser = connectMemeAnalyser();
      expect(analyser).not.toBeNull();
      expect(getMemeAnalyser()).toBe(analyser);
      expect(createdAnalysers).toHaveLength(1);
      const made = createdAnalysers[0];
      expect(made.fftSize).toBe(MEME_SCOPE_FFT_SIZE);
      expect(made.smoothingTimeConstant).toBe(0);
      const ctx = getSoundEngine().getAudioContext();
      expect(made.connect).toHaveBeenCalledWith(ctx?.destination);
      expect(getSoundEngine().getOutputTap()).toBe(analyser);

      playMemeSound("laser");
      // The laser's gain stage feeds the analyser, not the speakers.
      expect(createdGains.at(-1)?.connect).toHaveBeenCalledWith(analyser);

      expect(connectMemeAnalyser()).toBe(analyser);
      expect(createdAnalysers).toHaveLength(1);
    });

    it("opens nothing while muted", () => {
      getSoundEngine().setMuted(true);
      expect(connectMemeAnalyser()).toBeNull();
      expect(createdAnalysers).toHaveLength(0);
    });

    it("restores direct output on release", () => {
      connectMemeAnalyser();
      releaseMemeAnalyser();
      expect(getMemeAnalyser()).toBeNull();
      expect(getSoundEngine().getOutputTap()).toBeNull();
      playMemeSound("fda-siren");
      const ctx = getSoundEngine().getAudioContext();
      expect(createdGains.at(-1)?.connect).toHaveBeenCalledWith(
        ctx?.destination
      );
    });

    it("ignores a tap from another context", () => {
      getSoundEngine().setOutputTap(
        fromPartial<AudioNode>({ context: fromPartial<BaseAudioContext>({}) })
      );
      playMemeSound("fda-siren");
      const ctx = getSoundEngine().getAudioContext();
      expect(createdGains.at(-1)?.connect).toHaveBeenCalledWith(
        ctx?.destination
      );
      getSoundEngine().setOutputTap(null);
    });
  });
});
