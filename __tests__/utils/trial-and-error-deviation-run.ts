import {
  advanceRun,
  createRunState,
  deriveRunView,
  runBlinds,
  type LoggedAction,
  type RunPlan,
  type RunState,
} from "../../lib/trial-and-error";
import { playBlind } from "./trial-and-error-bot";

/**
 * A campaign seed whose Act II Small Blind schedules a protocol deviation
 * after its first hand (#1087). Changing the campaign's draws can move it.
 */
export const DEVIATION_SEED = "fold-change";

/**
 * The actions that play the campaign on {@link DEVIATION_SEED} to Act II's
 * Small Blind with the perfect bot, then play one weak hand there, so the
 * deviation lands and the table shows it.
 */
export function deviationLanded(plan: RunPlan): {
  run: RunState;
  actions: LoggedAction[];
} {
  let run = createRunState(plan, DEVIATION_SEED);
  const actions: LoggedAction[] = [];
  const step = (action: LoggedAction) => {
    run = advanceRun(plan, run, action);
    actions.push(action);
  };
  while (run.actIndex === 0) {
    const blind = runBlinds(plan, run)[run.blindIndex];
    for (const action of playBlind(blind, run.table, "PERFECT").actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      step(action);
    }
    if (run.table.status !== "CLEARED") {
      throw new Error(`${DEVIATION_SEED} no longer clears Act I.`);
    }
    const reward = deriveRunView(plan, run).table.reward;
    if (reward && reward.claimed === null) {
      step({ type: "CLAIM_RELIC", relicId: reward.choices[0].id });
    }
    step({ type: "NEXT_BLIND" });
  }
  if (run.table.deviation?.afterHands !== 1) {
    throw new Error(
      `${DEVIATION_SEED} no longer schedules a deviation after Act II's first hand.`
    );
  }
  // One weak hand: the lowest-Chips output that can be played on its own.
  const view = deriveRunView(plan, run).table;
  const card = view.hand
    .filter((h) => !h.blank && !h.stale && !h.faceDown)
    .sort((a, b) => a.card.chips - b.card.chips)[0];
  step({ type: "TOGGLE_SELECT", cardId: card.card.id });
  step({ type: "PLAY_HAND" });
  if (deriveRunView(plan, run).table.deviation === null) {
    throw new Error(`${DEVIATION_SEED}'s deviation no longer lands.`);
  }
  return { run, actions };
}
