"use client";

import React from "react";
import { useCabinetTouch, usePhone } from "@/components/arcade/mobile";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's desktop view (ADR 0062, #2839): the maze at integer
 * scale, its HUD, hotbar, cards and controls. The phone still resolves to
 * this view until its own lands (#2379), so it reads the cabinet's touch and
 * phone state for the shared layout; the three-view guard allow-lists it
 * until then (#2863).
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
