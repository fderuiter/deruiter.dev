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
 */
interface CabinetSetupValue {
  config: GameSetupConfig;
  runRevision: number;
  isSetupOpen: boolean;
}

export const CabinetSetupContext = createContext<CabinetSetupValue | null>(
  null
);

/** Returns the hosting cabinet's setup state, or null outside a cabinet. */
export function useCabinetSetup(): CabinetSetupValue | null {
  return useContext(CabinetSetupContext);
}
