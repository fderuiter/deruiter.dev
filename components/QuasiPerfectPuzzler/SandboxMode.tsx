"use client";

import React, {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ASTNode } from "@/lib/quasi-perfect/types";
import {
  SANDBOX_PRESETS,
  gradeSandboxRun,
  parseSandboxProgress,
  recordSandboxProof,
  type SandboxMedal,
  type CustomTheorem,
  getSavedCustomTheorems,
  saveCustomTheorem,
  deleteCustomTheorem,
  importCustomTheorems,
  MAX_CUSTOM_THEOREMS,
} from "@/lib/quasi-perfect/sandbox";
import { downloadFile } from "@/lib/download";
import {
  STORAGE_CHANGE_EVENT,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
  cloneAST,
  findNodeById,
  isProofComplete,
  renderASTString,
} from "@/lib/quasi-perfect/engine";
import {
  parseFormulaWithError,
  parseHypotheses,
} from "@/lib/quasi-perfect/compiler";
import { ExpressionTree } from "./ExpressionTree";
import { TacticHand } from "./TacticHand";
import { TerminalLog } from "./TerminalLog";
import { CompilerLogEntry, TacticResult } from "@/lib/quasi-perfect/types";
import {
  IconFlask,
  IconRotate,
  IconSparkles,
  IconEdit,
  IconCheck,
  IconAlertTriangle,
  IconCode,
  IconX,
  IconDeviceFloppy,
  IconDownload,
  IconUpload,
  IconTrash,
} from "@tabler/icons-react";

const SANDBOX_STORAGE_KEY = "quasi_perfect_puzzler_sandbox_v1";

// Same pattern as the campaign progress: other tabs fire "storage", writes in
// this tab go through lib/safe-storage, which fires STORAGE_CHANGE_EVENT.
function subscribeSandboxProgress(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_CHANGE_EVENT, callback);
  };
}

function getSandboxSnapshot(): string {
  if (typeof window === "undefined") return "{}";
  return safeGetRawItem(SANDBOX_STORAGE_KEY) || "{}";
}

function getSandboxServerSnapshot(): string {
  return "{}";
}

const MEDAL_LABEL: Record<SandboxMedal, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

const FORMULA_SHORTCUTS = [
  {
    label: "Binomial Square",
    formula: "(a + b)^2 = a^2 + 2*a*b + b^2",
    hypotheses: "",
  },
  {
    label: "Logical Implication",
    formula: "P -> Q -> P",
    hypotheses: "",
  },
  {
    label: "Hypothesis Transitivity",
    formula: "a = c",
    hypotheses: "h1: a = b, h2: b = c",
  },
  {
    label: "De Morgan Conjunction",
    formula: "~(P \\/ Q) = ~P /\\ ~Q",
    hypotheses: "",
  },
];

const OPERATOR_SHORTCUTS = [
  "+",
  "-",
  "*",
  "/",
  "^",
  "=",
  "≠",
  "→",
  "∧",
  "∨",
  "¬",
  "≤",
  "∀",
  "∃",
  ",",
  "(",
  ")",
];

export const SandboxMode: React.FC = () => {
  const sandboxRef = useRef<HTMLDivElement>(null);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(0);

  const [currentGoal, setCurrentGoal] = useState<ASTNode>(() =>
    cloneAST(SANDBOX_PRESETS[0].goal)
  );
  const [currentHypotheses, setCurrentHypotheses] = useState<ASTNode[]>(() =>
    SANDBOX_PRESETS[0].hypotheses.map(cloneAST)
  );

  const [customGoalInput, setCustomGoalInput] = useState<string>(
    "(a + b)^2 = a^2 + 2*a*b + b^2"
  );
  const [customHypothesesInput, setCustomHypothesesInput] =
    useState<string>("");
  const [customTitleInput, setCustomTitleInput] =
    useState<string>("Binomial Expansion");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeFormulaTitle, setActiveFormulaTitle] = useState<string>(
    SANDBOX_PRESETS[0].name
  );

  const [savedCustomTheorems, setSavedCustomTheorems] = useState<
    CustomTheorem[]
  >(() => getSavedCustomTheorems());
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const syncTheorems = () => setSavedCustomTheorems(getSavedCustomTheorems());
    window.addEventListener("storage", syncTheorems);
    window.addEventListener(STORAGE_CHANGE_EVENT, syncTheorems);
    return () => {
      window.removeEventListener("storage", syncTheorems);
      window.removeEventListener(STORAGE_CHANGE_EVENT, syncTheorems);
    };
  }, []);

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [selectedTacticIndex, setSelectedTacticIndex] = useState<number | null>(
    null
  );

  // RAM the current preset attempt has spent, failed tactics included, and
  // whether it was admitted with sorry. Sandbox never blocks on RAM; these
  // only grade the attempt against the preset's targets (#2059).
  const [ramUsed, setRamUsed] = useState<number>(0);
  const [usedSorry, setUsedSorry] = useState<boolean>(false);

  const rawSandboxProgress = useSyncExternalStore(
    subscribeSandboxProgress,
    getSandboxSnapshot,
    getSandboxServerSnapshot
  );
  const sandboxProgress = parseSandboxProgress(rawSandboxProgress);

  const saveSandboxProof = useCallback((presetId: string, spent: number) => {
    const existing = parseSandboxProgress(safeGetRawItem(SANDBOX_STORAGE_KEY));
    const next = recordSandboxProof(existing, presetId, spent);
    if (next === existing) return;
    safeSetRawItem(SANDBOX_STORAGE_KEY, JSON.stringify(next), {
      retainInMemory: false,
    });
  }, []);

  const [logs, setLogs] = useState<CompilerLogEntry[]>([
    {
      id: "sb-init",
      timestamp: "00:00:01",
      type: "info",
      text: "Interactive Sandbox Mode active. Unlimited RAM: no tactic is refused, but presets grade the RAM you spend against gold and silver targets. Test any tactic freely or compile custom infix formulas.",
    },
  ]);

  // Live compilation analysis
  const parseResult = parseFormulaWithError(customGoalInput, "custom-goal");
  let parsedHypothesesList: ASTNode[] = [];
  let hypError: string | null = null;
  if (customHypothesesInput.trim()) {
    try {
      parsedHypothesesList = parseHypotheses(
        customHypothesesInput,
        "custom-hyp"
      );
    } catch (e) {
      hypError = e instanceof Error ? e.message : String(e);
    }
  }

  const loadPreset = (idx: number) => {
    const p = SANDBOX_PRESETS[idx];
    setSelectedPresetIdx(idx);
    setActiveFormulaTitle(p.name);
    setCurrentGoal(cloneAST(p.goal));
    setCurrentHypotheses(p.hypotheses.map(cloneAST));
    setSelectedTargetId(null);
    setSelectedTacticIndex(null);
    setRamUsed(0);
    setUsedSorry(false);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "info",
        text: `Loaded preset: ${p.name}`,
      },
    ]);
  };

  const handleApplyCustomFormula = () => {
    if (!parseResult.ast || hypError) return;

    setSelectedPresetIdx(null);
    setActiveFormulaTitle(
      `Custom Formula: ${renderASTString(parseResult.ast)}`
    );
    setCurrentGoal(parseResult.ast);
    setCurrentHypotheses(parsedHypothesesList);
    setSelectedTargetId(null);
    setSelectedTacticIndex(null);
    setRamUsed(0);
    setUsedSorry(false);

    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "success",
        text: `Successfully compiled and loaded AST for custom formula: "${customGoalInput}"`,
      },
    ]);
  };

  const handleSaveTheorem = () => {
    setSaveStatus(null);
    const res = saveCustomTheorem(
      customTitleInput,
      customGoalInput,
      customHypothesesInput
    );
    if (!res.success) {
      setSaveStatus({
        type: "error",
        message: res.error || "Failed to save theorem.",
      });
    } else {
      setSavedCustomTheorems(res.theorems);
      const titleSaved = customTitleInput.trim() || "Custom Formula";
      setSaveStatus({
        type: "success",
        message: `Saved theorem "${titleSaved}" to local storage.`,
      });
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "success",
          text: `Saved custom theorem "${titleSaved}"`,
        },
      ]);
    }
  };

  const handleDeleteTheorem = (id: string, title: string) => {
    const updated = deleteCustomTheorem(id);
    setSavedCustomTheorems(updated);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "info",
        text: `Deleted saved theorem "${title}"`,
      },
    ]);
  };

  const handleLoadCustomTheoremItem = (item: CustomTheorem) => {
    setCustomGoalInput(item.formula);
    setCustomHypothesesInput(item.hypotheses || "");
    setCustomTitleInput(item.title);

    const parseRes = parseFormulaWithError(item.formula, "custom-load");
    let hyps: ASTNode[] = [];
    if (item.hypotheses?.trim()) {
      try {
        hyps = parseHypotheses(item.hypotheses, "custom-hyp-load");
      } catch {
        // Ignored
      }
    }

    if (parseRes.ast) {
      setSelectedPresetIdx(null);
      setActiveFormulaTitle(`Custom: ${item.title}`);
      setCurrentGoal(parseRes.ast);
      setCurrentHypotheses(hyps);
      setSelectedTargetId(null);
      setSelectedTacticIndex(null);
      setRamUsed(0);
      setUsedSorry(false);
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "success",
          text: `Loaded saved custom theorem "${item.title}"`,
        },
      ]);
    }
  };

  const handleExportAllTheorems = () => {
    const exportPayload = {
      version: "1.0",
      theorems: savedCustomTheorems,
      exportedAt: new Date().toISOString(),
    };
    const filename = `custom_theorems.json`;
    downloadFile(JSON.stringify(exportPayload, null, 2), filename, {
      mimeType: "application/json;charset=utf-8",
    });
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "info",
        text: `Exported ${savedCustomTheorems.length} custom theorem(s) to custom_theorems.json`,
      },
    ]);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== "string") return;
      const res = importCustomTheorems(content);
      if (!res.success) {
        setImportStatus({
          type: "error",
          message: res.errors.join(" | ") || "Import failed.",
        });
        setLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString("en-US", {
              hour12: false,
            }),
            type: "error",
            text: `Import failed: ${res.errors.join(", ")}`,
          },
        ]);
      } else {
        setSavedCustomTheorems(res.theorems);
        const msg = `Successfully imported ${res.importedCount} theorem(s).${res.errors.length > 0 ? ` (${res.errors.length} skipped with warnings)` : ""}`;
        setImportStatus({ type: "success", message: msg });
        setLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString("en-US", {
              hour12: false,
            }),
            type: "success",
            text: msg,
          },
        ]);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const insertSymbol = (symbol: string) => {
    setCustomGoalInput(
      (prev) => prev + (prev && !prev.endsWith(" ") ? " " : "") + symbol + " "
    );
  };

  const handleExecuteTactic = (tacticIdx: number, targetId: string | null) => {
    const allTactics = Object.keys(tacticDefs) as (keyof typeof tacticDefs)[];
    const tacticKey = allTactics[tacticIdx];
    const tactic = tacticDefs[tacticKey];
    if (!tactic) return;

    const targetNode = targetId ? findNodeById(currentGoal, targetId) : null;
    const supportsChildTarget = ["rw", "simp", "norm_num"].includes(tacticKey);
    let result: TacticResult;
    if (!targetNode) {
      result = {
        success: false,
        ramConsumed: 0,
        message:
          "Select a node in the current goal. Hypotheses and empty space are not tactic targets in Sandbox.",
      };
    } else if (targetNode.id !== currentGoal.id && !supportsChildTarget) {
      result = {
        success: false,
        ramConsumed: 0,
        message: `'${tacticKey}' requires the root goal in Sandbox. Select the GOAL node; use rw, simp or norm_num for child rewrites.`,
      };
    } else if (
      tacticKey === "cases" ||
      tacticKey === "split" ||
      tacticKey === "induction"
    ) {
      result = {
        success: false,
        ramConsumed: 0,
        message: `'${tacticKey}' requires multiple proof goals, which Sandbox does not support. The current goal is unchanged.`,
      };
    } else {
      result = tactic.execute(targetNode, currentGoal, currentHypotheses);
    }

    const spent = ramUsed + result.ramConsumed;
    setRamUsed(spent);
    const sorryNow = usedSorry || (result.success && tacticKey === "sorry");
    if (sorryNow !== usedSorry) setUsedSorry(sorryNow);

    if (result.success && result.newAST) {
      setCurrentGoal(result.newAST);
      const preset =
        selectedPresetIdx !== null ? SANDBOX_PRESETS[selectedPresetIdx] : null;
      if (preset && !sorryNow && isProofComplete(result.newAST)) {
        saveSandboxProof(preset.id, spent);
      }
      if (result.newHypotheses) {
        setCurrentHypotheses(result.newHypotheses);
      }
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "success",
          text: result.message,
        },
      ]);
      setSelectedTacticIndex(null);
      setSelectedTargetId(null);
    } else {
      // Like the campaign (#1232), a failed tactic keeps its card armed so the
      // player can retarget it without picking the card again (#2323).
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "error",
          text: result.message,
        },
      ]);
    }
  };

  const isComplete = isProofComplete(currentGoal);
  const activePreset =
    selectedPresetIdx !== null ? SANDBOX_PRESETS[selectedPresetIdx] : null;
  const activeRecord = activePreset
    ? sandboxProgress[activePreset.id]
    : undefined;
  const bestMedal =
    activePreset && activeRecord
      ? gradeSandboxRun(activePreset, activeRecord.bestRamUsed, false)
      : null;
  const runMedal =
    activePreset && isComplete
      ? gradeSandboxRun(activePreset, ramUsed, usedSorry)
      : null;
  const allTacticIds = Object.keys(tacticDefs) as (keyof typeof tacticDefs)[];

  return (
    <div ref={sandboxRef} className="space-y-4 font-mono">
      {/* Sandbox Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[color:var(--qp-accent-soft)] border border-[color:var(--qp-accent-line)] qp-text-accent-strong">
            <IconFlask className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Theorem Playground &amp; AST Sandbox</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                Pratt Compiler Active
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Local tactic simulation only: no Lean verification or campaign
              score. Select presets or compile custom infix formulas into
              interactive proof nodes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {SANDBOX_PRESETS.map((preset, idx) => {
            const verified = !!sandboxProgress[preset.id]?.verified;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPreset(idx)}
                data-verified={verified ? "true" : undefined}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-[0.98] ${
                  idx === selectedPresetIdx
                    ? "qp-btn-primary"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {/* The name is on the button, not only in a tooltip (#2202). */}
                <span>{preset.name}</span>
                {verified && <span className="sr-only"> (verified)</span>}
                {verified && (
                  <IconCheck
                    aria-hidden="true"
                    data-testid={`sandbox-preset-verified-${preset.id}`}
                    className="w-3 h-3 text-emerald-400"
                  />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            aria-expanded={isDrawerOpen}
            aria-controls="custom-formula-drawer"
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              isDrawerOpen
                ? "qp-btn-primary border-[color:var(--qp-accent-line)]"
                : "border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] qp-text-accent-strong hover:bg-[color:var(--qp-accent-soft)]"
            }`}
          >
            <IconEdit className="w-3.5 h-3.5" />
            <span>Custom Formula Input</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedPresetIdx !== null) loadPreset(selectedPresetIdx);
              else handleApplyCustomFormula();
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <IconRotate className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Formula Editor Drawer / Quick-Input Bar */}
      {isDrawerOpen && (
        <div
          id="custom-formula-drawer"
          className="rounded-xl border border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--qp-accent-line)] pb-2">
            <div className="flex items-center gap-2">
              <IconCode className="w-4 h-4 qp-text-accent-strong" />
              <h4 className="text-xs font-bold qp-text-accent-strong uppercase tracking-wider">
                Custom Formula Pratt Compiler &amp; Editor
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded"
              aria-label="Close formula editor"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold qp-text-accent-strong">
              Preset Formula Shortcuts:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FORMULA_SHORTCUTS.map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => {
                    setCustomGoalInput(shortcut.formula);
                    setCustomHypothesesInput(shortcut.hypotheses);
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded bg-zinc-900 border border-[color:var(--qp-accent-line)] qp-text-accent-strong hover:bg-[color:var(--qp-accent-soft)] transition-all"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Operator Insertion */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-zinc-400">
              Insert Symbol:
            </span>
            {OPERATOR_SHORTCUTS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => insertSymbol(sym)}
                className="px-1.5 py-0.5 text-xs font-bold rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition-all"
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Goal & Hypotheses Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label
                htmlFor="custom-goal-input"
                className="text-xs font-bold text-zinc-300"
              >
                Goal Formula (Infix Expression):
              </label>
              <input
                id="custom-goal-input"
                type="text"
                value={customGoalInput}
                onChange={(e) => setCustomGoalInput(e.target.value)}
                placeholder="e.g. (a + b)^2 = a^2 + 2*a*b + b^2"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-[color:var(--qp-accent-line)]"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="custom-hypotheses-input"
                className="text-xs font-bold text-zinc-300"
              >
                Hypotheses (Optional):
              </label>
              <input
                id="custom-hypotheses-input"
                type="text"
                value={customHypothesesInput}
                onChange={(e) => setCustomHypothesesInput(e.target.value)}
                placeholder="e.g. h1: a = b, h2: b = c"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-[color:var(--qp-accent-line)]"
              />
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400">
                Live Pratt Compiler AST Preview:
              </span>
              {parseResult.ast && !hypError ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <IconCheck className="w-3 h-3" /> Valid AST Tree
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <IconAlertTriangle className="w-3 h-3" /> Syntax Error
                </span>
              )}
            </div>

            {parseResult.ast ? (
              <div className="text-xs text-emerald-400 font-mono bg-zinc-900 p-2 rounded border border-zinc-800">
                <div>
                  <strong>Root Type:</strong> {parseResult.ast.type} (
                  {parseResult.ast.value})
                </div>
                <div>
                  <strong>Formatted AST:</strong>{" "}
                  {renderASTString(parseResult.ast)}
                </div>
                {parsedHypothesesList.length > 0 && (
                  <div className="mt-1 qp-text-accent-strong text-[11px]">
                    <strong>Hypotheses ({parsedHypothesesList.length}):</strong>{" "}
                    {parsedHypothesesList
                      .map(
                        (h) =>
                          `${h.metadata?.name || "h"}: ${renderASTString(h)}`
                      )
                      .join(", ")}
                  </div>
                )}
              </div>
            ) : (
              <pre className="text-xs text-rose-400 font-mono bg-zinc-900 p-2 rounded border border-rose-900/50 whitespace-pre overflow-x-auto">
                {parseResult.error}
              </pre>
            )}

            {hypError && (
              <div className="text-xs text-rose-400 font-mono bg-zinc-900 p-2 rounded border border-rose-900/50">
                Hypothesis Syntax Error: {hypError}
              </div>
            )}
          </div>

          {/* Custom Theorem Save & Storage Controls */}
          <div className="border-t border-[color:var(--qp-accent-line)] pt-3.5 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] space-y-1">
                <label
                  htmlFor="custom-theorem-title-input"
                  className="text-xs font-bold text-zinc-300"
                >
                  Theorem Title:
                </label>
                <input
                  id="custom-theorem-title-input"
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="e.g. Binomial Expansion"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-[color:var(--qp-accent-line)]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveTheorem}
                  disabled={!parseResult.ast || !!hypError}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <IconDeviceFloppy className="w-3.5 h-3.5" />
                  <span>Save Theorem</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAllTheorems}
                  disabled={savedCustomTheorems.length === 0}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  aria-label="Export All (.json)"
                >
                  <IconDownload className="w-3.5 h-3.5" />
                  <span>Export All (.json)</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileChange}
                  className="hidden"
                  id="import-theorems-file-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all flex items-center gap-1.5"
                  aria-label="Import (.json)"
                >
                  <IconUpload className="w-3.5 h-3.5" />
                  <span>Import (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyCustomFormula}
                  disabled={!parseResult.ast || !!hypError}
                  className="qp-btn-primary qp-focus px-4 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <IconSparkles className="w-3.5 h-3.5" />
                  <span>Compile &amp; Set Active Goal</span>
                </button>
              </div>
            </div>

            {saveStatus && (
              <div
                className={`text-xs p-2 rounded border font-mono ${
                  saveStatus.type === "error"
                    ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {saveStatus.message}
              </div>
            )}

            {importStatus && (
              <div
                className={`text-xs p-2 rounded border font-mono ${
                  importStatus.type === "error"
                    ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {importStatus.message}
              </div>
            )}

            {/* Saved Custom Theorems Collection List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  Saved Theorems Collection ({savedCustomTheorems.length}/
                  {MAX_CUSTOM_THEOREMS})
                </span>
                {savedCustomTheorems.length >= MAX_CUSTOM_THEOREMS && (
                  <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    Capacity Full ({MAX_CUSTOM_THEOREMS} max)
                  </span>
                )}
              </div>

              {savedCustomTheorems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">
                  No custom theorems saved yet. Enter a formula and click
                  &quot;Save Theorem&quot; to persist it locally.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {savedCustomTheorems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-zinc-200 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono truncate">
                          {item.formula}
                          {item.hypotheses && (
                            <span className="text-zinc-400 ml-2">
                              [{item.hypotheses}]
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadCustomTheoremItem(item)}
                          className="px-2 py-1 text-[11px] font-bold rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all"
                        >
                          Load Goal
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteTheorem(item.id, item.title)
                          }
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-all"
                          aria-label={`Delete ${item.title}`}
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preset Details */}
      <div className="text-xs text-zinc-400 flex items-center justify-between px-1">
        <span>
          Active:{" "}
          <strong className="text-zinc-200">{activeFormulaTitle}</strong>
        </span>
        {isComplete && (
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <IconSparkles className="w-3.5 h-3.5" />
            Sandbox simulation complete
          </span>
        )}
      </div>

      {/* Preset goals: RAM targets, this attempt, and the saved verified mark */}
      {activePreset && (
        <div
          data-testid="sandbox-goals"
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400"
        >
          <span className="tabular-nums">
            <span className="font-bold text-amber-300">Gold</span>: use{" "}
            {activePreset.goldRamBudget} GB or less ·{" "}
            <span className="font-bold text-zinc-200">Silver</span>:{" "}
            {activePreset.silverRamBudget} GB or less
          </span>
          <span
            data-testid="sandbox-ram-used"
            className="tabular-nums text-zinc-300"
          >
            This attempt: {ramUsed} GB
            {runMedal ? ` · ${MEDAL_LABEL[runMedal]}` : ""}
            {isComplete && usedSorry ? " · admitted with sorry, no medal" : ""}
          </span>
          <span
            data-testid="sandbox-verified"
            data-verified={activeRecord ? "true" : "false"}
            title="Proved without sorry in the local simulator. No Lean kernel check is run."
            className={`ml-auto flex items-center gap-1 font-bold ${
              activeRecord ? "text-emerald-400" : "text-zinc-400"
            }`}
          >
            {activeRecord ? (
              <>
                <IconCheck aria-hidden="true" className="w-3.5 h-3.5" />
                <span>
                  Verified · best {activeRecord.bestRamUsed} GB
                  {bestMedal ? ` (${MEDAL_LABEL[bestMedal]})` : ""}
                </span>
              </>
            ) : (
              <span>Not verified yet</span>
            )}
          </span>
        </div>
      )}

      {/* Main Canvas */}
      <ExpressionTree
        goalAST={currentGoal}
        hypotheses={currentHypotheses}
        selectedTargetId={selectedTargetId}
        hoveredTargetId={hoveredTargetId}
        onSelectTarget={(id) => {
          if (selectedTacticIndex !== null) {
            handleExecuteTactic(selectedTacticIndex, id);
          } else {
            setSelectedTargetId((prev) => (prev === id ? null : id));
          }
        }}
        onHoverTarget={setHoveredTargetId}
        isProofComplete={isComplete}
      />

      {/* Tactic Hand with all tactics */}
      <TacticHand
        availableTactics={allTacticIds}
        currentRam={999}
        selectedTacticIndex={selectedTacticIndex}
        onSelectTactic={(idx) => {
          if (selectedTargetId !== null) {
            handleExecuteTactic(idx, selectedTargetId);
          } else {
            setSelectedTacticIndex((prev) => (prev === idx ? null : idx));
          }
        }}
        onCardDragStart={(idx) => setSelectedTacticIndex(idx)}
        onCardDragEnd={(idx, event) => {
          const clientX =
            "clientX" in event
              ? event.clientX
              : (event as TouchEvent).changedTouches?.[0]?.clientX;
          const clientY =
            "clientY" in event
              ? event.clientY
              : (event as TouchEvent).changedTouches?.[0]?.clientY;

          if (typeof clientX === "number" && typeof clientY === "number") {
            const elementsUnderPoint = document.elementsFromPoint(
              clientX,
              clientY
            );
            let targetNodeId: string | null = null;
            for (const el of elementsUnderPoint) {
              if (!sandboxRef.current?.contains(el)) continue;
              const nodeId =
                el.getAttribute("data-node-id") ||
                el.closest("[data-node-id]")?.getAttribute("data-node-id");
              if (nodeId) {
                targetNodeId = nodeId;
                break;
              }
            }
            handleExecuteTactic(idx, targetNodeId);
          }
        }}
        isProofComplete={isComplete}
      />

      {/* Terminal Log */}
      <TerminalLog logs={logs} />
    </div>
  );
};
