import type { TutorialScript } from "@/lib/arcade";

/**
 * The signals Quasi-Perfect Puzzler sends its tutorial (#3454): hints were
 * opened, a tactic card was picked, a tactic was applied, the last step was
 * undone, or the level was reset.
 */
export const QUASI_TUTORIAL_SIGNALS = {
  hint: "hint",
  select: "select",
  apply: "apply",
  undo: "undo",
  reset: "reset",
} as const;

const S = QUASI_TUTORIAL_SIGNALS;

/** The level the tutorial plays: Level 1, The Identity Crisis (x = x). */
export const QUASI_TUTORIAL_LEVEL_INDEX = 0;

/**
 * Quasi-Perfect Puzzler's guided tutorial (#3454). It plays Level 1, where
 * one `rfl` proves x = x, and teaches by doing: open the hints, pick the
 * card, apply it to the goal, undo it and reset the level. A proof found in
 * the tutorial is not saved. The read steps cover subgoal tabs, which first
 * appear at Level 9, and the RAM budget. Afterwards the player is back on the
 * level they had open.
 */
export const QUASI_TUTORIAL: TutorialScript = {
  gameId: "quasi-puzzler",
  version: 1,
  minutes: 2,
  steps: [
    {
      id: "goal",
      chapter: "The goal",
      title: "Read the goal",
      body: "Each level is a theorem to prove. Level 1 asks you to prove x = x. The board draws the goal as a tree, with = at the root and x on each side.",
      target: "goal",
    },
    {
      id: "hint",
      chapter: "The goal",
      title: "Open the hints",
      body: "Stuck? The hints start vague and get specific one at a time. Opening them costs nothing.",
      keys: "H",
      touch: "Tap Hints",
      target: "hint",
      practice: { signal: S.hint },
    },
    {
      id: "select",
      chapter: "Tactics",
      title: "Pick a tactic",
      body: "Tactics are cards in your hand. Pick rfl, which says that a thing equals itself.",
      keys: "Tab to the card, then Enter",
      touch: "Tap the rfl card",
      target: "tactics",
      practice: { signal: S.select },
    },
    {
      id: "apply",
      chapter: "Tactics",
      title: "Apply it to the goal",
      body: "With a card picked, choose the part of the goal it works on. Here that is the whole equation. You can also drag the card onto the goal. A tactic that fails stays picked, so you can try another target.",
      keys: "Shift+Tab to the tree, then Enter",
      touch: "Tap the = node",
      target: "goal",
      practice: { signal: S.apply },
    },
    {
      id: "undo",
      chapter: "Mistakes",
      title: "Undo",
      body: "Every step can be taken back, and the RAM it spent comes back with it. Redo puts it back.",
      keys: "Ctrl+Z or Cmd+Z (redo: Ctrl+Y)",
      touch: "Tap Undo",
      target: "undo",
      practice: { signal: S.undo },
    },
    {
      id: "reset",
      chapter: "Mistakes",
      title: "Reset the level",
      body: "Reset starts the level over with a full RAM budget.",
      keys: "R",
      touch: "Tap Reset",
      target: "reset",
      practice: { signal: S.reset },
    },
    {
      id: "subgoals",
      chapter: "Later levels",
      title: "Subgoal tabs",
      body: "From Level 9 some tactics split a goal in two. Each subgoal gets its own tab above the board, and the level is proved once every tab is closed.",
    },
    {
      id: "done",
      chapter: "Later levels",
      title: "Prove it for real",
      body: "Every tactic costs RAM, and the more you have left when the goal closes, the more stars you earn. sorry closes any goal but earns no stars. B opens the level's theory briefing.",
      target: "ram",
    },
  ],
};
