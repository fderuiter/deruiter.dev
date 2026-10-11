/**
 * The ceremony playback: about thirty seconds of scripted scenes assembled
 * from the final state. Pure, so the same ending always plays the same scenes.
 * The lanterns scene appears only when lantern targets were hung, and the
 * guest in stilettos appears only when the FAQ was missing.
 */

import { bankText, type GameState } from "@/lib/for-better-or-bulk";
import { noFaq } from "./jokes";

/** One scene: a heading, one line of copy from the bank, and how long it holds. */
export interface PlaybackScene {
  readonly id: string;
  readonly heading: string;
  readonly line: string;
  readonly seconds: number;
}

/** True when at least one lantern target was hung. */
export function lanternsHung(state: GameState): boolean {
  return state.targets.some(
    (target) => target.category === "lanterns" && target.status === "filled"
  );
}

/**
 * The scenes for one ending, in playing order. The weather and the rented
 * tux come first, then the coat room, the guests, the buffet, dusk when
 * lanterns hung, and a closing line from the real facts.
 */
export function ceremonyScenes(state: GameState): readonly PlaybackScene[] {
  const scenes: PlaybackScene[] = [
    {
      id: "ceremony",
      heading: bankText("scene-ceremony"),
      line: bankText("weather"),
      seconds: 5,
    },
    {
      id: "tux",
      heading: bankText("scene-tux"),
      line: bankText("suit"),
      seconds: 4,
    },
    {
      id: "coat-room",
      heading: bankText("scene-coat"),
      line: bankText("joke-suit"),
      seconds: 4,
    },
    {
      id: "guests",
      heading: bankText("scene-guests"),
      line: noFaq(state) ? bankText("joke-sink") : bankText("joke-faq"),
      seconds: 5,
    },
    {
      id: "buffet",
      heading: bankText("scene-buffet"),
      line: bankText("dinner"),
      seconds: 6,
    },
  ];
  if (lanternsHung(state)) {
    scenes.push({
      id: "dusk",
      heading: bankText("scene-dusk"),
      line: bankText("joke-lanterns"),
      seconds: 5,
    });
  }
  scenes.push({
    id: "after",
    heading: bankText("scene-after"),
    line: bankText("goal"),
    seconds: 3,
  });
  return scenes;
}

/** The whole playback's length in seconds, from its scenes. */
export function playbackSeconds(scenes: readonly PlaybackScene[]): number {
  return scenes.reduce((sum, scene) => sum + scene.seconds, 0);
}
