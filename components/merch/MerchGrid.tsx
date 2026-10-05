import React from "react";
import {
  AVAILABLE_MERCH,
  MERCH_CATEGORY_LABELS,
  isFlagsForGoodUrl,
  getOrderUrl,
  type MerchProductItem,
  type MerchStoreStatus,
} from "@/lib/merch-data";
import { ProductMockup } from "./ProductMockup";

interface MerchGridProps {
  products: readonly MerchProductItem[];
  status: MerchStoreStatus;
}

/**
 * Items on sale now from another seller. Only links with a valid host are
 * rendered, so a bad entry drops out instead of linking somewhere unexpected.
 */
export function AvailableMerch() {
  const items = AVAILABLE_MERCH.filter((item) => isFlagsForGoodUrl(item.url));
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="available-now-heading" className="mb-10">
      <h2
        id="available-now-heading"
        className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-emerald-400"
      >
        Available now
      </h2>
      <ul className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="@container flex min-w-0 flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-[#0d0e11] p-3 sm:p-4"
          >
            <div className="flex min-w-0 flex-col gap-4 @md:flex-row @md:items-center">
              <div className="w-full min-w-0 @md:w-64 @md:shrink-0">
                <ProductMockup
                  category="print"
                  image={item.previewImage}
                  alt={item.previewAlt}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Flag, sold by {item.seller}
                </span>
                <h3 className="break-words text-lg font-semibold text-[#f4f4f6]">
                  {item.title}
                </h3>
                <p className="break-words text-sm text-zinc-400">
                  {item.description}
                </p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 active:scale-[0.98] @md:w-auto @md:self-start"
                >
                  Buy on {item.seller}
                  <span className="sr-only">
                    : {item.title} (opens in new window)
                  </span>
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Product cards. The grid adapts to its own width (container queries), so it
 * stays within 320px without a horizontal scrollbar. While the store is
 * coming soon a card shows a plain status line instead of an order link.
 */
export function MerchGrid({ products, status }: MerchGridProps) {
  return (
    <div className="@container w-full min-w-0">
      <ul
        className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3"
        aria-label="Planned Laser Loon merchandise"
      >
        {products.map((product) => {
          const orderUrl = getOrderUrl(product, status);
          return (
            <li
              key={product.id}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#0d0e11] p-3 sm:p-4"
            >
              <ProductMockup
                category={product.category}
                image={product.previewImage}
                alt={product.previewAlt}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {MERCH_CATEGORY_LABELS[product.category]}
                </span>
                <h3 className="break-words text-base font-semibold text-[#f4f4f6]">
                  {product.title}
                </h3>
                <p className="break-words text-sm text-zinc-400">
                  {product.description}
                </p>
              </div>
              <div className="mt-auto pt-1">
                {orderUrl ? (
                  <a
                    href={orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 active:scale-[0.98]"
                  >
                    Order on Redbubble
                    <span className="sr-only">
                      : {product.title} (opens in new window)
                    </span>
                  </a>
                ) : (
                  <p className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                    Coming soon
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
