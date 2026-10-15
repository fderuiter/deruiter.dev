"use client";

import React from "react";
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRepeat,
} from "@tabler/icons-react";
import type { EchoRound } from "@/lib/meme-echo";

interface EchoConsoleProps {
  round: EchoRound | null;
  best: number;
  /** True after a pad was pressed while the vault was still playing. */
  early?: boolean;
  onStart: () => void;
  onStop: () => void;
  /** Why the pads are silent, or null when sound is on. */
  silentReason: React.ReactNode;
  /** The pad the vault wanted when a wrong pad ended the round (#2125). */
  missedPad?: { key: string; label: string } | null;
}

function statusLine(
  round: EchoRound | null,
  early: boolean,
  missedPad: { key: string; label: string } | null
): string {
  if (!round)
    return "Press Start Echo, watch the pads light, then repeat them.";
  switch (round.phase) {
    case "showing":
      if (early)
        return `Watch to the end first: ${round.sequence.length} ${round.sequence.length === 1 ? "pad" : "pads"}, then repeat.`;
      return `Watch: ${round.sequence.length} ${round.sequence.length === 1 ? "pad" : "pads"}.`;
    case "input":
      return `Your turn: pad ${round.inputIndex + 1} of ${round.sequence.length}.`;
    case "over":
      return missedPad
        ? `Wrong pad. Streak ${round.streak}. The vault played ${missedPad.key} · ${missedPad.label}, marked in amber. Start again to beat it.`
        : `Wrong pad. Streak ${round.streak}. Start again to beat it.`;
  }
}

/**
 * The Echo strip above the pads (#2049): start and stop, the round's status,
 * the live streak and the stored best. Static: the only motion is the pads'
 * own lit state.
 */
export function EchoConsole({
  round,
  best,
  early = false,
  onStart,
  onStop,
  silentReason,
  missedPad = null,
}: EchoConsoleProps) {
  const running = round !== null && round.phase !== "over";
  return (
    <div
      className="mb-4 rounded-lg border border-white/[0.08] bg-[#0d0e11] p-3 sm:p-4"
      data-testid="meme-echo"
      data-echo-phase={round?.phase ?? "idle"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconRepeat
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-amber-400"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#f4f4f6]">
              Echo
            </h3>
            <p
              className={`font-sans text-xs break-words ${
                early && round?.phase === "showing"
                  ? "text-amber-300"
                  : "text-zinc-400"
              }`}
              data-testid="meme-echo-status"
            >
              {statusLine(round, early, missedPad)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <dl className="flex gap-3 font-mono text-[11px] pointer-coarse:text-xs tabular-nums">
            <div className="flex items-baseline gap-1.5">
              <dt className="uppercase tracking-wider text-zinc-400">Streak</dt>
              <dd className="text-zinc-100" data-testid="meme-echo-streak">
                {round?.streak ?? 0}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="uppercase tracking-wider text-zinc-400">Best</dt>
              <dd className="text-amber-300" data-testid="meme-echo-best">
                {best}
              </dd>
            </div>
          </dl>
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-white/[0.08] bg-[#13151a] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-zinc-100 active:scale-[0.98] pointer-coarse:min-h-11"
            >
              <IconPlayerStop aria-hidden="true" className="h-4 w-4" />
              <span>Stop Echo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-400/70 hover:text-amber-100 active:scale-[0.98] pointer-coarse:min-h-11"
            >
              <IconPlayerPlay aria-hidden="true" className="h-4 w-4" />
              <span>{round ? "Play Echo again" : "Start Echo"}</span>
            </button>
          )}
        </div>
      </div>
      {running && silentReason && (
        <p className="mt-2 font-sans text-xs text-amber-200">
          Echo is playing with lights only. {silentReason}
        </p>
      )}
    </div>
  );
}
