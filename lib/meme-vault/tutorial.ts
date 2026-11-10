import type { TutorialScript } from "@/lib/arcade";

/**
 * The signals Meme Vault sends its tutorial (#3450): the player started
 * Echo, pressed pad 1 or pad 2, switched the sound, or opened the Field
 * Manual.
 */
export const MEME_VAULT_TUTORIAL_SIGNALS = {
  echo: "echo",
  pad1: "pad-1",
  pad2: "pad-2",
  sound: "sound",
  manual: "manual",
} as const;

const S = MEME_VAULT_TUTORIAL_SIGNALS;

/**
 * Meme Vault's guided tutorial (#3450). It starts an Echo round, then stops
 * it so the player repeats a fixed two-pad pattern, pad 1 then pad 2. Any
 * other pad just plays its sample, so the pattern cannot be failed. Then
 * the player switches the sound and opens the manual. The wording matches
 * the Field Manual.
 */
export const MEME_VAULT_TUTORIAL: TutorialScript = {
  gameId: "meme-vault",
  version: 1,
  minutes: 1,
  steps: [
    {
      id: "welcome",
      chapter: "Basics",
      title: "Eight pads",
      body: "The vault is a sampler. Every pad plays a sound generated in your browser, and keys 1 to 8 press the pads.",
    },
    {
      id: "echo",
      chapter: "Echo",
      title: "Start Echo",
      body: "Echo is the vault's game: it lights a sequence of pads and you play it back. Each round adds one pad.",
      keys: "Enter or Space",
      touch: "Tap Start Echo",
      target: "echo",
      practice: { signal: S.echo },
    },
    {
      id: "pad-1",
      chapter: "Echo",
      title: "Repeat a pattern",
      body: "Echo stops while you practise, so nothing here can go wrong. The pattern is pad 1, then pad 2. Start with pad 1.",
      keys: "1",
      touch: "Tap pad 1",
      target: "pad-1",
      practice: { signal: S.pad1 },
    },
    {
      id: "pad-2",
      chapter: "Echo",
      title: "Finish the pattern",
      body: "Now pad 2. In a real round one wrong pad ends it, and the pad you missed is marked in amber.",
      keys: "2",
      touch: "Tap pad 2",
      target: "pad-2",
      practice: { signal: S.pad2 },
    },
    {
      id: "sound",
      chapter: "Controls",
      title: "Sound on or off",
      body: "Switch the sound off, or back on. With it off, Echo still lights the pads, so you can play in silence.",
      keys: "The Sound button",
      touch: "Tap the Sound button",
      target: "sound",
      practice: { signal: S.sound },
    },
    {
      id: "manual",
      chapter: "Controls",
      title: "Open the Field Manual",
      body: "The manual has every rule, plus hints for the hidden trophies. Escape closes it.",
      keys: "? or H",
      touch: "Tap Field Manual",
      practice: { signal: S.manual },
    },
    {
      id: "trophies",
      chapter: "Trophies",
      title: "Find the trophies",
      body: "Six trophies are hidden around the site, and the Trophy Case below fills as you find them. Your best Echo streak is kept on this device.",
    },
  ],
};
