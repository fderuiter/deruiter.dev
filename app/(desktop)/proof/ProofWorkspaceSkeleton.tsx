"use client";

import React from "react";
import { IconCpu, IconLink, IconPlus, IconDownload } from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";

export function ProofWorkspaceSkeleton() {
  return (
    <div className="min-h-dvh bg-brand-dark text-slate-100 flex flex-col font-sans pt-20 pb-12 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col gap-6">
        {/* Header and Breadcrumbs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center text-xs font-mono text-zinc-400 select-none"
            >
              <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <li className="inline-flex items-center gap-1.5 sm:gap-2">
                  <span className="hover:text-brand-cyan transition-colors duration-150 inline-flex items-center gap-1">
                    Home
                  </span>
                </li>
                <li className="inline-flex items-center gap-1.5 sm:gap-2">
                  <span className="text-zinc-600">/</span>
                  <span className="hover:text-brand-cyan transition-colors duration-150 inline-flex items-center gap-1">
                    Interactive Suite
                  </span>
                </li>
                <li className="inline-flex items-center gap-1.5 sm:gap-2">
                  <span className="text-zinc-600">/</span>
                  <span className="font-bold text-neutral-200">
                    Logical Proof Workspace
                  </span>
                </li>
              </ol>
            </nav>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <IconCpu className="w-8 h-8 text-brand-cyan animate-pulse" />
              Logical Proof Canvas
            </h1>
            <p className="text-sm text-slate-400">
              AST Natural Deduction & Distributed Systems Formal Invariant
              Workbench
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 text-xs font-semibold min-h-[48px] opacity-60 cursor-not-allowed"
            >
              <IconLink className="w-4 h-4 text-brand-cyan" />
              Share
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/10 text-brand-purple text-xs font-semibold min-h-[48px] opacity-60 cursor-not-allowed"
            >
              <IconPlus className="w-4 h-4" />
              Custom Studio
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 text-xs font-semibold min-h-[48px] opacity-60 cursor-not-allowed"
            >
              <IconDownload className="w-4 h-4" />
              Export
            </button>
            <FieldManualButton manualId="proof" />
          </div>
        </div>

        {/* Curriculum Domain Carousel */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Curriculum Invariant Catalog
            </span>
            <span className="text-xs font-mono text-brand-cyan">
              Status: ⏳ IN PROGRESS
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="flex flex-col text-left p-2.5 rounded-xl border bg-slate-900/60 border-slate-800 min-h-[62px] h-auto"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="w-12 h-3.5 rounded bg-slate-800 animate-pulse" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800 animate-pulse" />
                </div>
                <div className="w-20 h-3 rounded bg-slate-800 mb-1 animate-pulse" />
                <div className="w-16 h-2 rounded bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Workspace Layout: Canvas on Left/Center, Inspector on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Canvas Section */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden flex flex-col shadow-2xl relative">
              {/* Canvas Header */}
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 h-[49px]">
                <div className="w-24 h-4 bg-slate-800 rounded animate-pulse" />
                <div className="flex items-center gap-2">
                  <div className="w-14 h-7 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-24 h-7 bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>

              {/* Tactic Goal Ribbon */}
              <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs h-[37px]">
                <div className="w-48 h-4 bg-slate-800 rounded animate-pulse" />
                <div className="w-16 h-4 bg-slate-800 rounded animate-pulse" />
              </div>

              {/* SVG Canvas Area placeholder */}
              <div
                tabIndex={0}
                role="region"
                aria-label="Proof workspace canvas skeleton"
                className="relative w-full h-[420px] bg-gradient-to-b from-slate-950/60 via-slate-900 to-slate-950 select-none overflow-x-auto overflow-y-hidden"
              >
                <div className="relative min-w-[760px] h-full flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <pattern
                        id="skeleton-grid"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <circle
                          cx="2"
                          cy="2"
                          r="1"
                          fill="#334155"
                          opacity={0.15}
                        />
                      </pattern>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#skeleton-grid)"
                    />
                  </svg>
                  <div className="text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-slate-800 border-t-brand-cyan rounded-full animate-spin" />
                    <span>Loading Workspace Canvas...</span>
                  </div>
                </div>
              </div>

              {/* Floating Rule Palette Dock placeholder */}
              <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 h-[57px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="w-20 h-4 bg-slate-800 rounded animate-pulse" />
                  <div className="w-16 h-8 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-16 h-8 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="w-16 h-8 bg-slate-800 rounded-lg animate-pulse" />
                </div>
                <div className="w-24 h-8 bg-slate-800 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          {/* Right Inspector Section */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden flex flex-col shadow-xl">
              {/* Tab Selector */}
              <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/40 text-xs font-medium h-[41px]">
                <div className="border-b-2 border-brand-cyan bg-slate-900 flex items-center justify-center text-slate-400 font-bold">
                  Ledger
                </div>
                <div className="border-transparent flex items-center justify-center text-slate-400">
                  Systems
                </div>
                <div className="border-transparent flex items-center justify-center text-slate-400">
                  Fallacy
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-4 flex flex-col gap-4 min-h-[380px] max-h-[460px] overflow-y-auto">
                <div className="space-y-3">
                  <div className="w-full h-12 bg-slate-800/60 rounded-xl animate-pulse" />
                  <div className="w-full h-12 bg-slate-800/60 rounded-xl animate-pulse" />
                  <div className="w-full h-12 bg-slate-800/60 rounded-xl animate-pulse" />
                  <div className="w-5/6 h-12 bg-slate-800/60 rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
