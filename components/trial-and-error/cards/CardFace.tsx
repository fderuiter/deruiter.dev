import React from "react";
import type {
  CardFace as CardFaceData,
  PopulationType,
  TableCardView,
} from "@/lib/trial-and-error";
import {
  MiniFigure,
  describePlot,
} from "@/components/trial-and-error/cards/MiniFigure";
import { MiniTable } from "@/components/trial-and-error/cards/MiniTable";
import { StampSlot } from "@/components/trial-and-error/cards/Stamp";
import { LOUD_PRESETS } from "@/components/trial-and-error/LoudLayer";

export const POPULATION_LABEL: Record<PopulationType, string> = {
  ITT: "ITT",
  SAFETY: "Safety",
  PER_PROTOCOL: "PP",
  FAS: "FAS",
  SCREENED: "Screened",
};

export const SUIT_TEXT: Record<PopulationType, string> = {
  ITT: "text-[color:var(--te-suit-itt)]",
  SAFETY: "text-[color:var(--te-suit-safety)]",
  PER_PROTOCOL: "text-[color:var(--te-suit-pp)]",
  FAS: "text-[color:var(--te-suit-fas)]",
  SCREENED: "text-[color:var(--te-suit-screened)]",
};

/** Each suit's left edge on a card, in its population colour. */
export const SUIT_BORDER: Record<PopulationType, string> = {
  ITT: "border-l-[color:var(--te-suit-itt)]",
  SAFETY: "border-l-[color:var(--te-suit-safety)]",
  PER_PROTOCOL: "border-l-[color:var(--te-suit-pp)]",
  FAS: "border-l-[color:var(--te-suit-fas)]",
  SCREENED: "border-l-[color:var(--te-suit-screened)]",
};

/**
 * In the hand a card's right edge sits under its neighbour. Its number and
 * title wrap inside the part still showing (`--te-covered`, set by the hand
 * card), so every title stays readable in a tight fan (#1524). Elsewhere the
 * variable is unset and the text uses the full face.
 */
const UNCOVERED = { maxWidth: "calc(100% - var(--te-covered, 0rem))" };

/** The live mini-output: a miniature of the card's actual data. */
export function MiniOutput({
  face,
  size,
  caption,
}: {
  face: CardFaceData;
  size: "card" | "detail";
  caption?: string;
}) {
  switch (face.kind) {
    case "TABLE":
    case "LISTING":
      return <MiniTable face={face} size={size} caption={caption} />;
    case "FIGURE":
      return (
        <MiniFigure
          plot={face.plot}
          size={size}
          label={size === "detail" ? describePlot(face.plot) : undefined}
        />
      );
    case "TOKEN":
      return (
        <span
          data-face-kind="TOKEN"
          className={`inline-flex items-center gap-1 rounded-full border border-zinc-600 px-2 py-0.5 tabular-nums ${size === "detail" ? "text-sm" : "text-[10px]"}`}
        >
          {face.cohort} · N={face.count}
        </span>
      );
  }
}

/**
 * The seal slot: one wax-stamp badge per footnote seal affixed to the
 * output. It presses on with a small loud flash when the cabinet allows it.
 */
function SealSlot({ view }: { view: TableCardView }) {
  if (view.seals.length === 0) return null;
  return (
    <span className="pointer-events-none absolute right-0 top-5 flex flex-col gap-0.5">
      {view.seals.map((seal, i) => (
        <span
          key={`${seal.id}-${i}`}
          data-testid="seal-badge"
          data-seal={seal.id}
          title={seal.name}
          className={`${LOUD_PRESETS.sealPress} flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-950 text-[9px] font-bold text-amber-200`}
        >
          FN
        </span>
      ))}
    </span>
  );
}

/**
 * A card's face, printed from its data: type, suit (in colour and in text),
 * number, title, the live mini-output, the Chips badge (struck to 0 when a
 * Boss Blind disables the card's suit or the card is stale), the unverified
 * "?" badge, the seal slot and the stamp slot. A blank shell prints its
 * empty skeleton and the analysis sets it accepts instead of a suit.
 * Decorative inside the card button, whose accessible name carries the same
 * facts.
 */
export function CardFace({ view }: { view: TableCardView }) {
  const { card } = view;
  const dim = view.stale ? " te-stale-dim" : "";
  return (
    <span aria-hidden="true" className="relative flex h-full flex-col gap-1">
      <span
        className={`flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-zinc-400${dim}`}
        style={UNCOVERED}
      >
        <span className="flex items-center gap-1">
          {card.cardType === "SUBJECT_TOKEN" ? "Token" : card.cardType}
          {view.unverified && (
            <span
              className="border border-amber-400 px-1 font-bold text-amber-300"
              data-testid="unverified-badge"
            >
              ?
            </span>
          )}
          {view.blank && (
            <span
              className="border border-dashed border-zinc-400 px-1 font-bold text-zinc-200"
              data-testid="shell-badge"
            >
              Shell
            </span>
          )}
        </span>
        {view.blank ? (
          <span className="text-zinc-300">
            {view.compatiblePopulations
              .map((p) => POPULATION_LABEL[p])
              .join(" / ")}
          </span>
        ) : (
          <span className={SUIT_TEXT[card.population]}>
            {POPULATION_LABEL[card.population]}
          </span>
        )}
      </span>
      <span
        className={`block font-bold leading-tight break-words${dim}`}
        style={UNCOVERED}
      >
        {card.number}
      </span>
      <span
        className={`block truncate text-[10px] text-zinc-300${dim}`}
        style={UNCOVERED}
      >
        {card.title}
      </span>
      <span
        className={`flex h-[4.75rem] min-w-0 items-start overflow-hidden border ${view.blank ? "border-dashed border-zinc-600 opacity-70" : "border-zinc-800"} bg-[color:var(--te-surface-0)] p-0.5${dim}`}
      >
        <MiniOutput face={view.face} size="card" />
      </span>
      {view.figure && (
        <span
          className="flex items-center justify-between gap-1 text-[10px]"
          style={UNCOVERED}
          data-testid="figure-dependency"
        >
          <span className="truncate text-zinc-400">← {view.figure.parent}</span>
          <span
            data-testid="figure-xmult"
            data-active={view.figure.active ? "" : undefined}
            title={view.figure.reason ?? undefined}
            className={`border px-1 tabular-nums ${
              view.figure.active
                ? "border-[color:var(--te-x-mult)]/60 text-[color:var(--te-x-mult)]"
                : "border-zinc-700 text-zinc-400 line-through"
            }`}
          >
            ×{view.figure.xMult}
          </span>
        </span>
      )}
      <span
        className="mt-auto flex flex-wrap items-center justify-between gap-x-1 text-[10px]"
        style={UNCOVERED}
      >
        {view.debuffed || view.stale ? (
          <span
            className="border border-rose-400/60 px-1 tabular-nums text-rose-300"
            data-testid={view.stale ? "stale-badge" : "debuff-badge"}
          >
            <s>{card.chips}</s> → 0 Chips
          </span>
        ) : (
          <span className="border border-[color:var(--te-chips)]/60 px-1 tabular-nums text-[color:var(--te-chips)]">
            {card.chips} Chips
          </span>
        )}
        {view.blank && <span className="text-zinc-400">Allocate [A]</span>}
        {view.inspected && (
          <span
            className={
              view.openRedlines > 0 ? "text-rose-300" : "text-emerald-300"
            }
          >
            {view.openRedlines > 0
              ? `${view.openRedlines} redline${view.openRedlines === 1 ? "" : "s"}`
              : "Inspected"}
          </span>
        )}
      </span>
      <SealSlot view={view} />
      <StampSlot stamps={view.stamps} />
    </span>
  );
}
