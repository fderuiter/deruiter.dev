"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  CLINICAL_JOURNEY,
  JOURNEY_EVIDENCE_LABELS,
  PLANNED_JOURNEY_ITEMS,
  RELATED_CASE_STUDIES,
  RELATED_GAMES,
  RELATED_GAME_LABEL,
  journeyIssueUrl,
  journeyPlacement,
} from "@/lib/clinical-journey";

interface ClinicalJourneyNavProps {
  /** The page's own path, which places it in the journey. */
  readonly path: string;
  /**
   * `responsive` shows the whole panel from `sm` up and folds it to one line
   * on phones (#2896). `compact` folds it at every width, for workbench pages
   * whose tool should start above the fold: the steps stay visible as one row
   * from `sm` up, and the step's purpose and related work open on request.
   */
  readonly variant?: "responsive" | "compact";
  readonly className?: string;
}

const LINK =
  "underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

/**
 * Where a page sits in the clinical data journey: every step in order, the
 * previous and next step, what the page's evidence is drawn from, and the
 * related or planned work around it. Renders nothing off the journey.
 */
export function ClinicalJourneyNav({
  path,
  variant = "responsive",
  className = "",
}: ClinicalJourneyNavProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const placement = journeyPlacement(path);
  if (!placement) return null;
  const { step, isStep } = placement;
  const index = CLINICAL_JOURNEY.indexOf(step);
  const previous = isStep ? CLINICAL_JOURNEY[index - 1] : undefined;
  const next = isStep ? CLINICAL_JOURNEY[index + 1] : undefined;
  const related = RELATED_CASE_STUDIES.filter(
    (study) => study.step === step.id && `/case-studies/${study.slug}` !== path
  );
  const games = isStep
    ? RELATED_GAMES.filter((game) => game.step === step.id)
    : [];
  const planned = PLANNED_JOURNEY_ITEMS.filter((item) => item.step === step.id);
  const compact = variant === "compact";

  // One set of elements serves every width; classes decide what a folded
  // panel hides, so no link is ever rendered twice.
  const stepsClass = expanded ? "flex" : "hidden sm:flex";
  const detailsClass = expanded
    ? "block"
    : compact
      ? "hidden"
      : "hidden sm:block";
  const toggleClass = compact ? "inline-flex" : "inline-flex sm:hidden";

  return (
    <nav
      aria-label="Clinical data journey"
      className={`section-isolate min-w-0 border border-white/[0.08] bg-[#13151a] text-sm text-slate-300 ${compact ? "px-4 py-2" : "px-4 py-2 sm:p-5"} ${className}`}
    >
      {/* On a phone the toggle shares the first line with a shortened
          eyebrow and only the next step stays out; the previous step is in
          the step list one tap away. From sm up the links come first and the
          toggle follows them. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          <span className="hidden lg:inline">Clinical data </span>
          {isStep
            ? `journey / step ${index + 1} of ${CLINICAL_JOURNEY.length}`
            : `journey / related to step ${index + 1}`}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((open) => !open)}
          className={`${toggleClass} min-h-11 items-center gap-1 text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:order-last`}
        >
          {compact ? "About this step" : "All steps"}
          <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </button>
        {(previous || next) && (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 sm:ml-auto sm:w-auto">
            {previous && (
              <Link
                href={previous.href}
                className={`hidden min-h-11 items-center break-words sm:inline-flex ${LINK}`}
              >
                ← Previous step: {previous.title}
              </Link>
            )}
            {next && (
              <Link
                href={next.href}
                className={`inline-flex min-h-11 items-center break-words text-amber-300 hover:text-amber-200 ${LINK}`}
              >
                Next step: {next.title} →
              </Link>
            )}
          </div>
        )}
      </div>
      <ol
        className={`${stepsClass} mt-1 min-w-0 flex-wrap gap-x-4 gap-y-2 sm:mt-3`}
      >
        {CLINICAL_JOURNEY.map((item, position) => (
          <li key={item.id} className="min-w-0">
            {isStep && item.id === step.id ? (
              <span
                aria-current="step"
                className="font-semibold text-white break-words"
              >
                {position + 1}.{" "}
                <span className={compact ? "sr-only" : undefined}>
                  {item.stage}:{" "}
                </span>
                {item.title}
              </span>
            ) : (
              <Link href={item.href} className={`break-words ${LINK}`}>
                {position + 1}.{" "}
                <span className={compact ? "sr-only" : undefined}>
                  {item.stage}:{" "}
                </span>
                {item.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <div id={detailsId} className={`${detailsClass} mt-3 pb-2 sm:pb-0`}>
        <p className="break-words">
          {isStep ? (
            <>
              {step.purpose}{" "}
              <span className="text-slate-400">
                Evidence:{" "}
                {step.evidence
                  .map((kind) => JOURNEY_EVIDENCE_LABELS[kind])
                  .join(", ")}
                .
              </span>
            </>
          ) : (
            <>
              This case study describes one of Fred&apos;s own projects: real
              code, not the synthetic demo. The demo for the same step is{" "}
              <Link href={step.href} className={`text-slate-100 ${LINK}`}>
                {step.title}
              </Link>
              .
            </>
          )}
        </p>
        {(related.length > 0 || games.length > 0 || planned.length > 0) && (
          <ul className="mt-3 space-y-1 break-words">
            {related.map((study) => (
              <li key={study.slug}>
                <Link
                  href={`/case-studies/${study.slug}`}
                  className={`text-slate-100 ${LINK}`}
                >
                  {study.title} case study
                </Link>{" "}
                <span className="text-slate-400">
                  ({JOURNEY_EVIDENCE_LABELS["own-project"]}): {study.relation}
                </span>
              </li>
            ))}
            {games.map((game) => (
              <li key={game.href}>
                <Link href={game.href} className={`text-slate-100 ${LINK}`}>
                  {game.title}
                </Link>{" "}
                <span className="text-slate-400">
                  ({RELATED_GAME_LABEL}): {game.relation}
                </span>
              </li>
            ))}
            {planned.map((item) => (
              <li key={item.issue}>
                <span className="text-slate-100">Planned: {item.title}</span>{" "}
                <a
                  href={journeyIssueUrl(item.issue)}
                  className={`text-slate-400 ${LINK}`}
                >
                  issue #{item.issue}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
