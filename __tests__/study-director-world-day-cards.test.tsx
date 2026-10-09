import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
  MorningDigest,
  OvernightReport,
} from "@/lib/study-director-world";
import {
  DigestCard,
  OvernightCard,
} from "@/components/study-director-world/DayCards";

const digest: MorningDigest = {
  day: 2,
  weekday: "Tuesday",
  phase: "startup",
  startsAt: 8 * 60 + 30,
  routineMinutes: 30,
  energy: 90,
  lines: [
    { tone: "neutral", text: "The inbox is quiet." },
    { tone: "bad", text: "Walt is behind on visits." },
    { tone: "good", text: "Maya cleared the queries." },
  ],
} as MorningDigest;

const report = (over: Partial<OvernightReport> = {}): OvernightReport => ({
  day: 1,
  lines: [
    { tone: "neutral", text: "Nothing else moved." },
    { tone: "bad", text: "Site 2 slipped." },
  ],
  newPhase: null,
  complete: false,
  ...over,
});

afterEach(cleanup);

describe("DigestCard", () => {
  it("lists what changed before what held, tagged in words", () => {
    render(<DigestCard digest={digest} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "WorseWalt is behind on visits.",
      "BetterMaya cleared the queries.",
      "The inbox is quiet.",
    ]);
    expect(screen.getByText("Tuesday morning")).toBeTruthy();
    expect(screen.getByTestId("world-digest").textContent).toMatch(
      /8:30 AM after 30 minutes of routine/
    );
  });
});

describe("OvernightCard", () => {
  const setup = (r: OvernightReport) => {
    const onNextDay = vi.fn();
    const onCloseout = vi.fn();
    render(
      <OvernightCard
        report={r}
        nextDay={2}
        onNextDay={onNextDay}
        onCloseout={onCloseout}
        closeoutLabel="See the closeout"
      />
    );
    return { onNextDay, onCloseout };
  };

  it("focuses the drive-in button and starts the next day on N", () => {
    const { onNextDay } = setup(report());
    const button = screen.getByRole("button", { name: /Drive in for day 2/ });
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "n" });
    expect(onNextDay).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    expect(onNextDay).toHaveBeenCalledTimes(2);
  });

  it("says when the night was quiet", () => {
    setup(report({ lines: [] }));
    expect(screen.getByText("A quiet night.")).toBeTruthy();
  });

  it("offers the closeout, not another day, when the study is over", () => {
    const { onNextDay, onCloseout } = setup(report({ complete: true }));
    const button = screen.getByRole("button", { name: "See the closeout" });
    fireEvent.keyDown(button, { key: "n" });
    expect(onNextDay).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onCloseout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Drive in/ })).toBeNull();
  });
});
