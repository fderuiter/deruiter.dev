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
import {
  isAwaitingLock,
  useProtocolDriftStore,
} from "@/components/protocol-drift/store";
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

/** Full study with Waves 1 and 2 settled, paused a few hours before Wave 3. */
function beforeWave3(): ProtocolDriftSaveFile {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  resolveAll(engine);
  runUntil(engine, minuteAt(20, 8, 0));
  publish(engine, FULL_GRAPH, "p2");
  runUntil(engine, WAVE_END_MINUTES[2]);
  resolveAll(engine);
  runUntil(engine, minuteAt(28, 20, 0));
  if (engine.view().fsmState !== "PAUSED")
    ok(engine, { type: "SET_PAUSED", isPaused: true });
  const event = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

async function reachWave3Review() {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act(async () => {
    await useProtocolDriftStore.getState().restoreSave(beforeWave3());
  });
  await act(async () => {
    await useProtocolDriftStore
      .getState()
      .command({ type: "ADVANCE_TO", minute: WAVE_END_MINUTES[3] });
  });
  return screen.findByRole("dialog", { name: "Wave 3 Review" });
}

describe("after the final wave (#2165)", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => cleanup());

  it("offers Request Database Lock on the Wave 3 review", async () => {
    const review = await reachWave3Review();
    await act(async () => {
      fireEvent.click(
        within(review).getByRole("button", { name: "Request Database Lock" })
      );
    });
    expect(
      await screen.findByRole("dialog", {
        name: /Dual Database Lock Audit Gate/,
      })
    ).toBeTruthy();
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe(
      "LOCK_REVIEW"
    );
  });

  it("closes into a paused workbench and keeps the clock off empty days", async () => {
    const review = await reachWave3Review();
    await act(async () => {
      fireEvent.click(within(review).getByRole("button", { name: "Close" }));
    });
    const store = useProtocolDriftStore.getState;
    expect(store().snapshot?.fsmState).toBe("PAUSED");
    expect(
      screen.getByRole("button", { name: "Request Database Lock" })
    ).toBeTruthy();
    expect(isAwaitingLock(store().view)).toBe(true);

    const minute = store().snapshot?.minute;
    await act(async () => {
      await store().togglePause();
    });
    expect(store().snapshot?.fsmState).toBe("PAUSED");
    expect(store().snapshot?.minute).toBe(minute);
    expect(store().notice?.text).toMatch(/Request Database Lock/);
  });
});
