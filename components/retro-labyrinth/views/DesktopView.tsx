"use client";

import React from "react";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's desktop view (ADR 0062, #2839): the maze at integer
 * scale, its HUD, hotbar, cards and controls. It reads no device (#2966): a
 * touch player who picks the Desktop layout gets this layout too, which keeps
 * the footer's touch d-pad and the tappable hotbar.
 */
export function DesktopView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  return <LabyrinthLayout isMounted={isMounted} touch={false} phone={false} />;
}
