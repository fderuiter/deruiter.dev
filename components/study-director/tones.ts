import type { Urgency } from "@/lib/study-director";

/** Border and text colour for an urgency badge. */
export const URGENCY_TONE: Record<Urgency, string> = {
  critical: "border-red-500/60 text-red-400",
  important: "border-amber-500/60 text-amber-400",
  routine: "border-zinc-700 text-zinc-400",
};

/** Left accent stripe for an inbox row. */
export const URGENCY_STRIPE: Record<Urgency, string> = {
  critical: "before:bg-red-500",
  important: "before:bg-amber-500",
  routine: "before:bg-zinc-700",
};
