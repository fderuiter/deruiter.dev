"use client";

import React, { useEffect, useRef, useState } from "react";
import { Inspector } from "./Inspector";
import {
  AmendmentMemoModal,
  BriefingModal,
  DebriefModal,
  LockReviewModal,
  WaveReviewModal,
} from "./Modals";
import { HeaderBar } from "./HeaderBar";
import { ObjectiveStrip } from "./ObjectiveStrip";
import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineTextView } from "./PipelineTextView";
import { SiteRail } from "./SiteRail";
import { Toolbox } from "./Toolbox";
import { useProtocolDriftStore } from "./store";
import { useWorkbenchKeys } from "./useWorkbenchKeys";

/** Container width from which the toolbox and site rail stay fully open. */
const WIDE_CONTAINER_PX = 1400;
const TICK_MS = 250;

/**
 * Protocol Drift workbench: pipeline canvas, toolbox, site rail, tri-pane
 * inspector and the modal flow from briefing to debrief. The simulation runs
 * in a Web Worker behind the Zustand store.
 */
export function ProtocolDriftGame() {
  const root = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState<boolean | null>(null);
  const [railOpen, setRailOpen] = useState<boolean | null>(null);
  const [debriefOpen, setDebriefOpen] = useState(true);
  const onKeyDown = useWorkbenchKeys();

  const ready = useProtocolDriftStore((s) => s.ready);
  const view = useProtocolDriftStore((s) => s.view);
  const fsm = useProtocolDriftStore((s) => s.snapshot?.fsmState);
  const waveSummary = useProtocolDriftStore((s) => s.waveSummary);
  const memoOpen = useProtocolDriftStore((s) => s.memoOpen);
  const lockAudit = useProtocolDriftStore((s) => s.lockAudit);
  const scorecard = useProtocolDriftStore((s) => s.scorecard);
  const notice = useProtocolDriftStore((s) => s.notice);
  const mode = useProtocolDriftStore((s) => s.mode);
  const init = useProtocolDriftStore((s) => s.init);
  const dispose = useProtocolDriftStore((s) => s.dispose);
  const tick = useProtocolDriftStore((s) => s.tick);

  useEffect(() => {
    void init();
    return () => dispose();
  }, [init, dispose]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setWide(el.clientWidth >= WIDE_CONTAINER_PX);
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fsm !== "RUNNING") return;
    let last = performance.now();
    const handle = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(now - last, 1000);
      last = now;
      void tick(elapsed);
    }, TICK_MS);
    return () => window.clearInterval(handle);
  }, [fsm, tick]);

  const compactToolbox = !(toolboxOpen ?? wide);
  const compactRail = !(railOpen ?? wide);
  const showDebrief = fsm === "LOCKED" && scorecard && view && debriefOpen;

  return (
    <div
      ref={root}
      tabIndex={0}
      data-keyboard-boundary="true"
      data-game="protocol-drift"
      data-fsm={fsm ?? "BRIEF"}
      onKeyDown={onKeyDown}
      className="@container relative flex h-[max(960px,calc(100dvh-6rem))] w-full min-w-0 flex-col overflow-hidden bg-[#0d0e11] text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
    >
      <HeaderBar />
      <ObjectiveStrip />
      <div className="flex min-h-0 flex-1">
        <Toolbox
          compact={compactToolbox}
          onToggle={() => setToolboxOpen(compactToolbox)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-[200px] flex-1">
            <PipelineCanvas />
            {fsm === "LOCKED" && !showDebrief ? (
              <button
                type="button"
                onClick={() => setDebriefOpen(true)}
                className="absolute right-3 top-3 z-10 min-h-9 border border-amber-500 bg-[#0d0e11] px-3 font-mono text-xs text-amber-400"
              >
                Show debrief
              </button>
            ) : null}
          </div>
          <PipelineTextView />
        </div>
        <SiteRail
          compact={compactRail}
          onToggle={() => setRailOpen(compactRail)}
        />
      </div>
      <Inspector />
      <footer className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-zinc-800 bg-[#0d0e11] px-3 font-mono text-[11px] text-zinc-300">
        <span>Seed #{view?.seed ?? 48291}</span>
        <span>[Space] Pause</span>
        <span>[N] Step</span>
        <span>[I] Inspect</span>
        <span>[Esc] Return</span>
        <span className="ml-auto">engine: {mode ?? "starting"}</span>
      </footer>

      <div role="status" aria-live="polite" className="sr-only">
        {notice?.text}
      </div>
      {notice ? (
        <p
          key={notice.id}
          data-tone={notice.tone}
          className={`pointer-events-none absolute bottom-10 left-1/2 z-30 max-w-[90%] -translate-x-1/2 border bg-[#13151a] px-3 py-1.5 font-mono text-xs ${
            notice.tone === "error"
              ? "border-amber-500 text-amber-300"
              : notice.tone === "warn"
                ? "border-amber-500/60 text-amber-400"
                : "border-slate-400/60 text-zinc-100"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {ready && fsm === "BRIEF" ? <BriefingModal /> : null}
      {fsm === "LOCK_REVIEW" && lockAudit && view ? (
        <LockReviewModal audit={lockAudit} view={view} />
      ) : null}
      {showDebrief ? (
        <DebriefModal
          scorecard={scorecard}
          view={view}
          onClose={() => setDebriefOpen(false)}
        />
      ) : null}
      {memoOpen && fsm !== "LOCK_REVIEW" ? <AmendmentMemoModal /> : null}
      {waveSummary && fsm === "WAVE_REVIEW" && !memoOpen ? (
        <WaveReviewModal summary={waveSummary} />
      ) : null}
    </div>
  );
}
