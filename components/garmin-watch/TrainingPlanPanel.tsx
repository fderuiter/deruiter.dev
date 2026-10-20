"use client";

import React, { useEffect } from "react";
import {
  BAG_SIZE,
  GEAR_ITEMS,
  GEAR_ITEM_NAMES,
  PLAN_NODES,
  type GearItem,
  nextWorkout,
  nodeLabel,
  nodeStatus,
  trainingReadiness,
  type PlanNodeId,
  type PlanSave,
} from "@/lib/garmin/plan";
import { CARDS_PER_SET, FINISHER_CARD_NAMES } from "@/lib/garmin/finisher";
import { GearBagDialog } from "./GearBagDialog";

interface TrainingPlanPanelProps {
  /** The plan, or null before it has been read from storage. */
  save: PlanSave | null;
  /** Nodes can't be entered while a run is playing or paused. */
  locked: boolean;
  onChoose: (id: PlanNodeId) => void;
  onNewPlan: () => void;
  /** The gear bag dialog is open (#1995). */
  bagOpen: boolean;
  onOpenBag: () => void;
  onCloseBag: () => void;
  onUseItem: (item: GearItem) => void;
  onUnpackItem: (item: GearItem) => void;
}

const STATUS_CLASS = {
  locked: "border-white/[0.06] bg-[#0d0e11] text-zinc-500",
  open: "border-cyan-400/40 bg-[#0d0e11] text-zinc-100 hover:bg-white/[0.04]",
  cleared:
    "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-100 hover:bg-emerald-500/[0.14]",
} as const;

/**
 * The Training Plan in the companion panel (#1994): the Morning Report in
 * words, every node of the map as a button with its full label, the gear bag
 * and "New plan". The watch face draws the same map for the arrow keys.
 */
export function TrainingPlanPanel({
  save,
  locked,
  onChoose,
  onNewPlan,
  bagOpen,
  onOpenBag,
  onCloseBag,
  onUseItem,
  onUnpackItem,
}: TrainingPlanPanelProps) {
  // A run starting by any route (START, the setup wizard, a workout) closes
  // the bag, so it doesn't open again over the next result.
  useEffect(() => {
    if (locked && bagOpen) onCloseBag();
  }, [locked, bagOpen, onCloseBag]);
  if (!save) {
    return <p className="text-[10px] text-zinc-400">Loading your plan…</p>;
  }
  const ready = trainingReadiness(save);
  const next = nextWorkout(save);
  const counts = GEAR_ITEMS.map((item) => ({
    item,
    n: save.bag.filter((b) => b === item).length,
  })).filter((c) => c.n > 0);
  const handleNewPlan = () => {
    if (
      typeof window.confirm === "function" &&
      !window.confirm("Start a new plan? Your map, lives, score and bag reset.")
    ) {
      return;
    }
    onNewPlan();
  };
  return (
    <div className="grid min-w-0 gap-2" data-testid="training-plan-panel">
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">
        Morning Report
      </p>
      <p className="text-[11px] text-zinc-200">
        Training Readiness{" "}
        <span className="tabular-nums text-zinc-50">{ready.score}</span> ·{" "}
        {ready.level}.{" "}
        {next
          ? `Next workout: ${next.name}, ${next.day}.`
          : save.finished
            ? "Plan complete: finisher medal won."
            : "Next: a Recovery Hut."}
      </p>
      <p className="text-[10px] tabular-nums text-zinc-400">
        Lives {save.lives} · Continues {save.continues} · Score {save.score}
        {save.finished ? " · Finisher medal" : ""}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">Map</p>
      <ol aria-label="Training Plan map" className="grid min-w-0 gap-1.5">
        {PLAN_NODES.map((node) => {
          const status = nodeStatus(save, node.id);
          const disabled = locked || status === "locked";
          return (
            <li key={node.id} className="min-w-0">
              <button
                type="button"
                aria-label={nodeLabel(save, node.id)}
                aria-current={save.cursor === node.id ? "true" : undefined}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => onChoose(node.id)}
                className={`flex min-h-[32px] w-full min-w-0 items-center justify-between gap-2 rounded-md border px-2 text-left text-[11px] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${STATUS_CLASS[status]}`}
              >
                <span className="min-w-0 truncate">
                  {node.name}
                  <span className="text-zinc-400">
                    {" "}
                    · W{node.week} {node.day.slice(0, 3)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[10px] uppercase"
                >
                  {status === "cleared"
                    ? node.kind === "hut"
                      ? "Visited"
                      : "Practice"
                    : status === "open"
                      ? "Open"
                      : "Locked"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">
        Gear bag · {save.bag.length + save.packed.length}/{BAG_SIZE}
      </p>
      {counts.length === 0 ? (
        <p className="text-[10px] text-zinc-400">
          Empty. Recovery Huts each give one item.
        </p>
      ) : (
        <ul aria-label="Gear bag" className="grid gap-0.5 text-[11px]">
          {counts.map(({ item, n }) => (
            <li key={item} className="text-zinc-200">
              {GEAR_ITEM_NAMES[item]}
              {n > 1 ? ` × ${n}` : ""}
            </li>
          ))}
        </ul>
      )}
      {save.packed.length > 0 && (
        <p className="text-[10px] text-amber-200">
          Packed: {save.packed.map((item) => GEAR_ITEM_NAMES[item]).join(", ")}
        </p>
      )}
      <p className="text-[10px] text-zinc-400">
        Finisher cards ·{" "}
        {save.cards.length === 0
          ? "none yet. Each workout's finish pole gives one; three pay out lives."
          : `${save.cards.map((c) => FINISHER_CARD_NAMES[c]).join(", ")} (${save.cards.length}/${CARDS_PER_SET})`}
      </p>
      <button
        type="button"
        onClick={onOpenBag}
        disabled={locked}
        aria-haspopup="dialog"
        className="min-h-[32px] rounded-md border border-white/[0.08] bg-[#0d0e11] px-2 text-[11px] text-zinc-100 hover:bg-white/[0.04] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
      >
        Open gear bag (X)
      </button>
      {bagOpen && !locked && (
        <GearBagDialog
          save={save}
          onClose={onCloseBag}
          onUseItem={onUseItem}
          onUnpackItem={onUnpackItem}
        />
      )}
      <button
        type="button"
        onClick={handleNewPlan}
        disabled={locked}
        className="min-h-[32px] rounded-md border border-white/[0.08] bg-[#0d0e11] px-2 text-[11px] text-zinc-300 hover:bg-white/[0.04] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
      >
        New plan
      </button>
    </div>
  );
}
