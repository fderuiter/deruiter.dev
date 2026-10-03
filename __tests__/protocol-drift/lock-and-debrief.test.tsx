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
  WAVE1_GRAPH,
  minuteAt,
  type ProtocolDriftEngine,
  type ProtocolDriftSaveFile,
} from "@/lib/protocol-drift";
import { ok, playFullLevel, publish, runUntil, startEngine } from "./helpers";
import { installFlowMocks } from "./ui-helpers";

const downloads: Array<{ data: string; name: string; mime?: string }> = [];
vi.mock("@/lib/download", () => ({
  downloadFile: (
    data: string,
    name: string,
    options?: { mimeType?: string }
  ) => {
    downloads.push({ data, name, mime: options?.mimeType });
  },
}));
vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

function saveOf(engine: ProtocolDriftEngine): ProtocolDriftSaveFile {
  const event = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

async function mountWith(save: ProtocolDriftSaveFile) {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act(async () => {
    await useProtocolDriftStore.getState().restoreSave(save);
  });
}

describe("Database lock and debrief", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => {
    cleanup();
    downloads.length = 0;
  });

  it("clears both gates, locks, and offers the four dataset downloads", async () => {
    const engine = startEngine();
    playFullLevel(engine);
    await mountWith(saveOf(engine));
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Request Database Lock" })
      );
    });
    const gate = await screen.findByRole("dialog", {
      name: /Dual Database Lock Audit Gate/,
    });
    const sdtm = within(gate).getByRole("region", {
      name: "SDTM Database Lock checklist",
    });
    expect(within(sdtm).getByText(/110 of 110/)).toBeTruthy();
    expect(within(sdtm).getByText(/6 of 6/)).toBeTruthy();
    expect(within(gate).queryAllByText("FAIL")).toHaveLength(0);
    const adam = within(gate).getByRole("region", {
      name: "ADaM Analysis Readiness checklist",
    });
    expect(within(adam).getByText(/20 of 20/)).toBeTruthy();
    expect(within(gate).getByText("ALL REGULATORY GATES CLEARED")).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        within(gate).getByRole("button", { name: "Confirm Database Lock" })
      );
    });
    const debrief = await screen.findByRole("dialog", {
      name: "Regulatory Audit Debrief",
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("LOCKED");
    expect(
      within(debrief).getByText(/No systemic data fabrication findings/)
    ).toBeTruthy();
    expect(
      within(debrief).getByText(/2025-10 was retained at collected precision/)
    ).toBeTruthy();
    const card = within(debrief).getByRole("region", {
      name: "Systems Efficiency Scorecard",
    });
    expect(card.textContent).toMatch(/Trial duration/);
    expect(card.textContent).toMatch(/Query restraint ratio/);
    expect(within(card).getAllByText(/goodwill retained/)).toHaveLength(3);
    expect(
      within(card).getByLabelText("Preventative badges").children
    ).toHaveLength(3);

    await act(async () => {
      fireEvent.click(within(debrief).getByRole("button", { name: "VS.csv" }));
    });
    expect(downloads[0].name).toBe("VS.csv");
    expect(downloads[0].mime).toBe("text/csv");
    expect(downloads[0].data.trim().split("\r\n").length).toBe(111);
    for (const name of ["MH.csv", "ADVS.csv", "audit_trail.json"]) {
      await act(async () => {
        fireEvent.click(within(debrief).getByRole("button", { name }));
      });
    }
    expect(downloads.map((d) => d.name)).toEqual([
      "VS.csv",
      "MH.csv",
      "ADVS.csv",
      "audit_trail.json",
    ]);

    // The workbench is read-only once locked.
    await act(async () => {
      fireEvent.click(
        within(debrief).getByRole("button", { name: "View locked workbench" })
      );
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Show debrief" })).toBeTruthy();
    const accepted = await useProtocolDriftStore
      .getState()
      .command({ type: "SET_PAUSED", isPaused: false });
    expect(accepted?.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      true
    );
  });

  it("shows failing checks with an Inspect link and lets the player return unpenalized", async () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, minuteAt(28, 23, 59));
    if (engine.view().fsmState === "WAVE_REVIEW") {
      ok(engine, { type: "SET_PAUSED", isPaused: true });
    }
    await mountWith(saveOf(engine));
    const before = useProtocolDriftStore.getState().view!.sites;

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Request Database Lock" })
      );
    });
    const gate = await screen.findByRole("dialog", {
      name: /Dual Database Lock Audit Gate/,
    });
    expect(within(gate).getAllByText("FAIL").length).toBeGreaterThan(0);
    expect(
      (
        within(gate).getByRole("button", {
          name: "Confirm Database Lock",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    const inspect = within(gate).getAllByRole("button", { name: "Inspect" })[0];
    await act(async () => {
      fireEvent.click(inspect);
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");
    expect(useProtocolDriftStore.getState().inspectorExpanded).toBe(true);
    expect(useProtocolDriftStore.getState().view!.sites).toEqual(before);
  });

  it("pauses for the Amendment 01 memo at Day 20 08:00", async () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, minuteAt(20, 7, 0));
    await mountWith(saveOf(engine));
    await act(async () => {
      await useProtocolDriftStore
        .getState()
        .command({ type: "SET_PAUSED", isPaused: false });
      await useProtocolDriftStore.getState().tick(1000);
      await useProtocolDriftStore.getState().tick(1000);
    });
    await act(async () => {
      await useProtocolDriftStore
        .getState()
        .command({ type: "ADVANCE_TO", minute: minuteAt(20, 9, 0) });
    });
    const memo = await screen.findByRole("dialog", {
      name: /Protocol Amendment 01/,
    });
    expect(memo.textContent).toContain("Site A activates v2 on Day 22");
    expect(memo.textContent).toContain(
      "Site B (delayed IRB review) activates v2 on Day 26"
    );
    await act(async () => {
      fireEvent.click(
        within(memo).getByRole("button", { name: "Acknowledge Memo" })
      );
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
