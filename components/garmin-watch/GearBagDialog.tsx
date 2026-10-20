"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { GEAR_ITEM_EFFECTS, bagCheck, restDayTargets } from "@/lib/garmin/bag";
import {
  BAG_SIZE,
  GEAR_ITEMS,
  GEAR_ITEM_NAMES,
  planNode,
  type GearItem,
  type PlanSave,
} from "@/lib/garmin/plan";

interface GearBagDialogProps {
  save: PlanSave;
  onClose: () => void;
  onUseItem: (item: GearItem) => void;
  onUnpackItem: (item: GearItem) => void;
}

const BUTTON_CLASS =
  "min-h-[32px] shrink-0 rounded-md border border-white/[0.08] bg-[#13151a] px-2 text-[11px] text-zinc-100 hover:bg-white/[0.04] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50";

/**
 * The gear bag (#1995): a modal list of what the bag holds, each item with
 * what it does and a button to pack it (or take a Rest Day), and the items
 * packed for the next workout with a button to put each back. Focus moves to
 * the heading as it opens, stays inside while it is open, and goes back to
 * where it was on Close or Escape.
 */
export function GearBagDialog({
  save,
  onClose,
  onUseItem,
  onUnpackItem,
}: GearBagDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: headingRef,
    onEscape: onClose,
  });
  // Focus the heading as the bag opens. This runs after the trap has noted
  // the element focused before (the watch or the panel's button) as the place
  // to return focus to; the trap's own first focus waits 50 ms.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const headingId = useId();
  // Packing or unpacking can remove the button that was pressed, so focus
  // goes back to the heading rather than being lost to the page.
  const handleUse = (item: GearItem) => {
    onUseItem(item);
    headingRef.current?.focus({ preventScroll: true });
  };
  const handleUnpack = (item: GearItem) => {
    onUnpackItem(item);
    headingRef.current?.focus({ preventScroll: true });
  };
  const counts = GEAR_ITEMS.map((item) => ({
    item,
    n: save.bag.filter((b) => b === item).length,
  })).filter((c) => c.n > 0);
  const restDay = restDayTargets(save)
    .map((id) => planNode(id).name)
    .join(" and ");
  // The bag counts packed gear too, so a packed item always fits back.
  const held = save.bag.length + save.packed.length;

  // Portaled out of the simulator: its container query would place a fixed
  // overlay inside the simulator rather than the viewport. In fullscreen it
  // goes to the fullscreen element, which is the only thing showing.
  const host =
    typeof document === "undefined"
      ? null
      : ((document.fullscreenElement as HTMLElement | null) ?? document.body);
  if (!host) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="gear-bag-dialog"
        onKeyDown={(e) => {
          // The action key that opened the bag closes it too.
          if (e.key === "x" || e.key === "X") {
            e.preventDefault();
            onClose();
          }
        }}
        className="grid max-h-[90dvh] w-full max-w-sm min-w-0 gap-3 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0d0e11] p-4 text-zinc-200"
      >
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-[13px] font-medium text-zinc-50 focus:outline-none"
        >
          Gear bag · {held}/{BAG_SIZE}
        </h2>
        {counts.length === 0 ? (
          <p className="text-[11px] text-zinc-400">
            Empty. Each Recovery Hut gives one item.
          </p>
        ) : (
          <ul aria-label="Items in the bag" className="grid min-w-0 gap-2">
            {counts.map(({ item, n }) => {
              const check = bagCheck(save, item);
              const reasonId = `${headingId}-${item}`;
              return (
                <li
                  key={item}
                  className="flex min-w-0 items-start justify-between gap-2 rounded-md border border-white/[0.06] p-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] text-zinc-50">
                      {GEAR_ITEM_NAMES[item]}
                      {n > 1 ? ` × ${n}` : ""}
                    </p>
                    <p id={reasonId} className="text-[11px] text-zinc-400">
                      {item === "restday" && restDay
                        ? `Opens ${restDay} without running the workout before ${restDay.includes(" and ") ? "them" : "it"}.`
                        : GEAR_ITEM_EFFECTS[item]}
                      {check.reason ? ` ${check.reason}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!check.ok}
                    aria-describedby={reasonId}
                    onClick={() => handleUse(item)}
                    className={BUTTON_CLASS}
                  >
                    {item === "restday"
                      ? `Take ${GEAR_ITEM_NAMES[item]}`
                      : `Pack ${GEAR_ITEM_NAMES[item]}`}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">
          Packed for the next workout
        </p>
        {save.packed.length === 0 ? (
          <p className="text-[11px] text-zinc-400">
            Nothing. Packed gear goes with your next new workout. Practice runs
            and Race Day leave it packed.
          </p>
        ) : (
          <ul aria-label="Packed gear" className="grid min-w-0 gap-1.5">
            {save.packed.map((item) => (
              <li
                key={item}
                className="flex min-w-0 items-center justify-between gap-2"
              >
                <span className="min-w-0 text-[12px] text-zinc-100">
                  {GEAR_ITEM_NAMES[item]}
                </span>
                <button
                  type="button"
                  onClick={() => handleUnpack(item)}
                  className={BUTTON_CLASS}
                >
                  Unpack {GEAR_ITEM_NAMES[item]}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          data-testid="gear-bag-close"
          className={BUTTON_CLASS}
        >
          Close
        </button>
      </div>
    </div>,
    host
  );
}
