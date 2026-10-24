"use client";

import type {
  HandoffActivity,
  HandoffAssumption,
  HandoffReport,
} from "@/lib/study-data";
import { BUTTON_SECONDARY, PANEL } from "./ui";

const ACTIVITY_REASON: Record<
  NonNullable<HandoffActivity["reason"]>,
  string
> = {
  "no-domain": "no SDTM domain is named for it",
  "domain-not-generated": "the generator does not produce this domain",
  "no-modelled-tests": "none of its tests is one the generator models",
};

const ASSUMPTION: Record<HandoffAssumption, string> = {
  "single-arm":
    "The study defines no arms, so every randomized subject is assigned to one arm, Study treatment (TRT).",
  "epochs-from-study-day":
    "The study defines no epochs, so visits before Day 1 are placed in a Screening epoch and the rest in a Treatment epoch.",
  "elements-per-epoch":
    "The study defines no study cells, so each epoch gets one element and every arm passes through them in order.",
};

interface HandoffPanelProps {
  readonly report: HandoffReport;
  readonly onUseDemo: () => void;
  readonly onDownload: () => void;
}

function list(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.join(", ");
}

/**
 * What the pipeline will do with a study handed over from CRF Studio, shown
 * before the visitor runs it: the domains it tabulates, the activities and
 * concepts it leaves out and why, and the design gaps it fills.
 */
export function HandoffPanel({
  report,
  onUseDemo,
  onDownload,
}: HandoffPanelProps) {
  const tabulated = report.activities.filter((activity) => activity.tabulated);
  const skipped = report.activities.filter((activity) => !activity.tabulated);
  const unitNotes = tabulated.flatMap((activity) =>
    activity.tests
      .filter((test) => test.sourceUnit)
      .map(
        (test) =>
          `${test.testCode} is generated in ${test.unit}; the form collects ${test.sourceUnit}.`
      )
  );
  const skippedConcepts = tabulated.flatMap((activity) =>
    activity.skippedConcepts.map((concept) => ({
      activity: activity.name,
      ...concept,
    }))
  );

  return (
    <div
      className={`${PANEL} mt-6 border-amber-500/40 p-4 sm:p-5`}
      aria-labelledby="handoff-title"
      role="region"
    >
      <h3 id="handoff-title" className="text-sm font-semibold text-white">
        Study from CRF Studio: {report.studyId}
      </h3>
      <p className="mt-1 break-words text-xs leading-relaxed text-slate-300">
        {report.title}
      </p>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-300">
        The pipeline runs the part of this study it can generate synthetic data
        for. Check what it will tabulate, then run it with the seed and subject
        count above. SV, EX and DS are always derived from the simulated visits,
        dosing and disposition.
      </p>

      <dl className="mt-4 grid min-w-0 gap-3 text-xs sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="font-mono uppercase tracking-[0.14em] text-emerald-300">
            Tabulated
          </dt>
          <dd className="mt-1 break-words text-slate-200">
            {list(report.tabulatedDomains)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-mono uppercase tracking-[0.14em] text-amber-300">
            Not tabulated
          </dt>
          <dd className="mt-1 break-words text-slate-200">
            {list(report.notTabulatedDomains)}
          </dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1 text-xs leading-relaxed text-slate-300">
        {tabulated.map((activity) => (
          <li key={activity.id} className="break-words">
            <span className="text-slate-100">{activity.name}</span> (
            {activity.domain})
            {activity.tests.length > 0
              ? `: ${activity.tests.map((test) => test.testCode).join(", ")}`
              : ""}
          </li>
        ))}
        {skipped.map((activity) => (
          <li key={activity.id} className="break-words">
            <span className="text-slate-100">{activity.name}</span>
            {activity.domain ? ` (${activity.domain})` : ""} is not tabulated:{" "}
            {activity.reason ? ACTIVITY_REASON[activity.reason] : ""}.
          </li>
        ))}
      </ul>

      {skippedConcepts.length > 0 ? (
        <details className="mt-3 text-xs text-slate-300">
          <summary className="cursor-pointer text-slate-200">
            {skippedConcepts.length} form{" "}
            {skippedConcepts.length === 1 ? "item" : "items"} left out of
            tabulated activities
          </summary>
          <ul className="mt-2 space-y-1">
            {skippedConcepts.map((concept) => (
              <li key={concept.conceptId} className="break-words">
                {concept.activity}: {concept.name}
                {concept.reason === "no-test-code"
                  ? " has no SDTM test code"
                  : ` (${concept.testCode}) is not a test the generator models`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {report.assumptions.length > 0 ||
      report.unplannedEncounters.length > 0 ||
      unitNotes.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-100">
          {report.assumptions.map((assumption) => (
            <li key={assumption}>{ASSUMPTION[assumption]}</li>
          ))}
          {report.unplannedEncounters.length > 0 ? (
            <li>
              {list(report.unplannedEncounters.map((e) => e.name))} has no
              planned study day, so it is left out; the generator adds its own
              unscheduled visits.
            </li>
          ) : null}
          {unitNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onDownload} className={BUTTON_SECONDARY}>
          Download this USDM (.json)
        </button>
        <button type="button" onClick={onUseDemo} className={BUTTON_SECONDARY}>
          Use the DEMO-301 study instead
        </button>
      </div>
    </div>
  );
}
