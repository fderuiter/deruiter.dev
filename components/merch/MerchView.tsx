import React from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  MERCH_PRODUCTS,
  MERCH_SHOP_URL,
  MERCH_STORE_STATUS,
  isRedbubbleUrl,
} from "@/lib/merch-data";
import { AvailableMerch, MerchGrid } from "./MerchGrid";

/** The /merch page body: status, the at-cost promise, then the product grid. */
export function MerchView() {
  const live = MERCH_STORE_STATUS === "live";
  const shopUrl = isRedbubbleUrl(MERCH_SHOP_URL) ? MERCH_SHOP_URL : null;

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-4 pb-24 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Laser Loon Merch" }]}
        className="mb-6"
      />

      <header className="mb-8 min-w-0">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-400">
          Laser Loon / Minnesota flag submission F277
        </p>
        <h1 className="break-words text-3xl font-extrabold tracking-[-0.035em] text-[#f4f4f6] sm:text-5xl">
          Laser Loon merch
          {!live && <span className="text-amber-400">, coming soon</span>}
        </h1>
        <p className="mt-4 max-w-2xl break-words text-base text-zinc-400">
          {live
            ? "Stickers, shirts, desk mats, mugs and prints of the F277 flag, printed and shipped by Redbubble."
            : "The Redbubble shop is not open yet. The flag below is on sale now from Flags for Good. The rest of the lineup is planned: nothing in it can be ordered today, and nothing is reserved."}
        </p>
        {live && shopUrl && (
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Visit the Redbubble shop
            <span className="sr-only"> (opens in new window)</span>
          </a>
        )}
      </header>

      <section
        aria-labelledby="at-cost-heading"
        className="mb-8 rounded-2xl border border-zinc-800 bg-[#13151a] p-5 sm:p-6"
      >
        <h2
          id="at-cost-heading"
          className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-emerald-400"
        >
          At-cost promise
        </h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="break-words">
            {live
              ? "Every Redbubble item is priced"
              : "Every Redbubble item will be priced"}{" "}
            at Redbubble&apos;s base production cost, with no artist markup.
          </li>
          <li className="break-words">
            Redbubble is the seller. It handles checkout, printing, sales tax,
            shipping, returns and support for its items. Flags for Good does the
            same for the flag. This site holds no inventory and takes no
            payment.
          </li>
          <li className="break-words">
            The artwork is CC0, a public domain dedication. You can also print
            your own from the{" "}
            <Link
              href="/work/laser-loon"
              className="underline decoration-zinc-600 underline-offset-4 hover:text-amber-400"
            >
              free vector files
            </Link>
            .
          </li>
        </ul>
      </section>

      <AvailableMerch />

      <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
        {live ? "Redbubble shop" : "Planned on Redbubble"}
      </h2>
      <MerchGrid products={MERCH_PRODUCTS} status={MERCH_STORE_STATUS} />

      <p className="mt-8 break-words text-xs text-zinc-500">
        Product pictures are flat mockups of the planned items, not photos of
        printed goods.
      </p>
    </div>
  );
}
