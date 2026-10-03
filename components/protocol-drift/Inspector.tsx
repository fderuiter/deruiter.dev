"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  GOODWILL_RULES,
  SOURCE_WORKSHEETS,
  isIssueOpen,
  type ClinicalQuery,
  type EpistemicStatus,
  type Issue,
  type PipelinePacket,
  type ProtocolDriftView,
} from "@/lib/protocol-drift";
import { useProtocolDriftStore } from "./store";

const BADGE: Record<
  EpistemicStatus,
  { mark: string; className: string; label: string }
> = {
  CONFIRMED: {
    mark: "OK",
    className: "border-emerald-500/60 text-emerald-400",
    label: "confirmed",
  },
  UNCERTAIN: {
    mark: "?",
    className: "border-dotted border-slate-300 text-slate-200",
    label: "documented uncertainty (CDASH 3.6)",
  },
  FABRICATED: {
    mark: "FAB",
    className: "border-amber-500 text-amber-300",
    label: "fabricated precision",
  },
  LOSS: {
    mark: "LOSS",
    className: "border-amber-500/70 text-amber-400",
    label: "semantic loss",
  },
};

const STATUS_LABEL: Record<Issue["status"], string> = {
  Open: "OPEN",
  AwaitingEvidence: "AWAITING EVIDENCE",
  ReadyForReview: "READY FOR REVIEW",
  Resolved: "RESOLVED",
  AcceptedUncertainty: "ACCEPTED UNCERTAINTY",
};

/** Payload keys a target field like "SYSBP/SITTING" is entered under. */
function payloadKeysFor(target: string): string[] {
  const [code, pos] = target.split("/");
  const stand = pos === "STANDING";
  if (code === "SYSBP")
    return stand ? ["sbp_stand"] : ["sbp", "sbp_sit", "raw_bp"];
  if (code === "DIABP")
    return stand ? ["dbp_stand"] : ["dbp", "dbp_sit", "raw_bp"];
  if (code === "PULSE") return ["pulse"];
  return [target];
}

function Badge({ status }: { status: EpistemicStatus }) {
  const b = BADGE[status];
  return (
    <span
      title={b.label}
      className={`inline-flex min-h-5 items-center border px-1 text-[10px] ${b.className}`}
    >
      {b.mark}
    </span>
  );
}

function latestPayload(view: ProtocolDriftView, submissionId: string) {
  const revisions = view.sourceLedger.filter(
    (r) => r.submissionId === submissionId
  );
  return revisions[revisions.length - 1];
}

function FormPane({
  view,
  issue,
  submissionId,
}: {
  view: ProtocolDriftView;
  issue: Issue | null;
  submissionId: string | null;
}) {
  if (!submissionId) {
    return (
      <p className="p-3 text-zinc-300">
        Select an issue or a submission to compare the paper worksheet with the
        eCRF entry.
      </p>
    );
  }
  const revision = latestPayload(view, submissionId);
  const first = view.sourceLedger.find((r) => r.submissionId === submissionId);
  const sheet = SOURCE_WORKSHEETS[submissionId];
  const hot = new Set(issue ? payloadKeysFor(issue.targetField) : []);
  const entries = revision ? Object.entries(revision.payload) : [];
  return (
    <div className="space-y-2 p-2">
      <section
        aria-label="Source worksheet"
        className="border border-zinc-700 bg-zinc-100 p-2 text-[11px] text-zinc-900"
      >
        <h4 className="font-semibold">SOURCE WORKSHEET (SCAN)</h4>
        {sheet ? (
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
            <dt>Hospital</dt>
            <dd>{sheet.hospital}</dd>
            <dt>Trial</dt>
            <dd>PD-101</dd>
            <dt>Subject</dt>
            <dd>{revision?.subjectId}</dd>
            <dt>Visit</dt>
            <dd>Day {revision?.visitDay}</dd>
            <dt>Clinician</dt>
            <dd>{sheet.clinician}</dd>
            <dt>Reads</dt>
            <dd className="break-words">{sheet.text}</dd>
          </dl>
        ) : (
          <p className="mt-1">
            {issue?.evidence ??
              "No separate paper scan on file for this submission."}
          </p>
        )}
      </section>
      <section
        aria-label="Electronic entry"
        className="border border-zinc-700 bg-[#0d0e11] p-2 text-[11px]"
      >
        <h4 className="font-semibold text-zinc-100">ELECTRONIC ENTRY (eCRF)</h4>
        {revision ? (
          <>
            <p className="text-zinc-300">
              {revision.subjectId} · Day {revision.visitDay} · revision r
              {revision.revision}
              {first && first !== revision ? " (amended)" : ""}
            </p>
            <ul className="mt-1 space-y-0.5">
              {entries.map(([key, value]) => (
                <li
                  key={key}
                  data-conflict={hot.has(key) ? "true" : undefined}
                  className={`flex min-w-0 items-center justify-between gap-2 border px-1 ${
                    hot.has(key)
                      ? "border-amber-500 text-amber-300"
                      : "border-transparent text-zinc-200"
                  }`}
                >
                  <span>{key}</span>
                  <span className="break-all tabular-nums">
                    {String(value)}
                  </span>
                  {hot.has(key) ? (
                    <span className="text-[10px]">[!] CONFLICT</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-zinc-300">Not yet received.</p>
        )}
      </section>
      {issue ? (
        <p
          role="note"
          className="border border-amber-500/60 px-2 py-1 text-[11px] text-amber-300"
        >
          DISCREPANCY: {issue.message}
        </p>
      ) : null}
    </div>
  );
}

function TracePane({
  view,
  submissionId,
  onPick,
}: {
  view: ProtocolDriftView;
  submissionId: string | null;
  onPick: (id: string) => void;
}) {
  const packets = useProtocolDriftStore((s) => s.packets);
  const nodes = useProtocolDriftStore((s) => s.nodes);
  const selectId = useId();
  const submissions = useMemo(
    () => Array.from(new Set(view.sourceLedger.map((r) => r.submissionId))),
    [view.sourceLedger]
  );
  const hops = useMemo(() => {
    if (!submissionId) return [] as PipelinePacket[];
    const mine = packets.filter((p) => p.submissionId === submissionId);
    const seen = new Set<string>();
    const out: PipelinePacket[] = [];
    for (const packet of mine) {
      const key = `${packet.sourceNodeId}:${packet.portType}:${packet.sourceRevisionId}:${JSON.stringify(packet.payload)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(packet);
    }
    return out;
  }, [packets, submissionId]);
  const held = view.held.filter((h) => h.submissionId === submissionId);
  const unmatched = view.unmatched.filter(
    (u) => u.submissionId === submissionId
  );
  const kindOf = (id: string) =>
    nodes.find((n) => n.id === id)?.data.kind ?? id;

  return (
    <div className="space-y-2 p-2">
      <label
        htmlFor={selectId}
        className="flex items-center gap-2 text-[11px] text-zinc-300"
      >
        Inspect submission
        <select
          id={selectId}
          value={submissionId ?? ""}
          onChange={(e) => onPick(e.target.value)}
          className="min-h-8 min-w-0 max-w-full flex-1 border border-zinc-700 bg-[#13151a] text-zinc-100"
        >
          <option value="">None</option>
          {submissions.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {!submissionId ? (
        <p className="text-zinc-300">No submission selected.</p>
      ) : hops.length === 0 && held.length === 0 ? (
        <p className="text-zinc-300">
          No packets recorded for {submissionId} under the published pipeline
          yet.
        </p>
      ) : (
        <ol className="space-y-1.5" aria-label="Node hop trail">
          {hops.map((packet) => (
            <li
              key={packet.id}
              className="border border-zinc-800 bg-[#0d0e11] p-1.5 text-[11px]"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <b className="min-w-0 break-words text-zinc-100">
                  {kindOf(packet.sourceNodeId)}
                  <span className="font-normal text-zinc-300">
                    {" "}
                    ({packet.sourceNodeId})
                  </span>
                </b>
                <span className="flex shrink-0 gap-1">
                  {packet.epistemicBadges
                    .filter((b) => b !== "CONFIRMED")
                    .map((b) => (
                      <Badge key={b} status={b} />
                    ))}
                </span>
              </div>
              <p className="break-all text-zinc-300">
                {packet.portType}
                {packet.field
                  ? ` · ${packet.field.name} = ${packet.field.orres}${packet.field.orresu ? ` ${packet.field.orresu}` : ""}`
                  : ""}
                {packet.observation
                  ? ` · ${packet.observation.VSTESTCD}/${packet.observation.VSPOS} = ${packet.observation.VSORRES} ${packet.observation.VSORRESU}`
                  : ""}
                {packet.mh ? ` · ${packet.mh.MHTERM} ${packet.mh.MHSTDTC}` : ""}
              </p>
            </li>
          ))}
          {held.map((h) => (
            <li
              key={h.heldId}
              className="border border-amber-500/60 p-1.5 text-[11px] text-amber-300"
            >
              HOLD at {h.nodeId}.{h.handle}: {h.reason}
              {h.loss ? " (LOSS)" : ""}
            </li>
          ))}
          {unmatched.map((u) => (
            <li
              key={u.unmatchedId}
              className="border border-amber-500/60 p-1.5 text-[11px] text-amber-300"
            >
              Unmatched text kept, counts as LOSS until dispositioned: {u.text}
            </li>
          ))}
        </ol>
      )}
      {view.vsLedger.filter((r) => r.submissionId === submissionId).length >
      0 ? (
        <div>
          <h4 className="text-[11px] font-semibold text-zinc-100">
            SDTM VS rows
          </h4>
          <ul className="space-y-0.5 text-[11px] text-zinc-200">
            {view.vsLedger
              .filter((r) => r.submissionId === submissionId)
              .map((r) => (
                <li
                  key={r.recordId}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Badge status={r.epistemicStatus} />
                  <span className="min-w-0 break-all">
                    {r.VSSEQ} {r.VSTESTCD}/{r.VSPOS} = {r.VSORRES} {r.VSORRESU}
                    {r.superseded ? " (superseded)" : ""}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const ACTIONS = [
  { id: "reconcile", label: "Reconcile entered value against source" },
  { id: "explain", label: "Provide explanatory comment" },
] as const;

function Composer({ issue, view }: { issue: Issue; view: ProtocolDriftView }) {
  const sendQuery = useProtocolDriftStore((s) => s.sendQuery);
  const [evidence, setEvidence] = useState(false);
  const [action, setAction] =
    useState<(typeof ACTIONS)[number]["id"]>("reconcile");
  const [observed, setObserved] = useState(issue.message);
  const [busy, setBusy] = useState(false);
  const ids = useId();
  const site = view.sites[issue.siteId];
  const preview = evidence
    ? `${observed}. Attached source evidence: ${issue.evidence}. ${
        action === "reconcile"
          ? "Please reconcile against source documents and issue a correction or explanation."
          : "Please provide an explanatory comment."
      }`
    : `Please confirm ${issue.targetField} for ${issue.subjectId} Day ${issue.visitDay}.`;

  const send = async () => {
    setBusy(true);
    try {
      await sendQuery(issue.issueId, evidence, preview);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Structured query composer"
      className="space-y-1.5 border border-zinc-700 bg-[#0d0e11] p-2 text-[11px]"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <h4 className="font-semibold text-zinc-100">STRUCTURED COMPOSER</h4>
      <p>
        <span className="text-zinc-300">Target </span>
        <span className="break-words text-zinc-100">
          {issue.siteId.replace("SITE-", "Site ")} · {issue.subjectId} · Day{" "}
          {issue.visitDay} · {issue.targetField}
        </span>
      </p>
      <label htmlFor={`${ids}-obs`} className="block text-zinc-300">
        Observed
        <textarea
          id={`${ids}-obs`}
          value={observed}
          onChange={(e) => setObserved(e.target.value)}
          rows={2}
          className="mt-0.5 w-full border border-zinc-700 bg-[#13151a] p-1 text-zinc-100"
        />
      </label>
      <label className="flex items-start gap-1.5 text-zinc-200">
        <input
          type="checkbox"
          checked={evidence}
          disabled={!issue.evidence}
          onChange={(e) => setEvidence(e.target.checked)}
          className="mt-0.5"
        />
        <span className="min-w-0 break-words">
          Attach source evidence
          {issue.evidence ? `: ${issue.evidence}` : " (none on file)"}
        </span>
      </label>
      <label htmlFor={`${ids}-act`} className="block text-zinc-300">
        Requested action
        <select
          id={`${ids}-act`}
          value={action}
          onChange={(e) =>
            setAction(e.target.value as (typeof ACTIONS)[number]["id"])
          }
          className="mt-0.5 min-h-8 w-full border border-zinc-700 bg-[#13151a] text-zinc-100"
        >
          {ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <p
        className="break-words border-l-2 border-slate-400 pl-2 text-zinc-200"
        aria-label="Message preview"
      >
        {preview}
      </p>
      <p className="text-zinc-300" data-testid="query-impact">
        Expected latency {site.latencyHours}h · Goodwill cost{" "}
        {GOODWILL_RULES.distinctQuery}
      </p>
      <button
        type="submit"
        disabled={busy || !isIssueOpen(issue.status)}
        className="min-h-8 border border-amber-500 px-3 text-amber-400 disabled:border-zinc-700 disabled:text-zinc-400"
      >
        Send Query ({GOODWILL_RULES.distinctQuery} GW)
      </button>
    </form>
  );
}

function QueryThread({ query }: { query: ClinicalQuery }) {
  return (
    <li className="border border-zinc-800 bg-[#0d0e11] p-1.5 text-[11px]">
      <p className="flex flex-wrap items-center justify-between gap-1">
        <b className="text-zinc-100">{query.queryId}</b>
        <span className="text-zinc-300">
          {query.communicationState}
          {query.isEvidenceLinked ? " · evidence-linked" : " · generic"}
        </span>
      </p>
      <p className="break-words text-zinc-300">{query.messageSent}</p>
      {query.responseReceived ? (
        <p className="break-words text-zinc-100">
          Reply: {query.responseReceived}
        </p>
      ) : null}
      {query.rubberStamped ? (
        <p role="note" className="text-amber-400">
          Rubber-stamped reply. The thread is answered but the issue stays Open.
        </p>
      ) : null}
      {query.duplicate ? (
        <p className="text-amber-400">
          Duplicate query: goodwill penalty applied.
        </p>
      ) : null}
    </li>
  );
}

function ReviewPane({
  view,
  issue,
}: {
  view: ProtocolDriftView;
  issue: Issue | null;
}) {
  const select = useProtocolDriftStore((s) => s.select);
  const command = useProtocolDriftStore((s) => s.command);
  const hasStale = view.adamRows.some((r) => r.stale);
  const queries = issue
    ? view.queries.filter((q) => q.issueId === issue.issueId)
    : [];
  const ready = issue?.status === "ReadyForReview";
  return (
    <div className="space-y-2 p-2">
      <section aria-label="Active issues">
        <h4 className="text-[11px] font-semibold text-zinc-100">
          Issues ({view.issues.length})
        </h4>
        {view.issues.length === 0 ? (
          <p className="text-zinc-300">No issues raised.</p>
        ) : (
          <ul className="space-y-1">
            {view.issues.map((i) => (
              <li key={i.issueId}>
                <button
                  type="button"
                  onClick={() =>
                    select({ issueId: i.issueId, submissionId: i.submissionId })
                  }
                  aria-pressed={issue?.issueId === i.issueId}
                  className={`w-full min-w-0 border px-1.5 py-1 text-left text-[11px] hover:border-amber-500 ${
                    issue?.issueId === i.issueId
                      ? "border-amber-500"
                      : "border-zinc-800"
                  }`}
                >
                  <span className="block break-words text-zinc-100">
                    [{i.code}] {i.subjectId.replace("PD-101-", "")} Day{" "}
                    {i.visitDay}
                  </span>
                  <span
                    className={`block ${isIssueOpen(i.status) ? "text-amber-400" : "text-emerald-400"}`}
                  >
                    {STATUS_LABEL[i.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {issue ? (
        <>
          <p className="break-words text-[11px] text-zinc-200">
            {issue.message}
          </p>
          {queries.length > 0 ? (
            <ul className="space-y-1" aria-label="Query threads">
              {queries.map((q) => (
                <QueryThread key={q.queryId} query={q} />
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {ready && issue.code === "PARTIAL_DATE" ? (
              <button
                type="button"
                onClick={() =>
                  void command({
                    type: "ACCEPT_UNCERTAINTY",
                    issueId: issue.issueId,
                  })
                }
                className="min-h-8 border border-emerald-500 px-2 text-[11px] text-emerald-400"
              >
                Accept Documented Uncertainty (CDASH 3.6)
              </button>
            ) : null}
            {ready && issue.code !== "PARTIAL_DATE" ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void command({
                      type: "ACCEPT_CORRECTION",
                      issueId: issue.issueId,
                    })
                  }
                  className="min-h-8 border border-emerald-500 px-2 text-[11px] text-emerald-400"
                >
                  Accept correction
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void command({
                      type: "REJECT_RESPONSE",
                      issueId: issue.issueId,
                    })
                  }
                  className="min-h-8 border border-zinc-700 px-2 text-[11px] text-zinc-200"
                >
                  Reject response
                </button>
              </>
            ) : null}
            {issue.origin === "pipeline" && isIssueOpen(issue.status) ? (
              <button
                type="button"
                onClick={() =>
                  void command({
                    type: "REPLAY_SUBMISSIONS",
                    submissionIds: [issue.submissionId],
                  })
                }
                className="min-h-8 border border-zinc-700 px-2 text-[11px] text-zinc-200"
              >
                Replay submission
              </button>
            ) : null}
          </div>
          {isIssueOpen(issue.status) &&
          issue.code !== "PARTIAL_DATE" &&
          issue.origin === "source" ? (
            <Composer key={issue.issueId} issue={issue} view={view} />
          ) : null}
        </>
      ) : null}
      {hasStale ? (
        <button
          type="button"
          onClick={() => void command({ type: "REPLAY_DERIVATIONS" })}
          className="min-h-8 w-full border border-amber-500 px-2 text-[11px] text-amber-400"
        >
          Replay stale ADaM derivations
        </button>
      ) : null}
    </div>
  );
}

/**
 * Tri-pane Forensic Inspector: Form View (30%), Pipeline Trace (40%) and
 * Review and Query (30%). Docked at min(328px, 35vh); press I to expand it
 * over the canvas and Escape to dock it again.
 */
export function Inspector() {
  const view = useProtocolDriftStore((s) => s.view);
  const selection = useProtocolDriftStore((s) => s.selection);
  const expanded = useProtocolDriftStore((s) => s.inspectorExpanded);
  const setExpanded = useProtocolDriftStore((s) => s.setInspectorExpanded);
  const select = useProtocolDriftStore((s) => s.select);

  // Follow the newest issue the first time one appears.
  const firstIssue = view?.issues[0] ?? null;
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current && firstIssue) {
      picked.current = true;
      select({
        issueId: firstIssue.issueId,
        submissionId: firstIssue.submissionId,
      });
    }
  }, [firstIssue, select]);

  if (!view) return null;
  const issue =
    view.issues.find((i) => i.issueId === selection.issueId) ?? null;
  const style: React.CSSProperties = expanded
    ? { top: 112, bottom: 32 }
    : { height: "min(328px, 35vh)" };

  return (
    <section
      aria-label="Forensic Inspector"
      data-testid="inspector"
      data-expanded={expanded ? "true" : "false"}
      style={style}
      className={`flex min-h-0 flex-col border-t border-zinc-700 bg-[#13151a] font-mono text-xs ${
        expanded ? "absolute inset-x-0 z-20" : "shrink-0"
      }`}
    >
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-zinc-800 px-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-zinc-100">
          FORENSIC INSPECTOR
        </h2>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="min-h-8 border border-zinc-700 px-2 text-[11px] text-zinc-200 hover:border-amber-500"
        >
          {expanded ? "Dock (Esc)" : "Expand (I)"}
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[30fr_40fr_30fr] divide-x divide-zinc-800">
        <div
          data-testid="pane-form"
          aria-label="Form View"
          role="region"
          className="min-h-0 min-w-0 overflow-y-auto"
        >
          <FormPane
            view={view}
            issue={issue}
            submissionId={selection.submissionId}
          />
        </div>
        <div
          data-testid="pane-trace"
          aria-label="Pipeline Trace"
          role="region"
          className="min-h-0 min-w-0 overflow-y-auto"
        >
          <TracePane
            view={view}
            submissionId={selection.submissionId}
            onPick={(id) =>
              select({
                submissionId: id || null,
                issueId:
                  view.issues.find((i) => i.submissionId === id)?.issueId ??
                  null,
              })
            }
          />
        </div>
        <div
          data-testid="pane-review"
          aria-label="Review and Query"
          role="region"
          className="min-h-0 min-w-0 overflow-y-auto"
        >
          <ReviewPane view={view} issue={issue} />
        </div>
      </div>
    </section>
  );
}
