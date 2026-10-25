"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  CabinetPauseProvider,
  useCabinetPauseController,
} from "@/components/arcade/pause";
import {
  useRetroLabyrinthSession,
  type RetroLabyrinthSession,
} from "./useRetroLabyrinthSession";

/** The session, and whether the cabinet shows the pause overlay. */
interface LabyrinthSessionValue {
  readonly session: RetroLabyrinthSession;
  /**
   * True inside a cabinet with views (ADR 0062), whose shared pause overlay
   * stands in for the room's own pause card.
   */
  readonly cabinetPause: boolean;
}

const LabyrinthSessionContext = createContext<LabyrinthSessionValue | null>(
  null
);

/** Props for {@link RetroLabyrinthSessionProvider}. */
interface RetroLabyrinthSessionProviderProps {
  /** Whether the loop runs. Defaults to true. */
  readonly active?: boolean;
  /** Whether the cabinet shows the pause overlay. Defaults to false. */
  readonly cabinetPause?: boolean;
  readonly children: ReactNode;
}

/**
 * Hosts Retro Labyrinth's session (#2376) for the views inside it, so a view
 * swap keeps the run. The host reads the player's motion preference and
 * passes it in; the session itself never reads the device. Outside a cabinet
 * it provides a pause controller of its own, so the session and the maze
 * canvas, which pauses on a lost context, share one.
 */
export function RetroLabyrinthSessionProvider({
  active = true,
  cabinetPause = false,
  children,
}: RetroLabyrinthSessionProviderProps) {
  const controller = useCabinetPauseController();
  return (
    <CabinetPauseProvider controller={controller}>
      <SessionHost active={active} cabinetPause={cabinetPause}>
        {children}
      </SessionHost>
    </CabinetPauseProvider>
  );
}

function SessionHost({
  active,
  cabinetPause,
  children,
}: Required<Omit<RetroLabyrinthSessionProviderProps, "children">> & {
  readonly children: ReactNode;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const session = useRetroLabyrinthSession({ active, reducedMotion });
  return (
    <LabyrinthSessionContext.Provider value={{ session, cabinetPause }}>
      {children}
    </LabyrinthSessionContext.Provider>
  );
}

/**
 * The session slot of the game's views (`defineGameViews`): the cabinet
 * shows its own pause overlay, so the room's pause card stays hidden.
 */
export function RetroLabyrinthCabinetSession({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <RetroLabyrinthSessionProvider cabinetPause>
      {children}
    </RetroLabyrinthSessionProvider>
  );
}

/**
 * The nearest Retro Labyrinth session, or null outside one.
 *
 * @returns The session and its host's pause setting, or null.
 */
export function useOptionalLabyrinthSession(): LabyrinthSessionValue | null {
  return useContext(LabyrinthSessionContext);
}

/**
 * The session of the room a part sits in. Parts of the room render only
 * inside a session, so this throws outside one.
 *
 * @returns The session and its host's pause setting.
 */
export function useLabyrinthSession(): LabyrinthSessionValue {
  const value = useContext(LabyrinthSessionContext);
  if (!value) {
    throw new Error("A Retro Labyrinth part rendered outside its session.");
  }
  return value;
}
