import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type MockStorage, resetMockStorage } from "./helpers/storage-mock";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SoundEngine,
  getSoundEngine,
  type ToneOptions,
  type SequenceNote,
  type SequenceOptions,
  type NoiseOptions,
} from "@/lib/audio/sound-engine";

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
  onended: (() => void) | null;
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

interface MockPanner {
  pan: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockBiquadFilter {
  type: BiquadFilterType;
  frequency: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
  };
  Q: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
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
  onended: (() => void) | null;
}

describe("SoundEngine (lib/audio/sound-engine)", () => {
  let mockStorage: MockStorage;
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
    createStereoPanner: ReturnType<typeof vi.fn>;
    createBiquadFilter: ReturnType<typeof vi.fn>;
    createBuffer: ReturnType<typeof vi.fn>;
    createBufferSource: ReturnType<typeof vi.fn>;
  };

  let createdOscillators: MockOscillator[];
  let createdGains: MockGain[];
  let createdBufferSources: MockBufferSource[];
  let createdPanners: MockPanner[];
  let createdFilters: MockBiquadFilter[];

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
      onended: null,
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
      onended: null,
    };
    createdBufferSources.push(source);
    return source;
  };

  const createMockPanner = (): MockPanner => {
    const panner: MockPanner = {
      pan: {
        value: 0,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    createdPanners.push(panner);
    return panner;
  };

  const createMockFilter = (): MockBiquadFilter => {
    const filter: MockBiquadFilter = {
      type: "lowpass",
      frequency: {
        value: 1000,
        setValueAtTime: vi.fn(),
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
    mockStorage = resetMockStorage();
    createdOscillators = [];
    createdGains = [];
    createdBufferSources = [];
    createdPanners = [];
    createdFilters = [];

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
      createStereoPanner: vi.fn().mockImplementation(createMockPanner),
      createBiquadFilter: vi.fn().mockImplementation(createMockFilter),
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

      createBufferSource: vi.fn().mockImplementation(createMockBufferSource),
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
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("1. AudioContext Lifecycle & Initialization", () => {
    it("lazily initializes AudioContext on first audio trigger", () => {
      const engine = new SoundEngine({ initialMuted: false });
      expect(AudioContext).not.toHaveBeenCalled();

      engine.playTone(440, 0.1);
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it("resumes suspended AudioContext when triggered", async () => {
      mockAudioContext.state = "suspended";
      const engine = new SoundEngine({ initialMuted: false });

      engine.playTone(440, 0.1);
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it("handles close() by clearing sources and closing AudioContext", async () => {
      const engine = new SoundEngine({ initialMuted: false });
      engine.playTone(440, 0.5);
      expect(createdOscillators.length).toBe(1);

      engine.close();
      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(createdOscillators[0].disconnect).toHaveBeenCalled();
    });

    it("gracefully falls back when AudioContext is unavailable (SSR/Node)", () => {
      vi.stubGlobal("AudioContext", undefined);
      if (typeof window !== "undefined") {
        Object.defineProperty(window, "AudioContext", {
          value: undefined,
          writable: true,
          configurable: true,
        });
      }

      const engine = new SoundEngine({ initialMuted: false });
      expect(() => {
        engine.playTone(440, 0.1);
        engine.playSequence([{ frequency: 440, duration: 0.1 }]);
        engine.playNoise({ duration: 0.1 });
        engine.stopAll();
      }).not.toThrow();
    });
  });

  describe("2. Single Tone Synthesis (playTone)", () => {
    it("configures oscillator type, frequency, and envelope correctly with positional arguments", () => {
      const engine = new SoundEngine({
        initialMuted: false,
        initialVolume: 0.5,
      });
      engine.playTone(523.25, 0.12, "sawtooth", 0.8);

      expect(createdOscillators.length).toBe(1);
      const osc = createdOscillators[0];
      expect(osc.type).toBe("sawtooth");
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 0);
      expect(osc.start).toHaveBeenCalledWith(0);
      expect(osc.stop).toHaveBeenCalledWith(0.12);

      expect(createdGains.length).toBe(1);
      const gain = createdGains[0];
      // Effective gain = volume (0.8) * masterVolume (0.5) = 0.4
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.4, 0);
      expect(gain.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    });

    it("supports ToneOptions object with ADSR envelope and stereo panning", () => {
      const engine = new SoundEngine({
        initialMuted: false,
        initialVolume: 1.0,
      });
      const options: ToneOptions = {
        frequency: 880,
        duration: 0.3,
        type: "triangle",
        volume: 0.6,
        attack: 0.05,
        decay: 0.05,
        sustain: 0.5,
        release: 0.1,
        pan: -0.5,
      };

      engine.playTone(options);

      const osc = createdOscillators[0];
      expect(osc.type).toBe("triangle");
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);

      const gain = createdGains[0];
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.6, 0.05); // Attack
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.3, 0.1); // Decay to sustain (0.6 * 0.5 = 0.3)

      expect(createdPanners.length).toBe(1);
      expect(createdPanners[0].pan.setValueAtTime).toHaveBeenCalledWith(
        -0.5,
        0
      );
    });

    it("auto-disconnects oscillator and gain nodes after playback ends", () => {
      const engine = new SoundEngine({ initialMuted: false });
      engine.playTone(440, 0.1);

      const osc = createdOscillators[0];
      const gain = createdGains[0];

      // Fast-forward past duration + safety margin
      vi.advanceTimersByTime(500);

      expect(osc.disconnect).toHaveBeenCalled();
      expect(gain.disconnect).toHaveBeenCalled();
    });
  });

  describe("3. Sequence & Arpeggio Playback (playSequence)", () => {
    it("schedules consecutive notes with appropriate delays and durations", () => {
      const engine = new SoundEngine({
        initialMuted: false,
        initialVolume: 0.5,
      });
      const notes: SequenceNote[] = [
        { frequency: 261.63, duration: 0.1 },
        { frequency: 329.63, duration: 0.1, delay: 0.08 },
        { frequency: 392.0, duration: 0.15, delay: 0.16 },
      ];

      const sequenceHandle = engine.playSequence(notes);
      expect(sequenceHandle).toBeDefined();

      // First note should start at t=0
      expect(createdOscillators.length).toBe(1);
      expect(
        createdOscillators[0].frequency.setValueAtTime
      ).toHaveBeenCalledWith(261.63, 0);

      // Advance time to t=80ms
      vi.advanceTimersByTime(80);
      expect(createdOscillators.length).toBe(2);
      expect(
        createdOscillators[1].frequency.setValueAtTime
      ).toHaveBeenCalledWith(329.63, expect.any(Number));

      // Advance time to t=160ms
      vi.advanceTimersByTime(80);
      expect(createdOscillators.length).toBe(3);
      expect(
        createdOscillators[2].frequency.setValueAtTime
      ).toHaveBeenCalledWith(392.0, expect.any(Number));
    });

    it("cancels future notes in a sequence when sequenceHandle.cancel() is called", () => {
      const engine = new SoundEngine({ initialMuted: false });
      const notes: SequenceNote[] = [
        { frequency: 261.63, duration: 0.1 },
        { frequency: 329.63, duration: 0.1, delay: 0.1 },
        { frequency: 392.0, duration: 0.1, delay: 0.2 },
      ];

      const handle = engine.playSequence(notes);
      expect(createdOscillators.length).toBe(1);

      // Cancel before subsequent notes fire
      handle.cancel();

      vi.advanceTimersByTime(300);
      expect(createdOscillators.length).toBe(1); // No additional oscillators created
    });

    it("supports sequence options for default note type and volume multiplier", () => {
      const engine = new SoundEngine({
        initialMuted: false,
        initialVolume: 1.0,
      });
      const notes: SequenceNote[] = [
        { frequency: 440, duration: 0.1 },
        { frequency: 880, duration: 0.1, delay: 0.05, type: "sawtooth" },
      ];
      const seqOpts: SequenceOptions = {
        defaultType: "square",
        volume: 0.2,
      };

      engine.playSequence(notes, seqOpts);

      expect(createdOscillators[0].type).toBe("square");
      expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.2, 0);

      vi.advanceTimersByTime(50);
      expect(createdOscillators[1].type).toBe("sawtooth");
    });
  });

  describe("4. Synthetic Noise Generation (playNoise)", () => {
    it("allocates audio buffer and routes through buffer source, filter, and gain", () => {
      const engine = new SoundEngine({
        initialMuted: false,
        initialVolume: 0.5,
      });
      const noiseOpts: NoiseOptions = {
        duration: 0.2,
        volume: 0.4,
        filterType: "bandpass",
        filterFrequency: 1500,
        filterQ: 2.0,
      };

      engine.playNoise(noiseOpts);

      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        44100
      );
      expect(createdBufferSources.length).toBe(1);
      const source = createdBufferSources[0];

      expect(createdFilters.length).toBe(1);
      const filter = createdFilters[0];
      expect(filter.type).toBe("bandpass");
      expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(1500, 0);
      expect(filter.Q.setValueAtTime).toHaveBeenCalledWith(2.0, 0);

      expect(createdGains.length).toBe(1);
      // Effective gain = volume (0.4) * masterVolume (0.5) = 0.2
      expect(createdGains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.2, 0);

      expect(source.start).toHaveBeenCalledWith(0);
      expect(source.stop).toHaveBeenCalledWith(0.2);
    });

    it("supports plain noise playback without filter", () => {
      const engine = new SoundEngine({
        initialMuted: false,
        initialVolume: 1.0,
      });
      engine.playNoise({ duration: 0.1, volume: 0.3 });

      expect(createdBufferSources.length).toBe(1);
      expect(createdFilters.length).toBe(0);
      expect(createdBufferSources[0].connect).toHaveBeenCalledWith(
        createdGains[0]
      );
    });
  });

  describe("5. Master Volume Governance & Clamping", () => {
    it("initializes with default volume (0.3) or stored localStorage value", () => {
      mockStorage.setItem("sound_volume", "0.75");
      const engine = new SoundEngine();
      expect(engine.getVolume()).toBe(0.75);

      mockStorage.clear();
      const defaultEngine = new SoundEngine();
      expect(defaultEngine.getVolume()).toBe(0.3);
    });

    it("clamps volume between 0 and 1 and persists to localStorage", () => {
      const engine = new SoundEngine();

      engine.setVolume(1.5);
      expect(engine.getVolume()).toBe(1);
      expect(mockStorage.getItem("sound_volume")).toBe("1");

      engine.setVolume(-0.2);
      expect(engine.getVolume()).toBe(0);
      expect(mockStorage.getItem("sound_volume")).toBe("0");

      engine.setVolume(0.65);
      expect(engine.getVolume()).toBe(0.65);
      expect(mockStorage.getItem("sound_volume")).toBe("0.65");
    });
  });

  describe("6. Mute Governance & Accessibility Bypass", () => {
    it("initializes mute state from localStorage or default (true)", () => {
      mockStorage.setItem("sound_muted", "false");
      const unmutedEngine = new SoundEngine();
      expect(unmutedEngine.isMuted()).toBe(false);

      mockStorage.clear();
      const defaultEngine = new SoundEngine();
      expect(defaultEngine.isMuted()).toBe(true);
    });

    it("persists mute state changes to localStorage", () => {
      const engine = new SoundEngine({ initialMuted: true });
      expect(engine.isMuted()).toBe(true);

      engine.setMuted(false);
      expect(engine.isMuted()).toBe(false);
      expect(mockStorage.getItem("sound_muted")).toBe("false");

      engine.setMuted(true);
      expect(engine.isMuted()).toBe(true);
      expect(mockStorage.getItem("sound_muted")).toBe("true");
    });

    it("toggleMute flips mute state and returns next value", () => {
      const engine = new SoundEngine({ initialMuted: false });
      expect(engine.toggleMute()).toBe(true);
      expect(engine.isMuted()).toBe(true);
      expect(engine.toggleMute()).toBe(false);
      expect(engine.isMuted()).toBe(false);
    });

    it("suppresses all audio playback when muted is true", () => {
      const engine = new SoundEngine({ initialMuted: true });

      engine.playTone(440, 0.1);
      engine.playSequence([{ frequency: 440, duration: 0.1 }]);
      engine.playNoise({ duration: 0.1 });

      expect(createdOscillators.length).toBe(0);
      expect(createdBufferSources.length).toBe(0);
    });

    it("suppresses audio playback when accessibility bypass (reduced motion / forced colors) is active", () => {
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

      const engine = new SoundEngine({ initialMuted: false });
      expect(engine.isBypassActive()).toBe(true);
      expect(engine.isSoundAllowed()).toBe(false);

      engine.playTone(440, 0.1);
      expect(createdOscillators.length).toBe(0);
    });
  });

  describe("7. stopAll() and Resource Teardown", () => {
    it("immediately stops and disconnects all active oscillators and buffer sources", () => {
      const engine = new SoundEngine({ initialMuted: false });
      engine.playTone(440, 1.0);
      engine.playTone(880, 1.0);
      engine.playNoise({ duration: 1.0 });

      expect(createdOscillators.length).toBe(2);
      expect(createdBufferSources.length).toBe(1);

      engine.stopAll();

      createdOscillators.forEach((osc) => {
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.disconnect).toHaveBeenCalled();
      });

      createdBufferSources.forEach((src) => {
        expect(src.stop).toHaveBeenCalled();
        expect(src.disconnect).toHaveBeenCalled();
      });
    });

    it("stops all active audio immediately when setMuted(true) is invoked", () => {
      const engine = new SoundEngine({ initialMuted: false });
      engine.playTone(440, 1.0);

      expect(createdOscillators[0].disconnect).not.toHaveBeenCalled();

      engine.setMuted(true);
      expect(createdOscillators[0].stop).toHaveBeenCalled();
      expect(createdOscillators[0].disconnect).toHaveBeenCalled();
    });

    it("cancels all pending sequence timeouts on stopAll()", () => {
      const engine = new SoundEngine({ initialMuted: false });
      engine.playSequence([
        { frequency: 260, duration: 0.1 },
        { frequency: 330, duration: 0.1, delay: 0.1 },
        { frequency: 390, duration: 0.1, delay: 0.2 },
      ]);

      expect(createdOscillators.length).toBe(1);
      engine.stopAll();

      vi.advanceTimersByTime(500);
      expect(createdOscillators.length).toBe(1);
    });
  });

  describe("8. Singleton Accessor (getSoundEngine)", () => {
    it("returns a singleton instance", () => {
      const inst1 = getSoundEngine();
      const inst2 = getSoundEngine();
      expect(inst1).toBe(inst2);
      expect(inst1).toBeInstanceOf(SoundEngine);
    });
  });
});
