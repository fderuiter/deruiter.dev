import type { SoundEngine } from "@/lib/audio/sound-engine";
import type { TimelineStep } from "@/lib/trial-and-error";

/** Every named sound the cabinet can make. */
export const TE_CUES = [
  "chipTick",
  "multThunk",
  "xMultFlare",
  "zeroSlam",
  "cardSelect",
  "cardDeselect",
  "cardDeal",
  "cardFlip",
  "discardWhoosh",
  "blindCleared",
  "blindFailed",
  "csrLocked",
  "fireIgnite",
  "shopBell",
  "packTear",
  "reroll",
  "buy",
  "sell",
  "bossStinger",
] as const;
/** A named cabinet sound. */
export type TeCue = (typeof TE_CUES)[number];

interface CueOptions {
  /** For chipTick: the consecutive chip step in this hand; pitch rises with it. */
  step?: number;
}

const semitones = (base: number, n: number) => base * 2 ** (n / 12);

/** An arpeggio as delayed tones on the audio clock (no timers). */
const arpeggio = (
  engine: SoundEngine,
  freqs: number[],
  gap: number,
  type: OscillatorType,
  duration = 0.14
) =>
  freqs.forEach((frequency, i) =>
    engine.playTone({ frequency, duration, delay: i * gap, type, volume: 0.3 })
  );

/**
 * Synthesized recipes for each cue, built from the shared SoundEngine's
 * primitives. No sampled assets.
 */
export const CUE_RECIPES: Record<
  TeCue,
  (engine: SoundEngine, options: CueOptions) => void
> = {
  chipTick: (engine, { step = 0 }) =>
    engine.playTone({
      frequency: semitones(880, Math.min(step, 12)),
      duration: 0.05,
      type: "square",
      volume: 0.22,
      attack: 0.002,
      decay: 0.03,
      sustain: 0.1,
      release: 0.02,
    }),
  multThunk: (engine) => {
    engine.playTone({
      frequency: 120,
      endFrequency: 55,
      duration: 0.14,
      type: "triangle",
      volume: 0.5,
    });
    engine.playNoise({
      duration: 0.06,
      volume: 0.25,
      filterType: "lowpass",
      filterFrequency: 300,
    });
  },
  xMultFlare: (engine) =>
    engine.playTone({
      frequency: 440,
      endFrequency: 1760,
      duration: 0.28,
      type: "sawtooth",
      volume: 0.22,
    }),
  zeroSlam: (engine) => {
    // A minor second apart: deliberately dissonant.
    engine.playTone({
      frequency: 98,
      duration: 0.4,
      type: "sawtooth",
      volume: 0.35,
    });
    engine.playTone({
      frequency: 103.83,
      duration: 0.4,
      type: "sawtooth",
      volume: 0.3,
    });
    engine.playNoise({
      duration: 0.12,
      volume: 0.35,
      filterType: "lowpass",
      filterFrequency: 200,
    });
  },
  cardSelect: (engine) =>
    engine.playTone({
      frequency: 660,
      duration: 0.04,
      type: "triangle",
      volume: 0.2,
    }),
  cardDeselect: (engine) =>
    engine.playTone({
      frequency: 494,
      duration: 0.04,
      type: "triangle",
      volume: 0.18,
    }),
  cardDeal: (engine) =>
    engine.playNoise({
      duration: 0.05,
      volume: 0.18,
      filterType: "bandpass",
      filterFrequency: 2200,
    }),
  cardFlip: (engine) => {
    engine.playNoise({
      duration: 0.03,
      volume: 0.15,
      filterType: "highpass",
      filterFrequency: 3000,
    });
    engine.playTone({
      frequency: 990,
      duration: 0.03,
      type: "sine",
      volume: 0.12,
    });
  },
  discardWhoosh: (engine) =>
    engine.playNoise({
      duration: 0.22,
      volume: 0.25,
      filterType: "bandpass",
      filterFrequency: 800,
      filterQ: 0.7,
    }),
  blindCleared: (engine) =>
    arpeggio(engine, [523.25, 659.25, 783.99, 1046.5], 0.09, "square"),
  // The victory cue: the cleared arpeggio an octave up, landing on a chord.
  csrLocked: (engine) => {
    arpeggio(
      engine,
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98],
      0.08,
      "square"
    );
    for (const frequency of [1046.5, 1318.51, 1567.98]) {
      engine.playTone({
        frequency,
        duration: 0.6,
        delay: 0.5,
        type: "triangle",
        volume: 0.2,
      });
    }
  },
  blindFailed: (engine) =>
    arpeggio(engine, [392, 329.63, 261.63, 220], 0.14, "triangle", 0.22),
  fireIgnite: (engine) => {
    engine.playNoise({
      duration: 0.3,
      volume: 0.25,
      filterType: "lowpass",
      filterFrequency: 1200,
    });
    engine.playTone({
      frequency: 220,
      endFrequency: 880,
      duration: 0.3,
      type: "triangle",
      volume: 0.2,
    });
  },
  shopBell: (engine) => {
    engine.playTone({
      frequency: 1318.5,
      duration: 0.45,
      type: "sine",
      volume: 0.25,
    });
    engine.playTone({
      frequency: 1975.5,
      duration: 0.45,
      type: "sine",
      volume: 0.15,
    });
  },
  packTear: (engine) =>
    engine.playNoise({
      duration: 0.16,
      volume: 0.25,
      filterType: "highpass",
      filterFrequency: 2500,
    }),
  reroll: (engine) =>
    arpeggio(engine, [659.25, 783.99, 659.25, 880], 0.05, "square", 0.05),
  buy: (engine) => arpeggio(engine, [783.99, 1174.66], 0.07, "square", 0.08),
  sell: (engine) => arpeggio(engine, [1174.66, 783.99], 0.07, "square", 0.08),
  bossStinger: (engine) =>
    arpeggio(engine, [55, 58.27, 82.41], 0.18, "sawtooth", 0.6),
};

const isChipStep = (step: TimelineStep) =>
  step.kind === "HAND_BASE" ||
  step.kind === "CARD_SCORED" ||
  (step.kind === "RULE" && step.multDelta <= 0 && step.chipsDelta > 0) ||
  (step.kind === "RELIC" && step.xMult === 1 && step.mult <= 0);

/**
 * The cue step `index` of a score timeline makes, if any. Consecutive chip
 * steps climb in pitch; a penalty gets a falling blip.
 */
export function cueForStep(
  steps: TimelineStep[],
  index: number
): { cue: TeCue; step?: number } | null {
  const step = steps[index];
  if (!step) return null;
  if (isChipStep(step)) {
    return {
      cue: "chipTick",
      step: steps.slice(0, index).filter(isChipStep).length,
    };
  }
  switch (step.kind) {
    case "RULE":
      return step.multDelta > 0
        ? { cue: "multThunk" }
        : { cue: "cardDeselect" };
    case "RELIC":
      return step.xMult !== 1 ? { cue: "xMultFlare" } : { cue: "multThunk" };
    case "X_MULT":
      return step.factor === 1 ? null : { cue: "xMultFlare" };
    case "ZERO_RULE":
      return { cue: "zeroSlam" };
    case "BLIND_PROGRESS":
      return step.crossed ? { cue: "fireIgnite" } : null;
    default:
      return null;
  }
}

const MUSIC_PATTERN = [0, 7, 3, 10, 0, 7, 5, 12];
const LOOKAHEAD_S = 0.12;
const TICK_MS = 30;

/**
 * The ambient music loop: a sequenced synth pattern scheduled on the audio
 * clock by a small lookahead timer. It holds no React state, so a beat never
 * re-renders anything. Tempo and filter rise in boss Blinds, and it ducks
 * under score resolution.
 */
export class TeMusicLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private beat = 0;
  private boss = false;
  private output: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  constructor(private readonly engine: SoundEngine) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(boss = false): void {
    this.boss = boss;
    if (this.timer || !this.engine.isSoundAllowed()) return;
    const ctx = this.engine.getAudioContext();
    if (!ctx) return;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = boss ? 1800 : 900;
    this.output = ctx.createGain();
    this.output.gain.value = 0.06 * this.engine.getVolume();
    this.filter.connect(this.output);
    this.output.connect(ctx.destination);
    this.nextTime = ctx.currentTime + 0.05;
    this.beat = 0;
    this.timer = setInterval(() => this.schedule(ctx), TICK_MS);
  }

  /** Lowers the loop under score resolution; restores it afterwards. */
  duck(on: boolean): void {
    const ctx = this.output?.context;
    if (!ctx || !this.output) return;
    const target = (on ? 0.02 : 0.06) * this.engine.getVolume();
    this.output.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      this.output?.disconnect();
      this.filter?.disconnect();
    } catch {
      // Already disconnected.
    }
    this.output = null;
    this.filter = null;
  }

  private schedule(ctx: AudioContext): void {
    if (!this.engine.isSoundAllowed() || !this.filter) {
      this.stop();
      return;
    }
    const beatLength = 60 / (this.boss ? 132 : 96) / 2;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      const osc = this.engine.trackSource(ctx.createOscillator());
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = semitones(
        110,
        MUSIC_PATTERN[this.beat % MUSIC_PATTERN.length]
      );
      env.gain.setValueAtTime(0.0001, this.nextTime);
      env.gain.exponentialRampToValueAtTime(1, this.nextTime + 0.02);
      env.gain.exponentialRampToValueAtTime(
        0.0001,
        this.nextTime + beatLength * 0.9
      );
      osc.connect(env);
      env.connect(this.filter);
      osc.start(this.nextTime);
      osc.stop(this.nextTime + beatLength);
      this.nextTime += beatLength;
      this.beat += 1;
    }
  }
}
