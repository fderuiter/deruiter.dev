import type { Scenario, ShopEntry, TableShellSpec, TlfCard } from "../types";

/**
 * The run deck (#2082): the player's shell library, carried from Blind to
 * Blind and act to act. Each Blind still authors the outputs its study
 * produces; the run deck layers the player's choices over every deal:
 * shells bought in the shop, copies made by the Duplicate service, and
 * cards taken out by the Archive service. Pure: the same deck and the same
 * Blind always deal the same cards, and the seeded shuffle (#2055) orders
 * them.
 */

/** A shop entry that sells a shell. */
export type ShellEntry = Extract<ShopEntry, { kind: "SHELL" }>;

/** One card the run added to its deck. */
export type RunDeckCard =
  /** A bought shell, or a copy of one: dealt by every later Blind. */
  | { id: string; kind: "SHELL"; entry: ShellEntry }
  /**
   * A copy of an authored output: dealt by every later Blind whose own deck
   * holds `cardId`, beside the original.
   */
  | { id: string; kind: "COPY"; cardId: string };

/** The player's changes to the decks the run deals. */
export interface RunDeck {
  /** Cards the run added, in the order they were added. */
  added: RunDeckCard[];
  /** Authored card ids archived: no later Blind deals them. */
  archived: string[];
}

/**
 * Whether a run keeps a run deck. AUTHORED is a run saved before #2082:
 * every Blind deals its authored deck and the shop stocks no shells.
 */
export type DeckLibrary = "RUN" | "AUTHORED";

/** A deck with no changes: every Blind deals its authored deck. */
export const EMPTY_RUN_DECK: RunDeck = Object.freeze({
  added: [],
  archived: [],
}) as RunDeck;

/** What the Archive service costs, before any stake surcharge, in $k. */
export const ARCHIVE_PRICE = 3;

/** What the Duplicate service costs, before any stake surcharge, in $k. */
export const DUPLICATE_PRICE = 5;

/** The card a shell entry deals as, under `id`. */
export function shellCard(entry: ShellEntry, id: string): TlfCard {
  const { shell, card } = entry;
  return {
    id,
    cardType: "TABLE",
    number: shell.tableNumber,
    title: card.title,
    population: shell.targetPopulation,
    chips: shell.chips,
    mult: shell.mult,
    topic: card.topic,
    ...(card.csrStage && { csrStage: card.csrStage }),
    ...(card.soc && { soc: card.soc }),
    shellId: shell.id,
  };
}

/**
 * Cards a Blind always deals whatever the run deck says: its pinned
 * scripted setup (ADR 0046), the Tables its Kaplan–Meier figures are drawn
 * from, and the outputs its encounter asks for.
 */
export function protectedCardIds(scenario: Scenario): Set<string> {
  const ids = new Set(scenario.pinned ?? []);
  for (const card of scenario.deck) {
    if (card.km) ids.add(card.km.parent.cardId);
  }
  if (scenario.encounter?.kind === "FDA_IR") {
    for (const question of scenario.encounter.questions) {
      ids.add(question.cardId);
    }
  }
  return ids;
}

/** Whether a deck changes nothing. */
export function isEmptyDeck(deck: RunDeck | undefined): boolean {
  return !deck || (deck.added.length === 0 && deck.archived.length === 0);
}

/**
 * The cards a Blind deals under a run deck: its authored deck without the
 * archived cards it does not protect, then the run's added cards. A copy is
 * dealt only by a Blind whose own deck holds its original. Archiving never
 * leaves a Blind short of a full opening hand: if it would, the earliest
 * archived cards come back, in deck order, until the hand fills.
 * `bonusChips` is what the run's sponsor adds to a shell's Chips.
 */
export function dealtDeck(
  scenario: Scenario,
  deck: RunDeck,
  bonusChips: (card: TlfCard) => number = () => 0
): TlfCard[] {
  const archived = new Set(deck.archived);
  const kept = protectedCardIds(scenario);
  const byId = new Map(scenario.deck.map((card) => [card.id, card]));
  const added = deck.added.flatMap((item): TlfCard[] => {
    if (item.kind === "SHELL") {
      const card = shellCard(item.entry, item.id);
      const chips = bonusChips(card);
      return [chips === 0 ? card : { ...card, chips: card.chips + chips }];
    }
    const original = byId.get(item.cardId);
    return original ? [{ ...original, id: item.id }] : [];
  });
  const removable = scenario.deck.filter(
    (card) => archived.has(card.id) && !kept.has(card.id)
  );
  const short = Math.max(
    0,
    scenario.table.handSize -
      (scenario.deck.length - removable.length + added.length)
  );
  const back = new Set(removable.slice(0, short).map((card) => card.id));
  const authored = scenario.deck.filter(
    (card) => !archived.has(card.id) || kept.has(card.id) || back.has(card.id)
  );
  return [...authored, ...added];
}

/**
 * A Blind as the run deals it: its deck under the run deck, and the shells
 * of any bought cards beside its own. A deck that changes nothing gives the
 * Blind back unchanged, so a run without changes deals exactly as before.
 */
export function dealtScenario(
  scenario: Scenario,
  deck: RunDeck | undefined,
  bonusChips?: (card: TlfCard) => number
): Scenario {
  if (!deck || isEmptyDeck(deck)) return scenario;
  const shells = new Map<string, TableShellSpec>(
    scenario.shells.map((shell) => [shell.id, shell])
  );
  for (const item of deck.added) {
    if (item.kind === "SHELL" && !shells.has(item.entry.shell.id)) {
      shells.set(item.entry.shell.id, item.entry.shell);
    }
  }
  return {
    ...scenario,
    shells: [...shells.values()],
    deck: dealtDeck(scenario, deck, bonusChips),
  };
}

/** Where a card in the dealt deck came from. */
export type RunDeckOrigin = "AUTHORED" | "BOUGHT" | "COPY";

/** One card of the run deck as the deck view lists it. */
export interface RunDeckCardView {
  id: string;
  number: string;
  title: string;
  cardType: TlfCard["cardType"];
  population: TlfCard["population"];
  chips: number;
  origin: RunDeckOrigin;
  /** The Blind's scripted setup or encounter: it cannot be archived. */
  locked: boolean;
}

/** The card list a deck view shows, with where each card came from. */
export function deckCardViews(
  scenario: Scenario,
  deck: RunDeck | undefined,
  bonusChips?: (card: TlfCard) => number
): RunDeckCardView[] {
  const dealt = dealtScenario(scenario, deck, bonusChips);
  const kept = protectedCardIds(scenario);
  const origins = new Map<string, RunDeckOrigin>(
    (deck?.added ?? []).map((item) => [
      item.id,
      item.kind === "SHELL" ? "BOUGHT" : "COPY",
    ])
  );
  return dealt.deck.map((card) => ({
    id: card.id,
    number: card.number,
    title: card.title,
    cardType: card.cardType,
    population: card.population,
    chips: card.chips,
    origin: origins.get(card.id) ?? "AUTHORED",
    locked: kept.has(card.id),
  }));
}

/** The deck with `cardId` archived: an added card leaves, an authored one is listed. */
export function archiveCard(deck: RunDeck, cardId: string): RunDeck {
  if (deck.added.some((item) => item.id === cardId)) {
    return {
      ...deck,
      added: deck.added.filter((item) => item.id !== cardId),
    };
  }
  return { ...deck, archived: [...deck.archived, cardId] };
}

/**
 * The deck with a copy of `cardId` added under `id`. A copy of a shell is
 * another shell; a copy of a copy copies the same original.
 */
export function duplicateCard(
  deck: RunDeck,
  cardId: string,
  id: string
): RunDeck {
  const source = deck.added.find((item) => item.id === cardId);
  const copy: RunDeckCard = source
    ? { ...source, id }
    : { id, kind: "COPY", cardId };
  return { ...deck, added: [...deck.added, copy] };
}

/** The deck with a bought shell added under `id`. */
export function addShell(
  deck: RunDeck,
  entry: ShellEntry,
  id: string
): RunDeck {
  return { ...deck, added: [...deck.added, { id, kind: "SHELL", entry }] };
}
