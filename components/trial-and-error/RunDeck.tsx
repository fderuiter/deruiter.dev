"use client";

import React, { useState } from "react";
import {
  POPULATION_LABELS,
  type RunDeckCardView,
  type RunDeckView,
  type ShopServiceView,
} from "@/lib/trial-and-error";

interface RunDeckProps {
  deck: RunDeckView;
  /** The Archive service; absent shows the deck read-only. */
  archive?: ShopServiceView;
  /** The Duplicate service; absent shows the deck read-only. */
  duplicate?: ShopServiceView;
  onArchive?: (cardId: string) => void;
  onDuplicate?: (cardId: string) => void;
  /** Prefixes element ids, so two decks on a page never collide. */
  idPrefix?: string;
  /** The heading's level in the surrounding outline. */
  headingLevel?: 3 | 4;
}

const ORIGIN_LABELS: Readonly<Record<RunDeckCardView["origin"], string>> = {
  AUTHORED: "",
  BOUGHT: "Bought",
  COPY: "Copy",
};

const SERVICE_BUTTON =
  "min-h-[44px] border px-3 text-xs font-bold uppercase touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/** The run deck's tally line: size, and what the run changed. */
function tally(deck: RunDeckView): string {
  const parts = [`${deck.size} cards`];
  if (deck.added > 0) parts.push(`${deck.added} added`);
  if (deck.archived > 0) parts.push(`${deck.archived} archived`);
  if (deck.waiting > 0) {
    parts.push(
      `${deck.waiting} ${deck.waiting === 1 ? "copy waits" : "copies wait"} for a Blind that deals ${deck.waiting === 1 ? "its" : "their"} original`
    );
  }
  return parts.join(" · ");
}

/**
 * The run deck (#2082): the cards the current or next Blind deals, where
 * each came from, and, in the shop, the Archive and Duplicate services. A
 * card is chosen with a tap (no hover-only action), then a service is
 * applied to it. Every price and refusal comes from the domain view.
 */
export function RunDeck({
  deck,
  archive,
  duplicate,
  onArchive,
  onDuplicate,
  idPrefix = "run-deck",
  headingLevel = 4,
}: RunDeckProps) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = deck.cards.some((c) => c.id === chosen) ? chosen : null;
  const services = archive && duplicate && onArchive && onDuplicate;
  const reason = (service: ShopServiceView): string | null =>
    service.refusal ??
    (selected === null
      ? "Choose a card first."
      : (service.cardRefusals[selected] ?? null));
  const archiveReason = archive ? reason(archive) : null;
  const duplicateReason = duplicate ? reason(duplicate) : null;
  return (
    <section
      aria-labelledby={`${idPrefix}-heading`}
      className="mt-4 min-w-0"
      data-testid="run-deck"
    >
      <Heading
        id={`${idPrefix}-heading`}
        className="text-[10px] font-bold uppercase tracking-wider text-zinc-400"
      >
        Run deck · {deck.blindName}
      </Heading>
      <p
        className="text-xs tabular-nums text-zinc-300 break-words"
        data-testid="run-deck-size"
      >
        {tally(deck)}. A Blind never deals fewer than {deck.handSize}.
      </p>
      <ul
        aria-label="Cards in the run deck"
        className="mt-1 grid gap-1 @container sm:grid-cols-2"
      >
        {deck.cards.map((card) => {
          const origin = ORIGIN_LABELS[card.origin];
          const text = (
            <>
              <span className="min-w-0 break-words">
                <span className="font-bold text-zinc-100">{card.number}</span>{" "}
                {card.title}
              </span>
              <span className="shrink-0 text-[10px] uppercase text-zinc-400">
                {POPULATION_LABELS[card.population]}
                {origin && (
                  <span className="ml-1 text-emerald-300">· {origin}</span>
                )}
                {card.locked && (
                  <span className="ml-1 text-amber-300">· Scripted</span>
                )}
              </span>
            </>
          );
          return (
            <li key={card.id} className="min-w-0" data-testid="run-deck-card">
              {services ? (
                <button
                  type="button"
                  aria-pressed={selected === card.id}
                  onClick={() =>
                    setChosen(selected === card.id ? null : card.id)
                  }
                  className="flex min-h-[44px] w-full min-w-0 items-center justify-between gap-2 border border-zinc-800 px-2 text-left text-xs touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] aria-pressed:border-amber-400 aria-pressed:bg-amber-500/10"
                >
                  {text}
                </button>
              ) : (
                <div className="flex min-w-0 items-center justify-between gap-2 border border-zinc-800 px-2 py-1 text-xs">
                  {text}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {services && (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              aria-disabled={archiveReason !== null}
              aria-describedby={
                archiveReason ? `${idPrefix}-archive-reason` : undefined
              }
              // An unavailable service still answers, so its reason is announced.
              onClick={() => {
                if (selected === null) return;
                onArchive(selected);
                if (archiveReason === null) setChosen(null);
              }}
              className={`${SERVICE_BUTTON} border-rose-400 text-rose-200 hover:bg-rose-500/10`}
              data-testid="run-deck-archive"
            >
              Archive · ${archive.price}k
            </button>
            {archiveReason && (
              <p
                id={`${idPrefix}-archive-reason`}
                className="text-[11px] text-rose-300 break-words"
              >
                {archiveReason}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              aria-disabled={duplicateReason !== null}
              aria-describedby={
                duplicateReason ? `${idPrefix}-duplicate-reason` : undefined
              }
              onClick={() => {
                if (selected === null) return;
                onDuplicate(selected);
                if (duplicateReason === null) setChosen(null);
              }}
              className={`${SERVICE_BUTTON} border-emerald-500 text-emerald-300 hover:bg-emerald-500/10`}
              data-testid="run-deck-duplicate"
            >
              Duplicate · ${duplicate.price}k
            </button>
            {duplicateReason && (
              <p
                id={`${idPrefix}-duplicate-reason`}
                className="text-[11px] text-rose-300 break-words"
              >
                {duplicateReason}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
