/**
 * The ceremony playback: about thirty seconds of scripted scenes assembled
 * from the final state. Pure, so the same ending always plays the same scenes.
 * The lanterns scene appears only when lantern targets were hung, and the
 * guest in stilettos appears only when the FAQ was missing.
 */

import { bankText, type GameState } from "@/lib/for-better-or-bulk";
import { clamp } from "@/lib/game-utils";
import { noFaq } from "./jokes";

/** One scene: a heading, one line of copy from the bank, and how long it holds. */
export interface PlaybackScene {
  readonly id: string;
  readonly heading: string;
  readonly line: string;
  readonly seconds: number;
}

/** The shortest a scene holds on screen, in milliseconds, however fast the game runs. */
const MIN_SCENE_MS = 1500;

/** True when at least one lantern target was hung. */
function lanternsHung(state: GameState): boolean {
  return state.targets.some(
    (target) => target.category === "lanterns" && target.status === "filled"
  );
}

/**
 * How long one scene holds on screen, in milliseconds, at the game's speed.
 * The scene's seconds are game-clock figures, so a faster game shortens them,
 * down to a floor that keeps each line readable.
 */
export function sceneMillis(scene: PlaybackScene, speed: number): number {
  const gameSpeed = clamp(speed, 1, 8);
  return Math.max(MIN_SCENE_MS, (scene.seconds * 1000) / gameSpeed);
}

/**
 * The scenes for one ending, in playing order. The weather and the rented
 * tux come first, then the coat room, the guests, the buffet, dusk when
 * lanterns hung, and a closing line from the real facts. With no FAQ, the
 * guest in stilettos sinks in during the ceremony itself.
 */
export function ceremonyScenes(state: GameState): readonly PlaybackScene[] {
  const sinking = noFaq(state);
  const scenes: PlaybackScene[] = [
    {
      id: "ceremony",
      heading: bankText("scene-ceremony"),
      line: sinking
        ? `${bankText("weather")} ${bankText("joke-sink")}`
        : bankText("weather"),
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
      line: sinking ? bankText("guests-seated") : bankText("joke-faq"),
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
