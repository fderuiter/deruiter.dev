"use client";

import React from "react";
import { IconX } from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface TouchSheetProps {
  /** The sheet's heading, also its accessible name. */
  title: string;
  /** Test hook for the sheet and its backdrop. */
  testId: string;
  onClose: () => void;
  /**
   * False when the content scrolls itself in named regions. The body is then
   * not a scroll box, so no unnamed keyboard stop appears above them (#2045).
   */
  scroll?: boolean;
  children: React.ReactNode;
}

/**
 * A bottom sheet over the touch workbench (#2045). It keeps the canvas in
 * view above it: a modal dialog with a 44px close button, a backdrop that
 * closes it, focus kept inside, and Escape to close. Positioned against the
 * workbench root, which is the cabinet's stage.
 */
export function TouchSheet({
  title,
  testId,
  onClose,
  scroll = true,
  children,
}: TouchSheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    returnFocus: true,
  });
  return (
    <>
      <div
        aria-hidden="true"
        data-testid={`${testId}-backdrop`}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] pb-[env(safe-area-inset-bottom)] flex-col rounded-t-2xl border border-b-0 border-zinc-700 bg-[#13151a] font-mono text-xs text-zinc-200 shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3">
          <h2 className="min-w-0 truncate py-1 text-sm font-semibold text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-zinc-200 hover:text-amber-400"
          >
            <IconX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 p-2 ${
            scroll ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
          }`}
        >
          {children}
        </div>
      </div>
    </>
  );
}
