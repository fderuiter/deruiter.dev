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
  return [...counts.entries()].map(([name, n]) => `${name} ${n}`).join(", ");
}

function sourceCondition(state: GameState, category: Category): Condition {
  const cart = state.setup.cart;
  switch (category) {
    case "bouquets":
    case "centerpieces":
    case "petals":
      return {
        label: `Roses bought (${ROSE_TIER_LABELS[cart.roses]})`,
        met: true,
        detail: `${ROSE_BUNCHES[cart.roses]} bunches`,
      };
    case "lanterns":
      return {
        label: "Lanterns bought",
        met: cart.lanterns,
        detail: cart.lanterns ? "4 in the pack" : "not in the cart",
      };
    case "buffet":
      return {
        label: `Food bought (${FOOD_TIER_LABELS[cart.food]})`,
        met: true,
        detail: "drinks and sheet cake included",
      };
    case "chairs":
      return { label: "Chairs from the shed", met: true, detail: "8 stacks" };
  }
}

function madeCondition(
  category: Category,
  filled: readonly Target[]
): Condition | null {
  const items = filled.flatMap((t) => t.filled);
  if (category === "bouquets" || category === "centerpieces") {
    return {
      label: "Arranged at the rose table",
      met: true,
      detail: tally(items.map((i) => i.madeBy)),
    };
  }
  if (category === "petals") {
    return {
      label: "Plucked at the petal bucket",
      met: true,
      detail: tally(items.map((i) => i.madeBy)),
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
          ? tally(grilled.map((i) => i.madeBy))
          : "nothing yet",
    };
  }
  return null;
}

function readinessLine(state: GameState, category: Category): ReadinessLine {
  const label = CATEGORY_LABELS[category];
  const targets = state.targets.filter((t) => t.category === category);
  const planned = targets.filter((t) => t.status !== "unplanned");
  const filled = planned.filter((t) => t.status === "filled");
  const simplified = planned.filter((t) => t.status === "simplified").length;
  const open = planned.filter((t) => t.status === "open").length;
  if (planned.length === 0) {
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
  const placedBy = filled.flatMap((t) => t.filledBy);
  const conditions: Condition[] = [sourceCondition(state, category)];
  const made = madeCondition(category, filled);
  if (made) conditions.push(made);
  conditions.push({
    label: `Placed ${filled.length} of ${planned.length - simplified}`,
    met: open === 0,
    detail: tally(placedBy),
  });
  const status =
    open > 0 ? "unfinished" : simplified > 0 ? "simplified" : "ready";
  let explanation: string;
  if (status === "unfinished") {
    explanation = `Unfinished at 4:00: only ${filled.length} of ${planned.length - simplified} done.`;
  } else {
    explanation = conditions.map((c) => `${c.label} (${c.detail})`).join("; ");
    if (simplified > 0) explanation += `; ${simplified} simplified by choice`;
  }
  return {
    category,
    label,
    status,
    placed: filled.length,
    planned: planned.length,
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
      explanation: "Kept: the brothers never got the chance to text.",
    };
  if (presence.choice === "stay")
    return { status: "kept", explanation: "Kept: Fred stayed for the setup." };
  if (presence.choice === "leave")
    return { status: "missed", explanation: `Missed: ${LEFT_LINE}` };
  const promise = presence.commitment ?? "chairs";
  const covered = COMMITMENT_CATEGORIES[promise];
  const done = lines
    .filter((l) => covered.includes(l.category))
    .every((l) => l.status !== "unfinished");
  return done
    ? {
        status: "kept",
        explanation: `Kept: Fred took a short break, promised to come back for the ${promise}, and the ${promise} got done.`,
      }
    : {
        status: "missed",
        explanation: `Missed: Fred promised to come back for the ${promise}, and they weren't done by 4:00.`,
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
      text = `No ${label}: ${calls.length} call${calls.length === 1 ? "" : "s"} got through.`;
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
    kitchen:
      state.burntBatches > 0
        ? `Extra smoky: ${state.burntBatches} batch${state.burntBatches === 1 ? "" : "es"} burnt on the grill.`
        : null,
    signatureMoment: signatureMoment(readiness),
    assist: state.assistTicks > 0 ? ASSIST_LINE : null,
    actual: actualNote(),
    title: title(state, readiness, follow.status === "kept"),
    weather: bankText("weather"),
    gameWeather: gameWeather(state),
    leftovers: RECEIPT_COPY.leftovers,
    suit: RECEIPT_COPY.suit,
    challenges,
    stars: countStars(challenges),
    disclaimer: RECEIPT_COPY.disclaimer,
  };
}
