// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  ACT_I,
  ACT_I_CRISES,
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  FIREWALL_CELL,
  SPONSOR_SAFETY_SCENARIO,
  type Act,
  type CrisisCard,
  type Scenario,
} from "@/lib/trial-and-error";
import { SMALL_BLIND_WITH_KM } from "./utils/trial-and-error-km";
import { BLINDED, DMC_SCENARIO } from "./utils/trial-and-error-dmc";

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

const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const cards = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("[data-card-id]"));
const lastAnnouncement = () => announce.mock.calls.at(-1)?.[0];
const drawer = () => screen.queryByTestId("inspect-drawer");
const gridCell = (row: number, col: number) =>
  within(drawer()!)
    .getAllByRole("row")
    [row + 1].querySelectorAll<HTMLElement>('[role="gridcell"]')[col];

/**
 * Act I with a one-point Small Blind and a one-card crisis deck, so the Big
 * Blind opens on `crisis` whatever the seed.
 */
const crisisAct = (crisis: CrisisCard): Act => ({
  ...ACT_I,
  blinds: [
    {
      ...DEMOGRAPHICS_SCENARIO,
      blind: { ...DEMOGRAPHICS_SCENARIO.blind, quota: 1 },
    },
    SPONSOR_SAFETY_SCENARIO,
  ],
  crisisDeck: [crisis],
});

/** Clears the one-point Small Blind and deals the Big Blind. */
function reachBigBlind() {
  fireEvent.click(card("C-T14.1.1-C"));
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  fireEvent.click(screen.getByRole("button", { name: "Next Blind" }));
  expect(screen.getByTestId("blind-name").textContent).toBe(
    "Big Blind: Sponsor Safety Review"
  );
}

async function openInspect(id: string) {
  act(() => card(id).focus());
  fireEvent.keyDown(card(id), { key: "i" });
  await waitFor(() => expect(drawer()).not.toBeNull());
}

describe("CardTable", () => {
  it("deals a hand of 8 with one roving tab stop and an empty relic rack", () => {
    render(<CardTable />);
    expect(cards()).toHaveLength(8);
    expect(cards().filter((c) => c.tabIndex === 0)).toEqual([card(DRAFT_A)]);
    expect(screen.getByTestId("round-target").textContent).toBe("450");
    expect(screen.getByTestId("cpu-counter").textContent).toBe("10/10");
    expect(screen.getByTestId("hands-affordable").textContent).toBe("5");
    const rack = screen.getByTestId("relic-rack");
    expect(rack.tabIndex).toBe(0);
    expect(within(rack).getAllByText("Empty")).toHaveLength(5);
    expect(card(DRAFT_A).getAttribute("aria-label")).toContain("unverified");
  });

  it("moves with arrows and Home/End, and selects with Space", () => {
    render(<CardTable />);
    card(DRAFT_A).focus();
    fireEvent.keyDown(card(DRAFT_A), { key: "ArrowRight" });
    expect(document.activeElement).toBe(card(DM_LISTING));
    fireEvent.keyDown(card(DM_LISTING), { key: "End" });
    expect(document.activeElement).toBe(cards()[7]);
    fireEvent.keyDown(cards()[7], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cards()[7]);
    fireEvent.keyDown(cards()[7], { key: "Home" });
    fireEvent.keyDown(card(DRAFT_A), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(card(DRAFT_A));

    fireEvent.keyDown(card(DRAFT_A), { key: " " });
    fireEvent.click(card(DM_LISTING));
    expect(card(DRAFT_A).getAttribute("aria-pressed")).toBe("true");
    expect(card(DM_LISTING).getAttribute("aria-pressed")).toBe("true");
    const preview = screen.getByTestId("hand-preview");
    expect(preview.textContent).toContain("TLF Pair");
    expect(preview.textContent).toContain("[92] × [3] = 276");
    expect(screen.getByTestId("unverified-flag")).toBeTruthy();
    expect(lastAnnouncement()).toBe(
      "Selected Listing 16.2.4 Demographic Data by Subject. 2 selected: TLF Pair."
    );
  });

  it("plays with Enter, revealing the hidden fatal defect, and keeps focus in the hand", () => {
    render(<CardTable />);
    fireEvent.keyDown(card(DRAFT_A), { key: " " });
    fireEvent.keyDown(card(DRAFT_A), { key: "ArrowRight" });
    fireEvent.keyDown(card(DM_LISTING), { key: " " });
    fireEvent.keyDown(card(DM_LISTING), { key: "Enter" });
    expect(screen.getByTestId("cpu-counter").textContent).toBe("8/10");
    expect(screen.getByTestId("last-hand").textContent).toContain(
      "TLF Pair · 80 Chips × 0 Mult = 0 (zero-score rule)"
    );
    expect(lastAnnouncement()).toContain("Zero-score rule triggered.");
    expect(cards()).toHaveLength(8);
    expect(cards()).toContain(document.activeElement);
  });

  it("discards with D and ignores keys from a nested element or with modifiers", () => {
    render(<CardTable />);
    fireEvent.keyDown(card(DRAFT_A), { key: " " });
    fireEvent.keyDown(card(DRAFT_A), { key: "d", ctrlKey: true });
    expect(screen.getByTestId("cpu-counter").textContent).toBe("10/10");
    const child = document.createElement("span");
    card(DRAFT_A).appendChild(child);
    fireEvent.keyDown(child, { key: "d" });
    expect(screen.getByTestId("cpu-counter").textContent).toBe("10/10");
    fireEvent.keyDown(card(DRAFT_A), { key: "d" });
    expect(screen.getByTestId("cpu-counter").textContent).toBe("9/10");
    expect(lastAnnouncement()).toBe("Discarded 1 card.");
  });

  it("announces refusals, such as inspecting a card with no reviewable cells", () => {
    render(<CardTable />);
    card("C-T14.1.2").focus();
    fireEvent.keyDown(card("C-T14.1.2"), { key: "i" });
    expect(drawer()).toBeNull();
    expect(lastAnnouncement()).toBe(
      "Table 14.1.2 Subject Disposition has no reviewable cells in this slice."
    );
    fireEvent.keyDown(card("C-T14.1.2"), { key: "Enter" });
    expect(lastAnnouncement()).toBe("Select at least one card to play.");
  });

  it("marks a Table and its supporting Listing as a pair on both faces", () => {
    render(<CardTable />);
    expect(within(card(DRAFT_A)).getByTestId("pair-link")).toBeTruthy();
    expect(within(card(DM_LISTING)).getByTestId("pair-link")).toBeTruthy();
    expect(card(DRAFT_A).getAttribute("aria-label")).toContain(
      "TLF Pair with Listing 16.2.4"
    );
  });

  it("traces a flagged cell to its Listing with T and cycles the matched rows", async () => {
    render(<CardTable />);
    fireEvent.click(card(DRAFT_A));
    await openInspect(DRAFT_A);
    fireEvent.click(gridCell(2, 2));
    expect(screen.queryByTestId("trace-listing")).toBeNull();

    fireEvent.keyDown(gridCell(2, 2), { key: "t" });
    const listing = screen.getByTestId("trace-listing");
    expect(listing.textContent).toContain("Listing 16.2.4");
    expect(gridCell(2, 2).hasAttribute("data-traced")).toBe(true);
    expect(lastAnnouncement()).toMatch(/^Traced Female, n \(%\), Total/);
    const first = screen.getByTestId("trace-current").textContent;
    const readout = screen.getByTestId("trace-readout").textContent;
    expect(readout).toMatch(/row 1 of \d+/);

    fireEvent.keyDown(gridCell(2, 2), { key: "t" });
    expect(screen.getByTestId("trace-current").textContent).not.toBe(first);
    expect(screen.getByTestId("trace-readout").textContent).toMatch(/row 2 of/);
    fireEvent.keyDown(gridCell(2, 2), { key: "T", shiftKey: true });
    expect(screen.getByTestId("trace-current").textContent).toBe(first);
    expect(screen.getByTestId("trace-audit").textContent).toContain("open");

    // Correcting the traced cell resolves the trace and readies the Pair.
    for (
      let i = 0;
      i < 3 && gridCell(2, 2).dataset.status !== "CORRECTED";
      i++
    ) {
      fireEvent.keyDown(gridCell(2, 2), { key: "c" });
    }
    expect(screen.getByTestId("trace-audit").textContent).toContain("resolved");
    expect(screen.getByTestId("pair-synergy").textContent).toContain("×2");
    // The staged selection survives the drill-down.
    fireEvent.keyDown(gridCell(2, 2), { key: "Escape" });
    await waitFor(() => expect(drawer()).toBeNull());
    expect(card(DRAFT_A).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens a focus-trapped Inspect drawer that reviews cells and closes with Escape", async () => {
    render(<CardTable />);
    await openInspect(DRAFT_A);
    expect(screen.getByTestId("cpu-counter").textContent).toBe("9/10");
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(gridCell(0, 0)));

    const target = gridCell(2, 2);
    fireEvent.click(target);
    expect(target.getAttribute("data-status")).toBe("REDLINE");
    expect(within(dialog).getByTestId("slashed-mult").textContent).toBe("2");
    fireEvent.keyDown(target, { key: "c" });
    expect(gridCell(2, 2).getAttribute("data-status")).toBe("CORRECTED");
    expect(lastAnnouncement()).toBe(
      "Corrected 7 (63.6) to 7 (58.3) under SAP-DM-01."
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await waitFor(() => expect(drawer()).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(card(DRAFT_A)));
    expect(card(DRAFT_A).getAttribute("aria-label")).not.toContain(
      "unverified"
    );
  });

  it("persists corrections between openings and reopens without charging CPU", async () => {
    render(<CardTable />);
    await openInspect(DRAFT_A);
    fireEvent.click(gridCell(1, 2));
    fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
    await waitFor(() => expect(drawer()).toBeNull());
    await openInspect(DRAFT_A);
    expect(screen.getByTestId("cpu-counter").textContent).toBe("9/10");
    expect(gridCell(1, 2).getAttribute("data-status")).toBe("REDLINE");
    expect(within(drawer()!).getByTestId("reviewed-count").textContent).toBe(
      "1/15"
    );
  });

  it("focuses a clicked cell without scrolling, so narrow-width taps land (#956)", async () => {
    render(<CardTable />);
    await openInspect(DRAFT_A);
    const target = gridCell(1, 2);
    const focusSpy = vi.spyOn(target, "focus");

    // A pointer press is swallowed so focus can't scroll the grid before pointerup.
    expect(fireEvent.mouseDown(target)).toBe(false);
    fireEvent.click(target);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(target.getAttribute("data-status")).not.toBe("UNREVIEWED");

    // Keyboard moves still scroll the newly focused cell into view.
    const left = gridCell(1, 1);
    const leftSpy = vi.spyOn(left, "focus");
    fireEvent.keyDown(target, { key: "ArrowLeft" });
    expect(leftSpy).toHaveBeenCalledWith(undefined);
  });

  it("clears the Blind by inspecting, correcting and playing, then moves to the next Blind", async () => {
    // Seed "early" draws the Site Audit for the Big Blind.
    render(<CardTable seed="early" />);
    expect(screen.getByTestId("blind-intro").textContent).toContain(
      "Phase I, first data review."
    );
    await openInspect(DRAFT_A);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = gridCell(row, col);
        act(() => cell.focus());
        fireEvent.keyDown(cell, { key: "Enter" });
        fireEvent.keyDown(cell, { key: "c" });
      }
    }
    fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
    await waitFor(() => expect(drawer()).toBeNull());
    fireEvent.keyDown(card(DRAFT_A), { key: " " });
    fireEvent.click(card(DM_LISTING));
    // Draft A is inspected and corrected, so the preview is fully verified.
    expect(screen.queryByTestId("unverified-flag")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    expect(screen.queryByTestId("blind-intro")).toBeNull();

    const result = screen.getByTestId("blind-result");
    expect(result.textContent).toContain("Blind cleared");
    expect(result.textContent).toContain("828 of 450");
    expect(result.textContent).toContain(
      "Next: Big Blind: Sponsor Safety Review · target 7500"
    );
    // Cash-out is the primary next step; Next Blind skips the shop.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Cash out \$\d+k$/ })
    );
    expect(screen.getByTestId("cash-out").textContent).toContain(
      "Sponsor owes"
    );
    const next = screen.getByRole("button", { name: "Next Blind" });
    fireEvent.click(next);
    expect(screen.getByTestId("blind-name").textContent).toBe(
      "Big Blind: Sponsor Safety Review"
    );
    expect(screen.getByTestId("round-target").textContent).toBe("7500");
    expect(screen.getByTestId("round-score").textContent?.trim()).toBe("0");
    expect(screen.getByTestId("cpu-counter").textContent).toBe("10/10");
    expect(screen.getByTestId("blind-intro").textContent).toContain(
      "safety physician"
    );
    expect(lastAnnouncement()).toContain(
      "Big Blind: Sponsor Safety Review. Target 7500. Crisis: Site Audit."
    );
    // The crisis must be answered first, so focus goes to its first choice.
    const crisis = screen.getByTestId("crisis");
    expect(within(crisis).getByRole("heading").textContent).toBe(
      "Crisis: Site Audit"
    );
    const host = within(crisis).getByRole("button", {
      name: /Host the auditors/,
    });
    await waitFor(() => expect(document.activeElement).toBe(host));
    expect(screen.getByRole("button", { name: /Play Hand/ })).toHaveProperty(
      "disabled",
      true
    );
    // The Small Blind's payout, collected on the way past the shop, covers
    // a remote audit.
    const remote = within(crisis).getByRole("button", {
      name: /Pay for a remote audit/,
    });
    expect(remote).toHaveProperty("disabled", false);
    expect(remote.textContent).not.toContain("Needs");

    fireEvent.click(host);
    expect(screen.queryByTestId("crisis")).toBeNull();
    expect(screen.getByTestId("blind-modifier").textContent).toContain(
      "Crisis: Site Audit"
    );
    expect(
      screen.getByRole("button", { name: /Discard · 2 CPU/ })
    ).toBeTruthy();
    expect(lastAnnouncement()).toContain("Site Audit: Host the auditors.");
    await waitFor(() =>
      expect(document.activeElement).toBe(card("C-T14.3.1-A"))
    );
  });

  it("shows the boss debuff on disabled cards and ends the run on a loss", () => {
    render(<CardTable scenario={DOSE_ESCALATION_SCENARIO} />);
    expect(screen.getByTestId("boss-modifier").textContent).toContain(
      "Boss: Safety Set Only"
    );
    const disabled = card("C-T14.1.2");
    expect(disabled.getAttribute("aria-label")).toContain(
      "disabled by the boss, scores 0 Chips"
    );
    expect(within(disabled).getByTestId("debuff-badge").textContent).toBe(
      "25 → 0 Chips"
    );
    expect(
      within(card("C-T14.3.2.1-B")).queryByTestId("debuff-badge")
    ).toBeNull();

    // Discard one card at a time until no hand can be played.
    for (let i = 0; i < 9; i++) {
      const first = cards()[0];
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    }
    const result = screen.getByTestId("blind-result");
    expect(result.textContent).toContain("Blind failed · run over");
    const restart = screen.getByRole("button", { name: "Restart run" });
    expect(document.activeElement).toBe(restart);
    fireEvent.click(restart);
    expect(screen.getByTestId("round-score").textContent?.trim()).toBe("0");
    expect(screen.getByTestId("blind-intro")).toBeTruthy();
  });

  it("enforces a crisis hand limit on the Blind panel and ends the Blind when it runs out", () => {
    const emergency = ACT_I_CRISES.find((c) => c.id === "CR-EMERGENCY-REVIEW")!;
    render(<CardTable act={crisisAct(emergency)} seed="ui-limit" />);
    reachBigBlind();
    expect(screen.queryByTestId("hand-limit")).toBeNull();
    fireEvent.click(
      within(screen.getByTestId("crisis")).getByRole("button", {
        name: /Accept the early deadline/,
      })
    );
    expect(screen.getByTestId("blind-modifier").textContent).toContain(
      "Crisis: Emergency Review"
    );
    expect(screen.getByTestId("hand-limit").textContent).toBe("2 left");
    expect(screen.getByTestId("hands-affordable").textContent).toBe("2");

    // Two single uninspected cards score far short of 7500. A card the first
    // hand's snapshot change staled, or an empty shell, cannot be played.
    for (const left of ["1 left", "0 left"]) {
      const playable = cards().find(
        (c) => !/stale|empty shell/.test(c.getAttribute("aria-label") ?? "")
      )!;
      fireEvent.click(playable);
      fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
      expect(screen.getByTestId("hand-limit").textContent).toBe(left);
    }
    const result = screen.getByTestId("blind-result");
    expect(result.textContent).toContain("Blind failed");
    expect(lastAnnouncement()).toContain("the 2-hand limit is used up");
  });

  it("turns treatment-arm values face down under a DMC firewall and refuses Inspect", () => {
    const firewall: CrisisCard = {
      id: "CR-UI-FIREWALL",
      name: "Closed Session",
      description: "The DMC meets behind closed doors.",
      choices: [
        {
          id: "wait",
          label: "Wait outside",
          consequence: "Treatment arms are face down this Blind.",
          effect: {
            modifier: {
              id: "CR-UI-FIREWALL-MOD",
              name: "DMC Firewall",
              description: "Arms stay blinded.",
              debuffType: "BLIND_FIREWALL",
            },
          },
        },
        {
          id: "leave",
          label: "Leave",
          consequence: "Nothing changes.",
          effect: {},
        },
      ],
    };
    render(<CardTable act={crisisAct(firewall)} seed="ui-firewall" />);
    reachBigBlind();
    const target = "C-T14.3.1-A";
    expect(card(target).textContent).not.toContain(FIREWALL_CELL);
    fireEvent.click(screen.getByRole("button", { name: /Wait outside/ }));
    expect(screen.getByTestId("blind-modifier").textContent).toContain(
      "Crisis: DMC Firewall"
    );
    expect(card(target).textContent).toContain(FIREWALL_CELL);
    act(() => card(target).focus());
    expect(
      screen.getByRole("button", { name: /^Inspect .*\[I\]$/ })
    ).toHaveProperty("disabled", true);
    fireEvent.keyDown(card(target), { key: "i" });
    expect(drawer()).toBeNull();
  });

  it("offers Play again once the final Blind of the act is cleared", () => {
    const quick = {
      ...DEMOGRAPHICS_SCENARIO,
      blind: { ...DEMOGRAPHICS_SCENARIO.blind, quota: 1 },
    };
    render(<CardTable scenario={quick} />);
    fireEvent.click(card("C-T14.1.1-C"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    expect(screen.getByTestId("blind-result").textContent).toContain(
      "Demographics QC Desk complete"
    );
    expect(screen.queryByRole("button", { name: "Next Blind" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByTestId("round-score").textContent?.trim()).toBe("0");
  });

  it("uses the Inspect button for the focused card and labels it as reopenable", async () => {
    render(<CardTable />);
    const inspectButton = screen.getByRole("button", {
      name: /Inspect Table 14.1.1 · 1 CPU/,
    });
    fireEvent.click(inspectButton);
    await waitFor(() => expect(drawer()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
    await waitFor(() => expect(drawer()).toBeNull());
    expect(
      screen.getByRole("button", { name: /Inspect Table 14.1.1 · open/ })
    ).toBeTruthy();
    act(() => card(DM_LISTING).focus());
    expect(
      (
        screen.getByRole("button", {
          name: /Inspect Listing 16.2.4/,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});

describe("CardTable population snapshots (T&E-03)", () => {
  const NERVOUS_A = "C-T14.3.2.5-A";
  const STALE_SAFETY = [
    "C-T14.3.1-A",
    "C-L16.2.7",
    "C-T14.3.3-A",
    "C-L16.2.8",
    NERVOUS_A,
  ];

  /** The sponsor review after its first hand: S-004 has left the Safety set. */
  function renderAfterDataChange() {
    render(<CardTable scenario={SPONSOR_SAFETY_SCENARIO} />);
    expect(screen.getByTestId("current-snapshot").textContent).toBe(
      "SNAP-P1-v1"
    );
    fireEvent.click(card("C-T14.1.2"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  }

  it("expires the Safety outputs in hand and announces why", () => {
    renderAfterDataChange();
    expect(lastAnnouncement()).toContain(
      "S-004 stays randomized (ITT) but leaves the Safety population. Safety population now SNAP-P1-v2. Stale: Table 14.3.1 (Draft A)"
    );
    expect(screen.getByTestId("current-snapshot").textContent).toBe(
      "SNAP-P1-v2"
    );
    const stale = card(NERVOUS_A);
    expect(stale.getAttribute("aria-label")).toContain(
      "stale, compiled against SNAP-P1-v1, scores 0 Chips until recompiled"
    );
    expect(stale.getAttribute("aria-label")).toContain("stale stamp");
    expect(stale.dataset.stale).toBe("true");
    expect(within(stale).getByTestId("stale-badge").textContent).toBe(
      "25 → 0 Chips"
    );
    expect(stale.querySelector('[data-stamp="STALE"]')).not.toBeNull();
    // ITT outputs are unrelated to the change.
    const itt = card("C-L16.1.1");
    expect(itt.dataset.stale).toBeUndefined();
    expect(within(itt).queryByTestId("stale-badge")).toBeNull();
  });

  it("blocks Play Hand on a stale card and recompiles it with R", () => {
    renderAfterDataChange();
    fireEvent.click(card(NERVOUS_A));
    expect(screen.getByTestId("stale-alert").textContent).toBe(
      "Output compiled against obsolete population snapshot; recompile required (2 CPU). Stale: Table 14.3.2.5 (Draft A)."
    );
    expect(
      (screen.getByRole("button", { name: /Play Hand/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.keyDown(card(NERVOUS_A), { key: "Enter" });
    expect(lastAnnouncement()).toContain(
      "Output compiled against obsolete population snapshot"
    );

    act(() => card(NERVOUS_A).focus());
    expect(
      screen.getByRole("button", {
        name: "Recompile Table 14.3.2.5 · 2 CPU [R]",
      })
    ).toBeTruthy();
    fireEvent.keyDown(card(NERVOUS_A), { key: "r" });
    expect(screen.getByTestId("cpu-counter").textContent).toBe("6/10");
    expect(lastAnnouncement()).toContain("against SNAP-P1-v2 for 2 CPU");
    expect(within(card(NERVOUS_A)).queryByTestId("stale-badge")).toBeNull();
    expect(screen.queryByTestId("stale-alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /Recompile/ })).toBeNull();
    expect(document.activeElement).toBe(card(NERVOUS_A));
  });

  it("recompiles from the button, and names the stale cards that break a flush", () => {
    renderAfterDataChange();
    for (const id of STALE_SAFETY) fireEvent.click(card(id));
    expect(screen.getByTestId("hand-preview").textContent).toContain(
      "TLF Two Pair"
    );
    expect(screen.getByTestId("flush-broken").textContent).toBe(
      "Population Flush broken: Table 14.3.1 (Draft A), Listing 16.2.7, Table 14.3.3 (Draft A), Listing 16.2.8, Table 14.3.2.5 (Draft A) are stale."
    );
    expect(screen.getByTestId("stale-alert").textContent).toBe(
      "Output compiled against obsolete population snapshot; recompile required (2 CPU)."
    );
    act(() => card("C-L16.2.7").focus());
    fireEvent.click(
      screen.getByRole("button", { name: /Recompile Listing 16.2.7/ })
    );
    expect(screen.getByTestId("cpu-counter").textContent).toBe("6/10");
    expect(screen.getByTestId("flush-broken").textContent).toContain(
      "Table 14.3.2.5 (Draft A) are stale."
    );
  });

  it("shows each card's snapshot in its detail and its Inspect drawer", async () => {
    renderAfterDataChange();
    act(() => card(NERVOUS_A).focus());
    fireEvent.keyDown(card(NERVOUS_A), { key: "?" });
    const detail = screen.getByTestId("card-detail");
    expect(within(detail).getByTestId("snapshot-chip").textContent).toBe(
      "SNAP-P1-v1 · v1 · stale: recompile required"
    );
    fireEvent.click(within(detail).getByRole("button", { name: /Close/ }));

    await openInspect(NERVOUS_A);
    expect(within(drawer()!).getByTestId("snapshot-chip").textContent).toBe(
      "Compiled against SNAP-P1-v1 · v1 · captured 2026-01-15 · stale: Output compiled against obsolete population snapshot; recompile required (2 CPU)."
    );
    fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
    await waitFor(() => expect(drawer()).toBeNull());

    await openInspect("C-T14.3.2.1-A");
    expect(within(drawer()!).getByTestId("snapshot-chip").textContent).toBe(
      "Compiled against SNAP-P1-v2 · v2 · captured 2026-02-02"
    );
  });
});

describe("CardTable shells, seals and CPU (T&E-04)", () => {
  const BLANK = "C-T14.1.3";
  const tray = () => screen.getByTestId("consumable-tray");
  const seal = (name: RegExp) =>
    within(tray()).getByRole("button", { name }) as HTMLButtonElement;

  /** Sends A, B and the DM listing back, which deals the blank shell. */
  function renderWithBlank() {
    render(<CardTable />);
    for (const id of [DRAFT_A, "C-T14.1.1-B", DM_LISTING]) {
      fireEvent.click(card(id));
    }
    fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    expect(card(BLANK)).toBeTruthy();
  }

  it("draws the blank shell as an empty skeleton and blocks it from play", () => {
    renderWithBlank();
    const blank = card(BLANK);
    expect(blank.dataset.blank).toBe("true");
    expect(within(blank).getByTestId("shell-badge").textContent).toBe("Shell");
    expect(blank.getAttribute("aria-label")).toContain(
      "empty shell, accepts ITT or Safety data, press A to allocate"
    );
    fireEvent.click(blank);
    expect(screen.getByTestId("empty-alert").textContent).toBe(
      "Empty shell: Table 14.1.3. Allocate an analysis set to compile it first."
    );
    expect(
      (screen.getByRole("button", { name: /Play Hand/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.queryByTestId("stale-alert")).toBeNull();
  });

  it("previews each analysis set and allocates one with A, for free", () => {
    renderWithBlank();
    for (const id of [
      "C-T14.3.1",
      "C-L16.2.7",
      "C-T14.3.2",
      "C-L16.2.8",
      BLANK,
    ]) {
      fireEvent.click(card(id));
    }
    const panel = screen.getByTestId("allocate-panel");
    const [itt, safety] = within(panel).getAllByTestId("allocate-option");
    expect(itt.textContent).toContain("Compile on ITT · N=12");
    expect(itt.textContent).toContain("TLF Pair");
    expect(safety.textContent).toContain("SNAP-P1-v1 · v1");
    expect(safety.textContent).toContain("Population Flush");
    expect(safety.textContent).toContain("? unverified");

    act(() => card(BLANK).focus());
    fireEvent.keyDown(card(BLANK), { key: "a" });
    expect(document.activeElement).toBe(itt);
    fireEvent.click(safety);
    expect(lastAnnouncement()).toBe(
      "Allocated Safety data (N=12, SNAP-P1-v1) to Table 14.1.3. It compiled as a Safety output."
    );
    expect(screen.getByTestId("cpu-counter").textContent).toBe("9/10");
    expect(screen.queryByTestId("allocate-panel")).toBeNull();
    expect(card(BLANK).getAttribute("aria-label")).toContain(
      "Safety population"
    );
    expect(document.activeElement).toBe(card(BLANK));
    expect(screen.getByTestId("hand-preview").textContent).toContain(
      "Population Flush"
    );
  });

  it("arms a seal from the tray and affixes it with Enter", () => {
    renderWithBlank();
    act(() => card(BLANK).focus());
    fireEvent.keyDown(card(BLANK), { key: "a" });
    fireEvent.click(
      within(screen.getByTestId("allocate-panel")).getAllByTestId(
        "allocate-option"
      )[1]
    );
    expect(within(tray()).getAllByTestId("consumable")).toHaveLength(2);
    const adjudicated = seal(/Adjudicated Endpoint/);
    fireEvent.click(adjudicated);
    expect(adjudicated.getAttribute("aria-pressed")).toBe("true");
    expect(lastAnnouncement()).toContain("Adjudicated Endpoint picked up");
    fireEvent.keyDown(card(BLANK), { key: "Escape" });
    expect(lastAnnouncement()).toBe("Adjudicated Endpoint put back.");
    expect(seal(/Adjudicated Endpoint/).getAttribute("aria-pressed")).toBe(
      "false"
    );

    fireEvent.click(seal(/Adjudicated Endpoint/));
    fireEvent.keyDown(card(BLANK), { key: "Enter" });
    expect(lastAnnouncement()).toContain(
      "Sealed Table 14.1.3 with Adjudicated Endpoint: +3 Mult."
    );
    expect(within(card(BLANK)).getAllByTestId("seal-badge")).toHaveLength(1);
    expect(card(BLANK).getAttribute("aria-label")).toContain(
      "footnote seal: Adjudicated Endpoint"
    );
    expect(within(tray()).getAllByTestId("consumable")).toHaveLength(1);
    // Enter played nothing: the seal took it.
    expect(screen.getByTestId("round-score").textContent?.trim()).toBe("0");

    fireEvent.keyDown(card(BLANK), { key: "?" });
    const footnotes = within(screen.getByTestId("card-detail")).getByTestId(
      "card-footnotes"
    );
    expect(footnotes.textContent).toContain(
      "Serious events were adjudicated by an independent committee blinded to treatment."
    );
  });

  it("affixes a seal dropped on a card, or clicked onto one", () => {
    render(<CardTable />);
    const data = new Map<string, string>();
    const dataTransfer = {
      types: [] as string[],
      setData: (type: string, value: string) => {
        data.set(type, value);
        dataTransfer.types.push(type);
      },
      getData: (type: string) => data.get(type) ?? "",
      dropEffect: "none",
      effectAllowed: "all",
    };
    fireEvent.dragStart(seal(/Sponsor rounding standard/), { dataTransfer });
    fireEvent.dragOver(card(DRAFT_A), { dataTransfer });
    fireEvent.drop(card(DRAFT_A), { dataTransfer });
    expect(lastAnnouncement()).toContain(
      "Sealed Table 14.1.1 (Draft A) with Sponsor rounding standard: waives SAP-DM-03 redlines."
    );
    // A click with a seal armed affixes it instead of selecting the card.
    fireEvent.click(seal(/Adjudicated Endpoint/));
    fireEvent.click(card("C-T14.1.1-B"));
    expect(lastAnnouncement()).toBe(
      "Adjudicated Endpoint applies to Safety outputs only; Table 14.1.1 (Draft B) is built on ITT."
    );
    expect(card("C-T14.1.1-B").getAttribute("aria-pressed")).toBe("false");
  });

  it("sells a seal into the study budget", () => {
    render(<CardTable />);
    expect(screen.getByTestId("study-budget").textContent).toBe("Budget $0k");
    fireEvent.click(within(tray()).getByRole("button", { name: "Sell · $2k" }));
    expect(lastAnnouncement()).toBe(
      "Sold Adjudicated Endpoint for $2k. Study budget $2k."
    );
    expect(screen.getByTestId("study-budget").textContent).toBe("Budget $2k");
    expect(within(tray()).getByText("Empty slot")).toBeTruthy();
  });

  it("draws CPU as pips that empty as they are spent, and says why a move is unaffordable", async () => {
    const poor = {
      ...DEMOGRAPHICS_SCENARIO,
      table: { ...DEMOGRAPHICS_SCENARIO.table, startingCpu: 2 },
    };
    render(<CardTable scenario={poor} />);
    const pips = () =>
      Array.from(
        screen
          .getByTestId("cpu-pips")
          .querySelectorAll<HTMLElement>("[data-pip]")
      ).map((p) => p.dataset.pip);
    expect(pips()).toEqual(["on", "on"]);
    expect(screen.queryByTestId("cpu-note")).toBeNull();
    await openInspect(DRAFT_A);
    fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
    await waitFor(() => expect(drawer()).toBeNull());
    expect(pips()).toEqual(["on", "spent"]);
    expect(
      screen.getByTestId("cpu-pips").querySelectorAll(".te-pip-burst")
    ).toHaveLength(1);
    fireEvent.click(card(DRAFT_A));
    // Play Hand's shortfall is said once, by the play blocker line.
    expect(screen.getByTestId("play-blocker").textContent).toBe(
      "Play Hand needs 2 CPU; 1 left."
    );
    expect(screen.queryByTestId("cpu-note")?.textContent ?? "").not.toContain(
      "Play Hand"
    );
    expect(
      screen
        .getByRole("button", { name: /Play Hand/ })
        .getAttribute("aria-describedby")
        ?.split(" ")[0]
    ).toBe("play-blocker");
  });
});

describe("CardTable play blocker line (#1078)", () => {
  it("says why Play Hand is disabled, describes the button, and clears when playable", () => {
    render(<CardTable scenario={DEMOGRAPHICS_SCENARIO} />);
    const playButton = () => screen.getByRole("button", { name: /Play Hand/ });
    const line = () => screen.queryByTestId("play-blocker");
    expect(line()?.textContent).toBe(
      "Select at least one card to play. Select a card [Space]."
    );
    expect(playButton().getAttribute("aria-describedby")).toBe("play-blocker");
    expect((playButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(card(DM_LISTING));
    expect(line()).toBeNull();
    expect(playButton().getAttribute("aria-describedby")).toBeNull();
    expect((playButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(card(DM_LISTING));
    expect(line()).not.toBeNull();
  });

  it("sits below the controls, outside the hand", () => {
    render(<CardTable scenario={DEMOGRAPHICS_SCENARIO} />);
    expect(
      screen.getByTestId("hand").contains(screen.getByTestId("play-blocker"))
    ).toBe(false);
  });
});

describe("CardTable Kaplan–Meier figures (T&E-07)", () => {
  const FIG = "C-F14.1.2";

  it("shows the dependency, then reconciles every KM finding to turn ×2 on", async () => {
    render(<CardTable scenario={SMALL_BLIND_WITH_KM} />);
    const badge = within(card(FIG)).getByTestId("figure-xmult");
    expect(badge.hasAttribute("data-active")).toBe(false);
    expect(badge.getAttribute("title")).toBe(
      "Inspect the figure to reconcile its Number-at-Risk."
    );

    await openInspect(FIG);
    const desk = screen.getByTestId("figure-desk");
    expect(drawer()!.getAttribute("aria-labelledby")).toBe(
      "figure-desk-heading"
    );
    expect(within(desk).getByTestId("figure-status").textContent).toBe(
      "×2 off: 2 Kaplan–Meier discrepancies unresolved."
    );
    expect(
      within(desk)
        .getByTestId("figure-parent")
        .querySelectorAll("[data-reconciles]")
    ).toHaveLength(2);
    const strip = within(desk).getByTestId("at-risk-strip");
    expect(strip.querySelectorAll('[data-mark="open"]')).toHaveLength(1);

    const findings = () => within(desk).getAllByTestId("km-finding");
    expect(findings()).toHaveLength(2);
    const first = within(findings()[0]).getByRole("button");
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "c" });
    expect(findings()[0].hasAttribute("data-resolved")).toBe(true);
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const second = within(findings()[1]).getByRole("button");
    expect(document.activeElement).toBe(second);
    fireEvent.click(second);

    expect(within(desk).getByTestId("figure-status").textContent).toBe(
      "×2 live"
    );
    expect(strip.querySelectorAll('[data-mark="reconciled"]')).toHaveLength(1);
    expect(lastAnnouncement()).toContain("×2 Mult is live.");
    expect(
      within(card(FIG)).getByTestId("figure-xmult").hasAttribute("data-active")
    ).toBe(true);
  });
});

describe("CardTable DMC blinding firewall (T&E-08)", () => {
  const [A, B, C] = BLINDED;
  const firewall = () => screen.queryByTestId("firewall-dialog");
  const press = (id: string, key: string) => {
    act(() => card(id).focus());
    fireEvent.keyDown(card(id), { key });
  };

  it("deals blinded outputs face down and asks before unblinding one", async () => {
    render(<CardTable scenario={DMC_SCENARIO} />);
    expect(screen.getByTestId("session-badge").textContent).toBe("OPEN");
    for (const id of BLINDED) {
      expect(card(id).hasAttribute("data-face-down")).toBe(true);
      expect(card(id).getAttribute("aria-label")).toContain(
        "face down, blinded in the DMC open session"
      );
    }
    expect(document.body.textContent).not.toContain("49.8");

    press(A, "i");
    await waitFor(() => expect(firewall()).not.toBeNull());
    expect(firewall()!.getAttribute("role")).toBe("alertdialog");
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Keep blinded [Esc]")
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(firewall()).toBeNull());
    expect(card(A).hasAttribute("data-face-down")).toBe(true);
    expect(screen.queryByTestId("violation-note")).toBeNull();

    press(A, "i");
    await waitFor(() => expect(firewall()).not.toBeNull());
    fireEvent.click(screen.getByTestId("firewall-confirm"));
    await waitFor(() => expect(firewall()).toBeNull());
    expect(card(A).hasAttribute("data-face-down")).toBe(false);
    expect(screen.getByTestId("violation-note").textContent).toBe(
      "Unblinding logged: the next hand scores ×0 Mult."
    );
    expect(lastAnnouncement()).toContain("Unauthorized unblinding");
  });

  it("convenes the closed session after structural QC, and logs every access", async () => {
    render(<CardTable scenario={DMC_SCENARIO} />);
    const toggle = () =>
      screen.getByTestId("session-toggle") as HTMLButtonElement;
    expect(toggle().disabled).toBe(true);
    expect(screen.getByTestId("session-note").textContent).toContain(
      "Run structural QC on every blinded output"
    );

    for (const id of [A, B, C]) press(id, "s");
    expect(within(card(B)).getByTestId("blinded-marker").textContent).toMatch(
      /^BLINDED · STRUCT \d\/3$/
    );
    expect(toggle().disabled).toBe(false);

    fireEvent.click(toggle());
    expect(screen.getByTestId("session-badge").textContent).toBe("CLOSED");
    for (const id of BLINDED) {
      expect(card(id).hasAttribute("data-face-down")).toBe(false);
    }
    expect(lastAnnouncement()).toContain("Closed DMC session convened");
    expect(toggle().textContent).toBe("Return to open session");

    fireEvent.click(screen.getByTestId("run-info-button"));
    const entries = await screen.findAllByTestId("access-entry");
    expect(entries).toHaveLength(4);
    expect(entries.every((e) => e.hasAttribute("data-authorized"))).toBe(true);
  });
});

describe("CardTable DMC milestone Boss", () => {
  const press = (id: string, key: string) => {
    act(() => card(id).focus());
    fireEvent.keyDown(card(id), { key });
  };
  const playCards = (...ids: string[]) => {
    for (const id of ids) fireEvent.click(card(id));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  };
  const stages = () => screen.getAllByTestId("encounter-stage");
  // A lower Stage 2 quota, so an unreconciled closed report clears it here.
  const encounter = DMC_MILESTONE_SCENARIO.encounter!;
  const boss: Scenario = {
    ...DMC_MILESTONE_SCENARIO,
    blind: { ...DMC_MILESTONE_SCENARIO.blind, quota: 1400 },
    encounter: {
      ...encounter,
      stages: [encounter.stages[0], { ...encounter.stages[1], quota: 1000 }],
    },
  };

  it("opens on the boss intro card, dismissed with Escape", async () => {
    render(<CardTable scenario={boss} />);
    const intro = screen.getByTestId("boss-intro");
    expect(intro.getAttribute("role")).toBe("dialog");
    expect(intro.textContent).toContain("Boss: Blinding Firewall");
    expect(intro.textContent).toContain("Quota 1400");
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Take the seat [Enter]")
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("boss-intro")).toBeNull());
  });

  it("says what the active stage accepts under the hand preview", () => {
    render(<CardTable scenario={boss} />);
    fireEvent.click(screen.getByTestId("boss-intro-start"));
    const line = () => screen.getByTestId("stage-accepts");
    expect(line().textContent).toBe(
      "Stage 1 accepts: High Table, TLF Pair, Population Flush."
    );
    fireEvent.click(card("C-T14.1.1"));
    fireEvent.click(card("C-L16.2.4"));
    expect(line().className).not.toContain("text-rose-300");
    fireEvent.click(card("C-T14.1.1"));
    fireEvent.click(card("C-L16.2.4"));
    playCards("C-T14.1.1", "C-L16.2.4");
    playCards("C-T14.1.2", "C-L16.1.1");
    for (const id of ["C-T14.3.1-D", "C-T14.3.3-D", "C-T14.3.2.5-D"]) {
      press(id, "s");
    }
    fireEvent.click(screen.getByTestId("session-toggle"));
    fireEvent.click(card("C-T14.3.3-D"));
    fireEvent.click(card("C-L16.2.8"));
    expect(line().textContent).toBe(
      "Stage 2 accepts: Efficacy Full House. TLF Pair is not one of them."
    );
    expect(line().className).toContain("text-rose-300");
  });

  it("shows no stage line outside a staged Boss", () => {
    render(<CardTable scenario={DEMOGRAPHICS_SCENARIO} />);
    expect(screen.queryByTestId("stage-accepts")).toBeNull();
  });

  it("tracks both stages, then offers one SOP relic for the rack", async () => {
    render(<CardTable scenario={boss} />);
    fireEvent.click(screen.getByTestId("boss-intro-start"));
    expect(screen.queryByTestId("boss-intro")).toBeNull();
    expect(stages().map((s) => s.getAttribute("data-status"))).toEqual([
      "ACTIVE",
      "PENDING",
    ]);
    expect(stages()[0].getAttribute("aria-current")).toBe("step");
    expect(screen.getByTestId("session-note").textContent).toMatch(
      /^Premature unblinding/
    );

    playCards("C-T14.1.1", "C-L16.2.4");
    playCards("C-T14.1.2", "C-L16.1.1");
    expect(stages()[0].getAttribute("data-status")).toBe("DEFENDED");
    expect(stages()[0].textContent).toContain("450 of 400");
    expect(stages()[1].getAttribute("data-status")).toBe("ACTIVE");

    for (const id of ["C-T14.3.1-D", "C-T14.3.3-D", "C-T14.3.2.5-D"]) {
      press(id, "s");
    }
    fireEvent.click(screen.getByTestId("session-toggle"));
    expect(screen.getByTestId("session-badge").textContent).toBe("CLOSED");
    playCards(
      "C-T14.3.1-D",
      "C-T14.3.3-D",
      "C-T14.3.2.5-D",
      "C-F14.3.3",
      "C-F14.3.1"
    );

    const reward = screen.getByTestId("relic-reward");
    const choices = within(reward).getAllByTestId("relic-choice");
    expect(choices).toHaveLength(3);
    fireEvent.click(choices[1]);
    expect(within(reward).getByText("SOP relic claimed")).toBeTruthy();
    // Claimed: every choice answers with its reason instead of acting.
    expect(
      choices.every((c) => c.getAttribute("aria-disabled") === "true")
    ).toBe(true);
    expect(choices[1].getAttribute("aria-pressed")).toBe("true");
    const rack = screen.getByTestId("relic-rack");
    expect(within(rack).getByTestId("relic").textContent).toBe(
      "SOP-QC-12Hand played"
    );
    expect(within(rack).getByTestId("relic-phase").textContent).toBe(
      "Hand played"
    );
    expect(within(rack).getAllByText("Empty")).toHaveLength(4);

    fireEvent.click(screen.getByTestId("run-info-button"));
    const relics = await screen.findByTestId("run-info-relics");
    expect(relics.textContent).toContain("1 of 5 slots");
    expect(relics.textContent).toContain("SOP-QC-12");
  });
});

describe("CardTable boss intro on every Boss Blind (#1083)", () => {
  const intro = () => screen.queryByTestId("boss-intro");

  it("opens the Act I Boss on its Safety Set Only debuff, quota and CPU", async () => {
    render(<CardTable scenario={DOSE_ESCALATION_SCENARIO} />);
    expect(intro()!.getAttribute("role")).toBe("dialog");
    expect(screen.getByTestId("boss-intro-debuff").textContent).toBe(
      `Boss: Safety Set Only${DOSE_ESCALATION_SCENARIO.boss!.description}`
    );
    expect(screen.getByTestId("boss-intro-terms").textContent).toBe(
      "Quota 8500 · 10 CPU"
    );
    expect(screen.queryByTestId("boss-intro-stages")).toBeNull();
    const start = screen.getByTestId("boss-intro-start");
    await waitFor(() => expect(document.activeElement).toBe(start));
    // Enter on the focused button takes the seat.
    fireEvent.click(start);
    expect(intro()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(cards()[0]));
  });

  it("is dismissed by Escape on the Act I Boss", async () => {
    render(<CardTable scenario={DOSE_ESCALATION_SCENARIO} />);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByTestId("boss-intro-start")
      )
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(intro()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(cards()[0]));
  });

  it("still lists the DMC milestone's two stages", () => {
    render(<CardTable scenario={DMC_MILESTONE_SCENARIO} />);
    const stages = screen.getByTestId("boss-intro-stages");
    expect(stages.querySelectorAll("li")).toHaveLength(2);
    expect(stages.textContent).toContain("open session");
    expect(stages.textContent).toContain("closed session");
  });

  it("never opens on a Small or Big Blind", () => {
    for (const scenario of [DEMOGRAPHICS_SCENARIO, SPONSOR_SAFETY_SCENARIO]) {
      const { unmount } = render(<CardTable scenario={scenario} />);
      expect(intro()).toBeNull();
      unmount();
    }
  });
});
