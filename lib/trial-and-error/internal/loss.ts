import { POPULATION_LABELS, type PopulationType } from "../types";
import { HAND_NAMES } from "./hands";
import type { TableView } from "./table";

const listOf = (sets: readonly PopulationType[]) =>
  sets.map((p) => POPULATION_LABELS[p]).join(" and ");

/**
 * Why a Blind was lost, in one or two sentences read from the table view
 * (#1944): how far short the round fell, the best hand played, and what ran
 * out. Null unless the Blind failed, and null for a Clinical Hold, whose
 * own notice already says why.
 */
export function describeBlindLoss(view: TableView): string | null {
  if (view.outcome !== "FAILED" || view.clock?.hold) return null;
  const parts: string[] = [];
  const short = Math.max(0, view.quota - view.roundScore);
  const best = view.scoreLog.reduce<TableView["scoreLog"][number] | null>(
    (top, entry) => (top === null || entry.score > top.score ? entry : top),
    null
  );
  parts.push(
    best
      ? `${short} short. Your best hand was a ${best.name} (${best.score}).`
      : `${short} short. No hand was played.`
  );
  const limits = view.modifiers.filter(
    (m) => m.debuffType === "HAND_LIMIT" && m.maxHandsAllowed !== undefined
  );
  const tightest = limits.reduce<(typeof limits)[number] | null>(
    (top, m) =>
      top === null || (m.maxHandsAllowed ?? 0) < (top.maxHandsAllowed ?? 0)
        ? m
        : top,
    null
  );
  if (tightest && view.handsLeft === 0) {
    const n = tightest.maxHandsAllowed ?? 0;
    parts.push(`${tightest.name} left ${n} hand${n === 1 ? "" : "s"}.`);
  } else if (view.hand.length === 0) {
    parts.push("The deck ran out of outputs.");
  } else if (view.stranded) {
    parts.push(
      `The deck ran out, and no ${view.stranded.map((h) => HAND_NAMES[h]).join(" or ")} could be formed from the cards left.`
    );
  } else {
    parts.push("The CPU ran out before another hand.");
  }
  for (const m of view.modifiers) {
    if (m.debuffType !== "DISABLE_POPULATION") continue;
    const off = new Set(m.disabledPopulations ?? []);
    if (off.size === 0) continue;
    const kept = (Object.keys(POPULATION_LABELS) as PopulationType[]).filter(
      (p) => !off.has(p)
    );
    // Name the shorter list: "counted only Safety outputs" reads better than
    // four zeroed sets.
    parts.push(
      kept.length > 0 && kept.length < off.size
        ? `${m.name} counted only ${listOf(kept)} outputs.`
        : `${m.name} zeroed ${listOf([...off])} outputs.`
    );
  }
  return parts.join(" ");
}
