"use client";

import React, { useState, useMemo } from "react";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { IconBrain, IconCheck } from "@tabler/icons-react";

interface SubcorticalRegion {
  id: string;
  name: string;
  volumeMm3: number;
  normativePercentile: number;
  symmetryRatio: number;
  status: "normal" | "borderline" | "atrophy";
}

const SAMPLE_SUBCORTICAL_REGIONS: SubcorticalRegion[] = [
  {
    id: "left-hippocampus",
    name: "Left Hippocampus",
    volumeMm3: 3840,
    normativePercentile: 52,
    symmetryRatio: 0.98,
    status: "normal",
  },
  {
    id: "right-hippocampus",
    name: "Right Hippocampus",
    volumeMm3: 3910,
    normativePercentile: 55,
    symmetryRatio: 1.02,
    status: "normal",
  },
  {
    id: "left-amygdala",
    name: "Left Amygdala",
    volumeMm3: 1620,
    normativePercentile: 48,
    symmetryRatio: 0.97,
    status: "normal",
  },
  {
    id: "right-amygdala",
    name: "Right Amygdala",
    volumeMm3: 1670,
    normativePercentile: 50,
    symmetryRatio: 1.01,
    status: "normal",
  },
  {
    id: "left-thalamus",
    name: "Left Thalamus",
    volumeMm3: 7420,
    normativePercentile: 61,
    symmetryRatio: 0.99,
    status: "normal",
  },
  {
    id: "right-thalamus",
    name: "Right Thalamus",
    volumeMm3: 7490,
    normativePercentile: 63,
    symmetryRatio: 1.01,
    status: "normal",
  },
  {
    id: "lateral-ventricles",
    name: "Lateral Ventricles (Combined)",
    volumeMm3: 21400,
    normativePercentile: 42,
    symmetryRatio: 1.0,
    status: "normal",
  },
];

export function MobileNeuroClient() {
  const [selectedRegionId, setSelectedRegionId] =
    useState<string>("left-hippocampus");
  const [activeTab, setActiveTab] = useState<"regions" | "pipeline" | "qc">(
    "regions"
  );

  const selectedRegion = useMemo(
    () =>
      SAMPLE_SUBCORTICAL_REGIONS.find((r) => r.id === selectedRegionId) ||
      SAMPLE_SUBCORTICAL_REGIONS[0],
    [selectedRegionId]
  );

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white pb-12 flex flex-col gap-4">
      {/* Mobile Neuro Header */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 sticky top-16 z-20 backdrop-blur-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconBrain className="w-5 h-5 text-emerald-400" />
            <span className="font-mono text-sm font-bold tracking-wider text-neutral-100">
              NEURORECON (MOBILE)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <IconCheck className="w-3.5 h-3.5" /> RECON COMPLETE
          </span>
        </div>
        <p className="text-xs font-sans text-zinc-300">
          FreeSurfer v7.4.1 MRI Segmentation &amp; Structural Morphometry
          Metrics
        </p>
      </div>

      {/* Main Content Area */}
      <div className="px-4 flex flex-col gap-4">
        {/* Metric Summary Card */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-3">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            MORPHOMETRIC OVERVIEW
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400">TOTAL BRAIN VOL</span>
              <span className="text-sm font-bold text-white">1,245.8 cm³</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400">
                MEAN CORTICAL THICKNESS
              </span>
              <span className="text-sm font-bold text-emerald-400">
                2.48 mm
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400">GRAY MATTER VOL</span>
              <span className="text-sm font-bold text-white">682.4 cm³</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400">
                WHITE MATTER VOL
              </span>
              <span className="text-sm font-bold text-white">563.4 cm³</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("regions")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "regions"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-400"
            }`}
          >
            Subcortical Structures
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pipeline")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "pipeline"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-zinc-400"
            }`}
          >
            Pipeline Status
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "regions" && (
          <div className="flex flex-col gap-2.5">
            {SAMPLE_SUBCORTICAL_REGIONS.map((region) => {
              const isSelected = region.id === selectedRegionId;
              return (
                <div
                  key={region.id}
                  onClick={() => setSelectedRegionId(region.id)}
                  className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 border-emerald-500/60 shadow-md"
                      : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">{region.name}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      {region.volumeMm3.toLocaleString()} mm³
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-sans text-zinc-400">
                    <span>
                      Normative Percentile: {region.normativePercentile}th
                    </span>
                    <span>Symmetry: {region.symmetryRatio.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "pipeline" && (
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col gap-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-emerald-400">
                recon-all Stage History
              </span>
              <span className="text-zinc-500 text-[10px]">31 STAGES OK</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>1. Motion Correction &amp; Nu Intensity</span>
                <span className="text-emerald-400 font-bold">PASSED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>2. Skull Strip &amp; ASEG Subcortical</span>
                <span className="text-emerald-400 font-bold">PASSED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>3. Cortical Surface Tesselation</span>
                <span className="text-emerald-400 font-bold">PASSED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>4. Spherical Registration &amp; Parcellation</span>
                <span className="text-emerald-400 font-bold">PASSED</span>
              </div>
            </div>
          </div>
        )}

        {/* Selected Region Detail Inspector Card */}
        {selectedRegion && (
          <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/40 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono text-xs font-bold text-emerald-400 uppercase">
                ANATOMICAL REGION INSPECTOR
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {selectedRegion.id}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase">
                Region Name
              </label>
              <span className="font-mono text-sm font-bold text-white">
                {selectedRegion.name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">VOLUME</span>
                <span className="text-emerald-400 font-bold">
                  {selectedRegion.volumeMm3.toLocaleString()} mm³
                </span>
              </div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">
                  PERCENTILE
                </span>
                <span className="text-white font-bold">
                  {selectedRegion.normativePercentile}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="px-4 mt-6">
        <NextPrevNav
          prev={{
            title: "Logical Proof Workspace",
            href: "/m/proof",
            label: "Formal Logic Engine",
            tag: "Mobile Proof Canvas",
          }}
          next={{
            title: "Ski Patrol Shift Studio",
            href: "/m/patrol",
            label: "Patrol Operations",
            tag: "Mobile Judgment Engine",
          }}
          backToHub={{
            title: "Return to Portfolio",
            href: "/",
          }}
        />
      </div>
    </div>
  );
}
