"use client";

import React, { useState, useEffect } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { LeanProofStep, PuzzlerLevelDef } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import { generateLeanProofScript } from "@/lib/quasi-perfect/engine";
import {
  IconCode,
  IconBook,
  IconCopy,
  IconCheck,
  IconSparkles,
  IconRefresh,
  IconAlertTriangle,
  IconAlertCircle,
  IconTerminal,
} from "@tabler/icons-react";

interface LeanIdeInspectorProps {
  level: PuzzlerLevelDef;
  steps: LeanProofStep[];
  isComplete: boolean;
}

interface DiagnosticItem {
  line: number;
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

interface ServerVerifyResult {
  success: boolean;
  status: "verified" | "error" | "in_progress" | "fallback_simulated" | "idle";
  diagnostics: DiagnosticItem[];
  goalState?: string;
  executionTimeMs?: number;
  engine?: "lean4_kernel" | "fallback_simulator";
}

export const LeanIdeInspector: React.FC<LeanIdeInspectorProps> = ({
  level,
  steps,
  isComplete,
}) => {
  const [activeTab, setActiveTab] = useState<"code" | "encyclopedia">("code");
  const [selectedTactic, setSelectedTactic] = useState<string>("rfl");
  const [isLiveSync, setIsLiveSync] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [verifyResult, setVerifyResult] = useState<ServerVerifyResult>({
    success: true,
    status: "idle",
    diagnostics: [],
  });

  const leanCode = generateLeanProofScript(level, steps, isComplete);
  const hasAdmittedStep = steps.some((step) => step.tacticId === "sorry");

  const idleVerifyResult: ServerVerifyResult = {
    success: !hasAdmittedStep,
    status: "idle",
    diagnostics: [],
    goalState: isComplete ? "Goals closed (Local)" : "Proof in progress",
  };

  const effectiveVerifyResult = isLiveSync ? verifyResult : idleVerifyResult;

  useEffect(() => {
    if (!isLiveSync) return;

    let isMounted = true;

    const timer = setTimeout(async () => {
      if (isMounted) setIsSyncing(true);
      try {
        const res = await fetch("/api/quasi-perfect/lean-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theoremName: level.leanTheoremName || "custom_theorem",
            typeSignature: level.leanTypeSignature,
            leanScript: leanCode,
            proofSteps: steps.map((s) => ({
              id: s.id,
              tacticId: s.tacticId,
              leanLine: s.leanLine,
              goalBefore: s.goalBefore,
              goalAfter: s.goalAfter,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setVerifyResult({
            success: Boolean(data.success),
            status: data.status || "fallback_simulated",
            diagnostics: data.diagnostics || [],
            goalState:
              data.goalState ||
              (isComplete ? "Goals closed ✔" : "Proof in progress"),
            executionTimeMs: data.executionTimeMs,
            engine: data.engine,
          });
        }
      } catch {
        if (isMounted) {
          // Graceful fallback simulation if API endpoint fails
          const lines = leanCode.split("\n");
          const fallbackDiagnostics: DiagnosticItem[] = [];
          lines.forEach((line, idx) => {
            if (line.trim().startsWith("sorry")) {
              fallbackDiagnostics.push({
                line: idx + 1,
                severity: "warning",
                message: "Goal admitted via sorry axiom (Fallback)",
              });
            }
          });

          setVerifyResult({
            success: !hasAdmittedStep,
            status: "fallback_simulated",
            diagnostics: fallbackDiagnostics,
            goalState: isComplete
              ? "Goals closed (Fallback)"
              : "Proof in progress",
            engine: "fallback_simulator",
          });
        }
      } finally {
        if (isMounted) setIsSyncing(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [leanCode, isLiveSync, level, steps, isComplete, hasAdmittedStep]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono shadow-lg space-y-3">
      {/* Header Tabs & Sync Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTab === "code"
                ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconCode className="w-3.5 h-3.5" />
            <span>Lean 4 Code &amp; Live Server Sync</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("encyclopedia")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTab === "encyclopedia"
                ? "bg-brand-cyan text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <IconBook className="w-3.5 h-3.5" />
            <span>Tactic Encyclopedia</span>
          </button>
        </div>

        {activeTab === "code" && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Sync Toggle */}
            <button
              type="button"
              onClick={() => setIsLiveSync((prev) => !prev)}
              aria-pressed={isLiveSync}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                isLiveSync
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
            >
              <IconRefresh
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`}
              />
              <span>Live Lean 4 Sync: {isLiveSync ? "ON" : "OFF"}</span>
            </button>

            <CopyButton
              text={leanCode}
              label="Copy Generated Lean Text"
              copiedLabel="Copied!"
              icon={<IconCopy className="w-3.5 h-3.5" />}
              copiedIcon={
                <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
              }
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
              aria-label="Copy Generated Lean Text"
              successMessage="Generated Lean text copied to clipboard"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Live Lean 4 Script & Diagnostics */}
      {activeTab === "code" && (
        <div className="space-y-3">
          {/* Status Badge & Server Diagnostics Header */}
          <div className="flex items-center justify-between text-xs bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-bold">Kernel Status:</span>
              {isSyncing ? (
                <span className="text-cyan-400 font-bold flex items-center gap-1">
                  <IconRefresh className="w-3.5 h-3.5 animate-spin" />{" "}
                  Verifying...
                </span>
              ) : effectiveVerifyResult.status === "verified" ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <IconCheck className="w-3.5 h-3.5" /> Lean 4 Verified
                </span>
              ) : effectiveVerifyResult.status === "fallback_simulated" ? (
                <span className="text-amber-300 font-bold flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                  <IconAlertTriangle className="w-3.5 h-3.5" /> Fallback
                  Simulation Active
                </span>
              ) : effectiveVerifyResult.status === "error" ? (
                <span className="text-rose-400 font-bold flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                  <IconAlertCircle className="w-3.5 h-3.5" /> Kernel
                  Verification Error
                </span>
              ) : (
                <span className="text-zinc-400 font-semibold">
                  Local Uncompiled
                </span>
              )}

              {effectiveVerifyResult.executionTimeMs !== undefined && (
                <span className="text-[10px] text-zinc-400">
                  ({effectiveVerifyResult.executionTimeMs}ms)
                </span>
              )}
            </div>

            {effectiveVerifyResult.engine && (
              <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                Engine: {effectiveVerifyResult.engine}
              </span>
            )}
          </div>

          {/* Level Theory Card */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <IconSparkles className="w-3.5 h-3.5 text-purple-400" />
                {level.educationalConcept.title}
              </span>
              {level.educationalConcept.mathNotation && (
                <span className="rounded bg-black/50 px-2 py-0.5 text-[11px] text-amber-300 font-semibold border border-amber-500/30">
                  {level.educationalConcept.mathNotation}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
              {level.educationalConcept.summary}
            </p>
            <div className="mt-2 text-[10px] text-zinc-400 flex items-center gap-1">
              <span className="text-brand-cyan font-semibold">
                Real-World Application:
              </span>
              <span>{level.educationalConcept.realWorldApplication}</span>
            </div>
          </div>

          {/* Active Kernel Goal State Panel */}
          {effectiveVerifyResult.goalState && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-brand-cyan font-bold text-[11px] uppercase tracking-wider">
                <IconTerminal className="w-3.5 h-3.5" />
                <span>Active Kernel Goal State</span>
              </div>
              <div className="font-mono text-cyan-200 bg-black/60 p-2 rounded border border-cyan-500/20">
                {effectiveVerifyResult.goalState}
              </div>
            </div>
          )}

          {/* Syntax Highlighted Lean 4 Script & Line Diagnostics */}
          <div
            role="region"
            aria-label="Generated Lean source"
            tabIndex={0}
            className="relative rounded-xl border border-zinc-800 bg-zinc-900/90 p-3.5 overflow-x-auto"
          >
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-2 border-b border-zinc-800/80 pb-1.5">
              <span>
                Main.lean ·{" "}
                {isLiveSync ? "Lean 4 Server Connected" : "Local Generator"}
              </span>
              <span>
                {hasAdmittedStep
                  ? "Status: Goal admitted with sorry"
                  : isComplete
                    ? "Status: Goal closed ✔"
                    : "Status: Simulating..."}
              </span>
            </div>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre">
              {leanCode.split("\n").map((line, idx) => {
                const lineNum = idx + 1;
                const diag = effectiveVerifyResult.diagnostics.find(
                  (d) => d.line === lineNum
                );

                let colorClass = "text-zinc-300";
                if (line.startsWith("--")) colorClass = "text-zinc-400 italic";
                else if (line.startsWith("theorem"))
                  colorClass = "text-purple-400 font-bold";
                else if (
                  line.trim().startsWith("rfl") ||
                  line.trim().startsWith("ring") ||
                  line.trim().startsWith("exact") ||
                  line.trim().startsWith("symm")
                )
                  colorClass = "text-emerald-400 font-semibold";
                else if (
                  line.trim().startsWith("intro") ||
                  line.trim().startsWith("apply") ||
                  line.trim().startsWith("cases") ||
                  line.trim().startsWith("split") ||
                  line.trim().startsWith("left") ||
                  line.trim().startsWith("right") ||
                  line.trim().startsWith("constructor")
                )
                  colorClass = "text-brand-cyan font-semibold";
                else if (
                  line.trim().startsWith("rw") ||
                  line.trim().startsWith("simp")
                )
                  colorClass = "text-amber-400 font-semibold";
                else if (line.trim().startsWith("sorry"))
                  colorClass = "text-rose-400 font-bold";

                return (
                  <div key={idx} className="space-y-1">
                    <div className={`flex items-start gap-2 ${colorClass}`}>
                      <span className="text-[10px] text-zinc-400 select-none w-5 text-right font-mono">
                        {lineNum}
                      </span>
                      <span>{line}</span>
                    </div>

                    {/* Diagnostic Callout Line Overlay */}
                    {diag && (
                      <div
                        className={`ml-7 text-[11px] p-1.5 rounded border font-mono flex items-center gap-1.5 ${
                          diag.severity === "error"
                            ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                            : diag.severity === "warning"
                              ? "bg-amber-950/60 border-amber-500/40 text-amber-300"
                              : "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                        }`}
                      >
                        <IconAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          [{diag.severity.toUpperCase()} L{lineNum}]:{" "}
                          {diag.message}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Tactic Encyclopedia */}
      {activeTab === "encyclopedia" && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tactic Selector List */}
          <div className="space-y-1 md:col-span-1 max-h-64 overflow-y-auto pr-1">
            {Object.values(tacticDefs).map((tac) => (
              <button
                key={tac.id}
                type="button"
                onClick={() => setSelectedTactic(tac.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                  selectedTactic === tac.id
                    ? "bg-brand-cyan text-black"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <span>{tac.name}</span>
                <span className="text-[10px] opacity-75">
                  {tac.baseRamCost} GB
                </span>
              </button>
            ))}
          </div>

          {/* Tactic Details Pane */}
          <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2.5">
            {(() => {
              const tac =
                tacticDefs[selectedTactic as keyof typeof tacticDefs] ||
                tacticDefs.rfl;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-brand-cyan flex items-center gap-2">
                      <span>tactic</span>
                      <code className="bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded text-xs">
                        {tac.name}
                      </code>
                    </h4>
                    <span className="text-xs text-zinc-400">
                      RAM Cost:{" "}
                      <strong className="text-zinc-200">
                        {tac.baseRamCost} GB
                      </strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {tac.description}
                  </p>

                  <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                    <div>
                      <span className="text-zinc-400 font-bold">
                        Failure RAM Penalty:
                      </span>{" "}
                      {tac.failureCost} GB
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
