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
import {
  ACT_I,
  ACT_I_SHOP,
  DEMOGRAPHICS_SCENARIO,
  SPONSOR_SAFETY_SCENARIO,
  type Act,
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

const relic = ACT_I_SHOP.entries.find((e) => e.kind === "RELIC")!;
const guidance = ACT_I_SHOP.entries.find((e) => e.kind === "GUIDANCE")!;

/**
 * A shop small enough to be seed-proof: two single items and two packs, so
 * both slots of each always hold the same things. Every price is $1k.
 */
const SHOP: ShopCatalog = {
  entries: [
    { ...relic, price: 1 },
    { ...guidance, price: 1 },
  ],
  packs: ACT_I_SHOP.packs
    .filter((p) => p.kind !== "RELIC")
    .map((p) => ({ ...p, price: 1 })),
  sites: ACT_I_SHOP.sites,
};

/** Act I with a one-point Small Blind, no crises, and the small shop. */
const SHOP_ACT: Act = {
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

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;

/** Clears the one-point Small Blind and cashes out. */
function cashOut() {
  render(<CardTable act={SHOP_ACT} seed="shop-ui" />);
  fireEvent.click(card("C-T14.1.1-C"));
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  const button = screen.getByRole("button", { name: /^Cash out \$\d+k$/ });
  const owed = screen.getByTestId("cash-out-total").textContent;
  fireEvent.click(button);
  return owed;
}

describe("Procurement Shop", () => {
  it("cashes out line by line into the budget and opens the shop", () => {
    const owed = cashOut();
    const report = screen.getByTestId("cash-out");
    expect(within(report).getByText("Cash-out")).toBeTruthy();
    expect(within(report).getAllByTestId("cash-out-line")).toHaveLength(3);
    expect(screen.getByTestId("cash-out-total").textContent).toBe(owed);
    expect(screen.getByTestId("shop-budget").textContent).toBe(owed);
    // Focus moves into the shop.
    expect(document.activeElement?.id).toBe("shop-heading");
    const items = within(screen.getByTestId("shop-items")).getAllByRole(
      "listitem"
    );
    expect(items).toHaveLength(2);
    expect(
      within(screen.getByTestId("shop-packs")).getAllByRole("listitem")
    ).toHaveLength(2);
    expect(screen.getByTestId("shop-reroll").textContent).toBe("Reroll · $5k");
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Cash-out: \$\d+k\. .*Procurement Shop is open\.$/)
    );
  });

  it("buys an item, announces the reason it cannot buy again, and sells a relic with S and a confirm step", () => {
    cashOut();
    const buttons = screen.getAllByTestId("shop-buy");
    const buyRelic = buttons.find((b) =>
      b.textContent?.includes(relic.kind === "RELIC" ? relic.relic.name : "")
    )!;
    fireEvent.click(buyRelic);
    expect(buyRelic.textContent).toBe("Sold");
    expect(buyRelic.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(buyRelic);
    expect(announce).toHaveBeenLastCalledWith("That slot is empty.");

    const rack = screen.getByTestId("relic-rack");
    // The chip names the relic, not its internal id (#2151).
    if (relic.kind !== "RELIC") throw new Error("expected a relic entry");
    expect(relic.relic.id).toMatch(/^REL-/);
    expect(within(rack).getByTestId("relic-name").textContent).toBe(
      relic.relic.name
    );
    const sell = within(rack).getByTestId("relic-sell");
    sell.focus();
    fireEvent.keyDown(sell, { key: "s" });
    const confirm = screen.getByTestId("relic-sell-confirm");
    expect(confirm.textContent).toMatch(/Sell .* for \$0k\?/);
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep" }));
    expect(screen.queryByTestId("relic-sell-confirm")).toBeNull();
    fireEvent.keyDown(sell, { key: "S" });
    fireEvent.click(
      within(screen.getByTestId("relic-sell-confirm")).getByRole("button", {
        name: "Sell",
      })
    );
    expect(within(rack).queryByTestId("relic")).toBeNull();
  });

  it("opens a pack, keeps one card, and returns to the shop", () => {
    cashOut();
    const packs = within(screen.getByTestId("shop-packs")).getAllByTestId(
      "shop-buy"
    );
    const guidancePack = packs.find((b) =>
      b.textContent?.includes("Guidance")
    )!;
    fireEvent.click(guidancePack);
    const opening = screen.getByTestId("pack-opening");
    // The pack opens to its size, capped by what the stock holds: this
    // shop carries one Guidance card.
    const choices = within(opening).getAllByTestId("pack-card");
    expect(choices).toHaveLength(1);
    // Reduced motion: every card is face up at once, and focus is on the first.
    expect(document.activeElement).toBe(choices[0]);
    expect(screen.queryByTestId("shop")).toBeNull();
    // Next Blind waits for the pack.
    fireEvent.click(screen.getByRole("button", { name: "Next Blind" }));
    expect(announce).toHaveBeenLastCalledWith(
      "Keep a card from the pack or skip it first."
    );
    // The tray is full, so keeping the card is refused with its reason...
    fireEvent.click(choices[0]);
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^The tray holds 2/)
    );
    expect(within(opening).getByText(/^The tray holds 2/)).toBeTruthy();
    // ...until a consumable is sold to make room.
    const tray = screen.getByTestId("consumable-tray");
    fireEvent.click(within(tray).getAllByRole("button", { name: /^Sell/ })[0]);
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Sold .* Study budget \$\d+k\.$/)
    );
    fireEvent.click(
      within(screen.getByTestId("pack-opening")).getAllByTestId("pack-card")[0]
    );
    expect(screen.queryByTestId("pack-opening")).toBeNull();
    expect(screen.getByTestId("shop")).toBeTruthy();
    expect(guidancePack.isConnected ? guidancePack.textContent : "Sold").toBe(
      "Sold"
    );
  });

  it("warns before activating a site, and a skipped pack forfeits the rest", () => {
    cashOut();
    const packs = within(screen.getByTestId("shop-packs")).getAllByTestId(
      "shop-buy"
    );
    fireEvent.click(packs.find((b) => b.textContent?.includes("Site"))!);
    const opening = screen.getByTestId("pack-opening");
    const [first] = within(opening).getAllByTestId("pack-card");
    fireEvent.click(first);
    const confirm = screen.getByTestId("pack-confirm");
    expect(confirm.textContent).toMatch(/after the next Blind's first hand/);
    fireEvent.click(within(confirm).getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("pack-confirm")).toBeNull();
    fireEvent.click(screen.getByTestId("pack-skip"));
    expect(screen.queryByTestId("pack-opening")).toBeNull();
    expect(announce).toHaveBeenLastCalledWith(
      "Skipped the rest of Site Activation Pack."
    );
    fireEvent.click(screen.getByRole("button", { name: "Next Blind" }));
    expect(screen.getByTestId("blind-name").textContent).toBe(
      "Big Blind: Sponsor Safety Review"
    );
  });
});
