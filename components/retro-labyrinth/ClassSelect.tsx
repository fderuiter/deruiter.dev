"use client";

import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  CLASS_UNLOCK_MILESTONES,
  CYBERDECK_CLASSES,
  isCyberdeckClassUnlocked,
  type CyberdeckClassId,
  type CyberdeckProfile,
} from "@/lib/dungeon";

interface ClassSelectProps {
  /** The profile whose milestones decide which classes are unlocked. */
  readonly profile: CyberdeckProfile;
  /** The class the run carries now. */
  readonly selectedClassId: CyberdeckClassId;
  readonly onChoose: (id: CyberdeckClassId) => void;
  readonly onOpenFirmware: () => void;
  readonly onClose: () => void;
}

/**
 * The cyberdeck class picker as a modal dialog (#2179). Like the Market and
 * the Firmware Bay, it traps focus, starts on the selected class and closes
 * on Escape, so the board's keys never sit dead behind it.
 *
 * @param props - The profile, the current class and the three actions.
 * @returns The dialog.
 */
export function ClassSelect({
  profile,
  selectedClassId,
  onChoose,
  onOpenFirmware,
  onClose,
}: ClassSelectProps) {
  const titleId = useId();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: selectedRef,
    onEscape: onClose,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      data-testid="labyrinth-class-select"
      className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2.5 rounded-lg border border-zinc-700 z-40"
    >
      <h2
        id={titleId}
        className="text-xs font-bold text-amber-400 uppercase tracking-wider"
      >
        SELECT CYBERDECK FIRMWARE ARCHETYPE
      </h2>

      <div className="grid grid-cols-2 gap-1.5 my-1 w-full flex-1 min-h-0 content-start overflow-y-auto">
        {Object.values(CYBERDECK_CLASSES).map((cls) => {
          // A locked class names its milestone and says Locked in words, not
          // only by dimming (#2085).
          const locked = !isCyberdeckClassUnlocked(profile, cls.id);
          const unlock = CLASS_UNLOCK_MILESTONES[cls.id];
          const selected = selectedClassId === cls.id;
          return (
            <button
              key={cls.id}
              ref={selected ? selectedRef : undefined}
              type="button"
              onClick={() => onChoose(cls.id)}
              aria-disabled={locked || undefined}
              aria-pressed={selected}
              data-locked={locked ? "true" : undefined}
              className={`p-1.5 rounded border text-left flex flex-col justify-between transition-all [@media(pointer:coarse)]:min-h-11 ${
                locked
                  ? "bg-neutral-950 border-dashed border-neutral-700 text-neutral-400 cursor-not-allowed"
                  : selected
                    ? "bg-amber-500/15 border-amber-400 text-amber-100 cursor-pointer"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`font-bold text-xs ${locked ? "text-neutral-300" : "text-white"}`}
                >
                  {cls.icon} {cls.name}
                </span>
                <span className="text-xs text-amber-400">
                  {locked ? "🔒 Locked" : `${cls.baseRam}GB RAM`}
                </span>
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 leading-tight">
                {locked && unlock
                  ? `Unlock: ${unlock.label}.`
                  : cls.passiveBonus}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex w-full gap-1.5">
        <button
          type="button"
          onClick={onOpenFirmware}
          className="flex-1 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded text-xs font-bold cursor-pointer [@media(pointer:coarse)]:min-h-11"
        >
          Firmware Upgrades
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-0.5 bg-neutral-800 text-neutral-300 rounded text-xs font-bold cursor-pointer [@media(pointer:coarse)]:min-h-11"
        >
          Confirm Loadout & Hack
        </button>
      </div>
    </div>
  );
}
