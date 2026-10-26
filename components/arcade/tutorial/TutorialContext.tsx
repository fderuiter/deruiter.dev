"use client";

import { createContext, useContext } from "react";

/** What a game sees of the cabinet's tutorial (#2972). */
export interface CabinetTutorialValue {
  /** True while a tutorial run is on screen, so the game can keep it safe. */
  readonly active: boolean;
  /** The current step's id while active, so a game can stage a step. */
  readonly stepId: string | null;
  /**
   * Tells the tutorial the player did something, such as `fire`. Cheap to
   * call from a game loop: a signal the current step does not wait for is
   * dropped without a render.
   */
  readonly signal: (name: string) => void;
}

const NO_TUTORIAL: CabinetTutorialValue = Object.freeze({
  active: false,
  stepId: null,
  signal: () => {},
});

/**
 * The cabinet's tutorial. Outside a cabinet, or in a cabinet whose game has
 * no tutorial, it is inactive and its signal does nothing.
 */
export const CabinetTutorialContext =
  createContext<CabinetTutorialValue>(NO_TUTORIAL);

/**
 * The cabinet's tutorial, for a game: whether one is running, its step, and
 * the signal to send when the player does what a practice step asks.
 *
 * @returns The tutorial as the game sees it.
 */
export function useCabinetTutorial(): CabinetTutorialValue {
  return useContext(CabinetTutorialContext);
}
