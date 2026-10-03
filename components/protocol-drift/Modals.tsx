"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { downloadFile } from "@/lib/download";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  STUDY_ID,
  formatClock,
  trialDayOf,
  type ProtocolDriftSaveFile,
  type LockAuditResult,
  type ProtocolDriftView,
  type ScenarioId,
  type Scorecard,
  type WaveSummary,
} from "@/lib/protocol-drift";
import { readAutosave } from "./persistence";
import { useProtocolDriftStore } from "./store";

const PRIMARY =
  "min-h-11 min-w-11 border border-amber-500 px-4 font-mono text-xs text-amber-400 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-400 active:scale-[0.98]";
const SECONDARY =
  "min-h-11 min-w-11 border border-zinc-700 px-4 font-mono text-xs text-zinc-200 hover:border-amber-500 active:scale-[0.98]";

function ModalShell({
  title,
  labelledBy,
  onEscape,
  wide,
  children,
}: {
  title: string;
  labelledBy: string;
  onEscape?: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const initialFocus = useRef<HTMLHeadingElement | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: initialFocus,
    onEscape,
  });
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-3">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`max-h-full w-full overflow-y-auto border border-zinc-700 bg-[#13151a] p-4 font-mono text-xs text-zinc-200 ${
          wide ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <h2
          id={labelledBy}
          ref={initialFocus}
          tabIndex={-1}
          className="mb-3 text-base font-semibold tracking-[-0.035em] text-zinc-100 outline-none"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Trial briefing: accepting the assignment moves BRIEF to DRAFT. */
export function BriefingModal() {
  const acceptBrief = useProtocolDriftStore((s) => s.acceptBrief);
  const restoreSave = useProtocolDriftStore((s) => s.restoreSave);
  const [scenario, setScenario] = useState<ScenarioId>("full");
  const [saved, setSaved] = useState<ProtocolDriftSaveFile | null>(null);
  const id = useId();

  useEffect(() => {
    let cancelled = false;
    void readAutosave().then((save) => {
      if (!cancelled) setSaved(save);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <ModalShell
      title={`Trial Briefing: Study ${STUDY_ID}`}
      labelledBy={`${id}-title`}
    >
      <p className="mb-2 text-zinc-300">
        You are the Lead Clinical Data Architect for Study {STUDY_ID}, a Phase I
        antihypertensive single-ascending-dose trial. Design the pipeline that
        carries site data into CDISC SDTM, keep it honest when the data is not,
        and survive a protocol amendment before Database Lock.
      </p>
      <ul className="mb-3 list-disc space-y-1 pl-5 text-zinc-200">
        <li>
          Drag chips onto the Tabulation Lane and wire them; nothing crosses the
          Conservation Wall upward.
        </li>
        <li>
          Run Local Test, then Publish Revision, then press Space to run the
          clock.
        </li>
        <li>
          Never impute what the site did not collect. Query with evidence.
        </li>
        <li>
          This is fiction: sites, people and data are invented and nothing here
          is clinical or regulatory advice.
        </li>
      </ul>
      <fieldset className="mb-4 space-y-1.5">
        <legend className="mb-1 text-zinc-100">Scenario</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name={`${id}-scenario`}
            checked={scenario === "full"}
            onChange={() => setScenario("full")}
            className="mt-0.5"
          />
          <span>
            Full study: three sites, 28 days, amendment and Database Lock (110
            VS rows).
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name={`${id}-scenario`}
            checked={scenario === "tracer"}
            onChange={() => setScenario("tracer")}
            className="mt-0.5"
          />
          <span>Tracer bullet: Site A baseline cohort only (18 VS rows).</span>
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY}
          onClick={() => void acceptBrief(scenario)}
        >
          Accept Assignment
        </button>
        {saved ? (
          <button
            type="button"
            className={SECONDARY}
            onClick={() => void restoreSave(saved)}
          >
            Resume autosave ({formatClock(saved.clock.minute)}, {saved.fsmState}
            )
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}

/** Wave review: counts at the wave boundary and how to continue. */
export function WaveReviewModal({ summary }: { summary: WaveSummary }) {
  const dismiss = useProtocolDriftStore((s) => s.dismissWave);
  const togglePause = useProtocolDriftStore((s) => s.togglePause);
  const command = useProtocolDriftStore((s) => s.command);
  const scenario = useProtocolDriftStore((s) => s.scenario);
  const id = useId();
  const last = scenario === "tracer" || summary.waveIndex === 3;
  return (
    <ModalShell
      title={`Wave ${summary.waveIndex} Review`}
      labelledBy={`${id}-title`}
      onEscape={dismiss}
    >
      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
        <dt>Confirmed records</dt>
        <dd
          className="text-right tabular-nums text-zinc-100"
          data-testid="wave-confirmed"
        >
          {summary.confirmedRecords}
        </dd>
        <dt>VS records (current)</dt>
        <dd className="text-right tabular-nums text-zinc-100">
          {summary.vsRecords}
        </dd>
        <dt>New this wave</dt>
        <dd className="text-right tabular-nums text-zinc-100">
          {summary.newVsRecords}
        </dd>
        <dt>MH records</dt>
        <dd className="text-right tabular-nums text-zinc-100">
          {summary.mhRecords}
        </dd>
        <dt>Open issues (discrepancies)</dt>
        <dd
          className="text-right tabular-nums text-zinc-100"
          data-testid="wave-issues"
        >
          {summary.openIssues}
        </dd>
        <dt>Open queries</dt>
        <dd className="text-right tabular-nums text-zinc-100">
          {summary.openQueries}
        </dd>
        <dt>FAB / LOSS / UNCERTAIN</dt>
        <dd className="text-right tabular-nums text-zinc-100">
          {summary.debt.fabricatedBits.toFixed(2)} bits /{" "}
          {summary.debt.semanticLossCount} / {summary.debt.uncertainCount}
        </dd>
      </dl>
      {scenario === "tracer" ? (
        <p className="mb-3 text-zinc-300">
          Tracer cohort ingested. The full study unlocks the next phase.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!last ? (
          <button
            type="button"
            className={PRIMARY}
            onClick={() => {
              dismiss();
              void togglePause();
            }}
          >
            Continue to next wave
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY}
          onClick={() => {
            dismiss();
            void command({ type: "SET_PAUSED", isPaused: true });
          }}
        >
          Pause and inspect
        </button>
        <button type="button" className={SECONDARY} onClick={dismiss}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

/** Sponsor Amendment 01 memo; arrives with the clock auto-paused. */
export function AmendmentMemoModal() {
  const dismiss = useProtocolDriftStore((s) => s.dismissMemo);
  const id = useId();
  return (
    <ModalShell
      title="Sponsor Memo: Protocol Amendment 01"
      labelledBy={`${id}-title`}
      onEscape={dismiss}
    >
      <p className="mb-2 text-zinc-300">
        Trial Day 20, 08:00. Because of potential drug-induced orthostatic
        hypotension, the protocol now requires both sitting and standing vital
        signs at every visit assessed after a site&apos;s IRB activation.
      </p>
      <ul className="mb-3 space-y-1 text-zinc-200">
        <li>Site A activates v2 on Day 22.</li>
        <li>Site C activates v2 on Day 23.</li>
        <li>Site B (delayed IRB review) activates v2 on Day 26.</li>
      </ul>
      <p className="mb-3 text-zinc-300">
        Route by assessment date, not by when a form arrives: a late submission
        of an older visit stays on its original version. The clock is paused so
        you can edit the pipeline.
      </p>
      <button type="button" className={PRIMARY} onClick={dismiss}>
        Acknowledge Memo
      </button>
    </ModalShell>
  );
}

function CheckRow({
  passed,
  label,
  detail,
  onInspect,
}: {
  passed: boolean;
  label: string;
  detail: string;
  onInspect?: () => void;
}) {
  return (
    <li className="flex min-w-0 items-start gap-2">
      <span
        className={`mt-0.5 inline-flex h-5 w-12 shrink-0 items-center justify-center border text-[10px] ${
          passed
            ? "border-emerald-500/70 text-emerald-400"
            : "border-amber-500 text-amber-300"
        }`}
      >
        {passed ? "PASS" : "FAIL"}
      </span>
      <span className="min-w-0 flex-1 break-words">
        <b className="text-zinc-100">{label}</b>: {detail}
        {!passed && onInspect ? (
          <button
            type="button"
            onClick={onInspect}
            className="ml-2 min-h-6 border border-zinc-700 px-1.5 text-[10px] text-zinc-200 hover:border-amber-500"
          >
            Inspect
          </button>
        ) : null}
      </span>
    </li>
  );
}

/** Looks up where a discrepancy's entity lives so the inspector can show it. */
function locate(view: ProtocolDriftView, entityId: string) {
  const issue = view.issues.find((i) => i.issueId === entityId);
  if (issue)
    return { issueId: issue.issueId, submissionId: issue.submissionId };
  const query = view.queries.find((q) => q.queryId === entityId);
  if (query) {
    const related = view.issues.find((i) => i.issueId === query.issueId);
    return {
      issueId: query.issueId,
      submissionId: related?.submissionId ?? null,
    };
  }
  const vs = view.vsLedger.find((r) => r.recordId === entityId);
  if (vs) {
    const related = view.issues.find((i) => i.submissionId === vs.submissionId);
    return { issueId: related?.issueId ?? null, submissionId: vs.submissionId };
  }
  const mh = view.mhLedger.find((r) => r.recordId === entityId);
  if (mh) {
    const related = view.issues.find((i) => i.submissionId === mh.submissionId);
    return { issueId: related?.issueId ?? null, submissionId: mh.submissionId };
  }
  return null;
}

/** Dual Database Lock gate: SDTM and ADaM checklists. */
export function LockReviewModal({
  audit,
  view,
}: {
  audit: LockAuditResult;
  view: ProtocolDriftView;
}) {
  const back = useProtocolDriftStore((s) => s.returnToWorkbench);
  const confirm = useProtocolDriftStore((s) => s.confirmLock);
  const select = useProtocolDriftStore((s) => s.select);
  const setExpanded = useProtocolDriftStore((s) => s.setInspectorExpanded);
  const id = useId();
  const s = audit.sdtmChecklist;
  const a = audit.adamChecklist;
  const inspectFor = (codes: string[]) => {
    const hit = audit.discrepancies.find((d) => codes.includes(d.code));
    if (!hit) return undefined;
    return () => {
      const where = locate(view, hit.entityId);
      if (where) select(where);
      setExpanded(true);
      void back();
    };
  };
  return (
    <ModalShell
      title={`Dual Database Lock Audit Gate (Study ${STUDY_ID})`}
      labelledBy={`${id}-title`}
      wide
      onEscape={() => void back()}
    >
      <section aria-label="SDTM Database Lock checklist" className="mb-3">
        <h3 className="mb-1.5 text-zinc-100">SDTM Tabulation Lock Checklist</h3>
        <ul className="space-y-1.5">
          <CheckRow
            passed={s.vsRecordCount.passed}
            label="Vital Signs records"
            detail={`${s.vsRecordCount.actual} of ${s.vsRecordCount.expected}`}
            onInspect={inspectFor(["VS_COUNT_MISMATCH"])}
          />
          <CheckRow
            passed={s.mhRecordCount.passed}
            label="Medical History records"
            detail={`${s.mhRecordCount.actual} of ${s.mhRecordCount.expected}`}
            onInspect={inspectFor(["MH_COUNT_MISMATCH"])}
          />
          <CheckRow
            passed={s.openQueries.passed}
            label="Open queries"
            detail={`${s.openQueries.actual} active`}
            onInspect={inspectFor(["OPEN_QUERIES_REMAINING"])}
          />
          <CheckRow
            passed={s.unresolvedIssues.passed}
            label="Unresolved issues"
            detail={`${s.unresolvedIssues.actual}`}
            onInspect={inspectFor(["UNRESOLVED_ISSUES"])}
          />
          <CheckRow
            passed={s.fabricatedDebtBits.passed}
            label="Fabricated precision debt"
            detail={`${s.fabricatedDebtBits.actual.toFixed(2)} bits (threshold 0.00)`}
            onInspect={inspectFor(["FABRICATED_DEBT_EXCEEDED"])}
          />
          <CheckRow
            passed={s.semanticLoss.passed}
            label="Semantic loss"
            detail={`${s.semanticLoss.actual}`}
            onInspect={inspectFor(["SEMANTIC_LOSS_PRESENT"])}
          />
          <CheckRow
            passed={s.honestUncertaintyDocumented.passed}
            label="Honest uncertainty documented"
            detail={`${s.honestUncertaintyDocumented.count} record(s)`}
            onInspect={inspectFor(["UNCERTAINTY_UNDOCUMENTED"])}
          />
          <CheckRow
            passed={s.brokenTraces.passed}
            label="Trace lineage"
            detail={`${s.brokenTraces.actual} broken`}
            onInspect={inspectFor(["BROKEN_TRACES"])}
          />
          <CheckRow
            passed={s.heldPackets.passed}
            label="Held packets"
            detail={`${s.heldPackets.actual}`}
            onInspect={inspectFor(["HELD_PACKETS_REMAINING"])}
          />
        </ul>
      </section>
      <section aria-label="ADaM Analysis Readiness checklist" className="mb-3">
        <h3 className="mb-1.5 text-zinc-100">
          ADaM Analysis Readiness Checklist
        </h3>
        <ul className="space-y-1.5">
          <CheckRow
            passed={a.derivedRecordsCount.passed}
            label="Derived orthostatic rows"
            detail={`${a.derivedRecordsCount.actual} of ${a.derivedRecordsCount.expected}`}
            onInspect={inspectFor(["ADAM_COUNT_MISMATCH"])}
          />
          <CheckRow
            passed={a.unevaluableHandledCorrectly.passed}
            label="NOT EVALUABLE visits"
            detail={`${a.unevaluableHandledCorrectly.count} flagged, none fabricated`}
            onInspect={inspectFor(["UNEVALUABLE_MISHANDLED"])}
          />
          <CheckRow
            passed={a.crossVisitCollisions.passed}
            label="Cross-visit pairing collisions"
            detail={`${a.crossVisitCollisions.actual}`}
            onInspect={inspectFor(["CROSS_VISIT_COLLISIONS"])}
          />
          <CheckRow
            passed={a.staleDerivations.passed}
            label="Stale derivations"
            detail={`${a.staleDerivations.actual}`}
            onInspect={inspectFor(["STALE_DERIVATIONS_EXIST"])}
          />
        </ul>
      </section>
      {!audit.canLock ? (
        <ul
          className="mb-3 space-y-1 border border-amber-500/60 p-2 text-amber-300"
          aria-label="Discrepancies"
        >
          {audit.discrepancies.map((d, index) => (
            <li
              key={`${d.code}-${d.entityId}-${index}`}
              className="break-words"
            >
              {d.code}: {d.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-emerald-400">ALL REGULATORY GATES CLEARED</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY} onClick={() => void back()}>
          Return to Workbench
        </button>
        <button
          type="button"
          className={PRIMARY}
          disabled={!audit.canLock}
          onClick={() => void confirm()}
        >
          Confirm Database Lock
        </button>
      </div>
    </ModalShell>
  );
}

function download(name: string, text: string, mime: string) {
  downloadFile(text, name, { mimeType: mime });
}

/** Endgame regulatory debrief (Form 483 style) and the systems scorecard. */
export function DebriefModal({
  scorecard,
  view,
  onClose,
}: {
  scorecard: Scorecard;
  view: ProtocolDriftView;
  onClose: () => void;
}) {
  const datasets = useProtocolDriftStore((s) => s.datasets);
  const exportSave = useProtocolDriftStore((s) => s.exportSave);
  const id = useId();
  const fab = view.debt.fabricatedBits;
  const partial = view.mhLedger.find(
    (r) => !r.superseded && /^\d{4}-\d{2}$/.test(r.MHSTDTC)
  );
  const amendmentEvents = view.auditTrail.filter((e) =>
    [
      "AMENDMENT_ANNOUNCED",
      "SITE_ACTIVATED",
      "SOURCE_RECORD_SUPERSEDED",
    ].includes(e.type)
  ).length;
  const ratio = scorecard.queryRestraintRatio;
  return (
    <ModalShell
      title="Regulatory Audit Debrief"
      labelledBy={`${id}-title`}
      wide
      onEscape={onClose}
    >
      <section
        aria-label="Inspection report"
        className="mb-3 border border-zinc-700 p-3"
      >
        <h3 className="mb-1 text-zinc-100">
          Inspectional Observations (simulated, Form 483 style)
        </h3>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            {fab === 0
              ? "No systemic data fabrication findings. No precision was imputed beyond what sites collected."
              : `Fabricated precision of ${fab.toFixed(2)} bits was found in current records.`}
          </li>
          {partial ? (
            <li>
              Commendation: partial onset date {partial.MHSTDTC} was retained at
              collected precision (CDASH 3.6) without artificial day imputation.
            </li>
          ) : null}
          <li>
            Audit trail verified across the protocol amendment:{" "}
            {amendmentEvents} amendment, activation and supersession events
            recorded, {view.auditTrail.length} entries in total.
          </li>
        </ol>
        <p className="mt-2 text-zinc-300">
          Fictional study, sites and people. This is a game and not regulatory
          advice.
        </p>
      </section>
      <section aria-label="Systems Efficiency Scorecard" className="mb-3">
        <h3 className="mb-1 text-zinc-100">Systems Efficiency Scorecard</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt>Trial duration</dt>
          <dd className="text-right tabular-nums text-zinc-100">
            {scorecard.trialDurationDays} days
          </dd>
          <dt>Query restraint ratio</dt>
          <dd className="text-right text-zinc-100">
            {ratio === null ? "n/a" : ratio.toFixed(2)} ·{" "}
            {scorecard.queryRestraintLabel}
          </dd>
          <dt>Queries sent / evidence-linked</dt>
          <dd className="text-right tabular-nums text-zinc-100">
            {scorecard.queriesSent} / {scorecard.evidenceLinkedQueries}
          </dd>
          {Object.entries(scorecard.goodwill).map(([site, g]) => (
            <React.Fragment key={site}>
              <dt>{site.replace("SITE-", "Site ")} goodwill retained</dt>
              <dd className="text-right tabular-nums text-zinc-100">
                {Math.round(g)}
              </dd>
            </React.Fragment>
          ))}
          <dt>Mean goodwill</dt>
          <dd className="text-right tabular-nums text-zinc-100">
            {scorecard.meanGoodwill.toFixed(1)}
          </dd>
        </dl>
        <ul className="mt-2 space-y-1" aria-label="Preventative badges">
          {scorecard.badges.map((b) => (
            <li key={b.id} className="flex min-w-0 gap-2">
              <span
                className={`inline-flex h-5 w-14 shrink-0 items-center justify-center border text-[10px] ${
                  b.earned
                    ? "border-emerald-500/70 text-emerald-400"
                    : "border-zinc-700 text-zinc-300"
                }`}
              >
                {b.earned ? "EARNED" : "NOT YET"}
              </span>
              <span className="min-w-0 break-words">
                <b className="text-zinc-100">{b.title}</b>: {b.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Dataset export" className="mb-3">
        <h3 className="mb-1 text-zinc-100">Dataset Export</h3>
        <div className="flex flex-wrap gap-2">
          {datasets ? (
            <>
              <button
                type="button"
                className={SECONDARY}
                onClick={() =>
                  download("VS.csv", datasets["VS.csv"], "text/csv")
                }
              >
                VS.csv
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() =>
                  download("MH.csv", datasets["MH.csv"], "text/csv")
                }
              >
                MH.csv
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() =>
                  download("ADVS.csv", datasets["ADVS.csv"], "text/csv")
                }
              >
                ADVS.csv
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() =>
                  download(
                    "audit_trail.json",
                    datasets["audit_trail.json"],
                    "application/json"
                  )
                }
              >
                audit_trail.json
              </button>
            </>
          ) : (
            <span className="text-zinc-300">Preparing datasets…</span>
          )}
          <button
            type="button"
            className={SECONDARY}
            onClick={() => void exportSave()}
          >
            Export save (pd-101-save-v1.json)
          </button>
        </div>
      </section>
      <button type="button" className={PRIMARY} onClick={onClose}>
        View locked workbench
      </button>
      <p className="mt-2 text-zinc-300">
        Locked at Day {trialDayOf(view.minute)}. The ledgers and pipeline are
        read-only.
      </p>
    </ModalShell>
  );
}
