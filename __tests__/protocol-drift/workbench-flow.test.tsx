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
import { minuteAt } from "@/lib/protocol-drift";
import { installFlowMocks } from "./ui-helpers";

const playTone = vi.fn();
vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => true, playTone }),
}));

async function click(name: RegExp | string, exact = false) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: exact ? name : name }));
  });
}

async function startTracer() {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing: Study PD-101/ });
  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Tracer bullet/));
  });
  await click(/accept assignment/i);
}

async function loadReference(id: string) {
  const summary = screen.getByText(/Pipeline as text/);
  await act(async () => {
    fireEvent.click(summary);
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/Load a reference pipeline/), {
      target: { value: id },
    });
  });
  await click("Load", true);
}

describe("Protocol Drift workbench flow", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => {
    cleanup();
    playTone.mockClear();
  });

  it("opens on the briefing and accepting moves BRIEF to DRAFT", async () => {
    render(<ProtocolDriftGame />);
    const dialog = await screen.findByRole("dialog", {
      name: /Trial Briefing: Study PD-101/,
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("BRIEF");
    await click(/accept assignment/i);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("DRAFT");
    expect(screen.getByTestId("sim-clock").textContent).toBe("Day 0 08:00");
  });

  it("shows header, strip, rails and footer from the layout spec", async () => {
    await startTracer();
    expect(screen.getByText(/Study PD-101/)).toBeTruthy();
    expect(
      screen.getByText(/Wave 1: Establish baseline vitals ingestion for Site A/)
    ).toBeTruthy();
    expect(screen.getByTestId("debt-fab").textContent).toContain("0.00");
    expect(screen.getByLabelText("Chip toolbox")).toBeTruthy();
    expect(screen.getByLabelText("Site rail")).toBeTruthy();
    expect(screen.getByText("Seed #48291")).toBeTruthy();
    expect(screen.getByText("[Space] Pause")).toBeTruthy();
    expect(screen.getByTestId("conservation-wall")).toBeTruthy();
    expect(
      screen.getByText(/CONSERVATION WALL — CDISC REGULATORY BOUNDARY/)
    ).toBeTruthy();
  });

  it("does not render a second Navbar landmark", async () => {
    await startTracer();
    expect(
      document.querySelectorAll("nav[aria-label='Main navigation']").length
    ).toBe(0);
  });

  it("fails the local test when ExtractField.dbp is unwired", async () => {
    await startTracer();
    await loadReference("tracer");
    const store = useProtocolDriftStore.getState();
    const broken = store.edges.filter((e) => !(e.sourceHandle === "dbp"));
    await act(async () => {
      store.setEdges(broken);
    });
    await click("Run Local Test");
    const result = useProtocolDriftStore.getState().validation;
    expect(result?.valid).toBe(false);
    expect(result?.errors.join(" ")).toContain(
      "Unmapped observation handle: dbp"
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Local test failed"
    );
    // A failed test holds in VALIDATE; any edit returns to DRAFT.
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe(
      "VALIDATE"
    );
  });

  it("walks Draft, Local Test, Publish, then Space runs and N steps one hour", async () => {
    await startTracer();
    await loadReference("tracer");
    const run = screen.getByRole("button", { name: /Run \(Space\)/ });
    await click("Run Local Test");
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe(
      "DEPLOY_READY"
    );
    await click("Publish Revision");
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");
    expect(useProtocolDriftStore.getState().snapshot?.publishedRevisionId).toBe(
      "p1"
    );

    const root = document.querySelector(
      "[data-game='protocol-drift']"
    ) as HTMLElement;
    await act(async () => {
      fireEvent.keyDown(root, { key: "n" });
    });
    expect(screen.getByTestId("sim-clock").textContent).toBe("Day 0 09:00");
    await act(async () => {
      fireEvent.keyDown(root, { key: " " });
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("RUNNING");
    expect(run).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(root, { key: " " });
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");
    await click(/Speed 5x/);
    expect(useProtocolDriftStore.getState().snapshot?.speed).toBe(5);
  });

  it("refuses to unpause before a revision is published", async () => {
    await startTracer();
    const root = document.querySelector(
      "[data-game='protocol-drift']"
    ) as HTMLElement;
    await act(async () => {
      fireEvent.keyDown(root, { key: " " });
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("DRAFT");
    expect(useProtocolDriftStore.getState().notice?.text).toMatch(
      /Publish Revision/
    );
  });

  it("ingests the Wave 1 tracer cohort and opens the wave review with 18 confirmed rows", async () => {
    await startTracer();
    await loadReference("tracer");
    await click("Run Local Test");
    await click("Publish Revision");
    await act(async () => {
      await useProtocolDriftStore
        .getState()
        .command({ type: "ADVANCE_TO", minute: minuteAt(14, 23, 59) });
    });
    const dialog = await screen.findByRole("dialog", { name: /Wave 1 Review/ });
    expect(within(dialog).getByTestId("wave-confirmed").textContent).toBe("18");
    expect(within(dialog).getByTestId("wave-issues").textContent).toBe("0");
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe(
      "WAVE_REVIEW"
    );
    expect(screen.getByTestId("debt-fab").textContent).toContain("0.00");
    expect(screen.getByTestId("debt-loss").textContent).toContain("0");
  });

  it("plays the wire-snap cue for a valid wire and the reject cue for an invalid one", async () => {
    await startTracer();
    const store = useProtocolDriftStore.getState();
    await act(async () => {
      await store.addChip("SourceIngest", { x: 40, y: 180 });
      await store.addChip("CDISCSink", { x: 760, y: 180 });
    });
    const [ingest, sink] = useProtocolDriftStore.getState().nodes;
    playTone.mockClear();
    await act(async () => {
      await store.connect({
        source: sink.id,
        sourceHandle: "snapshot_out",
        target: ingest.id,
        targetHandle: "raw_entry",
      });
    });
    expect(useProtocolDriftStore.getState().edges).toHaveLength(0);
    expect(playTone).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 196 })
    );
    expect(useProtocolDriftStore.getState().notice?.text).toMatch(
      /Wire rejected/
    );
  });
});
