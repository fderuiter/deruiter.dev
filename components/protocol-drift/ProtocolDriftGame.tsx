"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
// Scoped to `.pd-touch`, so only the touch cabinet sees these rules (#2045).
import "./protocol-drift-touch.css";
import { Inspector } from "./Inspector";
import {
  AmendmentMemoModal,
  BriefingModal,
  DebriefModal,
  LockReviewModal,
  WaveReviewModal,
} from "./Modals";
import { GateBadges, HeaderBar, SaveButtons } from "./HeaderBar";
import { ObjectiveStrip } from "./ObjectiveStrip";
import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineTextView } from "./PipelineTextView";
import { SiteRail } from "./SiteRail";
import { Toolbox } from "./Toolbox";
import { isTracerComplete, useProtocolDriftStore } from "./store";
import { DEFAULT_SEED } from "@/lib/protocol-drift";
import { arcadeDailyNumber, readArcadeDailyParam } from "@/lib/arcade/daily";
import { useWorkbenchKeys } from "./useWorkbenchKeys";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
import { PROTOCOL_DRIFT_AUTO_PAUSE_EVENT } from "./auto-pause";

/** Container width from which the toolbox shows chip names (1024 viewport). */
const TOOLBOX_OPEN_PX = 820;
/** Container width from which the site rail also stays fully open. */
const WIDE_CONTAINER_PX = 1400;
const TICK_MS = 250;
/** How long a notice stays on screen before it clears itself. */
const NOTICE_MS = 6000;

/**
 * The study's seed from an Arcade Daily `?daily=YYYY-MM-DD` link (#2113), or
 * the default seed when the page was opened without one.
 */
function seedFromUrl(): number {
  const date = dailyFromUrl();
  return date ? arcadeDailyNumber(date, "protocol-drift") : DEFAULT_SEED;
}

const dailyFromUrl = () => readArcadeDailyParam(window.location.search);
const noDaily = () => null;
const noSubscription = () => () => {};

/**
 * Protocol Drift workbench: pipeline canvas, toolbox, site rail, tri-pane
 * inspector and the modal flow from briefing to debrief. The simulation runs
 * in a Web Worker behind the Zustand store.
 */
export function ProtocolDriftGame() {
  const root = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  const [roomy, setRoomy] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState<boolean | null>(null);
  const [railOpen, setRailOpen] = useState<boolean | null>(null);
  const [debriefOpen, setDebriefOpen] = useState(true);
  const onKeyDown = useWorkbenchKeys();
  // The touch cabinet (ADR 0061) lays the workbench out to fit its stage. Its
  // panels stay open, since there is no keyboard toggle to reopen them.
  const touch = useCabinetTouch();

  const ready = useProtocolDriftStore((s) => s.ready);
  const inspectorExpanded = useProtocolDriftStore((s) => s.inspectorExpanded);
  const wireFrom = useProtocolDriftStore((s) => s.wireFrom);
  const wireSheet = useProtocolDriftStore((s) => s.wireSheet);
  const view = useProtocolDriftStore((s) => s.view);
  const fsm = useProtocolDriftStore((s) => s.snapshot?.fsmState);
  const waveSummary = useProtocolDriftStore((s) => s.waveSummary);
  const memoOpen = useProtocolDriftStore((s) => s.memoOpen);
  const lockAudit = useProtocolDriftStore((s) => s.lockAudit);
  const scorecard = useProtocolDriftStore((s) => s.scorecard);
  const notice = useProtocolDriftStore((s) => s.notice);
  // On touch an auto-pause shows only the pill in the wire bar (#2045).
  const pausedReason = useProtocolDriftStore((s) => s.pausedReason);
  const mode = useProtocolDriftStore((s) => s.mode);
  const init = useProtocolDriftStore((s) => s.init);
  const dispose = useProtocolDriftStore((s) => s.dispose);
  const tick = useProtocolDriftStore((s) => s.tick);
  const clearNotice = useProtocolDriftStore((s) => s.clearNotice);
  const tracerDone = isTracerComplete(view);
  const linkedDaily = useSyncExternalStore(
    noSubscription,
    dailyFromUrl,
    noDaily
  );
  const dailyDate =
    linkedDaily &&
    view?.seed === arcadeDailyNumber(linkedDaily, "protocol-drift")
      ? linkedDaily
      : null;

  useEffect(() => {
    void init("full", seedFromUrl());
    return () => dispose();
  }, [init, dispose]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      setWide(el.clientWidth >= WIDE_CONTAINER_PX);
      setRoomy(el.clientWidth >= TOOLBOX_OPEN_PX);
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The cabinet asks for a pause when the tab hides or the device turns. Only
  // a running clock pauses; a paused or briefing game is left alone.
  useEffect(() => {
    const pauseIfRunning = () => {
      const store = useProtocolDriftStore.getState();
      if (store.snapshot?.fsmState === "RUNNING") void store.togglePause();
    };
    window.addEventListener(PROTOCOL_DRIFT_AUTO_PAUSE_EVENT, pauseIfRunning);
    return () =>
      window.removeEventListener(
        PROTOCOL_DRIFT_AUTO_PAUSE_EVENT,
        pauseIfRunning
      );
  }, []);

  useEffect(() => {
    if (!notice) return;
    const handle = window.setTimeout(() => clearNotice(notice.id), NOTICE_MS);
    return () => window.clearTimeout(handle);
  }, [notice, clearNotice]);

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

  const compactToolbox = !touch && !(toolboxOpen ?? roomy);
  const compactRail = !touch && !(railOpen ?? wide);
  const showDebrief = fsm === "LOCKED" && scorecard && view && debriefOpen;
  const hintClass = touch ? undefined : "hidden @5xl:inline";
  const toast = notice ? (
    <p
      key={notice.id}
      data-tone={notice.tone}
      className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 border bg-[#13151a] px-3 py-1.5 font-mono text-xs ${
        touch ? "top-48 max-w-[90%]" : "bottom-3 max-w-[70%]"
      } ${
        notice.tone === "error"
          ? "border-amber-500 text-amber-300"
          : notice.tone === "warn"
            ? "border-amber-500/60 text-amber-400"
            : "border-slate-400/60 text-zinc-100"
      }`}
    >
      {notice.text}
    </p>
  ) : null;

  return (
    <div
      ref={root}
      tabIndex={0}
      data-keyboard-boundary="true"
      data-game="protocol-drift"
      data-fsm={fsm ?? "BRIEF"}
      // A touch cabinet's Escape closes the open sheet or cancels a started
      // wire before it leaves the cabinet (#2045).
      data-escape-docks={
        touch && (inspectorExpanded || wireFrom || wireSheet)
          ? "true"
          : undefined
      }
      onKeyDown={onKeyDown}
      // A tap clears the last notice, so a message never sits over the canvas
      // after the next tap (#2045).
      onPointerDownCapture={
        touch && notice ? () => clearNotice(notice.id) : undefined
      }
      // Desktop: the whole workbench fits under the navbar and the cabinet's
      // title bar, so focus returning to it never scrolls the header out of
      // view (#2166).
      className={
        touch
          ? "pd-touch @container relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#0d0e11] text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
          : "@container relative flex h-[max(560px,calc(100dvh-9rem))] scroll-mt-24 w-full min-w-0 flex-col overflow-hidden bg-[#0d0e11] text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      }
    >
      <HeaderBar />
      <ObjectiveStrip />
      <div className={`flex min-h-0 flex-1 ${touch ? "pd-touch-body" : ""}`}>
        <Toolbox
          compact={compactToolbox}
          onToggle={() => setToolboxOpen(compactToolbox)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="relative min-h-[200px] flex-1">
            <PipelineCanvas />
            {/* On desktop the notice sits at the foot of the canvas, clear of
                the chips the player is wiring (#2274). */}
            {!touch ? toast : null}
            {tracerDone && !waveSummary ? (
              <button
                type="button"
                onClick={() => void init("full")}
                className="absolute right-3 top-3 z-10 min-h-9 border border-amber-500 bg-[#0d0e11] px-3 font-mono text-xs text-amber-400"
              >
                Start the full study
              </button>
            ) : null}
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
        <span>
          Seed #{view?.seed ?? DEFAULT_SEED}
          {dailyDate ? ` · Arcade Daily ${dailyDate}` : ""}
        </span>
        {/* Below a 1024px cabinet the key hints give way to the gate badges;
            each control still names its key (#2274). */}
        <span className={hintClass}>[Space] Pause</span>
        <span className={hintClass}>[N] Step</span>
        <span className={hintClass}>[S] Skip</span>
        <span className={hintClass}>[I] Inspect</span>
        <span className={hintClass}>[Esc] Return</span>
        {touch ? null : (
          <span
            role="group"
            aria-label="Gates"
            className="flex items-center gap-1.5 @5xl:hidden"
          >
            <GateBadges />
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {touch ? null : <SaveButtons compact />}
        </span>
        <span>engine: {mode ?? "starting"}</span>
      </footer>

      <div role="status" aria-live="polite" className="sr-only">
        {notice?.text}
      </div>
      {touch && notice && notice.text !== pausedReason ? toast : null}

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
