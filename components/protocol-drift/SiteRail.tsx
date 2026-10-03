"use client";

import React from "react";
import { clamp } from "@/lib/game-utils";
import { SITE_IDS, SITE_PROFILES, type SiteId } from "@/lib/protocol-drift";
import { useProtocolDriftStore } from "./store";

/** Right rail: live goodwill, latency and query load for each site. */
export function SiteRail({
  compact,
  onToggle,
}: {
  compact: boolean;
  onToggle: () => void;
}) {
  const view = useProtocolDriftStore((s) => s.view);
  const snapshot = useProtocolDriftStore((s) => s.snapshot);
  const sites: readonly SiteId[] =
    view?.scenario === "tracer" ? ["SITE-A"] : SITE_IDS;

  return (
    <aside
      aria-label="Site rail"
      className={`flex min-h-0 shrink-0 flex-col gap-2 overflow-y-auto border-l border-zinc-800 bg-[#13151a] p-2 font-mono ${
        compact ? "w-14" : "w-[264px]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!compact}
        className="min-h-8 border border-zinc-700 px-1 text-[11px] text-zinc-200 hover:border-amber-500"
      >
        {compact ? "Sites" : "Collapse"}
      </button>
      {sites.map((id) => {
        const profile = SITE_PROFILES[id];
        const live = snapshot?.activeSites[id];
        const goodwill = Math.round(live?.goodwill ?? profile.initialGoodwill);
        const tone = goodwill < 40 ? "bg-amber-500" : "bg-emerald-500";
        if (compact) {
          return (
            <div
              key={id}
              title={`${profile.name}: goodwill ${goodwill}`}
              className="flex flex-col items-center border border-zinc-800 py-1 text-[11px] text-zinc-200"
            >
              <b>{id.slice(-1)}</b>
              <span className="tabular-nums">{goodwill}</span>
            </div>
          );
        }
        return (
          <article
            key={id}
            aria-label={`${profile.name} (${id})`}
            className="min-w-0 border border-zinc-800 bg-[#0d0e11] p-2 text-[11px] text-zinc-300"
          >
            <h3 className="break-words text-xs font-semibold text-zinc-100">
              {id.replace("SITE-", "Site ")} · {profile.name}
            </h3>
            <p className="mt-1 flex items-center justify-between">
              <span>Goodwill G</span>
              <b className="tabular-nums text-zinc-100">{goodwill}</b>
            </p>
            <div
              role="meter"
              aria-label={`${id} goodwill`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={goodwill}
              className="mt-1 h-1.5 w-full bg-zinc-800"
            >
              <div
                className={`h-full ${tone}`}
                style={{ width: `${clamp(goodwill, 0, 100)}%` }}
              />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <dt>Latency</dt>
              <dd className="text-right tabular-nums text-zinc-100">
                {live?.latencyHours ?? profile.baseLatencyHours}h
              </dd>
              <dt>Base</dt>
              <dd className="text-right tabular-nums">
                {profile.baseLatencyHours}h
              </dd>
              <dt>Attention A</dt>
              <dd className="text-right tabular-nums">
                {Math.round(live?.attention ?? 100)}
              </dd>
              <dt>Open queries</dt>
              <dd className="text-right tabular-nums text-zinc-100">
                {live?.openQueries ?? 0}
              </dd>
              <dt>Form</dt>
              <dd className="text-right text-zinc-100">
                {live?.version ?? "v1"}
              </dd>
              <dt>v2 activates</dt>
              <dd className="text-right tabular-nums">
                Day {profile.amendmentActivationDay}
              </dd>
            </dl>
          </article>
        );
      })}
    </aside>
  );
}
