"use client";

import React, { useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  IconShieldCheck,
  IconCheck,
  IconCopy,
  IconTerminal,
  IconFilter,
  IconSearch,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";

interface InvariantItem {
  id: number;
  code: string;
  name: string;
  category:
    "Architecture" | "Testing" | "Accessibility" | "Governance" | "Reliability";
  description: string;
  verificationCmd: string;
  status: "Enforced" | "Verified";
}

const INVARIANTS: InvariantItem[] = [
  {
    id: 1,
    code: "INV-01",
    name: "Dynamic Path Resolution & Storage Mocking",
    category: "Architecture",
    description:
      "Workspace paths resolve dynamically via process.cwd(). Browser storage in JSDOM / Node 25+ environments is safely mocked and isolated per test suite.",
    verificationCmd:
      "npm run test -- __tests__/defect-remediation-regression.test.ts",
    status: "Verified",
  },
  {
    id: 2,
    code: "INV-02",
    name: "Unified Root Layout & Header Hierarchy",
    category: "Architecture",
    description:
      "app/layout.tsx renders the single global Navbar, AudioProvider, and SearchProvider. Child routes never instantiate duplicate navigation bars.",
    verificationCmd: "npm run check",
    status: "Enforced",
  },
  {
    id: 3,
    code: "INV-03",
    name: "Universal Route Indexing & Discovery",
    category: "Governance",
    description:
      "Every first-class route and interactive tool is indexed in CommandPalette.tsx under staticNavs with rich master-detail preview context and metadata.",
    verificationCmd: "npm run verify",
    status: "Verified",
  },
  {
    id: 4,
    code: "INV-04",
    name: "Hydration & External Store Determinism",
    category: "Reliability",
    description:
      "Client-only state and browser storage utilize useSyncExternalStore. Non-deterministic timestamps include suppressHydrationWarning attributes.",
    verificationCmd: "npm run check",
    status: "Enforced",
  },
  {
    id: 5,
    code: "INV-05",
    name: "Multi-Agent Git & Artifact Hygiene",
    category: "Governance",
    description:
      "Intermediate agent scratch logs, transient benchmarks, and temporary fixtures are excluded from Git history via strict .gitignore patterns.",
    verificationCmd: "npm run quality",
    status: "Verified",
  },
  {
    id: 6,
    code: "INV-06",
    name: "Developer Suite (DX) Zero-Warning Gate",
    category: "Testing",
    description:
      "Automated verification suite running TypeScript strict compiler, ESLint, TypeDoc compilation, and all 12 architectural health invariants.",
    verificationCmd: "npm run verify",
    status: "Verified",
  },
  {
    id: 7,
    code: "INV-07",
    name: "Headless Canvas 2D & Animation Lifecycle",
    category: "Testing",
    description:
      "Headless JSDOM context mocks provide quadraticCurveTo, bezierCurveTo, and roundRect methods. Active requestAnimationFrames cancel on unmount.",
    verificationCmd: "npm run test",
    status: "Verified",
  },
  {
    id: 8,
    code: "INV-08",
    name: "JSDoc & TypeDoc Markdown Invariant",
    category: "Governance",
    description:
      "Exported symbols maintain markdownlint-compliant docstrings (MD029/MD033 compliant) for seamless TypeDoc-to-markdown automated compilation.",
    verificationCmd: "npm run lint:docs",
    status: "Verified",
  },
  {
    id: 9,
    code: "INV-09",
    name: "OpenAPI Specification Zero-Drift Gate",
    category: "Governance",
    description:
      "All API routes enforce declarative Zod validation schemas in lib/schemas.ts with 100% endpoint synchronization in openapi.json.",
    verificationCmd: "npm run check-docs-drift",
    status: "Verified",
  },
  {
    id: 10,
    code: "INV-10",
    name: "Continuous Accessibility & WCAG 2.1 AA",
    category: "Accessibility",
    description:
      "100% axe-core compliance across all public pages, modals, and drawers with SkipToContent bypass, focus trapping, and screen reader live announcer.",
    verificationCmd: "npm run probe:synthetic",
    status: "Verified",
  },
  {
    id: 11,
    code: "INV-11",
    name: "Defect Remediation & Root-Cause Protocol",
    category: "Reliability",
    description:
      "Bug fixes across core computational engines adhere to the strict Red-Green Remediation Protocol with dedicated test coverage in defect regression suites.",
    verificationCmd:
      "npm run test -- __tests__/defect-remediation-regression.test.ts",
    status: "Verified",
  },
  {
    id: 12,
    code: "INV-12",
    name: "Property Fuzzing Gates",
    category: "Reliability",
    description:
      "Deterministic AST calculation engines pass fast-check property-based fuzz testing gates.",
    verificationCmd: "npm run test:fuzz",
    status: "Verified",
  },
];

const CATEGORIES = [
  "All",
  "Architecture",
  "Testing",
  "Accessibility",
  "Governance",
  "Reliability",
] as const;

export const InvariantsMatrix: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { playHover, playSuccess } = useAudio();

  const filteredInvariants = INVARIANTS.filter((inv) => {
    const matchesCategory =
      selectedCategory === "All" || inv.category === selectedCategory;
    const matchesQuery =
      inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-6 backdrop-blur-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <IconShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <span>Architectural Invariant Matrix</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                12 / 12 Verified
              </span>
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Strict engineering invariants enforced across pre-commit hooks, DX
              invariant suites, and automated CI pipelines.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <IconSearch className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invariants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter architectural invariants"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 flex-wrap my-4">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted mr-1 flex items-center gap-1">
          <IconFilter className="w-3 h-3" /> Filter:
        </span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              playHover();
              setSelectedCategory(cat);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 font-bold"
                : "bg-zinc-950/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Invariants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
        {filteredInvariants.map((inv) => (
          <div
            key={inv.id}
            className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/90 hover:border-emerald-500/30 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {inv.code}
                  </span>
                  <span className="text-xs font-mono font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {inv.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800">
                  {inv.category}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
                {inv.description}
              </p>
            </div>

            {/* Command Trigger & Status */}
            <div className="flex items-center justify-between pt-2.5 border-t border-zinc-900 gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted truncate min-w-0">
                <IconTerminal className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                <code className="truncate text-zinc-400">
                  {inv.verificationCmd}
                </code>
              </div>

              <CopyButton
                text={inv.verificationCmd}
                label="Copy"
                copiedLabel="Copied"
                icon={<IconCopy className="w-3 h-3" />}
                copiedIcon={<IconCheck className="w-3 h-3 text-emerald-400" />}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer flex-shrink-0"
                aria-label={`Copy command ${inv.verificationCmd}`}
                successMessage={`Command copied to clipboard: ${inv.verificationCmd}`}
                onCopySuccess={() => playSuccess()}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
