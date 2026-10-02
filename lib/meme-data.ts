/**
 * Central repository for portfolio memes, easter egg achievements,
 * soundboard triggers, fortunes, and ASCII art assets.
 */

import {
  safeGetItem,
  safeGetRawItem,
  safeIsAvailable,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { emitAppEvent } from "@/lib/event-bus";
import { recordArcadeScore } from "@/lib/arcade-achievements";

export interface MemeQuote {
  id: string;
  category: "dev" | "medtech" | "lore" | "classic";
  quote: string;
  author: string;
  tagline?: string;
}

export interface SoundboardButton {
  id: string;
  label: string;
  emoji: string;
  category: "dev" | "medtech" | "lore" | "retro" | "classic";
  description: string;
  accent: string;
  synthType:
    | "bark"
    | "laser"
    | "friday-alarm"
    | "matrix-glitch"
    | "teapot-whistle"
    | "modem"
    | "fda-siren"
    | "level-up";
}

export interface EasterEggAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedByDefault?: boolean;
  hint: string;
  /** Where the hint's place lives, shown as a link under a locked trophy. */
  hintLink?: {
    href: string;
    label: string;
  };
}

/**
 * The sample commands terminal (SandboxTerminal) that awards the terminal
 * trophies. The iMednet SDK case study always renders it, including from
 * the static fallback data, so the link works offline too.
 */
export const SANDBOX_TERMINAL_HREF =
  "/case-studies/imednet-python-sdk#sample-commands";

const SANDBOX_TERMINAL_LINK = {
  href: SANDBOX_TERMINAL_HREF,
  label: "Open the sample commands terminal",
};

export const MEME_QUOTES: MemeQuote[] = [
  {
    id: "git-force",
    category: "dev",
    quote:
      "git push --force origin main: Because confidence is when you break production with full commit.",
    author: "Senior Staff Architect at 4:59 PM on a Friday",
    tagline: "DevOps Roulette",
  },
  {
    id: "node-modules",
    category: "dev",
    quote:
      "There are only three things of infinite mass in the universe: supermassive black holes, human curiosity, and node_modules.",
    author: "Theoretical Package Physicist",
    tagline: "Bundle Gravity",
  },
  {
    id: "works-on-machine",
    category: "dev",
    quote:
      "It works on my machine! ...Then we will ship your machine to the cloud datacenter.",
    author: "Every Developer Since 1995",
    tagline: "Docker Origin Story",
  },
  {
    id: "fda-part-11",
    category: "medtech",
    quote:
      "21 CFR Part 11: If it wasn't electronically timestamped, audit-trailed, and digitally signed in triplicate, did the clinical trial even occur?",
    author: "Lead Regulatory Auditor",
    tagline: "CDISC Compliance",
  },
  {
    id: "sdtm-validation",
    category: "medtech",
    quote:
      "All subjects are healthy until you run the SDTM domain validator across the AE dataset.",
    author: "Principal Biostatistician",
    tagline: "Protocol Anomaly",
  },
  {
    id: "duck-puppy",
    category: "lore",
    quote:
      "Duck the puppy has achieved 100% test coverage by chewing through the Ethernet cable.",
    author: "Chief Bark Officer",
    tagline: "Lake Minnetonka QA",
  },
  {
    id: "laser-loon",
    category: "lore",
    quote:
      "Blasting through red tape and rival flags with pure Lake Minnetonka cryo-ray optics.",
    author: "Submission F277 State Flag Committee",
    tagline: "Civic Arcade",
  },
  {
    id: "http-418",
    category: "classic",
    quote:
      "Error 418: I'm a teapot. RFC 2324 Hyper Text Coffee Pot Control Protocol is alive and brewing.",
    author: "IETF Network Working Group",
    tagline: "RFC 2324",
  },
  {
    id: "rust-borrow",
    category: "dev",
    quote:
      "The Rust borrow checker doesn't just reject your code; it questions your life choices in lifetimes.",
    author: "Zero-Cost Abstinence Fanatic",
    tagline: "Memory Safety",
  },
  {
    id: "ai-hallucination",
    category: "dev",
    quote:
      "The LLM was 99.9% confident that 2 + 2 = 5 with full citations from non-existent papers.",
    author: "Autonomous Agent Orchestrator",
    tagline: "P-Value Drift",
  },
];

export const SOUNDBOARD_BUTTONS: SoundboardButton[] = [
  {
    id: "snd-bark",
    label: "Puppy Woof",
    emoji: "🐾",
    category: "lore",
    description: "Synthesized golden retriever puppy bark from Duck.",
    accent:
      "from-amber-500/20 to-amber-600/20 text-amber-300 border-amber-500/40",
    synthType: "bark",
  },
  {
    id: "snd-laser",
    label: "Loon Cryo-Laser",
    emoji: "🦆",
    category: "lore",
    description: "High-frequency Minnesota Laser Loon raycast blast.",
    accent: "from-cyan-500/20 to-blue-600/20 text-cyan-300 border-cyan-500/40",
    synthType: "laser",
  },
  {
    id: "snd-friday",
    label: "Friday Deploy Alarm",
    emoji: "🚨",
    category: "dev",
    description: "Siren warning triggered when pushing to main at 5 PM.",
    accent: "from-red-500/20 to-rose-600/20 text-rose-300 border-red-500/40",
    synthType: "friday-alarm",
  },
  {
    id: "snd-matrix",
    label: "Matrix Glitch",
    emoji: "💾",
    category: "retro",
    description: "Cyberpunk CRT digital cascade burst.",
    accent:
      "from-emerald-500/20 to-green-600/20 text-emerald-300 border-emerald-500/40",
    synthType: "matrix-glitch",
  },
  {
    id: "snd-teapot",
    label: "RFC 418 Teapot",
    emoji: "🫖",
    category: "classic",
    description: "HTCPCP 1.0 whistle and pressure release steam.",
    accent:
      "from-teal-500/20 to-emerald-600/20 text-teal-300 border-teal-500/40",
    synthType: "teapot-whistle",
  },
  {
    id: "snd-modem",
    label: "56k Dialup Handshake",
    emoji: "📞",
    category: "retro",
    description: "Nostalgic 1996 V.90 modem negotiation frequencies.",
    accent:
      "from-indigo-500/20 to-purple-600/20 text-indigo-300 border-indigo-500/40",
    synthType: "modem",
  },
  {
    id: "snd-fda",
    label: "FDA Audit Siren",
    emoji: "📋",
    category: "medtech",
    description: "High-voltage buzzer when CDISC validation fails.",
    accent:
      "from-yellow-500/20 to-amber-600/20 text-yellow-300 border-yellow-500/40",
    synthType: "fda-siren",
  },
  {
    id: "snd-levelup",
    label: "Retro Fanfare",
    emoji: "⭐",
    category: "retro",
    description: "Arpeggiated 8-bit arcade triumph chime.",
    accent:
      "from-purple-500/20 to-pink-600/20 text-purple-300 border-purple-500/40",
    synthType: "level-up",
  },
];

export const EASTER_EGG_ACHIEVEMENTS: EasterEggAchievement[] = [
  {
    id: "konami-hero",
    title: "Konami Code Pioneer",
    description:
      "Entered the legendary sequence (↑ ↑ ↓ ↓ ← → ← → B A) on the keyboard.",
    icon: "🕹️",
    hint: "Enter the classic retro code on any page.",
  },
  {
    id: "terminal-cowboy",
    title: "Terminal Cowboy",
    description:
      "Executed UNIX easter eggs (cowsay, loon, sl, or matrix) in the Sandbox Terminal.",
    icon: "💻",
    hint: "Type cowsay, sl or matrix in the Try the Sample Commands terminal on the iMednet SDK case study. Searching sudo in the Command Palette (Cmd+K) works too.",
    hintLink: SANDBOX_TERMINAL_LINK,
  },
  {
    id: "duck-whisperer",
    title: "Duck Whisperer",
    description:
      "Clicked Duck the Golden Retriever in the footer and tossed a treat.",
    icon: "🐾",
    hint: "Find and click Duck resting at the bottom of the page.",
  },
  {
    id: "rfc-barista",
    title: "RFC 2324 Barista",
    description: "Queried 418 or coffee in the Command Palette (Cmd+K).",
    icon: "🫖",
    hint: "Order coffee from the Command Palette.",
  },
  {
    id: "soundboard-maestro",
    title: "Soundboard Maestro",
    description:
      "Sampled synthesized retro audio effects in the Secret Meme Vault.",
    icon: "🎧",
    hint: "Play sounds in the Meme Vault room.",
  },
  {
    id: "friday-survivor",
    title: "Friday Deploy Survivor",
    description:
      "Attempted a simulated 'git push --force origin main' in the terminal.",
    icon: "🚨",
    hint: "Type git push --force origin main in the Try the Sample Commands terminal on the iMednet SDK case study. Searching friday in the Command Palette (Cmd+K) works too.",
    hintLink: SANDBOX_TERMINAL_LINK,
  },
];

export const STATUS_TICKER_ITEMS: string[] = [
  "Duck would like a word.",
  "The lasers were a design choice.",
  "One more tab should do it.",
  "The footnotes have footnotes.",
  "A small project, allegedly.",
  "Yes, the loon needed lasers.",
  "Still thinking about that bug.",
  "Duck has requested a park break.",
];

export const ASCII_COWSAY = (
  text: string = "Moo! Ships with 100% test coverage."
): string => {
  const line = "-".repeat(text.length + 2);
  return `  ${line}
< ${text} >
  ${line}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`;
};

export const ASCII_DUCK = (): string => {
  return `
              ___
          __/_  \`\.  .-"""-.
 *woof!*  \\_,\` | \\-'  /    )\`-')      Duck is guarding the codebase
            "") \`"\`    \\  ((\`"\`      Status: 100% Good Boy
            ___Y  ,    .'7 /|
         (_,___/...-\` (_/_/`;
};

export const ASCII_LASER_LOON = (): string => {
  return `
.             *             .
             *      .                                                        *
                           *            _..._                   .
          .                            .'     \`.     *
                            .         /         \\                      .
                  .                  |           |           .
                                     |           |                  *
             ^         ^              \\         /              ^         ^
            / \\       / \\              \`._   _.'              / \\       / \\
           /___\\     /___\\                \`\`\`                /___\\     /___\\
          /_____\\   /_____\\      ^          ^          ^    /_____\\   /_____\\
         /_______\\ /_______\\    / \\        / \\        / \\  /_______\\ /_______\\
            | |       | |      /___\\      /___\\      /___\\    | |       | |
      ^^^^^^^^^^^^^^^^^^^^^^^^/_____\\^^^^/_____\\^^^^/_____\\^^^^^^^^^^^^^^^^^^^^^
      ~~~~~~~~~~~~~~~~~~~~~~~/_______\\~~/_______\\~~/_______\\~~~~~~~~~~~~~~~~~~~~
      ~~~~~^~~~~~~~~~~~~~^~~~~~~| |~~~~~~~~| |~~~~~~~~| |~~~~^~~~~~~~~~~~~~~~^~~
      ~~~~~~~~~~~ L A K E   M I N N E T O N K A ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      ~~~~~~~ "Purify yourself in the waters..." ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~~~~~~~~~
                 ___                                                      
               /\`   \`\\                                                \\|/  
              |  \\ _  \\____                                        -- -O- --
              |  (O)   ____>========================================> /|\\ *ZAP!*
               \\       /                       P E W !                 bzzz
               /  ==  /                                              
              /  ==  /_______________                                 
             |  :: :: :: :: :: ::    \`\\                               
~~~~~~~~~~~~~| :: :: :: :: :: :: ::    |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~\\_______________________/~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  ~    ~      ~      ~      ~      ~      ~      ~      ~      ~      ~       
    ~      ~      ~      ~      ~      ~      ~      ~      ~      ~      ~
  `;
};

export const ASCII_TRAIN = (): string => {
  return `
   ====        ________                ___________
 _D|_|  )_____/        \\______________/           |
(  DEV  EXPRESS  ===     ===     ===   [CHOO-CHOO] |
 \`------------------------------------------------'
     (O)(O)            (O)(O)            (O)(O)
  `;
};

export const FORTUNES: string[] = [
  "Today is a great day to write unit tests before debugging in production.",
  "A bug found before merge is worth ten hotfixes in staging.",
  "The best documentation is the code that is so simple it explains itself.",
  "Duck recommends taking a 15-minute walk outside when the compiler complains.",
  "21 CFR Part 11 says: Electronic signatures are forever.",
  "There is no place like 127.0.0.1.",
  "Remember: sudo will not save you from a typo in production.",
  "Laser Loon sees all runtime exceptions and incinerates them on sight.",
];

/**
 * Storage helpers for achievements and meme vault unlock state
 */
export const MEME_STORAGE_KEYS = {
  VAULT_UNLOCKED: "unlocked_meme_vault",
  ACHIEVEMENTS: "meme_achievements_unlocked",
  RETRO_CHAOS_MODE: "retro_chaos_mode_active",
} as const;

export function getUnlockedAchievements(): string[] {
  if (typeof window === "undefined" || !safeIsAvailable()) {
    return [];
  }
  try {
    // Stored as a plain JSON array; malformed JSON comes back from
    // safeGetItem as a string, which is not an array. Copy so callers never
    // mutate safeStorage's cached value.
    const stored = safeGetItem<unknown>(MEME_STORAGE_KEYS.ACHIEVEMENTS);
    return Array.isArray(stored) ? ([...stored] as string[]) : [];
  } catch {
    return [];
  }
}

export function unlockAchievement(achievementId: string): boolean {
  if (typeof window === "undefined" || !safeIsAvailable()) {
    return false;
  }
  try {
    const current = getUnlockedAchievements();
    if (!current.includes(achievementId)) {
      const next = [...current, achievementId];
      if (
        !safeSetRawItem(MEME_STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(next))
      ) {
        return false;
      }
      emitAppEvent("meme_achievement_unlocked", { id: achievementId });
      recordArcadeScore("meme-vault", next.length * 100);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isVaultUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return safeGetRawItem(MEME_STORAGE_KEYS.VAULT_UNLOCKED) === "true";
}

export function setVaultUnlocked(unlocked: boolean = true): void {
  if (typeof window === "undefined" || !safeIsAvailable()) {
    return;
  }
  try {
    // Bare "true"/"false" string, written raw to keep the stored bytes.
    if (
      !safeSetRawItem(
        MEME_STORAGE_KEYS.VAULT_UNLOCKED,
        unlocked ? "true" : "false"
      )
    ) {
      return;
    }
    emitAppEvent("meme_vault_unlocked_change", { unlocked });
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
