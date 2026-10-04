import React from "react";
import {
  MERCH_CATEGORY_LABELS,
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
