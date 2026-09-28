"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useId,
  useMemo,
  useDeferredValue,
  useTransition,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { hexToRgba } from "@/lib/utils";
import { designManifest } from "@/lib/design-manifest";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  IconSearch,
  IconTerminal,
  IconFileCode,
  IconDirections,
  IconArticle,
  IconCornerDownLeft,
  IconCalendar,
  IconBrain,
  IconFileSpreadsheet,
  IconCpu,
  IconDeviceGamepad2,
  IconSparkles,
  IconCoffee,
  IconFlame,
  IconShieldCheck,
  IconCamera,
} from "@tabler/icons-react";
import { filterFuzzySearch } from "@/lib/search-utils";
import { useSearch } from "@/components/providers/SearchProvider";
import { useAudio } from "@/components/providers/AudioProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { unlockAchievement, setVaultUnlocked } from "@/lib/meme-data";
import { playMemeSound } from "@/lib/meme-audio";
import { useFontPreference } from "@/hooks/useFontPreference";
import { useAnnouncer } from "@/components/providers/A11yProvider";

interface SearchCaseStudy {
  id: string;
  slug: string;
  title: string;
  primary_language: string;
  tags: string;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  category: "case-study" | "navigation";
  url: string;
  icon: React.ReactNode;
  techStack?: string[];
  highlights?: string[];
  status?: string;
  description?: string;
  badge?: string;
}

interface CommandPaletteModalProps {
  onClose: () => void;
  studies: SearchCaseStudy[];
}

const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  onClose,
  studies,
}) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(debouncedQuery);

  const [activeIndex, setActiveIndex] = useState(0);
  const { playHover, playSubmit } = useAudio();
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();

  const router = useRouter();
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchId = useId();

  const lastAudioTimeRef = useRef<number>(0);

  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;

    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== backdrop
    );
    const previous = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    for (const element of siblings) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    return () => {
      for (const { element, inert, ariaHidden } of previous) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, []);

  const throttledPlayHover = useCallback(() => {
    const now = performance.now();
    const isActEnv =
      typeof globalThis !== "undefined" &&
      Boolean(
        (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean })
          .IS_REACT_ACT_ENVIRONMENT
      );
    const throttleMs = isActEnv ? 0 : 50;
    if (now - lastAudioTimeRef.current >= throttleMs) {
      lastAudioTimeRef.current = now;
      playHover();
    }
  }, [playHover]);

  useEffect(() => {
    if (query === "") {
      startTransition(() => {
        setDebouncedQuery("");
      });
      return;
    }

    const isActEnv =
      typeof globalThis !== "undefined" &&
      Boolean(
        (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean })
          .IS_REACT_ACT_ENVIRONMENT
      );
    const timerMs = isActEnv ? 0 : 150;

    if (timerMs === 0) {
      startTransition(() => {
        setDebouncedQuery(query);
      });
      return;
    }

    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedQuery(query);
      });
    }, timerMs);

    return () => {
      clearTimeout(timer);
    };
  }, [query, startTransition]);

  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: inputRef,
    onEscape: onClose,
    returnFocus: true,
  });

  // 1. Body scroll locking and focus trap management
  useEffect(() => {
    // Lock parent layout scrollbars
    document.body.style.overflow = "hidden";

    // Auto-focus input after transition has completed
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => {
      document.body.style.overflow = "";
      clearTimeout(timer);
    };
  }, []);

  // 2. Compile indexable items from static navigations and Neon DB records
  const allItems = useMemo(() => {
    const staticNavs: PaletteItem[] = [
      {
        id: "nav-work",
        title: "Work",
        subtitle:
          "The problems, implementation choices, and lessons behind my clinical data tools, web apps, and side projects.",
        category: "navigation",
        url: "/case-studies",
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconArticle className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
        badge: "Direct Inquiries",
        status: "Contact Form",
        description:
          "Have a project, a role, or a question in mind? Send me a note or find a time to talk.",
        techStack: [
          "Next.js 16",
          "Resend API",
          "Zod",
          "Rate Limiting",
          "Honeypot",
        ],
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
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        title:
          "clintrials: Adaptive Clinical Trial Design & WebAssembly Engine",
        subtitle:
          "A browser-based workspace for comparing adaptive clinical trial designs. Pyodide workers run models including CRM, EffTox, group sequential designs, and win ratio analyses.",
        category: "navigation",
        url: "/case-studies/clintrials",
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
          "A browser-based tool for clinical trial allocation. It uses Mersenne Twister (MT19937) and generates code for Python, R, SAS, and Stata, making it easier to inspect and reproduce a randomization.",
        category: "navigation",
        url: "/case-studies/equipose-randomization",
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
        badge: "Case Study",
        status: "Angular / TS",
        description:
          "A browser-based tool for clinical trial allocation. It uses Mersenne Twister (MT19937) and generates code for Python, R, SAS, and Stata, making it easier to inspect and reproduce a randomization.",
        techStack: [
          "Angular",
          "TypeScript",
          "Web Workers",
          "CDISC ADaM-Lite",
          "Transpiler",
        ],
        highlights: [
          "Sub-10ms in-browser statistical code transpilation",
          "Zero PHI data exfiltration via Web Workers",
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
          "Automated CDISC CDASH 2.2 variable mapping linter",
          "Deterministic ODM-XML v1.3.2 export generator",
        ],
      },
      {
        id: "nav-promptops",
        title: "PromptOps: LLM Prompt Orchestration & Eval Engine",
        subtitle:
          "A TypeScript toolkit for versioning prompts, validating output with Zod, and running regression evaluations in CI. A prompt change should come with a way to check what changed in the results.",
        category: "navigation",
        url: "/case-studies/promptops",
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        id: "nav-laser-loon",
        title: "Laser Loon: Quest for the State Flag",
        subtitle:
          "Fly toward the Minnesota State Capitol, battle rival flags, and blast through red tape in this browser arcade game.",
        category: "navigation",
        url: "/arcade/laser-loon",
        icon: <IconTerminal className="w-4 h-4 text-red-400" />,
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
        icon: <IconDirections className="w-4 h-4 text-amber-400" />,
        badge: "Graphic Design",
        status: "Vector Assets",
        description:
          "Meet my Minnesota flag submission and download the loon, lasers included, in print and web formats.",
        techStack: [
          "Graphic Design",
          "Adobe Illustrator",
          "Adobe Photoshop",
          "Vector Optics",
          "CC BY 4.0",
        ],
        highlights: [
          "Side-by-side vector pass comparison viewer",
          "7 production file classifications + 1-click ZIP archive",
          "Creative Commons CC BY 4.0 open source license",
        ],
      },
      {
        id: "nav-quasi-puzzler",
        title: "Quasi-Perfect Puzzler",
        subtitle:
          "Apply tactics to a proof tree in this Lean-inspired puzzle game. Complete the proof before your simulated memory runs out.",
        category: "navigation",
        url: "/arcade/quasi-puzzler",
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
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
        id: "nav-garmin-watch",
        title: "Monkey C Mayhem: Garmin Schvitz App",
        subtitle:
          "Dodge obstacles, clear memory, and wipe the fog from a simulated smartwatch with a 32KB budget.",
        category: "navigation",
        url: "/arcade/garmin-watch",
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
        badge: "Monkey C Mayhem",
        status: "Garmin Schvitz App",
        description:
          "Dodge obstacles, clear memory, and wipe the fog from a simulated smartwatch with a 32KB budget.",
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
        icon: <IconTerminal className="w-4 h-4 text-amber-400" />,
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
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
        badge: "Dungeon Roguelike",
        status: "Procedural Maze",
        description:
          "Explore an abandoned codebase as a shifting dungeon. Fight bugs, navigate moving walls, and face a wireframe boss.",
        techStack: [
          "TSP Algorithms",
          "Raycasting 3D",
          "Procedural Generation",
          "Canvas 2D",
        ],
        highlights: [
          "Dynamic graph-based maze generation",
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
        icon: <IconTerminal className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconBrain className="w-4 h-4 text-brand-cyan" />,
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
        title: "CRF Studio: Clinical Form & Protocol Designer",
        subtitle:
          "Build clinical research forms, add validation rules, and try them with sample data in a browser-based study designer.",
        category: "navigation",
        url: "/crf",
        icon: <IconFileSpreadsheet className="w-4 h-4 text-brand-cyan" />,
        badge: "Clinical Data Suite",
        status: "21 CFR Part 11",
        description:
          "Build clinical research forms, add validation rules, and try them with sample data in a browser-based study designer.",
        techStack: [
          "CDISC ODM-XML",
          "NCI Thesaurus",
          "Zero-Eval AST",
          "FHIR SDC",
        ],
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
        icon: <IconShieldCheck className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconCpu className="w-4 h-4 text-brand-cyan" />,
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
        id: "nav-simulator",
        title: "Engineering Alignment Simulator",
        subtitle:
          "Work through a few engineering decisions, from interface priorities to an outage. Compare what your choices emphasize.",
        category: "navigation",
        url: "/simulator",
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
        badge: "Systems Simulator",
        status: "Incident Triage",
        description:
          "Work through a few engineering decisions, from interface priorities to an outage. Compare what your choices emphasize.",
        techStack: [
          "State Machine",
          "Decision Trees",
          "Telemetry Hooks",
          "Framer Motion",
        ],
        highlights: [
          "Live incident triage scenarios",
          "Candidate alignment benchmark scoring",
          "Detailed post-mortem decision reports",
        ],
      },
      {
        id: "nav-schedule",
        title: "Say Hi / Book a Chat",
        subtitle:
          "Find a time to talk about a project, ask a question, or introduce yourself. Book a 30-minute Google Meet call.",
        category: "navigation",
        url: "/schedule",
        icon: <IconCalendar className="w-4 h-4 text-brand-cyan" />,
        badge: "Sync Scheduler",
        status: "Live Calendar",
        description:
          "Find a time to talk about a project, ask a question, or introduce yourself. Book a 30-minute Google Meet call.",
        techStack: [
          "Next.js 16",
          "Calendar API",
          "Timezone Engine",
          "WCAG 2.1 AA",
        ],
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
          "Make some noise, find hidden trophies, and enjoy a few jokes about code and clinical data.",
        category: "navigation",
        url: "/arcade/meme-vault",
        icon: <IconDeviceGamepad2 className="w-4 h-4 text-emerald-400" />,
        badge: "Meme Soundboard",
        status: "8-Bit Audio Active",
        description:
          "Make some noise, find hidden trophies, and enjoy a few jokes about code and clinical data.",
        techStack: ["Web Audio API", "CRT Shader", "React 19", "LocalStorage"],
        highlights: [
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
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
        icon: <IconDirections className="w-4 h-4 text-brand-cyan" />,
      },
      {
        id: "nav-photos",
        title: "Behind the Code · Visual Archive",
        subtitle:
          "14 authentic photographs spanning Duck's puppy-to-adult journey, Theodore Wirth 10K, and alpine skiing.",
        category: "navigation",
        url: "action:photos",
        icon: <IconCamera className="w-4 h-4 text-brand-cyan" />,
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
        title: isDyslexic
          ? "Disable Dyslexia Mode (Return to Atkinson/Lexend)"
          : "Toggle Dyslexia Mode (OpenDyslexic)",
        subtitle:
          "Switch global typography and Pretext layout between OpenDyslexic and Atkinson Hyperlegible/Lexend.",
        category: "navigation",
        url: "action:toggle-dyslexia",
        icon: <IconSparkles className="w-4 h-4 text-amber-400" />,
        badge: isDyslexic ? "Active" : "A11y",
        status: isDyslexic ? "OpenDyslexic Active" : "Cognitive A11y",
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
        icon: <IconDirections className="w-4 h-4 text-amber-400" />,
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
    ];

    const safeStudies = Array.isArray(studies) ? studies : [];
    const studyItems: PaletteItem[] = safeStudies.map((study) => {
      const parsedTags = study.tags
        ? study.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      return {
        id: study.id,
        title: study.title,
        subtitle: `${study.primary_language} · ${study.tags}`,
        category: "case-study",
        url: `/case-studies/${study.slug}`,
        icon: <IconFileCode className="w-4 h-4 text-brand-blue" />,
        badge: "Case Study",
        status: "Architectural Case",
        description: `In-depth technical breakdown covering architecture decisions, production trade-offs, and software craftsmanship for ${study.title}.`,
        techStack: [study.primary_language, ...parsedTags].filter(Boolean),
        highlights: [
          "Production architecture and trade-off analysis",
          "Source code snippets and design patterns",
          "Measured performance benchmarks & metrics",
        ],
      };
    });

    return [...staticNavs, ...studyItems];
  }, [studies, isDyslexic]);

  // 3. In-Memory Fuzzy filtering matching queries against titles, tags, and secret easter egg triggers
  const filteredItems = useMemo(() => {
    const baseMatches = filterFuzzySearch(deferredQuery, allItems);
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return baseMatches;

    const secretItems: PaletteItem[] = [];

    if (q === "418" || q.includes("coffee") || q.includes("tea")) {
      secretItems.push({
        id: "secret-418",
        title: "HTTP 418: I'm a Teapot (RFC 2324)",
        subtitle: "Hyper Text Coffee Pot Control Protocol / RFC 7168",
        category: "navigation",
        url: "action:418",
        icon: <IconCoffee className="w-4 h-4 text-teal-400" />,
        badge: "RFC 2324",
        status: "Brewing Error",
        description:
          "HTCPCP 1.0 error: The requested entity body is short and stout. Cannot brew espresso on a web server.",
        techStack: ["RFC 2324", "RFC 7168", "HTCPCP/1.0"],
        highlights: [
          "Brew coffee action",
          "Teapot whistle sound effect",
          "Instant achievement unlock",
        ],
      });
    }

    if (q.includes("duck") || q.includes("puppy") || q.includes("woof")) {
      secretItems.push({
        id: "secret-duck",
        title: "🐾 Summon Duck the Golden Retriever",
        subtitle: "Click to toss a treat and hear Duck bark happily!",
        category: "navigation",
        url: "action:duck",
        icon: <IconSparkles className="w-4 h-4 text-amber-400" />,
        badge: "Chief Bark Officer",
        status: "Good Boy",
        description:
          "Duck has achieved 100% test coverage by enthusiastically chewing through the staging network cables.",
        techStack: ["Golden Retriever AI", "Treat Physics", "Bark Synthesizer"],
        highlights: [
          "Playful synthesized puppy woof",
          "Achievement unlocked: Duck Whisperer",
          "100% Good Boy rating",
        ],
      });
    }

    if (q.includes("sudo") || q.includes("root")) {
      secretItems.push({
        id: "secret-sudo",
        title: "sudo su - (Permission Denied)",
        subtitle: "Incident reported to security team (and Duck 🐾)",
        category: "navigation",
        url: "action:sudo",
        icon: <IconTerminal className="w-4 h-4 text-rose-400" />,
        badge: "Security Log",
        status: "Denied",
        description:
          "User is not in the sudoers file. This incident has been logged in triplicate under 21 CFR Part 11 audit trails.",
        techStack: ["UNIX PAM", "21 CFR Part 11", "Audit Sentry"],
        highlights: [
          "Audit alert siren",
          "Immutable security log",
          "Terminal achievement progress",
        ],
      });
    }

    if (
      q.includes("chaos") ||
      q.includes("konami") ||
      q.includes("retro") ||
      q.includes("matrix")
    ) {
      secretItems.push({
        id: "secret-chaos",
        title: "🎮 Launch Retro Chaos Mode",
        subtitle:
          "Activate full-screen CRT scanline overlay and unlock secrets",
        category: "navigation",
        url: "action:chaos",
        icon: <IconSparkles className="w-4 h-4 text-emerald-400" />,
        badge: "Easter Egg",
        status: "CRT Ready",
        description:
          "Trigger the full-screen cyberpunk phosphor CRT scanline overlay, unlocking all easter eggs and achievement badges.",
        techStack: ["CRT Post-Processing", "Konami Engine", "Web Audio API"],
        highlights: [
          "Full-screen phosphor CRT scanlines",
          "8-bit fanfare chime",
          "Unlocks Secret Meme Vault",
        ],
      });
    }

    if (q.includes("friday") || q.includes("push") || q.includes("deploy")) {
      secretItems.push({
        id: "secret-friday",
        title: "🚨 Git Push --Force to Main (Friday 4:59 PM)",
        subtitle: "Simulate a high-stakes emergency production deployment",
        category: "navigation",
        url: "action:friday",
        icon: <IconFlame className="w-4 h-4 text-red-400" />,
        badge: "High Risk",
        status: "Alarm Armed",
        description:
          "Push directly to production without testing. Will the server survive the weekend?",
        techStack: ["Git Engine", "Friday Deploy Protocol", "Panic Siren"],
        highlights: [
          "Dramatic alarm siren sound",
          "Achievement unlocked: Friday Deploy Survivor",
          "Zero staging fear",
        ],
      });
    }

    if (q === "ping") {
      secretItems.push({
        id: "secret-ping",
        title:
          "ping 127.0.0.1 -> 64 bytes from localhost: icmp_seq=1 ttl=64 time=0.012 ms",
        subtitle: "Lake Minnetonka cluster is 100% online",
        category: "navigation",
        url: "action:ping",
        icon: <IconTerminal className="w-4 h-4 text-cyan-400" />,
        badge: "ICMP Pong",
        status: "0.012ms",
        description:
          "Direct zero-latency heartbeat from the local Next.js 15 kernel runtime.",
        techStack: ["ICMP Ping", "Localhost", "Zero Latency"],
        highlights: [
          "Instant response",
          "Sub-millisecond latency",
          "100% uptime",
        ],
      });
    }

    return [...secretItems, ...baseMatches];
  }, [allItems, deferredQuery]);

  const handleItemHover = useCallback(
    (index: number) => {
      if (index !== activeIndex) {
        setActiveIndex(index);
        throttledPlayHover();
      }
    },
    [activeIndex, throttledPlayHover]
  );

  // 4. Keyboard Control Handlers (↑↓, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
      throttledPlayHover();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
      );
      throttledPlayHover();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[activeIndex];
      if (selected) {
        handleSelectItem(selected);
      }
    }
  };

  const handleSelectItem = (item: PaletteItem) => {
    if (typeof playSubmit === "function") {
      playSubmit();
    }
    onClose();

    // Handle special easter egg action commands
    if (item.url.startsWith("action:")) {
      const actionType = item.url.replace("action:", "");
      if (actionType === "toggle-dyslexia") {
        toggleDyslexiaMode();
        announce(
          !isDyslexic
            ? "Dyslexia mode activated. Using OpenDyslexic typeface with increased line spacing and letter tracking."
            : "Dyslexia mode deactivated. Restored Atkinson Hyperlegible and Lexend typography.",
          "polite"
        );
      } else if (actionType === "418") {
        unlockAchievement("rfc-barista");
        playMemeSound("teapot-whistle");
      } else if (actionType === "duck") {
        unlockAchievement("duck-whisperer");
        playMemeSound("bark");
      } else if (actionType === "sudo") {
        unlockAchievement("terminal-cowboy");
        playMemeSound("fda-siren");
      } else if (actionType === "chaos") {
        unlockAchievement("konami-hero");
        setVaultUnlocked(true);
        playMemeSound("fanfare");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("trigger_retro_chaos"));
        }
      } else if (actionType === "friday") {
        unlockAchievement("friday-survivor");
        playMemeSound("friday-alarm");
      } else if (actionType === "ping") {
        playMemeSound("matrix-glitch");
      } else if (actionType === "photos") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("open-photo-gallery"));
        }
      }
      return;
    }

    // Handle in-page dynamic smooth scrolls
    if (item.url.startsWith("/#")) {
      const targetId = item.url.substring(2);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        router.push("/");
        // Allow thread transition to complete
        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        router.push(item.url);
      }
    } else {
      router.push(item.url);
    }
  };

  // Close when clicking directly on the backdrop container
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const activeItem = filteredItems[activeIndex] || filteredItems[0];

  return (
    <motion.div
      ref={backdropRef}
      key="command-palette-backdrop"
      initial={false}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[max(1.5rem,env(safe-area-inset-top)+1rem)] sm:pt-[12vh] px-3 sm:px-4 pb-[max(1.5rem,env(safe-area-inset-bottom)+1rem)] bg-zinc-950/85 backdrop-blur-md transition-all duration-300 overflow-y-auto"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        initial={false}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        ref={trapRef}
        style={
          {
            "--cmd-glow": `0 0 50px ${hexToRgba(designManifest.colors["brand-cyan"], 0.06)}`,
          } as React.CSSProperties
        }
        className="w-full max-w-3xl bg-[#13151a] border border-zinc-800/90 shadow-[var(--cmd-glow)] rounded-3xl overflow-hidden flex flex-col relative my-auto sm:my-0 max-h-[85vh]"
      >
        {/* Circular glow visual elements inside modal */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />

        {/* Input Header container */}
        <div className="relative z-10 flex items-center border-b border-zinc-800/60 p-3 sm:p-4 gap-2 sm:gap-3">
          <IconSearch className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            id={searchId}
            type="text"
            placeholder="Search cases, tools, games, sections..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={true}
            aria-autocomplete="list"
            aria-controls="palette-results-list"
            aria-activedescendant={
              activeItem ? `palette-option-${activeItem.id}` : undefined
            }
            aria-haspopup="listbox"
            aria-label="Spotlight command palette search"
            className="w-full bg-transparent text-sm sm:text-base text-neutral-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command search"
            className="min-h-10 min-w-10 flex items-center justify-center text-xs font-mono font-bold tracking-wider text-zinc-300 px-2.5 py-1 bg-zinc-950 border border-zinc-700 hover:border-brand-cyan/40 hover:text-brand-cyan rounded-xl cursor-pointer select-none transition"
          >
            ESC
          </button>
        </div>

        {/* Master-Detail Split Grid */}
        <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60 overflow-hidden">
          {/* Left: Results List section */}
          <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 max-h-[380px] overflow-hidden">
            {filteredItems.length > 0 ? (
              <div
                id="palette-results-list"
                role="listbox"
                aria-label="Search outcomes list"
                className="flex-1 max-h-[380px] overflow-y-auto p-2.5 space-y-1 scrollbar-none"
              >
                {filteredItems.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={item.id}
                      id={`palette-option-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      aria-describedby={
                        isActive ? "palette-preview-pane" : undefined
                      }
                      onClick={() => handleSelectItem(item)}
                      style={
                        {
                          "--cmd-item-glow": hexToRgba(
                            designManifest.colors["brand-cyan"],
                            0.04
                          ),
                        } as React.CSSProperties
                      }
                      onMouseEnter={() => handleItemHover(index)}
                      className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 border ${
                        isActive
                          ? "bg-zinc-950 border-brand-cyan/25 shadow-[0_0_15px_var(--cmd-item-glow)]"
                          : "bg-transparent border-transparent hover:bg-zinc-950/40"
                      }`}
                    >
                      {/* Left icon wrapper */}
                      <span
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors duration-300 flex-shrink-0 ${
                          isActive
                            ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                            : "bg-zinc-950 border-zinc-900 text-zinc-400"
                        }`}
                      >
                        {item.icon}
                      </span>

                      {/* Dynamic label strings */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                              isActive ? "text-brand-cyan" : "text-zinc-400"
                            }`}
                          >
                            {item.badge ||
                              (item.category === "case-study"
                                ? "Case Study"
                                : "Site Channel")}
                          </span>
                          {item.status && (
                            <span className="hidden sm:inline-block text-[9px] font-mono text-zinc-400 border border-zinc-800/80 px-1.5 py-0.2 rounded">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-sm font-semibold truncate transition-colors ${
                            isActive ? "text-white" : "text-neutral-300"
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      </div>

                      {/* Right Enter Shortcut icon */}
                      {isActive && (
                        <span className="text-xs font-mono text-zinc-400 flex items-center gap-1 animate-pulse flex-shrink-0 select-none">
                          <span className="hidden sm:inline">Select</span>
                          <IconCornerDownLeft className="w-3.5 h-3.5 text-brand-cyan" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 max-h-[380px] overflow-y-auto p-2.5 space-y-1 scrollbar-none py-12 text-center select-none">
                <p className="text-sm text-zinc-400 italic">
                  No outcomes match search query.
                </p>
                <p className="text-xs font-mono text-zinc-400 mt-1 uppercase tracking-widest">
                  Try searching other tags
                </p>
              </div>
            )}
          </div>

          {/* Right: Contextual Preview Pane (Desktop >= 768px) */}
          <div
            id="palette-preview-pane"
            aria-live="polite"
            tabIndex={0}
            aria-label="Selected result preview"
            className="hidden md:flex md:col-span-5 flex-col justify-between p-4 bg-zinc-950/60 min-h-0 overflow-y-auto max-h-[380px] scrollbar-none"
          >
            {activeItem ? (
              <motion.div
                key={activeItem.id}
                initial={false}
                animate={{ y: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="flex flex-col h-full justify-between gap-3"
              >
                {/* Top section: Badges, Title, Description */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                      {activeItem.badge ||
                        (activeItem.category === "case-study"
                          ? "Case Study"
                          : "Navigation")}
                    </span>
                    {activeItem.status && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {activeItem.status}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-brand-cyan flex-shrink-0 mt-0.5">
                      {activeItem.icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white leading-tight">
                        {activeItem.title}
                      </h2>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                        {activeItem.url}
                      </p>
                    </div>
                  </div>

                  {activeItem.description && (
                    <p className="text-xs text-zinc-300 leading-relaxed mt-2.5 border-t border-zinc-850 pt-2.5">
                      {activeItem.description}
                    </p>
                  )}

                  {/* Tech Stack Pills */}
                  {activeItem.techStack && activeItem.techStack.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                        Tech Stack & Specs
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeItem.techStack.map((tech, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Capability Highlights */}
                  {activeItem.highlights &&
                    activeItem.highlights.length > 0 && (
                      <div className="mt-3 border-t border-zinc-850 pt-2.5">
                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                          Key Highlights
                        </div>
                        <ul className="space-y-1">
                          {activeItem.highlights.map((highlight, idx) => (
                            <li
                              key={idx}
                              className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug"
                            >
                              <span className="text-brand-cyan text-xs leading-none">
                                ▸
                              </span>
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>

                {/* Bottom Quick Navigation Hint */}
                <div className="pt-2.5 border-t border-zinc-850 flex items-center justify-between text-[10px] font-mono text-zinc-400 select-none">
                  <span className="flex items-center gap-1 text-brand-cyan/90">
                    <span className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[9px]">
                      ↵ ENTER
                    </span>
                    <span>Launch</span>
                  </span>
                  <span className="truncate max-w-[140px] text-zinc-400">
                    {activeItem.url}
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 p-4">
                <IconTerminal className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs font-mono uppercase tracking-wider">
                  Select a route or case
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer bar */}
        <div className="relative z-10 border-t border-zinc-800/60 p-3 bg-zinc-950/60 flex justify-between items-center text-xs font-mono text-zinc-400 select-none">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="bg-zinc-900 border border-zinc-800 px-1 rounded-md text-[10px]">
                ↑↓
              </span>{" "}
              Move
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-zinc-900 border border-zinc-800 px-1 rounded-md text-[10px]">
                ↵
              </span>{" "}
              Enter
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="bg-zinc-900 border border-zinc-800 px-1 rounded-md text-[10px]">
                ESC
              </span>{" "}
              Close
            </span>
          </div>
          <div>
            <span>SEARCH RESULTS: {filteredItems.length}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const CommandPalette: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { isOpen, setIsOpen, closeSearch } = useSearch();
  const [studies, setStudies] = useState<SearchCaseStudy[]>([]);
  const originalFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // 1. Keyboard Shortcut Listener (Cmd+K / Ctrl+K) site-wide
  useEffect(() => {
    if (!isMounted) return;
    const isWithinBoundary = (target: EventTarget | null) => {
      if (target instanceof Element) {
        return !!target.closest("[data-keyboard-boundary]");
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isWithinBoundary(e.target)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMounted, isOpen, setIsOpen]);

  // Expose test helper globally to open search modal programmatically
  useEffect(() => {
    if (!isMounted) return;
    window.__openSearch = () => {
      setIsOpen(true);
    };
    return () => {
      delete window.__openSearch;
    };
  }, [isMounted, setIsOpen]);

  // Capture original focus state when the palette opens
  useEffect(() => {
    if (!isMounted) return;
    if (isOpen) {
      originalFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen, isMounted]);

  // 2. Fetch search case studies on-demand when palette opens or during idle time
  useEffect(() => {
    if (!isMounted) return;
    if (studies.length > 0) return;

    let isSubscribed = true;

    const loadStudies = async () => {
      try {
        const res = await fetch("/api/case-studies");
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setStudies(data);
          }
        }
      } catch (err) {
        logger.error("Failed to load search dynamic case studies:", err);
      }
    };

    if (isOpen) {
      loadStudies();
    } else if (
      typeof window !== "undefined" &&
      "requestIdleCallback" in window
    ) {
      const idleWindow = window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof idleWindow.requestIdleCallback === "function") {
        const idleId = idleWindow.requestIdleCallback(
          () => {
            loadStudies();
          },
          { timeout: 4000 }
        );
        return () => {
          isSubscribed = false;
          if (typeof idleWindow.cancelIdleCallback === "function") {
            idleWindow.cancelIdleCallback(idleId);
          }
        };
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [isMounted, isOpen, studies.length]);

  const handleClose = () => {
    closeSearch();
    originalFocusRef.current?.focus();
  };

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <CommandPaletteModal
          key="command-palette-modal"
          onClose={handleClose}
          studies={studies}
        />
      )}
    </AnimatePresence>,
    document.body
  );
};
