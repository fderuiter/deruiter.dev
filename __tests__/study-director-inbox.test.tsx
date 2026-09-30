import React from "react";
import { fromPartial } from "@total-typescript/shoehorn";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { STUDY_24_081_TEAM } from "@/lib/study-director";
import type { StudyEvent, StudyState } from "@/lib/study-director";
import {
  daysLeft,
  lapseLabel,
  senderOf,
} from "@/components/study-director/messages";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

describe("message helpers", () => {
  it("counts days left from the day a message first arrived", () => {
    const event = { id: "e", ttl: 3 } as StudyEvent;
    const state = fromPartial<StudyState>({ day: 5, seen: { e: 4 } });
    expect(daysLeft(state, event)).toBe(2);
    expect(daysLeft({ ...state, day: 6 }, event)).toBe(1);
  });

  it("says when a message lapses tonight", () => {
    expect(lapseLabel(1)).toBe("Lapses tonight");
    expect(lapseLabel(3)).toBe("Lapses in 3 days");
  });

  it("recognises team members, the sponsor, sites and the company", () => {
    expect(
      senderOf("Maya (Data Manager)", STUDY_24_081_TEAM).member?.name
    ).toBe("Maya");
    expect(senderOf("Arcadia Therapeutics (Sponsor)", []).kind).toBe("sponsor");
    expect(senderOf("Site 02 coordinator", []).kind).toBe("site");
    expect(senderOf("Your boss", []).kind).toBe("company");
  });
});

describe("Study Director inbox and decisions", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function start() {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
  }

  it("shows the sender, when the message arrived and when it lapses", () => {
    start();
    const decision = screen.getByTestId("study-decision");
    expect(within(decision).getByText(/received day 1/)).toBeTruthy();
    expect(
      within(decision).getByText(/^Lapses (tonight|in \d+ days)$/)
    ).toBeTruthy();
    const inbox = screen.getByRole("region", { name: "Inbox" });
    expect(within(inbox).getByText("New")).toBeTruthy();
  });

  it("explains why an option is out of reach", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 01" }));
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 02" }));
    const blocked = screen.getByRole("button", {
      name: /Add them after an impact assessment/,
    }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    expect(blocked.textContent).toMatch(/Needs 3, 1 left/);
  });

  it("changes the documentation note once the decision will be on file", () => {
    start();
    expect(screen.getByText(/an inspector may ask/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Document this decision/));
    expect(screen.getByText(/go on file/)).toBeTruthy();
  });
});
