import { describe, expect, it } from "vitest";
import {
  MERCH_PRODUCTS,
  MERCH_SHOP_URL,
  MERCH_STORE_STATUS,
  getOrderUrl,
  isRedbubbleUrl,
  validateMerchCatalog,
  type MerchProductItem,
} from "@/lib/merch-data";

const live: MerchProductItem = {
  ...MERCH_PRODUCTS[0],
  url: "https://www.redbubble.com/i/sticker/laser-loon/123.EJUG5",
};

describe("merch catalog", () => {
  it("ships a sound catalog for the current store status", () => {
    expect(validateMerchCatalog()).toEqual([]);
  });

  it("covers the five planned products with unique ids", () => {
    expect(MERCH_PRODUCTS.map((p) => p.category).sort()).toEqual([
      "apparel",
      "desk",
      "drinkware",
      "print",
      "sticker",
    ]);
    expect(new Set(MERCH_PRODUCTS.map((p) => p.id)).size).toBe(
      MERCH_PRODUCTS.length
    );
  });

  it("stays coming-soon with no invented links until the shop exists", () => {
    // Flipping to live is a deliberate change: fill every url and the shop url,
    // then update this expectation in the same PR (#896).
    expect(MERCH_STORE_STATUS).toBe("coming-soon");
    expect(MERCH_SHOP_URL).toBeNull();
    expect(MERCH_PRODUCTS.every((p) => p.url === null)).toBe(true);
  });

  it("accepts only https URLs on redbubble.com", () => {
    expect(isRedbubbleUrl("https://www.redbubble.com/people/x/shop")).toBe(
      true
    );
    expect(isRedbubbleUrl("https://redbubble.com/i/x")).toBe(true);
    expect(isRedbubbleUrl("http://www.redbubble.com/i/x")).toBe(false);
    expect(isRedbubbleUrl("https://redbubble.com.evil.example/i/x")).toBe(
      false
    );
    expect(isRedbubbleUrl("https://evilredbubble.com/i/x")).toBe(false);
    expect(isRedbubbleUrl("javascript:alert(1)")).toBe(false);
    expect(isRedbubbleUrl("")).toBe(false);
    expect(isRedbubbleUrl(null)).toBe(false);
  });

  it("only hands out an order URL when the store is live", () => {
    expect(getOrderUrl(live, "coming-soon")).toBeNull();
    expect(getOrderUrl(live, "live")).toBe(live.url);
    expect(
      getOrderUrl({ ...live, url: "https://example.com/x" }, "live")
    ).toBeNull();
    expect(getOrderUrl({ ...live, url: null }, "live")).toBeNull();
  });

  it("refuses a live catalog that is missing or has foreign links", () => {
    expect(
      validateMerchCatalog(
        [live],
        "live",
        "https://www.redbubble.com/people/x/shop"
      )
    ).toEqual([]);
    expect(
      validateMerchCatalog(
        [{ ...live, url: null }],
        "live",
        "https://www.redbubble.com/people/x/shop"
      )
    ).toEqual([`${live.id}: live store needs a url`]);
    expect(validateMerchCatalog([live], "live", null)).toEqual([
      "live store needs MERCH_SHOP_URL on redbubble.com",
    ]);
    expect(
      validateMerchCatalog(
        [{ ...live, url: "https://example.com/x" }],
        "coming-soon"
      )
    ).toEqual([`${live.id}: url must be https on redbubble.com`]);
  });

  it("rejects duplicate and malformed ids", () => {
    const problems = validateMerchCatalog(
      [
        { ...live, id: "Bad_Id", url: null },
        { ...live, id: "dup", url: null },
        { ...live, id: "dup", url: null },
      ],
      "coming-soon"
    );
    expect(problems).toContain("Bad_Id: id must be kebab-case");
    expect(problems).toContain("dup: duplicate id");
  });
});
