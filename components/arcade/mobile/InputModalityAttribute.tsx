"use client";

import { useEffect, type RefObject } from "react";
import { useInputModality } from "@/components/arcade/mobile/input-modality";

/**
 * Mirrors the player's input modality onto the immersive cabinet root as
 * `data-input-modality`. Rendered only while the cabinet is immersive, so a
 * desktop cabinet attaches no modality listeners and does not re-render on
 * modality changes (ADR 0061).
 *
 * @param props - The cabinet root to write the attribute onto.
 * @returns Nothing; it only writes the attribute.
 */
export function InputModalityAttribute({
  targetRef,
}: {
  targetRef: RefObject<HTMLElement | null>;
}) {
  const modality = useInputModality();
  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;
    element.setAttribute("data-input-modality", modality);
    return () => element.removeAttribute("data-input-modality");
  }, [modality, targetRef]);
  return null;
}
