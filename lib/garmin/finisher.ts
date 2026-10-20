/**
 * The Finisher Card match for Monkey C Mayhem (#1996).
 *
 * - A stage's finish pole carries a Finisher Card that cycles Shoe, Bottle
 *   and Medal on the run clock. The card showing on the frame the runner grabs
 *   the pole is the one collected, so the same grab on the same clock always
 *   collects the same card.
 * - Three collected cards pay out: three of a kind earn a badge and 2, 3 or 5
 *   lives (Shoe, Bottle, Medal), and three mixed cards give 1 life. The three
 *   then clear for the next set.
 * - A Training Run collects cards for that run. A Training Plan keeps them
 *   between workouts. Race Mode, Race Day and practice runs leave the cards
 *   alone, so every race board stays fair.
 *
 * The engine never sees the cards: {@link stepFinisherCard} runs after each
 * engine step, which keeps the standalone engine bundle unchanged. A run
 * collects only when it starts with `finisherCards` set to an array.
 */

import { POLE_HEIGHT, PX_PER_METER } from "./course";
import {
  GROUND_Y,
  PLAYER_X,
  type FinisherCard,
  type GameEngineState,
} from "./engine";
import { addLives } from "./powerups";

export type { FinisherCard };

/** The cards, in the order the pole cycles them. */
export const FINISHER_CARDS: readonly FinisherCard[] = [
  "shoe",
  "bottle",
  "medal",
];

/** Each card's name, as the HUD and the screen reader say it. */
export const FINISHER_CARD_NAMES: Readonly<Record<FinisherCard, string>> = {
  shoe: "Shoe",
  bottle: "Bottle",
  medal: "Medal",
};

/** How long each card shows on the pole before the next, in ms. */
export const CARD_CYCLE_MS = 400;

/** Cards to a set: this many collected pay out. */
export const CARDS_PER_SET = 3;

/** Lives three of a kind earn, by card. */
export const MATCH_LIVES: Readonly<Record<FinisherCard, number>> = {
  shoe: 2,
  bottle: 3,
  medal: 5,
};

/** Lives three mixed cards give. */
export const MIXED_LIVES = 1;

/** The card a pole shows at run clock `clockMs`. */
export function cardAt(clockMs: number | undefined): FinisherCard {
  const ms = Number.isFinite(clockMs) ? Math.max(0, clockMs ?? 0) : 0;
  return FINISHER_CARDS[Math.floor(ms / CARD_CYCLE_MS) % FINISHER_CARDS.length];
}

/** What a full set of three pays. */
export interface CardPayout {
  /** Lives earned. */
  lives: number;
  /** The card all three share, or null for a mixed set. */
  match: FinisherCard | null;
}

/** What a set of three cards pays: a match by its card, a mixed set 1 life. */
export function cardPayout(set: readonly FinisherCard[]): CardPayout {
  // A set short of three pays nothing yet.
  if (set.length < CARDS_PER_SET) return { lives: 0, match: null };
  const first = set[0];
  const match =
    set.length === CARDS_PER_SET && set.every((c) => c === first)
      ? first
      : null;
  return match
    ? { lives: MATCH_LIVES[match], match }
    : { lives: MIXED_LIVES, match: null };
}

/** The cards after collecting one, and what a completed set paid. */
export interface CardCollect {
  /** The cards held after this one: fewer than three. */
  cards: FinisherCard[];
  /** The completed set's payout, or null while the set is still filling. */
  payout: CardPayout | null;
  /** The completed set, empty while it is still filling. */
  set: FinisherCard[];
}

/** Adds `card` to the held cards; a third card pays the set out and clears it. */
export function collectCard(
  held: readonly FinisherCard[],
  card: FinisherCard
): CardCollect {
  const cards = [...held.slice(-(CARDS_PER_SET - 1)), card];
  if (cards.length < CARDS_PER_SET) return { cards, payout: null, set: [] };
  return { cards: [], payout: cardPayout(cards), set: cards };
}

/** `raw` read back as held cards: known cards only, fewer than a full set. */
export function cardsOf(raw: unknown): FinisherCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is FinisherCard =>
      (FINISHER_CARDS as readonly unknown[]).includes(c)
    )
    .slice(-(CARDS_PER_SET - 1));
}

/** The badge banner for a payout, e.g. "BADGE EARNED · 3 MEDALS · +5 LIVES". */
export function payoutBanner(payout: CardPayout): string {
  const lives = `+${payout.lives} ${payout.lives === 1 ? "LIFE" : "LIVES"}`;
  return payout.match
    ? `BADGE EARNED · 3 ${FINISHER_CARD_NAMES[payout.match].toUpperCase()}S · ${lives}`
    : `FINISHER CARDS · ${lives}`;
}

/** Whether a banner is a set's payout, which the card's announcement already says. */
export function isPayoutBanner(text: string | null | undefined): boolean {
  return (
    typeof text === "string" &&
    (text.startsWith("BADGE EARNED · ") || text.startsWith("FINISHER CARDS · "))
  );
}

/** What a screen reader hears about a card just collected, and what its set paid. */
export function cardNews(card: FinisherCard, result: CardCollect): string {
  const name = FINISHER_CARD_NAMES[card];
  if (result.payout) {
    const { lives, match } = result.payout;
    const life = `${lives} ${lives === 1 ? "life" : "lives"}`;
    return match
      ? `Finisher card: ${name}. Three ${name}s, badge earned: plus ${life}.`
      : `Finisher card: ${name}. Three mixed cards: plus ${life}.`;
  }
  const held = result.cards.map((c) => FINISHER_CARD_NAMES[c]).join(", ");
  return `Finisher card: ${name}. Cards held: ${held}.`;
}

/**
 * A stage's finish pole has just been grabbed: the auto lap adds a split on
 * that tick, at a stage pole and a secret exit's pole alike.
 */
function grabbedPole(prev: GameEngineState, next: GameEngineState): boolean {
  return (next.lapSplits?.length ?? 0) > (prev.lapSplits?.length ?? 0);
}

/**
 * The Finisher Card at work after each engine step: the card the pole showed
 * on the last frame drawn is collected, and a third card pays out its lives
 * with a badge banner. Does nothing unless the run collects cards.
 *
 * `shownClockMs` is the run clock of the face last drawn, which can be a few
 * fixed steps behind `prev` when one display frame runs several steps.
 */
export function stepFinisherCard(
  prev: GameEngineState,
  shownClockMs: number | undefined,
  next: GameEngineState
): GameEngineState {
  const held = next.finisherCards;
  if (!Array.isArray(held) || !grabbedPole(prev, next)) return next;
  const card = cardAt(shownClockMs);
  const result = collectCard(held, card);
  const x = next.distanceMeters * PX_PER_METER + PLAYER_X;
  const popups = [
    ...(next.popups ?? []),
    {
      x,
      y: GROUND_Y - POLE_HEIGHT - 22,
      text: `CARD: ${FINISHER_CARD_NAMES[card].toUpperCase()}`,
      ttlMs: 1600,
    },
  ];
  // A badge takes the banner, so the banner the grab set (a lap or a secret
  // exit) moves to a popup, as a secret exit's lap does.
  const replaced = next.banner !== prev.banner ? next.banner?.text : undefined;
  if (result.payout && replaced) {
    popups.push({
      x,
      y: GROUND_Y - POLE_HEIGHT - 36,
      text: replaced,
      ttlMs: 1600,
    });
  }
  const state: GameEngineState = {
    ...next,
    finisherCards: result.cards,
    finisherNews: cardNews(card, result),
    popups,
  };
  if (!result.payout) return state;
  return {
    ...state,
    lives: addLives(next.lives, result.payout.lives),
    banner: { text: payoutBanner(result.payout), ttlMs: 2400, tone: "good" },
  };
}
