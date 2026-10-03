import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import {
  isoToMinute,
  TRACER_SUBMISSIONS,
  FULL_SUBMISSIONS,
} from "@/lib/protocol-drift";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

const B01_D14 = FULL_SUBMISSIONS.find((f) => f.submissionId === "sub-b01-d14");
void TRACER_SUBMISSIONS;

async function advance(minute: number) {
  const store = useProtocolDriftStore.getState();
  for (let guard = 0; guard < 40; guard += 1) {
    const view = useProtocolDriftStore.getState().view;
    if (!view || view.minute >= minute) return;
    await act(async () => {
      if (view.fsmState === "WAVE_REVIEW") {
        await store.command({ type: "SET_PAUSED", isPaused: true });
      }
      await store.command({ type: "ADVANCE_TO", minute });
    });
  }
}

async function reachSiteBIssue() {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /accept assignment/i }));
  });
  await act(async () => {
    fireEvent.click(screen.getByText(/Pipeline as text/));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/Load a reference pipeline/), {
      target: { value: "wave1" },
    });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Run Local Test" }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Publish Revision" }));
  });
  await advance(isoToMinute(B01_D14!.submittedAt) + 180);
  const view = useProtocolDriftStore.getState().view!;
  const issue = view.issues.find(
    (i) => i.submissionId === "sub-b01-d14" && i.code === "OUT_OF_RANGE"
  );
  expect(issue).toBeTruthy();
  await act(async () => {
    useProtocolDriftStore
      .getState()
      .select({ issueId: issue!.issueId, submissionId: issue!.submissionId });
  });
  return issue!;
}

describe("Forensic Inspector: Site B transposition", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => cleanup());

  it("shows the paper worksheet beside the eCRF entry and flags the conflict", async () => {
    await reachSiteBIssue();
    const form = screen.getByTestId("pane-form");
    expect(within(form).getByText(/Mercy General/)).toBeTruthy();
    expect(within(form).getByText(/J\. Kelly RN/)).toBeTruthy();
    expect(within(form).getByText(/120\/80 mmHg/)).toBeTruthy();
    const conflict = form.querySelector("[data-conflict='true']");
    expect(conflict?.textContent).toContain("210");
    expect(conflict?.textContent).toContain("CONFLICT");
  });

  it("lists the node hop trail for the selected submission", async () => {
    await reachSiteBIssue();
    const trace = screen.getByTestId("pane-trace");
    expect(within(trace).getByLabelText("Node hop trail")).toBeTruthy();
    expect(trace.textContent).toContain("SourceIngest");
    expect(trace.textContent).toContain("ExtractField");
  });

  it("composes an evidence-linked query that resolves the issue after review", async () => {
    const issue = await reachSiteBIssue();
    const composer = screen.getByRole("form", {
      name: "Structured query composer",
    });
    const attach = within(composer).getByRole("checkbox");
    await act(async () => {
      fireEvent.click(attach);
    });
    expect(
      within(composer).getByLabelText("Message preview").textContent
    ).toMatch(/Attached source evidence/);
    expect(within(composer).getByTestId("query-impact").textContent).toMatch(
      /Expected latency \d+h · Goodwill cost -1/
    );
    await act(async () => {
      fireEvent.click(
        within(composer).getByRole("button", { name: /Send Query/ })
      );
    });
    const sent = useProtocolDriftStore.getState().view!.queries.at(-1)!;
    expect(sent.isEvidenceLinked).toBe(true);
    expect(sent.communicationState).toBe("Queued");

    await advance(useProtocolDriftStore.getState().view!.minute + 100 * 60);
    const after = useProtocolDriftStore.getState().view!;
    expect(after.queries.at(-1)!.rubberStamped).toBe(false);
    const ready = after.issues.find((i) => i.issueId === issue.issueId)!;
    expect(ready.status).toBe("ReadyForReview");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Accept correction" })
      );
    });
    const done = useProtocolDriftStore.getState().view!;
    expect(done.issues.find((i) => i.issueId === issue.issueId)!.status).toBe(
      "Resolved"
    );
    expect(
      done.vsLedger.some(
        (r) => r.superseded && r.submissionId === "sub-b01-d14"
      )
    ).toBe(true);
  });

  it("keeps the issue Open when a generic query is rubber-stamped", async () => {
    const issue = await reachSiteBIssue();
    const composer = screen.getByRole("form", {
      name: "Structured query composer",
    });
    await act(async () => {
      fireEvent.click(
        within(composer).getByRole("button", { name: /Send Query/ })
      );
    });
    const sent = useProtocolDriftStore.getState().view!.queries.at(-1)!;
    expect(sent.isEvidenceLinked).toBe(false);
    await advance(useProtocolDriftStore.getState().view!.minute + 100 * 60);
    const after = useProtocolDriftStore.getState().view!;
    const stamped = after.queries.at(-1)!;
    expect(stamped.rubberStamped).toBe(true);
    expect(stamped.responseReceived).toBe("Confirmed Correct");
    expect(after.issues.find((i) => i.issueId === issue.issueId)!.status).toBe(
      "Open"
    );
    expect(screen.getByText(/Rubber-stamped reply/)).toBeTruthy();
  });
});
