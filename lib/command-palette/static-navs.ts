import {
  CLINICAL_STANDARDS_PROFILE,
  standardCitation,
} from "@/lib/clinical-standards";

/**
 * Tabler icon names a static palette entry can use. The Command Palette maps
 * each name to its icon component, so this file holds no JSX.
 */
export type StaticNavIconName =
  | "IconArticle"
  | "IconBrain"
  | "IconCalendar"
  | "IconCamera"
  | "IconClipboardCheck"
  | "IconCpu"
  | "IconDeviceGamepad2"
  | "IconDirections"
  | "IconFileCode"
  | "IconFileSpreadsheet"
  | "IconFlask"
  | "IconHeadset"
  | "IconHeart"
  | "IconHeartHandshake"
  | "IconRings"
  | "IconSearch"
  | "IconShieldCheck"
  | "IconShoppingBag"
  | "IconSparkles"
  | "IconStethoscope"
  | "IconTerminal";

/** The icon a static palette entry shows: a Tabler icon name and its classes. */
export interface StaticNavIcon {
  name: StaticNavIconName;
  className: string;
}

/**
 * One static Command Palette entry: a first-class route, case study or
 * action, with the preview fields the palette shows beside it.
 */
export interface StaticNavEntry {
  id: string;
  title: string;
  subtitle: string;
  category: "case-study" | "navigation";
  url: string;
  icon: StaticNavIcon;
  techStack?: string[];
  highlights?: string[];
  status?: string;
  description?: string;
  badge?: string;
  /** Title, badge and status shown instead while dyslexia mode is on. */
  whenDyslexiaModeOn?: {
    title: string;
    badge: string;
    status: string;
  };
}

/**
 * The Command Palette's static entries, in the order the palette lists them.
 * This is the Command Palette point of the discovery matrix (AGENTS.md
 * section 3): every first-class route needs an entry here.
 */
export const STATIC_NAVS: readonly StaticNavEntry[] = [
  {
    id: "nav-work",
    title: "Work",
    subtitle:
      "The problems, implementation choices, and lessons behind my clinical data tools, web apps, and side projects.",
    category: "navigation",
    url: "/case-studies",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Showcase",
    status: "Project Collection",
    description:
      "The problems, implementation choices, and lessons behind my clinical data tools, web apps, and side projects.",
    techStack: ["Next.js 16", "React 19", "Tailwind CSS", "TypeScript"],
    highlights: [
      "Project summaries and technical writeups",
      "Live telemetry event logging",
      "Direct GitHub repository & demo links",
    ],
  },
  {
    id: "nav-blog",
    title: "Blog",
    subtitle:
      "Cross-project retrospectives, technique write-ups, and field notes.",
    category: "navigation",
    url: "/blog",
    icon: { name: "IconArticle", className: "w-4 h-4 text-accent" },
    badge: "Dispatches",
    status: "Engineering Writing",
    description:
      "Cross-project retrospectives, technique write-ups, and field notes: the long-tail arm of the search funnel and the home of the Systems Dispatch Newsletter archive.",
    techStack: ["Next.js 16", "Prisma", "Neon Postgres"],
    highlights: [
      "Clinical data engineering & CDISC standards",
      "Formal verification & AST/compiler theory",
      "Accessibility, canvas graphics & DX tooling",
    ],
  },
  {
    id: "nav-about",
    title: "About Frederick (Bio & Timeline)",
    subtitle:
      "Clinical research, Vikings training camp, ski patrol, and the route that brought me to building software.",
    category: "navigation",
    url: "/#about",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Bio & Skills",
    status: "Origin Story",
    description:
      "Clinical research, Vikings training camp, ski patrol, and the route that brought me to building software.",
    techStack: [
      "TypeScript",
      "Mayo Clinic Operations",
      "Interactive Graphics",
      "Emergency Triage",
    ],
    highlights: [
      "Interactive skills matrix with audio feedback",
      "Mayo Clinic operations & research track record",
      "Authentic career timeline & stories",
    ],
  },
  {
    id: "nav-contact",
    title: "Contact",
    subtitle:
      "Have a project, a role, or a question in mind? Send me a note or find a time to talk.",
    category: "navigation",
    url: "/contact",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Direct Inquiries",
    status: "Contact Form",
    description:
      "Have a project, a role, or a question in mind? Send me a note or find a time to talk.",
    techStack: ["Next.js 16", "Resend API", "Zod", "Rate Limiting", "Honeypot"],
    highlights: [
      "Messages delivered to my inbox",
      "Automated instant confirmation receipt",
      "Spam protection",
    ],
  },
  {
    id: "nav-arcade",
    title: "Arcade",
    subtitle:
      "A laser loon, a demanding puppy, logic puzzles, and a watch with very little memory. Try my browser games.",
    category: "navigation",
    url: "/arcade",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Arcade Hub",
    status: "Interactive 60 FPS",
    description:
      "A laser loon, a demanding puppy, logic puzzles, and a watch with very little memory. Try my browser games.",
    techStack: [
      "Canvas 2D",
      "Web Audio API",
      "Framer Motion",
      "Physics Engine",
    ],
    highlights: [
      "Zero-dependency custom physics engines",
      "Synthesized 8-bit & retro audio chips",
      "Virtual D-Pad touch controls on mobile",
    ],
  },
  {
    id: "nav-newsletter",
    title: "Project Notes Newsletter",
    subtitle:
      "Have a project, a role, or a question in mind? Send me a note or find a time to talk.",
    category: "navigation",
    url: "/contact",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Newsletter",
    status: "Bi-Weekly",
    description:
      "Have a project, a role, or a question in mind? Send me a note or find a time to talk.",
    techStack: [
      "Resend API",
      "Next.js 16",
      "TypeScript",
      "Transactional Email",
    ],
    highlights: [
      "Formal verification & logic AST case studies",
      "Clinical EDC & CDISC architectural breakdowns",
      "Occasional project updates",
    ],
  },
  {
    id: "nav-oxidizemath",
    title: "OxidizeMath: Verified Numerical Framework in Rust",
    subtitle:
      "A Rust scientific computing framework exploring numerical solvers, compile-time checks, and interactive simulations. The aim is to keep the mathematical model and the code that runs it close together.",
    category: "navigation",
    url: "/case-studies/oxidizemath",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Rust / WASM",
    description:
      "A Rust scientific computing framework exploring numerical solvers, compile-time checks, and interactive simulations. The aim is to keep the mathematical model and the code that runs it close together.",
    techStack: [
      "Rust",
      "WebAssembly",
      "egui",
      "Formal Verification",
      "PDE Solver",
    ],
    highlights: [
      "10+ crate domain monorepo architecture",
      "Compile-time LaTeX proc-macro verification",
      "Zero-copy double-buffered state execution",
    ],
  },
  {
    id: "nav-sonos-network-controller",
    title: "Sonos Network Controller: Technical Breakdown & Architecture",
    subtitle:
      "A local Sonos controller built with Python, FastAPI, and HTMX. It talks to speakers over UPnP/SOAP and exposes a REST API for playback control on your own network.",
    category: "navigation",
    url: "/case-studies/sonos-network-controller",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Python / IoT",
    description:
      "A local Sonos controller built with Python, FastAPI, and HTMX. It talks to speakers over UPnP/SOAP and exposes a REST API for playback control on your own network.",
    techStack: [
      "Python",
      "FastAPI",
      "AsyncIO",
      "UPnP/SOAP",
      "HTMX",
      "TailwindCSS",
    ],
    highlights: [
      "Sub-10ms route dispatch latency using FastAPI and async I/O",
      "10s TTL SSDP multicast memoization cache eliminating socket exhaustion",
      "Hypermedia-driven HTMX single-page architecture for low-power edge hosting",
    ],
  },
  {
    id: "nav-clintrials",
    title: "clintrials: Adaptive Clinical Trial Design & WebAssembly Engine",
    subtitle:
      "A browser-based workspace for comparing adaptive clinical trial designs. Pyodide workers run models including CRM, EffTox, group sequential designs, and win ratio analyses.",
    category: "navigation",
    url: "/case-studies/clintrials",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Python / WASM",
    description:
      "A browser-based workspace for comparing adaptive clinical trial designs. Pyodide workers run models including CRM, EffTox, group sequential designs, and win ratio analyses.",
    techStack: [
      "Python",
      "Pyodide",
      "WebAssembly",
      "Biostatistics",
      "Service Worker",
    ],
    highlights: [
      "Zero backend infrastructure costs via Web Workers",
      "Deterministic numerical parity with CPython",
      "Bayesian CRM & EffTox dose finding algorithms",
    ],
  },
  {
    id: "nav-equipose-randomization",
    title:
      "Equipose Randomization: Technical Breakdown & Portfolio Integration",
    subtitle:
      "A browser-based tool for stratified block and minimization randomization. A seeded Mersenne Twister (MT19937) makes schedules reproducible, and they export as R, Python, SAS, and Stata scripts.",
    category: "navigation",
    url: "/case-studies/equipose-randomization",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Angular / TS",
    description:
      "A browser-based tool for stratified block and minimization randomization. A seeded Mersenne Twister (MT19937) makes schedules reproducible, and they export as R, Python, SAS, and Stata scripts.",
    techStack: [
      "Angular",
      "TypeScript",
      "Web Workers",
      "NgRx SignalStore",
      "Code Generation",
    ],
    highlights: [
      "Seeded MT19937 schedules, reproducible from the seed",
      "Client-side generation with an off-main-thread Web Worker",
      "Pocock-Simon covariate adaptive minimization",
    ],
  },
  {
    id: "nav-lambda-wave",
    title: "Lambda-Wave: Real-Time SGRT FMCW Radar System",
    subtitle:
      "An FMCW radar project exploring respiratory motion tracking for Surface Guided Radiation Therapy. Haskell handles signal processing; C++ ring buffers move samples between stages.",
    category: "navigation",
    url: "/case-studies/lambda-wave",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Haskell / C++",
    description:
      "An FMCW radar project exploring respiratory motion tracking for Surface Guided Radiation Therapy. Haskell handles signal processing; C++ ring buffers move samples between stages.",
    techStack: [
      "Haskell",
      "C++",
      "OpenGL",
      "DSP",
      "IEC 62304",
      "Real-Time Systems",
    ],
    highlights: [
      "Sub-10ms end-to-end processing & respiratory gating latency",
      "Lock-free C++ circular ring buffer zero-copy FFI bridge",
      "Safety-critical watchdog interlock meeting IEC 62304 Class C",
    ],
  },
  {
    id: "nav-duckdeploy",
    title: "DuckDeploy: Schema-Driven Dynamic UI Engine",
    subtitle:
      "A TypeScript tool that turns JSON Schema into configuration forms, then compiles their values into Kubernetes, Helm, or Cloud Run manifests. Web Workers keep compilation off the UI thread.",
    category: "navigation",
    url: "/case-studies/duckdeploy",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "TypeScript / UI",
    description:
      "A TypeScript tool that turns JSON Schema into configuration forms, then compiles their values into Kubernetes, Helm, or Cloud Run manifests. Web Workers keep compilation off the UI thread.",
    techStack: [
      "TypeScript",
      "React 19",
      "Web Workers",
      "JSON Schema",
      "Zod",
      "State Machine",
    ],
    highlights: [
      "Sub-5ms Web Worker JSON Schema manifest compilation",
      "Zero-eval polymorphic form state synthesizer",
      "AST-level schema dependency resolution",
    ],
  },
  {
    id: "nav-cardiac-risk-modeling",
    title: "Predictive Cardiac Risk Modeling Pipeline",
    subtitle:
      "A Python cardiac risk modeling project using XGBoost, LightGBM, calibration, and SHAP explanations. The writeup examines data leakage, distribution shift, and how to evaluate the predictions.",
    category: "navigation",
    url: "/case-studies/cardiac-risk-modeling",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Python / ML",
    description:
      "A Python cardiac risk modeling project using XGBoost, LightGBM, calibration, and SHAP explanations. The writeup examines data leakage, distribution shift, and how to evaluate the predictions.",
    techStack: [
      "Python",
      "LightGBM",
      "Scikit-Learn",
      "SHAP",
      "Adversarial Validation",
      "ROC-AUC",
    ],
    highlights: [
      "Adversarial validation detecting covariate distribution drift",
      "Leak-free 5-fold Stratified OOF ensemble architecture",
      "Brier-calibrated probabilistic clinical risk outputs",
    ],
  },
  {
    id: "nav-4glory",
    title: "4Glory | Does Fred Know Ball?: Sports Analytics Engine",
    subtitle:
      "A Python basketball prediction project that compares my basketball judgment with XGBoost models across NBA seasons. Includes rolling features, walk-forward validation, and SHAP analysis. Confidence is easy; checking it takes a dataset.",
    category: "navigation",
    url: "/case-studies/4glory",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Full Stack / Analytics",
    description:
      "A Python basketball prediction project that compares my basketball judgment with XGBoost models across NBA seasons. Includes rolling features, walk-forward validation, and SHAP analysis. Confidence is easy; checking it takes a dataset.",
    techStack: [
      "TypeScript",
      "Python",
      "Monte Carlo",
      "EPA Modeling",
      "Next.js 16",
      "TailwindCSS",
    ],
    highlights: [
      "Sub-15ms real-time EPA and win probability evaluation",
      "10,000-run vectorized Monte Carlo tournament simulator",
      "Interactive prediction calibration ledger",
    ],
  },
  {
    id: "nav-crf-xl",
    title: "CRF.xl: Spreadsheet-to-CDISC CRF Compiler",
    subtitle:
      "An Excel add-in that turns protocol spreadsheets into CDISC CDASH forms and ODM-XML exports. It checks rule dependencies and runs compilation in background workers so the workbook stays usable.",
    category: "navigation",
    url: "/case-studies/crf-xl",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "CDISC / Compiler",
    description:
      "An Excel add-in that turns protocol spreadsheets into CDISC CDASH forms and ODM-XML exports. It checks rule dependencies and runs compilation in background workers so the workbook stays usable.",
    techStack: [
      "TypeScript",
      "CDISC CDASH",
      "ODM-XML",
      "AST Engine",
      "Excel Parser",
      "21 CFR Part 11",
    ],
    highlights: [
      "Zero-dependency Excel AST formula transpiler",
      `Automated CDISC ${standardCitation("CDASHIG")} variable mapping linter`,
      `Deterministic ODM-XML v${CLINICAL_STANDARDS_PROFILE.ODM} export generator`,
    ],
  },
  {
    id: "nav-promptops",
    title: "PromptOps: LLM Prompt Orchestration & Eval Engine",
    subtitle:
      "A TypeScript toolkit for versioning prompts, validating output with Zod, and running regression evaluations in CI. A prompt change should come with a way to check what changed in the results.",
    category: "navigation",
    url: "/case-studies/promptops",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "LLM / DevOps",
    description:
      "A TypeScript toolkit for versioning prompts, validating output with Zod, and running regression evaluations in CI. A prompt change should come with a way to check what changed in the results.",
    techStack: [
      "TypeScript",
      "Python",
      "LLM Evals",
      "SemVer",
      "RAG",
      "CI/CD Pipeline",
    ],
    highlights: [
      "Automated prompt drift and regression test harness",
      "Semantic versioning and schema lock for LLM prompts",
      "Zero-cost local deterministic evaluation mock suites",
    ],
  },
  {
    id: "nav-study-data-pipeline-case-study",
    title: "Study Data Pipeline: USDM to SDTM, ADaM and TLFs",
    subtitle:
      "How one synthetic study travels from a USDM definition through SDTM, ADaM and Define-XML to tables and figures, with lineage from every result back to its records.",
    category: "navigation",
    url: "/case-studies/study-data-pipeline",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Case Study",
    status: "Clinical Data",
    description:
      "How one synthetic study travels from a USDM definition through SDTM, ADaM and Define-XML to tables and figures, with lineage from every result back to its records.",
    techStack: ["TypeScript", "USDM", "SDTM", "ADaM", "Define-XML", "ARS"],
    highlights: [
      "Seeded synthetic data, byte-identical packages per seed",
      "Independent QC of the key derivations across 200 seeds",
      "Reviewer guides written from each run",
    ],
  },
  {
    id: "nav-laser-loon",
    title: "Laser Loon: Quest for the State Flag",
    subtitle:
      "Fly toward the Minnesota State Capitol, battle rival flags, and blast through red tape in this browser arcade game.",
    category: "navigation",
    url: "/arcade/laser-loon",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-red-400" },
    badge: "Physics Shooter",
    status: "60 FPS Arcade",
    description:
      "Fly toward the Minnesota State Capitol, battle rival flags, and blast through red tape in this browser arcade game.",
    techStack: [
      "Canvas 2D",
      "Vector Physics",
      "Web Audio API",
      "Particle Systems",
    ],
    highlights: [
      "High-performance 60 FPS particle engine",
      "Multi-stage boss battle mechanics",
      "Accessible keyboard & virtual D-Pad controls",
    ],
  },
  {
    id: "nav-laser-loon-cs",
    title: "The Laser Loon: Graphic Design Case Study & Open Asset Hub",
    subtitle:
      "Meet my Minnesota flag submission and download the loon, lasers included, in print and web formats.",
    category: "navigation",
    url: "/work/laser-loon",
    icon: { name: "IconDirections", className: "w-4 h-4 text-amber-400" },
    badge: "Graphic Design",
    status: "Vector Assets",
    description:
      "Meet my Minnesota flag submission and download the loon, lasers included, in print and web formats.",
    techStack: [
      "Graphic Design",
      "Adobe Illustrator",
      "Adobe Photoshop",
      "Vector Optics",
      "CC0",
    ],
    highlights: [
      "Side-by-side vector pass comparison viewer",
      "7 production file classifications + 1-click ZIP archive",
      "Creative Commons CC0 public domain dedication",
    ],
  },
  {
    id: "nav-quasi-puzzler",
    title: "Quasi-Perfect Puzzler",
    subtitle:
      "Apply tactics to a proof tree in this Lean-inspired puzzle game. Complete the proof before your simulated memory runs out.",
    category: "navigation",
    url: "/arcade/quasi-puzzler",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Logic Puzzler",
    status: "Formal Tactics",
    description:
      "Apply tactics to a proof tree in this Lean-inspired puzzle game. Complete the proof before your simulated memory runs out.",
    techStack: [
      "Lean 4 Grammar",
      "AST Validator",
      "State Machine",
      "Canvas 2D",
    ],
    highlights: [
      "Simulated theorem goal discharges",
      "Bounded RAM consumption constraints",
      "Interactive theorem tree visualizer",
    ],
  },
  {
    id: "nav-clinical-chaos",
    title: "Clinical Trial Chaos: CDISC Compliance Arcade",
    subtitle:
      "Sort clinical data, fix entries, and sign submissions against the clock in this clinical research arcade game.",
    category: "navigation",
    url: "/arcade/clinical-chaos",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Regulatory Arcade",
    status: "Audit Simulation",
    description:
      "Sort clinical data, fix entries, and sign submissions against the clock in this clinical research arcade game.",
    techStack: [
      "CDASH Standards",
      "21 CFR Part 11",
      "Canvas 2D",
      "Timer Engine",
    ],
    highlights: [
      "Real-time CDASH domain variable mapping",
      "Discrepancy query resolution clock",
      "Audit trail integrity scoring",
    ],
  },
  {
    id: "nav-trial-and-error",
    title: "Trial & Error: Biostat Ops",
    subtitle:
      "Review clinical tables against the SAP and play Chips × Mult hands to beat regulatory Blinds.",
    category: "navigation",
    url: "/arcade/trial-and-error",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Deckbuilder",
    status: "Campaign",
    description:
      "Carry one fictional compound through three studies to CSR Lock, QCing outputs against the SAP, then continue into post-marketing rounds.",
    techStack: ["Zod", "Pure Reducers", "Seeded Runs"],
    highlights: [
      "Three studies, each ending at a Boss",
      "Relics, packs and a Procurement Shop",
      "Endless post-marketing rounds",
    ],
  },
  {
    id: "nav-study-director",
    title: "Study Director: Everything Is Fine",
    subtitle:
      "Walk the floor of a CRO, run a clinical study from kickoff to closeout, and defend your decisions to the FDA.",
    category: "navigation",
    url: "/arcade/study-director",
    icon: { name: "IconClipboardCheck", className: "w-4 h-4 text-accent" },
    badge: "Simulation",
    status: "Playable",
    description:
      "Shepherd one study from kickoff to database lock. Walk the office, talk to your team, visit the sites behind the green dashboard, and see which decisions the inspector asks about. The classic desk is one click away.",
    techStack: ["Seeded Simulation", "Causal Model", "Decision Log"],
    highlights: [
      "A walkable office with a team on schedules",
      "Site visits and a day that costs minutes and energy",
      "Documentation debt comes due at inspection",
      "Discover which kind of Study Director you are",
    ],
  },
  {
    id: "nav-patty-drive-thru",
    title: "Patty's Drive-Thru",
    subtitle:
      "One shift at the drive-thru window of my first job, as a first-person 3D diary entry.",
    category: "navigation",
    url: "/arcade/patty-drive-thru",
    icon: { name: "IconHeadset", className: "w-4 h-4 text-accent" },
    badge: "Diary",
    status: "Playable",
    description:
      "Stand in the booth for one compressed shift: take orders through the headset, fight a register that hides the easy things, re-enter the drinks the machine loses and keep moving so the manager does not notice. The chain is fictional and the people are renamed.",
    techStack: ["React Three Fiber", "Seeded Engine", "Web Audio"],
    highlights: [
      "A fluorescent first-person booth",
      "A register built to be fought",
      "Fully playable from the keyboard",
      "A pay stub and a closing note",
    ],
  },
  {
    id: "nav-for-better-or-bulk",
    title: "For Better or Bulk",
    subtitle:
      "Set up our Costco wedding before the 4:00 ceremony, solo or as two players on one keyboard.",
    category: "navigation",
    url: "/arcade/for-better-or-bulk",
    icon: { name: "IconRings", className: "w-4 h-4 text-accent" },
    badge: "Co-op",
    status: "Playable",
    description:
      "A real-time setup rush based on our wedding, which came in under $4,000, mostly from Costco. Arrange Kirkland roses, grill hot dogs before they burn, stack chairs and hang lanterns while phone calls about the website and a text from Fred's brothers get in the way. The receipt at the end explains what happened.",
    techStack: ["Fixed-Step Engine", "Canvas 2D", "Couch Co-op"],
    highlights: [
      "Two players on one keyboard",
      "Website features that block phone calls",
      "A brothers' text that pauses the clock",
      "A receipt, not a grade",
    ],
  },
  {
    id: "nav-protocol-drift",
    title: "Protocol Drift: Regulatory Simulation Workbench",
    subtitle:
      "Design the trial. Debug reality. A node-graph pipeline simulation across CDISC SDTM and ADaM, coordinator fatigue and a protocol amendment.",
    category: "navigation",
    url: "/protocol-drift",
    icon: { name: "IconShieldCheck", className: "w-4 h-4 text-amber-400" },
    badge: "Simulation",
    status: "CDISC Architecture",
    description:
      "Browser-native systems simulation puzzle. Construct a clinical data pipeline, query sites with evidence, survive a mid-flight protocol amendment and clear a dual Database Lock.",
    techStack: [
      "Next.js 16",
      "React 19",
      "@xyflow/react",
      "Web Workers",
      "Web Audio API",
      "CDISC SDTM/ADaM",
    ],
    highlights: [
      "Pure TypeScript deterministic simulation Web Worker",
      "Dual-lane Tabulation (SDTM) and Analysis (ADaM) pipeline canvas",
      "Evidence-linked query engine with coordinator fatigue modeling",
    ],
  },
  {
    id: "nav-garmin-watch",
    title: "Monkey C Mayhem: A Garmin 5K Platformer",
    subtitle:
      "Stomp Couch Potatoes, jump Hurdles, and keep your Body Battery above zero on a simulated Garmin watch.",
    category: "navigation",
    url: "/arcade/garmin-watch",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Monkey C Mayhem",
    status: "A Garmin 5K Platformer",
    description:
      "Stomp Couch Potatoes, jump Hurdles, and keep your Body Battery above zero on a simulated Garmin watch.",
    techStack: [
      "Connect IQ Specs",
      "Memory Profiler",
      "GC Simulator",
      "Canvas 2D",
    ],
    highlights: [
      "32KB hard heap budget simulation",
      "Mark-and-sweep GC freeze penalties",
      "Thermal envelope clock management",
    ],
  },
  {
    id: "nav-working-with-duck",
    title: "Working With Duck: Pet Simulation Arcade",
    subtitle:
      "You have a deadline. Duck has a ball. Keep the project and the puppy happy in this browser game.",
    category: "navigation",
    url: "/arcade/working-with-duck",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-amber-400" },
    badge: "Pet Simulation",
    status: "Puppy AI Active",
    description:
      "You have a deadline. Duck has a ball. Keep the project and the puppy happy in this browser game.",
    techStack: [
      "Behavior Tree AI",
      "State Machine",
      "Web Audio API",
      "Canvas 2D",
    ],
    highlights: [
      "Autonomous puppy mood & energy engine",
      "Simulated sprint deadline crunch",
      "Interactive belly rub & treat triggers",
    ],
  },
  {
    id: "nav-retro-labyrinth",
    title: "Retro Labyrinth: Graveyard Roguelike",
    subtitle:
      "Explore an abandoned codebase as a shifting dungeon. Fight bugs, navigate moving walls, and face a wireframe boss.",
    category: "navigation",
    url: "/arcade/retro-labyrinth",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Dungeon Roguelike",
    status: "7-Room Campaign",
    description:
      "Explore an abandoned codebase as a shifting dungeon. Fight bugs, navigate moving walls, and face a wireframe boss.",
    techStack: [
      "TSP Algorithms",
      "Raycasting 3D",
      "Hand-Built Rooms",
      "Canvas 2D",
    ],
    highlights: [
      "Seven hand-built rooms ending in two wireframe bosses",
      "Wireframe 3D vector boss rendering",
      "CRT phosphor scanline post-processing",
    ],
  },
  {
    id: "nav-proof",
    title: "Logical Proof Workspace",
    subtitle:
      "Build a proof one step at a time. Connect premises, try inference rules, and inspect where an argument goes wrong.",
    category: "navigation",
    url: "/proof",
    icon: { name: "IconTerminal", className: "w-4 h-4 text-accent" },
    badge: "Formal Verification",
    status: "Theorem Engine",
    description:
      "Build a proof one step at a time. Connect premises, try inference rules, and inspect where an argument goes wrong.",
    techStack: ["Lean 4", "Propositional AST", "DAG Engine", "Web Workers"],
    highlights: [
      "AST-level Fallacy counterexample engine",
      "Distributed consensus theorem templates",
      "Multi-format Lean 4 & LaTeX export",
    ],
  },
  {
    id: "nav-neuro",
    title: "NeuroRecon: FreeSurfer Pipeline Simulator",
    subtitle:
      "Explore brain surfaces and MRI slices, place control points, and work through simulated reconstruction problems.",
    category: "navigation",
    url: "/neuro",
    icon: { name: "IconBrain", className: "w-4 h-4 text-accent" },
    badge: "Neuroimaging CAD",
    status: "WebGL 3D Active",
    description:
      "Explore brain surfaces and MRI slices, place control points, and work through simulated reconstruction problems.",
    techStack: ["Three.js", "WebGL 2", "Marching Cubes", "Medical Imaging"],
    highlights: [
      "Coronal, Sagittal, and Axial slice views",
      "Automated 3D surface mesh generation",
      "Context loss auto-recovery handler",
    ],
  },
  {
    id: "nav-crf",
    title: "Case report form designer (CRF Studio)",
    subtitle:
      "Build clinical research forms, add validation rules, and try them with sample data in a browser-based study designer.",
    category: "navigation",
    url: "/crf",
    icon: { name: "IconFileSpreadsheet", className: "w-4 h-4 text-accent" },
    badge: "Clinical Data Suite",
    status: "21 CFR Part 11",
    description:
      "Build clinical research forms, add validation rules, and try them with sample data in a browser-based study designer.",
    techStack: ["CDISC ODM-XML", "NCI Thesaurus", "Zero-Eval AST", "FHIR SDC"],
    highlights: [
      "12-column clinical grid & visit schedule",
      "Automated CDASH regulatory remediation",
      "Multi-role simulated investigator sign-off",
    ],
  },
  {
    id: "nav-patrol-shift",
    title: "Patrol Shift Studio: Midwest Ski Patrol Simulator",
    subtitle:
      "Midwest ski-patrol operational judgment simulation and state machine foundation.",
    category: "navigation",
    url: "/patrol",
    icon: { name: "IconShieldCheck", className: "w-4 h-4 text-accent" },
    badge: "Foundation Scaffold",
    status: "M1 Scaffold Active",
    description:
      "Midwest ski-patrol operational judgment simulation and state machine foundation.",
    techStack: ["Next.js 16", "Canvas 2D"],
    highlights: ["Triage simulation", "OET physics engine"],
  },
  {
    id: "nav-stack",
    title: "Under the Hood: Architecture & Stack Overview",
    subtitle:
      "See how this site works: text layout, browser audio, the application stack, and the checks I use while building it.",
    category: "navigation",
    url: "/stack",
    icon: { name: "IconCpu", className: "w-4 h-4 text-accent" },
    badge: "Architecture",
    status: "Live Blueprint",
    description:
      "See how this site works: text layout, browser audio, the application stack, and the checks I use while building it.",
    techStack: [
      "Next.js 16",
      "Pretext Canvas",
      "Web Audio API",
      "Prisma 7",
      "Vitest",
    ],
    highlights: [
      "Real-time Pretext vs DOM reflow benchmark",
      "Zero-asset procedural audio soundboard",
      "12 verified architectural quality invariants",
    ],
  },
  {
    id: "nav-merch",
    title: "Laser Loon Merch",
    subtitle:
      "Flag stickers, shirts, desk mats, mugs and prints at base cost. Coming soon.",
    category: "navigation",
    url: "/merch",
    icon: { name: "IconShoppingBag", className: "w-4 h-4 text-amber-400" },
    badge: "Merch",
    status: "Coming Soon",
    description:
      "Planned Laser Loon merchandise at base production cost through Redbubble, with no artist markup. The artwork is CC0.",
    techStack: ["Redbubble", "CC0 Artwork", "Next.js 16", "Container Queries"],
    highlights: [
      "Five planned products with no checkout on this site",
      "Priced at Redbubble base cost, no artist markup",
      "Free vector files if you would rather print your own",
    ],
  },
  {
    id: "nav-acknowledgments",
    title: "Open Source Credits and Licenses",
    subtitle:
      "The open source projects this site is built on, with versions, licenses and links to each project.",
    category: "navigation",
    url: "/acknowledgments",
    icon: { name: "IconHeartHandshake", className: "w-4 h-4 text-emerald-400" },
    badge: "Credits",
    status: "License Compliant",
    description:
      "The open source projects this site is built on, with versions, licenses and links to each project.",
    techStack: ["npm", "SPDX Licenses", "Third-Party Notices", "Next.js 16"],
    highlights: [
      "Direct dependencies grouped by purpose",
      "Searchable list of every shipped package",
      "Full license texts in third-party notices",
    ],
  },
  {
    id: "nav-wedding",
    title: "Abbi & Fred: Our Wedding Archive",
    subtitle:
      "The story, wedding party and photos from Abbi and Fred's wedding at the Plummer House, October 10, 2025.",
    category: "navigation",
    url: "/wedding",
    icon: { name: "IconHeart", className: "w-4 h-4 text-amber-400" },
    badge: "Archive",
    status: "One Year On",
    description:
      "A static archive of the wedding website, put back up for the first anniversary.",
    techStack: ["Next.js 16", "next/image", "Static Rendering"],
    highlights: [
      "Sixteen photos from the day, with the full album linked",
      "The story and wedding party from the original site",
      "No database: guest data stayed with the original app",
    ],
  },
  {
    id: "nav-simulator",
    title: "Architectural Archetype Simulator",
    subtitle:
      "Pick an architecture bias, triage an outage and review a pipeline, then see which architectural archetype your trade-offs map to.",
    category: "navigation",
    url: "/simulator",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Simulator",
    status: "Incident Triage",
    description:
      "Pick an architecture bias, triage an outage and review a pipeline, then see which architectural archetype your trade-offs map to.",
    techStack: [
      "State Machine",
      "Decision Trees",
      "Telemetry Hooks",
      "Framer Motion",
    ],
    highlights: [
      "Live incident triage scenarios",
      "Deterministic four-axis archetype scoring",
      "Copyable decision report",
    ],
  },
  {
    id: "nav-schedule",
    title: "Say Hi / Book a Chat",
    subtitle:
      "Find a time to talk about a project, ask a question, or introduce yourself. Book a 30-minute Google Meet call.",
    category: "navigation",
    url: "/schedule",
    icon: { name: "IconCalendar", className: "w-4 h-4 text-accent" },
    badge: "Sync Scheduler",
    status: "Live Calendar",
    description:
      "Find a time to talk about a project, ask a question, or introduce yourself. Book a 30-minute Google Meet call.",
    techStack: ["Next.js 16", "Calendar API", "Timezone Engine", "WCAG 2.1 AA"],
    highlights: [
      "Timezone-aware slot availability",
      "Accessible keyboard-driven date selection",
      "Zero-friction confirmation workflow",
    ],
  },
  {
    id: "nav-meme-vault",
    title: "Meme Vault & Soundboard",
    subtitle:
      "Repeat the vault's sequence in Echo, find hidden trophies, and enjoy a few jokes about code and clinical data.",
    category: "navigation",
    url: "/arcade/meme-vault",
    icon: { name: "IconDeviceGamepad2", className: "w-4 h-4 text-emerald-400" },
    badge: "Meme Soundboard",
    status: "8-Bit Audio Active",
    description:
      "Repeat the vault's sequence in Echo, find hidden trophies, and enjoy a few jokes about code and clinical data.",
    techStack: ["Web Audio API", "React 19", "LocalStorage"],
    highlights: [
      "Echo: repeat a growing pad sequence",
      "8-channel synthesized retro soundboard",
      "6 collectible site achievements",
      "Interactive meme quotes & sound triggers",
    ],
  },
  {
    id: "nav-offline",
    title: "Offline Fallback View",
    subtitle:
      "Check your connection, retry this page, or explore pages saved for offline use.",
    category: "navigation",
    url: "/offline",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
    badge: "Offline Shell",
    status: "Fallback View",
    description:
      "Check your connection, retry this page, or explore pages saved for offline use.",
    techStack: ["Serwist", "Service Worker", "Cache-First", "React 19"],
    highlights: [
      "Precaching core application shell routes",
      "Cache-first 3D asset caching with procedural fallback",
      "Bypasses error-tracking telemetry endpoints",
    ],
  },
  {
    id: "nav-admin",
    title: "Admin",
    subtitle: "Navigate to Admin view",
    category: "navigation",
    url: "/admin",
    icon: { name: "IconDirections", className: "w-4 h-4 text-accent" },
  },
  {
    id: "nav-photos",
    title: "Behind the Code · Visual Archive",
    subtitle:
      "14 authentic photographs spanning Duck's puppy-to-adult journey, Theodore Wirth 10K, and alpine skiing.",
    category: "navigation",
    url: "action:photos",
    icon: { name: "IconCamera", className: "w-4 h-4 text-accent" },
    badge: "Photos",
    status: "Visual Gallery",
    description:
      "High-resolution photographic archive featuring Duck from 8-week fluff to 80-lb companion, Theodore Wirth mud run, alpine flame suit, and couple moments.",
    techStack: [
      "Next.js Image",
      "WebP/AVIF",
      "Accessible Lightbox",
      "Keyboard Navigation",
    ],
    highlights: [
      "14 authentic high-resolution photographs",
      "Canine co-pilot puppy-to-adult growth progression",
      "Accessible lightbox with keyboard arrow navigation",
    ],
  },
  {
    id: "action-toggle-dyslexia",
    title: "Toggle Dyslexia Mode (OpenDyslexic)",
    subtitle:
      "Switch global typography and Pretext layout between OpenDyslexic and Atkinson Hyperlegible/Lexend.",
    category: "navigation",
    url: "action:toggle-dyslexia",
    icon: { name: "IconSparkles", className: "w-4 h-4 text-amber-400" },
    badge: "A11y",
    status: "Cognitive A11y",
    whenDyslexiaModeOn: {
      title: "Disable Dyslexia Mode (Return to Atkinson/Lexend)",
      badge: "Active",
      status: "OpenDyslexic Active",
    },
    description:
      "1-Click high-assurance dyslexia font toggle. Switches all headings, body text, and dynamic Pretext layout bounds.",
    techStack: [
      "OpenDyslexic",
      "Atkinson Hyperlegible",
      "ADR 0040",
      "WCAG 2.1 AA",
    ],
    highlights: [
      "Bottom-weighted letterforms for cognitive spatial anchoring",
      "Expanded 1.75 line-height and +0.04em letter tracking",
      "Dynamic zero-CLS Pretext text reflow",
    ],
  },
  {
    id: "case-study-designing-for-my-brother",
    title: "Designing for My Brother: Accessible Typography",
    subtitle:
      "Dyslexia-first typography, cognitive accessibility, and zero-CLS Pretext text reflow.",
    category: "navigation",
    url: "/case-studies/designing-for-my-brother",
    icon: { name: "IconDirections", className: "w-4 h-4 text-amber-400" },
    badge: "Deep-Dive",
    status: "Case Study",
    description:
      "Building reliable, accessible software for Frederick's brother who lives with dyslexia. High-assurance typography with Atkinson Hyperlegible, Lexend, and OpenDyslexic.",
    techStack: [
      "Next.js 16",
      "Pretext",
      "OpenDyslexic",
      "Atkinson Hyperlegible",
      "Lexend",
      "WCAG 2.1 AA",
    ],
    highlights: [
      "Clinical typography & low-vision character disambiguation",
      "Bottom-weighted letterforms for mental orientation anchoring",
      "Zero-CLS userland canvas text layout calibration",
    ],
  },
  {
    id: "nav-platform-strategy",
    title: "Vendor scoring (Platform Strategy)",
    subtitle: "Fictional vendor scoring and five-year investment decisions.",
    category: "navigation",
    url: "/platform/strategy",
    icon: { name: "IconCpu", className: "h-4 w-4 text-amber-400" },
    badge: "Toolkit",
    status: "Interactive",
    description:
      "Compare fictional options, test weight sensitivity, plan a roadmap and export a decision memo.",
    techStack: ["Next.js 16", "TypeScript", "NPV", "DAMA-DMBOK"],
    highlights: [
      "Weighted scoring",
      "Five-year economics",
      "HTML and Markdown memos",
    ],
  },
  {
    id: "nav-platform-operations",
    title: "Clinical Operations Dashboards",
    subtitle: "Drill a synthetic portfolio from study to country to site.",
    category: "navigation",
    url: "/platform/operations",
    icon: { name: "IconCpu", className: "h-4 w-4 text-amber-400" },
    badge: "Dashboards",
    status: "Interactive",
    description:
      "Enrollment, site activation, data management, deviations, monitoring and milestones, every number from the governed metric registry.",
    techStack: ["Next.js 16", "TypeScript", "Web Worker", "Semantic Layer"],
    highlights: [
      "Portfolio, study, country and site drill-down",
      "Every chart with its data table",
      "Drug, device and CRO-run studies",
    ],
  },
  {
    id: "nav-platform-portfolio",
    title: "Clinical Portfolio Dashboard",
    subtitle: "Every study's milestones and cycle times side by side.",
    category: "navigation",
    url: "/platform/portfolio",
    icon: { name: "IconCpu", className: "h-4 w-4 text-amber-400" },
    badge: "Dashboards",
    status: "Interactive",
    description:
      "A milestone swimlane of eight synthetic studies with the slips highlighted, and start-up, enrollment and close-out cycle times against the portfolio median.",
    techStack: ["Next.js 16", "TypeScript", "Web Worker", "Semantic Layer"],
    highlights: [
      "Planned against actual milestones",
      "Cycle-time medians, quartiles and the furthest study",
      "Every chart with its data table",
    ],
  },
  {
    id: "nav-platform-explore",
    title: "Study metrics explorer (Metrics Explorer)",
    subtitle: "Group and filter any governed metric, and see its SQL.",
    category: "navigation",
    url: "/platform/explore",
    icon: { name: "IconSearch", className: "h-4 w-4 text-amber-400" },
    badge: "Self-service",
    status: "Interactive",
    description:
      "A no-code explorer over the semantic layer: it offers only the groupings, filters and visuals a metric allows, and shows each result's definition, version and SQL.",
    techStack: ["Next.js 16", "TypeScript", "Web Worker", "Semantic Layer"],
    highlights: [
      "Only valid metric and dimension combinations",
      "Shareable link, CSV download",
      "The steps to promote it to a managed report",
    ],
  },
  {
    id: "nav-platform-sql",
    title: "Query workbench (SQL Workbench)",
    subtitle: "Run read-only SQL on the gold tables, in your browser.",
    category: "navigation",
    url: "/platform/sql",
    icon: { name: "IconTerminal", className: "h-4 w-4 text-amber-400" },
    badge: "Runs in your browser",
    status: "Interactive",
    description:
      "DuckDB compiled to WebAssembly over your own copy of the synthetic warehouse: a schema browser from the data contracts, saved queries, each governed metric in DuckDB, PostgreSQL and T-SQL, and EXPLAIN.",
    techStack: ["Next.js 16", "DuckDB-WASM", "Apache Arrow", "Web Worker"],
    highlights: [
      "Read-only, with file and network access off",
      "Queries stop after 30 seconds or on request",
      "CSV download of any result",
    ],
  },
  {
    id: "nav-clinical-standards",
    title: "Standards Conformance",
    subtitle:
      "Every CDISC standard, its pinned and published version, and what checked it.",
    category: "navigation",
    url: "/clinical/standards",
    icon: { name: "IconShieldCheck", className: "h-4 w-4 text-amber-400" },
    badge: "CDISC",
    status: "Evidence",
    description:
      "The conformance matrix: each pinned CDISC standard against the newest published version, and each rule family from official schemas to CDISC CORE to the site's own rules, with pass, fail, not applicable, not evaluated, unsupported and execution error counted apart.",
    techStack: ["CDISC CORE", "SDTM", "ADaM", "USDM"],
    highlights: [
      "Pinned against newest published, read weekly",
      "CDISC CORE results recorded in CI",
      "Every check linked to the file that runs it",
    ],
  },
  {
    id: "nav-platform-governance",
    title: "Data rules and catalog (Data Governance)",
    subtitle: "The data catalog, business glossary, stewardship and policies.",
    category: "navigation",
    url: "/platform/governance",
    icon: { name: "IconShieldCheck", className: "h-4 w-4 text-amber-400" },
    status: "Interactive",
    description:
      "Every data product and governed metric with its owner, steward, classification, contract status and quality score, searchable by facet, beside the glossary, RACI and policies.",
    techStack: ["Next.js 16", "TypeScript", "Data Contracts", "Semantic Layer"],
    highlights: [
      "Search and facets over 90 catalog entries",
      "Glossary terms linked to the metrics defined in them",
      "Who decides what, and which rules code applies",
    ],
  },
  {
    id: "nav-clinical",
    title: "Clinical Journey",
    subtitle: "Forms to study tables to a governed portfolio, step by step.",
    category: "navigation",
    url: "/clinical",
    icon: { name: "IconStethoscope", className: "h-4 w-4 text-amber-400" },
    badge: "Overview",
    status: "Journey Hub",
    description:
      "The clinical data journey on one page: CRF Studio, Protocol Drift, the Study Data Pipeline and the Clinical Data Platform, with each step's evidence and related case studies.",
    techStack: ["Next.js 16", "TypeScript", "CDISC", "Synthetic Data"],
    highlights: [
      "Four working steps in journey order",
      "What each step's evidence is drawn from",
      "Related case studies and planned work",
    ],
  },
  {
    id: "nav-labs",
    title: "Labs",
    subtitle: "Studios and simulators outside clinical data.",
    category: "navigation",
    url: "/labs",
    icon: { name: "IconFlask", className: "h-4 w-4 text-cyan-400" },
    badge: "Overview",
    status: "Labs Hub",
    description:
      "The proof workspace, the 3D MRI viewer, the incident simulator and Patrol Shift, listed together.",
    techStack: ["Next.js 16", "TypeScript", "Canvas", "WebGL"],
    highlights: [
      "Proof Workspace and NeuroRecon Studio",
      "Incident and patrol judgment simulators",
      "Phone-sized variants where they exist",
    ],
  },
  {
    id: "nav-platform",
    title: "Clinical Data Platform",
    subtitle: "A governed synthetic portfolio from source feeds to decisions.",
    category: "navigation",
    url: "/platform",
    icon: { name: "IconCpu", className: "h-4 w-4 text-amber-400" },
    badge: "Platform",
    status: "Architecture Hub",
    description:
      "Trace the architecture and inspect a capability map with live demonstrations and issue-backed plans.",
    techStack: ["Next.js 16", "TypeScript", "CDISC", "Semantic Layer"],
    highlights: [
      "Bronze, silver and gold data flow",
      "Capability evidence linked to live demos",
      "Synthetic data and regulatory scope made explicit",
    ],
  },
  {
    id: "nav-study-data",
    title: "Study Data Pipeline",
    subtitle: "One synthetic study from USDM to tables, traced end to end.",
    category: "navigation",
    url: "/study-data",
    icon: { name: "IconFileSpreadsheet", className: "h-4 w-4 text-amber-400" },
    badge: "Lineage",
    status: "Interactive",
    description:
      "Run a seeded synthetic study through SDTM, conformance checks, ADaM, Define-XML and TLFs, then trace any result back to its source.",
    techStack: ["Web Worker", "TypeScript", "USDM", "SDTM", "ADaM"],
    highlights: [
      "Seven-stage pipeline with live counts",
      "Result-to-source lineage explorer",
      "Datasets and outputs as downloadable packages",
    ],
  },
];
