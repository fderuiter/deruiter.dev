"use client";

import React from "react";
import {
  IconTable,
  IconBook,
  IconAlertTriangle,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { InteractiveTruthTable } from "@/components/proof/InteractiveTruthTable";
import {
  FallacyDiagnosis,
  TheoremDefinition,
  LedgerStep,
} from "@/lib/proof-utils";

interface ProofLedgerProps {
  activeTab: "ledger" | "systems" | "fallacy";
  setActiveTab: (tab: "ledger" | "systems" | "fallacy") => void;
  mobileActiveView: "canvas" | "ledger" | "systems" | "fallacy" | "terminal";
  setMobileActiveView: (
    view: "canvas" | "ledger" | "systems" | "fallacy" | "terminal"
  ) => void;
  deductionLedger: LedgerStep[];
  handleDeleteStep: (stepNumber: number) => void;
  activeTheorem: TheoremDefinition;
  currentFallacy: FallacyDiagnosis | null;
  setCurrentFallacy: (fallacy: FallacyDiagnosis | null) => void;
}

export const ProofLedger: React.FC<ProofLedgerProps> = ({
  activeTab,
  setActiveTab,
  mobileActiveView,
  setMobileActiveView,
  deductionLedger,
  handleDeleteStep,
  activeTheorem,
  currentFallacy,
  setCurrentFallacy,
}) => {
  return (
    <div
      className={`lg:col-span-4 flex flex-col gap-4 ${
        mobileActiveView === "ledger" ||
        mobileActiveView === "systems" ||
        mobileActiveView === "fallacy"
          ? "flex"
          : "hidden lg:flex"
      }`}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden flex flex-col shadow-xl">
        {/* Tab Selector */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/40 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab("ledger");
              setMobileActiveView("ledger");
            }}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer active:scale-[0.98] ${
              activeTab === "ledger"
                ? "border-brand-cyan text-brand-cyan bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <IconTable className="w-4 h-4" />
            Ledger
          </button>
          <button
            onClick={() => {
              setActiveTab("systems");
              setMobileActiveView("systems");
            }}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer active:scale-[0.98] ${
              activeTab === "systems"
                ? "border-brand-cyan text-brand-cyan bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <IconBook className="w-4 h-4" />
            Systems
          </button>
          <button
            onClick={() => {
              setActiveTab("fallacy");
              setMobileActiveView("fallacy");
            }}
            className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer active:scale-[0.98] ${
              activeTab === "fallacy"
                ? "border-brand-cyan text-brand-cyan bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <IconAlertTriangle className="w-4 h-4" />
            Fallacy
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex flex-col gap-4 min-h-[380px] max-h-[460px] overflow-y-auto">
          {activeTab === "ledger" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">
                  Formal Fitch Deduction Ledger
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Lines: {deductionLedger.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {deductionLedger.map((step) => (
                  <div
                    key={step.stepNumber}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 transition ${
                      step.isProven
                        ? "bg-slate-900 border-slate-800"
                        : "bg-slate-950/60 border-slate-900 text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">
                          Step {step.stepNumber}
                        </span>
                        {step.nodeId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 text-slate-400 bg-slate-800/60 rounded">
                            Node {step.nodeId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            step.isProven
                              ? "bg-emerald-950 text-emerald-400"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {step.isProven ? "✔ PROVEN" : "⏳ PENDING"}
                        </span>
                        {step.isDeletable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(step.stepNumber)}
                            aria-label={`Delete Step ${step.stepNumber} and prune downstream dependencies`}
                            title={`Delete Step ${step.stepNumber} (prune dependencies)`}
                            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/50 transition-colors focus:outline-none focus:ring-1 focus:ring-red-500/50 cursor-pointer"
                          >
                            <IconX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white text-sm">
                      {step.formula}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      <span className="text-brand-cyan font-mono">
                        {step.rule}
                      </span>{" "}
                      ({step.premises})
                    </div>
                    <div className="text-slate-400 text-[11px] leading-tight">
                      {step.plainEnglish}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "systems" && (
            <div className="flex flex-col gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white">
                  {activeTheorem.title}
                </span>
                <p className="text-slate-400 leading-relaxed">
                  {activeTheorem.scenario}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-mono text-brand-cyan font-semibold block">
                  Local Invariant Model
                </span>
                <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                  {activeTheorem.leanCode}
                </pre>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-mono text-slate-400 font-semibold block">
                  Distributed Systems Invariant
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {activeTheorem.goalDescription}
                </p>
              </div>
            </div>
          )}

          {activeTab === "fallacy" && (
            <div className="flex flex-col gap-3 text-xs">
              {currentFallacy ? (
                <InteractiveTruthTable
                  diagnosis={currentFallacy}
                  onClear={() => setCurrentFallacy(null)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-2">
                  <IconShieldCheck className="w-10 h-10 text-emerald-400/80" />
                  <span className="font-semibold text-slate-300">
                    Zero Active Fallacies
                  </span>
                  <p className="text-[11px] max-w-xs">
                    All current graph connections and premise selections follow
                    valid deductive inference rules.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
