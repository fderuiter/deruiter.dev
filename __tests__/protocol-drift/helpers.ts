import {
  FULL_GRAPH,
  WAVE1_GRAPH,
  createProtocolDriftEngine,
  isIssueOpen,
  minuteAt,
  type PDCommand,
  type PDWorkerEvent,
  type PipelineGraph,
  type ProtocolDriftEngine,
  type ScenarioId,
  type SDTMVitalSignRecord,
} from "@/lib/protocol-drift";

/** Dispatches a command and fails loudly if the engine rejected it. */
export function ok(
  engine: ProtocolDriftEngine,
  command: PDCommand
): PDWorkerEvent[] {
  const events = engine.dispatch(command);
  const rejected = events.find((e) => e.type === "COMMAND_REJECTED");
  if (rejected && rejected.type === "COMMAND_REJECTED") {
    throw new Error(`${command.type} rejected: ${rejected.reason}`);
  }
  return events;
}

/** Creates an engine past the briefing. */
export function startEngine(
  scenario: ScenarioId = "full",
  seed = 48291
): ProtocolDriftEngine {
  const engine = createProtocolDriftEngine({ seed, scenario });
  ok(engine, { type: "ACCEPT_BRIEF" });
  return engine;
}

/** Validates and publishes a graph. */
export function publish(
  engine: ProtocolDriftEngine,
  graph: PipelineGraph,
  revisionId: string
): void {
  const events = ok(engine, { type: "VALIDATE_GRAPH", ...graph });
  const result = events.find((e) => e.type === "VALIDATION_RESULT");
  if (!result || result.type !== "VALIDATION_RESULT" || !result.valid) {
    throw new Error(`Graph invalid: ${JSON.stringify(result)}`);
  }
  ok(engine, { type: "PUBLISH_REVISION", revisionId, ...graph });
}

/**
 * Advances the clock to a minute, resuming through auto-pauses and wave
 * reviews. Calls onStop at each stop so a script can react.
 */
export function runUntil(
  engine: ProtocolDriftEngine,
  minute: number,
  onStop?: (engine: ProtocolDriftEngine) => void
): void {
  for (let guard = 0; guard < 200; guard += 1) {
    const v = engine.view();
    if (v.minute >= minute) return;
    if (v.fsmState === "WAVE_REVIEW")
      ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, { type: "ADVANCE_TO", minute });
    onStop?.(engine);
  }
  throw new Error("runUntil did not converge");
}

/** Resolves every open issue the way a careful architect would. */
export function resolveAll(engine: ProtocolDriftEngine): void {
  for (let guard = 0; guard < 50; guard += 1) {
    if (engine.view().fsmState === "WAVE_REVIEW")
      ok(engine, { type: "SET_PAUSED", isPaused: true });
    const v = engine.view();
    for (const q of v.queries) {
      if (q.communicationState === "Answered")
        ok(engine, { type: "CLOSE_QUERY", queryId: q.queryId });
    }
    const after = engine.view();
    let pending = false;
    for (const issue of after.issues) {
      if (!isIssueOpen(issue.status)) continue;
      if (issue.code === "PARTIAL_DATE") {
        ok(engine, { type: "ACCEPT_UNCERTAINTY", issueId: issue.issueId });
      } else if (issue.status === "ReadyForReview") {
        ok(engine, { type: "ACCEPT_CORRECTION", issueId: issue.issueId });
      } else if (
        !after.queries.some(
          (q) =>
            q.issueId === issue.issueId &&
            (q.communicationState === "Queued" ||
              q.communicationState === "AwaitingResponse")
        )
      ) {
        ok(engine, {
          type: "DRAFT_QUERY",
          issueId: issue.issueId,
          evidenceLinked: issue.evidence !== undefined,
        });
        const id = engine.view().queries.at(-1)?.queryId as string;
        ok(engine, { type: "SEND_QUERY", queryId: id });
        pending = true;
      } else {
        pending = true;
      }
    }
    const now = engine.view();
    const answered = now.queries.some(
      (q) => q.communicationState === "Answered"
    );
    const open = now.issues.some((i) => isIssueOpen(i.status));
    if (!open && !answered) return;
    if (
      pending ||
      now.queries.some(
        (q) =>
          q.communicationState === "Queued" ||
          q.communicationState === "AwaitingResponse"
      )
    ) {
      const waiting = now.queries.filter(
        (q) =>
          q.communicationState === "Queued" ||
          q.communicationState === "AwaitingResponse"
      );
      const due = waiting.reduce(
        (m, q) => (q.expectedResponseMinute > m ? q.expectedResponseMinute : m),
        now.minute + 60
      );
      ok(engine, { type: "ADVANCE_TO", minute: due + 60 });
    }
  }
  throw new Error("resolveAll did not converge");
}

/** Day 14 23:59, Day 27 23:59 and Day 28 23:59. */
export const WAVE_END_MINUTES = {
  1: minuteAt(14, 23, 59),
  2: minuteAt(27, 23, 59),
  3: minuteAt(28, 23, 59),
} as const;

/**
 * The canonical playthrough of the full level: Wave 1 pipeline, every issue
 * dispositioned with evidence, Amendment 01 pipeline with the analysis lane,
 * all three waves, ready for lock in PAUSED.
 */
export function playFullLevel(engine: ProtocolDriftEngine): void {
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  resolveAll(engine);
  runUntil(engine, minuteAt(20, 8, 0));
  publish(engine, FULL_GRAPH, "p2");
  runUntil(engine, WAVE_END_MINUTES[2]);
  resolveAll(engine);
  runUntil(engine, WAVE_END_MINUTES[3]);
  resolveAll(engine);
  if (engine.view().fsmState === "WAVE_REVIEW")
    ok(engine, { type: "SET_PAUSED", isPaused: true });
}

/**
 * Publishes the Wave 1 pipeline, runs to the Amendment 01 notice, publishes
 * the given amendment pipeline and runs to the end of Wave 2 without
 * dispositioning anything.
 */
export function runToWave2(
  engine: ProtocolDriftEngine,
  graph: PipelineGraph = FULL_GRAPH
): void {
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, minuteAt(20, 8, 0));
  publish(engine, graph, "p2");
  runUntil(engine, WAVE_END_MINUTES[2]);
}

/** Builds a current SDTM VS record for pure-function tests. */
export function vsRecord(
  overrides: Partial<SDTMVitalSignRecord> &
    Pick<
      SDTMVitalSignRecord,
      "USUBJID" | "VISITNUM" | "VSTESTCD" | "VSPOS" | "VSSTRESN"
    >
): SDTMVitalSignRecord {
  const { USUBJID, VISITNUM, VSTESTCD, VSPOS, VSSTRESN } = overrides;
  return {
    recordId: `vs:${USUBJID}:${VISITNUM}:${VSTESTCD}:${VSPOS}`,
    STUDYID: "PD-101",
    DOMAIN: "VS",
    VSSEQ: 1,
    VSTEST:
      VSTESTCD === "SYSBP"
        ? "Systolic Blood Pressure"
        : VSTESTCD === "DIABP"
          ? "Diastolic Blood Pressure"
          : "Pulse Rate",
    VSORRES: String(VSSTRESN),
    VSORRESU: "mmHg",
    VSSTRESC: String(VSSTRESN),
    VSSTRESU: "mmHg",
    VISIT: `Day ${VISITNUM}`,
    VSDTC: "2025-11-25",
    EPOCH: "TREATMENT",
    epistemicStatus: "CONFIRMED",
    sourceRevisionId: `rev-${USUBJID}-${VISITNUM}-r1`,
    superseded: false,
    submissionId: `sub-${USUBJID}-${VISITNUM}`,
    siteId: "SITE-A",
    protocolVersion: "v2",
    pipelineRevisionId: "p1",
    precision: 0,
    insertedAtMinute: 0,
    ...overrides,
  };
}
