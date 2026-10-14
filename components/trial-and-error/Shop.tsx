"use client";

import React, { useEffect, useRef } from "react";
import type {
  RunDeckView,
  ShopItemView,
  ShopView,
} from "@/lib/trial-and-error";
import { RunDeck } from "@/components/trial-and-error/RunDeck";
import { RarityBadge } from "@/components/trial-and-error/RarityBadge";

interface ShopProps {
  view: ShopView;
  budget: number;
  onBuy: (slot: number) => void;
  onBuyPack: (slot: number) => void;
  onReroll: () => void;
  /** The run deck the next Blind deals (#2082); absent hides the services. */
  deck?: RunDeckView;
  onArchive?: (cardId: string) => void;
  onDuplicate?: (cardId: string) => void;
}

const BUTTON =
  "min-h-[44px] border px-3 text-xs font-bold uppercase touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/** One priced item: its tag, name, flavor, and why it cannot be bought. */
function ShopItem({
  item,
  label,
  onBuy,
}: {
  item: ShopItemView;
  label: string;
  onBuy: () => void;
}) {
  const reasonId = `${item.id}-reason`;
  return (
    <li className="flex min-w-0 flex-col gap-2 border border-zinc-800 bg-[color:var(--te-surface-1)] p-3 text-xs @container">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 font-bold text-zinc-100 break-words">
          {item.name}
        </span>
        <span
          className="shrink-0 border border-amber-500/60 px-1.5 font-bold tabular-nums text-amber-300"
          aria-label={`Price $${item.price}k`}
        >
          ${item.price}k
        </span>
      </div>
      {item.rarity && <RarityBadge rarity={item.rarity} />}
      <p className="min-w-0 text-zinc-400 break-words">{item.description}</p>
      <button
        type="button"
        aria-disabled={item.refusal !== null}
        aria-describedby={item.refusal ? reasonId : undefined}
        // An unavailable item still answers, so its reason is announced.
        onClick={onBuy}
        className={`${BUTTON} mt-auto border-emerald-500 text-emerald-300 hover:bg-emerald-500/10`}
        data-testid="shop-buy"
      >
        {item.sold ? "Sold" : `${label} ${item.name}`}
      </button>
      {item.refusal && !item.sold && (
        <p id={reasonId} className="text-[11px] text-rose-300 break-words">
          {item.refusal}
        </p>
      )}
    </li>
  );
}

/**
 * The Procurement Shop (#948): two single slots, two booster packs
 * and a reroll whose price climbs each time, then the run deck the next
 * Blind deals with its Archive and Duplicate services (#2082). Every price,
 * refusal and outcome comes from the domain's shop view; the component only
 * renders it.
 */
export function Shop({
  view,
  budget,
  onBuy,
  onBuyPack,
  onReroll,
  deck,
  onArchive,
  onDuplicate,
}: ShopProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="shop-heading"
      className="mx-auto mt-4 max-w-3xl text-left"
      data-testid="shop"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="shop-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xs font-bold uppercase tracking-wider text-zinc-200 outline-none"
        >
          Procurement Shop
        </h3>
        <p className="text-xs tabular-nums text-zinc-300">
          Study budget{" "}
          <span
            className="font-bold text-emerald-300"
            data-testid="shop-budget"
          >
            ${budget}k
          </span>
        </p>
      </div>
      <ul
        aria-label="Items"
        className="mt-2 grid gap-2 sm:grid-cols-2"
        data-testid="shop-items"
      >
        {view.items.map((item, i) => (
          <ShopItem
            key={item.id}
            item={item}
            label="Buy"
            onBuy={() => onBuy(i)}
          />
        ))}
      </ul>
      <ul
        aria-label="Booster packs"
        className="mt-2 grid gap-2 sm:grid-cols-2"
        data-testid="shop-packs"
      >
        {view.packs.map((pack, i) => (
          <ShopItem
            key={pack.id}
            item={pack}
            label="Open"
            onBuy={() => onBuyPack(i)}
          />
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-disabled={view.rerollRefusal !== null}
          aria-describedby={
            view.rerollRefusal ? "shop-reroll-reason" : undefined
          }
          onClick={onReroll}
          className={`${BUTTON} border-amber-500 text-amber-300 hover:bg-amber-500/10`}
          data-testid="shop-reroll"
        >
          Reroll · ${view.rerollPrice}k
        </button>
        {view.rerollRefusal && (
          <p
            id="shop-reroll-reason"
            className="text-[11px] text-rose-300 break-words"
          >
            {view.rerollRefusal}
          </p>
        )}
      </div>
      {deck && (
        <RunDeck
          deck={deck}
          archive={view.archive}
          duplicate={view.duplicate}
          onArchive={onArchive}
          onDuplicate={onDuplicate}
          idPrefix="shop-deck"
        />
      )}
    </section>
  );
}
