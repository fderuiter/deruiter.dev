"use client";

import React, { useState, useMemo } from "react";
import { StudyProtocol } from "@/lib/crf/types";
import { useCrfService } from "@/hooks/useCrfService";
import {
  IconSparkles,
  IconArrowRight,
  IconCircleCheck,
  IconAlertTriangle,
  IconHierarchy,
} from "@tabler/icons-react";
import { AstStepDebugger } from "@/components/crf/Debugger/AstStepDebugger";

interface RuleGraphStudioProps {
  study: StudyProtocol;
}

export const RuleGraphStudio: React.FC<RuleGraphStudioProps> = ({ study }) => {
  const { evaluateFormula } = useCrfService();
  // Extract all rules and fields across forms
  const allForms = study.forms;
  const allRulesWithForm = useMemo(
    () =>
      allForms.flatMap((form) => form.rules.map((rule) => ({ rule, form }))),
    [allForms]
  );
  const allFields = useMemo(
    () => allForms.flatMap((f) => f.sections.flatMap((s) => s.fields)),
    [allForms]
  );

  // Selected Rule for graph highlighting
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(
    allRulesWithForm[0]?.rule.id || null
  );

  // AST Formula Sandbox State
  const [testFormula, setTestFormula] = useState(
    "round(weight / ((height / 100) * (height / 100)), 1)"
  );
  const [sampleVars, setSampleVars] = useState<Record<string, number>>({
    height: 178,
    weight: 74.5,
    age: 55,
    serum_cr: 1.1,
    egqt: 440,
    egrr: 0.85,
    trl1: 25.0,
    trl2: 18.2,
    trsldbase: 40.0,
    qseval1: 2,
    qseval2: 3,
    qseval3: 1,
    qseval4: 2,
  });

  const evalRes = evaluateFormula({
    formula: testFormula,
    fieldValues: sampleVars,
    fieldsList: allFields,
  });
  const calculatedResult = evalRes.success ? evalRes.data.value : null;

  // Cycle Detection Algorithm for the rule DAG
  const cycleDetection = useMemo(() => {
    const adj = new Map<string, string[]>();
    allRulesWithForm.forEach(({ rule }) => {
      rule.triggerFieldIds.forEach((trig) => {
        const existing = adj.get(trig) || [];
        existing.push(rule.targetFieldId);
        adj.set(trig, existing);
      });
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    function findCycle(node: string, path: string[]): string[] | null {
      visited.add(node);
      recStack.add(node);
      const currentPath = [...path, node];

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const res = findCycle(neighbor, currentPath);
          if (res) return res;
        } else if (recStack.has(neighbor)) {
          return [...currentPath, neighbor];
        }
      }

      recStack.delete(node);
      return null;
    }

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        const cycle = findCycle(node, []);
        if (cycle) {
          return { hasCycle: true, cycleFields: cycle };
        }
      }
    }

    return { hasCycle: false, cycleFields: [] };
  }, [allRulesWithForm]);

  // Handle Token Insertion into Formula input
  const handleInsertToken = (token: string) => {
    setTestFormula((prev) => `${prev} ${token}`.trim());
  };

  return (
    <div className="flex-1 flex flex-col h-full studio-surface-subtle p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b studio-border-default">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg studio-accent-cyan border">
              <IconHierarchy className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold studio-fg-primary font-mono">
              Logic Dependency DAG &amp; AST Rule Studio
            </h2>
          </div>
          <p className="text-xs studio-fg-muted font-sans mt-1">
            Visual directed acyclic graph for cross-field edit checks, execution
            flows, and mathematical derivation sandboxing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {cycleDetection.hasCycle ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-accent-red border font-mono text-xs">
              <IconAlertTriangle className="w-4 h-4" />
              <span>
                Circular Dependency Detected (
                {cycleDetection.cycleFields.join(" → ")})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-accent-emerald border font-mono text-xs">
              <IconCircleCheck className="w-4 h-4" />
              <span>Acyclic Logic Verified (Safe DAG)</span>
            </div>
          )}

          <span className="text-xs font-mono px-3 py-1.5 rounded-xl studio-surface-card border studio-border-default studio-fg-cyan">
            {allRulesWithForm.length} Active Rules
          </span>
        </div>
      </div>

      {/* SECTION 1: INTERACTIVE VISUAL DAG FLOWCHART */}
      <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconHierarchy className="w-4 h-4 studio-fg-cyan" />
            <h2 className="text-sm font-bold studio-fg-primary font-mono">
              Visual Execution Flow &amp; Trigger Dependencies (DAG)
            </h2>
          </div>
          <span className="text-[10px] font-mono studio-fg-muted">
            Triggers → Condition Rules → Action Targets
          </span>
        </div>

        {allRulesWithForm.length === 0 ? (
          <div className="p-8 text-center studio-fg-muted font-mono text-xs border border-dashed studio-border-default rounded-xl">
            No active edit check rules configured in this study.
          </div>
        ) : (
          <div className="space-y-4">
            {allRulesWithForm.map(({ rule, form }) => {
              const isSelected = selectedRuleId === rule.id;
              const targetField = allFields.find(
                (f) => f.id === rule.targetFieldId
              );

              return (
                <div
                  key={rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "studio-surface-card studio-border-cyan ring-1 studio-ring-cyan shadow-lg"
                      : "studio-surface-subtle studio-border-default studio-hover-border-strong"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold studio-accent-cyan-strong font-mono border">
                        {form.domain}
                      </span>
                      <span className="text-xs font-bold studio-fg-primary font-mono">
                        {rule.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded studio-surface-card studio-fg-secondary border studio-border-default">
                      Action: {rule.actionType}
                    </span>
                  </div>

                  {/* Flow Diagram Row: Triggers -> Operator Node -> Target */}
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                    {/* Trigger Field Nodes */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rule.triggerFieldIds.map((tfId) => {
                        const tf = allFields.find((f) => f.id === tfId);
                        return (
                          <span
                            key={tfId}
                            className="px-2.5 py-1 rounded-lg studio-surface-card border studio-border-default studio-fg-cyan font-bold"
                          >
                            {tf?.variableName || tfId}
                          </span>
                        );
                      })}
                    </div>

                    <IconArrowRight className="w-4 h-4 studio-fg-muted shrink-0" />

                    {/* Condition Box */}
                    <div className="p-2 rounded-lg studio-surface-card border studio-border-default text-[11px] studio-fg-secondary flex items-center gap-2">
                      <span className="studio-fg-amber font-bold">
                        {rule.logicalOperator}
                      </span>
                      <span>(</span>
                      {rule.conditions.map((c, i) => (
                        <span key={i} className="studio-fg-secondary">
                          {c.operator} &quot;{String(c.value)}&quot;
                          {i < rule.conditions.length - 1 ? ", " : ""}
                        </span>
                      ))}
                      <span>)</span>
                    </div>

                    <IconArrowRight className="w-4 h-4 studio-fg-muted shrink-0" />

                    {/* Target Node */}
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg studio-accent-purple border font-bold">
                        {targetField?.variableName || rule.targetFieldId}
                      </span>

                      {rule.querySeverity && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            rule.querySeverity === "error"
                              ? "studio-accent-red-strong border"
                              : "studio-accent-amber-strong border"
                          }`}
                        >
                          {rule.querySeverity}
                        </span>
                      )}
                    </div>
                  </div>

                  {rule.queryMessage && (
                    <p className="text-[11px] studio-fg-muted font-sans mt-2.5 pt-2 border-t studio-border-default">
                      Query Message: &quot;{rule.queryMessage}&quot;
                    </p>
                  )}

                  {isSelected && (
                    <div
                      className="mt-4 pt-4 border-t studio-border-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AstStepDebugger rule={rule} fields={allFields} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: INTERACTIVE AST FORMULA STUDIO */}
      <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSparkles className="w-4 h-4 studio-fg-cyan" />
            <h2 className="text-sm font-bold studio-fg-primary font-mono">
              AST Formula Evaluator &amp; Clinical Calculation Studio
            </h2>
          </div>
          <span className="text-[10px] font-mono studio-accent-emerald px-2 py-0.5 rounded border">
            Zero-Eval AST Engine
          </span>
        </div>

        {/* Clinical Formula Presets */}
        <div className="space-y-2">
          <label className="block text-[11px] font-mono studio-fg-muted">
            Standard Clinical Calculation Presets:
          </label>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button
              onClick={() =>
                setTestFormula(
                  "round(weight / ((height / 100) * (height / 100)), 1)"
                )
              }
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              BMI (kg/m²)
            </button>
            <button
              onClick={() =>
                setTestFormula("round(sqrt((height * weight) / 3600), 2)")
              }
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              Mosteller BSA (m²)
            </button>
            <button
              onClick={() =>
                setTestFormula(
                  "round(0.007184 * (height ^ 0.725) * (weight ^ 0.425), 2)"
                )
              }
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              DuBois BSA (m²)
            </button>
            <button
              onClick={() =>
                setTestFormula(
                  "round(((140 - age) * weight) / (72 * serum_cr), 1)"
                )
              }
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              Cockcroft-Gault CrCl
            </button>
            <button
              onClick={() => setTestFormula("round(egqt / sqrt(egrr), 0)")}
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              Bazett QTc (ms)
            </button>
            <button
              onClick={() =>
                setTestFormula(
                  "round(((trl1 + trl2 - trsldbase) / trsldbase) * 100, 1)"
                )
              }
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              RECIST 1.1 SLD % Change
            </button>
            <button
              onClick={() =>
                setTestFormula("qseval1 + qseval2 + qseval3 + qseval4")
              }
              className="px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-primary text-xs border studio-border-strong"
            >
              PHQ-9 Depression Score
            </button>
          </div>
        </div>

        {/* Formula Input & Result Display */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono studio-fg-muted mb-1">
              Arithmetic / Function Expression
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testFormula}
                onChange={(e) => setTestFormula(e.target.value)}
                className="flex-1 px-3 py-2 studio-surface-subtle border studio-border-cyan rounded-xl studio-fg-cyan font-mono text-xs studio-focus-input focus:outline-none"
                placeholder="e.g. round(weight / ((height/100) * (height/100)), 1)"
              />
              <div className="px-4 py-2 studio-bg-cyan-strong border studio-border-cyan rounded-xl font-mono text-sm font-bold studio-fg-primary flex items-center gap-2 shrink-0">
                <span className="studio-fg-muted text-xs">=</span>
                <span className="studio-fg-cyan">
                  {calculatedResult !== null ? calculatedResult : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Clickable Token Insertion Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-mono">
            <span className="text-[10px] studio-fg-muted mr-1">
              Insert Tokens:
            </span>
            {[
              "+",
              "-",
              "*",
              "/",
              "^",
              "(",
              ")",
              "round(",
              "sqrt(",
              "abs(",
              "max(",
              "min(",
            ].map((tok) => (
              <button
                key={tok}
                onClick={() => handleInsertToken(tok)}
                className="px-2 py-0.5 rounded studio-surface-muted studio-hover-active studio-fg-cyan font-mono text-[11px] border studio-border-strong"
              >
                {tok}
              </button>
            ))}
          </div>

          {/* Sample Variables Mock Grid */}
          <div className="p-3.5 rounded-xl studio-surface-subtle border studio-border-default space-y-2">
            <div className="text-[10px] font-mono studio-fg-muted font-semibold uppercase">
              Mock Variable Input Test Values:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(sampleVars).map(([key, val]) => (
                <div key={key}>
                  <label
                    htmlFor={`rule-mock-var-${key}`}
                    className="block text-[9px] font-mono studio-fg-muted truncate"
                  >
                    {key}
                  </label>
                  <input
                    id={`rule-mock-var-${key}`}
                    type="number"
                    value={val}
                    onChange={(e) =>
                      setSampleVars({
                        ...sampleVars,
                        [key]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2 py-1 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
