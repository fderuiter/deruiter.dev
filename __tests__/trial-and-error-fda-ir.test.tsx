// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  FDA_IR_SCENARIO,
  PASS_STUDY,
  type Scenario,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

beforeEach(() => {
  announce.mockClear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(cleanup);

const IR = FDA_IR_SCENARIO;
/** The IR with a bigger CPU budget, so only the clock can end it. */
const ROOMY: Scenario = { ...IR, table: { ...IR.table, startingCpu: 40 } };

const cards = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("[data-card-id]"));
const clock = () => screen.getByTestId("fda-clock");
const hours = () => screen.getByTestId("fda-clock-hours").textContent;

function takeSeat() {
  fireEvent.click(screen.getByTestId("boss-intro-start"));
}

function discardOne() {
  fireEvent.click(cards()[0]);
  fireEvent.click(screen.getByRole("button", { name: /^Discard/ }));
}

describe("CardTable FDA Information Request (#921)", () => {
  it("opens on the deadline and the FDA's questions", () => {
    render(<CardTable scenario={IR} />);
    expect(screen.getByTestId("boss-intro-terms").textContent).toBe(
      "Quota 10000 · 10 CPU · due in 48 hours"
    );
    const questions = screen.getByTestId("boss-intro-questions");
    expect(questions.querySelectorAll("li")).toHaveLength(2);
    expect(questions.textContent).toContain(
      "Serious adverse events by preferred term and arm"
    );
  });

  it("puts the clock in the Blind panel in place of the round counter", () => {
    render(<CardTable scenario={IR} />);
    takeSeat();
    expect(hours()).toBe("48h");
    expect(clock().textContent).toContain("of 48 hours left");
    expect(clock().textContent).toContain(
      "Hand 12h · Discard 4h · Inspect 2h · Trace 1h"
    );
    expect(clock().dataset.urgent).toBeUndefined();
    expect(screen.queryByTestId("round-score")).toBeNull();
    const questions = within(clock()).getAllByTestId("fda-question");
    expect(questions.map((q) => q.textContent)).toEqual([
      "Serious adverse events by preferred term and armTable 14.3.3 · 3000 · Open",
      "Time to an adverse event leading to discontinuation, by arm (Kaplan-Meier)Figure 14.3.1 · 7000 · Open",
    ]);
  });

  it("shows each move's hours beside its CPU", () => {
    render(<CardTable scenario={IR} />);
    takeSeat();
    expect(
      screen.getByRole("button", { name: /Play Hand/ }).textContent
    ).toContain("Play Hand · 2 CPU · 12h");
    expect(
      screen.getByRole("button", { name: /^Discard/ }).textContent
    ).toContain("Discard · 1 CPU · 4h");
    expect(
      screen.getByRole("button", { name: /^Inspect/ }).textContent
    ).toContain("1 CPU · 2h");
  });

  it("ticks the clock down only when a move is made", () => {
    render(<CardTable scenario={IR} />);
    takeSeat();
    discardOne();
    expect(hours()).toBe("44h");
    expect(announce.mock.calls.at(-1)?.[0]).toBe(
      "Discarded 1 card. 44 hours left."
    );
  });

  it("marks the clock urgent, then slams a Clinical Hold letter when it runs out", async () => {
    render(<CardTable scenario={ROOMY} />);
    takeSeat();
    for (let i = 0; i < 9; i++) discardOne();
    expect(hours()).toBe("12h");
    expect(clock().dataset.urgent).toBe("true");
    expect(clock().textContent).toContain("Due soon");
    discardOne();
    await waitFor(() =>
      expect(screen.getByTestId("clinical-hold")).not.toBeNull()
    );
    const letter = screen.getByTestId("clinical-hold");
    expect(
      within(letter).getByRole("heading", { name: "Clinical Hold" })
    ).not.toBeNull();
    expect(letter.textContent).toContain("2 of 2 questions remain open");
    expect(letter.textContent).toContain("Figure 14.3.1");
    expect(
      within(screen.getByTestId("blind-result")).getByText(
        "Clinical Hold · run over"
      )
    ).not.toBeNull();
  });
});

describe("the post-marketing Clinical Hold letter (#2331)", () => {
  it("names the post-marketing request and leaves Phase III out", async () => {
    const pm = PASS_STUDY.bossPool![0];
    render(
      <CardTable
        scenario={{ ...pm, table: { ...pm.table, startingCpu: 40 } }}
      />
    );
    takeSeat();
    for (let i = 0; i < 10; i++) discardOne();
    const letter = await screen.findByTestId("clinical-hold");
    expect(letter.textContent).toContain(
      "Your response to the Post-Marketing Requirement Information Request was not received within 48 hours."
    );
    expect(letter.textContent).not.toMatch(/Phase III|End-of-Phase-2/);
  });

  it("keeps the campaign letter's End-of-Phase-2 wording", async () => {
    render(<CardTable scenario={ROOMY} />);
    takeSeat();
    for (let i = 0; i < 10; i++) discardOne();
    const letter = await screen.findByTestId("clinical-hold");
    expect(letter.textContent).toContain(
      "Your response to the End-of-Phase-2 Information Request was not received within 48 hours."
    );
    expect(letter.textContent).toContain(
      "The program may not proceed to Phase III."
    );
  });
});
