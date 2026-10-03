/**
 * Synthesized Web Audio Sound Effects for Memes, Easter Eggs, and Soundboard
 */

import { useEffect } from "react";
import { getSoundEngine } from "@/lib/audio/sound-engine";

export function stopAllMemeSounds(): void {
  getSoundEngine().stopAll();
}

export function useMemeAudioCleanup(): void {
  useEffect(() => {
    return () => {
      stopAllMemeSounds();
    };
  }, []);
}

/** FFT size of the Meme Vault scope: 2048 time-domain samples per read. */
export const MEME_SCOPE_FFT_SIZE = 2048;

let memeAnalyser: AnalyserNode | null = null;

/**
 * Creates the Meme Vault scope's AnalyserNode on first use and routes the
 * sound engine's output through it, returning the node (or null when sound is
 * off or Web Audio is unavailable). Call it from a press handler, before
 * {@link playMemeSound}: it does nothing while sound is muted or bypassed, so
 * no AudioContext opens before the visitor has interacted and turned sound
 * on. Other pages that play meme sounds never call it and keep direct output.
 */
export function connectMemeAnalyser(): AnalyserNode | null {
  const engine = getSoundEngine();
  if (!engine.isSoundAllowed()) return null;
  const ctx = engine.getAudioContext();
  if (!ctx || typeof ctx.createAnalyser !== "function") return null;
  if (memeAnalyser && memeAnalyser.context === ctx) {
    if (engine.getOutputTap() !== memeAnalyser) {
      engine.setOutputTap(memeAnalyser);
    }
    return memeAnalyser;
  }
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = MEME_SCOPE_FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    analyser.connect(ctx.destination);
    memeAnalyser = analyser;
    engine.setOutputTap(analyser);
    return analyser;
  } catch {
    return null;
  }
}

/**
 * Returns the AnalyserNode that carries the soundboard's output, or null
 * until {@link connectMemeAnalyser} has made one.
 */
export function getMemeAnalyser(): AnalyserNode | null {
  return memeAnalyser;
}

/**
 * Takes the scope's analyser out of the sound engine's path, for when the
 * Meme Vault unmounts. Sounds already in flight finish through it; later
 * sounds go straight to the speakers.
 */
export function releaseMemeAnalyser(): void {
  const engine = getSoundEngine();
  if (memeAnalyser && engine.getOutputTap() === memeAnalyser) {
    engine.setOutputTap(null);
  }
  memeAnalyser = null;
}

export function isSoundAllowed(): boolean {
  return getSoundEngine().isSoundAllowed();
}

export type MemeSoundType =
  | "bark"
  | "laser"
  | "friday-alarm"
  | "matrix-glitch"
  | "teapot-whistle"
  | "modem"
  | "fda-siren"
  | "level-up"
  | "fanfare";

export function getMemeSoundDuration(type: MemeSoundType): number {
  switch (type) {
    case "modem":
      return 1250;
    case "teapot-whistle":
      return 850;
    case "bark":
      return 450;
    case "friday-alarm":
      return 400;
    case "level-up":
    case "fanfare":
      return 380;
    case "fda-siren":
      return 280;
    case "laser":
    case "matrix-glitch":
    default:
      return 220;
  }
}

export function playMemeSound(
  type:
    | "bark"
    | "laser"
    | "friday-alarm"
    | "matrix-glitch"
    | "teapot-whistle"
    | "modem"
    | "fda-siren"
    | "level-up"
    | "fanfare"
): void {
  const engine = getSoundEngine();
  if (!engine.isSoundAllowed()) return;

  switch (type) {
    case "bark": {
      // Stage 1: "yip" frequency pulse + air noise burst
      engine.playTone({
        frequency: 450,
        endFrequency: 360,
        duration: 0.11,
        type: "triangle",
        volume: 0.28,
      });
      engine.playNoise({
        duration: 0.09,
        volume: 0.08,
        filterType: "bandpass",
        filterFrequency: 1600,
        filterQ: 1.5,
      });

      // Stage 2: "woof" body + breath puff
      engine.playTone({
        frequency: 340,
        endFrequency: 210,
        duration: 0.22,
        delay: 0.15,
        type: "triangle",
        volume: 0.32,
      });
      engine.playNoise({
        duration: 0.18,
        delay: 0.15,
        volume: 0.07,
        filterType: "bandpass",
        filterFrequency: 1100,
        filterQ: 1.2,
      });
      break;
    }

    case "laser": {
      engine.playTone({
        frequency: 1400,
        endFrequency: 120,
        duration: 0.18,
        type: "sawtooth",
        volume: 0.25,
      });
      break;
    }

    case "friday-alarm": {
      engine.playSequence(
        [
          { frequency: 880, duration: 0.1, delay: 0 },
          { frequency: 440, duration: 0.1, delay: 0.1 },
          { frequency: 880, duration: 0.15, delay: 0.2 },
        ],
        { defaultType: "square", volume: 0.2 }
      );
      break;
    }

    case "matrix-glitch": {
      engine.playSequence(
        [
          { frequency: 300, duration: 0.04, delay: 0 },
          { frequency: 600, duration: 0.04, delay: 0.03 },
          { frequency: 450, duration: 0.04, delay: 0.06 },
          { frequency: 900, duration: 0.04, delay: 0.09 },
          { frequency: 1200, duration: 0.04, delay: 0.12 },
        ],
        { defaultType: "sawtooth", volume: 0.15 }
      );
      break;
    }

    case "teapot-whistle": {
      engine.playTone({
        frequency: 1750,
        endFrequency: 2280,
        duration: 0.8,
        type: "sine",
        volume: 0.2,
      });
      engine.playTone({
        frequency: 3500,
        endFrequency: 3800,
        duration: 0.78,
        type: "sine",
        volume: 0.04,
      });
      engine.playNoise({
        duration: 0.85,
        volume: 0.08,
        filterType: "bandpass",
        filterFrequency: 2800,
        filterQ: 1.8,
      });
      break;
    }

    case "modem": {
      // Stage 1: Answer tone
      engine.playTone({
        frequency: 2100,
        duration: 0.22,
        type: "sine",
        volume: 0.18,
      });

      // Stage 2: Dual-tone carrier negotiation chirps
      engine.playSequence(
        [
          { frequency: 980, duration: 0.08, delay: 0.24 },
          { frequency: 1650, duration: 0.08, delay: 0.32 },
          { frequency: 1300, duration: 0.08, delay: 0.4 },
          { frequency: 2100, duration: 0.08, delay: 0.48 },
        ],
        { defaultType: "sawtooth", volume: 0.14 }
      );
      engine.playSequence(
        [
          { frequency: 1180, duration: 0.08, delay: 0.24 },
          { frequency: 840, duration: 0.08, delay: 0.32 },
          { frequency: 1950, duration: 0.08, delay: 0.4 },
          { frequency: 1200, duration: 0.08, delay: 0.48 },
        ],
        { defaultType: "square", volume: 0.14 }
      );

      // Stage 3: Screeching carrier training noise
      engine.playNoise({
        duration: 0.68,
        delay: 0.56,
        volume: 0.2,
        filterType: "bandpass",
        filterFrequency: 2400,
        filterQ: 1.4,
      });
      break;
    }

    case "fda-siren": {
      engine.playTone({
        frequency: 220,
        duration: 0.25,
        type: "sawtooth",
        volume: 0.3,
      });
      break;
    }

    case "level-up":
    case "fanfare": {
      engine.playSequence(
        [
          { frequency: 523.25, duration: 0.12, delay: 0 },
          { frequency: 659.25, duration: 0.12, delay: 0.06 },
          { frequency: 783.99, duration: 0.12, delay: 0.12 },
          { frequency: 1046.5, duration: 0.12, delay: 0.18 },
        ],
        { defaultType: "square", volume: 0.18 }
      );
      break;
    }
  }
}
