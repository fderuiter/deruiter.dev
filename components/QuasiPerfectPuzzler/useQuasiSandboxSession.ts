"use client";

import React, { useCallback, useState, useSyncExternalStore } from "react";
import { ASTNode } from "@/lib/quasi-perfect/types";
import {
  SANDBOX_PRESETS,
  deleteCustomTheorem,
  exportCustomTheorems,
  gradeSandboxRun,
  importCustomTheorems,
  parseCustomTheorems,
  parseSandboxProgress,
  recordSandboxProof,
  saveCustomTheorem,
  type CustomTheorem,
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
import { CompilerLogEntry, TacticResult } from "@/lib/quasi-perfect/types";

const SANDBOX_STORAGE_KEY = "quasi_perfect_puzzler_sandbox_v1";
const CUSTOM_THEOREMS_STORAGE_KEY = "quasi_perfect_puzzler_custom_theorems_v1";
const STORAGE_UNAVAILABLE =
  "Browser storage is unavailable, so nothing was saved.";

// Same pattern as the campaign progress: other tabs fire "storage", writes in
// this tab go through lib/safe-storage, which fires STORAGE_CHANGE_EVENT.
function subscribeSandboxStorage(callback: () => void) {
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

function getCustomTheoremsSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return safeGetRawItem(CUSTOM_THEOREMS_STORAGE_KEY) || "[]";
}

function getCustomTheoremsServerSnapshot(): string {
  return "[]";
}

function readCustomTheorems(): CustomTheorem[] {
  return parseCustomTheorems(safeGetRawItem(CUSTOM_THEOREMS_STORAGE_KEY));
}

function writeCustomTheorems(theorems: CustomTheorem[]): boolean {
  return safeSetRawItem(CUSTOM_THEOREMS_STORAGE_KEY, JSON.stringify(theorems), {
    retainInMemory: false,
  });
}

// Saved entries were validated on save, but storage can be edited by hand.
function tryParseHypotheses(input: string): ASTNode[] | null {
  try {
    return parseHypotheses(input, "custom-hyp");
  } catch {
    return null;
  }
}

/**
 * The Quasi-Perfect Puzzler sandbox session (#3433): the preset or custom
 * goal, the formula being compiled, the armed tactic and target, the RAM
 * spent, saved proofs and custom theorems, and the log. Moved verbatim
 * from SandboxMode.tsx, which renders what it returns.
 */
export function useQuasiSandboxSession() {
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
  const [customTitleInput, setCustomTitleInput] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string>("");

  const [activeFormulaTitle, setActiveFormulaTitle] = useState<string>(
    SANDBOX_PRESETS[0].name
  );

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
    subscribeSandboxStorage,
    getSandboxSnapshot,
    getSandboxServerSnapshot
  );
  const sandboxProgress = parseSandboxProgress(rawSandboxProgress);
  const customTheorems = parseCustomTheorems(
    useSyncExternalStore(
      subscribeSandboxStorage,
      getCustomTheoremsSnapshot,
      getCustomTheoremsServerSnapshot
    )
  );

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

  const appendLogs = (type: CompilerLogEntry["type"], texts: string[]) => {
    setLogs((prev) => [
      ...prev,
      ...texts.map((text, i) => ({
        id: `log-${Date.now()}-${i}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type,
        text,
      })),
    ]);
  };

  const startCustomGoal = (
    goal: ASTNode,
    hypotheses: ASTNode[],
    title: string
  ) => {
    setSelectedPresetIdx(null);
    setActiveFormulaTitle(title);
    setCurrentGoal(goal);
    setCurrentHypotheses(hypotheses);
    setSelectedTargetId(null);
    setSelectedTacticIndex(null);
    setRamUsed(0);
    setUsedSorry(false);
  };

  const handleApplyCustomFormula = () => {
    if (!parseResult.ast || hypError) return;

    startCustomGoal(
      parseResult.ast,
      parsedHypothesesList,
      `Custom Formula: ${renderASTString(parseResult.ast)}`
    );

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
    const result = saveCustomTheorem(readCustomTheorems(), {
      title: customTitleInput,
      formula: customGoalInput,
      hypotheses: customHypothesesInput,
    });
    if (result.saved && !writeCustomTheorems(result.theorems)) {
      setSaveStatus(STORAGE_UNAVAILABLE);
      return;
    }
    setSaveStatus(result.message);
  };

  const handleLoadTheorem = (theorem: CustomTheorem) => {
    const goal = parseFormulaWithError(theorem.formula, "custom-goal").ast;
    const hypotheses = tryParseHypotheses(theorem.hypotheses);
    if (!goal || !hypotheses) {
      setSaveStatus(`"${theorem.title}" no longer parses and was not loaded.`);
      return;
    }
    setCustomGoalInput(theorem.formula);
    setCustomHypothesesInput(theorem.hypotheses);
    setCustomTitleInput(theorem.title);
    startCustomGoal(goal, hypotheses, `Custom: ${theorem.title}`);
    setSaveStatus("");
    appendLogs("info", [`Loaded saved theorem: ${theorem.title}`]);
  };

  const handleDeleteTheorem = (theorem: CustomTheorem) => {
    const next = deleteCustomTheorem(readCustomTheorems(), theorem.id);
    setSaveStatus(
      writeCustomTheorems(next)
        ? `Deleted "${theorem.title}".`
        : STORAGE_UNAVAILABLE
    );
  };

  const handleExportTheorems = () => {
    downloadFile(exportCustomTheorems(customTheorems), "custom_theorems.json", {
      mimeType: "application/json",
    });
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    input.value = "";

    const result = importCustomTheorems(readCustomTheorems(), text);
    if (result.error) {
      setImportStatus(`Import failed. ${result.error}`);
      return;
    }
    if (result.imported > 0 && !writeCustomTheorems(result.theorems)) {
      setImportStatus(STORAGE_UNAVAILABLE);
      return;
    }
    const skipped = result.warnings.length;
    setImportStatus(
      `Imported ${result.imported} theorem${result.imported === 1 ? "" : "s"}` +
        (skipped > 0
          ? `; ${skipped} skipped with warnings, listed in the log.`
          : ".")
    );
    appendLogs("warning", result.warnings);
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

  // The sandbox's intents (#3433): compile the custom formula into the goal,
  // and apply a tactic to a target.
  const compile = handleApplyCustomFormula;
  const apply = handleExecuteTactic;

  return {
    apply,
    compile,
    activeFormulaTitle,
    activePreset,
    activeRecord,
    allTacticIds,
    bestMedal,
    currentGoal,
    currentHypotheses,
    customGoalInput,
    customHypothesesInput,
    customTheorems,
    customTitleInput,
    handleApplyCustomFormula,
    handleDeleteTheorem,
    handleExecuteTactic,
    handleExportTheorems,
    handleImportFile,
    handleLoadTheorem,
    handleSaveTheorem,
    hoveredTargetId,
    hypError,
    importStatus,
    insertSymbol,
    isComplete,
    loadPreset,
    logs,
    parseResult,
    parsedHypothesesList,
    ramUsed,
    runMedal,
    sandboxProgress,
    saveStatus,
    selectedPresetIdx,
    selectedTacticIndex,
    selectedTargetId,
    setCustomGoalInput,
    setCustomHypothesesInput,
    setCustomTitleInput,
    setHoveredTargetId,
    setSelectedTacticIndex,
    setSelectedTargetId,
    usedSorry,
  };
}
