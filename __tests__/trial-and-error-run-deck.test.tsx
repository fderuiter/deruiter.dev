// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { RunDeck } from "@/components/trial-and-error/RunDeck";
import {
  ACT_I,
  ACT_I_SHOP,
  DEMOGRAPHICS_SCENARIO,
  SPONSOR_SAFETY_SCENARIO,
  type Act,
  type RunDeckView,
  type ShopCatalog,
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

const shell = ACT_I_SHOP.entries.find(
  (e) => e.kind === "SHELL" && e.shell.id === "T-14.3.1-LIB"
)!;

/** A shop whose only single item is a $1k shell, so its one slot always sells it. */
const SHOP: ShopCatalog = {
  entries: [{ ...shell, price: 1 }],
  packs: ACT_I_SHOP.packs.map((p) => ({ ...p, price: 1 })),
  sites: ACT_I_SHOP.sites,
};

/** Act I with a one-point Small Blind, no crises, and the shell shop. */
const DECK_ACT: Act = {
  ...ACT_I,
  blinds: [
    {
      ...DEMOGRAPHICS_SCENARIO,
      blind: { ...DEMOGRAPHICS_SCENARIO.blind, quota: 1 },
    },
    SPONSOR_SAFETY_SCENARIO,
  ],
  crisisDeck: undefined,
  shop: SHOP,
};

/** Clears the one-point Small Blind and cashes out into the shop. */
function cashOut() {
  render(<CardTable act={DECK_ACT} seed="deck-ui" />);
  fireEvent.click(
    document.querySelector<HTMLButtonElement>('[data-card-id="C-T14.1.1-C"]')!
  );
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Cash out \$\d+k$/ }));
}

const deckCards = () =>
  within(screen.getByTestId("run-deck")).getAllByTestId("run-deck-card");

describe("the run deck in the shop (#2082)", () => {
  it("lists the next Blind's deck, and a bought shell joins it", () => {
    cashOut();
    const deck = screen.getByTestId("run-deck");
    expect(within(deck).getByRole("heading").textContent).toBe(
      `Run deck · ${SPONSOR_SAFETY_SCENARIO.blind.name}`
    );
    const size = SPONSOR_SAFETY_SCENARIO.deck.length;
    expect(deckCards()).toHaveLength(size);
    expect(screen.getByTestId("run-deck-size").textContent).toBe(
      `${size} cards. A Blind never deals fewer than ${SPONSOR_SAFETY_SCENARIO.table.handSize}.`
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Buy Table 14.3.1 shell" })
    );
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(
        new RegExp(`joins your deck, ${size + 1} cards next Blind`)
      )
    );
    expect(deckCards()).toHaveLength(size + 1);
    expect(screen.getByTestId("run-deck-size").textContent).toMatch(
      /^\d+ cards · 1 added\./
    );
    expect(deckCards().at(-1)?.textContent).toContain("Bought");
  });

  it("asks for a card first, then archives the chosen one with a tap", () => {
    cashOut();
    expect(screen.getByTestId("shop-budget").textContent).toBe("$7k");
    const archive = screen.getByTestId("run-deck-archive");
    expect(archive.textContent).toBe("Archive · $3k");
    expect(archive.getAttribute("aria-disabled")).toBe("true");
    expect(
      document.getElementById("shop-deck-archive-reason")?.textContent
    ).toBe("Choose a card first.");
    // Tapping without a card does nothing.
    fireEvent.click(archive);
    expect(announce).not.toHaveBeenCalledWith(
      expect.stringMatching(/^Archived/)
    );
    const first = within(deckCards()[0]).getByRole("button");
    expect(first.className).toContain("min-h-[44px]");
    fireEvent.click(first);
    expect(first.getAttribute("aria-pressed")).toBe("true");
    const name = first.textContent ?? "";
    fireEvent.click(screen.getByTestId("run-deck-archive"));
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^Archived .* for \$3k: 14 cards next Blind\. Study budget \$4k\.$/
      )
    );
    expect(deckCards()).toHaveLength(SPONSOR_SAFETY_SCENARIO.deck.length - 1);
    expect(deckCards().map((c) => c.textContent)).not.toContain(name);
    // The service serves once per visit, and says so.
    expect(
      screen.getByTestId("run-deck-archive").getAttribute("aria-disabled")
    ).toBe("true");
    expect(
      document.getElementById("shop-deck-archive-reason")?.textContent
    ).toBe("Archive serves once per shop visit.");
  });

  it("duplicates a card, and explains a refusal", () => {
    cashOut();
    fireEvent.click(within(deckCards()[1]).getByRole("button"));
    fireEvent.click(screen.getByTestId("run-deck-duplicate"));
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^Duplicated .* for \$5k: 16 cards next Blind\. Study budget \$2k\.$/
      )
    );
    expect(deckCards().at(-1)?.textContent).toContain("Copy");
    // Archive now costs more than the budget holds, and the refusal says so.
    fireEvent.click(within(deckCards()[2]).getByRole("button"));
    fireEvent.click(screen.getByTestId("run-deck-archive"));
    expect(announce).toHaveBeenLastCalledWith("Archive costs $3k; $2k left.");
  });
});

describe("RunDeck read-only", () => {
  const view: RunDeckView = {
    blindName: "Internal QC",
    cards: [
      {
        id: "a",
        number: "Table 14.1.1",
        title: "Demographics",
        cardType: "TABLE",
        population: "ITT",
        chips: 30,
        origin: "AUTHORED",
        locked: true,
      },
      {
        id: "b",
        number: "Table 14.3.1",
        title: "Overview of AEs",
        cardType: "TABLE",
        population: "SAFETY",
        chips: 35,
        origin: "COPY",
        locked: false,
      },
    ],
    size: 2,
    handSize: 8,
    added: 2,
    archived: 1,
    waiting: 1,
  };

  it("lists cards without service buttons, with the deck's tally", () => {
    render(<RunDeck deck={view} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Run deck · Internal QC"
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByTestId("run-deck-size").textContent).toBe(
      "2 cards · 2 added · 1 archived · 1 copy waits for a Blind that deals its original. A Blind never deals fewer than 8."
    );
    expect(screen.getByText(/Scripted/)).toBeTruthy();
    expect(screen.getByText(/Copy/)).toBeTruthy();
  });

  it("names several waiting copies in the plural", () => {
    render(<RunDeck deck={{ ...view, added: 0, archived: 0, waiting: 2 }} />);
    expect(screen.getByTestId("run-deck-size").textContent).toBe(
      "2 cards · 2 copies wait for a Blind that deals their original. A Blind never deals fewer than 8."
    );
  });
});
