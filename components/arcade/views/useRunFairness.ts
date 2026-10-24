"use client";

import { useEffect } from "react";
import type { FormFactor, RunFairness } from "@/lib/arcade";
import { useInputModality } from "@/components/arcade/mobile/input-modality";

/**
 * Notes the view and the player's input on a run's fairness record (#2547).
 * Call it in each of a game's views with that view's form factor: the view
 * mounts on a swap, so the record hears the new view, and it hears every
 * input change while the view is up. Tuning reads `fairness.assists()`,
 * which keys on the input and never on the view.
 *
 * @param fairness - The session's record, or undefined for none.
 * @param view - The form factor of the view calling it.
 */
export function useRunFairness(
  fairness: RunFairness | undefined,
  view: FormFactor
): void {
  const input = useInputModality();
  useEffect(() => {
    fairness?.noteView(view);
  }, [fairness, view]);
  useEffect(() => {
    fairness?.noteInput(input);
  }, [fairness, input]);
}
