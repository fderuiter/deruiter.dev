/**
 * The sounds of the Study Director office, synthesized through the shared
 * sound engine like Protocol Drift's. Each is a single short event cue; there
 * are no loops, no ambience and no hover cues. The engine owns the mute
 * switch (muted until the player turns sound on), reduced-motion and
 * forced-colors bypass, so a muted site stays silent. On touch devices
 * (`hover: none`) the footstep, the only cue that can fire many times a
 * second, is dropped.
 */
import { getSoundEngine } from "@/lib/audio";

/** The cues the office can play. */
export type WorldSoundCue =
  "footstep" | "door" | "phoneRing" | "emailChime" | "coffee" | "stamp";

/** Every cue, for the manual and for tests. */
export const WORLD_SOUND_CUES: readonly WorldSoundCue[] = [
  "footstep",
  "door",
  "phoneRing",
  "emailChime",
  "coffee",
  "stamp",
];

function touchOnly(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none)").matches
    );
  } catch {
    return false;
  }
}

/** Plays one cue unless sound is muted or bypassed. Never throws. */
export function playWorldCue(cue: WorldSoundCue): void {
  const engine = getSoundEngine();
  if (!engine.isSoundAllowed()) return;
  if (cue === "footstep" && touchOnly()) return;
  try {
    switch (cue) {
      case "footstep":
        engine.playTone({
          frequency: 110,
          type: "triangle",
          duration: 0.03,
          volume: 0.03,
        });
        return;
      case "door":
        engine.playTone({
          frequency: 196,
          endFrequency: 147,
          type: "triangle",
          duration: 0.12,
          volume: 0.05,
        });
        return;
      case "phoneRing":
        engine.playTone({
          frequency: 880,
          type: "square",
          duration: 0.08,
          volume: 0.04,
        });
        engine.playTone({
          frequency: 740,
          type: "square",
          duration: 0.08,
          volume: 0.04,
          delay: 0.12,
        });
        return;
      case "emailChime":
        engine.playTone({
          frequency: 659.25,
          type: "sine",
          duration: 0.12,
          volume: 0.05,
        });
        return;
      case "coffee":
        engine.playTone({
          frequency: 330,
          endFrequency: 220,
          type: "sine",
          duration: 0.2,
          volume: 0.05,
        });
        return;
      case "stamp":
        engine.playTone({
          frequency: 130.81,
          type: "square",
          duration: 0.06,
          volume: 0.06,
        });
        return;
    }
  } catch {
    // Audio is polish: a failure never stops the day.
  }
}
