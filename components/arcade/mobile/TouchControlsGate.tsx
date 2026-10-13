"use client";

import React from "react";
import { useInputModality } from "@/components/arcade/mobile/input-modality";

export interface TouchControlsGateProps {
  children: React.ReactNode;
}

/**
 * Renders its children only while the player's last input was touch or a
 * Pencil. A keyboard case or a trackpad hides the on-screen controls, and the
 * next touch brings them back (ADR 0061).
 *
 * @param props - The on-screen controls to show while touch is in use.
 * @returns The children, or nothing while a keyboard or mouse is in use.
 */
export function TouchControlsGate({ children }: TouchControlsGateProps) {
  const modality = useInputModality();
  if (modality !== "touch" && modality !== "pen") return null;
  return <>{children}</>;
}
