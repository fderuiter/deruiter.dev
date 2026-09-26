/** CPU cycles each workbench action costs. Allocating a shell and applying a footnote seal are free. */
export const CPU_COSTS = Object.freeze({
  PLAY_HAND: 2,
  DISCARD: 1,
  INSPECT: 1,
  /** Rerun a stale output against the current population snapshot. */
  RECOMPILE: 2,
});

/** An action that consumes CPU. */
export type CpuAction = keyof typeof CPU_COSTS;

/** Remaining and consumed CPU for the current Blind. */
export interface CpuLedger {
  available: number;
  spent: number;
}

/**
 * Events the CPU reducer understands. `SPEND` pays for one action, plus any
 * `surcharge` a Blind modifier adds (a site audit's discard penalty); a
 * `free` spend waives the action's own cost but not the surcharge (an SOP
 * relic's free discard, #924);
 * `REPLENISH` refills the ledger to the Blind's allocation, which happens
 * once, deterministically, when each Blind starts; `ADJUST` applies a crisis
 * choice's CPU change, never below zero.
 */
export type CpuEvent =
  | { type: "SPEND"; action: CpuAction; surcharge?: number; free?: boolean }
  | { type: "REPLENISH"; available: number }
  | { type: "ADJUST"; delta: number };

/** What an action costs with a modifier's surcharge, or only the surcharge when free. */
export function costOf(action: CpuAction, surcharge = 0, free = false): number {
  return (free ? 0 : CPU_COSTS[action]) + Math.max(0, Math.trunc(surcharge));
}

/** Whether the ledger can pay for an action and its surcharge. */
export function canAfford(
  ledger: CpuLedger,
  action: CpuAction,
  surcharge = 0,
  free = false
): boolean {
  return ledger.available >= costOf(action, surcharge, free);
}

/**
 * Pure CPU reducer. An unaffordable spend returns the same ledger object, so
 * callers can detect the refusal by identity.
 */
export function cpuReducer(ledger: CpuLedger, event: CpuEvent): CpuLedger {
  if (event.type === "REPLENISH") {
    return { available: Math.max(0, Math.trunc(event.available)), spent: 0 };
  }
  if (event.type === "ADJUST") {
    const available = Math.max(0, ledger.available + Math.trunc(event.delta));
    return {
      available,
      spent: ledger.spent + Math.max(0, ledger.available - available),
    };
  }
  if (!canAfford(ledger, event.action, event.surcharge, event.free)) {
    return ledger;
  }
  const cost = costOf(event.action, event.surcharge, event.free);
  return { available: ledger.available - cost, spent: ledger.spent + cost };
}
