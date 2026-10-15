import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { WAVE1_GRAPH, type ProtocolDriftSaveFile } from "@/lib/protocol-drift";
import {
  WAVE_END_MINUTES,
  ok,
  publish,
  runUntil,
  startEngine,
} from "./helpers";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

function saveOf(engine: ReturnType<typeof startEngine>): ProtocolDriftSaveFile {
  const event = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

describe("skip to next event (#2170)", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => cleanup());

  it("the view names the next noticeable event, ahead of the clock", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    const v = engine.view();
    expect(v.nextEventMinute).not.toBeNull();
    expect(v.nextEventMinute as number).toBeGreaterThanOrEqual(v.minute);
  });

  it("has nothing to skip to once the study's last event has run", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[3] + 60 * 24 * 30);
    expect(engine.view().nextEventMinute).toBeNull();
  });

  it("S runs the clock forward to the next event and no further", async () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    const save = saveOf(engine);
    const { container } = render(<ProtocolDriftGame />);
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    await act(async () => {
      await useProtocolDriftStore.getState().restoreSave(save);
    });
    const store = useProtocolDriftStore.getState;
    const before = store().snapshot?.minute as number;
    const target = store().view?.nextEventMinute as number;
    expect(target).toBeGreaterThan(before);
    const root = container.querySelector("[data-game='protocol-drift']");
    await act(async () => {
      fireEvent.keyDown(root as Element, { key: "s" });
    });
    const after = store().snapshot?.minute as number;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(target);
    expect(
      screen.getByRole("button", { name: "Skip to next event (S)" })
    ).toBeTruthy();
  });

  it("asks for a published revision before skipping from a draft", async () => {
    render(<ProtocolDriftGame />);
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    await act(async () => {
      await useProtocolDriftStore.getState().acceptBrief("full");
    });
    await act(async () => {
      await useProtocolDriftStore.getState().skipToNextEvent();
    });
    expect(useProtocolDriftStore.getState().notice?.text).toBe(
      "Run Local Test and Publish Revision before skipping."
    );
  });
});
