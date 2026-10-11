/**
 * The receipt for For Better or Bulk: a story artifact that explains itself.
 *
 * Each readiness line is built from a list of conditions with their
 * evidence (who made and placed what), and the explanation is generated from
 * that list rather than written per case. Nothing here grades the wedding.
 */

import {
  ACTUAL_NOTE_IDS,
  WEDDING_PATH,
  BUDGET,
  bankText,
  CAPABILITIES,
  CATEGORY_LABELS,
  CHAIR_COUNT,
  COMMITMENT_CATEGORIES,
  FIXED_COSTS,
  FOOD_PRICES,
  INTERRUPTIONS,
  LANTERN_PRICE,
  LEFT_LINE,
  RECEIPT_COPY,
  ASSIST_LINE,
  ROSE_BUNCHES,
  ROSE_PRICES,
} from "../presets";
import type {
  CapabilityId,
  Category,
  CategoryProgress,
  Commitment,
  Condition,
  FoodTier,
  GameState,
  PlayerId,
  ActualNote,
  ReadinessLine,
  Receipt,
  RoseTier,
  RunTitle,
  SpendingLine,
  Target,
  WebsiteLine,
} from "../types";
import { clockLabel } from "./views";
import { countStars, evaluateChallenges } from "./challenges";

const ROSE_TIER_LABELS: Readonly<Record<RoseTier, string>> = {
  modest: "Modest",
  full: "Full",
  yes: '"Yes"',
};

const FOOD_TIER_LABELS: Readonly<Record<FoodTier, string>> = {
  enough: "Enough",
  lots: "Lots",
  "feed-rochester": "Feed Rochester",
};

const NAMES: Readonly<Record<PlayerId, string>> = {
  fred: "Fred",
  abbi: "Abbi",
};

const CATEGORIES: readonly Category[] = [
  "bouquets",
  "centerpieces",
  "petals",
  "chairs",
  "lanterns",
  "buffet",
];

/** "Abbi 3, Fred 1", or "nobody" for an empty list. */
export function tally(people: readonly (PlayerId | null)[]): string {
  const counts = new Map<string, number>();
  for (const person of people) {
    const name = person ? NAMES[person] : "the car";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return "nobody";
  return [...counts.entries()].map(([name, n]) => `${name}: ${n}`).join(", ");
}

/** Each name with its count, in the order names first appear. */
function countsByName(
  people: readonly (PlayerId | null)[]
): [string, number][] {
  const counts = new Map<string, number>();
  for (const person of people) {
    const name = person ? NAMES[person] : "the car";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()];
}

/** "made by Abbi 3, Fred 1" wording, with no colon so it can follow a label's colon. */
function madeBy(people: readonly (PlayerId | null)[]): string {
  const counts = countsByName(people);
  if (counts.length === 0) return "nobody";
  return `made by ${counts.map(([name, n]) => `${name} ${n}`).join(", ")}`;
}

/** One item placed on a target: who placed it, and whether the solo helper did. */
interface Placement {
  readonly by: PlayerId;
  readonly helper: boolean;
}

/**
 * "Fred carried 2 items", or "Abbi carried 1 item, Fred (helper) carried 1
 * item". Helper placements are named apart, so helper work is never read as
 * the player's own.
 */
function carried(placements: readonly Placement[]): string {
  const counts = new Map<string, number>();
  for (const { by, helper } of placements) {
    const name = helper ? `${NAMES[by]} (helper)` : NAMES[by];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return "nobody carried anything";
  return [...counts.entries()]
    .map(([name, n]) => `${name} carried ${n} ${n === 1 ? "item" : "items"}`)
    .join(", ");
}

function placementsOf(target: Target): Placement[] {
  return target.filledBy.map((by, i) => ({
    by,
    helper: target.filledByHelper[i] === true,
  }));
}

/**
 * How far a category is, counted in items. A target takes as many items as its
 * capacity, so the basket is two items rather than one target, and a half-filled
 * target shows its items placed. Simplified targets leave the plan. Null when
 * the cart plans nothing in the category.
 */
export function categoryProgress(
  state: GameState,
  category: Category
): CategoryProgress | null {
  const planned = state.targets.filter(
    (t) => t.category === category && t.status !== "unplanned"
  );
  if (planned.length === 0) return null;
  const counted = planned.filter((t) => t.status !== "simplified");
  return {
    placed: counted.reduce(
      (n, t) => n + Math.min(t.filled.length, t.capacity),
      0
    ),
    planned: counted.reduce((n, t) => n + t.capacity, 0),
    multi: counted.some((t) => t.capacity > 1),
  };
}

/**
 * The promises a break can carry in this plan: a commitment with at least one
 * category in the plan that is not yet all placed. A category already complete
 * is left out, so a promise cannot be kept for free (round 8, S6). The brothers'
 * dialog offers exactly these, and `validateDecision` refuses any other.
 */
export function availableCommitments(state: GameState): Commitment[] {
  return (Object.keys(COMMITMENT_CATEGORIES) as Commitment[]).filter(
    (commitment) =>
      COMMITMENT_CATEGORIES[commitment].some((category) => {
        const progress = categoryProgress(state, category);
        return progress !== null && progress.placed < progress.planned;
      })
  );
}

function sourceCondition(state: GameState, category: Category): Condition {
  const cart = state.setup.cart;
  switch (category) {
    case "bouquets":
    case "centerpieces":
    case "petals":
      return {
        label: "Roses bought",
        met: true,
        detail: `${ROSE_TIER_LABELS[cart.roses]}, ${ROSE_BUNCHES[cart.roses]} bunches`,
      };
    case "lanterns":
      return {
        label: "Lanterns bought",
        met: cart.lanterns,
        detail: cart.lanterns ? "4 in the pack" : "not in the cart",
      };
    case "buffet":
      return {
        label: "Food bought",
        met: true,
        detail: `${FOOD_TIER_LABELS[cart.food]}, drinks and sheet cake included`,
      };
    case "chairs":
      return {
        label: "Chairs from the shed",
        met: true,
        detail: `${CHAIR_COUNT} chairs`,
      };
  }
}

function madeCondition(
  category: Category,
  targets: readonly Target[]
): Condition | null {
  const items = targets.flatMap((t) => t.filled);
  if (category === "bouquets" || category === "centerpieces") {
    return {
      label: "Arranged at the rose table",
      met: true,
      detail: madeBy(items.map((i) => i.madeBy)),
    };
  }
  if (category === "petals") {
    return {
      label: "Plucked at the petal bucket",
      met: true,
      detail: madeBy(items.map((i) => i.madeBy)),
    };
  }
  if (category === "buffet") {
    const grilled = items.filter(
      (i) => i.kind === "hotdogs" || i.kind === "wings"
    );
    return {
      label: "Grilled",
      met: true,
      detail:
        grilled.length > 0
          ? madeBy(grilled.map((i) => i.madeBy))
          : "nothing yet",
    };
  }
  return null;
}

function readinessLine(state: GameState, category: Category): ReadinessLine {
  const label = CATEGORY_LABELS[category];
  const progress = categoryProgress(state, category);
  if (!progress) {
    return {
      category,
      label,
      status: "unplanned",
      placed: 0,
      planned: 0,
      conditions: [],
      explanation: "Not in this plan.",
    };
  }
  const planned = state.targets.filter(
    (t) => t.category === category && t.status !== "unplanned"
  );
  const simplified = planned.filter((t) => t.status === "simplified").length;
  const open = planned.filter((t) => t.status === "open").length;
  const conditions: Condition[] = [sourceCondition(state, category)];
  const made = madeCondition(category, planned);
  if (made) conditions.push(made);
  conditions.push({
    label: `Placed ${progress.placed} of ${progress.planned}${progress.multi ? " items" : ""}`,
    met: open === 0,
    detail: carried(planned.flatMap(placementsOf)),
  });
  const status =
    open > 0 ? "unfinished" : simplified > 0 ? "simplified" : "ready";
  let explanation: string;
  if (status === "unfinished") {
    const unit = progress.multi ? "items placed" : "done";
    explanation = `Only ${progress.placed} of ${progress.planned} ${unit} at 4:00.`;
  } else {
    explanation = conditions.map((c) => `${c.label}: ${c.detail}`).join("; ");
    if (simplified > 0) explanation += `; ${simplified} simplified by choice`;
  }
  return {
    category,
    label,
    status,
    placed: progress.placed,
    planned: progress.planned,
    conditions,
    explanation,
  };
}

/** Readiness for every category, in display order. */
export function readinessLines(state: GameState): readonly ReadinessLine[] {
  return CATEGORIES.map((category) => readinessLine(state, category));
}

function spending(state: GameState): Receipt["spending"] {
  const cart = state.setup.cart;
  const lines: SpendingLine[] = FIXED_COSTS.map((cost) => ({ ...cost }));
  lines.push({
    id: "roses",
    label: `Kirkland roses (${ROSE_TIER_LABELS[cart.roses]})`,
    dollars: ROSE_PRICES[cart.roses],
  });
  lines.push({
    id: "food",
    label: `Food, ${FOOD_TIER_LABELS[cart.food]} (drinks and sheet cake included)`,
    dollars: FOOD_PRICES[cart.food],
  });
  if (cart.lanterns)
    lines.push({
      id: "lanterns",
      label: "Paper lanterns",
      dollars: LANTERN_PRICE,
    });
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.dollars, 0),
    budget: BUDGET,
  };
}

function followThrough(
  state: GameState,
  lines: readonly ReadinessLine[]
): Receipt["followThrough"] {
  const presence = state.presence;
  if (!presence)
    return {
      status: "kept",
      explanation: "Kept. The brothers never got the chance to text.",
    };
  if (presence.choice === "stay")
    return { status: "kept", explanation: "Kept. Fred stayed for the setup." };
  if (presence.choice === "leave")
    return { status: "missed", explanation: `Missed. ${LEFT_LINE}` };
  const promise = presence.commitment ?? "chairs";
  const covered = COMMITMENT_CATEGORIES[promise];
  const done = lines
    .filter((l) => covered.includes(l.category))
    .every((l) => l.status !== "unfinished");
  return done
    ? {
        status: "kept",
        explanation: `Kept. Fred took a short break, promised to come back for the ${promise}, and the ${promise} got done.`,
      }
    : {
        status: "missed",
        explanation: `Missed. Fred promised to come back for the ${promise}, and they weren't done by 4:00.`,
      };
}

function websiteLines(state: GameState): readonly WebsiteLine[] {
  return (Object.keys(CAPABILITIES) as CapabilityId[]).map((capability) => {
    const label = CAPABILITIES[capability].label;
    const chosen = state.setup.capabilities.includes(capability);
    const calls = state.interruptions.filter((record) =>
      INTERRUPTIONS.some(
        (def) => def.id === record.id && def.blockedBy === capability
      )
    );
    let text: string;
    if (capability === "intro3d") {
      text = chosen
        ? `${label}: blocked nothing. Is it loading?`
        : `${label}: not built.`;
    } else if (chosen) {
      text = `${label}: blocked ${calls.length} call${calls.length === 1 ? "" : "s"}.`;
    } else {
      text = `${label}: ${calls.length} call${calls.length === 1 ? "" : "s"} got through without it.`;
    }
    return { capability, chosen, text };
  });
}

function signatureMoment(lines: readonly ReadinessLine[]): string {
  const ready = (category: Category) =>
    lines.find((l) => l.category === category)?.status === "ready";
  // Chairs are the tables and buffet is the food. Only a finished category
  // (ready, or simplified by choice) may back the tables-and-food line.
  const finished = (category: Category) => {
    const status = lines.find((l) => l.category === category)?.status;
    return status === "ready" || status === "simplified";
  };
  if (ready("petals")) return "Rose petals down the aisle";
  if (ready("centerpieces") && ready("lanterns"))
    return "Lanterns at dusk over the centerpieces";
  if (ready("lanterns")) return "Lanterns at dusk over the patio";
  if (ready("centerpieces")) return "Centerpieces on every table";
  if (ready("bouquets")) return "The gardens did the decorating";
  if (finished("chairs") && finished("buffet")) {
    return bankText("signature-tables-food");
  }
  return bankText("signature-neutral");
}

function title(
  state: GameState,
  lines: readonly ReadinessLine[],
  kept: boolean
): RunTitle {
  const finished = !lines.some((l) => l.status === "unfinished");
  const { capabilities, cart } = state.setup;
  if (finished && kept) {
    if (
      cart.roses === "yes" &&
      lines.every((l) => l.status === "ready" || l.status === "unplanned")
    ) {
      return "Bulk Romantic";
    }
    if (capabilities.includes("admin") && capabilities.includes("registry")) {
      return "171 Commits and a Ceremony";
    }
    if (cart.roses === "modest") return "The Gardens Did the Decorating";
    return "Operationally Married";
  }
  if (capabilities.includes("intro3d")) return "Is It Loading?";
  if (finished) return "Operational, Not Present";
  return "Married Anyway";
}

/**
 * The receipt's weather line. A shower day never reads as perfect weather: the
 * real weather stays in the notes at the bottom, and the shower is game weather.
 */
function weatherLine(state: GameState): string {
  const shower = state.seeded.find((event) => event.id === "shower");
  if (!shower) return bankText("weather");
  if (state.time < shower.at) {
    return "The game's shower was due after the work was done. The real weather is in the notes at the bottom.";
  }
  return "The game had a shower. The real weather is in the notes at the bottom.";
}

/**
 * The game's own weather, labelled as game weather. Null on a standard day.
 * A shower the work finished before says so, rather than pretending it came.
 */
function gameWeather(state: GameState): string | null {
  const shower = state.seeded.find((event) => event.id === "shower");
  if (!shower) return null;
  const label = bankText("game-weather");
  if (state.time < shower.at) {
    return `${label}: the shower was due at ${clockLabel(shower.at, state.duration)}, after the work was done.`;
  }
  const from = clockLabel(shower.at, state.duration);
  const to = clockLabel(Math.min(shower.until, state.time), state.duration);
  return `${label}: a shower from ${from} to ${to} slowed walking on the lawn.`;
}

/** The closing note: the real facts as the line bank words them, and the wedding link. */
function actualNote(): ActualNote {
  return {
    heading: bankText("actual-heading"),
    lines: ACTUAL_NOTE_IDS.map((id) => bankText(id)),
    href: WEDDING_PATH,
  };
}

/**
 * The kitchen line: burnt batches on the grill, and the batches binned and
 * restocked from their crates. Null when neither happened.
 */
function kitchenLine(state: GameState): string | null {
  const plural = (n: number) => `batch${n === 1 ? "" : "es"}`;
  const parts: string[] = [];
  if (state.burntBatches > 0)
    parts.push(
      `Extra smoky: ${state.burntBatches} ${plural(state.burntBatches)} burnt on the grill.`
    );
  if (state.burntRestocks > 0)
    parts.push(
      `Restocked ${state.burntRestocks} burnt ${plural(state.burntRestocks)} from the crate.`
    );
  return parts.length > 0 ? parts.join(" ") : null;
}

/** The ending receipt, derived purely from the level state. */
export function computeReceipt(state: GameState): Receipt {
  const readiness = readinessLines(state);
  const follow = followThrough(state, readiness);
  const challenges = evaluateChallenges(state, readiness);
  return {
    spending: spending(state),
    readiness,
    followThrough: follow,
    website: websiteLines(state),
    finishedAt:
      state.finishedAt !== null
        ? `Everything was ready at ${clockLabel(state.finishedAt, state.duration)}.`
        : null,
    kitchen: kitchenLine(state),
    signatureMoment: signatureMoment(readiness),
    assist: state.assistTicks > 0 ? ASSIST_LINE : null,
    actual: actualNote(),
    title: title(state, readiness, follow.status === "kept"),
    weather: weatherLine(state),
    gameWeather: gameWeather(state),
    leftovers: RECEIPT_COPY.leftovers,
    suit: RECEIPT_COPY.suit,
    challenges,
    stars: countStars(challenges),
    disclaimer: RECEIPT_COPY.disclaimer,
  };
}
