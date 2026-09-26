import {
  CSR_ORDER,
  advanceTable,
  classifyHand,
  deriveTableView,
  type CsrStage,
  type Scenario,
  type TableAction,
  type TableCardView,
  type TableState,
  type TableView,
} from "@/lib/trial-and-error";

/**
 * The balance bot (T&E-14, #1074): plays a Blind through the public reducer
 * with the information a player has. It decides from `deriveTableView` only,
 * so it never sees a blinded value, and it never peeks.
 *
 * - SLOPPY plays whatever its first cards make. It never inspects, corrects,
 *   recompiles, traces, runs structural QC or uses a consumable.
 * - HASTY plays the best hand the preview shows but never inspects, so it
 *   scores what a player who skips QC scores. It is a diagnostic row.
 * - MEDIAN plays the best hand the preview shows, inspects and corrects the
 *   cards in that hand, recompiles stale outputs, runs structural QC and
 *   convenes the DMC closed session when it can, and uses matching Guidance.
 * - PERFECT is the best of a small portfolio of thorough strategies (fix every
 *   card or only the hand's, trace every flagged cell, try each crisis choice,
 *   look ahead one discard). It is a strong upper bound, not a proven optimum.
 */
export type BotStyle = "SLOPPY" | "HASTY" | "MEDIAN" | "PERFECT";

/** How one Blind went for one style. */
export interface BotResult {
  /** The state the Blind ended in. */
  state: TableState;
  score: number;
  handsPlayed: number;
  cpuSpent: number;
  actions: TableAction[];
}

interface Plan {
  /** Inspect every inspectable card, or only the ones in the chosen hand. */
  fixScope: "NONE" | "HAND" | "ALL";
  trace: boolean;
  recompile: boolean;
  structural: boolean;
  consumables: boolean;
  /** Pick the best previewed hand, or the first one the cards make. */
  pick: "BEST" | "FIRST";
  /** Which crisis choice to take, by index. */
  crisisChoice: number;
  /** Look one discard ahead before each play. */
  discardLookahead: boolean;
}

const SLOPPY_PLAN: Plan = {
  fixScope: "NONE",
  trace: false,
  recompile: false,
  structural: false,
  consumables: false,
  pick: "FIRST",
  crisisChoice: 0,
  discardLookahead: false,
};

const MEDIAN_PLAN: Plan = {
  fixScope: "HAND",
  trace: false,
  recompile: true,
  structural: true,
  consumables: true,
  pick: "BEST",
  crisisChoice: 0,
  discardLookahead: false,
};

/** CPU a play costs; prep never spends the last of it. */
const PLAY_RESERVE = 2;
/** Guards a runaway loop; no Blind lasts this many decisions. */
const MAX_TURNS = 40;
const MAX_HAND = 5;

class Driver {
  readonly actions: TableAction[] = [];
  constructor(
    readonly scenario: Scenario,
    public state: TableState
  ) {}

  view(): TableView {
    return deriveTableView(this.scenario, this.state);
  }

  /** Applies an action; a refusal leaves the state unchanged. */
  act(action: TableAction): boolean {
    const next = advanceTable(this.scenario, this.state, action);
    if (next.lastEvent?.kind === "REFUSED") return false;
    this.state = next;
    this.actions.push(action);
    return true;
  }

  fork(): Driver {
    const copy = new Driver(this.scenario, this.state);
    copy.actions.push(...this.actions);
    return copy;
  }
}

const cpuLeft = (d: Driver) => d.state.cpu.available;

function clearSelection(d: Driver) {
  for (const cardId of [...d.state.selected]) {
    d.act({ type: "TOGGLE_SELECT", cardId });
  }
}

function select(d: Driver, ids: readonly string[]) {
  clearSelection(d);
  for (const cardId of ids) d.act({ type: "TOGGLE_SELECT", cardId });
}

/** Candidate hands: every subset that classifies with no dead cards. */
function candidateHands(hand: readonly TableCardView[]): string[][] {
  const playable = hand.filter((h) => !h.blank);
  const seen = new Set<string>();
  const result: string[][] = [];
  const walk = (start: number, current: TableCardView[]) => {
    if (current.length > 0) {
      const cls = classifyHand(
        current.map((h) => ({ ...h.card, stale: h.stale }))
      );
      if (cls && cls.scoringCardIds.length === current.length) {
        const key = [...cls.scoringCardIds].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          result.push(cls.scoringCardIds);
        }
      }
    }
    if (current.length === MAX_HAND) return;
    for (let i = start; i < playable.length; i++) {
      walk(i + 1, [...current, playable[i]]);
    }
  };
  walk(0, []);
  return result;
}

/** Whether playing these cards now would be accepted. */
function legal(d: Driver, ids: readonly string[]): boolean {
  const probe = d.fork();
  select(probe, ids);
  return probe.act({ type: "PLAY_HAND" });
}

/** The previewed score of a selection: what the player sees before playing. */
function previewScore(d: Driver, ids: readonly string[]): number {
  const probe = d.fork();
  select(probe, ids);
  return probe.view().preview?.score ?? 0;
}

/**
 * CSR Lock (#922): the best-previewed CSR Straight in the hand, its cards in
 * pipeline order so they fill the sequence slots, or null. Its cards may
 * still need validating; `playTurn` fixes them before the lock.
 */
function bestStraight(d: Driver): string[] | null {
  const view = d.view();
  if (!view.csrLock) return null;
  const order = CSR_ORDER;
  const stageOf = new Map(view.hand.map((h) => [h.card.id, h.card.csrStage]));
  const straights = candidateHands(view.hand)
    .filter((ids) => ids.length === 5)
    .map((ids) =>
      [...ids].sort(
        (a, b) =>
          order.indexOf(stageOf.get(a) as CsrStage) -
          order.indexOf(stageOf.get(b) as CsrStage)
      )
    )
    .filter((ids) => ids.every((id, i) => stageOf.get(id) === order[i]));
  return (
    straights
      .map((ids) => ({ ids, score: previewScore(d, ids) }))
      .sort((a, b) => b.score - a.score)[0]?.ids ?? null
  );
}

function chooseHand(
  d: Driver,
  plan: Plan,
  keep: readonly string[] = []
): string[] | null {
  const hand = d.view().hand;
  if (plan.pick === "FIRST") {
    const first = hand
      .filter((h) => !h.blank)
      .slice(0, MAX_HAND)
      .map((h) => h.card.id);
    if (first.length > 0 && legal(d, first)) return first;
    return candidateHands(hand).find((ids) => legal(d, ids)) ?? null;
  }
  const questions = d.view().questions.filter((q) => !q.answered);
  const ranked = candidateHands(hand)
    .map((ids) => ({
      ids,
      score: previewScore(d, ids),
      // An FDA Information Request: the open questions the hand's cards name.
      asks: questions.filter((q) => ids.includes(q.cardId)).length,
    }))
    .sort((a, b) => b.asks - a.asks || b.score - a.score);
  // Keep a CSR Straight's cards back for the lock when another hand plays.
  const spare = ranked.filter((c) => !c.ids.some((id) => keep.includes(id)));
  return (
    spare.find((c) => legal(d, c.ids))?.ids ??
    ranked.find((c) => legal(d, c.ids))?.ids ??
    null
  );
}

function resolveCrisis(d: Driver, plan: Plan) {
  const crisis = d.view().crisis;
  if (!crisis) return;
  const open = crisis.choices.filter((c) => c.refusal === null);
  const pick = open[Math.min(plan.crisisChoice, open.length - 1)];
  if (pick) d.act({ type: "RESOLVE_CRISIS", choiceId: pick.choice.id });
}

function allocateBlanks(d: Driver, plan: Plan) {
  for (const h of d.view().hand.filter((c) => c.blank)) {
    const counts = new Map<string, number>();
    for (const other of d.view().hand) {
      if (!other.blank) {
        counts.set(
          other.card.population,
          (counts.get(other.card.population) ?? 0) + 1
        );
      }
    }
    const options = h.compatiblePopulations;
    const population =
      plan.pick === "FIRST"
        ? options[0]
        : [...options].sort(
            (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
          )[0];
    if (population) {
      d.act({ type: "ALLOCATE", cardId: h.card.id, population });
    }
  }
}

function recompileStale(d: Driver) {
  for (const h of d.view().hand.filter((c) => c.stale && !c.faceDown)) {
    if (cpuLeft(d) - 2 < PLAY_RESERVE) return;
    d.act({ type: "RECOMPILE", cardId: h.card.id });
  }
}

function structuralQc(d: Driver) {
  const view = d.view();
  if (view.dmcCharter === null || view.session !== "OPEN") return;
  for (const h of view.hand.filter((c) => c.faceDown && !c.structural)) {
    if (cpuLeft(d) - 1 < PLAY_RESERVE) return;
    d.act({ type: "STRUCTURAL_QC", cardId: h.card.id });
  }
  if (d.view().sessionRefusal === null) {
    d.act({ type: "SET_SESSION", session: "CLOSED" });
  }
}

/** Inspects a card, reviews every cell, traces flagged cells, corrects. */
function fixCard(d: Driver, cardId: string, plan: Plan) {
  if (cpuLeft(d) - 1 < PLAY_RESERVE) return;
  if (!d.act({ type: "INSPECT_CARD", cardId })) return;
  const view = d.view();
  if (view.figureInspection) {
    for (const f of view.figureInspection.openFindings) {
      d.act({ type: "CORRECT_FINDING", findingId: f.id });
    }
  } else if (view.inspection) {
    view.inspection.cells.forEach((row, r) =>
      row.forEach((_, c) => d.act({ type: "INSPECT_CELL", row: r, col: c }))
    );
    const inspection = d.view().inspection!;
    if (plan.trace) {
      inspection.cells.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell.findingIds.length > 0) {
            d.act({ type: "TRACE_CELL", row: r, col: c });
          }
        })
      );
    }
    for (const f of d.view().inspection?.openFindings ?? []) {
      d.act({ type: "CORRECT_FINDING", findingId: f.id });
    }
  }
  d.act({ type: "CLOSE_INSPECT" });
}

function fixCards(d: Driver, plan: Plan, handIds: readonly string[] | null) {
  if (plan.fixScope === "NONE") return;
  const targets = d
    .view()
    .hand.filter(
      (h) =>
        h.inspectable &&
        !h.inspected &&
        !h.faceDown &&
        (plan.fixScope === "ALL" || handIds?.includes(h.card.id))
    )
    // Parents before the Figures that depend on them.
    .sort(
      (a, b) =>
        Number(a.card.cardType === "FIGURE") -
        Number(b.card.cardType === "FIGURE")
    );
  for (const h of targets) fixCard(d, h.card.id, plan);
}

function applyConsumables(d: Driver, ids: readonly string[]) {
  const handType = (() => {
    const probe = d.fork();
    select(probe, ids);
    return probe.view().classification?.handType;
  })();
  for (const item of d.view().consumables) {
    if (item.kind === "GUIDANCE" && item.guidance.handType === handType) {
      d.act({ type: "USE_GUIDANCE", consumableId: item.id });
    }
  }
  for (const item of d.view().consumables) {
    if (item.kind !== "SEAL") continue;
    const before = previewScore(d, ids);
    for (const cardId of ids) {
      const probe = d.fork();
      if (!probe.act({ type: "APPLY_SEAL", consumableId: item.id, cardId })) {
        continue;
      }
      if (previewScore(probe, ids) > before) {
        d.act({ type: "APPLY_SEAL", consumableId: item.id, cardId });
        break;
      }
    }
  }
}

function playTurn(d: Driver, plan: Plan): boolean {
  if (plan.recompile) recompileStale(d);
  if (plan.structural) structuralQc(d);
  // Only a player who validates can ever lock, so only one holds a Straight.
  const straight =
    plan.pick === "BEST" && plan.fixScope !== "NONE" ? bestStraight(d) : null;
  let ids = chooseHand(d, plan);
  fixCards(d, plan, straight ?? ids);
  ids =
    straight && legal(d, straight)
      ? straight
      : chooseHand(d, plan, straight ?? []);
  if (ids === null) {
    // Nothing legal to play: draw fresh cards if a discard is possible.
    const view = d.view();
    if (view.deckRemaining === 0 || view.discardsAffordable === 0) return false;
    select(
      d,
      view.hand.slice(0, MAX_HAND).map((h) => h.card.id)
    );
    return d.act({ type: "DISCARD" });
  }
  if (plan.consumables) applyConsumables(d, ids);
  select(d, ids);
  return d.act({ type: "PLAY_HAND" });
}

function playOut(d: Driver, plan: Plan): Driver {
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (d.state.status !== "REVIEWING") break;
    resolveCrisis(d, plan);
    allocateBlanks(d, plan);
    if (plan.discardLookahead && discardHelps(d, plan)) continue;
    if (!playTurn(d, plan)) break;
  }
  return d;
}

/**
 * One-step lookahead: whether a discard now ends the Blind higher than
 * playing. It tries the cards outside the best hand, the cards the boss
 * debuffs, and the cards outside the hand's most common population, rolling
 * each out with the same plan. Applies the best discard when one helps.
 */
function discardHelps(d: Driver, plan: Plan): boolean {
  const view = d.view();
  if (view.deckRemaining === 0 || view.discardsAffordable === 0) return false;
  const best = chooseHand(d, plan);
  const counts = new Map<string, number>();
  for (const h of view.hand) {
    counts.set(h.card.population, (counts.get(h.card.population) ?? 0) + 1);
  }
  const major = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const options = [
    view.hand.filter((h) => !best?.includes(h.card.id)),
    view.hand.filter((h) => h.debuffed),
    view.hand.filter((h) => h.card.population !== major),
  ]
    .map((cards) => cards.slice(0, MAX_HAND).map((h) => h.card.id))
    .filter((ids) => ids.length > 0);
  const quiet = { ...plan, discardLookahead: false };
  let bestScore = playOut(d.fork(), quiet).state.roundScore;
  let bestDiscard: string[] | null = null;
  for (const ids of options) {
    const branch = d.fork();
    select(branch, ids);
    if (!branch.act({ type: "DISCARD" })) continue;
    const score = playOut(branch, quiet).state.roundScore;
    if (score > bestScore) {
      bestScore = score;
      bestDiscard = ids;
    }
  }
  if (!bestDiscard) return false;
  select(d, bestDiscard);
  return d.act({ type: "DISCARD" });
}

function perfectPlans(start: Driver): Plan[] {
  const crises = Math.max(1, start.view().crisis?.choices.length ?? 1);
  const plans: Plan[] = [];
  for (const fixScope of ["HAND", "ALL"] as const) {
    for (const discardLookahead of [false, true]) {
      for (let crisisChoice = 0; crisisChoice < crises; crisisChoice++) {
        plans.push({
          fixScope,
          trace: true,
          recompile: true,
          structural: true,
          consumables: true,
          pick: "BEST",
          crisisChoice,
          discardLookahead,
        });
      }
    }
  }
  return plans;
}

/**
 * Plays a Blind from `state` to its end in one style. Pass a scenario with a
 * lifted quota to measure how far a style can score, or the real one to see
 * whether it clears.
 */
export function playBlind(
  scenario: Scenario,
  state: TableState,
  style: BotStyle
): BotResult {
  const start = new Driver(scenario, state);
  const finish = (d: Driver): BotResult => ({
    state: d.state,
    score: d.state.roundScore,
    handsPlayed: d.state.handsPlayed,
    cpuSpent: d.state.cpu.spent,
    actions: d.actions,
  });
  if (style === "SLOPPY") return finish(playOut(start.fork(), SLOPPY_PLAN));
  if (style === "HASTY") {
    return finish(playOut(start.fork(), { ...MEDIAN_PLAN, fixScope: "NONE" }));
  }
  if (style === "MEDIAN") return finish(playOut(start.fork(), MEDIAN_PLAN));
  let best: Driver | null = null;
  for (const plan of perfectPlans(start)) {
    const run = playOut(start.fork(), plan);
    // A cleared Blind beats a higher score that did not clear: CSR Lock is
    // won by the lock, not the round score.
    const cleared = (x: Driver) => Number(x.state.status === "CLEARED");
    if (
      !best ||
      cleared(run) > cleared(best) ||
      (cleared(run) === cleared(best) &&
        run.state.roundScore > best.state.roundScore)
    ) {
      best = run;
    }
  }
  return finish(best!);
}
