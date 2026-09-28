"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  THEOREMS,
  TheoremId,
  evaluateProofStatus,
  getDeductionLedger,
  getNextTacticHint,
  getFallacyDiagnosis,
  Edge,
  FallacyDiagnosis,
} from "@/lib/proof-utils";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import {
  IconBrain,
  IconCheck,
  IconAlertCircle,
  IconSparkles,
  IconRefresh,
} from "@tabler/icons-react";

export function MobileProofClient() {
  const { params, setParam } = useStudioHashParams();

  const [activeTheoremId, setActiveTheoremId] = useState<TheoremId>(() => {
    if (typeof window !== "undefined") {
      const rawTh = new URLSearchParams(window.location.hash.slice(1)).get(
        "theorem"
      ) as TheoremId;
      if (rawTh && THEOREMS[rawTh]) {
        return rawTh;
      }
    }
    return "modus-ponens";
  });

  const activeTheorem = THEOREMS[activeTheoremId];
  const [edges, setEdges] = useState<Edge[]>(activeTheorem.initialEdges);
  const [inspectedNodeId, setInspectedNodeId] = useState<string>(
    activeTheorem.targetNodeId || "E"
  );
  const [activeTab, setActiveTab] = useState<"ledger" | "systems" | "fallacy">(
    "ledger"
  );
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Sync with URL parameters
  useEffect(() => {
    const targetTh =
      (params.theorem as TheoremId | undefined) || "modus-ponens";
    if (THEOREMS[targetTh] && targetTh !== activeTheoremId) {
      const nextTh = THEOREMS[targetTh];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTheoremId(targetTh);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEdges(nextTh.initialEdges);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInspectedNodeId(nextTh.targetNodeId || "E");
    }

    const targetTab =
      (params.tab as "ledger" | "systems" | "fallacy" | undefined) || "ledger";
    if (["ledger", "systems", "fallacy"].includes(targetTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(targetTab);
    }
  }, [params, activeTheoremId]);

  const { isE_Proven } = useMemo(
    () => evaluateProofStatus(edges, activeTheoremId),
    [edges, activeTheoremId]
  );

  const activeTacticHint = useMemo(
    () => getNextTacticHint(edges, activeTheoremId),
    [edges, activeTheoremId]
  );

  const deductionLedger = useMemo(
    () => getDeductionLedger(edges, activeTheoremId),
    [edges, activeTheoremId]
  );

  const fallacyDiagnosis: FallacyDiagnosis | null = useMemo(
    () =>
      getFallacyDiagnosis(
        inspectedNodeId || "A",
        activeTheorem.targetNodeId || "C",
        edges,
        activeTheoremId
      ),
    [edges, activeTheoremId, inspectedNodeId, activeTheorem.targetNodeId]
  );

  const handleTheoremChange = (thId: TheoremId) => {
    if (!THEOREMS[thId]) return;
    setActiveTheoremId(thId);
    setEdges(THEOREMS[thId].initialEdges);
    setInspectedNodeId(THEOREMS[thId].targetNodeId || "E");
    setParam("theorem", thId === "modus-ponens" ? null : thId, {
      replace: true,
    });
    setFeedbackToast(`Switched to ${THEOREMS[thId].title}`);
    setTimeout(() => setFeedbackToast(null), 2500);
  };

  const handleReset = () => {
    setEdges(activeTheorem.initialEdges);
    setInspectedNodeId(activeTheorem.targetNodeId);
    setFeedbackToast("Proof reset to initial premises");
    setTimeout(() => setFeedbackToast(null), 2500);
  };

  const handleSelectTab = (tab: "ledger" | "systems" | "fallacy") => {
    setActiveTab(tab);
    setParam("tab", tab === "ledger" ? null : tab, { replace: true });
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white pb-12 flex flex-col gap-4">
      {/* Top Header Bar */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 sticky top-16 z-20 backdrop-blur-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconBrain className="w-5 h-5 text-brand-cyan" />
            <span className="font-mono text-sm font-bold tracking-wider text-neutral-100">
              PROOF STUDIO (MOBILE)
            </span>
          </div>
          {isE_Proven ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <IconCheck className="w-3.5 h-3.5" /> GOAL PROVEN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              IN PROGRESS
            </span>
          )}
        </div>

        {/* Theorem Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(Object.keys(THEOREMS) as TheoremId[]).map((thId) => {
            const th = THEOREMS[thId];
            const isActive = thId === activeTheoremId;
            return (
              <button
                key={thId}
                type="button"
                onClick={() => handleTheoremChange(thId)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                }`}
              >
                {th.title}
              </button>
            );
          })}
        </div>
      </div>

      {feedbackToast && (
        <div className="mx-4 p-3 rounded-xl bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-mono text-center">
          {feedbackToast}
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-4 flex flex-col gap-4">
        {/* Goal & Tactic Card */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>TARGET GOAL</span>
            <button
              type="button"
              onClick={handleReset}
              className="min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono"
            >
              <IconRefresh className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          <p className="text-sm font-sans text-neutral-200">
            {activeTheorem.goalDescription}
          </p>

          {activeTacticHint && (
            <div className="mt-2 p-3 rounded-xl bg-brand-purple/10 border border-brand-purple/30 flex items-start gap-2 text-xs font-mono text-brand-purple">
              <IconSparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {activeTacticHint.title || "Tactic Hint:"}
                </span>
                <span className="text-zinc-300 font-sans">
                  {activeTacticHint.hint}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => handleSelectTab("ledger")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "ledger"
                ? "border-brand-cyan text-brand-cyan"
                : "border-transparent text-zinc-400"
            }`}
          >
            Deduction Steps ({deductionLedger.length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab("fallacy")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "fallacy"
                ? "border-brand-cyan text-brand-cyan"
                : "border-transparent text-zinc-400"
            }`}
          >
            Diagnostics
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "ledger" && (
          <div className="flex flex-col gap-2.5">
            {deductionLedger.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 font-mono text-xs">
                No deduction steps recorded yet.
              </div>
            ) : (
              deductionLedger.map((step) => (
                <div
                  key={step.stepNumber}
                  onClick={() => setInspectedNodeId(step.nodeId || "A")}
                  className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all ${
                    inspectedNodeId === step.nodeId
                      ? "bg-zinc-900 border-brand-cyan/50 shadow-md"
                      : "bg-zinc-900/40 border-zinc-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-brand-cyan">
                      Step {step.stepNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                      {step.rule}
                    </span>
                  </div>
                  <div className="font-mono text-sm font-bold text-white bg-zinc-950 p-2 rounded-lg border border-zinc-800/60">
                    {step.formula}
                  </div>
                  <div className="text-xs font-sans text-zinc-400 flex items-center gap-1">
                    <span>Premises:</span>
                    <span className="font-mono text-zinc-300">
                      {step.premises || "Axiomatic"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "fallacy" && (
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-mono font-bold text-amber-400">
              <IconAlertCircle className="w-4 h-4" />
              <span>Fallacy &amp; Verification Diagnostic</span>
            </div>
            {fallacyDiagnosis ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-sans text-amber-200">
                <span className="font-mono font-bold block mb-1">
                  {fallacyDiagnosis.fallacyName}
                </span>
                <p>{fallacyDiagnosis.plainEnglish}</p>
              </div>
            ) : (
              <p className="text-xs font-sans text-zinc-400">
                No formal logical fallacies detected in current deduction tree.
                Proof AST structure is sound.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="px-4 mt-6">
        <NextPrevNav
          prev={{
            title: "CRF Studio & EDC",
            href: "/m/crf",
            label: "Clinical Trial Forms",
            tag: "Mobile eCRF",
          }}
          next={{
            title: "NeuroRecon Studio",
            href: "/m/neuro",
            label: "Neuroimaging CAD",
            tag: "Mobile Structural Metrics",
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
