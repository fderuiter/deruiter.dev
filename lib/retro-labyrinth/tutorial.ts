import type { TutorialScript } from "@/lib/arcade";
import { LABYRINTH_ACTIONS } from "./actions";

/**
 * The signals Retro Labyrinth sends its tutorial (#3459): the player moved,
 * fired a tool from slots 1 to 3, fired an EMP, opened the Market and
 * cleared the room.
 */
export const RETRO_LABYRINTH_TUTORIAL_SIGNALS = {
  move: "move",
  tool: "tool",
  emp: "emp",
  market: "market",
  clear: "clear",
} as const;

const S = RETRO_LABYRINTH_TUTORIAL_SIGNALS;
const A = LABYRINTH_ACTIONS.actions;

/**
 * Retro Labyrinth's guided tutorial (#3459). It plays a practice Room 01
 * that nothing can hurt and that is never saved or scored, and teaches the
 * room by doing: move, fire a tool, fire an EMP, open the Market and reach
 * the exit. The Market, which trades only at the rest stop in a real run,
 * opens anywhere during practice. Exploit has no key, so it is described
 * rather than practised. The labels come from `LABYRINTH_ACTIONS`, so they
 * match the keys, the touch docks and the Field Manual.
 */
export const RETRO_LABYRINTH_TUTORIAL: TutorialScript = {
  gameId: "retro-labyrinth",
  version: 1,
  minutes: 3,
  steps: [
    {
      id: "welcome",
      chapter: "The room",
      title: "Breach the network",
      body: "Each room is a maze with an exit. Reach it, then choose the next room on the route. In this practice room nothing can hurt you and nothing is saved.",
    },
    {
      id: "move",
      chapter: "The room",
      title: "Move",
      body: "Take a step through the maze. Fog lifts around you as you go.",
      keys: "W A S D or the arrow keys",
      touch: "Swipe the maze or use the arrows",
      practice: { signal: S.move },
    },
    {
      id: "tool",
      target: "actions",
      chapter: "Tools",
      title: "Fire a tool",
      body: "Your class starts with three tools in the hotbar. Each one has ammo, and some cost RAM. Fire one.",
      keys: "1, 2 or 3",
      touch: "A tool button",
      practice: { signal: S.tool },
    },
    {
      id: "emp",
      target: "actions",
      chapter: "Tools",
      title: `Fire an ${A.emp.label}`,
      body: "The EMP stuns every security drone in the room for a few seconds.",
      keys: "Space",
      touch: `The ${A.emp.label} button`,
      practice: { signal: S.emp },
    },
    {
      id: "exploit",
      target: "actions",
      chapter: "Tools",
      title: A.exploit.label,
      body: `On a touch screen, ${A.exploit.touchLabel} picks the next tool with ammo and fires it. On a gamepad it is B. On a keyboard the number keys choose the tool.`,
    },
    {
      id: "market",
      target: "actions",
      chapter: "The Market",
      title: `Open the ${A.market.label}`,
      body: "The Market sells patches, RAM and bypass chips for crypto. In a real run it trades only at the rest stop. Open it, then close it with Escape.",
      keys: "M",
      touch: `The ${A.market.label} button, under More on a phone`,
      practice: { signal: S.market },
    },
    {
      id: "clear",
      chapter: "The exit",
      title: "Clear the room",
      body: "Walk to the EXIT. Some rooms lock it until their objective is done; the HUD says what is left.",
      keys: "W A S D or the arrow keys",
      touch: "Swipe the maze or use the arrows",
      practice: { signal: S.clear },
    },
    {
      id: "done",
      chapter: "The real run",
      title: "Jack in",
      body: "A real run is six rooms with a boss at the end. Bugs and drones hurt, and a trace ends the room. After each room you pick a reward. The Field Manual lists every key.",
    },
  ],
};
