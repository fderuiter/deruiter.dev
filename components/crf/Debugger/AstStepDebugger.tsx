"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
  IconAlertCircle,
  IconCheck,
  IconHelpCircle,
  IconSparkles,
  IconAdjustmentsHorizontal,
  IconBolt,
} from "@tabler/icons-react";
import { EditCheckRule, CRFField, ConditionResult } from "@/lib/crf/types";
import {
  generateRuleDebugTrace,
  SAMPLE_SUBJECT_PROFILES,
  SampleSubjectProfile,
  AstDebugStep,
} from "@/lib/crf/ast-debugger";

interface AstStepDebuggerProps {
  rule: EditCheckRule;
  fields: CRFField[];
  initialValues?: Record<string, string | number | boolean | null>;
  onValuesChange?: (
    values: Record<string, string | number | boolean | null>
  ) => void;
  className?: string;
  compact?: boolean;
}

const RESULT_BADGE_STYLE: Record<ConditionResult | "short_circuit", string> = {
  true: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  false: "bg-zinc-800 text-zinc-300 border-zinc-700",
  missing: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  incompatible: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  short_circuit: "bg-purple-500/15 text-purple-300 border-purple-500/40",
};

const RESULT_LABEL: Record<ConditionResult | "short_circuit", string> = {
  true: "TRUE",
  false: "FALSE",
  missing: "MISSING",
  incompatible: "INCOMPATIBLE",
  short_circuit: "SHORT-CIRCUITED",
};

export const AstStepDebugger: React.FC<AstStepDebuggerProps> = ({
  rule,
  fields,
  initialValues,
  onValuesChange,
  className = "",
  compact = false,
}) => {
  // Sync initialValues during render when prop changes
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  const [mockValues, setMockValues] = useState<
    Record<string, string | number | boolean | null>
  >(() => {
    return initialValues || SAMPLE_SUBJECT_PROFILES[0].values;
  });

  if (initialValues !== prevInitialValues) {
    setPrevInitialValues(initialValues);
    if (initialValues) {
      setMockValues(initialValues);
    }
  }

  const [rawStepIndex, setRawStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showOverrides, setShowOverrides] = useState<boolean>(!compact);

  // Compute AST execution trace instantaneously on input change
  const trace = useMemo(() => {
    return generateRuleDebugTrace(rule, mockValues, fields);
  }, [rule, mockValues, fields]);

  // Derive bounded active step index directly during render
  const maxStepIndex = trace.steps.length > 0 ? trace.steps.length - 1 : 0;
  const activeStepIndex =
    rawStepIndex > maxStepIndex
      ? maxStepIndex
      : rawStepIndex < 0
        ? 0
        : rawStepIndex;

  // Auto-stepping player interval
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setRawStepIndex((prev) => {
        if (prev >= trace.steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1400);

    return () => clearInterval(timer);
  }, [isPlaying, trace.steps.length]);

  const activeStep: AstDebugStep | undefined = trace.steps[activeStepIndex];

  // Input change handler
  const handleFieldValueChange = useCallback(
    (fieldKey: string, rawVal: string) => {
      const fieldDef = fields.find(
        (f) =>
          f.id === fieldKey ||
          f.variableName.toLowerCase() === fieldKey.toLowerCase()
      );
      const isNumeric =
        fieldDef?.dataType === "number" ||
        fieldDef?.dataType === "integer" ||
        fieldDef?.dataType === "vas_scale" ||
        fieldDef?.dataType === "nrs_scale";

      const parsed = isNumeric
        ? rawVal === ""
          ? null
          : Number(rawVal)
        : rawVal;

      const updated = {
        ...mockValues,
        [fieldKey]: parsed,
      };
      if (fieldDef) {
        updated[fieldDef.id] = parsed;
        updated[fieldDef.variableName] = parsed;
        updated[fieldDef.variableName.toLowerCase()] = parsed;
      }

      setMockValues(updated);
      onValuesChange?.(updated);
    },
    [fields, mockValues, onValuesChange]
  );

  // Apply Sample Subject Profile
  const handleSelectProfile = (profile: SampleSubjectProfile) => {
    const updated = { ...profile.values };
    setMockValues(updated);
    onValuesChange?.(updated);
    setRawStepIndex(0);
  };

  // Extract all referenced fields for the mock value override controls
  const referencedFields = useMemo(() => {
    const fieldIds = new Set<string>();
    rule.triggerFieldIds.forEach((id) => fieldIds.add(id));
    rule.conditions.forEach((c) => {
      fieldIds.add(c.fieldId);
      if (c.compareFieldId) fieldIds.add(c.compareFieldId);
    });

    return Array.from(fieldIds).map((id) => {
      const found = fields.find(
        (f) => f.id === id || f.variableName.toLowerCase() === id.toLowerCase()
      );
      return {
        id,
        variableName: found ? found.variableName : id,
        label: found ? found.label : id,
        dataType: found ? found.dataType : "text",
        unit: found?.unit,
      };
    });
  }, [rule, fields]);

  return (
    <div
      className={`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-xl ${className}`}
    >
      {/* Top Header & Rule Evaluation Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-850">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1.5 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan shrink-0">
            <IconSparkles className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-mono font-bold text-white truncate flex items-center gap-2">
              <span>AST Step Debugger: {rule.name}</span>
            </h3>
            <p className="text-[10px] text-zinc-400 font-sans truncate mt-0.5">
              Action:{" "}
              <span className="font-mono text-zinc-300">{rule.actionType}</span>{" "}
              · Target:{" "}
              <span className="font-mono text-brand-cyan">
                {rule.targetFieldId}
              </span>
            </p>
          </div>
        </div>

        {/* Overall Trace Result Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 ${
              RESULT_BADGE_STYLE[trace.finalResult]
            }`}
          >
            {trace.finalResult === "true" ? (
              <IconCheck className="w-3.5 h-3.5" />
            ) : trace.finalResult === "missing" ? (
              <IconHelpCircle className="w-3.5 h-3.5" />
            ) : trace.finalResult === "incompatible" ? (
              <IconAlertCircle className="w-3.5 h-3.5" />
            ) : (
              <IconAlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>Outcome: {RESULT_LABEL[trace.finalResult]}</span>
          </span>
        </div>
      </div>

      {/* Sample Profiles Quick Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span className="flex items-center gap-1">
            <IconAdjustmentsHorizontal className="w-3 h-3 text-brand-cyan" />
            Sample Subject Data Profiles:
          </span>
          <button
            type="button"
            onClick={() => setShowOverrides(!showOverrides)}
            className="text-brand-cyan hover:underline text-[10px]"
          >
            {showOverrides ? "Hide Value Overrides" : "Edit Value Overrides"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_SUBJECT_PROFILES.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelectProfile(profile)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-mono border border-zinc-800 hover:border-brand-cyan/40 transition-colors"
              title={profile.description}
            >
              {profile.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mock Value Override Grid */}
      {showOverrides && (
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="text-[10px] font-mono text-zinc-400 font-semibold uppercase">
            Mock Field Input Values (Instant Real-time Calculation):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {referencedFields.map((rf) => {
              const currentVal =
                mockValues[rf.id] ??
                mockValues[rf.variableName] ??
                mockValues[rf.variableName.toLowerCase()] ??
                "";

              return (
                <div key={rf.id} className="space-y-1">
                  <label className="block text-[9px] font-mono text-zinc-400 truncate">
                    {rf.variableName} {rf.unit ? `(${rf.unit})` : ""}
                  </label>
                  <input
                    type="text"
                    value={currentVal === null ? "" : String(currentVal)}
                    onChange={(e) =>
                      handleFieldValueChange(rf.variableName, e.target.value)
                    }
                    placeholder="Missing"
                    className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono focus:border-brand-cyan focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEPPER CONTROLS BAR */}
      <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRawStepIndex(0)}
            disabled={activeStepIndex === 0}
            className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors"
            title="First Step"
          >
            <IconPlayerSkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRawStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={activeStepIndex === 0}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 border border-zinc-800 text-xs font-mono flex items-center gap-1 transition-colors"
            title="Step Back"
          >
            <IconChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-colors ${
              isPlaying
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40 hover:bg-brand-cyan/30"
            }`}
          >
            {isPlaying ? (
              <>
                <IconPlayerPause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <IconPlayerPlay className="w-3.5 h-3.5" />
                <span>Auto Step</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              setRawStepIndex((prev) =>
                Math.min(trace.steps.length - 1, prev + 1)
              )
            }
            disabled={activeStepIndex >= trace.steps.length - 1}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 border border-zinc-800 text-xs font-mono flex items-center gap-1 transition-colors"
            title="Step Next"
          >
            <span>Next</span>
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRawStepIndex(trace.steps.length - 1)}
            disabled={activeStepIndex >= trace.steps.length - 1}
            className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors"
            title="End Step"
          >
            <IconPlayerSkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">
            Step{" "}
            <span className="text-brand-cyan font-bold">
              {activeStepIndex + 1}
            </span>{" "}
            of{" "}
            <span className="text-white font-bold">{trace.steps.length}</span>
          </span>
          {trace.hasShortCircuit && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <IconBolt className="w-3 h-3 text-purple-400" />
              <span>Short-Circuited</span>
            </span>
          )}
        </div>
      </div>

      {/* ACTIVE STEP DETAIL INSPECTOR CARD */}
      {activeStep && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-brand-cyan/40 space-y-2.5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 inline-flex items-center justify-center text-xs font-mono font-bold">
                {activeStep.stepIndex}
              </span>
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                {activeStep.nodeType === "rule_summary"
                  ? "Rule Outcome Summary"
                  : `Condition Node: ${activeStep.variableName}`}
              </span>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                activeStep.shortCircuited
                  ? RESULT_BADGE_STYLE.short_circuit
                  : RESULT_BADGE_STYLE[activeStep.result]
              }`}
            >
              {activeStep.shortCircuited
                ? "SHORT-CIRCUITED"
                : RESULT_LABEL[activeStep.result]}
            </span>
          </div>

          {/* Sentence / Comparison Breakdown */}
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200">
            {activeStep.sentence}
          </div>

          {/* Short-Circuit Explanation Callout */}
          {activeStep.shortCircuited && activeStep.shortCircuitReason && (
            <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/50 text-[11px] font-mono text-purple-300 flex items-start gap-2">
              <IconBolt className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase text-[10px] text-purple-200">
                  Logical Short-Circuit Triggered
                </div>
                <div>{activeStep.shortCircuitReason}</div>
              </div>
            </div>
          )}

          {/* Missing or Incompatible Input Diagnostics */}
          {activeStep.diagnostics.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-[11px] font-mono text-amber-300 space-y-1">
              {activeStep.diagnostics.map((diag, dIdx) => (
                <div key={dIdx} className="flex items-start gap-1.5">
                  <IconAlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{diag}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONDITION TREE & STEP LIST */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
          Condition Execution Tree ({trace.steps.length} Steps):
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {trace.steps.map((step, sIdx) => {
            const isActive = sIdx === activeStepIndex;
            return (
              <div
                key={step.nodeId}
                onClick={() => setRawStepIndex(sIdx)}
                className={`p-2.5 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                  isActive
                    ? "bg-zinc-900 border-brand-cyan ring-1 ring-brand-cyan/40 shadow-md"
                    : "bg-zinc-950/70 border-zinc-850 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-zinc-500 font-bold shrink-0">
                      #{step.stepIndex}
                    </span>
                    <span className="truncate text-zinc-300">
                      {step.sentence}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                      step.shortCircuited
                        ? RESULT_BADGE_STYLE.short_circuit
                        : RESULT_BADGE_STYLE[step.result]
                    }`}
                  >
                    {step.shortCircuited
                      ? "SKIPPED"
                      : RESULT_LABEL[step.result]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
