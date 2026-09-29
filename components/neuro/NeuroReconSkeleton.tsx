import React from "react";
import { Icon3dCubeSphere } from "@tabler/icons-react";

export const NeuroReconSkeleton: React.FC = () => {
  return (
    <div
      className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 w-full select-none animate-pulse space-y-6"
      data-testid="neuro-recon-skeleton"
    >
      {/* Top Header HUD Skeleton */}
      <div className="p-4 rounded-3xl border border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-zinc-800 rounded" />
            <div className="h-3 w-64 bg-zinc-800/60 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-9 bg-zinc-800 rounded-xl" />
          <div className="w-32 h-9 bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Main Slice / 3D Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[460px] bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center gap-3 p-6">
          <Icon3dCubeSphere className="w-12 h-12 text-zinc-700 animate-pulse" />
          <div className="h-4 w-48 bg-zinc-800 rounded" />
          <p className="text-xs font-mono text-zinc-500">
            INITIALIZING NEURORECON WORKSPACE & 3D MESH...
          </p>
        </div>
        <div className="lg:col-span-4 h-[460px] bg-zinc-950 rounded-2xl border border-zinc-800 p-4 space-y-4">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="space-y-3">
            <div className="h-16 bg-zinc-900/80 rounded-xl" />
            <div className="h-16 bg-zinc-900/80 rounded-xl" />
            <div className="h-16 bg-zinc-900/80 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};
