import React from "react";
import { RELIC_RARITY_LABELS, type RelicRarity } from "@/lib/trial-and-error";

/** A distinct mark per rarity, so rarity never rests on colour alone. */
const RARITY_MARKS: Readonly<Record<RelicRarity, string>> = {
  COMMON: "●",
  UNCOMMON: "◆",
  RARE: "★",
};

const RARITY_STYLES: Readonly<Record<RelicRarity, string>> = {
  COMMON: "border-slate-500 text-slate-300",
  UNCOMMON: "border-emerald-500/70 text-emerald-300",
  RARE: "border-amber-400 border-double text-amber-300",
};

/**
 * A relic's rarity (#2083) as the shop and pack reveal print it: a mark and
 * the word, so it reads without colour.
 */
export function RarityBadge({ rarity }: { rarity: RelicRarity }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 border px-1.5 text-[10px] font-bold uppercase tracking-wider ${RARITY_STYLES[rarity]}`}
      data-testid="relic-rarity"
      data-rarity={rarity}
    >
      <span aria-hidden="true">{RARITY_MARKS[rarity]}</span>
      {RELIC_RARITY_LABELS[rarity]}
    </span>
  );
}
