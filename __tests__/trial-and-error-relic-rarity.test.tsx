// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Shop } from "@/components/trial-and-error/Shop";
import {
  PackOpening,
  type RevealCard,
} from "@/components/trial-and-error/PackOpening";
import { RarityBadge } from "@/components/trial-and-error/RarityBadge";
import {
  ACT_I,
  advanceRun,
  createRunState,
  deriveRunView,
  type ShopItemView,
  type ShopView,
} from "@/lib/trial-and-error";

afterEach(cleanup);

/** A real shop view from Act I, its two slots replaced by `items`. */
function shopView(items: ShopItemView[]): ShopView {
  const run = createRunState(ACT_I, "rarity-ui");
  const paid = advanceRun(
    ACT_I,
    { ...run, table: { ...run.table, status: "CLEARED" } },
    { type: "CASH_OUT" }
  );
  return { ...deriveRunView(ACT_I, paid).shop!, items };
}

const item = (overrides: Partial<ShopItemView>): ShopItemView => ({
  id: "slot-0",
  name: "Medical Monitor",
  description: "Retriggers each Safety output scored.",
  price: 10,
  sold: false,
  refusal: null,
  rarity: "RARE",
  ...overrides,
});

describe("relic rarity in the shop (#2083)", () => {
  it("labels each relic's rarity in words with a mark, and nothing else", () => {
    const onBuy = vi.fn();
    render(
      <Shop
        view={shopView([
          item({}),
          item({
            id: "slot-1",
            name: "Guideline E9",
            rarity: null,
            price: 5,
          }),
        ])}
        budget={20}
        onBuy={onBuy}
        onBuyPack={vi.fn()}
        onReroll={vi.fn()}
      />
    );
    const items = within(screen.getByTestId("shop-items")).getAllByRole(
      "listitem"
    );
    const badge = within(items[0]).getByTestId("relic-rarity");
    // The rarity reads as text, not colour alone; the mark is decorative.
    expect(badge.textContent).toContain("Rare");
    expect(badge.getAttribute("data-rarity")).toBe("RARE");
    expect(badge.querySelector("[aria-hidden='true']")?.textContent).toContain(
      "★"
    );
    expect(within(items[1]).queryByTestId("relic-rarity")).toBeNull();
    // The buy button keeps its 44px touch target.
    const buy = within(items[0]).getByRole("button", {
      name: "Buy Medical Monitor",
    });
    expect(buy.className).toContain("min-h-[44px]");
    fireEvent.click(buy);
    expect(onBuy).toHaveBeenCalledWith(0);
  });

  it("gives each rarity its own mark and word", () => {
    const { container } = render(
      <>
        <RarityBadge rarity="COMMON" />
        <RarityBadge rarity="UNCOMMON" />
        <RarityBadge rarity="RARE" />
      </>
    );
    const badges = [
      ...container.querySelectorAll("[data-testid='relic-rarity']"),
    ];
    expect(badges.map((b) => b.textContent)).toEqual([
      "●Common",
      "◆Uncommon",
      "★Rare",
    ]);
  });

  it("shows a relic card's rarity in a pack reveal", () => {
    const cards: RevealCard[] = [
      {
        id: "REL-QC-CHECKLIST",
        kind: "Relic",
        name: "QC Checklist",
        description: "+10 Chips per redline fixed.",
        picked: false,
        refusal: null,
        warning: null,
        rarity: "COMMON",
      },
      {
        id: "SITE-104",
        kind: "Site",
        name: "Site 104",
        description: "+20 Chips.",
        picked: false,
        refusal: null,
        warning: null,
        rarity: null,
      },
    ];
    render(
      <PackOpening
        title="Relic Pack"
        picksLeft={1}
        cards={cards}
        onPick={vi.fn()}
        animate={false}
        loud={false}
      />
    );
    const badges = screen.getAllByTestId("relic-rarity");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toContain("Common");
  });
});
