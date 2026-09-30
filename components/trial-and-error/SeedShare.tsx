"use client";

import React, { useEffect, useState } from "react";
import {
  challengeHash,
  type RunChoice,
  type RunOrigin,
} from "@/lib/trial-and-error";
import { copyToClipboard, getActiveHostUrl } from "@/lib/clipboard";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { CHALLENGE_PATH } from "@/components/trial-and-error/useChallenge";

const SHARE_BUTTON =
  "min-h-[44px] border border-zinc-600 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]";

type Copied = "seed" | "link" | null;

/**
 * A run's seed with Copy seed and Copy challenge link (#1528). The link opens
 * the same seed on this site's origin; a Daily Protocol run's link also
 * carries its date, so it still replays after the day ends, and any other
 * run's link carries its sponsor and stake when they are not the defaults
 * (#950).
 */
export function SeedShare({
  seed,
  origin,
  choice,
}: {
  seed: string;
  origin: RunOrigin;
  choice?: RunChoice;
}) {
  const { announce } = useAnnouncer();
  const [copied, setCopied] = useState<Copied>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (what: "seed" | "link") => {
    const text =
      what === "seed"
        ? seed
        : `${getActiveHostUrl()}${CHALLENGE_PATH}${challengeHash(seed, origin, choice)}`;
    try {
      await copyToClipboard(text);
      setCopied(what);
      announce(what === "seed" ? "Seed copied." : "Challenge link copied.");
    } catch {
      announce(`Copy failed. The seed is ${seed}.`);
    }
  };

  return (
    <div className="min-w-0" data-testid="seed-share">
      <p className="text-xs text-zinc-300 break-all">
        <span className="font-mono tabular-nums" data-testid="run-seed">
          {seed}
        </span>
        {origin.kind === "DAILY" && (
          <span className="text-amber-300" data-testid="run-daily">
            {" "}
            · Daily Protocol {origin.date} (UTC)
          </span>
        )}
        {origin.kind === "SEEDED" && (
          <span className="text-zinc-400"> · seeded</span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy("seed")}
          className={SHARE_BUTTON}
        >
          {copied === "seed" ? "Seed copied" : "Copy seed"}
        </button>
        <button
          type="button"
          onClick={() => void copy("link")}
          className={SHARE_BUTTON}
        >
          {copied === "link" ? "Link copied" : "Copy challenge link"}
        </button>
      </div>
    </div>
  );
}
