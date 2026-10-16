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
  FULL_GRAPH,
  WAVE1_GRAPH,
  minuteAt,
  type ProtocolDriftSaveFile,
} from "@/lib/protocol-drift";
import {
  WAVE_END_MINUTES,
  ok,
  publish,
  resolveAll,
  runUntil,
  startEngine,
} from "./helpers";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

/** Full study with Wave 1 dispositioned only after the amendment (#2164). */
function lateCorrectionSave(): ProtocolDriftSaveFile {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  runUntil(engine, minuteAt(20, 8, 0));
  publish(engine, FULL_GRAPH, "p2");
  runUntil(engine, WAVE_END_MINUTES[3]);
  resolveAll(engine);
  if (engine.view().fsmState === "WAVE_REVIEW")
    ok(engine, { type: "SET_PAUSED", isPaused: true });
  const event = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

describe("lock gate after a late site correction (#2164)", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => cleanup());

  it("replays the stale unpaired row from the gate and clears it", async () => {
    render(<ProtocolDriftGame />);
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    await act(async () => {
      await useProtocolDriftStore.getState().restoreSave(lateCorrectionSave());
    });

    expect(
      screen.getByRole("button", { name: "Replay stale ADaM derivations" })
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Request Database Lock" })
      );
    });
    let gate = await screen.findByRole("dialog", {
      name: /Dual Database Lock Audit Gate/,
    });
    expect(within(gate).getByText(/Stale derivation:/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        within(gate).getByRole("button", { name: "Replay derivations" })
      );
    });
    gate = await screen.findByRole("dialog", {
      name: /Dual Database Lock Audit Gate/,
    });
    expect(
      await within(gate).findByText("ALL REGULATORY GATES CLEARED")
    ).toBeTruthy();
    expect(
      within(gate).getByRole("button", { name: "Confirm Database Lock" })
    ).toHaveProperty("disabled", false);
  });
});
