import type { Metadata } from "next";
import { SITE_BASE_URL } from "@/lib/seo";

export interface RouteMetaConfig {
  title: string;
  description: string;
  path: string;
  canonicalPath?: string;
  keywords?: string[];
  ogType?: "website" | "article";
  inLanguage?: string;
  locale?: string;
  isAccessibleForFree?: boolean;
}

export const ROUTE_METADATA_CONFIGS: Record<string, RouteMetaConfig> = {
  blog: {
    title: "Engineering Dispatches: Blog",
    description:
      "Cross-project retrospectives and technique write-ups on clinical data engineering, formal verification, accessibility, and browser graphics by Fred de Ruiter.",
    path: "/blog",
    keywords: [
      "Engineering Blog",
      "Clinical Data Engineering",
      "Formal Verification",
      "Accessibility Engineering",
      "Canvas Graphics Engineering",
      "Systems Dispatch Newsletter",
    ],
    ogType: "website",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  crf: {
    title: "CRF Studio: Clinical Form Designer",
    description:
      "Build clinical research forms, add validation rules, and try them with sample data. Explore a browser-based study designer by Fred de Ruiter.",
    path: "/crf",
    keywords: [
      "CRF Studio",
      "Clinical Trial Designer",
      "CDISC CDASH Validator",
      "ODM-XML Editor",
      "EDC Simulator",
      "AST Edit Checks",
      "aCRF Overlays",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  mCrf: {
    title: "Mobile CRF Studio for Clinical Forms",
    description:
      "Touch-optimized clinical research form studio designed for mobile viewports, enabling interactive section and field inspection on mobile devices.",
    path: "/m/crf",
    canonicalPath: "/crf",
    keywords: [
      "Mobile CRF Studio",
      "CDASH Mobile Forms",
      "Clinical Trial eCRF Touch",
      "eCRF Field Inspector",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  patrol: {
    title: "Ski Patrol Shift Studio Simulation",
    description:
      "An interactive Midwest ski-patrol judgment simulation foundation powered by deterministic FSM transitions and operational dispatch routines.",
    path: "/patrol",
    keywords: [
      "Patrol Shift Studio",
      "Ski Patrol Simulator",
      "Mountain Dispatch",
      "Operational Judgment",
      "Finite State Machine",
      "Winter Operations",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  mPatrol: {
    title: "Mobile Ski Patrol Shift Studio",
    description:
      "Touch-optimized ski patrol operational judgment simulator built for mobile screens, allowing real-time triage and emergency intervention decisions.",
    path: "/m/patrol",
    canonicalPath: "/patrol",
    keywords: [
      "Mobile Patrol Studio",
      "Ski Patrol Touch Triage",
      "Emergency Operations Dispatch",
      "Mountain Judgment Engine",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  mProof: {
    title: "Mobile Logical Proof Workspace",
    description:
      "Touch-optimized formal logic proof workspace tailored for handheld devices, offering interactive deduction step ledgers and fallacy diagnostics.",
    path: "/m/proof",
    canonicalPath: "/proof",
    keywords: [
      "Mobile Proof Workspace",
      "Formal Logic Touch Ledger",
      "Fallacy Diagnostics Mobile",
      "Interactive Theorem Prover",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  mNeuro: {
    title: "Mobile NeuroRecon Studio Viewer",
    description:
      "Touch-optimized neuroimaging structural morphometry viewer for mobile screens, providing subcortical volumetric metrics and FreeSurfer recon status.",
    path: "/m/neuro",
    canonicalPath: "/neuro",
    keywords: [
      "Mobile NeuroRecon Studio",
      "Subcortical Volumetric Touch",
      "FreeSurfer Morphometry Mobile",
      "Neuroimaging Structural Metrics",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  arcade: {
    title: "Arcade: Browser Games and Puzzles",
    description:
      "Try browser games by Fred de Ruiter: a laser loon, a demanding puppy, logic puzzles, clinical trial games, and a smartwatch with little memory to spare.",
    path: "/arcade",
    keywords: [
      "Engineering Arcade",
      "Canvas Physics Games",
      "Next.js 16 Games",
      "Formal Verification Puzzles",
      "Monkey C Simulator",
      "CDISC Arcade",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  laserLoon: {
    title: "Laser Loon: Quest for the State Flag",
    description:
      "Fly F277 Laser Loon through four campaign acts from Lake Minnetonka to the State Capitol dome, blasting rival flags and red tape in this browser game.",
    path: "/arcade/laser-loon",
    keywords: [
      "Laser Loon Game",
      "Minnesota State Flag F277",
      "Canvas Arcade Shooter",
      "Physics Raycasting Engine",
      "TypeScript Game",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  quasiPuzzler: {
    title: "Formal Verification Puzzler Game",
    description:
      "Apply deductive proof tactics to a tree in this Lean-inspired puzzle game and reach a complete proof. Skipping a goal with “sorry” costs you score.",
    path: "/arcade/quasi-puzzler",
    keywords: [
      "Formal Verification Game",
      "Lean Proof Tactics",
      "AST Logic Puzzles",
      "Deductive Type Theory",
      "Canvas Game Engine",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  garminWatch: {
    title: "Monkey C Mayhem: Garmin Schvitz App",
    description:
      "Keep a simulated smartwatch running within a 32KB memory budget. Dodge obstacles, clear memory, and wipe the screen when it fogs up in Monkey C Mayhem.",
    path: "/arcade/garmin-watch",
    keywords: [
      "Monkey C Mayhem",
      "Garmin Schvitz App",
      "Garmin Connect IQ Simulator",
      "Monkey C Memory Profiling",
      "32KB Embedded RAM",
      "Smartwatch Engine",
      "Retro MIP Simulator",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  clinicalChaos: {
    title: "Clinical Trial Chaos: SDTM Game",
    description:
      "Sort clinical data into SDTM domains, sign the submissions, and keep up with the conveyor belt while the auditor watches. At least there is a restart button.",
    path: "/arcade/clinical-chaos",
    keywords: [
      "CDISC Compliance Game",
      "SDTM Clinical Mapping",
      "21 CFR Part 11 Simulator",
      "FDA Regulatory Audit",
      "Clinical Informatics Arcade",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  trialAndError: {
    title: "Trial & Error: Biostat Deckbuilder",
    description:
      "Clinical outputs are the cards. Review tables against the SAP, correct redlines for +Mult, and play Chips × Mult hands to beat the Blinds in this deckbuilder.",
    path: "/arcade/trial-and-error",
    keywords: [
      "Biostatistics Deckbuilder",
      "Statistical Analysis Plan QC",
      "TLF Quality Control Game",
      "Clinical Trial Roguelike",
      "Deterministic Scoring Engine",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  studyDirector: {
    title: "Study Director: Everything Is Fine",
    description:
      "Walk the floor of a CRO and run a clinical study from kickoff to closeout. Talk to your team, visit the sites, and defend your decisions to the FDA.",
    path: "/arcade/study-director",
    keywords: [
      "Clinical Study Management Simulator",
      "Study Director Game",
      "Clinical Operations Simulation",
      "FDA Inspection Readiness",
      "Documentation Debt",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  pattyDriveThru: {
    title: "Patty's Drive-Thru: A First-Job Diary",
    description:
      "One drive-thru shift from my first job, as a first-person 3D diary game. Fight the register, re-enter the drinks the machine loses, and never stand still.",
    path: "/arcade/patty-drive-thru",
    keywords: [
      "First-Person 3D Game",
      "Autobiographical Game",
      "Drive-Thru Simulator",
      "React Three Fiber",
      "Diary Game",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  protocolDrift: {
    title: "Protocol Drift: Data Pipeline Sim",
    description:
      "A browser-first systems-engineering puzzle simulation exploring the friction between ideal regulatory specifications and messy human clinical data collection.",
    path: "/protocol-drift",
    keywords: [
      "Protocol Drift",
      "Clinical Data Architecture",
      "CDISC SDTM",
      "CDISC ADaM",
      "Systems Simulation",
      "Web Worker Simulation",
      "Clinical Data Management",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  retroLabyrinth: {
    title: "Retro Labyrinth: Graveyard Roguelike",
    description:
      "An abandoned codebase, now with corridors. Navigate moving walls, wield developer-themed weapons, and find the FaceForge boss in this browser roguelike.",
    path: "/arcade/retro-labyrinth",
    keywords: [
      "Legacy Code Roguelike",
      "Procedural Dungeon Generation",
      "TSP Maze Algorithm",
      "Wireframe 3D Canvas",
      "Retro Arcade Crawler",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  workingWithDuck: {
    title: "Working With Duck: Pet Sim Arcade",
    description:
      "You have a deadline. Duck the puppy has a ball. Keep the project and the puppy happy with toys, treats, and park breaks in this browser game.",
    path: "/arcade/working-with-duck",
    keywords: [
      "Developer Pet Simulator",
      "Multitasking Coding Game",
      "Puppy Management Arcade",
      "Canvas Physics Animation",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  proof: {
    title: "Logical Proof Workspace: Step by Step",
    description:
      "Build a proof one step at a time. Connect premises, try inference rules, and inspect where an argument goes wrong. Export finished proofs to Lean 4 or LaTeX.",
    path: "/proof",
    keywords: [
      "Formal Verification Workspace",
      "Deductive Logic Prover",
      "Mathematical Proof DAG",
      "Interactive Logic Assistant",
      "CLI Proof Terminal",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  simulator: {
    title: "Architectural Archetype Simulator",
    description:
      "Pick an architecture bias, triage a production latency spike and review an async pipeline, then see which architectural archetype your trade-offs map to.",
    path: "/simulator",
    keywords: [
      "Architectural Archetype Simulator",
      "Incident Commander Simulator",
      "Production Outage Triage",
      "System Architecture Decision Tree",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  schedule: {
    title: "Book a 30-Minute Chat With Fred",
    description:
      "Pick a time on Google Calendar to talk about a project, ask a question, or say hello. Each booking is a 30-minute Google Meet chat with Fred de Ruiter.",
    path: "/schedule",
    keywords: [
      "Clinical Software Coffee Chat",
      "Tech Talk",
      "Side Project Feedback",
      "Frederick de Ruiter Calendar",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  contact: {
    title: "Contact Fred: Builds, Bugs, Questions",
    description:
      "Working on something interesting, found an open-source bug, or have a clinical data question? Send Fred de Ruiter a note, or book a video chat to talk it over.",
    path: "/contact",
    keywords: [
      "Contact Frederick de Ruiter",
      "Direct Inquiries",
      "Open-Source Collaboration",
      "Clinical Data Systems",
      "Systems Architecture Collaboration",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  neuro: {
    title: "NeuroRecon Studio: Brain Viewer",
    description:
      "Explore brain surfaces and MRI slices, place control points, and work through simulated reconstruction problems in a FreeSurfer-style pipeline simulator.",
    path: "/neuro",
    keywords: [
      "FreeSurfer Cortical Mesh Repair",
      "Neuroimaging CAD Studio",
      "3D Brain Mesh Orthoviews",
      "Euler Characteristic Topology",
      "MRI Slice Inspector",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  stack: {
    title: "Under the Hood: How This Site Works",
    description:
      "See how this site works: text layout, browser audio, the application stack, and the checks I use while building it. Demos and source included.",
    path: "/stack",
    keywords: [
      "Next.js 16 Systems Architecture",
      "Pretext Layout Physics",
      "Web Audio API Synthesis",
      "Engineering Quality Invariants",
      "React 19 Server Stack",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  acknowledgments: {
    title: "Open Source Credits and Licenses",
    description:
      "The open source projects this site is built on, each linked to its home, with versions, licenses and why it is used. Full license texts are included.",
    path: "/acknowledgments",
    keywords: [
      "Open Source Acknowledgments",
      "Third-Party Licenses",
      "Software Bill of Materials",
      "License Compliance",
      "Next.js React Dependencies",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  merch: {
    title: "Laser Loon Merch, Coming Soon",
    description:
      "Laser Loon stickers, shirts, desk mats, mugs and prints, planned at base production cost through Redbubble with no artist markup. The artwork is CC0.",
    path: "/merch",
    keywords: [
      "Laser Loon Merch",
      "Minnesota Flag F277",
      "At-Cost Merchandise",
      "Redbubble",
      "CC0 Artwork",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  wedding: {
    title: "Abbi & Fred: Our Wedding Archive",
    description:
      "An archive of Abbi and Fred's wedding website: the story, the wedding party and photos from the Plummer House in Rochester, Minnesota, on October 10, 2025.",
    path: "/wedding",
    keywords: [
      "Abbi and Fred Wedding",
      "Plummer House Wedding",
      "Rochester Minnesota Wedding",
      "Wedding Photos",
      "Wedding Website Archive",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  memeVault: {
    title: "Meme Vault: Soundboard and Trophies",
    description:
      "Make some noise with a synthesized browser soundboard, discover hidden trophies, and enjoy a few jokes about code, clinical data, and the working day.",
    path: "/arcade/meme-vault",
    keywords: [
      "Developer Meme Vault",
      "Web Audio Soundboard",
      "MedTech Easter Eggs",
      "Achievement Trophy Sandbox",
      "Interactive Retro Arcade",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  offline: {
    title: "You’re Offline: Page Not Saved",
    description:
      "This page has not been saved for offline use. Check your connection, retry the page, or open one of the pages already cached in your browser.",
    path: "/offline",
    keywords: [
      "Progressive Web App Shell",
      "Offline Developer Fallback",
      "Service Worker Cache",
      "Resilient Web Recovery",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  caseStudies: {
    title: "Project Writeups and Case Studies",
    description:
      "Read about the problems, implementation choices, and lessons behind Fred de Ruiter’s clinical data tools, web apps, and side projects, with code on GitHub.",
    path: "/case-studies",
    keywords: [
      "Engineering Case Studies",
      "Clinical Data Systems",
      "CDISC Standards",
      "Systems Architecture",
      "Full-Stack Software Engineering",
    ],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  oxidizeMath: {
    title: "OxidizeMath: Rust Scientific Computing",
    description:
      "Explore scientific computing in Rust with numerical solvers, compile-time checks, and interactive simulations. Read the OxidizeMath writeup.",
    path: "/case-studies/oxidizemath",
    keywords: [
      "Rust Scientific Computing",
      "Verified Numerical Solvers",
      "PDE Simulation Framework",
      "WebAssembly egui Studio",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  laserLoonCaseStudy: {
    title: "Laser Loon: Artwork & Downloads",
    description:
      "Meet Laser Loon, my Minnesota flag submission, and download the artwork in print and web formats. The eye lasers are included in the download.",
    path: "/work/laser-loon",
    keywords: [
      "Laser Loon Vector Download",
      "Minnesota State Flag F277",
      "Open Source Vector Master Files",
      "Creative Commons Asset Hub",
      "Graphic Design Case Study",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  sonosNetworkController: {
    title: "Sonos Network Controller in Python",
    description:
      "Control Sonos speakers on your own network with a Python API and a small web interface. Read about the protocols and implementation choices.",
    path: "/case-studies/sonos-network-controller",
    keywords: [
      "Sonos Local Control Plane",
      "Python FastAPI UPnP",
      "IoT Network Reverse Engineering",
      "AsyncIO Smart Speaker API",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  clintrials: {
    title: "clintrials: Trial Designs in Browser",
    description:
      "Compare adaptive clinical trial designs in a browser workspace. See how Pyodide workers run statistical models without a separate Python setup.",
    path: "/case-studies/clintrials",
    keywords: [
      "Adaptive Clinical Trial Design",
      "Pyodide WebAssembly Biostats",
      "CRM Simulation Algorithm",
      "In Silico Trial Modeling",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  equiposeRandomization: {
    title: "Equipose: Trial Randomization",
    description:
      "Explore reproducible clinical trial randomization in the browser, with generated Python, R, SAS, and Stata code for inspecting the allocation.",
    path: "/case-studies/equipose-randomization",
    keywords: [
      "Clinical Trial Randomization Engine",
      "Deterministic Mersenne Twister",
      "Pocock-Simon Minimization",
      "R Python SAS Stata Code Export",
      "Angular",
      "Web Workers",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  lambdaWave: {
    title: "Lambda-Wave: Respiratory Motion Radar",
    description:
      "Explore respiratory motion tracking for surface guided radiation therapy using FMCW radar, Haskell signal processing, and C++ sample transport.",
    path: "/case-studies/lambda-wave",
    keywords: [
      "SGRT FMCW Radar System",
      "Haskell DSP Pipeline",
      "IEC 62304 Medical Device Software",
      "Real-Time Respiratory Tracking",
      "Biomedical Radar",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  duckDeploy: {
    title: "DuckDeploy: Config to Deployed Forms",
    description:
      "Turn JSON Schema into configuration forms, then compile the values into deployment manifests. See how DuckDeploy uses TypeScript and workers.",
    path: "/case-studies/duckdeploy",
    keywords: [
      "JSON Schema UI Compiler",
      "Polymorphic State Machine",
      "Web Worker Form Synthesis",
      "TypeScript Dynamic UI",
      "Dynamic Form State",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  cardiacRiskModeling: {
    title: "Inspectable Cardiac Risk Models",
    description:
      "Read a cardiac risk modeling project using Python, XGBoost, and SHAP. Explore data leakage, cross-validation, calibration, and model explanations.",
    path: "/case-studies/cardiac-risk-modeling",
    keywords: [
      "Clinical Tabular ML Pipeline",
      "Adversarial Validation",
      "Stratified Cross-Validation",
      "LightGBM Risk Calibration",
      "Healthcare Analytics",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  fourGlory: {
    title: "4Glory: Does Fred Know Ball?",
    description:
      "Does Fred know ball? Compare basketball opinions with Python and XGBoost predictions on NBA data, using rolling features, walk-forward validation, and SHAP.",
    path: "/case-studies/4glory",
    keywords: [
      "Real-Time Sports Analytics",
      "Expected Points Added EPA",
      "Monte Carlo Game Simulation",
      "High-Throughput Data Pipeline",
      "Basketball Outcome Prediction",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  crfXl: {
    title: "CRF.xl: Spreadsheet to Clinical Forms",
    description:
      "Turn Excel protocol grids into clinical form definitions and ODM-XML exports. Read how CRF.xl handles rules, dependencies, and background work.",
    path: "/case-studies/crf-xl",
    keywords: [
      "Spreadsheet to CDISC Compiler",
      "CDASH Protocol Workbook Parser",
      "ODM-XML Export Engine",
      "AST Derivation Logic",
      "Clinical Forms",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  promptOps: {
    title: "PromptOps: Test Prompts Like Code",
    description:
      "Version prompts, validate response shapes, and run regression evaluations in CI. Read how PromptOps makes changes easier to inspect and compare.",
    path: "/case-studies/promptops",
    keywords: [
      "LLM Prompt Orchestration",
      "Deterministic Evaluation Gates",
      "Prompt Semantic Versioning",
      "AI Pipeline Drift Detection",
      "Prompt Engineering",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
  designingForMyBrother: {
    title: "Designing for My Brother: Typography",
    description:
      "A personal case study on cognitive typography: replacing generic fonts with Lexend, Atkinson Hyperlegible, and OpenDyslexic with zero-CLS Pretext reflow.",
    path: "/case-studies/designing-for-my-brother",
    keywords: [
      "Dyslexia Typography",
      "OpenDyslexic",
      "Atkinson Hyperlegible",
      "Lexend",
      "Cognitive Accessibility",
      "Pretext Text Reflow",
      "Zero CLS",
      "WCAG 2.1 AA",
      "ADR 0040",
    ],
    ogType: "article",
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },
};

const TRAILING_BRAND_PATTERN =
  /\s*[|\-\u2013\u2014]\s*(?:Fred|Frederick)\s+de\s+Ruiter\s*$/i;

/**
 * Helper to construct standardized Next.js Metadata for any route configuration.
 */
export function buildRouteMetadata(config: RouteMetaConfig): Metadata {
  const url = `${SITE_BASE_URL}${config.path}`;
  const ogImageUrl = `${SITE_BASE_URL}${config.path.startsWith("/") ? config.path : "/" + config.path}/opengraph-image`;
  // `config.title` must NOT carry the site name. `title` below is templated by
  // app/layout.tsx (`"%s | Frederick de Ruiter"`), so a config that already
  // ends with it renders the name twice in the browser tab and in search
  // results -- "Under the Hood | Frederick de Ruiter | Frederick de Ruiter".
  // Ten routes shipped that way.
  //
  // OpenGraph and Twitter titles are not templated, so they are branded here
  // instead. The short form is matched as well as the long one: the previous
  // guard tested only "Frederick de Ruiter", so the many configs written
  // "... | Fred de Ruiter" were double-branded in social cards too.
  // Any trailing separator (pipe, hyphen, en/em dash) followed by either name
  // form counts as branded, case-insensitively.
  const alreadyBranded = TRAILING_BRAND_PATTERN.test(config.title);
  const fullTitle = alreadyBranded
    ? config.title
    : `${config.title} | Frederick de Ruiter`;

  const lang = config.inLanguage || config.locale || "en-US";
  const ogLocale = lang.replace("-", "_");

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: {
      canonical: config.canonicalPath || config.path,
    },
    openGraph: {
      type: config.ogType || "website",
      url,
      title: fullTitle,
      description: config.description,
      siteName: "Frederick de Ruiter Portfolio",
      locale: ogLocale,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: config.description,
      creator: "@laser_loon",
      images: [ogImageUrl],
    },
    other: {
      inLanguage: lang,
      isAccessibleForFree: String(config.isAccessibleForFree ?? true),
    },
  };
}
