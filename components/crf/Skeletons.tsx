import React from "react";

/* jscpd:ignore-start */
export const VisitMatrixEditorSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-3 sm:p-6 overflow-y-auto animate-pulse">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-zinc-800">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
            <div className="h-5 w-64 bg-zinc-800 rounded-md" />
          </div>
          <div className="h-3 w-96 bg-zinc-800/60 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-7 bg-zinc-800 rounded-xl" />
          <div className="w-24 h-8 bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4">
        {/* Table header row mock */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
          <div className="h-4 bg-zinc-800 rounded-md w-1/3" />
          <div className="h-4 bg-zinc-800 rounded-md w-1/2" />
          <div className="h-4 bg-zinc-800 rounded-md w-1/4" />
          <div className="h-4 bg-zinc-800 rounded-md w-1/3" />
        </div>
        {/* Table body mock */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/50"
          >
            <div className="h-4 bg-zinc-800/80 rounded-md w-2/3" />
            <div className="h-4 bg-zinc-800/60 rounded-md w-3/4" />
            <div className="h-4 bg-zinc-800/50 rounded-md w-1/2" />
            <div className="h-4 bg-zinc-800/60 rounded-md w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const RuleGraphStudioSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-4 sm:p-6 overflow-y-auto space-y-6 animate-pulse">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
            <div className="h-5 w-64 bg-zinc-800 rounded-md" />
          </div>
          <div className="h-3 w-96 bg-zinc-800/60 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48 h-8 bg-zinc-800 rounded-xl" />
          <div className="w-24 h-8 bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Visual DAG placeholder */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 shadow-xl min-h-64 h-auto flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-zinc-800 rounded-md w-64" />
          <div className="h-3 bg-zinc-800 rounded-md w-32" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-8">
          <div className="w-24 h-12 bg-zinc-800 rounded-xl" />
          <div className="w-8 h-0.5 bg-zinc-800" />
          <div className="w-24 h-12 bg-zinc-800 rounded-xl" />
          <div className="w-8 h-0.5 bg-zinc-800" />
          <div className="w-24 h-12 bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 min-h-64 h-auto">
          <div className="h-4 bg-zinc-800 rounded-md w-40" />
          <div className="space-y-2">
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 min-h-64 h-auto">
          <div className="h-4 bg-zinc-800 rounded-md w-40" />
          <div className="space-y-2">
            <div className="h-20 bg-zinc-800/60 rounded-xl" />
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const LiveEdcSimulatorSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-4 sm:p-6 overflow-y-auto space-y-6 animate-pulse">
      {/* Top Banner & Multi-Role Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-6 border-b border-zinc-800">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
            <div className="h-5 w-64 bg-zinc-800 rounded-md" />
          </div>
          <div className="h-3 w-96 bg-zinc-800/60 rounded-md" />
        </div>
        <div className="w-64 h-8 bg-zinc-800 rounded-xl" />
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <div className="w-24 h-7 bg-zinc-800 rounded-xl" />
        <div className="w-24 h-7 bg-zinc-800 rounded-xl" />
        <div className="w-24 h-7 bg-zinc-800 rounded-xl" />
      </div>

      {/* Simulator view split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 h-[500px]">
          <div className="h-4 bg-zinc-800 rounded-md w-40" />
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <div className="h-3 bg-zinc-800 rounded w-1/4" />
              <div className="h-10 bg-zinc-800/60 rounded-xl" />
            </div>
            <div className="space-y-1">
              <div className="h-3 bg-zinc-800 rounded w-1/3" />
              <div className="h-10 bg-zinc-800/60 rounded-xl" />
            </div>
            <div className="space-y-1">
              <div className="h-3 bg-zinc-800 rounded w-1/5" />
              <div className="h-10 bg-zinc-800/60 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4 h-[500px] flex flex-col">
          <div className="h-4 bg-zinc-800 rounded-md w-40" />
          <div className="flex-1 space-y-2 pt-4">
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
/* jscpd:ignore-end */
};

export const WorkflowWizardModalSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-pulse">
      {/* Modal Wrapper */}
      <div className="w-full max-w-4xl h-full max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-zinc-800 shrink-0" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-64 bg-zinc-800 rounded-md" />
                <div className="h-4 w-24 bg-zinc-800 rounded-full" />
              </div>
              <div className="h-3 w-80 bg-zinc-800/60 rounded-md" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-zinc-800" />
        </div>

        {/* Stage Navigation Pills */}
        <div className="px-6 py-3 border-b border-zinc-800/60 bg-zinc-950 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40 h-11"
            />
          ))}
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4 min-h-64 h-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 bg-zinc-800 rounded w-48" />
                <div className="h-3 bg-zinc-800/60 rounded w-36" />
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <div className="h-3 bg-zinc-800/60 rounded w-full" />
              <div className="h-3 bg-zinc-800/60 rounded w-5/6" />
              <div className="h-3 bg-zinc-800/60 rounded w-4/5" />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-900/40 border-t border-zinc-800/80 flex items-center justify-between">
          <div className="w-24 h-9 bg-zinc-800 rounded-xl" />
          <div className="flex items-center gap-2">
            <div className="w-24 h-9 bg-zinc-800 rounded-xl" />
            <div className="w-32 h-9 bg-zinc-800 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const CRFStudioSkeleton: React.FC = () => {
  return (
    <div
      className="w-full h-[800px] min-h-[600px] bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden flex flex-col p-4 select-none animate-pulse"
      data-testid="crf-studio-skeleton"
    >
      {/* Studio Header Skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800" />
          <div className="h-5 w-48 bg-zinc-800 rounded-md" />
          <div className="h-4 w-24 bg-zinc-800/60 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-8 bg-zinc-800 rounded-xl" />
          <div className="w-24 h-8 bg-zinc-800 rounded-xl" />
          <div className="w-8 h-8 bg-zinc-800 rounded-xl" />
        </div>
      </div>
      {/* Body Grid Skeleton */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 overflow-hidden">
        {/* Left Navigator Skeleton */}
        <div className="lg:col-span-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/60 p-4 space-y-3">
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
          <div className="space-y-2 pt-2">
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
            <div className="h-10 bg-zinc-800/60 rounded-xl" />
          </div>
        </div>
        {/* Center Canvas Skeleton */}
        <div className="lg:col-span-6 bg-zinc-900/30 rounded-2xl border border-zinc-800/60 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="h-6 bg-zinc-800 rounded w-1/3" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
            <div className="h-12 bg-zinc-800/60 rounded-xl" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>LOADING CRF STUDIO WORKSPACE...</span>
            <span>INITIALIZING PRESETS</span>
          </div>
        </div>
        {/* Right Inspector Skeleton */}
        <div className="lg:col-span-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/60 p-4 space-y-3">
          <div className="h-4 bg-zinc-800 rounded w-2/3" />
          <div className="h-24 bg-zinc-800/40 rounded-xl" />
          <div className="h-24 bg-zinc-800/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
