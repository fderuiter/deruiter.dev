"use client";

import React from "react";

export function SchemaFlowWorkspaceSkeleton() {
  return (
    <div
      className="w-full flex flex-col gap-6 font-sans select-none min-h-[520px]"
      data-testid="schemaflow-skeleton"
    >
      {/* Main split dashboard workspace skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch h-auto min-h-[520px]">
        {/* Left Side: Proof Canvas & Telemetry Skeleton */}
        <div className="lg:col-span-8 flex flex-col gap-5 bg-zinc-950 border border-zinc-900 rounded-3xl p-5 relative overflow-hidden animate-pulse">
          {/* Header row skeleton */}
          <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
            <div className="space-y-2">
              <div className="h-4 w-48 bg-zinc-900 rounded border border-zinc-850" />
              <div className="h-5 w-56 bg-zinc-900 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-28 bg-zinc-900 border border-zinc-850 rounded-xl" />
              <div className="h-7 w-24 bg-zinc-900 border border-zinc-850 rounded-xl" />
            </div>
          </div>

          {/* Interactive Declarative SVG Proof Tree Canvas Placeholder */}
          <div className="w-full min-h-[360px] h-auto bg-zinc-900/40 rounded-2xl border border-zinc-900 relative flex flex-col justify-between p-4">
            {/* SVG Node mock graphic grid */}
            <svg
              className="w-full h-full select-none opacity-40"
              viewBox="0 0 800 420"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Mock Edge lines */}
              <path
                d="M 190 120 L 450 220"
                stroke="#27272a"
                strokeWidth="2"
                strokeDasharray="6 4"
                fill="none"
              />
              <path
                d="M 190 320 L 450 220"
                stroke="#27272a"
                strokeWidth="2"
                strokeDasharray="6 4"
                fill="none"
              />
              <path
                d="M 450 220 L 710 300"
                stroke="#27272a"
                strokeWidth="2"
                strokeDasharray="6 4"
                fill="none"
              />

              {/* Mock Node cards */}
              <rect
                x="100"
                y="80"
                width="180"
                height="80"
                rx="12"
                fill="#09090b"
                stroke="#27272a"
                strokeWidth="1.5"
              />
              <rect
                x="100"
                y="280"
                width="180"
                height="80"
                rx="12"
                fill="#09090b"
                stroke="#27272a"
                strokeWidth="1.5"
              />
              <rect
                x="360"
                y="180"
                width="180"
                height="80"
                rx="12"
                fill="#09090b"
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="4"
              />
              <rect
                x="360"
                y="340"
                width="180"
                height="80"
                rx="12"
                fill="#09090b"
                stroke="#27272a"
                strokeWidth="1.5"
              />
              <rect
                x="620"
                y="260"
                width="180"
                height="80"
                rx="12"
                fill="#09090b"
                stroke="#27272a"
                strokeWidth="1.5"
              />
            </svg>

            {/* Floating prompt guidance placeholder */}
            <div className="absolute bottom-3 left-3 right-3 bg-zinc-950/80 border border-zinc-900 rounded-xl p-2.5 flex items-center justify-between">
              <div className="h-3 w-64 bg-zinc-900 rounded" />
              <div className="h-4 w-36 bg-zinc-900 rounded border border-zinc-850" />
            </div>
          </div>

          {/* Telemetry and Goal Status Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between h-24">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-850 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-28 bg-zinc-900 rounded" />
                  <div className="h-2.5 w-48 bg-zinc-900/80 rounded" />
                </div>
              </div>
              <div className="h-2 w-full bg-zinc-900 rounded" />
            </div>

            <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex gap-4 items-center h-24">
              <div className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-zinc-850 shrink-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-zinc-950" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="h-3 w-32 bg-zinc-900 rounded" />
                <div className="h-2.5 w-40 bg-zinc-900/80 rounded" />
                <div className="h-5 w-24 bg-zinc-900 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Accessible Command CLI Terminal Skeleton */}
        <div className="lg:col-span-4 flex flex-col bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden relative min-h-[300px] animate-pulse">
          <div className="border-b border-zinc-900 bg-zinc-950/80 px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
              <span className="text-[10px] font-mono text-muted font-bold ml-2">
                PROOF-TACTIC-SHELL
              </span>
            </div>
            <div className="w-4 h-4 rounded bg-zinc-900" />
          </div>

          <div className="flex-1 p-4 font-mono text-[10px] space-y-3 min-h-[220px]">
            <div className="h-3 w-3/4 bg-zinc-900 rounded" />
            <div className="h-3 w-1/2 bg-zinc-900/80 rounded" />
            <div className="h-3 w-5/6 bg-zinc-900/60 rounded" />
            <div className="h-3 w-2/3 bg-zinc-900/40 rounded" />
          </div>

          <div className="border-t border-zinc-900 bg-zinc-950 px-4 py-3 flex items-center gap-2">
            <span className="text-zinc-700 font-mono text-[10px]">
              ~ tactic-cli $
            </span>
            <div className="h-3 w-32 bg-zinc-900 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchemaFlowWorkspaceSkeleton;
