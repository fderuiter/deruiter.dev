import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import {
  clearAutosave,
  readAutosave,
} from "@/components/protocol-drift/persistence";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { deserializeSave, minuteAt } from "@/lib/protocol-drift";
import { installFlowMocks } from "./ui-helpers";

const downloads: Array<{ data: string; name: string }> = [];
vi.mock("@/lib/download", () => ({
  downloadFile: (data: string, name: string) => {
    downloads.push({ data, name });
  },
}));
vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

async function act_<T>(work: () => Promise<T>): Promise<T> {
  let out!: T;
  await act(async () => {
    out = await work();
  });
  return out;
}

async function publishTracer() {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act_(async () => {
    fireEvent.click(screen.getByLabelText(/Tracer bullet/));
  });
  await act_(async () => {
    fireEvent.click(screen.getByRole("button", { name: /accept assignment/i }));
  });
  fireEvent.click(screen.getByText(/Pipeline as text/));
  fireEvent.change(screen.getByLabelText(/Load a reference pipeline/), {
    target: { value: "tracer" },
  });
  await act_(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
  });
  await act_(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Run Local Test" }));
  });
  await act_(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Publish Revision" }));
  });
}

describe("save, autosave and import", () => {
  beforeAll(() => installFlowMocks());
  afterEach(async () => {
    cleanup();
    downloads.length = 0;
    await clearAutosave();
  });

  it("autosaves when a revision is published", async () => {
    await publishTracer();
    await waitFor(async () => {
      const save = await readAutosave();
      expect(save?.fsmState).toBe("PAUSED");
    });
    const save = (await readAutosave())!;
    expect(save.graph.nodes).toHaveLength(4);
    expect(save.format).toBe("pd-101-save-v1");
  });

  it("autosaves at the WAVE_REVIEW boundary", async () => {
    await publishTracer();
    await act_(() =>
      useProtocolDriftStore
        .getState()
        .command({ type: "ADVANCE_TO", minute: minuteAt(14, 23, 59) })
    );
    await waitFor(async () => {
      expect((await readAutosave())?.fsmState).toBe("WAVE_REVIEW");
    });
  });

  it("offers Resume autosave on the briefing and restores graph, clock and ledgers", async () => {
    await publishTracer();
    await act_(() =>
      useProtocolDriftStore
        .getState()
        .command({ type: "ADVANCE_TO", minute: minuteAt(14, 23, 59) })
    );
    await waitFor(async () =>
      expect((await readAutosave())?.fsmState).toBe("WAVE_REVIEW")
    );
    const before = useProtocolDriftStore.getState().view!;
    expect(before.vsLedger).toHaveLength(18);
    cleanup();

    render(<ProtocolDriftGame />);
    const resume = await screen.findByRole("button", {
      name: /Resume autosave/,
    });
    await act_(async () => {
      fireEvent.click(resume);
    });
    const after = useProtocolDriftStore.getState().view!;
    expect(useProtocolDriftStore.getState().nodes).toHaveLength(4);
    expect(useProtocolDriftStore.getState().edges).toHaveLength(5);
    expect(after.publishedRevisionId).toBe("p1");
    expect(after.vsLedger.map((r) => r.recordId)).toEqual(
      before.vsLedger.map((r) => r.recordId)
    );
    expect(useProtocolDriftStore.getState().snapshot!.fsmState).toBe(
      "WAVE_REVIEW"
    );
    expect(screen.queryByRole("dialog", { name: /Trial Briefing/ })).toBeNull();
  });

  it("exports a pd-101-save-v1.json that imports back to the same state", async () => {
    await publishTracer();
    await act_(() =>
      useProtocolDriftStore
        .getState()
        .command({ type: "ADVANCE_TO", minute: minuteAt(8, 12, 0) })
    );
    await act_(() => useProtocolDriftStore.getState().exportSave());
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toBe("pd-101-save-v1.json");
    const file = deserializeSave(downloads[0].data);
    expect(file.graph.edges).toHaveLength(5);

    const clock = useProtocolDriftStore.getState().snapshot!.clockLabel;
    cleanup();
    render(<ProtocolDriftGame />);
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    const imported = await act_(() =>
      useProtocolDriftStore.getState().importSave(downloads[0].data)
    );
    expect(imported).toBe(true);
    expect(useProtocolDriftStore.getState().snapshot!.clockLabel).toBe(clock);
    expect(
      useProtocolDriftStore.getState().nodes.map((n) => n.position)
    ).toEqual(file.graph.nodes.map((n) => n.position));
  });

  it("rejects a tampered or malformed save and changes nothing", async () => {
    await publishTracer();
    await act_(() => useProtocolDriftStore.getState().exportSave());
    const good = JSON.parse(downloads[0].data) as { stateHash: string };
    const before = useProtocolDriftStore.getState().snapshot!.clockLabel;

    const tampered = JSON.stringify({ ...good, stateHash: "deadbeef" });
    expect(
      await act_(() => useProtocolDriftStore.getState().importSave(tampered))
    ).toBe(false);
    expect(useProtocolDriftStore.getState().notice?.tone).toBe("error");
    expect(
      await act_(() => useProtocolDriftStore.getState().importSave("not json"))
    ).toBe(false);
    expect(useProtocolDriftStore.getState().snapshot!.clockLabel).toBe(before);
    expect(useProtocolDriftStore.getState().nodes).toHaveLength(4);
  });
});
