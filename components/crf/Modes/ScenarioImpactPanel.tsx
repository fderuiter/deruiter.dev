"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconHistory,
  IconPlayerPlay,
} from "@tabler/icons-react";
import type { CRFForm, StudyProtocol } from "@/lib/crf/types";
import {
  analyzeScenarioImpact,
  getScopedValue,
  rerunScenarios,
  runFormTest,
  saveScenarioFromReport,
  type ConditionalFieldValues,
  type FormTestScope,
  type ScenarioFreshnessAssessment,
  type ScenarioImpactNavigationTarget,
  type ScenarioImpactStanding,
} from "@/lib/crf";

interface ScenarioImpactPanelProps {
  study: StudyProtocol;
  /** The form currently under test in the dock, if any. */
  form: CRFForm | null;
  /** The dock's synthetic values, used when saving the current run as a test. */
  values: ConditionalFieldValues;
  /** The dock's scope, used to read those values. */
  scope: FormTestScope;
  /** The visit selected in the studio; a saved test is recorded at it when it collects the form. */
  activeVisitId?: string;
  onUpdateStudy: (next: StudyProtocol) => void;
  onNavigate: (target: ScenarioImpactNavigationTarget) => void;
}

const STANDING_TONE: Record<ScenarioImpactStanding, string> = {
  passing: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  failing: "text-red-400 border-red-500/30 bg-red-500/10",
  stale: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  unknown: "text-zinc-300 border-zinc-700 bg-zinc-900",
  never_run: "text-zinc-400 border-zinc-800 bg-zinc-950",
};

const STANDING_LABEL: Record<ScenarioImpactStanding, string> = {
  passing: "Current · passing",
  failing: "Current · failing",
  stale: "Stale",
  unknown: "Unverified",
  never_run: "Never run",
};

const BUTTON =
  "inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[48px] rounded-lg text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:opacity-50 disabled:cursor-not-allowed";

function rowId(scenarioId: string): string {
  return `scenario-impact-${scenarioId}`;
}

function focusScenarioRow(scenarioId: string): void {
  const row = document.getElementById(rowId(scenarioId));
  row?.scrollIntoView?.({ block: "nearest" });
  row?.focus?.();
}

/**
 * Saved test impact (#679).
 *
 * Lists every saved test scenario with its freshness against the current
 * study, explains which amended object made a result stale, links to that
 * object, and reruns a selection of affected tests. A stale or unverified
 * result is shown with its last run marked as not current, never as a pass.
 */
export const ScenarioImpactPanel: React.FC<ScenarioImpactPanelProps> = ({
  study,
  form,
  values,
  scope,
  activeVisitId,
  onUpdateStudy,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [draftName, setDraftName] = useState("");

  const report = useMemo(() => analyzeScenarioImpact(study), [study]);

  const scenarioNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const assessment of report.assessments) {
      names.set(assessment.scenarioId, assessment.scenarioName);
    }
    return names;
  }, [report]);

  // Selection is derived against the current report so a test that became
  // current, or was removed, cannot linger as selected.
  const rerunnableIds = useMemo(
    () =>
      new Set(
        report.assessments
          .filter((assessment) => assessment.rerunnable)
          .map((assessment) => assessment.scenarioId)
      ),
    [report]
  );
  const effectiveSelected = useMemo(
    () => [...selected].filter((id) => rerunnableIds.has(id)),
    [selected, rerunnableIds]
  );

  const toggleSelected = useCallback((scenarioId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });
  }, []);

  const selectAffected = useCallback(() => {
    setSelected(
      new Set(
        report.affected
          .filter((assessment) => assessment.rerunnable)
          .map((assessment) => assessment.scenarioId)
      )
    );
  }, [report]);

  const handleRerun = useCallback(() => {
    if (effectiveSelected.length === 0) return;
    const result = rerunScenarios(study, effectiveSelected);
    onUpdateStudy(result.study);
    const passing = result.summaries.filter(
      (s) => s.standing === "passing"
    ).length;
    const failing = result.summaries.length - passing;
    const skipped =
      result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : "";
    setAnnouncement(
      `Reran ${result.summaries.length} saved test${result.summaries.length === 1 ? "" : "s"}: ${passing} passing, ${failing} failing${skipped}.`
    );
    setSelected(new Set());
  }, [effectiveSelected, onUpdateStudy, study]);

  const handleSave = useCallback(() => {
    if (!form) return;
    const inputs: Record<string, string | number | boolean | null> = {};
    for (const field of (form.sections || []).flatMap((s) => s.fields || [])) {
      if (field.dataType === "calculated") continue;
      const value = getScopedValue(values, scope, field.id);
      if (value !== undefined) inputs[field.id] = value;
    }
    const collecting = (study.visits || []).filter((visit) =>
      (visit.assignedFormIds || []).includes(form.id)
    );
    const recordVisit =
      collecting.find((visit) => visit.id === activeVisitId) || collecting[0];
    const name =
      draftName.trim() ||
      `${form.name} test ${(study.testScenarios || []).length + 1}`;

    const saved = saveScenarioFromReport(study, {
      name,
      form,
      report: runFormTest(form, values, scope),
      inputs,
      scope: {
        subjectId: scope.subjectId,
        visitId: recordVisit?.id ?? scope.visitId,
      },
    });
    onUpdateStudy(saved.study);
    setDraftName("");
    setAnnouncement(`Saved test "${name}" with current evidence.`);
  }, [activeVisitId, draftName, form, onUpdateStudy, scope, study, values]);

  const { counts } = report;
  const affectedCount = counts.stale + counts.unknown;

  return (
    <section
      aria-label="Saved test impact"
      data-testid="scenario-impact-panel"
      className="@container border-t border-zinc-800 bg-zinc-950 text-zinc-200 flex flex-col max-h-[40vh] min-h-0 relative z-20"
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 shrink-0 flex-wrap">
        <h2 className="flex items-center gap-2 min-w-0 text-xs font-bold text-white tracking-wide">
          <IconHistory
            className="w-4 h-4 text-amber-400 shrink-0"
            aria-hidden
          />
          <span className="truncate">Saved tests</span>
        </h2>
        <p
          className="text-[10px] font-mono text-zinc-400 flex flex-wrap gap-x-2 min-w-0"
          data-testid="scenario-impact-counts"
        >
          <span>{counts.current} current</span>
          <span className={counts.stale > 0 ? "text-amber-400" : undefined}>
            {counts.stale} stale
          </span>
          {counts.unknown > 0 && <span>{counts.unknown} unverified</span>}
          {counts.never_run > 0 && <span>{counts.never_run} never run</span>}
        </p>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="scenario-impact-body"
          className={BUTTON}
        >
          {isExpanded ? (
            <IconChevronDown className="w-3 h-3" aria-hidden />
          ) : (
            <IconChevronUp className="w-3 h-3" aria-hidden />
          )}
          <span>{isExpanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {isExpanded && (
        <div
          id="scenario-impact-body"
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 min-h-0"
        >
          {form && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="scenario-impact-name"
                  className="block text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-1"
                >
                  Save current dock run as a test
                </label>
                <input
                  id="scenario-impact-name"
                  type="text"
                  value={draftName}
                  placeholder={`${form.name} test`}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-2.5 py-1.5 min-h-[48px] text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:border-brand-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                className={BUTTON}
                data-testid="scenario-impact-save"
              >
                <IconDeviceFloppy className="w-3 h-3" aria-hidden />
                <span>Save test</span>
              </button>
            </div>
          )}

          {report.assessments.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No saved tests yet. Fill the dock, then save the run to pin its
              outcomes; later amendments will show which saved tests they
              affect.
            </p>
          ) : (
            <>
              {report.changedObjects.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-1.5">
                    Amended objects
                  </h3>
                  <ul className="space-y-1.5" aria-label="Amended objects">
                    {report.changedObjects.map((object) => (
                      <li
                        key={`${object.dependency.key}-${object.change}-${object.affectedScenarioIds.join(",")}`}
                        className="rounded-lg border border-amber-500/30 bg-zinc-950 p-2 min-w-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-200 break-words min-w-0">
                            <span className="font-mono text-zinc-500">
                              {object.dependency.kind}
                            </span>{" "}
                            {object.objectLabel}
                            <span className="text-amber-400">
                              {" "}
                              {object.change === "changed"
                                ? `(${object.aspects.join(", ")} changed)`
                                : `(${object.change})`}
                            </span>
                          </span>
                          {object.change !== "removed" && (
                            <button
                              type="button"
                              onClick={() => onNavigate(object.navigation)}
                              className={BUTTON}
                              aria-label={`Go to ${object.dependency.kind} ${object.objectLabel}`}
                            >
                              <span>Go to {object.dependency.kind}</span>
                              <IconArrowRight className="w-3 h-3" aria-hidden />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 flex flex-wrap gap-1 items-center">
                          <span>Affects:</span>
                          {object.affectedScenarioIds.map((scenarioId) => (
                            <button
                              key={scenarioId}
                              type="button"
                              onClick={() => focusScenarioRow(scenarioId)}
                              className="underline decoration-dotted text-zinc-300 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan rounded px-1 inline-flex items-center min-h-[48px] break-words"
                            >
                              {scenarioNames.get(scenarioId) ?? scenarioId}
                            </button>
                          ))}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                    Tests
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={selectAffected}
                      disabled={affectedCount === 0}
                      className={BUTTON}
                    >
                      Select affected ({affectedCount})
                    </button>
                    <button
                      type="button"
                      onClick={handleRerun}
                      disabled={effectiveSelected.length === 0}
                      className={BUTTON}
                    >
                      <IconPlayerPlay className="w-3 h-3" aria-hidden />
                      <span>Rerun selected ({effectiveSelected.length})</span>
                    </button>
                  </div>
                </div>
                <ul className="space-y-1.5" aria-label="Saved tests">
                  {report.assessments.map((assessment) => (
                    <ScenarioRow
                      key={assessment.scenarioId}
                      assessment={assessment}
                      study={study}
                      isSelected={effectiveSelected.includes(
                        assessment.scenarioId
                      )}
                      onToggle={toggleSelected}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

interface ScenarioRowProps {
  assessment: ScenarioFreshnessAssessment;
  study: StudyProtocol;
  isSelected: boolean;
  onToggle: (scenarioId: string) => void;
  onNavigate: (target: ScenarioImpactNavigationTarget) => void;
}

const ScenarioRow: React.FC<ScenarioRowProps> = ({
  assessment,
  study,
  isSelected,
  onToggle,
  onNavigate,
}) => {
  const scenario = (study.testScenarios || []).find(
    (candidate) => candidate.id === assessment.scenarioId
  );
  const lastRun = scenario?.lastRun;
  const isCurrent = assessment.freshness === "current";
  const checkboxId = `${rowId(assessment.scenarioId)}-select`;

  return (
    <li
      id={rowId(assessment.scenarioId)}
      tabIndex={-1}
      data-freshness={assessment.freshness}
      className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={isSelected}
          disabled={!assessment.rerunnable}
          onChange={() => onToggle(assessment.scenarioId)}
          className="w-4 h-4 accent-amber-500 shrink-0"
        />
        <label
          htmlFor={checkboxId}
          className="text-[11px] font-semibold text-zinc-200 break-words min-w-0 flex-1"
        >
          {assessment.scenarioName}
        </label>
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${STANDING_TONE[assessment.standing]}`}
        >
          {STANDING_LABEL[assessment.standing]}
        </span>
        {assessment.rerunnable && (
          <button
            type="button"
            onClick={() =>
              onNavigate({ mode: "designer", formId: assessment.formId })
            }
            className="text-[10px] font-mono text-zinc-400 hover:text-brand-cyan underline decoration-dotted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan rounded px-1 inline-flex items-center min-h-[48px]"
            aria-label={`Open the form for ${assessment.scenarioName}`}
          >
            Open form
          </button>
        )}
      </div>

      {lastRun && (
        <p className="text-[10px] font-mono text-zinc-500 mt-1 break-words">
          {isCurrent
            ? `${lastRun.passed} of ${lastRun.passed + lastRun.failed} expectations met on ${lastRun.ranAt.slice(0, 10)}.`
            : `Previous run on ${lastRun.ranAt.slice(0, 10)} is not current verification.`}
        </p>
      )}

      {assessment.freshness === "unknown" && (
        <p className="text-[10px] text-zinc-400 mt-1">
          Recorded before dependency tracking. Fields and rules are unchanged,
          but codelist and visit changes cannot be ruled out; rerun to confirm.
        </p>
      )}

      {assessment.reasons.length > 0 && (
        <ul className="mt-1 space-y-1" aria-label="Why this result is stale">
          {assessment.reasons.map((reason) => (
            <li
              key={`${reason.dependency.key}-${reason.change}`}
              className="flex flex-wrap items-center gap-2 text-[10px] text-amber-300 min-w-0"
            >
              <span className="break-words min-w-0 flex-1">
                {reason.message}
              </span>
              {reason.change !== "removed" && (
                <button
                  type="button"
                  onClick={() => onNavigate(reason.navigation)}
                  className="font-mono text-zinc-300 hover:text-brand-cyan underline decoration-dotted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan rounded px-1 inline-flex items-center min-h-[48px]"
                  aria-label={`Go to ${reason.dependency.kind} ${reason.objectLabel}`}
                >
                  Go to {reason.dependency.kind}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
