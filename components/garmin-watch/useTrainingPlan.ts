import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEngineState } from "@/lib/garmin-engine";
import { clamp } from "@/lib/game-utils";
import {
  GEAR_ITEM_NAMES,
  PLAN_NODES,
  clearWorkout,
  cycleCursor,
  dnfWorkout,
  moveCursor,
  newPlan,
  nodeLabel,
  nodeStatus,
  planNode,
  planRunFor,
  takeHutItem,
  type MapDirection,
  type PlanNodeId,
  type PlanRun,
  type PlanSave,
} from "@/lib/garmin-plan";
import { loadPlan, savePlan } from "@/lib/garmin-plan-store";
import { formatRaceTime } from "@/lib/garmin-race";
import {
  planScreenLabel,
  type PlanOutcome,
  type PlanScreen,
} from "./plan-face-art";

/**
 * What the player pressed on a Training Plan screen: an arrow key, the watch's
 * UP or DOWN button (previous or next node), Jump or START (select), or BACK.
 */
export type PlanInput = MapDirection | "prev" | "next" | "select" | "back";

type Announce = (text: string, politeness?: "polite" | "assertive") => void;

interface UseTrainingPlanOptions {
  /** The Training Plan is the picked run mode. */
  active: boolean;
  announce: Announce;
  /**
   * Starts a workout: its run, and the lives to start with, or null for a
   * practice run, which starts with a fresh three.
   */
  startWorkout: (run: PlanRun, lives: number | null) => void;
}

/** A seed for a new plan's hut shuffles. */
function freshSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}

/** The names of the nodes a cleared workout opened, e.g. "Intervals and Recovery Hut". */
function openedNames(before: PlanSave, after: PlanSave): string {
  const opened = PLAN_NODES.filter(
    (n) =>
      nodeStatus(before, n.id) === "locked" &&
      nodeStatus(after, n.id) !== "locked"
  ).map((n) => n.name);
  return opened.join(" and ");
}

/** The card after a workout, and the plan it leaves (#1994). */
export function workoutOutcome(
  save: PlanSave,
  id: PlanNodeId,
  practice: boolean,
  state: GameEngineState
): { save: PlanSave; outcome: PlanOutcome } {
  const node = planNode(id);
  const finished = state.gameState === "summary";
  const time = formatRaceTime(state.runClockMs ?? 0);
  if (practice) {
    return {
      save,
      outcome: {
        kind: "practice",
        node: id,
        lines: [
          node.name.toUpperCase(),
          finished ? `TIME ${time}` : "DID NOT FINISH",
          "PLAN UNCHANGED",
        ],
        text: `Practice ${node.name} ${finished ? `done in ${time}` : "over"}. The plan is unchanged.`,
      },
    };
  }
  if (finished) {
    const next = clearWorkout(save, id, {
      lives: state.lives ?? 1,
      score: state.score,
      trainingEffect: state.lastTrainingEffect ?? null,
    });
    if (node.kind === "raceday") {
      return {
        save: next,
        outcome: {
          kind: "finisher",
          node: id,
          lines: [`RACE DAY · ${time}`, "THE WALL IS DOWN", `+${state.score}`],
          text: `Finisher! Race Day in ${time}. The Wall is down. Finisher medal won.`,
        },
      };
    }
    const opened = openedNames(save, next);
    return {
      save: next,
      outcome: {
        kind: "cleared",
        node: id,
        lines: [
          node.name.toUpperCase(),
          `TIME ${time} · +${state.score}`,
          opened ? `OPENS ${opened.toUpperCase()}` : `LIVES ${next.lives}`,
        ],
        text: `${node.name} done in ${time}.${opened ? ` ${opened} open.` : ""}`,
      },
    };
  }
  const dnf = dnfWorkout(save);
  const cost = dnf.outOfContinues
    ? "Out of continues: the plan's score is reset."
    : `${dnf.save.continues} ${dnf.save.continues === 1 ? "continue" : "continues"} left.`;
  return {
    save: dnf.save,
    outcome: {
      kind: "dnf",
      node: id,
      lines: [
        node.name.toUpperCase(),
        dnf.outOfContinues
          ? "OUT OF CONTINUES · SCORE RESET"
          : `${dnf.save.continues} ${dnf.save.continues === 1 ? "CONTINUE" : "CONTINUES"} LEFT`,
        "LIVES BACK TO 3",
      ],
      text: `DNF, back to training. ${cost} Lives back to 3.`,
    },
  };
}

/**
 * The Training Plan (#1994): the save, the screen showing on the watch while
 * no run is going, and the keys that drive it. The animation loop reads
 * `viewRef`; React renders read `save` and `screen`.
 */
export function useTrainingPlan({
  active,
  announce,
  startWorkout,
}: UseTrainingPlanOptions) {
  const [save, setSave] = useState<PlanSave | null>(null);
  const [screen, setScreen] = useState<PlanScreen>({ kind: "report" });
  const viewRef = useRef<{ save: PlanSave | null; screen: PlanScreen }>({
    save: null,
    screen: { kind: "report" },
  });
  // The workout running now, so its end is settled once.
  const runRef = useRef<{ node: PlanNodeId; practice: boolean } | null>(null);

  const commit = useCallback((next: PlanSave, nextScreen: PlanScreen) => {
    viewRef.current = { save: next, screen: nextScreen };
    setSave(next);
    setScreen(nextScreen);
    savePlan(next);
  }, []);

  // Storage is read after mount so server and client markup match.
  useEffect(() => {
    const loaded = loadPlan() ?? newPlan(freshSeed());
    viewRef.current = { save: loaded, screen: viewRef.current.screen };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave(loaded);
  }, []);

  // A Morning Report opens each visit to the plan.
  useEffect(() => {
    const current = viewRef.current.save;
    if (!active || !current) return;
    viewRef.current = { save: current, screen: { kind: "report" } };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScreen({ kind: "report" });
  }, [active]);

  /** Enters node `id` from the map: a workout starts, a hut opens. */
  const enter = useCallback(
    (current: PlanSave, id: PlanNodeId) => {
      const node = planNode(id);
      const status = nodeStatus(current, id);
      const here = { ...current, cursor: id };
      if (status === "locked") {
        announce(nodeLabel(current, id), "polite");
        return;
      }
      if (node.kind === "hut") {
        if (status === "cleared") {
          commit(here, { kind: "map" });
          announce(nodeLabel(current, id), "polite");
          return;
        }
        commit(here, {
          kind: "hut",
          hut: id,
          slot: 1,
          picked: null,
          stored: false,
        });
        announce(
          "Recovery Hut. Three boxes, each hiding an item. Left and Right choose, Space opens one.",
          "polite"
        );
        return;
      }
      const run = planRunFor(node);
      if (!run) return;
      const practice = status === "cleared";
      runRef.current = { node: id, practice };
      commit(here, viewRef.current.screen);
      startWorkout(run, practice ? null : current.lives);
      announce(
        practice
          ? `Practice: ${node.name}. Nothing on the plan changes.`
          : node.kind === "raceday"
            ? "Race Day. A steady race pace, and The Wall before the finish."
            : `${node.name}: stage ${run.stage}.`,
        "polite"
      );
    },
    [announce, commit, startWorkout]
  );

  /** Handles a press on a Training Plan screen. Returns false with no plan loaded yet. */
  const press = useCallback(
    (input: PlanInput): boolean => {
      const { save: current, screen: shown } = viewRef.current;
      if (!current) return false;
      const show = (next: PlanSave, nextScreen: PlanScreen) => {
        commit(next, nextScreen);
        announce(planScreenLabel(next, nextScreen), "polite");
      };
      if (shown.kind === "report") {
        if (input === "select" || input === "back") {
          show(current, { kind: "map" });
          announce(nodeLabel(current, current.cursor), "polite");
        }
        return true;
      }
      if (shown.kind === "result") {
        if (input === "select" || input === "back") {
          show(current, { kind: "report" });
        }
        return true;
      }
      if (shown.kind === "hut") {
        if (shown.picked) {
          if (input === "select" || input === "back") {
            show(current, { kind: "map" });
          }
          return true;
        }
        if (input === "back") {
          show(current, { kind: "map" });
        } else if (input === "select") {
          const pick = takeHutItem(current, shown.hut, shown.slot);
          if (pick.item) {
            commit(pick.save, {
              ...shown,
              picked: pick.item,
              stored: pick.stored,
            });
            announce(
              pick.stored
                ? `You took the ${GEAR_ITEM_NAMES[pick.item]}. It is in the gear bag.`
                : `The ${GEAR_ITEM_NAMES[pick.item]}, but the gear bag is full, so it stays at the hut.`,
              "polite"
            );
          }
        } else {
          const step = input === "left" || input === "prev" ? -1 : 1;
          if (input === "up" || input === "down") return true;
          const slot = clamp(shown.slot + step, 0, 2);
          if (slot !== shown.slot) show(current, { ...shown, slot });
        }
        return true;
      }
      // The map.
      if (input === "select") {
        enter(current, current.cursor);
        return true;
      }
      if (input === "back") {
        show(current, { kind: "report" });
        return true;
      }
      const cursor =
        input === "prev" || input === "next"
          ? cycleCursor(current, current.cursor, input === "next" ? 1 : -1)
          : moveCursor(current, current.cursor, input);
      if (cursor !== current.cursor) {
        commit({ ...current, cursor }, shown);
        announce(nodeLabel(current, cursor), "polite");
      }
      return true;
    },
    [announce, commit, enter]
  );

  /** Enters node `id` from the panel's list, as Space would from the map. */
  const choose = useCallback(
    (id: PlanNodeId) => {
      const current = viewRef.current.save;
      if (current) enter(current, id);
    },
    [enter]
  );

  /** Settles the workout that just ended: once per run, and only a plan run. */
  const runOver = useCallback(
    (state: GameEngineState) => {
      const run = runRef.current;
      const current = viewRef.current.save;
      if (!run || !current || !state.plan) return;
      runRef.current = null;
      const { save: next, outcome } = workoutOutcome(
        current,
        run.node,
        run.practice,
        state
      );
      commit(next, { kind: "result", outcome });
      announce(outcome.text, "assertive");
    },
    [announce, commit]
  );

  /** Back to the Morning Report, from the result card's button. */
  const showReport = useCallback(() => {
    const current = viewRef.current.save;
    if (!current) return;
    commit(current, { kind: "report" });
    announce(planScreenLabel(current, { kind: "report" }), "polite");
  }, [announce, commit]);

  /** Starts a new plan, losing the old one. */
  const startNew = useCallback(() => {
    runRef.current = null;
    const fresh = newPlan(freshSeed());
    commit(fresh, { kind: "report" });
    announce(
      "New plan. Every workout is locked again but the Easy Run.",
      "polite"
    );
  }, [announce, commit]);

  return {
    save,
    screen,
    viewRef,
    press,
    choose,
    runOver,
    showReport,
    startNew,
  };
}
