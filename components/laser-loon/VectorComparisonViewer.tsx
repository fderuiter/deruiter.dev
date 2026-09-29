"use client";

import React, { useState } from "react";
import {
  IconLayersDifference,
  IconEye,
  IconFlame,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react";

export const VectorComparisonViewer: React.FC = () => {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<"slider" | "split" | "overlay">(
    "slider"
  );
  const [activeLayer, setActiveLayer] = useState<
    "all" | "silhouette" | "laser"
  >("all");

  return (
    <div className="w-full my-8 p-5 sm:p-7 bg-zinc-950/90 border border-red-500/30 rounded-3xl shadow-[0_0_40px_rgba(239,68,68,0.15)] backdrop-blur-md">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30 mb-2">
            <IconLayersDifference className="w-3.5 h-3.5" />
            <span>LOON / LASERS / BOTH</span>
          </div>
          <h3 className="text-xl font-bold font-mono text-white">
            A Closer Look:{" "}
            <span className="text-red-400">The Bird and the Lasers</span>
          </h3>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Slide between the bird and its lasers, compare them side by side, or
            turn each layer on and off.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode("slider")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
              viewMode === "slider"
                ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            Split Slider
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
              viewMode === "split"
                ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            Side-By-Side
          </button>
          <button
            onClick={() => setViewMode("overlay")}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
              viewMode === "overlay"
                ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            Pass Toggle
          </button>
        </div>
      </div>

      {/* Layer Visibility Badges for Overlay Mode */}
      {viewMode === "overlay" && (
        <div className="flex items-center gap-2 mb-4 bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
          <span className="text-xs font-mono text-zinc-400 px-2">
            Active Render Pass:
          </span>
          <button
            onClick={() => setActiveLayer("silhouette")}
            className={`px-3 py-1 text-xs font-mono rounded-md border transition-all ${
              activeLayer === "silhouette"
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                : "bg-black/40 text-zinc-400 border-zinc-800"
            }`}
          >
            Pass 1: Silhouette Only
          </button>
          <button
            onClick={() => setActiveLayer("laser")}
            className={`px-3 py-1 text-xs font-mono rounded-md border transition-all ${
              activeLayer === "laser"
                ? "bg-red-500/20 text-red-300 border-red-500/50"
                : "bg-black/40 text-zinc-400 border-zinc-800"
            }`}
          >
            Pass 2: Laser Optics Only
          </button>
          <button
            onClick={() => setActiveLayer("all")}
            className={`px-3 py-1 text-xs font-mono rounded-md border transition-all ${
              activeLayer === "all"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-black/40 text-zinc-400 border-zinc-800"
            }`}
          >
            Combined Output
          </button>
        </div>
      )}

      {/* Main Canvas Viewport */}
      {viewMode === "slider" && (
        <div className="relative w-full aspect-[16/10] max-h-[500px] rounded-2xl border border-zinc-800 overflow-hidden bg-[#070b12] select-none">
          {/* Base Layer: Pass 1 (Silhouette Only) */}
          <div className="absolute inset-0 w-full h-full">
            <svg viewBox="0 0 800 500" className="w-full h-full">
              <rect width="800" height="500" fill="#0b111e" />
              <ellipse
                cx="400"
                cy="420"
                rx="360"
                ry="40"
                fill="#0284c7"
                opacity="0.15"
              />
              {/* Silhouette Body */}
              <path
                d="M 120 380 C 100 340 110 290 150 260 C 180 238 210 230 230 200 C 240 180 238 150 255 135 C 270 122 300 125 315 145 C 325 160 320 185 305 205 C 290 225 275 235 270 255 C 260 295 310 320 390 320 C 470 320 540 290 580 320 C 610 342 600 380 570 395 C 480 415 220 420 120 380 Z"
                fill="#0a0c10"
                stroke="#334155"
                strokeWidth="4"
              />
              <path
                d="M 230 260 C 245 285 260 315 310 330 C 360 345 430 345 470 330 C 420 375 320 380 240 365 C 200 355 170 330 180 300 C 190 275 215 265 230 260 Z"
                fill="#ffffff"
              />
              <g fill="#ffffff" opacity="0.9">
                <rect x="360" y="325" width="8" height="8" rx="1" />
                <rect x="380" y="323" width="8" height="8" rx="1" />
                <rect x="400" y="322" width="8" height="8" rx="1" />
                <rect x="420" y="323" width="8" height="8" rx="1" />
                <rect x="350" y="338" width="9" height="9" rx="1" />
                <rect x="372" y="336" width="9" height="9" rx="1" />
                <rect x="395" y="335" width="9" height="9" rx="1" />
              </g>
              <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
                <line x1="250" y1="210" x2="275" y2="213" />
                <line x1="248" y1="218" x2="277" y2="222" />
                <line x1="247" y1="226" x2="279" y2="231" />
              </g>
              <path
                d="M 285 155 L 200 170 L 275 182 Z"
                fill="#05070a"
                stroke="#334155"
                strokeWidth="2"
              />
              <circle
                cx="275"
                cy="162"
                r="8"
                fill="#ff0044"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </svg>
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold uppercase">
              Pass 1: Silhouette &amp; Anatomical Geometry
            </div>
          </div>

          {/* Top Overlay Layer: Pass 2 (Laser Illumination) Clipped by Slider */}
          <div
            className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]"
            style={{ width: `${sliderPos}%` }}
          >
            <div className="absolute inset-0 w-full min-w-[800px] h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/files/Laser_loon.svg"
                alt="Laser Loon Master Vector"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-red-950/80 border border-red-500/40 text-red-300 font-mono text-[10px] font-bold uppercase whitespace-nowrap">
              Pass 2: Laser Optical Rays &amp; Radial Glow
            </div>
          </div>

          {/* Drag Handle Bar */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize flex items-center justify-center z-20 group"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="w-7 h-7 rounded-full bg-red-500 text-black border-2 border-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
              <IconAdjustmentsHorizontal className="w-4 h-4" />
            </div>
          </div>

          {/* Range Input Overlay for Drag Interactivity */}
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
            aria-label="Vector pass comparison slider position"
          />
        </div>
      )}

      {/* Side-by-Side View Mode */}
      {viewMode === "split" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col items-center p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <span className="text-xs font-mono font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
              <IconEye className="w-4 h-4" />
              Pass 1: Silhouette Vector
            </span>
            <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-zinc-800 bg-[#070b12]">
              <svg viewBox="0 0 800 500" className="w-full h-full">
                <rect width="800" height="500" fill="#0b111e" />
                <ellipse
                  cx="400"
                  cy="420"
                  rx="360"
                  ry="40"
                  fill="#0284c7"
                  opacity="0.15"
                />
                <path
                  d="M 120 380 C 100 340 110 290 150 260 C 180 238 210 230 230 200 C 240 180 238 150 255 135 C 270 122 300 125 315 145 C 325 160 320 185 305 205 C 290 225 275 235 270 255 C 260 295 310 320 390 320 C 470 320 540 290 580 320 C 610 342 600 380 570 395 C 480 415 220 420 120 380 Z"
                  fill="#0a0c10"
                  stroke="#334155"
                  strokeWidth="4"
                />
                <path
                  d="M 230 260 C 245 285 260 315 310 330 C 360 345 430 345 470 330 C 420 375 320 380 240 365 C 200 355 170 330 180 300 C 190 275 215 265 230 260 Z"
                  fill="#ffffff"
                />
                <path
                  d="M 285 155 L 200 170 L 275 182 Z"
                  fill="#05070a"
                  stroke="#334155"
                  strokeWidth="2"
                />
                <circle
                  cx="275"
                  cy="162"
                  r="8"
                  fill="#ff0044"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>

          <div className="flex flex-col items-center p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <span className="text-xs font-mono font-bold text-red-400 mb-2 flex items-center gap-1.5">
              <IconFlame className="w-4 h-4" />
              Pass 2: Laser Optics &amp; Rays
            </span>
            <div className="w-full aspect-[16/10] rounded-xl overflow-hidden border border-zinc-800 bg-[#070b12]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/files/Laser_loon.svg"
                alt="Laser Loon Master Vector"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {/* Pass Toggle Mode */}
      {viewMode === "overlay" && (
        <div className="relative w-full aspect-[16/10] max-h-[500px] rounded-2xl border border-zinc-800 overflow-hidden bg-[#070b12]">
          {activeLayer === "laser" ? (
            <div className="w-full h-full flex items-center justify-center bg-black p-8">
              <svg viewBox="0 0 800 500" className="w-full h-full">
                <rect width="800" height="500" fill="#050505" />
                <polygon
                  points="275,217 800,165 800,215 275,223"
                  fill="#ff0044"
                  opacity="0.9"
                />
                <line
                  x1="275"
                  y1="220"
                  x2="800"
                  y2="190"
                  stroke="#ffffff"
                  strokeWidth="6"
                />
                <line
                  x1="275"
                  y1="220"
                  x2="800"
                  y2="110"
                  stroke="#ff0044"
                  strokeWidth="2"
                  opacity="0.6"
                />
                <line
                  x1="275"
                  y1="220"
                  x2="800"
                  y2="280"
                  stroke="#ff0044"
                  strokeWidth="2"
                  opacity="0.6"
                />
                <circle cx="275" cy="220" r="16" fill="#ffffff" />
                <circle
                  cx="275"
                  cy="220"
                  r="28"
                  fill="none"
                  stroke="#ff0044"
                  strokeWidth="3"
                />
              </svg>
            </div>
          ) : activeLayer === "silhouette" ? (
            <div className="w-full h-full">
              <svg viewBox="0 0 800 500" className="w-full h-full">
                <rect width="800" height="500" fill="#0b111e" />
                <path
                  d="M 120 380 C 100 340 110 290 150 260 C 180 238 210 230 230 200 C 240 180 238 150 255 135 C 270 122 300 125 315 145 C 325 160 320 185 305 205 C 290 225 275 235 270 255 C 260 295 310 320 390 320 C 470 320 540 290 580 320 C 610 342 600 380 570 395 C 480 415 220 420 120 380 Z"
                  fill="#0a0c10"
                  stroke="#334155"
                  strokeWidth="4"
                />
                <path
                  d="M 230 260 C 245 285 260 315 310 330 C 360 345 430 345 470 330 C 420 375 320 380 240 365 C 200 355 170 330 180 300 C 190 275 215 265 230 260 Z"
                  fill="#ffffff"
                />
                <path
                  d="M 285 155 L 200 170 L 275 182 Z"
                  fill="#05070a"
                  stroke="#334155"
                  strokeWidth="2"
                />
                <circle
                  cx="275"
                  cy="162"
                  r="8"
                  fill="#ff0044"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </svg>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/files/Laser_loon.svg"
              alt="Laser Loon Master Combined Vector"
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* Footer Instructions */}
      <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] font-mono text-muted">
        <span>Pass 1: Common Loon (Gavia immer) Base Geometry</span>
        <span>
          Pass 2: Hard-Edge Vector Raytracing &amp; Radial Glow Filter
        </span>
      </div>
    </div>
  );
};

export const VectorComparisonTool = VectorComparisonViewer;
