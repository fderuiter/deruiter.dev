"use client";

import React from "react";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's phone view (ADR 0062, #2917). The cabinet picks it for a
 * phone-sized screen and it shares today's phone layout until the landscape
 * pass gives it its own (#2918, #2919). A phone-sized window worked with a
 * mouse is not a touch cabinet, so it still reads the cabinet's touch state
 * and keeps the desktop controls there; the three-view guard allow-lists it
 * until then.
 */
export function PhoneView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  const touch = useCabinetTouch();
  return <LabyrinthLayout isMounted={isMounted} touch={touch} phone />;
}
