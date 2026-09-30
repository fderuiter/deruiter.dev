/**
 * Headless Web Audio Synthesizer & Governance Engine
 *
 * Provides pure oscillator synthesis, sequence scheduling, procedural noise generation,
 * master volume scaling, mute governance, and accessibility bypass detection with zero React dependencies.
 */

import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import { clamp } from "@/lib/game-utils";
import {
  safeIsAvailable,
  safeRawStorage,
  type RawStorage,
} from "@/lib/safe-storage";

export type WaveformType = OscillatorType;

export interface SoundEngineOptions {
  /** Initial volume level (0.0 to 1.0). If omitted, loads from storage or defaults to 0.3 */
  initialVolume?: number;
  /** Initial mute state. If omitted, loads from storage or defaults to true */
  initialMuted?: boolean;
  /** Custom storage provider (defaults to localStorage through lib/safe-storage when available) */
  storage?: Storage | null;
  /** Custom AudioContext constructor or instance (useful for dependency injection in testing) */
  audioContext?: AudioContext | null;
}

export interface ToneOptions {
  /** Frequency in Hz (e.g. 440 for A4) */
  frequency: number;
  /** Target frequency in Hz at note end for pitch sweeps/ramps */
  endFrequency?: number;
  /** Ramp curve type for endFrequency (default: 'exponential') */
  rampType?: "exponential" | "linear";
  /** Duration in seconds (e.g. 0.1 for 100ms) */
  duration?: number;
  /** Delay in seconds before playing this note (relative to sound start) */
  delay?: number;
  /** Oscillator waveform type */
  type?: OscillatorType;
  /** Tone-specific volume gain multiplier (0.0 to 1.0, default: 0.5) */
  volume?: number;
  /** Stereo pan position (-1.0 to 1.0, where -1 is full left, 1 is full right) */
  pan?: number;
  /** Attack time in seconds (linear ramp up) */
  attack?: number;
  /** Decay time in seconds (linear ramp down to sustain level) */
  decay?: number;
  /** Sustain volume level multiplier (0.0 to 1.0) */
  sustain?: number;
  /** Release time in seconds (linear ramp to 0) */
  release?: number;
}

export interface SequenceNote {
  /** Frequency in Hz */
  frequency: number;
  /** Target frequency in Hz at note end for pitch sweeps */
  endFrequency?: number;
  /** Ramp curve type for endFrequency */
  rampType?: "exponential" | "linear";
  /** Note duration in seconds */
  duration: number;
  /** Delay in seconds before playing this note (relative to sequence start) */
  delay?: number;
  /** Specific oscillator waveform type for this note */
  type?: OscillatorType;
  /** Note volume multiplier (0.0 to 1.0) */
  volume?: number;
  /** Stereo pan position (-1.0 to 1.0) */
  pan?: number;
}

export interface SequenceOptions {
  /** Default oscillator waveform type if not specified on individual notes */
  defaultType?: OscillatorType;
  /** Master volume multiplier for the sequence */
  volume?: number;
}

export interface SequenceHandle {
  /** Cancel any pending unplayed notes in this sequence */
  cancel: () => void;
}

export interface NoiseOptions {
  /** Duration in seconds */
  duration: number;
  /** Delay in seconds before playing noise (relative to sound start) */
  delay?: number;
  /** Volume gain multiplier (0.0 to 1.0, default: 0.3) */
  volume?: number;
  /** Optional filter type */
  filterType?: BiquadFilterType;
  /** Filter cutoff / center frequency in Hz */
  filterFrequency?: number;
  /** Filter resonance / quality factor Q */
  filterQ?: number;
  /** Stereo pan position (-1.0 to 1.0) */
  pan?: number;
}

export class SoundEngine {
  private volume: number;
  private muted: boolean;
  private storage: RawStorage | null;
  private audioCtx: AudioContext | null = null;
  private activeSources = new Set<AudioScheduledSourceNode>();
  private activeSequenceTimeouts = new Set<NodeJS.Timeout | number>();

  constructor(options: SoundEngineOptions = {}) {
    this.storage =
      options.storage !== undefined
        ? options.storage
        : safeIsAvailable()
          ? safeRawStorage
          : null;

    if (options.audioContext) {
      this.audioCtx = options.audioContext;
    }

    if (options.initialVolume !== undefined) {
      this.volume = clamp(options.initialVolume, 0, 1);
    } else {
      this.volume = this.loadStoredVolume();
    }

    if (options.initialMuted !== undefined) {
      this.muted = options.initialMuted;
    } else {
      this.muted = this.loadStoredMuted();
    }
  }

  private loadStoredVolume(): number {
    if (!this.storage) return 0.3;
    try {
      const stored = this.storage.getItem("sound_volume");
      if (stored !== null) {
        const val = parseFloat(stored);
        if (!isNaN(val)) {
          return clamp(val, 0, 1);
        }
      }
    } catch {
      // Storage access failure defense
    }
    return 0.3;
  }

  private loadStoredMuted(): boolean {
    if (!this.storage) return true;
    try {
      const stored = this.storage.getItem("sound_muted");
      if (stored !== null) {
        return stored === "true";
      }
    } catch {
      // Storage access failure defense
    }
    return true;
  }

  /**
   * Lazily resolves or instantiates the active AudioContext.
   */
  public getAudioContext(): AudioContext | null {
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    if (
      typeof window === "undefined" &&
      typeof globalThis.AudioContext === "undefined"
    ) {
      return null;
    }

    const AudioContextClass =
      globalThis.AudioContext ||
      (typeof window !== "undefined"
        ? (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext
        : undefined);

    if (!AudioContextClass) return null;

    try {
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Returns current master volume (0.0 to 1.0).
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Sets master volume, clamps between 0 and 1, and persists to storage.
   */
  public setVolume(v: number): void {
    const clamped = clamp(v, 0, 1);
    this.volume = clamped;
    if (this.storage && typeof this.storage.setItem === "function") {
      try {
        this.storage.setItem("sound_volume", String(clamped));
      } catch {}
    }
  }

  /**
   * Returns current mute status.
   */
  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Sets mute status, persists to storage, and halts active audio on mute.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.storage && typeof this.storage.setItem === "function") {
      try {
        this.storage.setItem("sound_muted", String(muted));
      } catch {}
    }
    if (muted) {
      this.stopAll();
    } else {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }
  }

  /**
   * Toggles mute status and returns the next value.
   */
  public toggleMute(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  /**
   * Checks if user has enabled OS or browser-level accessibility bypasses
   * (e.g. forced-colors, high-contrast, or prefers-reduced-motion).
   */
  public isBypassActive(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const forcedColors = getMatchMediaMatches("(forced-colors: active)");
      const msHighContrast = getMatchMediaMatches(
        "(-ms-high-contrast: active)"
      );
      const prefersReducedMotion = getMatchMediaMatches(
        "(prefers-reduced-motion: reduce)"
      );
      const documentClasses = document.documentElement?.className || "";
      const documentHtmlContrast =
        document.documentElement?.getAttribute("data-contrast") || "";

      let storageBypass = false;
      if (this.storage) {
        try {
          storageBypass = this.storage.getItem("sound_a11y_bypass") === "true";
        } catch {}
      }

      return !!(
        forcedColors ||
        msHighContrast ||
        prefersReducedMotion ||
        documentClasses.includes("high-contrast") ||
        documentClasses.includes("contrast") ||
        documentHtmlContrast === "high" ||
        storageBypass
      );
    } catch {
      return false;
    }
  }

  /**
   * Returns whether sound playback is currently permitted.
   */
  public isSoundAllowed(): boolean {
    return !this.isMuted() && !this.isBypassActive();
  }

  /**
   * Tracks an active audio source node for unified lifecycle governance and immediate stopAll() termination.
   */
  public trackSource<T extends AudioScheduledSourceNode>(source: T): T {
    this.activeSources.add(source);
    try {
      if (typeof source.addEventListener === "function") {
        source.addEventListener("ended", () => {
          this.activeSources.delete(source);
        });
      }
    } catch {}
    return source;
  }

  /**
   * Synthesizes and plays a customizable frequency pulse.
   */
  public playTone(options: ToneOptions): void;
  public playTone(
    frequency: number,
    duration?: number,
    type?: OscillatorType,
    volume?: number,
    pan?: number
  ): void;
  public playTone(
    firstArg: ToneOptions | number,
    durationArg?: number,
    typeArg?: OscillatorType,
    volumeArg?: number,
    panArg?: number
  ): void {
    if (!this.isSoundAllowed()) return;

    let frequency: number;
    let endFrequency: number | undefined;
    let rampType: "exponential" | "linear" = "exponential";
    let duration = 0.08;
    let delay = 0;
    let type: OscillatorType = "sine";
    let volume = 0.5;
    let pan: number | undefined;
    let attack: number | undefined;
    let decay: number | undefined;
    let sustain: number | undefined;
    let release: number | undefined;

    if (typeof firstArg === "object" && firstArg !== null) {
      frequency = firstArg.frequency;
      endFrequency = firstArg.endFrequency;
      rampType = firstArg.rampType ?? rampType;
      duration = firstArg.duration ?? duration;
      delay = firstArg.delay ?? delay;
      type = firstArg.type ?? type;
      volume = firstArg.volume ?? volume;
      pan = firstArg.pan;
      attack = firstArg.attack;
      decay = firstArg.decay;
      sustain = firstArg.sustain;
      release = firstArg.release;
    } else {
      frequency = firstArg;
      duration = durationArg ?? duration;
      type = typeArg ?? type;
      volume = volumeArg ?? volume;
      pan = panArg;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const masterVolume = this.getVolume();
      const effectiveGain = volume * masterVolume;
      const now = ctx.currentTime;
      const startTime = now + delay;

      const osc = this.trackSource(ctx.createOscillator());
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, startTime);
      if (typeof endFrequency === "number" && endFrequency > 0) {
        if (rampType === "linear") {
          osc.frequency.linearRampToValueAtTime(
            endFrequency,
            startTime + duration
          );
        } else {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(1, endFrequency),
            startTime + duration
          );
        }
      }

      let totalDuration = duration;

      if (
        typeof attack === "number" ||
        typeof decay === "number" ||
        typeof sustain === "number" ||
        typeof release === "number"
      ) {
        const att = attack ?? 0.005;
        const dec = decay ?? 0.05;
        const sus = sustain ?? 0.5;
        const rel = release ?? 0.05;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(effectiveGain, startTime + att);
        gainNode.gain.linearRampToValueAtTime(
          effectiveGain * sus,
          startTime + att + dec
        );

        const sustainEndTime = startTime + att + dec + duration;
        gainNode.gain.setValueAtTime(effectiveGain * sus, sustainEndTime);
        gainNode.gain.linearRampToValueAtTime(0, sustainEndTime + rel);

        totalDuration = att + dec + duration + rel;
      } else {
        gainNode.gain.setValueAtTime(effectiveGain, startTime);
      }

      let lastNode: AudioNode = gainNode;

      if (
        typeof pan === "number" &&
        typeof ctx.createStereoPanner === "function"
      ) {
        try {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(clamp(pan, -1, 1), startTime);
          gainNode.connect(panner);
          lastNode = panner;
        } catch {}
      }

      lastNode.connect(ctx.destination);
      osc.connect(gainNode);

      osc.start(startTime);
      osc.stop(startTime + totalDuration);

      setTimeout(
        () => {
          try {
            osc.disconnect();
            gainNode.disconnect();
            if (lastNode !== gainNode) {
              lastNode.disconnect();
            }
          } catch {}
        },
        (delay + totalDuration + 0.1) * 1000
      );
    } catch {
      // Ignore audio synthesis exceptions
    }
  }

  /**
   * Plays an ordered sequence or arpeggio of notes.
   */
  public playSequence(
    notes: SequenceNote[],
    options: SequenceOptions = {}
  ): SequenceHandle {
    if (!this.isSoundAllowed() || notes.length === 0) {
      return { cancel: () => {} };
    }

    const timeouts = new Set<NodeJS.Timeout | number>();

    const cancel = () => {
      timeouts.forEach((t) => {
        clearTimeout(t as NodeJS.Timeout);
        this.activeSequenceTimeouts.delete(t);
      });
      timeouts.clear();
    };

    notes.forEach((note) => {
      const delay = note.delay ?? 0;
      const defaultType = options.defaultType ?? "sine";
      const seqVolMultiplier =
        options.volume !== undefined ? options.volume : 1;
      const noteBaseVol =
        note.volume !== undefined
          ? note.volume
          : options.volume !== undefined
            ? 1
            : 0.5;

      const playNoteAction = () => {
        this.playTone({
          frequency: note.frequency,
          endFrequency: note.endFrequency,
          rampType: note.rampType,
          duration: note.duration,
          type: note.type ?? defaultType,
          volume: noteBaseVol * seqVolMultiplier,
          pan: note.pan,
        });
      };

      if (delay <= 0) {
        playNoteAction();
      } else {
        const timeoutId = setTimeout(() => {
          timeouts.delete(timeoutId);
          this.activeSequenceTimeouts.delete(timeoutId);
          playNoteAction();
        }, delay * 1000);

        timeouts.add(timeoutId);
        this.activeSequenceTimeouts.add(timeoutId);
      }
    });

    return { cancel };
  }

  /**
   * Synthesizes and plays procedural white noise with optional filter resonance.
   */
  public playNoise(options: NoiseOptions): void {
    if (!this.isSoundAllowed()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (
      typeof ctx.createBuffer !== "function" ||
      typeof ctx.createBufferSource !== "function"
    ) {
      return;
    }

    try {
      const sampleRate = ctx.sampleRate || 44100;
      const bufferSize = Math.max(1, Math.floor(sampleRate * options.duration));
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);

      if (typeof buffer.getChannelData === "function") {
        const channelData = buffer.getChannelData(0);
        if (channelData) {
          for (let i = 0; i < bufferSize; i++) {
            channelData[i] = Math.random() * 2 - 1;
          }
        }
      }

      const source = this.trackSource(ctx.createBufferSource());
      source.buffer = buffer;

      const masterVolume = this.getVolume();
      const gainNode = ctx.createGain();
      const effectiveGain = (options.volume ?? 0.3) * masterVolume;
      const now = ctx.currentTime;
      const startTime = now + (options.delay ?? 0);

      gainNode.gain.setValueAtTime(effectiveGain, startTime);

      let lastNode: AudioNode = gainNode;

      if (options.filterType && typeof ctx.createBiquadFilter === "function") {
        const filter = ctx.createBiquadFilter();
        filter.type = options.filterType;
        if (options.filterFrequency !== undefined) {
          filter.frequency.setValueAtTime(options.filterFrequency, startTime);
        }
        if (options.filterQ !== undefined) {
          filter.Q.setValueAtTime(options.filterQ, startTime);
        }
        source.connect(filter);
        filter.connect(gainNode);
      } else {
        source.connect(gainNode);
      }

      if (
        typeof options.pan === "number" &&
        typeof ctx.createStereoPanner === "function"
      ) {
        try {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(clamp(options.pan, -1, 1), startTime);
          gainNode.connect(panner);
          lastNode = panner;
        } catch {}
      }

      lastNode.connect(ctx.destination);

      source.start(startTime);
      source.stop(startTime + options.duration);

      setTimeout(
        () => {
          try {
            source.disconnect();
            gainNode.disconnect();
            if (lastNode !== gainNode) {
              lastNode.disconnect();
            }
          } catch {}
        },
        ((options.delay ?? 0) + options.duration + 0.1) * 1000
      );
    } catch {
      // Ignore audio synthesis exceptions
    }
  }

  /**
   * Immediately halts all active playing oscillators, noise sources, and sequence timers.
   */
  public stopAll(): void {
    this.activeSequenceTimeouts.forEach((t) => {
      try {
        clearTimeout(t as NodeJS.Timeout);
      } catch {}
    });
    this.activeSequenceTimeouts.clear();

    const ctx = this.audioCtx;
    const now = ctx ? ctx.currentTime : 0;

    this.activeSources.forEach((src) => {
      try {
        src.stop(now);
      } catch {}
      try {
        src.disconnect();
      } catch {}
    });
    this.activeSources.clear();
  }

  /**
   * Closes and disposes of AudioContext resources.
   */
  public close(): void {
    this.stopAll();
    if (this.audioCtx) {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
    }
  }
}

let globalSoundEngine: SoundEngine | null = null;

/**
 * Returns the singleton SoundEngine instance.
 */
export function getSoundEngine(): SoundEngine {
  if (!globalSoundEngine) {
    globalSoundEngine = new SoundEngine();
  }
  return globalSoundEngine;
}
