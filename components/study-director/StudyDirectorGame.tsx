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
  phaseForDay,
  resolveEvent,
  type StudyEvent,
  type StudyState,
} from "@/lib/study-director";
import {
  DashboardPanel,
  MetersPanel,
  SitesPanel,
  TeamPanel,
  Card,
} from "./Panels";
import { ReportView } from "./ReportView";
import { PHASE_LABELS, URGENCY_LABELS } from "./labels";
import { clearStudySave, loadStudySave, saveStudy } from "./useStudySave";

const URGENCY_TONE = {
  critical: "border-red-500/60 text-red-400",
  important: "border-amber-500/60 text-amber-400",
  routine: "border-zinc-700 text-zinc-400",
} as const;

function newStudy(): StudyState {
  const seed = `sd-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return beginStudy(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );
}

const money = (n: number): string =>
  `$${Math.round(n / 1000).toLocaleString("en-US")}K`;

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
  const phase = phaseForDay(state.day, state.setup.durationDays);
  const total = state.setup.durationDays + state.slipDays;
  const criticalOpen = events.filter((e) => e.urgency === "critical").length;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      onKeyDown={handleKeyDown}
      className="space-y-3 p-2 font-mono text-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-amber-500 sm:p-3"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>

      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-zinc-800 bg-[#13151a] px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-100">
            Study {state.setup.id} · {PHASE_LABELS[phase]}
          </p>
          <p className="text-[11px] text-zinc-400">
            {state.setup.sponsor.name}
          </p>
        </div>
        <p className="text-xs tabular-nums">
          Day {Math.min(state.day, total)} / {total}
          {state.slipDays > 0 ? (
            <span className="text-amber-400"> (+{state.slipDays})</span>
          ) : null}
        </p>
        <p className="text-xs tabular-nums">
          {money(state.spent)} of {money(state.setup.budget)}
        </p>
        <div
          className="flex items-center gap-1.5"
          role="img"
          aria-label={`${state.attention} of ${ATTENTION_PER_DAY} attention left today${state.routine > 0 ? `, ${state.routine} taken by routine work` : ""}`}
          title={
            state.routine > 0
              ? `${state.routine} attention went to routine work: open queries and unrecorded decisions.`
              : undefined
          }
        >
          <span className="text-[11px] text-zinc-400">Attention</span>
          {Array.from({ length: ATTENTION_PER_DAY }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-2.5 w-2.5 ${
                i < state.attention
                  ? "bg-amber-500"
                  : i >= ATTENTION_PER_DAY - state.routine
                    ? "border border-dashed border-zinc-500"
                    : "bg-zinc-700"
              }`}
            />
          ))}
        </div>
      </header>

      {!report && running ? (
        <Card
          title={selected ? selected.subject : "Decision"}
          hint={selected?.from}
        >
          {selected ? (
            <div className="space-y-3">
              <p className="max-w-3xl text-sm break-words text-zinc-200">
                {selected.body}
              </p>
              <ul className="grid gap-2 md:grid-cols-2">
                {selected.options.map((option, index) => {
                  const cost =
                    option.attentionCost +
                    (documented ? DOCUMENTATION_ATTENTION : 0);
                  const blocked = cost > state.attention;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => choose(selected, option.id)}
                        disabled={blocked}
                        className="flex min-h-[44px] w-full min-w-0 items-start gap-2 border border-zinc-700 px-3 py-2 text-left text-xs hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <kbd className="mt-0.5 border border-zinc-600 px-1 text-[10px] text-zinc-300">
                          {index + 1}
                        </kbd>
                        <span className="min-w-0 flex-1 break-words">
                          {option.label}
                        </span>
                        <span className="shrink-0 text-amber-400 tabular-nums">
                          {cost} attn
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={documented}
                  onChange={(e) => setDocumented(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Document this decision (+{DOCUMENTATION_ATTENTION} attention).
                Skipped documentation is remembered.
              </label>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              Nothing needs an answer right now.
            </p>
          )}
        </Card>
      ) : null}

      {running ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={finishDay}
            className="min-h-[44px] border border-amber-500 bg-amber-500/10 px-4 text-sm font-bold text-amber-300 hover:bg-amber-500/20"
          >
            End day
          </button>
          {events.length === 0 ? (
            <button
              type="button"
              onClick={skipQuietDays}
              className="min-h-[44px] border border-zinc-600 px-4 text-sm text-zinc-200 hover:border-amber-500"
            >
              Skip to next message
            </button>
          ) : null}
          <p className="text-[11px] text-zinc-400">
            {criticalOpen > 0
              ? `${criticalOpen} critical message${criticalOpen === 1 ? "" : "s"} will lapse if you end the day.`
              : events.length === 0
                ? "Nothing is waiting. Keys: E end day, N skip to the next message."
                : "Keys: 1-5 choose, D document, J/K move, E end day."}
          </p>
        </div>
      ) : null}

      {report ? (
        <ReportView report={report} onRestart={restart} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <TeamPanel state={state} />
            <SitesPanel
              state={state}
              canAudit={running && state.attention >= 2}
              onAudit={audit}
            />
          </div>
          <div className="space-y-3">
            <DashboardPanel state={state} />
            <MetersPanel state={state} />
          </div>
          <div className="space-y-3">
            <Card
              title="Inbox"
              hint={`${events.length} open${criticalOpen ? `, ${criticalOpen} critical` : ""}`}
            >
              {events.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  Inbox zero. Enjoy it. End the day when you are ready.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {events.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(event.id)}
                        aria-current={selected?.id === event.id}
                        className={`w-full min-w-0 border px-2 py-1.5 text-left ${selected?.id === event.id ? "border-amber-500 bg-amber-500/5" : "border-zinc-800 hover:border-zinc-600"}`}
                      >
                        <span
                          className={`mr-2 border px-1 text-[10px] uppercase ${URGENCY_TONE[event.urgency]}`}
                        >
                          {URGENCY_LABELS[event.urgency]}
                        </span>
                        <span className="text-xs break-words text-zinc-100">
                          {event.subject}
                        </span>
                        <span className="block text-[11px] break-words text-zinc-400">
                          {event.from}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {notice ? (
        <p className="text-[11px] text-zinc-400" aria-hidden="true">
          {notice}
        </p>
      ) : null}
    </div>
  );
};
