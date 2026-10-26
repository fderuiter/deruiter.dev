"use client";

import React from "react";
import { useCabinetTouch, usePhone } from "@/components/arcade/mobile";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's desktop view (ADR 0062, #2839): the maze at integer
 * scale, its HUD, hotbar, cards and controls. The phone has its own view
 * now (#2917); this one still reads the cabinet's touch and phone state for
 * the shared layout, which the three-view guard allow-lists until the shared
 * code is cleaned up (#2863).
 */
export function DesktopView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  const touch = useCabinetTouch();
  const phone = usePhone();
  return <LabyrinthLayout isMounted={isMounted} touch={touch} phone={phone} />;
}
