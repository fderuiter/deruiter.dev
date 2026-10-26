"use client";

import React from "react";
import { LabyrinthLayout } from "@/components/retro-labyrinth/parts/LabyrinthLayout";

/**
 * Retro Labyrinth's phone view (ADR 0062, #2917). The cabinet picks it for a
 * phone, so it lays out the touch cabinet with the phone stage and reads no
 * device. It shares today's phone layout until the landscape pass gives it
 * its own (#2918, #2919).
 */
export function PhoneView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  return <LabyrinthLayout isMounted={isMounted} touch phone />;
}
