/**
 * Six procedural cues for Protocol Drift, synthesized through the shared
 * sound engine. They live beside the components rather than in
 * `lib/protocol-drift/` because the engine module must stay free of DOM and
 * Web Audio imports (the simulation worker imports it). The sound engine
 * owns the global mute toggle, so a muted site stays silent. There are no
 * hover cues and no external media files.
 */
import { getSoundEngine } from "@/lib/audio";

/** The cues the workbench can play. */
export type ProtocolDriftSoundCue =
  | "eventStep"
  | "queryAlert"
  | "sourceCorrect"
  | "gatePass"
  | "wireSnap"
  | "rejectCollision";

/** Plays one cue unless sound is muted or bypassed. */
export function playProtocolCue(cue: ProtocolDriftSoundCue): void {
  const engine = getSoundEngine();
  if (!engine.isSoundAllowed()) return;
  switch (cue) {
    case "eventStep":
      engine.playTone({
        frequency: 440,
        type: "sine",
        duration: 0.04,
        volume: 0.05,
      });
      return;
    case "queryAlert":
      engine.playTone({
        frequency: 293.66,
        type: "sawtooth",
        duration: 0.15,
        volume: 0.08,
      });
      return;
    case "sourceCorrect":
      engine.playTone({
        frequency: 659.25,
        type: "triangle",
        duration: 0.08,
        volume: 0.06,
      });
      return;
    case "gatePass":
      engine.playTone({
        frequency: 880,
        endFrequency: 1100,
        rampType: "exponential",
        duration: 0.22,
        volume: 0.1,
      });
      return;
    case "wireSnap":
      engine.playTone({
        frequency: 523.25,
        type: "sine",
        duration: 0.05,
        volume: 0.04,
      });
      return;
    case "rejectCollision":
      engine.playTone({
        frequency: 196,
        type: "square",
        duration: 0.12,
        volume: 0.07,
      });
      return;
  }
}
