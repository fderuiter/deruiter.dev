"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconDots } from "@tabler/icons-react";
import { BottomSheet } from "./BottomSheet";

/** One stat on the phone HUD. */
export interface PhoneHudChip {
  /** Stable key. */
  id: string;
  /** Short caption under the number, e.g. "Score". */
  label: string;
  /** The number, shown large with tabular figures. */
  value: string | number;
  /** A small icon before the number. It is decorative. */
  icon?: React.ReactNode;
  /** Colour the number with the game's accent. */
  accent?: boolean;
  /**
   * Whether changes to this value are read out. Defaults to true; turn it off
   * for a value that ticks every frame, such as a timer.
   */
  announce?: boolean;
}

/** Props for {@link PhoneHud}. */
export interface PhoneHudProps {
  chips: readonly PhoneHudChip[];
  /** The HUD's accessible name. Defaults to "Game status". */
  label?: string;
  /**
   * The shortest gap between two read-outs of changed values, in ms.
   * Defaults to 3000, so a fast score does not talk over play.
   */
  announceEveryMs?: number;
}

/** The most chips the row shows before the rest move into the overflow chip. */
export const PHONE_HUD_MAX_CHIPS = 4;

const DEFAULT_ANNOUNCE_MS = 3000;

function chipText(chip: PhoneHudChip): string {
  return `${chip.label} ${chip.value}`;
}

/**
 * Reads changed values into a polite live region, at most once per
 * `everyMs`. A change inside the window waits for the window to end, so the
 * last value is always read.
 */
function useThrottledAnnouncement(
  chips: readonly PhoneHudChip[],
  everyMs: number
): string {
  const [message, setMessage] = useState("");
  const spokenRef = useRef<Map<string, string> | null>(null);
  const lastAtRef = useRef(-Infinity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(chips);

  useEffect(() => {
    latestRef.current = chips;
    const flush = () => {
      timerRef.current = null;
      const spoken = spokenRef.current ?? new Map<string, string>();
      const changed = latestRef.current.filter(
        (chip) =>
          chip.announce !== false && spoken.get(chip.id) !== String(chip.value)
      );
      for (const chip of latestRef.current) {
        spoken.set(chip.id, String(chip.value));
      }
      spokenRef.current = spoken;
      if (changed.length === 0) return;
      lastAtRef.current = Date.now();
      setMessage(changed.map(chipText).join(", "));
    };
    if (spokenRef.current === null) {
      // The first values are on screen already; only changes are news.
      spokenRef.current = new Map(
        chips.map((chip) => [chip.id, String(chip.value)])
      );
      return;
    }
    if (timerRef.current !== null) return;
    const wait = Math.max(0, lastAtRef.current + everyMs - Date.now());
    timerRef.current = setTimeout(flush, wait);
  }, [chips, everyMs]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    []
  );

  return message;
}

function Chip({ chip }: { chip: PhoneHudChip }) {
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center justify-center leading-none">
      <span
        className={`inline-flex max-w-full items-center gap-1 truncate text-base font-bold tabular-nums ${
          chip.accent ? "arcade-accent-text" : "text-zinc-100"
        }`}
      >
        {chip.icon && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {chip.icon}
          </span>
        )}
        {chip.value}
      </span>
      <span className="mt-0.5 max-w-full truncate text-xs uppercase tracking-wider text-zinc-400">
        {chip.label}
      </span>
    </li>
  );
}

/**
 * The phone HUD (#2361): one 44px row of up to four stat chips, each a big
 * number over its label. More stats than that go behind an overflow chip that
 * opens a sheet listing every stat. Changed values are read out through a
 * polite live region, throttled to `announceEveryMs`.
 *
 * Put it in PhoneStage's `hud` slot.
 *
 * @param props - The chips and the HUD's label.
 * @returns The HUD row.
 */
export function PhoneHud({
  chips,
  label = "Game status",
  announceEveryMs = DEFAULT_ANNOUNCE_MS,
}: PhoneHudProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const message = useThrottledAnnouncement(chips, announceEveryMs);
  const shown = chips.slice(0, PHONE_HUD_MAX_CHIPS);
  const hidden = chips.length - shown.length;

  return (
    <div
      role="group"
      aria-label={label}
      data-testid="phone-hud"
      className="flex h-11 w-full min-w-0 items-stretch border-b border-white/[0.08] bg-[#0d0e11] font-mono text-zinc-300"
    >
      <ul className="flex min-w-0 flex-1 items-stretch">
        {shown.map((chip) => (
          <Chip key={chip.id} chip={chip} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className="flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center leading-none text-zinc-200 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 active:scale-[0.98]"
        >
          <IconDots className="h-4 w-4" aria-hidden="true" />
          <span className="mt-0.5 text-xs tabular-nums">
            +{hidden}
            <span className="sr-only"> more stats</span>
          </span>
        </button>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="All stats"
        initialSnap="half"
        testId="phone-hud-sheet"
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {chips.map((chip) => (
            <div key={chip.id} className="min-w-0">
              <dt className="truncate text-xs uppercase tracking-wider text-zinc-400">
                {chip.label}
              </dt>
              <dd
                className={`inline-flex items-center gap-1 text-lg font-bold tabular-nums ${
                  chip.accent ? "arcade-accent-text" : "text-zinc-100"
                }`}
              >
                {chip.icon && (
                  <span aria-hidden="true" className="inline-flex">
                    {chip.icon}
                  </span>
                )}
                {chip.value}
              </dd>
            </div>
          ))}
        </dl>
      </BottomSheet>
    </div>
  );
}
