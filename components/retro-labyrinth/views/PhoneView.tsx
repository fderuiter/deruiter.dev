"use client";

import React from "react";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's phone view (ADR 0062, #2917). The cabinet picks it for a
 * phone-sized screen, and on a touch cabinet it plays on the phone stage: a
 * one-row HUD over the d-pad column, the maze and the tool column (#2918).
 * A phone-sized window worked with a mouse is not a touch cabinet, so it
 * reads the cabinet's touch state and keeps the desktop controls there; the
 * three-view guard allow-lists it for that.
 */
export function PhoneView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  const touch = useCabinetTouch();
  return <LabyrinthLayout isMounted={isMounted} touch={touch} phone />;
}
