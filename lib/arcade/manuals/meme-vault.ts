import type { FieldManualData } from "./types";

export const MEME_VAULT_MANUAL: FieldManualData = {
  id: "meme-vault",
  title: "Meme Vault",
  subtitle:
    "8-Pad Retro Sampler, Echo Sequence Game & Easter Egg Trophy Case",
  genre: "Sound Toy & Memory Game",
  badge: "Secret Room",
  route: "/arcade/meme-vault",
  storageKey: "meme_vault_echo_best",
  accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  objective:
    "Play Echo: watch the vault light a sequence of pads, repeat it exactly, and see how long a sequence you can hold. Between rounds, hunt the six hidden trophies scattered across the site.",
  quickSummary:
    "Press Start Echo. The vault plays one pad; repeat it with keys 1 to 8 or by clicking. Each sequence you repeat adds one pad and the tempo rises gently. One wrong pad ends the round, and your best streak is kept on this device.",
  controls: [
    {
      action: "Start or Stop Echo",
      description:
        "Tab to Start Echo and press Enter or Space, or click it. Stop Echo ends the round without recording it.",
      key: "Enter / Space",
    },
    {
      action: "Press a Pad",
      description:
        "Keys 1 to 8 on the top row or the numpad press the matching pad. Outside a round a pad plays its sample; during your turn it answers Echo. Keys are ignored while you type in a field or a dialog is open.",
      key: "1 – 8",
    },
    {
      action: "Sound On or Off",
      description:
        "The Sound toggle mutes every pad and the fail sting. With reduced motion on, sound stays off until you choose Play sound anyway. Echo still plays with lights alone.",
      key: "Sound Toggle",
    },
    {
      action: "Open this Manual",
      description: "Open the field manual from anywhere in the room.",
      key: "? / H",
    },
  ],
  rules: [
    {
      title: "Watch, Then Repeat",
      detail:
        "Pads are ignored while the vault plays. When it finishes, it is your turn: press the same pads in the same order. Repeating the whole sequence adds 1 to your streak and the vault plays it again with one more pad.",
      badge: "Core Loop",
    },
    {
      title: "One Mistake Ends the Round",
      detail:
        "A wrong pad plays a low fail sting and shows your final streak. Start again for a new sequence.",
      badge: "Fail State",
    },
    {
      title: "Rising Tempo",
      detail:
        "Every three pads the playback gets a little quicker, down to a floor that stays readable. Longer sequences are faster, never frantic.",
      badge: "Tempo",
    },
    {
      title: "Best Streak",
      detail:
        "Beating your stored best shows a New Echo best toast. The best is kept in this browser, survives reloads and shows on the Arcade Hub's vault card. Streaks of 5 and 10 unlock the Echo Chamber and Perfect Recall arcade trophies; the arcade score itself counts hidden trophies.",
      badge: "Record",
    },
    {
      title: "The Hidden Trophy Case",
      detail:
        "Six trophies are hidden around the site, not just in this room. Locked shelf slots carry a hint; the manual's pro tips nudge without spoiling.",
      badge: "Trophies",
    },
  ],
  proTips: [
    "Say the key numbers under your breath as the pads light. A spoken chunk like 3-1-7 is easier to hold than a picture.",
    "Each pad has its own sound, so Echo can be played by ear with sound on.",
    "One trophy rewards a sound you actually hear in this very room.",
    "A furry friend naps somewhere you only reach by scrolling all the way down.",
    "The terminal on one of the case studies knows a few classic UNIX jokes, and one very risky git command.",
    "The command palette (Cmd+K) has opinions about hot drinks and an old HTTP status code.",
    "Gamers of a certain age know a code that starts with up, up.",
  ],
  lore: {
    title: "A Sampler with a Memory",
    story:
      "Every sound in the vault is synthesized in the browser with the Web Audio API: oscillators, filtered noise and short envelopes, with no audio files. Echo turns the sampler into a call-and-response memory game. Its sequence comes from a seeded counter-based PRNG, so a given seed always plays the same pads and the engine can be tested exactly.",
    realWorldTech: [
      "Web Audio API",
      "AnalyserNode Oscilloscope",
      "Seeded Mulberry32 PRNG",
      "Pure State Machines",
      "localStorage Persistence",
    ],
  },
};
