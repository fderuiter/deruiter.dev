"use client";

import React, { useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { IconArrowLeft, IconBook2, IconRefresh } from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { CopyButton } from "@/components/ui/CopyButton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { getActiveHostUrl } from "@/lib/clipboard";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import {
  SIMULATOR_AXES,
  SIMULATOR_FINAL_STEP,
  SIMULATOR_QUESTIONS,
  SIMULATOR_START_STEP,
  deriveSimulatorState,
  evaluateDecisions,
  formatSimulatorReport,
  parseAnswerIndices,
  type SimulatorOption,
  type SimulatorQuestion,
} from "@/lib/simulator";
import { getNavBreadcrumbParents } from "@/lib/navigation";

const GAUGE_RADIUS = 60;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const BIAS_LABEL = { systems: "Systems bias", ui: "Interface bias" } as const;
const STANCE_LABEL = {
  resilience: "Resilience stance",
  velocity: "Velocity stance",
} as const;

const axisLabel = (key: string): string =>
  SIMULATOR_AXES.find((axis) => axis.key === key)?.label ?? key;

export default function ArchetypeSimulatorClient() {
  const { recordEvent } = useTelemetry();
  const { playNote, playSuccess } = useAudio();
  const { announce } = useAnnouncer();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { params, setParams } = useStudioHashParams();

  // The hash is the single source of truth: step, history and answers are
  // derived from it, so deep links, Back/Forward and in-app navigation all
  // flow through useStudioHashParams, and the server snapshot (empty params)
  // keeps the first client render identical to the SSR markup.
  const { currentStep, history, answers } = useMemo(
    () => deriveSimulatorState(params.step, params.ans),
    [params.step, params.ans]
  );

  const question: SimulatorQuestion | null =
    currentStep === SIMULATOR_FINAL_STEP
      ? null
      : SIMULATOR_QUESTIONS[currentStep];

  const evaluation = useMemo(
    () =>
      currentStep === SIMULATOR_FINAL_STEP ? evaluateDecisions(answers) : null,
    [currentStep, answers]
  );

  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;
    recordEvent("simulator", "page_view", { defer: true });
  }, [recordEvent]);

  // Move focus to the active step's heading once the transition settles, so
  // keyboard and screen reader users land on the new question (or the
  // result) rather than on the button that no longer exists.
  useEffect(() => {
    const timer = setTimeout(() => {
      headingRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const handleSelectOption = useCallback(
    (option: SimulatorOption, optionIndex: number) => {
      playNote(440 + answers.length * 110, 0.1);
      const nextStep = option.nextStep;
      // Only the answers that replayed are kept, so junk trailing indices in
      // a hand-edited hash cannot strand the new answer behind them.
      const nextAnsIndices = [
        ...parseAnswerIndices(params.ans).slice(0, answers.length),
        optionIndex,
      ];

      setParams(
        { step: nextStep, ans: nextAnsIndices.join(",") },
        { replace: false }
      );

      recordEvent("simulator", "simulator_option_select");
      if (nextStep === SIMULATOR_FINAL_STEP) {
        recordEvent("simulator", "simulator_milestone_reached");
        playSuccess();
      } else {
        announce("Step completed", "polite");
      }
    },
    [
      answers.length,
      params.ans,
      playNote,
      playSuccess,
      recordEvent,
      announce,
      setParams,
    ]
  );

  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const previousStep = history[history.length - 1];
    const newAnsIndices = parseAnswerIndices(params.ans).slice(
      0,
      history.length - 1
    );

    setParams(
      {
        step: previousStep === SIMULATOR_START_STEP ? null : previousStep,
        ans: newAnsIndices.length > 0 ? newAnsIndices.join(",") : null,
      },
      { replace: false }
    );
  }, [history, params.ans, setParams]);

  const handleReset = useCallback(() => {
    setParams({ step: null, ans: null }, { replace: false });
  }, [setParams]);

  const buildReport = useCallback(() => {
    if (!evaluation) return "";
    const ans = parseAnswerIndices(params.ans)
      .slice(0, answers.length)
      .join(",");
    return formatSimulatorReport(
      evaluation,
      answers,
      `${getActiveHostUrl()}/simulator#step=${SIMULATOR_FINAL_STEP}&ans=${ans}`
    );
  }, [evaluation, answers, params.ans]);

  // Announce the result once it renders, including a deep-linked result.
  useEffect(() => {
    if (!evaluation) return;
    const stats = SIMULATOR_AXES.map(
      ({ key, label }) => `${label} ${evaluation.stats[key]}`
    ).join(", ");
    announce(
      `Evaluation complete. Architectural Archetype: ${evaluation.archetype.title}. ${stats}.`,
      "assertive"
    );
  }, [evaluation, announce]);

  const leadStat = evaluation ? evaluation.stats[evaluation.leadAxis] : 0;
  const leadLabel = evaluation ? axisLabel(evaluation.leadAxis) : "";

  return (
    <PageLayout
      variant="standard"
      className="bg-[#0d0e11] text-foreground relative flex flex-col items-center justify-start"
    >
      <div className="w-full max-w-2xl mx-auto relative flex flex-col items-center min-w-0">
        {/* Navigation Breadcrumb */}
        <div className="w-full flex items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-4 flex-wrap">
          <Breadcrumbs
            items={[
              ...getNavBreadcrumbParents("/simulator"),
              { label: "Incident Simulator" },
            ]}
          />
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border border-zinc-800 tabular-nums">
            3 decisions · 4 axes
          </span>
        </div>

        {/* Top Header */}
        <div className="flex items-center justify-between w-full mb-8">
          {history.length > 0 && currentStep !== SIMULATOR_FINAL_STEP ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <IconArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <FieldManualButton manualId="simulator" label="Simulator Manual" />
        </div>

        {/* Main Content Card Container */}
        <div className="w-full min-w-0">
          <AnimatePresence mode="wait">
            {question && (
              <motion.section
                key={question.id}
                aria-labelledby="simulator-step-heading"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-[#13151a] border border-white/[0.08] rounded-2xl p-5 sm:p-10 flex flex-col"
              >
                {/* Stage Badge */}
                <p className="inline-flex items-center gap-2 text-xs font-mono text-amber-500 tracking-widest uppercase font-bold mb-3 tabular-nums">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-500"
                    aria-hidden="true"
                  />
                  {question.badge}
                </p>

                <h2
                  id="simulator-step-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-[-0.035em] mb-2 break-words focus:outline-none"
                >
                  {question.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed mb-8">
                  {question.subtitle}
                </p>

                <div className="flex flex-col gap-4">
                  {question.options.map((opt, idx) => (
                    <button
                      type="button"
                      key={opt.text}
                      onClick={() => handleSelectOption(opt, idx)}
                      className="group flex flex-col text-left p-4 sm:p-5 rounded-xl bg-[#0d0e11] border border-zinc-800 hover:border-amber-500/50 focus-visible:border-amber-500/60 transition-colors duration-200 cursor-pointer active:scale-[0.98] min-w-0"
                    >
                      <span className="flex items-center justify-between gap-2 w-full mb-1 min-w-0">
                        <span className="text-sm sm:text-base font-bold text-zinc-200 group-hover:text-amber-400 transition-colors break-words min-w-0">
                          {opt.text}
                        </span>
                        <span
                          className="text-xs font-mono text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0"
                          aria-hidden="true"
                        >
                          &rarr;
                        </span>
                      </span>
                      <span className="text-xs text-zinc-400 font-sans leading-relaxed mt-1">
                        {opt.description}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {evaluation && (
              <motion.section
                key="final"
                aria-labelledby="simulator-result-heading"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="bg-[#13151a] border border-white/[0.08] rounded-2xl p-5 sm:p-10 flex flex-col items-center text-center"
              >
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-4">
                  Architectural Archetype
                </p>

                {/* Lead-axis gauge */}
                <div
                  className="relative flex items-center justify-center mb-6"
                  role="img"
                  aria-label={`Lead axis: ${leadLabel}, ${leadStat} out of 100`}
                >
                  <svg
                    className="w-36 h-36 -rotate-90"
                    viewBox="0 0 144 144"
                    aria-hidden="true"
                  >
                    <circle
                      cx="72"
                      cy="72"
                      r={GAUGE_RADIUS}
                      stroke="#27272a"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="72"
                      cy="72"
                      r={GAUGE_RADIUS}
                      stroke="#f59e0b"
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="transparent"
                      strokeDasharray={GAUGE_CIRCUMFERENCE}
                      initial={{ strokeDashoffset: GAUGE_CIRCUMFERENCE }}
                      animate={{
                        strokeDashoffset:
                          GAUGE_CIRCUMFERENCE -
                          (GAUGE_CIRCUMFERENCE * leadStat) / 100,
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </svg>
                  <div
                    className="absolute flex flex-col items-center"
                    aria-hidden="true"
                  >
                    <span className="text-3xl font-extrabold text-zinc-100 tracking-tighter font-mono tabular-nums">
                      {leadStat}
                    </span>
                    <span className="text-[9px] font-mono uppercase text-amber-500 font-bold tracking-widest">
                      {leadLabel}
                    </span>
                  </div>
                </div>

                <ul
                  className="flex flex-wrap justify-center gap-2 mb-3"
                  aria-label="Decision profile"
                >
                  <li className="px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-400 text-[11px] font-mono font-bold">
                    {BIAS_LABEL[evaluation.archetype.bias]}
                  </li>
                  <li className="px-2.5 py-1 rounded-full border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold">
                    {STANCE_LABEL[evaluation.archetype.stance]}
                  </li>
                </ul>

                <h2
                  id="simulator-result-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-2xl font-extrabold text-zinc-100 tracking-[-0.035em] mb-2 break-words focus:outline-none"
                >
                  {evaluation.archetype.title}
                </h2>

                <p className="text-xs md:text-sm text-zinc-400 font-sans max-w-md leading-relaxed mb-6">
                  {evaluation.archetype.summary}
                </p>

                {/* Four-axis decision stats */}
                <div className="w-full mb-6 text-left">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
                    Decision stats
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SIMULATOR_AXES.map(({ key, label }) => {
                      const value = evaluation.stats[key];
                      const isLead = key === evaluation.leadAxis;
                      return (
                        <li
                          key={key}
                          className="bg-[#0d0e11] border border-zinc-800 rounded-lg p-3 min-w-0"
                        >
                          <div className="flex items-baseline justify-between gap-2 mb-2 font-mono">
                            <span
                              id={`simulator-stat-${key}`}
                              className="text-[10px] uppercase tracking-wider text-zinc-400"
                            >
                              {label}
                            </span>
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                isLead ? "text-amber-400" : "text-zinc-200"
                              }`}
                              aria-hidden="true"
                            >
                              {value}
                            </span>
                          </div>
                          <div
                            role="meter"
                            aria-labelledby={`simulator-stat-${key}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={value}
                            aria-valuetext={`${value} out of 100`}
                            className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden"
                          >
                            <div
                              className={`h-full rounded-full ${
                                isLead ? "bg-amber-500" : "bg-slate-400"
                              }`}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                  <CopyButton
                    text={buildReport}
                    label="Copy Report"
                    copiedLabel="Copied!"
                    successMessage="Architectural archetype report copied to clipboard"
                    errorMessage="Unable to copy the archetype report to clipboard"
                    onCopySuccess={() =>
                      recordEvent("simulator", "simulator_report_copy")
                    }
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                  />
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0d0e11] border border-zinc-800 hover:border-zinc-600 text-zinc-300 font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    <IconRefresh className="w-4 h-4" aria-hidden="true" />
                    <span>Run Again</span>
                  </button>
                  <Link
                    href="/case-studies"
                    onClick={() => recordEvent("simulator", "project_click")}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0d0e11] border border-zinc-800 hover:border-zinc-600 text-zinc-300 font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-colors active:scale-[0.98]"
                  >
                    <IconBook2 className="w-4 h-4" aria-hidden="true" />
                    <span>Case Studies</span>
                  </Link>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Sequential Next / Prev Flow */}
        <NextPrevNav
          prev={{
            title: "Logical Proof Workspace",
            href: "/proof",
            label: "Formal Methods",
            tag: "Deductive Logic Engine",
          }}
          next={{
            title: "Schedule 1:1 Consultation",
            href: "/schedule",
            label: "Get In Touch",
            tag: "Google Calendar Booking",
          }}
          backToHub={{
            title: "Return to Portfolio",
            href: "/",
          }}
        />
      </div>
    </PageLayout>
  );
}
