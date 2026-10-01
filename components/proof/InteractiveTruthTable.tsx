"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  IconFlame,
  IconCheck,
  IconAlertTriangle,
  IconTable,
  IconCpu,
  IconShieldCheck,
  IconRefresh,
} from "@tabler/icons-react";
import {
  FallacyDiagnosis,
  TruthTableRow,
  evaluateAstWithTrace,
  AstTraceNode,
} from "@/lib/proof-utils";

interface InteractiveTruthTableProps {
  diagnosis: FallacyDiagnosis;
  onClear?: () => void;
  onRollback?: () => void;
}

/**
 * Renders a single AST node trace with its recursive sub-expressions and evaluated truth values.
 */
function AstTraceView({
  trace,
  isRoot = false,
}: {
  trace: AstTraceNode;
  isRoot?: boolean;
}) {
  const isLeaf = !trace.children || trace.children.length === 0;

  return (
    <div
      className={`flex flex-col gap-1 rounded p-1.5 transition-colors ${
        isRoot
          ? "bg-slate-900/90 border border-slate-800"
          : "bg-slate-950/60 border border-slate-800/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="font-semibold text-slate-200">{trace.label}</span>
          {trace.operator && (
            <span className="text-slate-400 text-[10px] bg-slate-800/80 px-1 rounded">
              op: {trace.operator}
            </span>
          )}
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide ${
            trace.value
              ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
              : "bg-rose-950 text-rose-300 border border-rose-800/60"
          }`}
        >
          {trace.value ? "TRUE" : "FALSE"}
        </span>
      </div>

      {!isLeaf && (
        <div className="pl-2 border-l border-slate-800 flex flex-col gap-1 mt-1">
          {trace.children?.map((child, idx) => (
            <AstTraceView
              key={`${child.label}-${idx}`}
              trace={child}
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Truth Table and AST Sub-Expression Truth Propagation Visualizer for Formal Fallacy Diagnostics.
 */
export function InteractiveTruthTable({
  diagnosis,
  onRollback,
}: InteractiveTruthTableProps) {
  // Extract all distinct variables involved in the fallacy (defaulting to P and Q)
  const variables = useMemo(() => {
    if (diagnosis.variables && diagnosis.variables.length > 0) {
      return diagnosis.variables;
    }
    return ["P", "Q"];
  }, [diagnosis]);

  // Initial variable valuation defaults to the primary counterexample valuation or all-true
  const initialValuation = useMemo(() => {
    const valuation: Record<string, boolean> = {};
    variables.forEach((v) => {
      if (
        diagnosis.counterexampleValuation &&
        v in diagnosis.counterexampleValuation
      ) {
        valuation[v] = diagnosis.counterexampleValuation[v];
      } else {
        valuation[v] = false;
      }
    });
    return valuation;
  }, [variables, diagnosis]);

  const diagnosisKey = diagnosis.fallacyName + ":" + diagnosis.formalFormula;
  const [customValuations, setCustomValuations] = useState<{
    key: string;
    vals: Record<string, boolean>;
  } | null>(null);

  // Active valuation derived without useEffect setState
  const valuations = useMemo(() => {
    if (customValuations && customValuations.key === diagnosisKey) {
      return customValuations.vals;
    }
    return initialValuation;
  }, [customValuations, diagnosisKey, initialValuation]);

  const updateValuations = useCallback(
    (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      setCustomValuations((prev) => {
        const current =
          prev && prev.key === diagnosisKey ? prev.vals : initialValuation;
        return {
          key: diagnosisKey,
          vals: updater(current),
        };
      });
    },
    [diagnosisKey, initialValuation]
  );

  const toggleVariable = useCallback(
    (varName: string) => {
      updateValuations((prev) => ({
        ...prev,
        [varName]: !prev[varName],
      }));
    },
    [updateValuations]
  );

  const setAllVariables = useCallback(
    (value: boolean) => {
      updateValuations(() => {
        const next: Record<string, boolean> = {};
        variables.forEach((v) => {
          next[v] = value;
        });
        return next;
      });
    },
    [updateValuations, variables]
  );

  const jumpToCounterexample = useCallback(() => {
    if (diagnosis.counterexampleValuation) {
      setCustomValuations({
        key: diagnosisKey,
        vals: { ...diagnosis.counterexampleValuation },
      });
    } else {
      const ceRow = diagnosis.truthTable.find((r) => r.isCounterexample);
      if (ceRow) {
        if (ceRow.valuations) {
          setCustomValuations({
            key: diagnosisKey,
            vals: { ...ceRow.valuations },
          });
        } else {
          setCustomValuations({
            key: diagnosisKey,
            vals: {
              P: ceRow.p,
              Q: ceRow.q,
              ...(ceRow.r !== undefined ? { R: ceRow.r } : {}),
              ...(ceRow.s !== undefined ? { S: ceRow.s } : {}),
            },
          });
        }
      }
    }
  }, [diagnosis, diagnosisKey]);

  // Evaluate premise AST traces
  const premisesWithTrace = useMemo(() => {
    if (!diagnosis.premises || diagnosis.premises.length === 0) {
      return [];
    }
    return diagnosis.premises.map((premise) => ({
      ...premise,
      trace: evaluateAstWithTrace(premise.ast, valuations),
    }));
  }, [diagnosis.premises, valuations]);

  // Evaluate conclusion AST trace
  const conclusionWithTrace = useMemo(() => {
    if (!diagnosis.conclusion) return null;
    return {
      ...diagnosis.conclusion,
      trace: evaluateAstWithTrace(diagnosis.conclusion.ast, valuations),
    };
  }, [diagnosis.conclusion, valuations]);

  // Determine if active valuation constitutes a formal counterexample
  const allPremisesTrue = useMemo(() => {
    if (premisesWithTrace.length === 0) return true;
    return premisesWithTrace.every((p) => p.trace.value === true);
  }, [premisesWithTrace]);

  const conclusionIsFalse = useMemo(() => {
    if (!conclusionWithTrace) return false;
    return conclusionWithTrace.trace.value === false;
  }, [conclusionWithTrace]);

  const isCounterexampleActive = allPremisesTrue && conclusionIsFalse;

  // Check if a truth table row matches current valuation
  const isRowActive = useCallback(
    (row: TruthTableRow) => {
      if (row.valuations) {
        return variables.every((v) => row.valuations?.[v] === valuations[v]);
      }
      return (
        row.p === (valuations["P"] ?? false) &&
        row.q === (valuations["Q"] ?? false)
      );
    },
    [valuations, variables]
  );

  const applyRowValuation = useCallback(
    (row: TruthTableRow) => {
      if (row.valuations) {
        setCustomValuations({
          key: diagnosisKey,
          vals: { ...row.valuations },
        });
      } else {
        setCustomValuations({
          key: diagnosisKey,
          vals: {
            ...valuations,
            P: row.p,
            Q: row.q,
            ...(row.r !== undefined ? { R: row.r } : {}),
            ...(row.s !== undefined ? { S: row.s } : {}),
          },
        });
      }
    },
    [diagnosisKey, valuations]
  );

  return (
    <div className="space-y-3.5 text-xs">
      {/* Header Diagnostic Card */}
      <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold block text-sm">
            {diagnosis.fallacyName}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-900/80 text-red-200 border border-red-700/80 shrink-0">
            DEDUCTIVE ERROR
          </span>
        </div>
        <div className="font-mono text-[11px] text-red-400 bg-red-950/80 px-2 py-1 rounded border border-red-900/60 inline-block">
          {diagnosis.formalFormula}
        </div>
        {onRollback && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onRollback}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Rollback Step: Remove invalid edge and reset fallacy"
            >
              <IconRefresh className="w-4 h-4" />
              <span>Rollback Step</span>
            </button>
          </div>
        )}
      </div>

      {/* Narrative Explanation */}
      <p className="text-slate-300 leading-relaxed text-xs">
        {diagnosis.plainEnglish}
      </p>

      {/* Software Bug Analogy */}
      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
        <span className="font-mono text-amber-400 font-semibold block text-[11px]">
          Software Bug Analogy
        </span>
        <p className="text-slate-400 leading-relaxed text-[11px]">
          {diagnosis.softwareAnalogy}
        </p>
      </div>

      {/* Live Variable Boolean Toggles */}
      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300 font-semibold">
            <IconCpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive Variable Valuations</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={jumpToCounterexample}
              className="px-2 py-1 rounded text-[10px] font-mono font-semibold bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 transition-colors flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-red-400"
              title="Jump to the counterexample valuation that exposes the fallacy"
            >
              <IconFlame className="w-3 h-3 text-red-400" />
              Counterexample
            </button>
            <button
              type="button"
              onClick={() => setAllVariables(true)}
              className="px-1.5 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
              title="Set all premise variables to True"
            >
              All T
            </button>
            <button
              type="button"
              onClick={() => setAllVariables(false)}
              className="px-1.5 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
              title="Set all premise variables to False"
            >
              All F
            </button>
          </div>
        </div>

        {/* Switches */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {variables.map((varName) => {
            const isTrue = valuations[varName] ?? false;
            return (
              <button
                key={varName}
                type="button"
                role="switch"
                aria-checked={isTrue}
                aria-label={`Toggle variable ${varName}`}
                onClick={() => toggleVariable(varName)}
                className={`p-2 rounded-lg border flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  isTrue
                    ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-950/60"
                    : "bg-rose-950/30 border-rose-900/60 text-rose-300 hover:bg-rose-950/50"
                }`}
              >
                <span className="font-mono font-bold text-xs">
                  Var {varName}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                    isTrue
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "bg-rose-600 text-white shadow-sm"
                  }`}
                >
                  {isTrue ? "TRUE (T)" : "FALSE (F)"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contradiction / Consistency Banner */}
      <div
        className={`p-2.5 rounded-lg border transition-all ${
          isCounterexampleActive
            ? "bg-red-950/60 border-red-700 text-red-200 shadow-md shadow-red-950/50"
            : allPremisesTrue
              ? "bg-emerald-950/50 border-emerald-700/70 text-emerald-200"
              : "bg-slate-950 border-slate-800 text-slate-400"
        }`}
      >
        <div className="flex items-center gap-2">
          {isCounterexampleActive ? (
            <IconAlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          ) : allPremisesTrue ? (
            <IconShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <IconRefresh className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="font-semibold text-xs">
            {isCounterexampleActive
              ? "💥 Formal Contradiction: Premises Hold (True) but Conclusion Fails (False)!"
              : allPremisesTrue
                ? "✓ Consistent State: Premises & Conclusion are simultaneously satisfied."
                : "ℹ Non-Violating State: Premise preconditions are not fully satisfied."}
          </span>
        </div>
        <p className="text-[11px] mt-1 opacity-90 pl-6">
          {isCounterexampleActive
            ? "Because all premises evaluate to True while the target conclusion evaluates to False, this rule step is mathematically invalid and unsound."
            : allPremisesTrue
              ? "Under this specific variable assignment, the formula holds true; however, a deductive inference rule must hold across ALL possible truth assignments."
              : "When premise conditions are False, the deduction cannot fire, avoiding a false conclusion."}
        </p>
      </div>

      {/* AST Sub-Expression Truth Propagation Breakdown */}
      {premisesWithTrace.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-slate-400 font-semibold text-[11px]">
            <span>AST Sub-Expression Truth Propagation</span>
            <span className="text-[10px] text-slate-500 font-normal">
              Live Boolean Evaluation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {premisesWithTrace.map((p, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-cyan-300 text-[11px]">
                    {p.label}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      p.trace.value
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                        : "bg-rose-950 text-rose-300 border border-rose-800/60"
                    }`}
                  >
                    {p.trace.value ? "TRUE" : "FALSE"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {p.description}
                </p>
                <AstTraceView trace={p.trace} isRoot={true} />
              </div>
            ))}

            {conclusionWithTrace && (
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-amber-300 text-[11px]">
                    {conclusionWithTrace.label}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      conclusionWithTrace.trace.value
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                        : "bg-rose-950 text-rose-300 border border-rose-800/60"
                    }`}
                  >
                    {conclusionWithTrace.trace.value ? "TRUE" : "FALSE"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {conclusionWithTrace.description}
                </p>
                <AstTraceView trace={conclusionWithTrace.trace} isRoot={true} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Truth Table Grid */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-slate-400 block font-semibold text-[11px] flex items-center gap-1.5">
            <IconTable className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Exhaustive Truth Table ({diagnosis.truthTable.length} Valuations)
            </span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Click row to test valuation
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
          <table
            className="w-full text-left font-mono text-[10px]"
            aria-label="Truth Table with Live Valuation Highlight"
          >
            <caption className="sr-only">
              Truth Table with Live Valuation Highlight
            </caption>
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
              <tr>
                {variables.map((v) => (
                  <th key={v} scope="col" className="p-1.5 text-center">
                    {v}
                  </th>
                ))}
                <th scope="col" className="p-1.5 text-center">
                  Premise 1
                </th>
                <th scope="col" className="p-1.5 text-center">
                  Premise 2
                </th>
                <th scope="col" className="p-1.5 text-center">
                  Conclusion
                </th>
                <th scope="col" className="p-1.5 text-center">
                  Diagnostic Status
                </th>
              </tr>
            </thead>
            <tbody>
              {diagnosis.truthTable.map((row, idx) => {
                const isActive = isRowActive(row);
                return (
                  <tr
                    key={idx}
                    tabIndex={0}
                    role="button"
                    aria-label={`Row ${idx + 1}: ${variables.map((v) => `${v}=${row.valuations?.[v] ? "T" : "F"}`).join(", ")}`}
                    onClick={() => applyRowValuation(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        applyRowValuation(row);
                      }
                    }}
                    className={`border-t border-slate-800/60 cursor-pointer transition-all ${
                      isActive
                        ? "bg-cyan-950/60 text-cyan-200 font-bold ring-1 ring-inset ring-cyan-500/80"
                        : row.isCounterexample
                          ? "bg-red-950/20 text-red-300 hover:bg-red-950/40"
                          : "text-slate-400 hover:bg-slate-900/50"
                    }`}
                  >
                    {variables.map((v) => {
                      const val =
                        row.valuations && v in row.valuations
                          ? row.valuations[v]
                          : v === "P"
                            ? row.p
                            : v === "Q"
                              ? row.q
                              : false;
                      return (
                        <td key={v} className="p-1.5 text-center">
                          <span
                            className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                              val ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {val ? "T" : "F"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-1.5 text-center">
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                          row.premise1 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {row.premise1 ? "T" : "F"}
                      </span>
                    </td>
                    <td className="p-1.5 text-center">
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                          row.premise2 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {row.premise2 ? "T" : "F"}
                      </span>
                    </td>
                    <td className="p-1.5 text-center">
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                          row.conclusion ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {row.conclusion ? "T" : "F"}
                      </span>
                    </td>
                    <td className="p-1.5 text-center">
                      {row.isCounterexample ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/80 font-bold text-[9px]">
                          <IconFlame className="w-2.5 h-2.5 text-red-400" />
                          INVALID ❌
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[9px]">
                          <IconCheck className="w-2.5 h-2.5 text-emerald-400" />
                          VALID ✔
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
