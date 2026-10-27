"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { CRFField } from "@/lib/crf/types";
import {
  CLINICAL_FORMULA_PRESETS,
  mapPresetToFormVariables,
  explainCalculationDerivation,
  HighlightToken,
  FormulaDiagnostic,
  ClinicalFormulaPreset,
} from "@/lib/crf";
import { useCrfService } from "@/hooks/useCrfService";
import {
  IconMathFunction,
  IconCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconSparkles,
  IconPlayerPlay,
  IconHelpCircle,
  IconPlus,
} from "@tabler/icons-react";

interface AstRuleEditorProps {
  formula: string;
  onChange: (formula: string) => void;
  fields: CRFField[];
  currentFieldId?: string;
  readOnly?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}

const BRACKET_DEPTH_CLASSES = [
  "text-sky-400 font-bold", // Depth 0
  "text-purple-400 font-bold", // Depth 1
  "text-amber-400 font-bold", // Depth 2
  "text-emerald-400 font-bold", // Depth 3
];

const DEFAULT_SAMPLE_VALUES: Record<string, number> = {
  height: 175,
  ht: 175,
  vs_ht: 175,
  weight: 70,
  wt: 70,
  vs_wt: 70,
  age: 55,
  dm_age: 55,
  creat: 1.1,
  lb_creat: 1.1,
  screat: 1.1,
  sysbp: 120,
  sbp: 120,
  diabp: 80,
  dbp: 80,
  egqt: 420,
  qt: 420,
  egrr: 850,
  rr: 850,
  trl1: 25,
  trl2: 18,
  trsldbas: 40,
};

export const AstRuleEditor: React.FC<AstRuleEditorProps> = ({
  formula,
  onChange,
  fields,
  currentFieldId,
  readOnly = false,
  placeholder = "e.g. weight / ((height/100) * (height/100))",
  label = "AST Dynamic Formula",
  className = "",
}) => {
  const { evaluateFormula, lintFormula } = useCrfService();
  const [showPresets, setShowPresets] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [showFunctionsGuide, setShowFunctionsGuide] = useState(false);
  const [testValues, setTestValues] = useState<Record<string, number>>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Lint analysis
  const lintResult = useMemo(() => {
    const res = lintFormula({
      formula,
      fieldsList: fields,
      targetFieldId: currentFieldId,
    });
    return res.success
      ? res.data
      : {
          isValid: false,
          diagnostics: [
            {
              id: "error",
              severity: "error" as const,
              message: res.error.message || "Formula linting failed",
              code: "UNEXPECTED_TOKEN" as const,
              start: 0,
              end: formula.length,
            },
          ],
          tokens: [],
          referencedVariables: [],
        };
  }, [formula, fields, currentFieldId, lintFormula]);

  const referencedVars = lintResult.referencedVariables;

  // Sync scroll between textarea and pre
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Value helper for live testing
  const getTestValue = useCallback(
    (varName: string): number => {
      if (testValues[varName] !== undefined) return testValues[varName];
      const lower = varName.toLowerCase();
      return DEFAULT_SAMPLE_VALUES[lower] ?? 10;
    },
    [testValues]
  );

  // Live evaluated preview value
  const previewResult = useMemo(() => {
    if (!formula.trim() || !lintResult.isValid) return null;
    const mergedValues: Record<string, number> = {};
    referencedVars.forEach((v) => {
      mergedValues[v.name] = getTestValue(v.name);
    });
    const res = evaluateFormula({
      formula,
      fieldValues: mergedValues,
      fieldsList: fields,
    });
    return res.success && Number.isFinite(res.data.value)
      ? res.data.value
      : null;
  }, [
    formula,
    fields,
    lintResult.isValid,
    referencedVars,
    getTestValue,
    evaluateFormula,
  ]);

  const currentField = useMemo(() => {
    return fields.find((f) => f.id === currentFieldId);
  }, [fields, currentFieldId]);

  const derivationExplanation = useMemo(() => {
    if (!formula.trim()) return null;
    const mergedValues: Record<string, number> = {};
    referencedVars.forEach((v) => {
      mergedValues[v.name] = getTestValue(v.name);
    });
    return explainCalculationDerivation(
      formula,
      mergedValues,
      fields,
      currentField
    );
  }, [formula, referencedVars, getTestValue, fields, currentField]);

  // Insert token at cursor
  const insertToken = (tokenToInsert: string) => {
    if (readOnly) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${formula} ${tokenToInsert}`.trim());
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formula.substring(0, start);
    const after = formula.substring(end);
    const newFormula = `${before}${tokenToInsert}${after}`;
    onChange(newFormula);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + tokenToInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Apply a clinical preset
  const handleSelectPreset = (preset: ClinicalFormulaPreset) => {
    const mapped = mapPresetToFormVariables(preset.formula, fields);
    onChange(mapped);
    setShowPresets(false);
  };

  // Render tokens inside syntax highlighter
  const renderHighlightedContent = () => {
    if (!formula) {
      return (
        <span className="text-zinc-600 italic select-none">{placeholder}</span>
      );
    }

    if (lintResult.tokens.length === 0) {
      return <span>{formula}</span>;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    lintResult.tokens.forEach((token: HighlightToken, idx: number) => {
      // Include any whitespace between tokens
      if (token.start > lastIndex) {
        elements.push(
          <span key={`ws_${idx}`}>
            {formula.substring(lastIndex, token.start)}
          </span>
        );
      }

      let colorClass = "text-zinc-200";

      if (token.type === "FUNCTION") {
        colorClass = "text-brand-cyan font-bold";
      } else if (token.type === "IDENTIFIER") {
        const ref = referencedVars.find(
          (r) => r.name.toLowerCase() === token.value.toLowerCase()
        );
        if (ref && !ref.exists) {
          colorClass =
            "text-rose-400 underline decoration-rose-500/80 decoration-wavy";
        } else if (ref && !ref.isNumeric) {
          colorClass =
            "text-amber-400 underline decoration-amber-500/80 decoration-wavy";
        } else {
          colorClass = "text-emerald-400 font-semibold";
        }
      } else if (token.type === "NUMBER") {
        colorClass = "text-amber-300 font-mono";
      } else if (token.type === "OP") {
        colorClass = "text-pink-400 font-bold";
      } else if (token.type === "COMMA") {
        colorClass = "text-zinc-400";
      } else if (token.type === "LPAREN" || token.type === "RPAREN") {
        if (token.unmatched) {
          colorClass =
            "text-rose-400 bg-rose-500/20 ring-1 ring-rose-500 rounded px-0.5 font-bold";
        } else {
          const depthIdx = (token.depth ?? 0) % BRACKET_DEPTH_CLASSES.length;
          colorClass = BRACKET_DEPTH_CLASSES[depthIdx];
        }
      } else if (token.type === "INVALID") {
        colorClass =
          "text-rose-400 bg-rose-500/20 underline decoration-rose-500 font-bold";
      }

      elements.push(
        <span key={`tok_${idx}_${token.start}`} className={colorClass}>
          {token.value}
        </span>
      );

      lastIndex = token.end;
    });

    // Trailing characters if any
    if (lastIndex < formula.length) {
      elements.push(<span key="trailing">{formula.substring(lastIndex)}</span>);
    }

    return elements;
  };

  const errorCount = lintResult.diagnostics.filter(
    (d: FormulaDiagnostic) => d.severity === "error"
  ).length;
  const warningCount = lintResult.diagnostics.filter(
    (d: FormulaDiagnostic) => d.severity === "warning"
  ).length;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header & Quick Action Buttons */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-mono text-brand-cyan font-semibold uppercase flex items-center gap-1">
          <IconMathFunction className="w-3.5 h-3.5" />
          <span>{label}</span>
        </label>

        <div className="flex items-center gap-1">
          {/* Clinical Presets Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="px-2 py-0.5 rounded bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-[10px] font-mono text-brand-cyan flex items-center gap-1 transition-colors"
              title="Select Clinical Derivation Preset"
            >
              <IconSparkles className="w-3 h-3" />
              <span>Presets</span>
            </button>

            {showPresets && (
              <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <div className="px-2 py-1 text-[10px] font-mono text-zinc-400 uppercase font-semibold border-b border-zinc-800 flex justify-between">
                  <span>Clinical Derivations</span>
                  <span className="text-brand-cyan">1-Click Auto-Map</span>
                </div>
                {CLINICAL_FORMULA_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full text-left p-2 rounded-lg hover:bg-zinc-800/80 transition-colors border border-transparent hover:border-brand-cyan/30 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white group-hover:text-brand-cyan">
                        {preset.name}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase font-mono">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                      {preset.description}
                    </p>
                    <code className="text-[9px] text-brand-cyan/70 font-mono mt-1 block truncate">
                      {preset.formula}
                    </code>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test & Simulation Trigger */}
          <button
            type="button"
            onClick={() => setShowTester(!showTester)}
            className={`px-2 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 transition-colors ${
              showTester
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300"
            }`}
            title="Toggle Live Test Evaluation"
          >
            <IconPlayerPlay className="w-3 h-3" />
            <span>Test</span>
          </button>

          {/* Functions Reference Trigger */}
          <button
            type="button"
            onClick={() => setShowFunctionsGuide(!showFunctionsGuide)}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Formula Reference Guide"
          >
            <IconHelpCircle className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Editor Box with Synchronized Transparent Textarea & Syntax Highlighted Backdrop */}
      <div className="relative rounded-lg border border-zinc-700 focus-within:border-brand-cyan bg-zinc-950/90 overflow-hidden font-mono text-xs shadow-inner">
        {/* Backdrop Syntax Highlighter */}
        <pre
          ref={preRef}
          aria-hidden="true"
          className="absolute inset-0 p-2.5 overflow-hidden whitespace-pre-wrap break-words pointer-events-none font-mono text-xs leading-relaxed m-0 z-0 select-none"
        >
          {renderHighlightedContent()}
        </pre>

        {/* Transparent Interactive Textarea */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={formula}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          disabled={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="AST Formula Input"
          placeholder={placeholder}
          className="relative z-10 w-full p-2.5 bg-transparent text-transparent caret-white selection:bg-brand-cyan/30 border-none outline-none resize-none font-mono text-xs leading-relaxed overflow-y-auto"
        />

        {/* Bottom Status Bar inside Editor */}
        <div className="px-2.5 py-1 bg-zinc-900/80 border-t border-zinc-850 flex items-center justify-between text-[10px] font-mono select-none">
          <div className="flex items-center gap-2">
            {errorCount > 0 ? (
              <span className="text-rose-400 flex items-center gap-1 font-semibold">
                <IconAlertCircle className="w-3 h-3" />
                <span>
                  {errorCount} {errorCount === 1 ? "Error" : "Errors"}
                </span>
              </span>
            ) : warningCount > 0 ? (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <IconAlertTriangle className="w-3 h-3" />
                <span>
                  {warningCount} {warningCount === 1 ? "Warning" : "Warnings"}
                </span>
              </span>
            ) : formula.trim() ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <IconCheck className="w-3 h-3" />
                <span>Syntax Verified</span>
              </span>
            ) : (
              <span className="text-zinc-500">Ready to compose</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-zinc-500">
            <span>Len: {formula.length}</span>
            <span>Vars: {referencedVars.length}</span>
          </div>
        </div>
      </div>

      {/* Real-time Diagnostics List */}
      {lintResult.diagnostics.length > 0 && formula.trim().length > 0 && (
        <div className="space-y-1" role="status" aria-live="polite">
          {lintResult.diagnostics.map(
            (diag: FormulaDiagnostic, dIdx: number) => {
              const isErr = diag.severity === "error";
              const isWarn = diag.severity === "warning";
              return (
                <div
                  key={`diag_${dIdx}_${diag.code}`}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-start gap-2 ${
                    isErr
                      ? "bg-rose-950/40 border-rose-800/50 text-rose-300"
                      : isWarn
                        ? "bg-amber-950/40 border-amber-800/50 text-amber-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}
                >
                  {isErr ? (
                    <IconAlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  ) : isWarn ? (
                    <IconAlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <IconCheck className="w-3.5 h-3.5 text-brand-cyan shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="leading-tight">{diag.message}</div>
                    {diag.start !== undefined &&
                      diag.end !== undefined &&
                      diag.start < diag.end && (
                        <div className="text-[9px] text-zinc-500 mt-0.5">
                          Column {diag.start + 1} - {diag.end}
                        </div>
                      )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Live Sample Evaluation Tester Box (#671) */}
      {showTester && (
        <div className="p-3 rounded-xl bg-zinc-950 border border-emerald-900/40 space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
            <span className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <IconPlayerPlay className="w-3.5 h-3.5" />
              Live Evaluation Preview
            </span>
            <div className="flex items-center gap-1.5">
              {derivationExplanation && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                    derivationExplanation.status === "success"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/50"
                      : derivationExplanation.status === "missing_inputs"
                        ? "bg-amber-950/80 text-amber-300 border-amber-700/50"
                        : derivationExplanation.status === "invalid_unit"
                          ? "bg-purple-950/80 text-purple-300 border-purple-700/50"
                          : "bg-rose-950/80 text-rose-300 border-rose-700/50"
                  }`}
                >
                  {derivationExplanation.status.replace("_", " ")}
                </span>
              )}
              <div className="text-xs font-mono font-bold text-white bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                Result:{" "}
                {derivationExplanation?.result !== null &&
                derivationExplanation?.result !== undefined
                  ? derivationExplanation.result
                  : previewResult !== null
                    ? previewResult
                    : "—"}
              </div>
            </div>
          </div>

          {/* Diagnostics Alert if any */}
          {derivationExplanation?.diagnostics &&
            derivationExplanation.diagnostics.length > 0 && (
              <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[10px] font-mono text-amber-300 space-y-1">
                {derivationExplanation.diagnostics.map((diag, i) => (
                  <div key={`diag_${i}`} className="flex items-start gap-1.5">
                    <IconAlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                    <span>{diag}</span>
                  </div>
                ))}
              </div>
            )}

          {referencedVars.length === 0 ? (
            <p className="text-[10px] font-mono text-zinc-500">
              No variables referenced yet. Type or click variable pills below.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {referencedVars.map((v) => {
                const dep = derivationExplanation?.dependencies.find(
                  (d) => d.variableName.toUpperCase() === v.name.toUpperCase()
                );
                return (
                  <div key={`test_val_${v.name}`} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                      <span className="truncate">{v.name}</span>
                      <span className="text-zinc-500">
                        {dep?.actualUnit ||
                          v.field?.unit ||
                          dep?.expectedUnit ||
                          ""}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={getTestValue(v.name)}
                      onChange={(e) =>
                        setTestValues({
                          ...testValues,
                          [v.name]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Step-by-Step Clinical Derivation Breakdown */}
          {derivationExplanation?.steps &&
            derivationExplanation.steps.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-850">
                <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                  Derivation Steps ({derivationExplanation.steps.length})
                </span>
                <div className="space-y-1 bg-zinc-900/60 rounded-lg p-2 border border-zinc-800/80">
                  {derivationExplanation.steps.map((step) => (
                    <div
                      key={`step_${step.stepNumber}`}
                      className="text-[10px] font-mono space-y-0.5"
                    >
                      <div className="text-zinc-400 font-semibold flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 text-zinc-300 inline-flex items-center justify-center text-[8px] font-bold">
                          {step.stepNumber}
                        </span>
                        <span>{step.description}</span>
                      </div>
                      <div className="pl-4 text-emerald-400 font-mono">
                        <code>{step.expression}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {derivationExplanation?.summary && (
            <div className="text-[10px] font-mono text-zinc-400 italic pt-0.5">
              {derivationExplanation.summary}
            </div>
          )}
        </div>
      )}

      {/* Functions Reference Guide Modal/Box */}
      {showFunctionsGuide && (
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] font-mono space-y-1.5 text-zinc-300">
          <div className="text-brand-cyan font-bold uppercase text-[10px]">
            Supported Math Functions
          </div>
          <div className="grid grid-cols-2 gap-1 text-zinc-400">
            <div>
              <code>round(x, n)</code> - Round decimals
            </div>
            <div>
              <code>sqrt(x)</code> - Square root
            </div>
            <div>
              <code>abs(x)</code> - Absolute value
            </div>
            <div>
              <code>max(a, b)</code> - Maximum
            </div>
            <div>
              <code>min(a, b)</code> - Minimum
            </div>
            <div>
              <code>log(x)</code> - Natural log
            </div>
            <div>
              <code>exp(x)</code> - Exponential
            </div>
            <div>
              <code>base ^ exp</code> - Power
            </div>
          </div>
        </div>
      )}

      {/* Quick Insert: Available Form Variables */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between">
          <span>Form Variables (Click to insert):</span>
        </div>

        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
          {fields
            .filter((f) => f.id !== currentFieldId)
            .map((f) => {
              const isNumeric =
                f.dataType === "number" ||
                f.dataType === "integer" ||
                f.dataType === "calculated" ||
                f.dataType === "vas_scale" ||
                f.dataType === "nrs_scale";

              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => insertToken(f.variableName || f.id)}
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors flex items-center gap-1 ${
                    isNumeric
                      ? "bg-zinc-900 hover:bg-brand-cyan/20 border-zinc-800 text-zinc-300 hover:text-brand-cyan hover:border-brand-cyan/40"
                      : "bg-zinc-950 hover:bg-amber-500/10 border-zinc-850 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40"
                  }`}
                  title={`${f.label} (${f.dataType})`}
                >
                  <IconPlus className="w-2.5 h-2.5 opacity-60" />
                  <span className="font-semibold">
                    {f.variableName || f.id}
                  </span>
                  <span className="text-[8px] opacity-60 uppercase">
                    {f.dataType.slice(0, 3)}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Quick Insert: Mathematical Functions & Operators */}
      <div className="flex flex-wrap gap-1 pt-0.5">
        {[
          { label: "round(x, 1)", token: "round(, 1)" },
          { label: "sqrt(x)", token: "sqrt()" },
          { label: "abs(x)", token: "abs()" },
          { label: "max(a, b)", token: "max(, )" },
          { label: "min(a, b)", token: "min(, )" },
          { label: "+", token: " + " },
          { label: "-", token: " - " },
          { label: "*", token: " * " },
          { label: "/", token: " / " },
          { label: "^", token: " ^ " },
          { label: "( )", token: "()" },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => insertToken(btn.token)}
            className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};
