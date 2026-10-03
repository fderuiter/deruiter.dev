"use client";

import React, { useRef } from "react";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
} from "@tabler/icons-react";
import { STUDY_ID, trialDayOf, type SimSpeed } from "@/lib/protocol-drift";
import { useProtocolDriftStore } from "./store";

const SPEEDS: SimSpeed[] = [1, 2, 5];
const BUTTON =
  "inline-flex min-h-9 items-center gap-1 border px-2.5 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const NEUTRAL = `${BUTTON} border-zinc-700 text-zinc-200 hover:border-amber-500 hover:text-amber-400`;

function GateBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "idle";
}) {
  const color =
    tone === "ok"
      ? "border-emerald-500/60 text-emerald-400"
      : tone === "warn"
        ? "border-amber-500/60 text-amber-400"
        : "border-slate-400/50 text-slate-300";
  return (
    <span
      className={`inline-flex min-h-7 items-center border px-2 font-mono text-[11px] ${color}`}
    >
      {label}
    </span>
  );
}

/** Header bar: study, simulation clock, transport, publish and save controls. */
export function HeaderBar() {
  const snapshot = useProtocolDriftStore((s) => s.snapshot);
  const view = useProtocolDriftStore((s) => s.view);
  const validation = useProtocolDriftStore((s) => s.validation);
  const togglePause = useProtocolDriftStore((s) => s.togglePause);
  const setSpeed = useProtocolDriftStore((s) => s.setSpeed);
  const step = useProtocolDriftStore((s) => s.step);
  const validate = useProtocolDriftStore((s) => s.validate);
  const publish = useProtocolDriftStore((s) => s.publish);
  const requestLock = useProtocolDriftStore((s) => s.requestLock);
  const exportSave = useProtocolDriftStore((s) => s.exportSave);
  const importSave = useProtocolDriftStore((s) => s.importSave);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const fsm = snapshot?.fsmState ?? "BRIEF";
  const running = fsm === "RUNNING";
  const frozen = fsm === "LOCKED" || fsm === "LOCK_REVIEW";
  const day = snapshot ? trialDayOf(snapshot.minute) : 0;
  const canLock = view?.scenario === "full" && fsm === "PAUSED" && day >= 28;
  const sdtmClear =
    snapshot !== undefined &&
    snapshot !== null &&
    snapshot.openIssues === 0 &&
    snapshot.debt.fabricatedBits === 0 &&
    snapshot.debt.semanticLossCount === 0;

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await importSave(await file.text());
  };

  return (
    <header
      className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-800 bg-[#13151a] px-3 py-2"
      aria-label="Simulation controls"
    >
      <div className="min-w-0">
        <p className="font-mono text-[11px] text-zinc-300">Study {STUDY_ID}</p>
        <p
          className="font-mono text-lg font-semibold tabular-nums text-zinc-100"
          data-testid="sim-clock"
          aria-live="off"
        >
          {snapshot?.clockLabel ?? "Day 0 08:00"}
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Clock"
      >
        <button
          type="button"
          onClick={() => void togglePause()}
          disabled={frozen || fsm === "BRIEF"}
          aria-label={running ? "Pause (Space)" : "Run (Space)"}
          aria-pressed={running}
          className={NEUTRAL}
        >
          {running ? (
            <IconPlayerPause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <IconPlayerPlay className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{running ? "Pause" : "Run"}</span>
        </button>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => void setSpeed(speed)}
            disabled={frozen || fsm === "BRIEF"}
            aria-pressed={snapshot?.speed === speed}
            aria-label={`Speed ${speed}x`}
            className={`${NEUTRAL} ${snapshot?.speed === speed ? "!border-amber-500 !text-amber-400" : ""}`}
          >
            {speed}x
          </button>
        ))}
        <button
          type="button"
          onClick={() => void step()}
          disabled={fsm !== "PAUSED"}
          aria-label="Step one hour (N)"
          className={NEUTRAL}
        >
          <IconPlayerTrackNext className="h-4 w-4" aria-hidden="true" />
          <span>N</span>
        </button>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Pipeline"
      >
        <button
          type="button"
          onClick={() => void validate()}
          disabled={fsm === "BRIEF" || fsm === "RUNNING" || frozen}
          className={NEUTRAL}
        >
          Run Local Test
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={fsm !== "DEPLOY_READY"}
          className={`${NEUTRAL} ${fsm === "DEPLOY_READY" ? "!border-emerald-500 !text-emerald-400" : ""}`}
        >
          Publish Revision
        </button>
        {canLock ? (
          <button
            type="button"
            onClick={() => void requestLock()}
            className={`${NEUTRAL} !border-amber-500 !text-amber-400`}
          >
            Request Database Lock
          </button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5 @3xl:ml-auto"
        role="group"
        aria-label="Gates and saves"
      >
        <GateBadge
          label={`SDTM ${sdtmClear ? "CLEAR" : "OPEN"}`}
          tone={sdtmClear ? "ok" : "warn"}
        />
        <GateBadge
          label={`ADaM ${snapshot?.recordCounts.adamRows ?? 0} rows`}
          tone={(snapshot?.recordCounts.adamRows ?? 0) > 0 ? "ok" : "idle"}
        />
        <GateBadge label={`FSM ${fsm}`} tone={running ? "ok" : "idle"} />
        <button
          type="button"
          onClick={() => void exportSave()}
          className={NEUTRAL}
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={NEUTRAL}
        >
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Import save file"
          onChange={(e) => void onImport(e)}
        />
      </div>
      {validation && !validation.valid ? (
        <p
          role="alert"
          className="basis-full font-mono text-[11px] text-amber-400"
        >
          Local test failed: {validation.errors.join(" · ")}
        </p>
      ) : null}
    </header>
  );
}
