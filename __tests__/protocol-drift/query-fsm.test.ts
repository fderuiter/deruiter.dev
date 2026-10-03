// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ISSUE_TRANSITIONS,
  ProtocolDriftWorkflowError,
  QUERY_TRANSITIONS,
  RUBBER_STAMP_RESPONSE,
  SITE_PROFILES,
  WAVE1_GRAPH,
  isIssueOpen,
  isQueryOpen,
  issueTransition,
  queryTransition,
  type ProtocolDriftEngine,
} from "@/lib/protocol-drift";
import {
  ok,
  publish,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
} from "./helpers";

const B01 = "iss-out-of-range-sub-b01-d14-sysbp-sitting";

function wave1Done(): ProtocolDriftEngine {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  ok(engine, { type: "SET_PAUSED", isPaused: true });
  return engine;
}

function sendQuery(
  engine: ProtocolDriftEngine,
  issueId: string,
  evidenceLinked: boolean
): string {
  ok(engine, { type: "DRAFT_QUERY", issueId, evidenceLinked });
  const id = engine.view().queries.at(-1)?.queryId as string;
  ok(engine, { type: "SEND_QUERY", queryId: id });
  return id;
}

function awaitAnswer(engine: ProtocolDriftEngine, queryId: string): void {
  ok(engine, { type: "STEP_TICK" });
  const due = engine.view().queries.find((q) => q.queryId === queryId)
    ?.expectedResponseMinute as number;
  ok(engine, { type: "ADVANCE_TO", minute: due });
}

describe("query and issue FSM tables", () => {
  it("allows only the documented query transitions", () => {
    expect(queryTransition("Draft", "Queued")).toBe("Queued");
    expect(queryTransition("Draft", "Closed")).toBe("Closed");
    expect(queryTransition("Queued", "AwaitingResponse")).toBe(
      "AwaitingResponse"
    );
    expect(queryTransition("AwaitingResponse", "Answered")).toBe("Answered");
    expect(queryTransition("Answered", "Closed")).toBe("Closed");
    expect(() => queryTransition("Draft", "Answered")).toThrow(
      ProtocolDriftWorkflowError
    );
    expect(() => queryTransition("Closed", "Queued")).toThrow(
      /Illegal query transition|Closed/
    );
    expect(QUERY_TRANSITIONS.Closed).toEqual([]);
    expect(isQueryOpen("Draft")).toBe(false);
    expect(isQueryOpen("Answered")).toBe(true);
  });

  it("never lets a query response resolve an issue directly", () => {
    expect(ISSUE_TRANSITIONS.Open).not.toContain("AcceptedUncertainty");
    expect(issueTransition("ReadyForReview", "Resolved")).toBe("Resolved");
    expect(() => issueTransition("Resolved", "Open")).toThrow(
      ProtocolDriftWorkflowError
    );
    expect(isIssueOpen("ReadyForReview")).toBe(true);
    expect(isIssueOpen("AcceptedUncertainty")).toBe(false);
  });
});

describe("Site B rubber stamp and evidence-linked correction", () => {
  it("answers the generic B01 Day 14 query with Confirmed Correct and leaves the issue Open", () => {
    const engine = wave1Done();
    const id = sendQuery(engine, B01, false);
    let q = engine.view().queries.find((x) => x.queryId === id);
    expect(q?.communicationState).toBe("Queued");
    expect(q?.goodwillCost).toBe(-1);
    expect(engine.view().sites["SITE-B"].goodwill).toBe(34);
    awaitAnswer(engine, id);
    q = engine.view().queries.find((x) => x.queryId === id);
    expect(q?.communicationState).toBe("Answered");
    expect(q?.responseReceived).toBe(RUBBER_STAMP_RESPONSE);
    expect(q?.rubberStamped).toBe(true);
    expect(engine.view().issues.find((i) => i.issueId === B01)?.status).toBe(
      "Open"
    );
    const sbp = engine
      .view()
      .vsLedger.find(
        (r) =>
          !r.superseded &&
          r.submissionId === "sub-b01-d14" &&
          r.VSTESTCD === "SYSBP"
      );
    expect(sbp?.VSSTRESN).toBe(210);
  });

  it("produces an amended record from an evidence query, then resolves with goodwill capped at 35", () => {
    const engine = wave1Done();
    const id = sendQuery(engine, B01, true);
    expect(engine.view().issues.find((i) => i.issueId === B01)?.status).toBe(
      "AwaitingEvidence"
    );
    awaitAnswer(engine, id);
    const issue = engine.view().issues.find((i) => i.issueId === B01);
    expect(issue?.status).toBe("ReadyForReview");
    expect(issue?.pendingRevisionId).toBe("rev-b01-d14-r2");
    expect(
      engine.view().queries.find((q) => q.queryId === id)?.responseReceived
    ).toContain("rev-b01-d14-r2");
    ok(engine, { type: "ACCEPT_CORRECTION", issueId: B01 });
    const v = engine.view();
    expect(v.issues.find((i) => i.issueId === B01)?.status).toBe("Resolved");
    expect(v.sites["SITE-B"].goodwill).toBe(35);
    expect(v.sites["SITE-B"].goodwill).toBeLessThanOrEqual(
      SITE_PROFILES["SITE-B"].initialGoodwill
    );
    const sbp = v.vsLedger.find(
      (r) =>
        !r.superseded &&
        r.submissionId === "sub-b01-d14" &&
        r.VSTESTCD === "SYSBP"
    );
    expect(sbp?.VSSTRESN).toBe(120);
    ok(engine, { type: "CLOSE_QUERY", queryId: id });
    expect(
      engine.view().queries.find((q) => q.queryId === id)?.communicationState
    ).toBe("Closed");
  });

  it("charges -3 for a duplicate query and creates no parallel response", () => {
    const engine = wave1Done();
    sendQuery(engine, B01, true);
    const dup = sendQuery(engine, B01, true);
    const q = engine.view().queries.find((x) => x.queryId === dup);
    expect(q).toMatchObject({
      duplicate: true,
      communicationState: "Closed",
      goodwillCost: -3,
    });
    expect(engine.view().sites["SITE-B"].goodwill).toBe(31);
  });

  it("dispositions the A02 partial date as AcceptedUncertainty only", () => {
    const engine = wave1Done();
    const partial = engine.view().issues.find((i) => i.code === "PARTIAL_DATE");
    expect(partial?.status).toBe("ReadyForReview");
    const rejected = engine.dispatch({
      type: "ACCEPT_CORRECTION",
      issueId: partial?.issueId as string,
    });
    expect(rejected.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
    ok(engine, {
      type: "ACCEPT_UNCERTAINTY",
      issueId: partial?.issueId as string,
    });
    expect(
      engine.view().issues.find((i) => i.code === "PARTIAL_DATE")?.status
    ).toBe("AcceptedUncertainty");
    const other = engine.dispatch({ type: "ACCEPT_UNCERTAINTY", issueId: B01 });
    expect(other.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });

  it("moves a draft to Queued on send, can cancel drafts, and rejects bad workflow commands", () => {
    const engine = wave1Done();
    ok(engine, {
      type: "DRAFT_QUERY",
      issueId: B01,
      evidenceLinked: false,
      message: "Please check.",
    });
    const draft = engine.view().queries.at(-1);
    expect(draft).toMatchObject({
      communicationState: "Draft",
      messageSent: "Please check.",
      sentAtMinute: -1,
    });
    ok(engine, { type: "CANCEL_QUERY", queryId: draft?.queryId as string });
    expect(engine.view().queries.at(-1)?.communicationState).toBe("Closed");
    const narrative = engine
      .view()
      .issues.find((i) => i.code === "NARRATIVE_REPEAT");
    const reasons = [
      engine.dispatch({
        type: "CANCEL_QUERY",
        queryId: draft?.queryId as string,
      }),
      engine.dispatch({ type: "SEND_QUERY", queryId: "qry-9999" }),
      engine.dispatch({
        type: "DRAFT_QUERY",
        issueId: "nope",
        evidenceLinked: false,
      }),
      engine.dispatch({
        type: "ACCEPT_CORRECTION",
        issueId: narrative?.issueId as string,
      }),
    ].map((events) => events.find((e) => e.type === "COMMAND_REJECTED"));
    expect(reasons.every((r) => r !== undefined)).toBe(true);
  });

  it("returns an answered issue to Open on REJECT_RESPONSE and discards the pending revision", () => {
    const engine = wave1Done();
    const id = sendQuery(engine, B01, true);
    awaitAnswer(engine, id);
    ok(engine, { type: "REJECT_RESPONSE", issueId: B01 });
    const issue = engine.view().issues.find((i) => i.issueId === B01);
    expect(issue?.status).toBe("Open");
    expect(issue?.pendingRevisionId).toBeUndefined();
  });
});
