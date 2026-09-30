"use client";

import React, { useState } from "react";
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
} from "@tabler/icons-react";

interface LeanIdeInspectorProps {
  level: PuzzlerLevelDef;
  steps: LeanProofStep[];
  isComplete: boolean;
}

export const LeanIdeInspector: React.FC<LeanIdeInspectorProps> = ({
  level,
  steps,
  isComplete,
}) => {
  const [activeTab, setActiveTab] = useState<"code" | "encyclopedia">("code");
  const [selectedTactic, setSelectedTactic] = useState<string>("rfl");

  const leanCode = generateLeanProofScript(level, steps, isComplete);
  const hasAdmittedStep = steps.some((step) => step.tacticId === "sorry");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono shadow-lg">
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
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
            <span>Generated Lean 4 Text · Uncompiled</span>
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
          <CopyButton
            text={leanCode}
            label="Copy Generated Lean Text"
            copiedLabel="Copied to Clipboard!"
            icon={<IconCopy className="w-3.5 h-3.5" />}
            copiedIcon={<IconCheck className="w-3.5 h-3.5 text-emerald-400" />}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
            aria-label="Copy Generated Lean Text"
            successMessage="Generated Lean text copied to clipboard"
          />
        )}
      </div>

      {/* Tab 1: Live Lean 4 Script & Educational Concept */}
      {activeTab === "code" && (
        <div className="mt-3 space-y-3">
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

          {/* Syntax Highlighted Lean 4 Script */}
          <div
            role="region"
            aria-label="Generated Lean source"
            tabIndex={0}
            className="relative rounded-xl border border-zinc-800 bg-zinc-900/90 p-3.5 overflow-x-auto"
          >
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-2 border-b border-zinc-800/80 pb-1.5">
              <span>Main.lean · Local Text Generator</span>
              <span>
                {hasAdmittedStep
                  ? "Status: Goal admitted with sorry"
                  : isComplete
                    ? "Status: Simulated goal closed ✔"
                    : "Status: Simulating..."}
              </span>
            </div>
            <pre className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre">
              {leanCode.split("\n").map((line, idx) => {
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
                  <div key={idx} className={colorClass}>
                    {line}
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
                    {tac.id === "symm" && (
                      <div>
                        <span className="text-emerald-400 font-bold">
                          Logic Rule:
                        </span>{" "}
                        Symmetry of Equality (`Eq.symm : a = b ⟹ b = a`)
                      </div>
                    )}
                    {tac.id === "split" && (
                      <div>
                        <span className="text-brand-cyan font-bold">
                          Logic Rule:
                        </span>{" "}
                        Conjunction Introduction (`And.intro : P → Q → P ∧ Q`)
                      </div>
                    )}
                    {tac.id === "left" && (
                      <div>
                        <span className="text-brand-cyan font-bold">
                          Logic Rule:
                        </span>{" "}
                        Disjunction Left Injection (`Or.inl : P → P ∨ Q`)
                      </div>
                    )}
                    {tac.id === "right" && (
                      <div>
                        <span className="text-brand-cyan font-bold">
                          Logic Rule:
                        </span>{" "}
                        Disjunction Right Injection (`Or.inr : Q → P ∨ Q`)
                      </div>
                    )}
                    {tac.id === "intro" && (
                      <div>
                        <span className="text-purple-400 font-bold">
                          Logic Rule:
                        </span>{" "}
                        Implication Introduction (P → Q ⟹ Γ, h:P ⊢ Q)
                      </div>
                    )}
                    {tac.id === "apply" && (
                      <div>
                        <span className="text-purple-400 font-bold">
                          Logic Rule:
                        </span>{" "}
                        Modus Ponens / Backward Chaining (Q via h:P → Q)
                      </div>
                    )}
                    {tac.id === "cases" && (
                      <div>
                        <span className="text-purple-400 font-bold">
                          Logic Rule:
                        </span>{" "}
                        Disjunction Elimination / Pattern Matching (P ∨ Q)
                      </div>
                    )}
                    {tac.id === "ring" && (
                      <div>
                        <span className="text-purple-400 font-bold">
                          Logic Rule:
                        </span>{" "}
                        Commutative Ring Normalization (Buchberger’s Gröbner
                        Bases)
                      </div>
                    )}
                    {tac.id === "omega" && (
                      <div>
                        <span className="text-purple-400 font-bold">
                          Logic Rule:
                        </span>{" "}
                        Presburger Linear Integer Arithmetic
                      </div>
                    )}
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
