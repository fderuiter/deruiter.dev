"use client";

import React, { useSyncExternalStore } from "react";
import {
  RetroLabyrinthSessionProvider,
  useOptionalLabyrinthSession,
} from "@/components/retro-labyrinth/RetroLabyrinthSession";
import { DesktopView } from "@/components/retro-labyrinth/views/DesktopView";

const emptySubscribe = () => () => {};

interface RetroLabyrinthProps {
  isMounted?: boolean;
}

/**
 * Retro Labyrinth's room: the maze, its HUD, its cards and its controls. It
 * draws the session (#2376) it finds above it, or hosts its own, so the
 * cabinet's views share one run and a standalone room still plays.
 */
export const RetroLabyrinth: React.FC<RetroLabyrinthProps> = ({
  isMounted: propIsMounted,
}) => {
  const clientMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isMounted = propIsMounted ?? clientMounted;
  const hosted = useOptionalLabyrinthSession();
  if (hosted) return <DesktopView isMounted={isMounted} />;
  return (
    <RetroLabyrinthSessionProvider active={isMounted}>
      <DesktopView isMounted={isMounted} />
    </RetroLabyrinthSessionProvider>
  );
};
