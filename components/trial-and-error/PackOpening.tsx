"use client";

import React, { useEffect, useRef, useState } from "react";
import { CardFlip } from "@/components/trial-and-error/cards/CardFlip";
import { CardBack } from "@/components/trial-and-error/cards/CardBack";

/** One card in a pack reveal. */
export interface RevealCard {
  id: string;
  /** A short kind label: Relic, Guidance, SAP Amendment, Seal or Site. */
  kind: string;
  name: string;
  description: string;
  picked: boolean;
  /** Why it cannot be kept now, or null. */
  refusal: string | null;
  /** Shown, and confirmed, before the card is kept. */
  warning: string | null;
}

interface PackOpeningProps {
  title: string;
  /** How many more cards can be kept. */
  picksLeft: number;
  cards: RevealCard[];
  onPick: (cardId: string) => void;
  /** Leaves the pack, forfeiting its remaining picks. Absent: no skipping. */
  onSkip?: () => void;
  /** Animate the tear and the flips. False under reduced motion. */
  animate: boolean;
  /** The table allows loud effects (≥768px, no reduced motion). */
  loud: boolean;
  testId?: string;
  cardTestId?: string;
}

const KIND_ACCENT: Record<string, string> = {
  Relic: "border-emerald-500/60 text-emerald-300",
  Site: "border-sky-500/60 text-sky-300",
  Guidance: "border-amber-500/60 text-amber-300",
  Seal: "border-zinc-500 text-zinc-200",
  "SAP Amendment": "border-amber-300 text-amber-200",
};

/**
 * A booster pack reveal (#948): the pack tears, its cards fan out
 * face down and flip one by one, then the player keeps up to `picksLeft`.
 * A card with a warning (a Site Activation's enrollment) asks for
 * confirmation first. Reduced motion shows every card face up at once. The
 * DMC milestone's relic reward reuses it with one pick and no skip.
 */
export function PackOpening({
  title,
  picksLeft,
  cards,
  onPick,
  onSkip,
  animate,
  loud,
  testId = "pack-opening",
  cardTestId = "pack-card",
}: PackOpeningProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const pending = cards.find((c) => c.id === confirming);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  const choose = (card: RevealCard) => {
    if (card.warning && !card.picked && !card.refusal) {
      setConfirming(card.id);
      return;
    }
    onPick(card.id);
  };

  return (
    <section
      aria-labelledby={`${testId}-heading`}
      className="mx-auto mt-4 max-w-3xl text-left"
      data-testid={testId}
    >
      {loud && (
        // The pack tears: a strip, never the text, takes the loud moment,
        // so contrast holds throughout.
        <div
          aria-hidden="true"
          className="te-loud-crisis mb-2 h-1 bg-amber-500/60"
          data-testid="pack-tear"
        />
      )}
      <h3
        id={`${testId}-heading`}
        className="text-xs font-bold uppercase tracking-wider text-zinc-200"
      >
        {title}
        <span className="ml-2 font-normal normal-case text-zinc-400">
          {picksLeft > 0 ? `Keep ${picksLeft} more.` : "Done."}
        </span>
      </h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((card, i) => {
          const unavailable = card.picked || card.refusal !== null;
          const describedBy = card.refusal ? `${card.id}-refusal` : undefined;
          return (
            <li key={card.id} className="min-w-0">
              <button
                ref={i === 0 ? firstRef : undefined}
                type="button"
                aria-disabled={unavailable || picksLeft === 0}
                aria-pressed={card.picked}
                aria-describedby={describedBy}
                onClick={() => {
                  if (unavailable || picksLeft === 0) {
                    // The domain refuses with an announced reason.
                    if (!card.picked) onPick(card.id);
                    return;
                  }
                  choose(card);
                }}
                className="block min-h-[9rem] w-full min-w-0 touch-manipulation text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] aria-disabled:cursor-not-allowed"
                data-testid={cardTestId}
              >
                <CardFlip
                  faceUp
                  dealt
                  animate={animate}
                  delay={animate ? 0.15 + i * 0.2 : 0}
                  back={
                    <CardBack
                      card={{ slot: `pack-${i}`, faceDown: true }}
                      className="h-full min-h-[9rem] w-full"
                    />
                  }
                  front={
                    <span
                      className={`flex h-full min-h-[9rem] flex-col gap-1 border bg-[color:var(--te-surface-1)] p-3 text-xs ${
                        card.picked
                          ? "border-emerald-400 bg-emerald-500/10"
                          : (KIND_ACCENT[card.kind] ?? "border-zinc-600")
                      } ${unavailable && !card.picked ? "opacity-60" : ""}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {card.picked ? `Kept · ${card.kind}` : card.kind}
                      </span>
                      <span className="font-bold text-zinc-100 break-words">
                        {card.name}
                      </span>
                      <span className="text-zinc-400 break-words">
                        {card.description}
                      </span>
                      {card.warning && (
                        <span className="text-sky-300 break-words">
                          {card.warning}
                        </span>
                      )}
                    </span>
                  }
                />
              </button>
              {card.refusal && !card.picked && (
                <p
                  id={`${card.id}-refusal`}
                  className="mt-1 text-[11px] text-rose-300 break-words"
                >
                  {card.refusal}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {pending && (
        <div
          role="group"
          aria-label={`Confirm ${pending.name}`}
          className="mt-3 border border-sky-500/60 p-3 text-xs text-zinc-200"
          data-testid="pack-confirm"
        >
          <p className="break-words">{pending.warning}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              ref={confirmRef}
              type="button"
              onClick={() => {
                setConfirming(null);
                onPick(pending.id);
              }}
              className="min-h-[44px] border border-sky-500 px-3 font-bold uppercase text-sky-300 touch-manipulation hover:bg-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            >
              Activate {pending.name}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                firstRef.current?.focus();
              }}
              className="min-h-[44px] border border-zinc-600 px-3 font-bold uppercase text-zinc-300 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {onSkip && picksLeft > 0 && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 min-h-[44px] border border-zinc-600 px-3 text-xs font-bold uppercase text-zinc-300 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          data-testid="pack-skip"
        >
          Skip the rest
        </button>
      )}
    </section>
  );
}
