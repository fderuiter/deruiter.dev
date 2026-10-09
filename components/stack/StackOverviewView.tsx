"use client";

import React from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  IconCpu,
  IconBolt,
  IconTerminal,
  IconCopy,
  IconCheck,
  IconArrowUpRight,
  IconBrandGithub,
} from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { useAudio } from "@/components/providers/AudioProvider";
import { useScrollToAnchor } from "@/hooks/useScrollToAnchor";
import { PretextBenchmarkLab } from "./PretextBenchmarkLab";
import { AudioSynthLab } from "./AudioSynthLab";
import { StackLayerCards } from "./StackLayerCards";
import { InvariantsMatrix } from "./InvariantsMatrix";
import { getNavBreadcrumbParents } from "@/lib/navigation";

const CLI_SNIPPETS = [
  {
    title: "Full Quality Check",
    cmd: "npm run quality",
    desc: "Checks types, lint rules, documentation, page performance, and architecture.",
  },
  {
    title: "Regenerate the Docs",
    cmd: "npm run doctor:fix",
    desc: "Regenerates OpenAPI schemas, updates TypeDoc markdown, and synchronizes AST logic contracts.",
  },
  {
    title: "Property Fuzz Testing",
    cmd: "npm run test:fuzz",
    desc: "Runs fast-check generative property tests across formal logic rules and clinical derivation ASTs.",
  },
  {
    title: "Page Performance Benchmark",
    cmd: "npm run bench:pages",
    desc: "Measures Pretext layout computation overhead, DOM reflow metrics, and server rendering latency.",
  },
];

export const StackOverviewView: React.FC = () => {
  const { playHover, playSuccess } = useAudio();

  const handleAnchorClick = useScrollToAnchor({
    onNavigate: () => playHover(),
  });

  return (
    <div className="bg-zinc-950 text-foreground pb-24 px-4 sm:px-6 md:px-12 lg:px-24 relative overflow-hidden">
      {/* Ambient Atmospheric Glows */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[340px] bg-brand-cyan/5 blur-[140px] pointer-events-none -z-10 rounded-full hidden sm:block" />
      <div className="absolute top-[600px] right-1/4 w-[500px] h-[300px] bg-purple-500/5 blur-[140px] pointer-events-none -z-10 rounded-full hidden sm:block" />
      <div className="absolute top-[1200px] left-1/4 w-[500px] h-[300px] bg-emerald-500/5 blur-[140px] pointer-events-none -z-10 rounded-full hidden sm:block" />

      <div className="max-w-6xl mx-auto flex flex-col items-center relative z-10">
        {/* Navigation Breadcrumbs & Live Status */}
        <div className="w-full flex items-center justify-between mb-8 gap-4 flex-wrap">
          <Breadcrumbs
            items={[
              ...getNavBreadcrumbParents("/stack"),
              { label: "Under the Hood (Stack)" },
            ]}
          />
          <div className="flex items-center gap-2 text-xs font-mono text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
            <span>Architecture v0.4.0 • Turbopack Active</span>
          </div>
        </div>

        {/* Hero Blueprint Section */}
        <section className="w-full text-center sm:text-left mb-12 border-b border-zinc-900 pb-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                <IconCpu className="w-3.5 h-3.5 text-brand-cyan" />
                <span>HOW THIS SITE WORKS</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-mono font-extrabold tracking-tight text-white leading-tight">
                Under the Hood: <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-teal-300 to-emerald-400">
                  The Portfolio Tech Stack
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 font-sans leading-relaxed max-w-2xl">
                The tools and tradeoffs behind this site. Try the text layout
                and audio demos, look through the stack, or run the checks
                yourself.
              </p>
            </div>

            {/* Quick Links / GitHub */}
            <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-wrap">
              <a
                href="https://github.com/fderuiter/deruiter.dev"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => playHover()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer group"
              >
                <IconBrandGithub className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                <span>View Source on GitHub</span>
                <IconArrowUpRight className="w-3 h-3 text-muted group-hover:text-brand-cyan transition-colors" />
              </a>
            </div>
          </div>

          {/* Quick Jump Anchors */}
          <div className="flex items-center gap-2 flex-wrap mt-8 pt-6 border-t border-zinc-900/80">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted mr-2">
              Jump To:
            </span>
            <a
              href="#pretext-lab"
              onClick={(e) => handleAnchorClick(e, "pretext-lab")}
              className="px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-brand-cyan/40 text-xs font-mono text-zinc-400 hover:text-brand-cyan transition-all"
            >
              Layout Physics Lab
            </a>
            <a
              href="#audio-lab"
              onClick={(e) => handleAnchorClick(e, "audio-lab")}
              className="px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-purple-400/40 text-xs font-mono text-zinc-400 hover:text-purple-300 transition-all"
            >
              Web Audio Synthesizer
            </a>
            <a
              href="#stack-layers"
              onClick={(e) => handleAnchorClick(e, "stack-layers")}
              className="px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-400/40 text-xs font-mono text-zinc-400 hover:text-emerald-300 transition-all"
            >
              Stack Layers
            </a>
            <a
              href="#invariants"
              onClick={(e) => handleAnchorClick(e, "invariants")}
              className="px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-amber-400/40 text-xs font-mono text-zinc-400 hover:text-amber-300 transition-all"
            >
              Quality Rules
            </a>
            <a
              href="#quickstart"
              onClick={(e) => handleAnchorClick(e, "quickstart")}
              className="px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-cyan-400/40 text-xs font-mono text-zinc-400 hover:text-cyan-300 transition-all"
            >
              CLI Quickstart
            </a>
          </div>
        </section>

        {/* Section 1: Interactive Physics & Audio Micro-Labs */}
        <section className="w-full space-y-8 mb-16">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-mono font-bold text-white flex items-center gap-2">
                <span>Try the Moving Parts</span>
                <IconBolt className="w-4 h-4 text-brand-cyan" />
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Small demos of how the browser lays out text and makes sound.
              </p>
            </div>
          </div>

          <div
            id="pretext-lab"
            className="scroll-mt-[calc(var(--navbar-height)+2rem)]"
          >
            <PretextBenchmarkLab />
          </div>

          <div
            id="audio-lab"
            className="scroll-mt-[calc(var(--navbar-height)+2rem)]"
          >
            <AudioSynthLab />
          </div>
        </section>

        {/* Section 2: Modular Stack Layers */}
        <section
          id="stack-layers"
          className="w-full mb-16 scroll-mt-[calc(var(--navbar-height)+2rem)]"
        >
          <StackLayerCards />
        </section>

        {/* Section 3: 12 Architectural Invariants */}
        <section
          id="invariants"
          className="w-full mb-16 scroll-mt-[calc(var(--navbar-height)+2rem)]"
        >
          <InvariantsMatrix />
        </section>

        {/* Section 4: Developer CLI Quickstart */}
        <section
          id="quickstart"
          className="w-full mb-16 scroll-mt-[calc(var(--navbar-height)+2rem)]"
        >
          <div className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 pb-5 border-b border-zinc-800/80 mb-5">
              <div className="p-2.5 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
                <IconTerminal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-mono font-bold text-white">
                  Run the Checks
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Run the exact test suites and verification tooling locally to
                  inspect quality gates and specifications.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CLI_SNIPPETS.map((snippet) => (
                <div
                  key={snippet.cmd}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between"
                >
                  <div className="mb-3">
                    <div className="text-xs font-mono font-bold text-white mb-1">
                      {snippet.title}
                    </div>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      {snippet.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 gap-2">
                    <code className="text-xs font-mono text-brand-cyan truncate">
                      {snippet.cmd}
                    </code>
                    <CopyButton
                      text={snippet.cmd}
                      icon={<IconCopy className="w-3.5 h-3.5" />}
                      copiedIcon={
                        <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                      }
                      className="text-muted hover:text-white transition-colors p-1 cursor-pointer flex-shrink-0"
                      aria-label={`Copy command ${snippet.cmd}`}
                      successMessage={`Command copied to clipboard: ${snippet.cmd}`}
                      onCopySuccess={() => playSuccess()}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Next/Prev Navigation */}
        <NextPrevNav
          prev={{
            title: "CRF Studio (Clinical Protocol Designer)",
            href: "/crf",
            label: "Previous Workspace",
          }}
          next={{
            title: "Say Hi & Book a Chat",
            href: "/schedule",
            label: "Connect With Me",
          }}
          backToHub={{
            title: "Explore All Case Studies",
            href: "/case-studies",
          }}
          className="max-w-6xl"
        />
      </div>
    </div>
  );
};
