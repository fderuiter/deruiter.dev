import type { TutorialScript } from "@/lib/arcade";

/**
 * The signals Laser Loon sends its tutorial (#2972): the player flew, fired,
 * switched optic, landed a weakness hit, downed a flag, or let loose the
 * Tremolo.
 */
export const LASER_LOON_TUTORIAL_SIGNALS = {
  move: "move",
  fire: "fire",
  optic: "optic",
  crit: "crit",
  kill: "kill",
  ultimate: "ultimate",
} as const;

const S = LASER_LOON_TUTORIAL_SIGNALS;

/**
 * Laser Loon's guided tutorial (#2972). It runs in the Zero-G Sandbox, where
 * nothing can hurt the loon and the Tremolo is always charged, then sends the
 * player back to the Campaign. The wording matches the Field Manual.
 */
export const LASER_LOON_TUTORIAL: TutorialScript = {
  gameId: "laser-loon",
  version: 1,
  minutes: 2,
  steps: [
    {
      id: "welcome",
      chapter: "Basics",
      title: "Flight school",
      body: "You are in the Zero-G Sandbox: nothing can hurt the loon here. You will practise each move once, then head to the Campaign.",
    },
    {
      id: "move",
      chapter: "Basics",
      title: "Fly the loon",
      body: "Glide around the lake. The loon eases toward where you steer it, and with a mouse it also follows your aim up and down.",
      keys: "W A S D or arrow keys",
      touch: "Drag a finger on the arena",
      target: "arena",
      practice: { signal: S.move, count: 3 },
    },
    {
      id: "fire",
      chapter: "Basics",
      title: "Fire the eye-lasers",
      body: "Aim with the mouse and click, or hold the button down to keep firing. Without a mouse, hold Space: the laser locks on to an enemy nearly level with you.",
      keys: "Click, or hold Space",
      touch: "Hold Fire",
      target: "arena",
      practice: { signal: S.fire, count: 3 },
    },
    {
      id: "kill",
      chapter: "Basics",
      title: "Down a rival flag",
      body: "Keep shooting one enemy until it pops. Every flag you down scores points, and quick kills in a row build a combo multiplier.",
      target: "arena",
      practice: { signal: S.kill },
    },
    {
      id: "optic",
      chapter: "Optics",
      title: "Switch optics",
      body: "You carry four optics: Ruby Laser (1), Cyan Pulse (2), Aurora Wave (3) and the Cryo-Mortar (4), which lobs bouncing ice.",
      keys: "1, 2, 3, 4",
      touch: "Tap an optic in the dock",
      target: "controls",
      practice: { signal: S.optic },
    },
    {
      id: "crit",
      chapter: "Optics",
      title: "Hit a weakness",
      body: "Every enemy is weak to one optic: a CRIT! does double damage, RESISTED does half. Try Cyan Pulse (2) on the red Laser Mosquitoes.",
      keys: "2, then fire",
      touch: "Cyan Pulse, then Fire",
      target: "arena",
      practice: { signal: S.crit },
    },
    {
      id: "ultimate",
      chapter: "Optics",
      title: "The Haunting Loon Tremolo",
      body: "In a real run the Tremolo charges as you land hits; at 100% it freezes and shatters everything on screen. Here it is always full, so try it now.",
      keys: "U",
      touch: "Tap Tremolo",
      target: "controls",
      practice: { signal: S.ultimate },
    },
    {
      id: "survive",
      chapter: "Staying alive",
      title: "Hearts and pick-ups",
      body: "Out of the Sandbox the loon has three hearts, and some enemies shoot back. Grab Tater Tot Hotdish for rapid fire, a Golden Pronto Pup for a shield, and North Star Crystals for a score surge.",
      keys: "P or Esc pauses",
      touch: "Pause in the top bar",
    },
    {
      id: "modes",
      chapter: "Modes",
      title: "Pick your run",
      body: "Campaign is four acts with a boss each and up to three stars per act. Arcade Survival is endless waves that get faster. The Sandbox is here whenever you want to practise. Each act's intro card names the optic its new enemies want.",
    },
  ],
};
