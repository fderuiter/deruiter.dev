/**
 * Two decoupled state machines: query communication and issue resolution.
 * A query response never resolves an issue on its own.
 */
import type { IssueStatus, QueryState } from "../types";

/** Thrown on an illegal query or issue transition. */
export class ProtocolDriftWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolDriftWorkflowError";
  }
}

/** Legal query communication transitions. */
export const QUERY_TRANSITIONS: Readonly<
  Record<QueryState, readonly QueryState[]>
> = {
  Draft: ["Queued", "Closed"],
  Queued: ["AwaitingResponse"],
  AwaitingResponse: ["Answered"],
  Answered: ["Closed"],
  Closed: [],
};

/**
 * Legal issue resolution transitions. Open to ReadyForReview covers an
 * amended record arriving after a generic query that was not rubber-stamped;
 * Open and AwaitingEvidence to Resolved is reserved for the engine when a
 * pipeline repair or correction clears the condition on reprocessing.
 */
export const ISSUE_TRANSITIONS: Readonly<
  Record<IssueStatus, readonly IssueStatus[]>
> = {
  Open: ["AwaitingEvidence", "ReadyForReview", "Resolved"],
  AwaitingEvidence: ["ReadyForReview", "Resolved"],
  ReadyForReview: ["Resolved", "AcceptedUncertainty", "Open"],
  Resolved: [],
  AcceptedUncertainty: [],
};

/** Returns the next query state or throws. */
export function queryTransition(from: QueryState, to: QueryState): QueryState {
  if (!QUERY_TRANSITIONS[from].includes(to)) {
    throw new ProtocolDriftWorkflowError(
      `Illegal query transition: ${from} -> ${to}`
    );
  }
  return to;
}

/** Returns the next issue state or throws. */
export function issueTransition(
  from: IssueStatus,
  to: IssueStatus
): IssueStatus {
  if (!ISSUE_TRANSITIONS[from].includes(to)) {
    throw new ProtocolDriftWorkflowError(
      `Illegal issue transition: ${from} -> ${to}`
    );
  }
  return to;
}

/** True for issue states that still need the architect's action. */
export function isIssueOpen(status: IssueStatus): boolean {
  return status !== "Resolved" && status !== "AcceptedUncertainty";
}

/** True for query states that count as open or unreviewed at lock. */
export function isQueryOpen(state: QueryState): boolean {
  return (
    state === "Queued" || state === "AwaitingResponse" || state === "Answered"
  );
}

/** The canned site reply when a generic query is rubber-stamped. */
export const RUBBER_STAMP_RESPONSE = "Confirmed Correct";
