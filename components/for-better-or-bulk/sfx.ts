/**
 * The For Better or Bulk sounds: one short synthesized recipe per sound key,
 * played through the shared SoundEngine. No sampled assets. The engine's own
 * mute (the site-wide default) decides whether anything is heard.
 */

import { getSoundEngine, type SoundEngine } from "@/lib/audio/sound-engine";
import type { SoundKey } from "./messages";

const RECIPES: Readonly<Record<SoundKey, (engine: SoundEngine) => void>> = {
  // A soft tick for one thing placed on a target.
  place: (engine) =>
    engine.playTone({
      frequency: 660,
      duration: 0.04,
      type: "sine",
      volume: 0.2,
    }),
  // A rising three-note chime for a finished category.
  category: (engine) =>
    [523, 659, 784].forEach((frequency, i) =>
      engine.playTone({
        frequency,
        duration: 0.12,
        delay: i * 0.07,
        type: "triangle",
        volume: 0.25,
      })
    ),
  // A higher, softer tick for the grill finishing.
  cooked: (engine) =>
    engine.playTone({
      frequency: 990,
      duration: 0.05,
      type: "sine",
      volume: 0.18,
    }),
  // A low thud with a little noise under it for charcoal.
  burnt: (engine) => {
    engine.playTone({
      frequency: 110,
      endFrequency: 55,
      duration: 0.16,
      type: "triangle",
      volume: 0.4,
    });
    engine.playNoise({
      duration: 0.08,
      volume: 0.15,
      filterType: "lowpass",
      filterFrequency: 250,
    });
  },
  // Two short rings of a phone.
  brothers: (engine) =>
    [0, 0.2].forEach((delay) =>
      engine.playTone({
        frequency: 988,
        duration: 0.14,
        delay,
        type: "square",
        volume: 0.12,
      })
    ),
  // A calm falling pair for Fred coming back.
  fred: (engine) =>
    [659, 523].forEach((frequency, i) =>
      engine.playTone({
        frequency,
        duration: 0.16,
        delay: i * 0.12,
        type: "sine",
        volume: 0.22,
      })
    ),
  // A four-note chime for the ceremony.
  finish: (engine) =>
    [523, 659, 784, 1047].forEach((frequency, i) =>
      engine.playTone({
        frequency,
        duration: 0.18,
        delay: i * 0.1,
        type: "triangle",
        volume: 0.28,
      })
    ),
  // A short click for an action that was blocked or had no room.
  refused: (engine) =>
    engine.playTone({
      frequency: 180,
      duration: 0.04,
      type: "square",
      volume: 0.16,
    }),
};

/**
 * Plays one named sound. Does nothing when the engine is muted or bypassed,
 * so the site-wide mute always wins.
 */
export function playSfx(key: SoundKey): void {
  const engine = getSoundEngine();
  if (!engine.isSoundAllowed()) return;
  RECIPES[key](engine);
}
