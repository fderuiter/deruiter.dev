"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { clamp } from "@/lib/game-utils";
import {
  useCabinetPauseController,
  type PauseController,
} from "@/components/arcade/pause";
import { inertOthers } from "./inert-others";

/** Where a sheet rests: a peek over the stage, half the screen, or most of it. */
export type SheetSnap = "peek" | "half" | "full";

const SNAPS: readonly SheetSnap[] = ["peek", "half", "full"];

/** Each snap's height, as a share of the viewport. */
const SNAP_SHARE: Record<SheetSnap, number> = {
  peek: 0.3,
  half: 0.55,
  full: 0.92,
};

const SNAP_LABEL: Record<SheetSnap, string> = {
  peek: "peek",
  half: "half height",
  full: "full height",
};

/** A drag shorter than this is a tap on the handle. */
const DRAG_SLOP_PX = 8;

/** Props for {@link BottomSheet}. */
export interface BottomSheetProps {
  /** Whether the sheet shows. Nothing renders while it is closed. */
  open: boolean;
  /** Called by Escape, the close button, the backdrop and a drag off the bottom. */
  onClose: () => void;
  /** The sheet's heading, also its accessible name. */
  title: string;
  children: React.ReactNode;
  /** The snap the sheet opens at. Defaults to `half`. */
  initialSnap?: SheetSnap;
  /** Called when the player moves the sheet to another snap. */
  onSnapChange?: (snap: SheetSnap) => void;
  /**
   * Pause real-time play while the sheet is open, through the cabinet's
   * pause service with the reason `sheet`. Defaults to true; a turn-based
   * game whose sheet does not stop the clock passes false.
   */
  pausesPlay?: boolean;
  /** The control to focus on open. Defaults to the close button. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Test hook for the sheet; its backdrop gets `-backdrop`. */
  testId?: string;
}

// Open sheets per pause controller, so closing one of two stacked sheets
// does not clear the `sheet` reason the other still holds.
const openSheets = new WeakMap<PauseController, number>();

function holdSheetPause(controller: PauseController): () => void {
  openSheets.set(controller, (openSheets.get(controller) ?? 0) + 1);
  controller.pause("sheet");
  return () => {
    const left = (openSheets.get(controller) ?? 1) - 1;
    openSheets.set(controller, left);
    if (left === 0) controller.resume("sheet");
  };
}

function viewportHeight(): number {
  return typeof window === "undefined" ? 800 : window.innerHeight;
}

/** The snap nearest a height, or null when the drag closes the sheet. */
function snapForHeight(height: number, viewport: number): SheetSnap | null {
  const share = height / viewport;
  if (share < SNAP_SHARE.peek * 0.6) return null;
  let best: SheetSnap = "peek";
  for (const snap of SNAPS) {
    if (Math.abs(SNAP_SHARE[snap] - share) < Math.abs(SNAP_SHARE[best] - share))
      best = snap;
  }
  return best;
}

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  moved: boolean;
}

/**
 * The phone's one sheet (#2361): it slides up over the stage at a peek, half
 * or full snap, so the player keeps the game in view.
 *
 * - The handle is a button: a tap steps to the next snap, the arrow keys move
 *   up and down, and a drag sets the height, snapping on release. Dragging
 *   below the peek closes the sheet.
 * - It is a modal dialog named by its heading. Focus stays inside it under
 *   the `useFocusTrap` stack rules, so a dialog opened inside it owns Tab.
 *   Escape closes it and focus returns to the control that opened it.
 * - Everything around it inside the cabinet is `inert` while it is open,
 *   except live regions and the cabinet's pause overlay and rotate prompt.
 * - It pads for the bottom safe area, and under reduced motion it changes
 *   height without animating.
 * - While it is open, real-time play pauses with the reason `sheet`.
 *
 * @param props - The sheet's state, title and content.
 * @returns The sheet, or null while it is closed.
 */
export function BottomSheet(props: BottomSheetProps) {
  if (!props.open) return null;
  return <OpenSheet {...props} />;
}

function OpenSheet({
  onClose,
  title,
  children,
  initialSnap = "half",
  onSnapChange,
  pausesPlay = true,
  initialFocusRef,
  testId = "bottom-sheet",
}: BottomSheetProps) {
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: initialFocusRef ?? closeRef,
    onEscape: onClose,
    preventScroll: true,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const controller = useCabinetPauseController();

  useEffect(() => {
    if (!pausesPlay) return;
    return holdSheetPause(controller);
  }, [controller, pausesPlay]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return inertOthers(root);
  }, []);

  const moveTo = (next: SheetSnap) => {
    if (next === snap) return;
    setSnap(next);
    onSnapChange?.(next);
  };

  const step = (by: 1 | -1) => {
    const index = SNAPS.indexOf(snap) + by;
    if (index >= 0 && index < SNAPS.length) moveTo(SNAPS[index]);
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // A tap walks up the snaps, then back to the peek.
    moveTo(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") step(1);
    else if (event.key === "ArrowDown") step(-1);
    else if (event.key === "Home") moveTo("peek");
    else if (event.key === "End") moveTo("full");
    else return;
    event.preventDefault();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const panel = trapRef.current;
    if (!panel) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: panel.getBoundingClientRect().height,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    if (!drag.moved && Math.abs(delta) < DRAG_SLOP_PX) return;
    drag.moved = true;
    setDragHeight(clamp(drag.startHeight + delta, 0, viewportHeight()));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    // The drag is the whole gesture; the click that follows is not a tap.
    suppressClickRef.current = true;
    const height = drag.startHeight + (drag.startY - event.clientY);
    setDragHeight(null);
    const next = snapForHeight(height, viewportHeight());
    if (next === null) onClose();
    else moveTo(next);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragHeight(null);
  };

  return (
    <div
      ref={rootRef}
      data-testid={`${testId}-root`}
      className="fixed inset-0 z-40 flex flex-col justify-end"
    >
      <div
        aria-hidden="true"
        data-testid={`${testId}-backdrop`}
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid={testId}
        data-snap={snap}
        style={{
          height:
            dragHeight === null
              ? `${SNAP_SHARE[snap] * 100}dvh`
              : `${dragHeight}px`,
        }}
        className={`relative flex max-h-full min-h-0 w-full flex-col rounded-t-2xl border border-b-0 border-zinc-800 bg-[#13151a] pb-[env(safe-area-inset-bottom)] font-mono text-sm text-zinc-200 shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.9)] ${
          dragHeight === null
            ? "transition-[height] duration-200 ease-out motion-reduce:transition-none"
            : ""
        }`}
      >
        <button
          type="button"
          aria-label={`Sheet height: ${SNAP_LABEL[snap]}`}
          aria-describedby={`${headingId}-handle-hint`}
          data-testid={`${testId}-handle`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          className="flex min-h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
        >
          <span
            aria-hidden="true"
            className="block h-1.5 w-12 rounded-full bg-zinc-600"
          />
        </button>
        <span id={`${headingId}-handle-hint`} hidden>
          Tap to change the height, or use the arrow keys.
        </span>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 pl-4 pr-1">
          <h2
            id={headingId}
            className="min-w-0 truncate text-base font-semibold tracking-[-0.035em] text-zinc-100"
          >
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-zinc-200 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          >
            <IconX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
