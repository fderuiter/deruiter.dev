"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ATTENTION_PER_DAY,
  AUDIT_ATTENTION,
  DOCUMENTATION_ATTENTION,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  auditSite,
  beginStudy,
  createStudy,
  endDay,
  finalizeStudy,
  inbox,
  resolveEvent,
  type StudyEvent,
  type StudyState,
} from "@/lib/study-director";
import { DashboardPanel, MetersPanel, SitesPanel, TeamPanel } from "./Panels";
import { DecisionPanel } from "./DecisionPanel";
import { InboxPanel } from "./InboxPanel";
import { StatusBar } from "./StatusBar";
import { money } from "./format";
import { ReportView } from "./ReportView";
import { clearStudySave, loadStudySave, saveStudy } from "./useStudySave";

function newStudy(): StudyState {
  const seed = `sd-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return beginStudy(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );
}

/**
 * The Study Director desk: dashboard, inbox, team, sites and a decision
 * panel. All rules live in `lib/study-director`; this is a thin adapter.
 */
export const StudyDirectorGame: React.FC = () => {
  const [state, setState] = useState<StudyState | null>(null);
  const [saved, setSaved] = useState<StudyState | null>(() => loadStudySave());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documented, setDocumented] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (state) saveStudy(state);
  }, [state]);

  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hasBriefing = state === null;
  useEffect(() => {
    if (hasBriefing) primaryRef.current?.focus({ preventScroll: true });
  }, [hasBriefing]);
  const active = state !== null;
  useEffect(() => {
    if (!active) return;
    rootRef.current?.focus({ preventScroll: true });
    const top = rootRef.current?.getBoundingClientRect().top;
    if (top !== undefined) {
      // Clear the fixed site header so the day and attention readout stay visible.
      window.scrollTo({ top: window.scrollY + top - 88, behavior: "instant" });
    }
  }, [active]);

  const events = useMemo(() => (state ? inbox(state) : []), [state]);
  const selected: StudyEvent | undefined =
    events.find((e) => e.id === selectedId) ?? events[0];
  const report = useMemo(
    () => (state && state.status === "complete" ? finalizeStudy(state) : null),
    [state]
  );

  const start = useCallback((next: StudyState) => {
    setState(next);
    setSaved(null);
    setSelectedId(null);
    setDocumented(false);
    setNotice(`Day ${next.day}. ${inbox(next).length} new messages.`);
  }, []);

  const choose = useCallback(
    (event: StudyEvent, optionId: string) => {
      if (!state) return;
      const result = resolveEvent(state, event.id, optionId, documented);
      if (!result.ok) {
        setNotice(
          result.reason === "not-enough-attention"
            ? "Not enough attention left today. Try a cheaper option or end the day."
            : "That message is no longer open."
        );
        return;
      }
      const label = event.options.find((o) => o.id === optionId)?.label ?? "";
      setState(result.state);
      setSelectedId(null);
      setDocumented(false);
      setNotice(
        `${label}. ${documented ? "Documented." : "Not documented."} ${result.state.attention} attention left.`
      );
    },
    [state, documented]
  );

  const audit = useCallback(
    (siteId: string) => {
      if (!state) return;
      const result = auditSite(state, siteId);
      if (!result.ok) {
        setNotice("Not enough attention left to audit today.");
        return;
      }
      setState(result.state);
      setNotice(
        `Audited ${result.report.siteId}. The real numbers are on the Sites panel.`
      );
    },
    [state]
  );

  const finishDay = useCallback(() => {
    if (!state) return;
    const next = endDay(state);
    setState(next);
    setSelectedId(null);
    setDocumented(false);
    setNotice(
      next.status === "complete"
        ? "The study is complete."
        : `Day ${next.day}. ${inbox(next).length} messages in the inbox.`
    );
  }, [state]);

  const skipQuietDays = useCallback(() => {
    if (!state) return;
    let next = endDay(state);
    let skipped = 1;
    while (
      next.status === "running" &&
      inbox(next).length === 0 &&
      skipped < 30
    ) {
      next = endDay(next);
      skipped += 1;
    }
    setState(next);
    setSelectedId(null);
    setDocumented(false);
    setNotice(
      next.status === "complete"
        ? "The study is complete."
        : `Skipped ${skipped} days to day ${next.day}. ${inbox(next).length} messages in the inbox.`
    );
  }, [state]);

  const restart = useCallback(() => {
    clearStudySave();
    setState(null);
    setSaved(null);
    setNotice("");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      !state ||
      state.status !== "running" ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    const key = e.key.toLowerCase();
    if (key === "e") {
      e.preventDefault();
      finishDay();
    } else if (key === "n" && events.length === 0) {
      e.preventDefault();
      skipQuietDays();
    } else if (key === "d") {
      e.preventDefault();
      setDocumented((v) => !v);
    } else if ((key === "j" || key === "k") && events.length > 0) {
      e.preventDefault();
      const index = Math.max(
        0,
        events.findIndex((x) => x.id === selected?.id)
      );
      const next =
        (index + (key === "j" ? 1 : events.length - 1)) % events.length;
      setSelectedId(events[next].id);
    } else if (/^[1-5]$/.test(key) && selected) {
      const option = selected.options[Number(key) - 1];
      if (option) {
        e.preventDefault();
        choose(selected, option.id);
      }
    }
  };

  if (!state) {
    return (
      <div
        className="space-y-4 p-4 font-mono text-zinc-200"
        data-testid="study-briefing"
      >
        <h2 className="text-lg font-bold text-zinc-100">
          Study {STUDY_24_081.id}: {STUDY_24_081.design}
        </h2>
        <dl className="grid max-w-xl grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-zinc-400">Sponsor</dt>
          <dd>{STUDY_24_081.sponsor.name} (first-time biotech)</dd>
          <dt className="text-zinc-400">Phase</dt>
          <dd>{STUDY_24_081.clinicalPhase}</dd>
          <dt className="text-zinc-400">Sites / subjects</dt>
          <dd>3 sites, {STUDY_24_081.subjects} subjects</dd>
          <dt className="text-zinc-400">Timeline / budget</dt>
          <dd>
            {Math.round(STUDY_24_081.durationDays / 7)} weeks,{" "}
            {money(STUDY_24_081.budget)}
          </dd>
          <dt className="text-zinc-400">Protocol</dt>
          <dd>Questionable maturity, high operational complexity</dd>
        </dl>
        <ul className="max-w-xl list-inside list-disc space-y-1 text-xs text-zinc-300">
          <li>
            You have {ATTENTION_PER_DAY} attention each day. Answering,
            delegating and auditing all spend it.
          </li>
          <li>
            Documenting a decision costs {DOCUMENTATION_ATTENTION} more. Skipped
            documentation comes back at the FDA inspection.
          </li>
          <li>
            A backlog of open queries and unrecorded decisions takes attention
            before you decide anything. Dashed pips show it.
          </li>
          <li>
            The dashboard shows what people report. Audit a site to see what is
            true.
          </li>
          <li>You cannot keep all six meters high. Choose what to protect.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            ref={saved && saved.status === "running" ? undefined : primaryRef}
            onClick={() => start(newStudy())}
            className="min-h-[44px] border border-amber-500 bg-amber-500/10 px-4 text-sm font-bold text-amber-300 hover:bg-amber-500/20"
          >
            Start the study
          </button>
          {saved && saved.status === "running" ? (
            <button
              type="button"
              ref={primaryRef}
              onClick={() => start(saved)}
              className="min-h-[44px] border border-zinc-600 px-4 text-sm text-zinc-200 hover:border-amber-500"
            >
              Resume day {saved.day}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const running = state.status === "running";
  const criticalOpen = events.filter((e) => e.urgency === "critical").length;

  const actions = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={finishDay}
        className="min-h-[44px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-4 text-sm font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
      >
        End day
      </button>
      {events.length === 0 ? (
        <button
          type="button"
          onClick={skipQuietDays}
          className="min-h-[44px] border border-zinc-600 px-4 text-sm text-zinc-200 hover:border-[var(--sd-amber)] active:scale-[0.98]"
        >
          Skip to next message
        </button>
      ) : null}
      <div className="min-w-0 flex-1 basis-56">
        <p
          className={`text-[11px] ${criticalOpen > 0 ? "font-semibold text-red-400" : "text-[var(--sd-muted)]"}`}
        >
          {criticalOpen > 0
            ? `${criticalOpen} critical message${criticalOpen === 1 ? "" : "s"} will lapse if you end the day.`
            : events.length === 0
              ? "Nothing is waiting. Keys: E end day, N skip to the next message."
              : "Keys: 1-5 choose, D document, J/K move, E end day."}
        </p>
        {notice ? (
          <p
            className="mt-0.5 truncate text-[11px] text-zinc-300"
            aria-hidden="true"
            title={notice}
          >
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      data-sd-desk=""
      onKeyDown={handleKeyDown}
      className="space-y-3 bg-[var(--sd-bg)] p-2 font-mono text-[var(--sd-text)] outline-none focus-visible:ring-1 focus-visible:ring-amber-500 sm:p-3"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>

      <StatusBar state={state} />

      {report ? (
        <ReportView report={report} onRestart={restart} />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,230px)] xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,280px)]">
            <div className="min-w-0 space-y-3">
              <InboxPanel
                events={events}
                selectedId={selected?.id}
                onSelect={setSelectedId}
              />
              <DashboardPanel state={state} />
            </div>
            <DecisionPanel
              event={running ? selected : undefined}
              attention={state.attention}
              documented={documented}
              onDocumentedChange={setDocumented}
              onChoose={choose}
              footer={running ? actions : null}
            />
            <div className="min-w-0 space-y-3">
              <MetersPanel state={state} />
              <TeamPanel state={state} />
            </div>
          </div>
          <SitesPanel
            state={state}
            canAudit={running && state.attention >= AUDIT_ATTENTION}
            onAudit={audit}
          />
        </>
      )}
    </div>
  );
};
