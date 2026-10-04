import React from "react";
import Link from "next/link";
import { IconShoppingBag } from "@tabler/icons-react";
import { MERCH_STORE_STATUS } from "@/lib/merch-data";

interface MerchPromptProps {
  /** Wording for the live store; the coming-soon wording is fixed. */
  liveLabel: string;
  className?: string;
}

/**
 * A small link to /merch for other pages. It says "coming soon" until the
 * shop is open, so no page promises something visitors cannot order.
 */
export function MerchPrompt({ liveLabel, className = "" }: MerchPromptProps) {
  const live = MERCH_STORE_STATUS === "live";
  return (
    <Link
      href="/merch"
      className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98] ${className}`}
    >
      <IconShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {live ? liveLabel : "Laser Loon merch, coming soon at cost"}
      </span>
    </Link>
  );
}
