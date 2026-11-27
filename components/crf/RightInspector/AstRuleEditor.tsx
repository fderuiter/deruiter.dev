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

import { TooltipButton } from "@/components/ui/Tooltip";
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
  "studio-fg-sky font-bold", // Depth 0
  "studio-fg-purple font-bold", // Depth 1
  "studio-fg-amber font-bold", // Depth 2
  "studio-fg-emerald font-bold", // Depth 3
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
        <span className="studio-fg-muted italic select-none">
          {placeholder}
        </span>
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

      let colorClass = "studio-fg-primary";

      if (token.type === "FUNCTION") {
        colorClass = "studio-fg-cyan font-bold";
      } else if (token.type === "IDENTIFIER") {
        const ref = referencedVars.find(
          (r) => r.name.toLowerCase() === token.value.toLowerCase()
        );
        if (ref && !ref.exists) {
          colorClass =
            "studio-fg-red underline decoration-rose-500/80 decoration-wavy";
        } else if (ref && !ref.isNumeric) {
          colorClass =
            "studio-fg-amber underline decoration-amber-500/80 decoration-wavy";
        } else {
          colorClass = "studio-fg-emerald font-semibold";
        }
      } else if (token.type === "NUMBER") {
        colorClass = "studio-fg-amber font-mono";
      } else if (token.type === "OP") {
        colorClass = "text-pink-400 font-bold";
      } else if (token.type === "COMMA") {
        colorClass = "studio-fg-muted";
      } else if (token.type === "LPAREN" || token.type === "RPAREN") {
        if (token.unmatched) {
          colorClass =
            "studio-fg-red studio-bg-red-strong ring-1 ring-rose-500 rounded px-0.5 font-bold";
        } else {
          const depthIdx = (token.depth ?? 0) % BRACKET_DEPTH_CLASSES.length;
          colorClass = BRACKET_DEPTH_CLASSES[depthIdx];
        }
      } else if (token.type === "INVALID") {
        colorClass =
          "studio-fg-red studio-bg-red-strong underline decoration-rose-500 font-bold";
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
        <label className="text-[11px] font-mono studio-fg-cyan font-semibold uppercase flex items-center gap-1">
          <IconMathFunction className="w-3.5 h-3.5" />
          <span>{label}</span>
        </label>

        <div className="flex items-center gap-1">
          {/* Clinical Presets Dropdown Trigger */}
          <div className="relative">
            <TooltipButton
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="px-2 py-0.5 rounded studio-accent-cyan studio-hover-bg-cyan border text-[10px] font-mono flex items-center gap-1 transition-colors"
              tooltip="Select Clinical Derivation Preset"
            >
              <IconSparkles className="w-3 h-3" />
              <span>Presets</span>
            </TooltipButton>

            {showPresets && (
              <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto studio-surface-card border studio-border-strong rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <div className="px-2 py-1 text-[10px] font-mono studio-fg-muted uppercase font-semibold border-b studio-border-default flex justify-between">
                  <span>Clinical Derivations</span>
                  <span className="studio-fg-cyan">1-Click Auto-Map</span>
                </div>
                {CLINICAL_FORMULA_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="w-full text-left p-2 rounded-lg studio-hover-surface transition-colors border border-transparent studio-hover-border-cyan group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold studio-fg-primary studio-group-hover-fg-cyan">
                        {preset.name}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded studio-surface-muted studio-fg-muted uppercase font-mono">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[10px] studio-fg-muted mt-0.5 line-clamp-1">
                      {preset.description}
                    </p>
                    <code className="text-[9px] studio-fg-cyan font-mono mt-1 block truncate">
                      {preset.formula}
                    </code>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test & Simulation Trigger */}
          <TooltipButton
            type="button"
            onClick={() => setShowTester(!showTester)}
            className={`px-2 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 transition-colors ${
              showTester
                ? "studio-accent-emerald-strong"
                : "studio-surface-card studio-hover-surface studio-border-strong studio-fg-secondary"
            }`}
            tooltip="Toggle Live Test Evaluation"
          >
            <IconPlayerPlay className="w-3 h-3" />
            <span>Test</span>
          </TooltipButton>

          {/* Functions Reference Trigger */}
          <TooltipButton
            type="button"
            onClick={() => setShowFunctionsGuide(!showFunctionsGuide)}
            className="p-1 rounded studio-surface-card studio-hover-surface border studio-border-strong studio-fg-muted studio-hover-fg-primary transition-colors"
            tooltip="Formula Reference Guide"
            aria-label="Formula Reference Guide"
          >
            <IconHelpCircle className="w-3 h-3" />
          </TooltipButton>
        </div>
      </div>

      {/* Editor Box with Synchronized Transparent Textarea & Syntax Highlighted Backdrop */}
      <div className="relative rounded-lg border studio-border-strong studio-focus-within studio-surface-subtle overflow-hidden font-mono text-xs shadow-inner">
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
          className="relative z-10 w-full p-2.5 bg-transparent text-transparent studio-caret selection:bg-brand-cyan/30 border-none outline-none resize-none font-mono text-xs leading-relaxed overflow-y-auto"
        />

        {/* Bottom Status Bar inside Editor */}
        <div className="px-2.5 py-1 studio-surface-card border-t studio-border-default flex items-center justify-between text-[10px] font-mono select-none">
          <div className="flex items-center gap-2">
            {errorCount > 0 ? (
              <span className="studio-fg-red flex items-center gap-1 font-semibold">
                <IconAlertCircle className="w-3 h-3" />
                <span>
                  {errorCount} {errorCount === 1 ? "Error" : "Errors"}
                </span>
              </span>
            ) : warningCount > 0 ? (
              <span className="studio-fg-amber flex items-center gap-1 font-semibold">
                <IconAlertTriangle className="w-3 h-3" />
                <span>
                  {warningCount} {warningCount === 1 ? "Warning" : "Warnings"}
                </span>
              </span>
            ) : formula.trim() ? (
              <span className="studio-fg-emerald flex items-center gap-1 font-semibold">
                <IconCheck className="w-3 h-3" />
                <span>Syntax Verified</span>
              </span>
            ) : (
              <span className="studio-fg-muted">Ready to compose</span>
            )}
          </div>

          <div className="flex items-center gap-2 studio-fg-muted">
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
                      ? "studio-accent-red"
                      : isWarn
                        ? "studio-accent-amber"
                        : "studio-surface-card studio-border-default studio-fg-muted"
                  }`}
                >
                  {isErr ? (
                    <IconAlertCircle className="w-3.5 h-3.5 studio-fg-red shrink-0 mt-0.5" />
                  ) : isWarn ? (
                    <IconAlertTriangle className="w-3.5 h-3.5 studio-fg-amber shrink-0 mt-0.5" />
                  ) : (
                    <IconCheck className="w-3.5 h-3.5 studio-fg-cyan shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="leading-tight">{diag.message}</div>
                    {diag.start !== undefined &&
                      diag.end !== undefined &&
                      diag.start < diag.end && (
                        <div className="text-[9px] studio-fg-muted mt-0.5">
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
        <div className="p-3 rounded-xl studio-surface-subtle border studio-border-emerald space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between border-b studio-border-default pb-1.5">
            <span className="text-[11px] font-mono font-bold studio-fg-emerald flex items-center gap-1.5">
              <IconPlayerPlay className="w-3.5 h-3.5" />
              Live Evaluation Preview
            </span>
            <div className="flex items-center gap-1.5">
              {derivationExplanation && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                    derivationExplanation.status === "success"
                      ? "studio-accent-emerald-strong"
                      : derivationExplanation.status === "missing_inputs"
                        ? "studio-accent-amber-strong"
                        : derivationExplanation.status === "invalid_unit"
                          ? "studio-accent-purple-strong"
                          : "studio-accent-red-strong"
                  }`}
                >
                  {derivationExplanation.status.replace("_", " ")}
                </span>
              )}
              <div className="text-xs font-mono font-bold studio-fg-primary studio-bg-emerald-strong px-2 py-0.5 rounded border studio-border-emerald">
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
              <div className="p-2 rounded studio-accent-amber border text-[10px] font-mono space-y-1">
                {derivationExplanation.diagnostics.map((diag, i) => (
                  <div key={`diag_${i}`} className="flex items-start gap-1.5">
                    <IconAlertTriangle className="w-3 h-3 shrink-0 mt-0.5 studio-fg-amber" />
                    <span>{diag}</span>
                  </div>
                ))}
              </div>
            )}

          {referencedVars.length === 0 ? (
            <p className="text-[10px] font-mono studio-fg-muted">
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
                    <div className="flex items-center justify-between text-[9px] font-mono studio-fg-muted">
                      <span className="truncate">{v.name}</span>
                      <span className="studio-fg-muted">
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
                      className="w-full px-2 py-1 studio-surface-card border studio-border-default rounded text-xs studio-fg-primary font-mono studio-hover-border-emerald focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Step-by-Step Clinical Derivation Breakdown */}
          {derivationExplanation?.steps &&
            derivationExplanation.steps.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t studio-border-default">
                <span className="text-[10px] font-mono font-semibold studio-fg-muted uppercase tracking-wider">
                  Derivation Steps ({derivationExplanation.steps.length})
                </span>
                <div className="space-y-1 studio-surface-subtle rounded-lg p-2 border studio-border-default">
                  {derivationExplanation.steps.map((step) => (
                    <div
                      key={`step_${step.stepNumber}`}
                      className="text-[10px] font-mono space-y-0.5"
                    >
                      <div className="studio-fg-muted font-semibold flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full studio-surface-muted studio-fg-secondary inline-flex items-center justify-center text-[8px] font-bold">
                          {step.stepNumber}
                        </span>
                        <span>{step.description}</span>
                      </div>
                      <div className="pl-4 studio-fg-emerald font-mono">
                        <code>{step.expression}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {derivationExplanation?.summary && (
            <div className="text-[10px] font-mono studio-fg-muted italic pt-0.5">
              {derivationExplanation.summary}
            </div>
          )}
        </div>
      )}

      {/* Functions Reference Guide Modal/Box */}
      {showFunctionsGuide && (
        <div className="p-2.5 rounded-lg studio-surface-subtle border studio-border-default text-[10px] font-mono space-y-1.5 studio-fg-secondary">
          <div className="studio-fg-cyan font-bold uppercase text-[10px]">
            Supported Math Functions
          </div>
          <div className="grid grid-cols-2 gap-1 studio-fg-muted">
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
        <div className="text-[10px] font-mono studio-fg-muted flex items-center justify-between">
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
                <TooltipButton
                  key={f.id}
                  type="button"
                  onClick={() => insertToken(f.variableName || f.id)}
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors flex items-center gap-1 ${
                    isNumeric
                      ? "studio-surface-card studio-hover-bg-cyan studio-border-default studio-fg-secondary studio-hover-fg-cyan studio-hover-border-cyan"
                      : "studio-surface-subtle studio-hover-bg-amber studio-border-default studio-fg-muted studio-hover-fg-amber studio-hover-border-amber"
                  }`}
                  tooltip={`${f.label} (${f.dataType})`}
                >
                  <IconPlus className="w-2.5 h-2.5 opacity-60" />
                  <span className="font-semibold">
                    {f.variableName || f.id}
                  </span>
                  <span className="text-[8px] opacity-60 uppercase">
                    {f.dataType.slice(0, 3)}
                  </span>
                </TooltipButton>
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
            className="px-1.5 py-0.5 rounded studio-surface-card studio-hover-surface border studio-border-default text-[10px] font-mono studio-fg-muted studio-hover-fg-primary transition-colors"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};
