import {
  advanceRun,
  createRunState,
  runBlinds,
  type LoggedAction,
  type RunPlan,
  type RunState,
} from "../../lib/trial-and-error";
import { playBlind } from "./trial-and-error-bot";

/**
 * A seed whose first shop stocks a SAP Amendment the run can afford once it
 * sells its seals (#1086). Changing the Act I catalog can move it.
 */
export const AMENDMENT_SEED = "amend-15";

/**
 * The actions that clear the Small Blind on {@link AMENDMENT_SEED}, buy the
 * amendment the shop stocks and open the Big Blind with it in the tray.
 */
export function amendmentInTray(plan: RunPlan): {
  run: RunState;
  actions: LoggedAction[];
} {
  let run = createRunState(plan, AMENDMENT_SEED);
  const actions: LoggedAction[] = [];
  const step = (action: LoggedAction) => {
    run = advanceRun(plan, run, action);
    actions.push(action);
  };
  const blind = runBlinds(plan, run)[run.blindIndex];
  for (const action of playBlind(blind, run.table, "MEDIAN").actions) {
    if (run.table.status !== "REVIEWING") break;
    if (action.type === "RESET") continue;
    step(action);
  }
  step({ type: "CASH_OUT" });
  for (const item of run.table.consumables) {
    step({ type: "SELL_CONSUMABLE", consumableId: item.id });
  }
  const slot = run.shop?.slots.findIndex((s) => s.entry.kind === "AMENDMENT");
  if (slot === undefined || slot < 0) {
    throw new Error(`${AMENDMENT_SEED} no longer stocks a SAP Amendment.`);
  }
  step({ type: "BUY", slot });
  if (!run.table.consumables.some((c) => c.kind === "AMENDMENT")) {
    throw new Error(`${AMENDMENT_SEED} can no longer afford its amendment.`);
  }
  step({ type: "NEXT_BLIND" });
  return { run, actions };
}
