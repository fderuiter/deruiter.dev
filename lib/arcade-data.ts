export interface ArcadeGameMetadata {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  genre: string;
  description: string;
  mechanics: string[];
  techStack: string[];
  accentColor: string;
  borderHover: string;
  badgeBg: string;
  storageKey?: string;
  route: string;
}

export const ARCADE_GAMES_METADATA: ArcadeGameMetadata[] = [
  {
    id: "working-with-duck",
    slug: "working-with-duck",
    title: "Working With Duck",
    subtitle: "Pet Simulation & Multitasking Arcade",
    genre: "Pet Simulation Arcade",
    description:
      "You have a deadline. Duck has a ball. Try to keep both the project and the puppy happy.",
    mechanics: [
      "Puppy Hunger/Joy Bars",
      "Treat Physics Toss",
      "Deadlines Countdown",
    ],
    techStack: ["React 19 Hooks", "Physics Step Engine", "TailwindCSS"],
    accentColor: "text-amber-400",
    borderHover:
      "hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "working_with_duck_high_score",
    route: "/arcade/working-with-duck",
  },
  {
    id: "laser-loon",
    slug: "laser-loon",
    title: "Laser Loon: Quest for the State Flag",
    subtitle: "Civic Arcade & Physics Raycast Campaign",
    genre: "Civic Arcade Shooter",
    description:
      "Pilot submission F277 Laser Loon through four campaign acts from Lake Minnetonka to the State Capitol dome, blasting rival flags and red tape.",
    mechanics: [
      "Raycast Laser Optics",
      "Glacial Cryo-Shatter Combos",
      "Loon Tremolo Ultimate",
      "Campaign Boss Battles",
    ],
    techStack: [
      "HTML5 Canvas 2D",
      "Web Audio Dual-Synth",
      "Multi-Phase AI Engine",
    ],
    accentColor: "text-red-400",
    borderHover:
      "hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    badgeBg: "bg-red-500/10 text-red-400 border-red-500/30",
    storageKey: "laser_loon_high_score",
    route: "/arcade/laser-loon",
  },
  {
    id: "quasi-puzzler",
    slug: "quasi-puzzler",
    title: "Quasi-Perfect Puzzler",
    subtitle: "Formal Verification & Lean 4 AST Logic",
    genre: "Formal Logic Puzzle",
    description:
      "Apply tactics to a proof tree and work your way to a complete proof. You can skip a goal with “sorry,” but the score will notice.",
    mechanics: [
      "AST Goal Decomposition",
      "Tactic Inference Engine",
      "Dynamic Proof Tree",
    ],
    techStack: ["Interactive AST Graph", "Formal Methods Solver", "Web Worker"],
    accentColor: "text-purple-400",
    borderHover:
      "hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    storageKey: "quasi_perfect_puzzler_progress_v1",
    route: "/arcade/quasi-puzzler",
  },
  {
    id: "garmin-watch",
    slug: "garmin-watch",
    title: "Monkey C Mayhem: Garmin Schvitz App",
    subtitle: "A Small Watch With a Lot Going On",
    genre: "Embedded Simulation",
    description:
      "Keep a simulated smartwatch running within a 32KB memory budget. Dodge obstacles, clear memory, and wipe the screen when it fogs up.",
    mechanics: [
      "32KB RAM Allocation Tracker",
      "GC Sweep Pressure",
      "Display Condensation Wipe",
    ],
    techStack: [
      "Monkey C Runtime Simulation",
      "Canvas Bitmaps",
      "Memory Profiler",
    ],
    accentColor: "text-amber-400",
    borderHover:
      "hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "garmin_simulator_high_score",
    route: "/arcade/garmin-watch",
  },
  {
    id: "clinical-chaos",
    slug: "clinical-chaos",
    title: "Clinical Trial Chaos: CDISC Compliance",
    subtitle: "FDA 21 CFR Part 11 & SDTM Arcade",
    genre: "Regulatory Compliance Arcade",
    description:
      "Sort clinical data into SDTM domains, sign the submissions, and keep up with the conveyor belt. The auditor is watching. This is a game, so at least there’s a restart button.",
    mechanics: [
      "SDTM Variable Sorting",
      "Part 11 Electronic Signature",
      "Auditor Stress Meter",
    ],
    techStack: [
      "CDISC ODM Validator",
      "Audit Trail Engine",
      "Time-Attack State Machine",
    ],
    accentColor: "text-emerald-400",
    borderHover:
      "hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    storageKey: "clinical_chaos_highscore",
    route: "/arcade/clinical-chaos",
  },
  {
    id: "trial-and-error",
    slug: "trial-and-error",
    title: "Trial & Error: Biostat Ops",
    subtitle: "SAP QC Roguelike Deckbuilder",
    genre: "Roguelike Deckbuilder",
    description:
      "Clinical outputs are the cards. Review tables against the SAP, correct redlines for +Mult, and play Chips × Mult hands to beat regulatory Blinds.",
    mechanics: ["SAP Rulebook QC", "Chips × Mult Hands", "CPU Economy"],
    techStack: [
      "Exact Rational Rounding",
      "Pure Deterministic Reducers",
      "Zod Scenario Contracts",
    ],
    accentColor: "text-amber-400",
    borderHover: "hover:border-amber-500/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "trial_and_error_high_score",
    route: "/arcade/trial-and-error",
  },
  {
    id: "study-director",
    slug: "study-director",
    title: "Study Director: Everything Is Fine",
    subtitle: "Clinical Study Management Simulator",
    genre: "Management Simulation",
    description:
      "Shepherd one study from kickoff to closeout with five attention points a day. Delegate, audit the sites behind the green dashboard, and defend your decisions when the FDA arrives.",
    mechanics: [
      "Daily Attention Budget",
      "Documentation Debt",
      "Site Audits",
      "FDA Inspection Replay",
    ],
    techStack: [
      "Seeded Deterministic Simulation",
      "Causal Risk Model",
      "Decision Log Replay",
    ],
    accentColor: "text-amber-400",
    borderHover: "hover:border-amber-500/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    storageKey: "study_director_high_score",
    route: "/arcade/study-director",
  },
  {
    id: "retro-labyrinth",
    slug: "retro-labyrinth",
    title: "Retro Labyrinth: Graveyard Roguelike",
    subtitle: "Dungeon Crawler & CRT Phosphor Engine",
    genre: "Dungeon Roguelike",
    description:
      "An abandoned codebase, now with corridors. Navigate moving walls, wield developer-themed weapons, and find the FaceForge boss.",
    mechanics: [
      "TSP Dynamic Shifting Walls",
      "Developer Weapons (npm i, git push -f)",
      "3D Wireframe Normal Boss",
    ],
    techStack: [
      "Procedural Maze Generation",
      "3D Projection Engine",
      "CRT Shader Pipeline",
    ],
    accentColor: "text-rose-400",
    borderHover:
      "hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    storageKey: "retro_labyrinth_highscore",
    route: "/arcade/retro-labyrinth",
  },
  {
    id: "meme-vault",
    slug: "meme-vault",
    title: "Meme Vault & Soundboard",
    subtitle: "Developer Soundboard & Easter Egg Trophies",
    genre: "Meme Soundboard & Trophy Room",
    description:
      "Developer & MedTech easter-egg room. Trigger synthesized audio soundbites, collect site easter egg achievements, and browse curated engineering memes.",
    mechanics: [
      "8-Channel Web Audio Soundboard",
      "Easter Egg Achievement Tracker",
      "Interactive Meme Deck",
    ],
    techStack: [
      "Web Audio API",
      "LocalStorage State",
      "Phosphor CRT Shader",
      "React 19",
    ],
    accentColor: "text-emerald-400",
    borderHover:
      "hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    storageKey: "unlocked_meme_vault",
    route: "/arcade/meme-vault",
  },
];
