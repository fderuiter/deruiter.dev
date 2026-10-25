"use client";

import React from "react";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's tablet view (ADR 0062, #2859). The cabinet picks it for
 * a coarse pointer with room to spare, so it lays out the touch cabinet with
 * the tablet stage and reads no device. It shares today's layout until the
 * landscape and portrait passes give it its own (#2860, #2861).
 */
export function TabletView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  return <LabyrinthLayout isMounted={isMounted} touch phone={false} />;
}
