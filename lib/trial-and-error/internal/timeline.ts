import type { HandEvaluation, HandType } from "../types";
import { HAND_NAMES } from "./hands";

/** Running totals after a step: what the score plate shows at that moment. */
export interface TimelineRunning {
  chips: number;
  mult: number;
  xMult: number;
}

/** One step of a hand's scoring, in playback order. */
export type TimelineStep = { text: string; running: TimelineRunning } & (
  | {
      kind: "HAND_BASE";
      handType: HandType;
      level: number;
      chips: number;
      mult: number;
    }
  | {
      kind: "CARD_SCORED";
      cardId: string;
      chips: number;
      mult: number;
      retrigger: number;
    }
  | {
      kind: "RULE";
      ruleId: string;
      chipsDelta: number;
      multDelta: number;
      evidence: string;
    }
  | {
      kind: "RELIC";
      relicId: string;
      /** The relic's display name (falls back to its id). */
      name: string;
      phase: "ON_CARD_SCORED" | "ON_HAND_PLAYED";
      /** The scored card an ON_CARD_SCORED relic fired on. */
      cardId?: string;
      chips: number;
      mult: number;
      xMult: number;
    }
  | { kind: "X_MULT"; source: string; factor: number }
  | { kind: "ZERO_RULE"; ruleId: string; evidence: string; label: string }
  | { kind: "TOTAL"; chips: number; mult: number; score: number }
  | {
      kind: "BLIND_PROGRESS";
      before: number;
      after: number;
      target: number;
      crossed: boolean;
    }
);

/** Everything outside the evaluation that the timeline narrates. */
export interface TimelineContext {
  /** Round score before this hand. */
  roundScoreBefore: number;
  /** The Blind quota. */
  target: number;
  /** Display names for card ids (falls back to the id). */
  cardNames?: Readonly<Record<string, string>>;
  /** Display names for relic ids (falls back to the id). */
  relicNames?: Readonly<Record<string, string>>;
  /** Short slam labels for zero-rule ids, e.g. "DENOMINATOR ERROR". */
  zeroRuleLabels?: Readonly<Record<string, string>>;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * Turns a hand's evaluation into an ordered, narratable scoring timeline.
 *
 * The order is: hand base, each scored card (retriggers repeat the card),
 * rule results, relic contributions, multiplicative factors, the zero-score
 * rule if triggered, the total, then Blind progress. Every step carries the
 * running totals, so a player only displays values and never computes them.
 * Pure and deterministic; the TOTAL step always equals the evaluation.
 */
export function scoreTimeline(
  evaluation: HandEvaluation,
  context: TimelineContext
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const running: TimelineRunning = { chips: 0, mult: 0, xMult: 1 };
  const snapshot = (): TimelineRunning => ({ ...running });
  const name = (id: string) => context.cardNames?.[id] ?? id;

  running.chips += evaluation.base.baseChips;
  running.mult += evaluation.base.baseMult;
  steps.push({
    kind: "HAND_BASE",
    handType: evaluation.handType,
    level: evaluation.level,
    chips: evaluation.base.baseChips,
    mult: evaluation.base.baseMult,
    text: `${HAND_NAMES[evaluation.handType]} Lv.${evaluation.level}: ${evaluation.base.baseChips} Chips, +${evaluation.base.baseMult} Mult.`,
    running: snapshot(),
  });

  const ledgerValue = (sourceId: string, kind: "CHIPS" | "PLUS_MULT") =>
    evaluation.ledger
      .filter((l) => l.sourceId === sourceId && l.kind === kind && l.step !== 4)
      .reduce((sum, l) => sum + l.value, 0);

  const relicName = (id: string) => context.relicNames?.[id] ?? id;
  const factorOf = (sourceId: string) =>
    evaluation.xMult.factors.find((f) => f.sourceId === sourceId)?.value ?? 1;
  const pushRelic = (sourceId: string, relicId: string, cardId?: string) => {
    const chips = ledgerValue(sourceId, "CHIPS");
    const mult = ledgerValue(sourceId, "PLUS_MULT");
    const factor = factorOf(sourceId);
    running.chips += chips;
    running.mult += mult;
    const effect =
      [
        chips ? `${signed(chips)} Chips` : "",
        mult ? `${signed(mult)} Mult` : "",
        factor !== 1 ? `×${factor} Mult` : "",
      ]
        .filter(Boolean)
        .join(", ") || "no effect";
    steps.push({
      kind: "RELIC",
      relicId,
      name: relicName(relicId),
      phase: cardId ? "ON_CARD_SCORED" : "ON_HAND_PLAYED",
      ...(cardId ? { cardId } : {}),
      chips,
      mult,
      xMult: factor,
      text: cardId
        ? `${relicName(relicId)} on ${name(cardId)}: ${effect}.`
        : `${relicName(relicId)}: ${effect}.`,
      running: snapshot(),
    });
  };

  // Relic sources that are neither the hand, a card nor a rule. An
  // ON_CARD_SCORED relic's id is `relic@card` and plays right after its card.
  const cardIds = new Set(evaluation.cardIds);
  const ruleIds = new Set(evaluation.ruleResults.map((r) => r.ruleId));
  // Every modifier leaves an ×Mult entry, in rack order; relics play in it.
  const relicSourceIds = [
    ...new Set(
      [...evaluation.ledger.filter((l) => l.step === 3), ...evaluation.ledger]
        .filter(
          (l) =>
            l.step !== 4 &&
            l.sourceId !== evaluation.handType &&
            !cardIds.has(l.sourceId) &&
            !ruleIds.has(l.sourceId)
        )
        .map((l) => l.sourceId)
    ),
  ];
  const cardOf = (sourceId: string) => {
    const at = sourceId.lastIndexOf("@");
    return at > 0 && cardIds.has(sourceId.slice(at + 1))
      ? sourceId.slice(at + 1)
      : null;
  };
  const cardRelicIds = new Map<string, string[]>();
  for (const sourceId of relicSourceIds) {
    const cardId = cardOf(sourceId);
    if (cardId)
      cardRelicIds.set(cardId, [...(cardRelicIds.get(cardId) ?? []), sourceId]);
  }

  for (const cardId of evaluation.cardIds) {
    const chips = ledgerValue(cardId, "CHIPS");
    const mult = ledgerValue(cardId, "PLUS_MULT");
    running.chips += chips;
    running.mult += mult;
    steps.push({
      kind: "CARD_SCORED",
      cardId,
      chips,
      mult,
      retrigger: 0,
      text: `${name(cardId)}: ${signed(chips)} Chips${mult ? `, ${signed(mult)} Mult` : ""}.`,
      running: snapshot(),
    });
    for (const sourceId of cardRelicIds.get(cardId) ?? []) {
      pushRelic(sourceId, sourceId.slice(0, sourceId.lastIndexOf("@")), cardId);
    }
  }

  for (const result of evaluation.ruleResults) {
    if (result.chipsDelta === 0 && result.multDelta === 0) continue;
    running.chips += result.chipsDelta;
    running.mult += result.multDelta;
    const parts = [
      result.chipsDelta ? `${signed(result.chipsDelta)} Chips` : "",
      result.multDelta ? `${signed(result.multDelta)} Mult` : "",
    ].filter(Boolean);
    steps.push({
      kind: "RULE",
      ruleId: result.ruleId,
      chipsDelta: result.chipsDelta,
      multDelta: result.multDelta,
      evidence: result.evidence,
      text: `${result.ruleId}: ${parts.join(", ")}. ${result.evidence}`,
      running: snapshot(),
    });
  }

  for (const sourceId of relicSourceIds) {
    if (!cardOf(sourceId)) pushRelic(sourceId, sourceId);
  }

  const factorName = (sourceId: string) => {
    const cardId = cardOf(sourceId);
    return cardId
      ? `${relicName(sourceId.slice(0, sourceId.lastIndexOf("@")))} on ${name(cardId)}`
      : relicName(sourceId);
  };
  const zeroIds = new Set(evaluation.zeroRule.ruleIds);
  for (const factor of evaluation.xMult.factors) {
    if (zeroIds.has(factor.sourceId) && factor.value === 0) continue;
    // A relic's ×1 is no factor at all: nothing to show.
    if (factor.value === 1 && !ruleIds.has(factor.sourceId)) continue;
    running.xMult *= factor.value;
    const because = evaluation.ruleResults.find(
      (r) => r.ruleId === factor.sourceId && r.multMultiplier === factor.value
    )?.evidence;
    steps.push({
      kind: "X_MULT",
      source: factor.sourceId,
      factor: factor.value,
      text: `${ruleIds.has(factor.sourceId) ? factor.sourceId : factorName(factor.sourceId)}: ×${factor.value} Mult.${because ? ` ${because}` : ""}`,
      running: snapshot(),
    });
  }

  if (evaluation.zeroRule.triggered) {
    running.xMult = 0;
    const [first] = evaluation.zeroRule.ruleIds;
    const result = evaluation.ruleResults.find(
      (r) => r.ruleId === first && r.multMultiplier === 0
    );
    const label = context.zeroRuleLabels?.[first] ?? "ZERO-SCORE RULE";
    const count = evaluation.zeroRule.ruleIds.length;
    steps.push({
      kind: "ZERO_RULE",
      ruleId: first,
      evidence: result?.evidence ?? "",
      label,
      text: `${label} ×0: ${count} fatal finding${count === 1 ? "" : "s"} under ${first}. ${result?.evidence ?? ""}`.trim(),
      running: snapshot(),
    });
  }

  steps.push({
    kind: "TOTAL",
    chips: evaluation.chips.total,
    mult: evaluation.finalMult,
    score: evaluation.score,
    text: `Hand scores ${evaluation.score}: ${evaluation.chips.total} Chips × ${evaluation.finalMult} Mult.`,
    running: snapshot(),
  });

  const before = context.roundScoreBefore;
  const after = before + evaluation.score;
  const crossed = before < context.target && after >= context.target;
  steps.push({
    kind: "BLIND_PROGRESS",
    before,
    after,
    target: context.target,
    crossed,
    text: `Round ${after} of ${context.target}.${crossed ? " Target crossed: Blind cleared." : ""}`,
    running: snapshot(),
  });

  return steps;
}
