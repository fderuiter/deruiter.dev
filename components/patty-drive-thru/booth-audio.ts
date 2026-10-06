import type { ShiftEvent } from "@/lib/patty-drive-thru";
import type { SequenceNote, SoundEngine } from "@/lib/audio/sound-engine";

/** The headset is in the left ear (ADR 0059, decision 8). */
export const HEADSET_PAN = -0.85;
/** The kitchen, the dispenser and the manager are on the right. */
export const KITCHEN_PAN = 0.75;
/** The register sits just right of centre. */
const REGISTER_PAN = 0.1;

/** The cue for one shift event, or null for events that stay silent. */
export function cueFor(event: ShiftEvent): SequenceNote[] | null {
  switch (event.type) {
    case "order-arrived":
      return [
        { frequency: 988, duration: 0.09, type: "sine", pan: HEADSET_PAN },
        {
          frequency: 740,
          duration: 0.14,
          delay: 0.1,
          type: "sine",
          pan: HEADSET_PAN,
        },
      ];
    case "order-expired":
      return [
        {
          frequency: 260,
          endFrequency: 90,
          duration: 0.6,
          type: "triangle",
          volume: 0.35,
          pan: HEADSET_PAN,
        },
      ];
    case "manager-yell":
      return [
        {
          frequency: 120,
          duration: 0.22,
          type: "sawtooth",
          volume: 0.3,
          pan: KITCHEN_PAN,
        },
        {
          frequency: 96,
          duration: 0.3,
          delay: 0.2,
          type: "sawtooth",
          volume: 0.3,
          pan: KITCHEN_PAN,
        },
      ];
    case "drink-dropped":
      return [0, 0.12, 0.24].map((delay) => ({
        frequency: 1320,
        duration: 0.07,
        delay,
        type: "square" as const,
        volume: 0.2,
        pan: KITCHEN_PAN,
      }));
    case "coworker-ready":
      return [
        { frequency: 1568, duration: 0.18, type: "sine", pan: KITCHEN_PAN },
      ];
    case "locked":
    case "wrong-entry":
      return [
        {
          frequency: 196,
          duration: 0.18,
          type: "square",
          volume: 0.25,
          pan: REGISTER_PAN,
        },
      ];
    case "item-rung":
    case "drink-reentered":
      return [
        {
          frequency: 1046,
          duration: 0.05,
          type: "square",
          volume: 0.15,
          pan: REGISTER_PAN,
        },
      ];
    case "bumped":
      return [
        {
          frequency: event.band === "red" ? 330 : 660,
          duration: 0.12,
          type: "triangle",
          pan: REGISTER_PAN,
        },
      ];
    case "shift-ended":
      return [
        { frequency: 523, duration: 0.12, type: "square", volume: 0.2 },
        {
          frequency: 392,
          duration: 0.3,
          delay: 0.14,
          type: "square",
          volume: 0.2,
        },
      ];
    default:
      return null;
  }
}

/**
 * Plays the cues for a batch of shift events through the site's sound
 * engine, which owns muting, volume and the accessibility bypass. Touch
 * devices without hover get no booth audio (AGENTS.md section 16).
 */
export function playShiftEvents(
  events: readonly ShiftEvent[],
  engine: Pick<SoundEngine, "playSequence" | "playNoise">,
  hoverNone: boolean
): void {
  if (hoverNone) return;
  for (const event of events) {
    if (event.type === "wiped") {
      engine.playNoise({
        duration: 0.25,
        volume: 0.12,
        filterType: "bandpass",
        filterFrequency: 2400,
        pan: REGISTER_PAN,
      });
      continue;
    }
    const cue = cueFor(event);
    if (cue) engine.playSequence(cue);
  }
}
