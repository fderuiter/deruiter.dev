"use client";

import React from "react";
import { BOOTH_CREW, formatClock } from "@/lib/patty-drive-thru";
import { useBooth } from "./hooks";
import type { BoothStore, CaptionSpeaker } from "./store";

/** Seconds a caption stays on screen. */
const CAPTION_SECONDS = 5;

const SPEAKER_LABEL: Record<CaptionSpeaker, string | null> = {
  headset: "Headset",
  manager: BOOTH_CREW.manager,
  coworker: BOOTH_CREW.coworker,
  booth: null,
};

interface MeterProps {
  label: string;
  value: number;
  /** True when a full meter is bad news, so it fills in the alert colour. */
  danger?: boolean;
  testId: string;
}

function Meter({ label, value, danger = false, testId }: MeterProps) {
  const low = danger ? value >= 70 : value <= 25;
  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wider text-[var(--pdt-hud-dim)]">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-[var(--pdt-hud-text)]">{value}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-[var(--pdt-hud-track)]"
      >
        <div
          className={`h-full origin-left ${
            low ? "bg-[var(--pdt-hud-alert)]" : "bg-[var(--pdt-hud-fill)]"
          }`}
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>
    </div>
  );
}

interface ShiftHudProps {
  store: BoothStore;
  /** Shown when the visitor can switch between the 3D booth and the flat view. */
  viewToggle?: React.ReactNode;
}

/**
 * The heads-up strip: shift clock, the three meters and the wipe button.
 * Values are rounded in their selectors, so the strip only re-renders when a
 * number on it changes.
 */
export function ShiftHud({ store, viewToggle }: ShiftHudProps) {
  const timeLeft = useBooth(store, (s) =>
    Math.ceil(Math.max(0, s.shift.config.durationSec - s.shift.time))
  );
  const sos = useBooth(store, (s) => Math.round(s.shift.meters.sos));
  const dignity = useBooth(store, (s) => Math.round(s.shift.meters.dignity));
  const idle = useBooth(store, (s) => Math.round(s.shift.meters.idle));
  const canWipe = useBooth(store, (s) => s.shift.time >= s.shift.wipeReadyAt);
  const act = store.getState().act;

  return (
    <div
      data-testid="pdt-hud"
      className="pointer-events-auto grid w-full min-w-0 grid-cols-2 items-end gap-x-4 gap-y-2 rounded-md border border-[var(--pdt-hud-rule)] bg-[var(--pdt-hud-bg)] px-3 py-1 font-mono text-[var(--pdt-hud-text)] @2xl:grid-cols-[auto_1fr_1fr_1fr_auto] @2xl:items-center"
    >
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--pdt-hud-dim)]">
          Shift left
        </p>
        <p
          className="text-lg font-bold leading-tight tabular-nums"
          data-testid="pdt-clock"
          suppressHydrationWarning
        >
          {formatClock(timeLeft)}
        </p>
      </div>
      <Meter label="Drive-thru speed" value={sos} testId="pdt-meter-sos" />
      <Meter label="Dignity" value={dignity} testId="pdt-meter-dignity" />
      <Meter
        label={`${BOOTH_CREW.manager} is watching`}
        value={idle}
        danger
        testId="pdt-meter-idle"
      />
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-1.5 @2xl:col-span-1">
        <button
          type="button"
          onClick={() => act({ type: "wipe" })}
          disabled={!canWipe}
          aria-keyshortcuts="W"
          className="min-h-11 rounded border border-[var(--pdt-hud-rule)] bg-[var(--pdt-hud-button)] px-3 text-xs font-bold uppercase tracking-wide text-[var(--pdt-hud-text)] active:scale-[0.98] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
        >
          Wipe counter
        </button>
        {viewToggle}
      </div>
    </div>
  );
}

/**
 * The latest line said in the booth, shown for a few seconds with who said
 * it. The game places it: under the strip in the flat view, and low on the
 * screen like subtitles in the 3D booth.
 */
export function ShiftCaption({
  store,
  className = "",
}: {
  store: BoothStore;
  className?: string;
}) {
  const caption = useBooth(store, (s) =>
    s.caption && s.shift.time - s.caption.at < CAPTION_SECONDS
      ? s.caption
      : null
  );
  const speaker = caption ? SPEAKER_LABEL[caption.speaker] : null;

  return (
    <p
      data-testid="pdt-caption"
      className={`min-h-7 min-w-0 break-words px-1 text-sm text-[var(--pdt-caption)] ${className}`}
    >
      {caption ? (
        <span
          key={caption.id}
          className="pdt-caption-in inline-block rounded bg-[var(--pdt-hud-bg)] px-2 py-0.5"
        >
          {speaker ? (
            <span className="font-bold text-[var(--pdt-hud-dim)]">
              {speaker}:{" "}
            </span>
          ) : null}
          {caption.text}
        </span>
      ) : null}
    </p>
  );
}
