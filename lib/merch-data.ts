/**
 * Catalog for the Laser Loon at-cost merchandise page (`/merch`).
 *
 * Redbubble is the merchant of record, so the site only links out. Until the
 * shop exists (#892) the store status is `coming-soon`: the page shows the
 * planned lineup with no order buttons, and no product carries a URL. To go
 * live, fill in `url` on every product and set `MERCH_STORE_STATUS` to
 * `live`. `validateMerchCatalog` and the merch tests refuse a live catalog
 * with a missing or non-Redbubble URL, so a half-wired store cannot ship.
 */

/** Whether visitors can order yet. */
export type MerchStoreStatus = "coming-soon" | "live";

export type MerchCategory =
  "sticker" | "apparel" | "desk" | "drinkware" | "print";

export interface MerchProductItem {
  /** Stable kebab-case id, unique in the catalog. */
  id: string;
  title: string;
  category: MerchCategory;
  /** One sentence on what the product is. */
  description: string;
  /** Artwork shown in the product mockup. */
  previewImage: string;
  /** Alt text for the artwork. */
  previewAlt: string;
  /** Direct Redbubble product URL, or null while the shop is not open. */
  url: string | null;
}

export const MERCH_STORE_STATUS: MerchStoreStatus = "coming-soon";

/** Redbubble artist profile, or null while the shop is not open. */
export const MERCH_SHOP_URL: string | null = null;

const ARTWORK = "/files/Laser_loon.svg";
const ARTWORK_ALT =
  "Laser Loon, submission F277 for the Minnesota state flag: a white loon on a blue field";

export const MERCH_CATEGORY_LABELS: Record<MerchCategory, string> = {
  sticker: "Stickers",
  apparel: "Apparel",
  desk: "Desk",
  drinkware: "Drinkware",
  print: "Prints",
};

export const MERCH_PRODUCTS: readonly MerchProductItem[] = [
  {
    id: "die-cut-sticker",
    title: "Die-cut vinyl sticker",
    category: "sticker",
    description: "Matte or glossy vinyl, cut to the flag's outline.",
    previewImage: ARTWORK,
    previewAlt: ARTWORK_ALT,
    url: null,
  },
  {
    id: "classic-t-shirt",
    title: "Classic t-shirt",
    category: "apparel",
    description: "The flag on a dark or neutral shirt.",
    previewImage: ARTWORK,
    previewAlt: ARTWORK_ALT,
    url: null,
  },
  {
    id: "desk-mat",
    title: "Desk mat",
    category: "desk",
    description: "A wide mat that doubles as a mouse pad.",
    previewImage: ARTWORK,
    previewAlt: ARTWORK_ALT,
    url: null,
  },
  {
    id: "ceramic-mug",
    title: "Ceramic mug",
    category: "drinkware",
    description: "A coffee mug for the Capitol campaign.",
    previewImage: ARTWORK,
    previewAlt: ARTWORK_ALT,
    url: null,
  },
  {
    id: "art-print",
    title: "Art print",
    category: "print",
    description: "A large print of the full flag design.",
    previewImage: ARTWORK,
    previewAlt: ARTWORK_ALT,
    url: null,
  },
];

/** An item that can be bought today from a store other than Redbubble. */
export interface AvailableMerchItem {
  id: string;
  title: string;
  description: string;
  /** Seller name shown on the card. */
  seller: string;
  /** Product page on the seller's own site (https, `flagsforgood.com`). */
  url: string;
  previewImage: string;
  previewAlt: string;
}

/** Items on sale now. The Redbubble lineup above stays coming soon. */
export const AVAILABLE_MERCH: readonly AvailableMerchItem[] = [
  {
    id: "minnesota-flag",
    title: "Laser Loon Minnesota flag",
    description:
      "The F277 Laser Loon design as a full-size flag, sold by Flags for Good.",
    seller: "Flags for Good",
    url: "https://flagsforgood.com/products/laser-loon-minnesota-flag",
    previewImage: ARTWORK,
    previewAlt: ARTWORK_ALT,
  },
];

const FLAGS_FOR_GOOD_HOST = /(^|\.)flagsforgood\.com$/i;

/** True for an https URL on flagsforgood.com. */
export function isFlagsForGoodUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && FLAGS_FOR_GOOD_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

const REDBUBBLE_HOST = /(^|\.)redbubble\.com$/i;

/** True for an https URL on redbubble.com. */
export function isRedbubbleUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && REDBUBBLE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/** The order link for a product, or null when it cannot be ordered yet. */
export function getOrderUrl(
  product: MerchProductItem,
  status: MerchStoreStatus = MERCH_STORE_STATUS
): string | null {
  return status === "live" && isRedbubbleUrl(product.url) ? product.url : null;
}

/**
 * Problems that would break the store, as readable messages. Empty means the
 * catalog is sound for the given status.
 */
export function validateMerchCatalog(
  products: readonly MerchProductItem[] = MERCH_PRODUCTS,
  status: MerchStoreStatus = MERCH_STORE_STATUS,
  shopUrl: string | null = MERCH_SHOP_URL
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const item of AVAILABLE_MERCH) {
    if (!isFlagsForGoodUrl(item.url)) {
      problems.push(`${item.id}: url must be https on flagsforgood.com`);
    }
  }
  for (const product of products) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(product.id)) {
      problems.push(`${product.id}: id must be kebab-case`);
    }
    if (seen.has(product.id)) problems.push(`${product.id}: duplicate id`);
    seen.add(product.id);
    if (product.url !== null && !isRedbubbleUrl(product.url)) {
      problems.push(`${product.id}: url must be https on redbubble.com`);
    }
    if (status === "live" && product.url === null) {
      problems.push(`${product.id}: live store needs a url`);
    }
  }
  if (status === "live" && !isRedbubbleUrl(shopUrl)) {
    problems.push("live store needs MERCH_SHOP_URL on redbubble.com");
  }
  return problems;
}
