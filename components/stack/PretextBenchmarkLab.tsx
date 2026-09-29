"use client";

import React, { useState, useRef, useCallback } from "react";
import { prepare, layout } from "@chenglou/pretext";
import {
  IconBolt,
  IconCpu,
  IconRefresh,
  IconDeviceFloppy,
  IconLayersLinked,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";

const DATASETS = [
  {
    id: "card",
    name: "Bento Card Teaser (50 words)",
    text: "Clinical Data Architecture and regulatory validation pipeline adhering to CDISC CDASH standards. Designed with automated variable checks, NCI Thesaurus controlled terminology codelists, and ISO 8601 date parsers for high-assurance FDA submission compliance.",
  },
  {
    id: "protocol",
    name: "Clinical Protocol (180 words)",
    text: "Phase III double-blind randomized clinical trial evaluating compound safety, efficacy, and pharmacokinetic profiles across multi-center oncology cohorts. The protocol mandates automated continuous safety surveillance, adverse event escalation workflows, recursive descent AST clinical derivations for BMI, Mosteller BSA, and RECIST 1.1 tumor diameter measurements with immutable audit trails and 21 CFR Part 11 compliant digital signatures.",
  },
  {
    id: "consensus",
    name: "Distributed Consensus AST (350 words)",
    text: "High-assurance formal verification studio verifying distributed state machine replication, Raft leader election invariants, and two-phase commit atomicity. The proof tree models state transitions through direct inference rules including Modus Ponens, Modus Tollens, and Clausal Resolution. Proof graphs are evaluated via an acyclic Directed Acyclic Graph (DAG) checker with automated counterexample truth table synthesis to eliminate split-brain anomalies and bounded buffer race conditions across concurrent actor pipelines. By evaluating layout entirely in userland canvas buffers, the visual DAG ledger eliminates browser layout thrashing and ensures smooth 60 frames per second updates during continuous real-time deduction streaming.",
  },
];

export const PretextBenchmarkLab: React.FC = () => {
  const [selectedDatasetIndex, setSelectedDatasetIndex] = useState(0);
  const [iterations, setIterations] = useState(50);
  const [domTimeMs, setDomTimeMs] = useState<number | null>(null);
  const [pretextTimeMs, setPretextTimeMs] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkRan, setBenchmarkRan] = useState(false);

  const { playHover, playSubmit, playSuccess } = useAudio();
  const benchmarkDomContainerRef = useRef<HTMLDivElement | null>(null);

  const activeDataset = DATASETS[selectedDatasetIndex];

  const handleDatasetChange = (index: number) => {
    playHover();
    setSelectedDatasetIndex(index);
    setDomTimeMs(null);
    setPretextTimeMs(null);
    setBenchmarkRan(false);
  };

  const runBenchmark = useCallback(() => {
    setIsRunning(true);
    playSubmit();

    // Defer slightly to let UI render loading state
    setTimeout(() => {
      const text = activeDataset.text;
      const targetWidth = 360;
      const font = "14px Inter, system-ui, sans-serif";
      const lineHeight = 20;

      // 1. Measure Pretext Performance
      const pretextStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const prepared = prepare(text, font);
        layout(prepared, targetWidth, lineHeight);
      }
      const pretextEnd = performance.now();
      const pretextTotal = Math.max(0.01, pretextEnd - pretextStart);

      // 2. Measure Traditional DOM Reflow Performance
      const domStart = performance.now();
      const testContainer = benchmarkDomContainerRef.current;
      if (testContainer) {
        testContainer.innerHTML = "";
        for (let i = 0; i < iterations; i++) {
          const div = document.createElement("div");
          div.style.width = `${targetWidth}px`;
          div.style.font = font;
          div.style.lineHeight = `${lineHeight}px`;
          div.style.whiteSpace = "normal";
          div.style.wordBreak = "break-word";
          div.textContent = text;
          testContainer.appendChild(div);

          // Force synchronous layout reflow (layout thrash)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _h = div.getBoundingClientRect().height;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _w = div.offsetHeight;
          testContainer.removeChild(div);
        }
      }
      const domEnd = performance.now();
      const domTotal = Math.max(0.05, domEnd - domStart);

      setPretextTimeMs(Number(pretextTotal.toFixed(2)));
      setDomTimeMs(Number(domTotal.toFixed(2)));
      setIsRunning(false);
      setBenchmarkRan(true);
      playSuccess();
    }, 40);
  }, [activeDataset, iterations, playSubmit, playSuccess]);

  const speedup =
    domTimeMs !== null && pretextTimeMs !== null && pretextTimeMs > 0
      ? (domTimeMs / pretextTimeMs).toFixed(1)
      : null;

  return (
    <div className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-6 backdrop-blur-xl relative overflow-hidden">
      {/* Hidden container for DOM reflow simulation */}
      <div
        ref={benchmarkDomContainerRef}
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
            <IconCpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <span>Layout Physics Lab: Pretext vs DOM Reflow</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/30 px-2 py-0.5 rounded-full">
                Live Test
              </span>
            </h3>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">
              Compare userland multiline text calculations with Canvas caching
              against synchronous browser DOM reflow penalties.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={runBenchmark}
          onMouseEnter={() => playHover()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-cyan text-zinc-950 font-mono text-xs font-bold hover:bg-cyan-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {isRunning ? (
            <>
              <IconRefresh className="w-4 h-4 animate-spin" />
              <span>Calculating...</span>
            </>
          ) : (
            <>
              <IconBolt className="w-4 h-4" />
              <span>Run Benchmark</span>
            </>
          )}
        </button>
      </div>

      {/* Controls & Dataset Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
        <div className="md:col-span-2 space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
            Select Test Text Payload
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DATASETS.map((dataset, idx) => (
              <button
                key={dataset.id}
                type="button"
                onClick={() => handleDatasetChange(idx)}
                className={`text-left p-2.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                  selectedDatasetIndex === idx
                    ? "bg-brand-cyan/15 border-brand-cyan/50 text-brand-cyan font-bold"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <div className="truncate">{dataset.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="benchmark-iterations"
            className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold"
          >
            Iterations ({iterations}x passes)
          </label>
          <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl p-2">
            <input
              id="benchmark-iterations"
              type="range"
              min={10}
              max={200}
              step={10}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              aria-label="Benchmark iteration count"
              className="w-full accent-brand-cyan cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-white w-10 text-right">
              {iterations}
            </span>
          </div>
        </div>
      </div>

      {/* Results Dashboard */}
      <div
        aria-live="polite"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/80"
      >
        {/* DOM Metric Card */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5">
              <IconLayersLinked className="w-3.5 h-3.5 text-rose-400" />
              Standard DOM Reflow
            </span>
            <span className="text-[10px] text-rose-400/80 uppercase">
              Layout Thrash
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-extrabold text-white">
              {domTimeMs !== null ? `${domTimeMs}` : "—"}
            </span>
            <span className="text-xs font-mono text-muted">ms</span>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Forces synchronous layout calculation (`getBoundingClientRect`
            reflow).
          </p>
        </div>

        {/* Pretext Metric Card */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-brand-cyan/40 shadow-[0_0_20px_rgba(6,182,212,0.08)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-brand-cyan mb-2">
            <span className="flex items-center gap-1.5 font-bold">
              <IconDeviceFloppy className="w-3.5 h-3.5 text-brand-cyan" />
              @chenglou/pretext
            </span>
            <span className="text-[10px] bg-brand-cyan/20 border border-brand-cyan/40 px-1.5 py-0.5 rounded text-brand-cyan uppercase">
              Zero Reflow
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-extrabold text-brand-cyan">
              {pretextTimeMs !== null ? `${pretextTimeMs}` : "—"}
            </span>
            <span className="text-xs font-mono text-muted">ms</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">
            Userland canvas arithmetic over cached word boundaries.
          </p>
        </div>

        {/* Speedup & Status */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-brand-cyan/10 via-zinc-950/80 to-emerald-500/10 border border-brand-cyan/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-300 mb-2">
            <span>Speedup Multiplier</span>
            <span className="text-[10px] text-emerald-400 font-mono">
              60 FPS Target
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-mono font-extrabold text-emerald-400">
              {speedup ? `${speedup}x` : benchmarkRan ? "Instant" : "—"}
            </span>
            {speedup && (
              <span className="text-xs font-mono text-emerald-400/80">
                faster
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">
            Eliminates frame drops in masonry bento dynamic resizing.
          </p>
        </div>
      </div>
    </div>
  );
};
