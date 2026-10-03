"use client";

import { createContext, useContext } from "react";
import type { GameSetupConfig } from "@/components/arcade/PreGameSetupWizard";

/**
 * What a cabinet tells the game it hosts about the Pre-Game Setup Wizard.
 *
 * `runRevision` increments every time the player confirms setup (START GAME),
 * so a game can tell "a new run was requested with this config" apart from
 * "the config was already applied". `isSetupOpen` is true while the wizard
 * overlay is showing, so a game can pause itself underneath it.
 *
 * `skipTitleScreen` is the one-title-screen rule (#1516): the cabinet's
 * attract screen already showed the game's title, art and Launch button, so
 * a game that reads it as true goes straight to play (or a short intro)
 * instead of drawing a second start screen of its own.
 */
interface CabinetSetupValue {
  config: GameSetupConfig;
  runRevision: number;
  isSetupOpen: boolean;
  skipTitleScreen: boolean;
}

export const CabinetSetupContext = createContext<CabinetSetupValue | null>(
  null
);

/** Returns the hosting cabinet's setup state, or null outside a cabinet. */
export function useCabinetSetup(): CabinetSetupValue | null {
  return useContext(CabinetSetupContext);
}

/**
 * True when the game is inside a cabinet whose attract screen served as its
 * title screen, so the game should skip its own. False outside a cabinet,
 * where a standalone game keeps its title screen.
 */
export function useSkipTitleScreen(): boolean {
  return useContext(CabinetSetupContext)?.skipTitleScreen ?? false;
}
