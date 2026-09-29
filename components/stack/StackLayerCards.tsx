"use client";

import React from "react";
import {
  IconCpu,
  IconPalette,
  IconLayoutGrid,
  IconDatabase,
  IconDeviceGamepad2,
  IconCertificate,
  IconExternalLink,
  IconSparkles,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";

interface StackLayer {
  id: string;
  category: string;
  icon: React.ReactNode;
  accentColor: string;
  borderColor: string;
  glowColor: string;
  technologies: { name: string; version?: string; role: string; link?: string }[];
  keyHighlights: string[];
  architecturalRationale: string;
}

const STACK_LAYERS: StackLayer[] = [
  {
    id: "runtime",
    category: "Framework & Edge Runtime",
    icon: <IconCpu className="w-5 h-5 text-brand-cyan" />,
    accentColor: "text-brand-cyan",
    borderColor: "hover:border-brand-cyan/40",
    glowColor: "bg-brand-cyan/5",
    technologies: [
      { name: "Next.js", version: "v16.2.6", role: "App Router & React Server Components", link: "https://nextjs.org" },
      { name: "React", version: "v19.2.4", role: "Modern UI rendering engine & Actions", link: "https://react.dev" },
      { name: "Turbopack", version: "Stable", role: "Blazing fast development & production bundler" },
      { name: "TypeScript", version: "v5.x", role: "Strict compile-time type verification", link: "https://www.typescriptlang.org" },
    ],
    keyHighlights: [
      "Zero-waterfall server data fetching with React Server Components",
      "Streaming server rendering with instant visual transitions",
      "Strict static route tree generation and edge optimization",
    ],
    architecturalRationale:
      "Next.js 16 App Router provides atomic client/server component separation, ensuring client bundle sizes remain lean while complex clinical databases query securely on the server.",
  },
  {
    id: "styling",
    category: "Design System & Tokens",
    icon: <IconPalette className="w-5 h-5 text-purple-400" />,
    accentColor: "text-purple-400",
    borderColor: "hover:border-purple-400/40",
    glowColor: "bg-purple-500/5",
    technologies: [
      { name: "Tailwind CSS", version: "v4.x", role: "CSS-first compiler & @theme token mappings", link: "https://tailwindcss.com" },
      { name: "Framer Motion", version: "v12.x", role: "GPU-accelerated physics & spring animations", link: "https://www.framer.com/motion" },
      { name: "Tabler Icons", version: "v3.x", role: "Pixel-crisp responsive SVG icons" },
      { name: "Aceternity UI", version: "Pattern", role: "Copy-and-paste micro-interaction primitives" },
    ],
    keyHighlights: [
      "Zero-config JS file: 100% CSS-native @theme inline token declarations",
      "Dynamic dark-mode aesthetic with HSL-tuned cyan/emerald glowing accents",
      "Optimized zero-runtime CSS footprint with sub-50KB stylesheet delivery",
    ],
    architecturalRationale:
      "Tailwind CSS v4 replaces JavaScript config files with pure CSS variables and native styling directives, accelerating incremental builds and preventing runtime CSS-in-JS layout penalties.",
  },
  {
    id: "layout-physics",
    category: "Layout Physics & Text Engine",
    icon: <IconLayoutGrid className="w-5 h-5 text-emerald-400" />,
    accentColor: "text-emerald-400",
    borderColor: "hover:border-emerald-400/40",
    glowColor: "bg-emerald-500/5",
    technologies: [
      { name: "@chenglou/pretext", version: "v0.0.5", role: "Userland multiline canvas text measurement", link: "https://github.com/chenglou/pretext" },
      { name: "Greedy LPT Scheduler", version: "Custom", role: "Zero-whitespace masonry bento grid packing" },
      { name: "ResizeObserver", version: "Native", role: "Asynchronous element boundary surveillance" },
    ],
    keyHighlights: [
      "Eliminates standard getBoundingClientRect layout thrashing (30ms -> <1ms)",
      "Zero-reflow multiline text prediction calculated entirely in userland memory",
      "Two-phase preparation architecture synchronizing Tailwind CSS font tokens",
    ],
    architecturalRationale:
      "By calculating text heights via cached canvas metrics instead of querying the DOM directly, the masonry showcase eliminates reflow stalls and maintains 60 FPS transitions during continuous window resizing.",
  },
  {
    id: "database",
    category: "Database & Edge Caching",
    icon: <IconDatabase className="w-5 h-5 text-amber-400" />,
    accentColor: "text-amber-400",
    borderColor: "hover:border-amber-400/40",
    glowColor: "bg-amber-500/5",
    technologies: [
      { name: "Prisma ORM", version: "v7.7.0", role: "Type-safe database client and schema migrations", link: "https://www.prisma.io" },
      { name: "Neon PostgreSQL", version: "Serverless", role: "Distributed Postgres over WebSocket pooler", link: "https://neon.tech" },
      { name: "Upstash Redis", version: "v1.38.0", role: "Low-latency sliding window rate limiting", link: "https://upstash.com" },
      { name: "Vercel KV & Analytics", version: "v3.0.0", role: "Edge telemetry logging and performance tracking" },
    ],
    keyHighlights: [
      "Zero cold-start connection pooling with Neon Serverless adapter",
      "Sliding-window IP rate limiting guarding API endpoints against brute force",
      "Declarative database migrations verified by automated CI integrity checks",
    ],
    architecturalRationale:
      "Serverless PostgreSQL combined with Redis edge rate limiting guarantees sub-50ms query responses without sustaining persistent idle database server overhead.",
  },
  {
    id: "graphics-audio",
    category: "Graphics, Canvas & Web Audio",
    icon: <IconDeviceGamepad2 className="w-5 h-5 text-rose-400" />,
    accentColor: "text-rose-400",
    borderColor: "hover:border-rose-400/40",
    glowColor: "bg-rose-500/5",
    technologies: [
      { name: "Web Audio API", version: "Native", role: "Procedural sound synthesis (zero audio mp3/wav files)" },
      { name: "Three.js", version: "v0.185.1", role: "3D cortical neuroimaging surface renderer", link: "https://threejs.org" },
      { name: "HTML5 2D Canvas", version: "Native", role: "High-performance arcade physics & raycasting" },
      { name: "Custom GLSL Shaders", version: "Custom", role: "Procedural CRT scanlines & phosphor bloom" },
    ],
    keyHighlights: [
      "100% procedural sound design with spatial stereo panning and chip timbres",
      "WebGL context loss & restoration lifecycle (webglcontextlost prevention)",
      "Accessible fallback DOM descriptors & touch-action isolation for mobile screens",
    ],
    architecturalRationale:
      "Building procedural audio synthesizers and resilient canvas game loops in native web primitives keeps the total application bundle lightweight while delivering rich sensory experiences.",
  },
  {
    id: "governance",
    category: "Quality, Security & Governance",
    icon: <IconCertificate className="w-5 h-5 text-indigo-400" />,
    accentColor: "text-indigo-400",
    borderColor: "hover:border-indigo-400/40",
    glowColor: "bg-indigo-500/5",
    technologies: [
      { name: "Vitest", version: "v4.x", role: "Unit, integration, and defect remediation test runner", link: "https://vitest.dev" },
      { name: "Playwright & @axe-core", version: "v1.60.0", role: "Synthetic browser probes & WCAG 2.1 AA a11y gates", link: "https://playwright.dev" },
      { name: "fast-check", version: "v4.9.0", role: "Property-based AST fuzzing & invariant validation" },
      { name: "TypeDoc & OpenAPI", version: "Automated", role: "Zero-drift automated specification generator" },
    ],
    keyHighlights: [
      "12 strict architectural invariants enforced across pre-commit & CI gates",
      "100% OpenAPI & TypeDoc synchronization with zero manual doc drift",
      "Red-Green Remediation Protocol preventing calculation regression bugs",
    ],
    architecturalRationale:
      "Automated verification tooling ensures that every API route, calculation engine, and user interface component maintains strict accessibility, correctness, and performance benchmarks.",
  },
];

export const StackLayerCards: React.FC = () => {
  const { playHover } = useAudio();

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono font-bold text-white flex items-center gap-2">
            <span>Architectural Layers &amp; Tech Stack</span>
            <IconSparkles className="w-4 h-4 text-brand-cyan" />
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Detailed breakdown of frontend frameworks, layout physics, databases, audio synthesizers, and verification suites.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {STACK_LAYERS.map((layer) => (
          <div
            key={layer.id}
            onMouseEnter={() => playHover()}
            className={`p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 ${layer.borderColor} transition-all duration-200 flex flex-col justify-between group backdrop-blur-sm relative overflow-hidden`}
          >
            {/* Ambient Corner Glow */}
            <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full ${layer.glowColor} blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500`} />

            <div>
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/90 group-hover:border-zinc-700 transition-colors">
                  {layer.icon}
                </div>
                <div>
                  <h3 className="text-sm font-mono font-bold text-white group-hover:text-zinc-100 transition-colors">
                    {layer.category}
                  </h3>
                  <span className={`text-[10px] font-mono ${layer.accentColor} font-semibold`}>
                    Core System Component
                  </span>
                </div>
              </div>

              {/* Technologies List */}
              <div className="space-y-2 mb-4">
                {layer.technologies.map((tech) => (
                  <div
                    key={tech.name}
                    className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-white truncate">
                          {tech.name}
                        </span>
                        {tech.version && (
                          <span className="text-[10px] font-mono text-muted bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                            {tech.version}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-sans truncate">
                        {tech.role}
                      </div>
                    </div>
                    {tech.link && (
                      <a
                        href={tech.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit ${tech.name} official documentation`}
                        className="text-muted hover:text-white transition-colors p-1"
                      >
                        <IconExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Architectural Rationale */}
              <div className="text-xs text-zinc-400 font-sans leading-relaxed mb-4 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
                <span className="font-mono text-[10px] uppercase font-bold text-muted block mb-1">
                  Architectural Rationale
                </span>
                {layer.architecturalRationale}
              </div>
            </div>

            {/* Highlights */}
            <div className="pt-3 border-t border-zinc-900/90">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block mb-1.5">
                Key Invariants
              </span>
              <ul className="space-y-1">
                {layer.keyHighlights.map((highlight, idx) => (
                  <li
                    key={idx}
                    className="text-[11px] font-sans text-zinc-300 flex items-start gap-1.5"
                  >
                    <span className={`w-1 h-1 rounded-full ${layer.accentColor} mt-1.5 flex-shrink-0`} />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
