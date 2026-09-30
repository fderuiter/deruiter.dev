import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WorkflowWizardModal } from "@/components/crf/Wizard/WorkflowWizardModal";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import {
  evaluateAst,
  evaluateAstWithTrace,
  formatFormula,
  extractVariables,
  areAstsEqual,
  exportWorkspaceProof,
  PropAst,
} from "@/lib/proof-utils";
import {
  evaluateFormula,
  evaluateCondition,
  evaluateRule,
  isMissingOrNullFlavor,
  ExpressionEvaluator,
  tokenizeWithSpans,
} from "@/lib/crf/ast-evaluator";
import { CRFField, CRFForm, StudyProtocol } from "@/lib/crf/types";
import {
  getTacticBlock,
  mergeLevelScore,
  parseGameProgress,
  puzzleLevels,
  resolveResumeLevelIndex,
  tacticDefs,
  type ASTNode,
  type LevelScore,
} from "@/lib/quasi-perfect";
import { computeFormHealthMetrics } from "@/lib/crf/form-health";
import {
  LOON_MAX_HITS,
  resolveLoonCollision,
  type Target as LoonTarget,
} from "@/lib/laser-loon";
import { autoFixAllViolations } from "@/lib/crf/cdisc-conformance-linter";
import {
  createInitialState,
  updateGameSimulation,
  jettisonOldestVariable,
  triggerGarbageCollection,
  allocateVariable,
  wipeScreenFog,
  startGame,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  clampBounds,
  createInitialDuckGameState,
  dragDuckTo,
  stepDuckGame,
  performTrick,
  activeCodeBurst,
  advanceToNextLevel,
  shouldSyncDuckHudState,
  giveTreat,
  startDraggingDuck,
  releaseDuck,
  enterDogPark,
  BACK_DOOR_BOUNDS,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { sanitizeError, sanitizeString } from "@/lib/error-sanitization";
import { evaluateCanaryRollout } from "@/scripts/canary-analyzer";
import { CaseStudyService } from "@/lib/services/case-study-service";
import {
  exportToCDISCODMXML,
  generateSDTMDataset,
} from "@/lib/clinical-trial-chaos/engine";
import { ClinicalSubject } from "@/lib/clinical-trial-chaos/types";
import { exportStudyToCdiscOdmXml } from "@/lib/crf";
import { generateStudyPdf } from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { exportStudyToSas } from "@/lib/crf/export-sas";
import { evaluateQAMetrics } from "@/lib/neuro/qa-engine";
import { SCENARIOS } from "@/lib/neuro/scenarios";
import {
  generateSyntheticVolume,
  getIndex,
} from "@/lib/neuro/volume-generator";
import { createNearFooterSectionStudy } from "./crf/pdf-export-fixtures";
import { resolveSnippetTerminology } from "@/components/ProjectTeaserGrid";
import { TelemetryService, _testCache } from "@/lib/services/telemetry-service";
import { NextRequest } from "next/server";
import { calculateFOV } from "@/lib/dungeon";

describe("Defect Remediation & Regression Verification Suite (Invariant #11)", () => {
  describe("Dungeon FOV sparse-matrix fallback", () => {
    it("rebuilds unexplored state instead of throwing on a sparse outer matrix", () => {
      const grid = Array.from({ length: 3 }, () => [" ", " ", " "]);
      const sparseExplored = new Array<boolean[]>(3);
      sparseExplored[0] = [true, true, true];
      sparseExplored[2] = [true, true, true];

      expect(calculateFOV(grid, 1, 1, 0, sparseExplored).explored).toEqual([
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ]);
    });
  });

  describe("Proof AST Solver Resilience & Deep Recursion Guards", () => {
    it("safely evaluates deep AST trees without call stack overflow", () => {
      // Build a nested NOT chain of depth 150
      let ast: PropAst = { type: "var", name: "P" };
      for (let i = 0; i < 150; i++) {
        ast = { type: "not", operand: ast };
      }

      const envTrue = { P: true };
      const envFalse = { P: false };

      expect(evaluateAst(ast, envTrue)).toBe(true);
      expect(evaluateAst(ast, envFalse)).toBe(false);

      const vars = extractVariables(ast);
      expect(vars).toEqual(["P"]);

      const formatted = formatFormula(ast);
      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(100);
    });

    it("handles nullish, empty, or malformed AST nodes gracefully", () => {
      expect(evaluateAst(fromAny(null), {})).toBe(false);
      expect(evaluateAst(fromAny(undefined), {})).toBe(false);
      expect(formatFormula(fromAny(null))).toBe("");
      expect(extractVariables(fromAny(null))).toEqual([]);
      expect(areAstsEqual(null, null)).toBe(false);
      expect(areAstsEqual(undefined, { type: "var", name: "A" })).toBe(false);
    });

    it("produces valid hierarchical traces on complex logical formulas", () => {
      const ast: PropAst = {
        type: "implies",
        left: {
          type: "and",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
        right: {
          type: "or",
          left: { type: "var", name: "R" },
          right: { type: "var", name: "S" },
        },
      };

      const trace = evaluateAstWithTrace(ast, {
        P: true,
        Q: true,
        R: false,
        S: true,
      });
      expect(trace.value).toBe(true);
      expect(trace.operator).toBe("→");
      expect(trace.children).toBeDefined();
      expect(trace.children?.length).toBe(2);
    });
  });

  describe("CRF Clinical AST Evaluator & Arithmetic Guards", () => {
    const mockFields: CRFField[] = [
      {
        id: "f1",
        variableName: "HEIGHT",
        label: "Height (cm)",
        dataType: "number",
        columnSpan: 6,
        required: true,
      },
      {
        id: "f2",
        variableName: "WEIGHT",
        label: "Weight (kg)",
        dataType: "number",
        columnSpan: 6,
        required: true,
      },
      {
        id: "f3",
        variableName: "ZERO_DIV",
        label: "Zero Field",
        dataType: "number",
        columnSpan: 6,
        required: false,
      },
    ];

    it("safely resolves dynamic division by zero returning explicit null instead of NaN or Infinity", () => {
      // BMI formula: WEIGHT / ((HEIGHT / 100) ^ 2)
      // If HEIGHT is 0
      const resultZeroHeight = evaluateFormula(
        "WEIGHT / ((HEIGHT / 100) ^ 2)",
        { HEIGHT: 0, WEIGHT: 70 },
        mockFields
      );
      expect(resultZeroHeight).toBeNull();

      // Direct division by zero in expression
      const resultDivZero = evaluateFormula(
        "100 / ZERO_DIV",
        { ZERO_DIV: 0 },
        mockFields
      );
      expect(resultDivZero).toBeNull();
    });

    it("handles empty function arguments in min/max returning null without throwing", () => {
      const evaluator = new ExpressionEvaluator(
        [
          { type: "IDENTIFIER", value: "max" },
          { type: "LPAREN", value: "(" },
          { type: "RPAREN", value: ")" },
        ],
        {}
      );
      const res = evaluator.parse();
      expect(res).toBeNull();

      const minEvaluator = new ExpressionEvaluator(
        [
          { type: "IDENTIFIER", value: "min" },
          { type: "LPAREN", value: "(" },
          { type: "RPAREN", value: ")" },
        ],
        {}
      );
      const minRes = minEvaluator.parse();
      expect(minRes).toBeNull();
    });

    it("handles token spans and diagnostics for malformed clinical formulas", () => {
      const tokens = tokenizeWithSpans(
        "round(sqrt(HEIGHT * WEIGHT) / 3600, 2)"
      );
      expect(tokens.length).toBeGreaterThan(5);
      expect(tokens[0].value).toBe("round");
    });

    it("prevents coercive conversion of uncollected and CDISC null flavor fields to zero during condition matching and calculation", () => {
      // 0. Guard function detects CDISC null flavors and missing values
      expect(isMissingOrNullFlavor("ND")).toBe(true);
      expect(isMissingOrNullFlavor(null)).toBe(true);
      expect(isMissingOrNullFlavor(0)).toBe(false);

      // 1. Relational comparisons with missing / null flavor values must evaluate to false
      expect(
        evaluateCondition(
          { fieldId: "f1", operator: "gt", value: 100 },
          { f1: "ND" },
          mockFields
        )
      ).toBe(false);
      expect(
        evaluateCondition(
          { fieldId: "f1", operator: "gte", value: 0 },
          { f1: null },
          mockFields
        )
      ).toBe(false);
      expect(
        evaluateCondition(
          { fieldId: "f1", operator: "lt", value: 50 },
          { f1: "UNK" },
          mockFields
        )
      ).toBe(false);
      expect(
        evaluateCondition(
          { fieldId: "f1", operator: "lte", value: 10 },
          { f1: "" },
          mockFields
        )
      ).toBe(false);

      // 2. Calculations with missing / null flavor inputs must safely return null
      expect(
        evaluateFormula(
          "HEIGHT + WEIGHT",
          { HEIGHT: 180, WEIGHT: "ND" },
          mockFields
        )
      ).toBeNull();
      expect(
        evaluateFormula(
          "HEIGHT - WEIGHT",
          { HEIGHT: "NA", WEIGHT: 70 },
          mockFields
        )
      ).toBeNull();

      // 3. Edit check rules pass without triggering false-positive queries when dependent fields contain null flavors
      const nullFlavorRule = {
        id: "rule_null_flavor",
        name: "Null Flavor Rule",
        description: "Rule check",
        triggerFieldIds: ["f1"],
        actionType: "raise_query" as const,
        targetFieldId: "f1",
        logicalOperator: "AND" as const,
        conditions: [{ fieldId: "f1", operator: "gt" as const, value: 0 }],
      };
      expect(evaluateRule(nullFlavorRule, { f1: "ND" }, mockFields)).toBe(
        false
      );

      // 4. Valid numeric zero must continue to evaluate correctly
      expect(
        evaluateCondition(
          { fieldId: "f1", operator: "gte", value: 0 },
          { f1: 0 },
          mockFields
        )
      ).toBe(true);
      expect(evaluateFormula("HEIGHT + 10", { HEIGHT: 0 }, mockFields)).toBe(
        10
      );
    });
  });

  describe("Garmin Connect IQ Simulation & Telemetry Boundaries", () => {
    it("handles zero, negative, or NaN deltaMs ticks without state corruption", () => {
      const initial = createInitialState("fenix");
      const playing = { ...initial, gameState: "playing" as const };

      const stepZero = updateGameSimulation(playing, 0);
      expect(stepZero.distanceMeters).toBe(0);
      expect(Number.isFinite(stepZero.battery)).toBe(true);

      const stepNaN = updateGameSimulation(playing, NaN);
      expect(Number.isFinite(stepNaN.distanceMeters)).toBe(true);
      expect(Number.isFinite(stepNaN.battery)).toBe(true);

      const stepNeg = updateGameSimulation(playing, -50);
      expect(Number.isFinite(stepNeg.distanceMeters)).toBe(true);
    });

    it("drains the battery with the backlight off instead of rounding each frame's drain away (#1308)", () => {
      let state: GameEngineState = {
        ...createInitialState("fenix"),
        gameState: "playing",
        isLightOn: false,
      };
      for (let frame = 0; frame < 600; frame++) {
        state = { ...updateGameSimulation(state, 1000 / 60), obstacles: [] };
      }
      // 10 s at 0.1%/s
      expect(state.battery).toBeLessThan(99.5);
      expect(state.battery).toBeGreaterThan(98.5);
    });

    it("maintains non-negative RAM bounds and consistent heap allocations under memory pressure", () => {
      const initial = createInitialState("fenix");
      const playing = { ...initial, gameState: "playing" as const };

      const { state: afterJettison } = jettisonOldestVariable(playing);
      expect(afterJettison.allocatedRamKb).toBeGreaterThanOrEqual(0.2);

      const loaded = allocateVariable(playing, "array", "tmp").state;
      const { state: afterGc, freedKb } = triggerGarbageCollection(loaded);
      expect(afterGc.isGcActive).toBe(true);
      expect(freedKb).toBeGreaterThan(0);
      expect(afterGc.allocatedRamKb).toBeGreaterThanOrEqual(0.4);

      const { state: allocState } = allocateVariable(
        playing,
        "string",
        "testVar"
      );
      expect(allocState.allocatedRamKb).toBeGreaterThan(playing.allocatedRamKb);
    });
  });

  describe("Garmin point farming (#1213)", () => {
    const fresh = (): GameEngineState => ({
      ...createInitialState("fenix"),
      gameState: "playing" as const,
    });

    it("never jettisons required app state and awards nothing for a no-op", () => {
      const start = fresh();
      const res = jettisonOldestVariable(start);
      expect(res.popped).toBeUndefined();
      expect(res.state.variables).toEqual(start.variables);
      expect(res.state.score).toBe(0);
      expect(res.reason).toBeTruthy();
      expect(res.state.variables.map((v) => v.name)).toEqual([
        "appCtx",
        "displayGfx",
      ]);
    });

    it("gives no score, freeze, or memory change for empty-heap GC, even repeated", () => {
      let state = fresh();
      for (let i = 0; i < 5; i++) {
        const res = triggerGarbageCollection(state);
        expect(res.freedKb).toBe(0);
        expect(res.state.isGcActive).toBe(false);
        expect(res.state.gcTimerMs).toBe(0);
        expect(res.reason).toBeTruthy();
        state = res.state;
      }
      expect(state.score).toBe(0);
      expect(state.variables).toHaveLength(2);
    });

    it("rewards jettison and GC only when garbage was actually reclaimed", () => {
      const loaded = allocateVariable(fresh(), "string", "tmp").state;
      const j = jettisonOldestVariable(loaded);
      expect(j.popped?.name).toBe("tmp");
      expect(j.state.score).toBeGreaterThan(0);

      const g = triggerGarbageCollection(loaded);
      expect(g.freedKb).toBeGreaterThan(0);
      expect(g.state.isGcActive).toBe(true);
      expect(g.state.score).toBeGreaterThan(0);
      expect(g.state.variables.map((v) => v.name)).toEqual([
        "appCtx",
        "displayGfx",
      ]);

      // A second GC once the heap is clean is a no-op again
      const again = triggerGarbageCollection({
        ...g.state,
        isGcActive: false,
        gcTimerMs: 0,
      });
      expect(again.freedKb).toBe(0);
      expect(again.state.score).toBe(g.state.score);
    });
  });

  describe("Working With Duck Deterministic State Machine Hardening", () => {
    it("clampBounds safely recovers from NaN or undefined coordinate inputs", () => {
      const boundedNaN = clampBounds(NaN, NaN);
      expect(Number.isFinite(boundedNaN.x)).toBe(true);
      expect(Number.isFinite(boundedNaN.y)).toBe(true);

      const boundedUndef = clampBounds(fromAny(undefined), fromAny(null));
      expect(Number.isFinite(boundedUndef.x)).toBe(true);
      expect(Number.isFinite(boundedUndef.y)).toBe(true);
    });

    it("dragDuckTo retains finite coordinates when given out-of-bounds or invalid numbers", () => {
      const initial = createInitialDuckGameState(1);
      const dragged = dragDuckTo(initial, 99999, -5000);
      expect(dragged.duck.x).toBeLessThanOrEqual(800 - 40);
      expect(dragged.duck.y).toBeGreaterThanOrEqual(40);

      const draggedNaN = dragDuckTo(initial, NaN, NaN);
      expect(Number.isFinite(draggedNaN.duck.x)).toBe(true);
      expect(Number.isFinite(draggedNaN.duck.y)).toBe(true);
    });

    it("stepDuckGame and performTrick maintain state determinism under repeated actions", () => {
      let state = createInitialDuckGameState(1);
      state = { ...state, status: "running" };

      for (let i = 0; i < 60; i++) {
        state = stepDuckGame(state);
      }
      expect(state.ticks).toBe(60);
      expect(Number.isFinite(state.workProgress)).toBe(true);
      expect(Number.isFinite(state.naughtyVsGood)).toBe(true);

      const trickState = performTrick(state, "SIT");
      expect(trickState.duck.state).toBe("PERFORMING_TRICK");
    });

    it("advanceToNextLevel resumes a running simulation instead of leaving the next sprint idle (#598 D02)", () => {
      // Pre-fix, advanceToNextLevel delegated to createInitialDuckGameState,
      // whose default "idle" status made stepDuckGame's `status !== "running"`
      // guard silently discard every subsequent tick after Proceed/Retry.
      let state = createInitialDuckGameState(1, "campaign");
      state = { ...state, status: "won" };

      const advanced = advanceToNextLevel(state);
      expect(advanced.status).toBe("running");

      const stepped = stepDuckGame(advanced);
      expect(stepped.ticks).toBe(1);
      expect(stepped.workProgress).toBeGreaterThan(0);

      // The final-sprint-to-endless handoff shares the same code path.
      const endless = advanceToNextLevel({
        ...advanced,
        currentLevel: 5,
        status: "won",
      });
      expect(endless.mode).toBe("endless");
      expect(endless.status).toBe("running");
      expect(stepDuckGame(endless).ticks).toBe(1);
    });

    // #1550: Zoomies and Potty preempted each other every tick when both
    // meters were full, so neither timer counted down and the game froze.
    it("full Excitement and Bladder no longer deadlock the urgent-state triggers (#1550)", () => {
      let state: WorkingWithDuckState = {
        ...createInitialDuckGameState(1, "campaign"),
        status: "running",
        excitement: 100,
        bladder: 100,
      };
      const countdowns: number[] = [];
      for (let tick = 0; tick < 5; tick++) {
        state = stepDuckGame(state);
        countdowns.push(state.duck.sniffCountdown);
      }
      expect(state.duck.state).toBe("SNIFFING_POTTY");
      expect(countdowns[4]).toBeLessThan(countdowns[0]);
    });

    // #1307: holding a trick key finished Sprint 1 in about 12 s for 45,000
    // points, and mashing Space finished it in about 7 s.
    it("trick spam neither finishes a sprint nor farms points (#1307)", () => {
      let state: WorkingWithDuckState = {
        ...createInitialDuckGameState(1, "campaign"),
        status: "running",
      };
      for (let tick = 0; tick < 60 * 30; tick++) {
        if (tick % 15 === 0) state = performTrick(state, "HIGH_FIVE");
        state = stepDuckGame(state);
      }
      expect(state.status).toBe("running");
      expect(state.workProgress).toBeLessThan(state.targetWorkProgress / 2);
      expect(state.totalScore).toBeLessThan(2000);
    });

    it("ignores a second trick until Duck finishes the first, and tricks that don't fit an emergency (#1307)", () => {
      const running: WorkingWithDuckState = {
        ...createInitialDuckGameState(1, "campaign"),
        status: "running",
        excitement: 90,
      };
      const tricked = performTrick(running, "SIT");
      expect(performTrick(tricked, "SPIN")).toBe(tricked);

      // A trick that doesn't fit leaves Duck alone and shows a hint instead.
      const expectHintOnly = (
        state: typeof running,
        trick: Parameters<typeof performTrick>[1]
      ) => {
        const next = performTrick(state, trick);
        expect(next.duck).toBe(state.duck);
        expect(next.totalScore).toBe(state.totalScore);
        expect(next.comboStreak).toBe(state.comboStreak);
        expect(next.floatingAlerts.length).toBe(
          state.floatingAlerts.length + 1
        );
        // Pressing again doesn't stack a second copy of the hint.
        expect(performTrick(next, trick)).toBe(next);
      };
      expectHintOnly(
        {
          ...running,
          duck: { ...running.duck, state: "SNIFFING_POTTY" as const },
        },
        "SIT"
      );
      const chewing = {
        ...running,
        duck: { ...running.duck, state: "SNEAKY_CHEW" as const },
      };
      expectHintOnly(chewing, "SPIN");
      expect(performTrick(chewing, "DROP_IT").duck.state).toBe(
        "PERFORMING_TRICK"
      );
      expectHintOnly(running, "DROP_IT");
    });

    it("caps a trick's combo score bonus at 3x (#1307)", () => {
      const state = {
        ...createInitialDuckGameState(1, "campaign"),
        status: "running" as const,
        excitement: 90,
        comboStreak: 20,
      };
      const next = performTrick(state, "HIGH_FIVE");
      expect(next.totalScore - state.totalScore).toBe(45 * 3);
    });

    it("rate-limits code bursts and blocks them during an emergency (#1307)", () => {
      let state: WorkingWithDuckState = {
        ...createInitialDuckGameState(1, "campaign"),
        status: "running",
      };
      for (let tick = 0; tick < 60; tick++) {
        state = activeCodeBurst(state);
        state = { ...state, ticks: state.ticks + 1 };
      }
      expect(state.activeCodeBursts).toBeLessThanOrEqual(6);

      const chewing = {
        ...state,
        ticks: state.ticks + 60,
        duck: { ...state.duck, state: "SNEAKY_CHEW" as const },
      };
      expect(activeCodeBurst(chewing)).toBe(chewing);
    });

    it("shouldSyncDuckHudState always flushes terminal win/fail frames regardless of tick remainder (#598 D01)", () => {
      // Pre-fix, the component's canvas loop only synced React UI state every
      // 4th tick, so a win/fail landing on remainder 1-3 never rendered its
      // victory/failure panel even though the engine had already terminated.
      for (let remainder = 0; remainder < 4; remainder++) {
        const running = {
          ...createInitialDuckGameState(1, "campaign"),
          status: "running" as const,
          ticks: remainder,
        };
        expect(shouldSyncDuckHudState({ ...running, status: "won" })).toBe(
          true
        );
        expect(shouldSyncDuckHudState({ ...running, status: "failed" })).toBe(
          true
        );
      }
      expect(
        shouldSyncDuckHudState({
          ...createInitialDuckGameState(1, "campaign"),
          status: "running",
          ticks: 1,
        })
      ).toBe(false);
    });
  });

  describe("Production Error Sanitizer & Security Boundaries", () => {
    it("scrubs nested system paths and cause chains", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          "production";

        const rawMessage =
          "Failed loading file /Users/fred/Code/portfolio/lib/db.ts: connect ECONNREFUSED";
        const sanitizedStr = sanitizeString(rawMessage);
        expect(sanitizedStr).not.toContain("/Users/fred");
        expect(sanitizedStr).toContain("[scrubbed]");

        const rootError = new Error("Database error at /app/server/secret.key");
        const wrappedError = new Error(
          "Top level failure at /home/ubuntu/app/server.ts"
        );
        wrappedError.cause = rootError;

        const sanitized = sanitizeError(wrappedError) as Error & {
          cause?: unknown;
        };
        expect(sanitized.message).not.toContain("/home/ubuntu");
        expect(sanitized.cause).toBeDefined();
        expect((sanitized.cause as Error).message).not.toContain("/app/server");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          originalNodeEnv;
      }
    });
  });

  describe("Workflow Onboarding Wizard Focus and Keyboard Navigation (Acceptance Criteria)", () => {
    let container: HTMLDivElement;
    let root: Root;
    let mockBtn: HTMLButtonElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);

      // Create initiating element to receive focus on return
      mockBtn = document.createElement("button");
      mockBtn.id = "initiator-btn";
      document.body.appendChild(mockBtn);
      mockBtn.focus();

      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root?.unmount();
      });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      if (mockBtn.parentNode) {
        document.body.removeChild(mockBtn);
      }
    });

    it("traps focus and restores focus to initiating element upon Esc press", async () => {
      const handleClose = vi.fn();
      await act(async () => {
        root.render(
          React.createElement(WorkflowWizardModal, {
            isOpen: true,
            onClose: handleClose,
            onSwitchMode: vi.fn(),
            onStartSpotlightTour: vi.fn(),
          })
        );
      });

      // Initially focus should be on something inside the modal
      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(dialog).toBeDefined();

      // Trigger Escape keydown on the dialog container
      await act(async () => {
        const escEvent = new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        });
        dialog.dispatchEvent(escEvent);
      });

      expect(handleClose).toHaveBeenCalled();
    });

    it("navigates wizard stages on arrow keys when focused inside, but not on input fields", async () => {
      await act(async () => {
        root.render(
          React.createElement(WorkflowWizardModal, {
            isOpen: true,
            onClose: vi.fn(),
            onSwitchMode: vi.fn(),
            onStartSpotlightTour: vi.fn(),
          })
        );
      });

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(container.textContent).toContain("Stage 1 of 5");

      // Dispatch ArrowRight keydown
      await act(async () => {
        const arrowRight = new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
        });
        dialog.dispatchEvent(arrowRight);
      });
      expect(container.textContent).toContain("Stage 2 of 5");

      // Dispatch ArrowLeft keydown
      await act(async () => {
        const arrowLeft = new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
        });
        dialog.dispatchEvent(arrowLeft);
      });
      expect(container.textContent).toContain("Stage 1 of 5");

      // Now create and focus a text input inside the body to simulate user focusing an input inside the dialog
      const input = document.createElement("input");
      input.type = "text";
      dialog.appendChild(input);
      input.focus();

      // Dispatch ArrowRight keydown from inside the text input
      await act(async () => {
        const arrowRight = new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
        });
        input.dispatchEvent(arrowRight);
      });
      // The stage should NOT change because focus is on an input
      expect(container.textContent).toContain("Stage 1 of 5");

      // Clean up input
      dialog.removeChild(input);
    });
  });

  describe("Automated Canary Analysis Rate Normalization & Window Mismatch Guards", () => {
    it("prevents false-positive approval when canary has fewer total exceptions but higher rate over shorter window", () => {
      const evaluation = evaluateCanaryRollout(
        {
          totalRequests: 10000,
          serverErrors5xx: 0,
          p95LatencyMs: 120,
          sentryExceptionCount: 8, // 8 exceptions in 10 mins = 0.8/min
          windowDurationMinutes: 10,
        },
        {
          totalRequests: 60000,
          serverErrors5xx: 0,
          p95LatencyMs: 120,
          sentryExceptionCount: 15, // 15 exceptions in 60 mins = 0.25/min
          windowDurationMinutes: 60,
        }
      );

      // Raw counts: 8 < 15, but per-min rate: 0.8 / 0.25 = 3.2x > 2.0x threshold
      expect(evaluation.decision).toBe("ROLLBACK_REQUIRED");
      expect(evaluation.rollbackTriggered).toBe(true);
      expect(evaluation.canaryMetrics.exceptionRatePerMinute).toBe(0.8);
      expect(evaluation.baselineMetrics?.exceptionRatePerMinute).toBe(0.25);
      expect(evaluation.metricsComparison.exceptionRatio).toBe(3.2);
    });
  });

  describe("DOM Boundary Attribute Guarding (Requirement 1-4)", () => {
    it("prevents global manual help shortcuts ('h', '?') when target is inside a keyboard boundary container", () => {
      let isManualTriggered = false;

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          !target ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest?.("[data-keyboard-boundary]")
        ) {
          return;
        }

        if (e.key === "?" || e.key === "h") {
          isManualTriggered = true;
        }
      };

      const containerBoundary = document.createElement("div");
      containerBoundary.setAttribute("data-keyboard-boundary", "true");
      const innerCanvasControl = document.createElement("button");
      containerBoundary.appendChild(innerCanvasControl);
      document.body.appendChild(containerBoundary);

      // Event target inside simulator boundary
      const eventInside = new KeyboardEvent("keydown", {
        key: "?",
        bubbles: true,
      });
      innerCanvasControl.dispatchEvent(eventInside);
      handleGlobalKeyDown(eventInside);

      expect(isManualTriggered).toBe(false);

      // Event target outside boundary
      const outsideButton = document.createElement("button");
      document.body.appendChild(outsideButton);
      const eventOutside = new KeyboardEvent("keydown", {
        key: "?",
        bubbles: true,
      });
      outsideButton.dispatchEvent(eventOutside);
      handleGlobalKeyDown(eventOutside);

      expect(isManualTriggered).toBe(true);

      document.body.removeChild(containerBoundary);
      document.body.removeChild(outsideButton);
    });

    it("prevents global tool switches and snapping toggles when target is inside a keyboard boundary container", () => {
      let isSnappingToggled = false;
      let isToolSwitched = false;

      const handleProofKeyDown = (e: KeyboardEvent) => {
        const targetEl = e.target as HTMLElement | null;
        const targetTag = targetEl?.tagName?.toLowerCase();
        if (
          targetTag === "input" ||
          targetTag === "textarea" ||
          targetEl?.isContentEditable ||
          targetEl?.closest?.("[data-keyboard-boundary]")
        ) {
          return;
        }
        if (e.key === "g" || e.key === "G") {
          isSnappingToggled = true;
        }
      };

      const handleNeuroKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          !target ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest?.("[data-keyboard-boundary]")
        ) {
          return;
        }
        if (e.key === "1" || e.key === "2") {
          isToolSwitched = true;
        }
      };

      const simulatorBoundary = document.createElement("div");
      simulatorBoundary.setAttribute("data-keyboard-boundary", "true");
      const canvasTarget = document.createElement("div");
      canvasTarget.tabIndex = 0;
      simulatorBoundary.appendChild(canvasTarget);
      document.body.appendChild(simulatorBoundary);

      const eventG = new KeyboardEvent("keydown", { key: "g", bubbles: true });
      canvasTarget.dispatchEvent(eventG);
      handleProofKeyDown(eventG);
      expect(isSnappingToggled).toBe(false);

      const event1 = new KeyboardEvent("keydown", { key: "1", bubbles: true });
      canvasTarget.dispatchEvent(event1);
      handleNeuroKeyDown(event1);
      expect(isToolSwitched).toBe(false);

      document.body.removeChild(simulatorBoundary);
    });
  });

  describe("Case Study Serverless Prerender Resilience & Fallback Invariant", () => {
    it("safely retrieves static case studies when serverless database is missing records or offline", async () => {
      const study = await CaseStudyService.getCaseStudyBySlug("laser-loon");
      expect(study).not.toBeNull();
      expect(study?.slug).toBe("laser-loon");
      expect(study?.title).toContain("Laser Loon");

      const allStudies = await CaseStudyService.getAllPublishedCaseStudies();
      expect(allStudies.length).toBeGreaterThan(0);
      expect(allStudies.some((s) => s.slug === "laser-loon")).toBe(true);

      const allSlugs = await CaseStudyService.getAllPublishedSlugs();
      expect(allSlugs).toContain("laser-loon");
    });
  });

  describe("CDISC Auto-Fix Cryptographic UUID Identifier Generation (Targeted UUID Autofix Repair)", () => {
    it("ensures batch auto-fix generates unique cryptographic UUID identifiers across synchronous execution loops", () => {
      const mockProtocol: StudyProtocol = {
        id: "study_test_autofix",
        studyName: "Test Protocol",
        sponsor: "Test Pharma",
        therapeuticArea: "Oncology",
        phase: "Phase I",
        protocolNumber: "PROTOCOL-001",
        version: "1.0",
        lastModified: "2026-08-20",
        codelists: [],
        branding: {
          primaryColor: "#000000",
          accentColor: "#000000",
          organizationName: "Test Pharma",
          footerText: "Confidential",
        },
        forms: [
          {
            id: "form_demographics_empty",
            name: "Demographics",
            domain: "DM",
            description: "Demographics domain missing all core variables",
            version: "1.0",
            rules: [],
            sections: [],
          },
          {
            id: "form_vitals_empty",
            name: "Vital Signs",
            domain: "VS",
            description: "Vital signs domain missing all core variables",
            version: "1.0",
            rules: [],
            sections: [],
          },
        ],
        visits: [
          {
            id: "v1",
            oid: "SE.V1",
            name: "Screening",
            visitType: "Scheduled",
            targetDay: 0,
            windowBefore: 0,
            windowAfter: 0,
            assignedFormIds: ["form_demographics_empty", "form_vitals_empty"],
          },
        ],
      };

      const { updatedStudy, fixedCount } = autoFixAllViolations(mockProtocol);
      expect(fixedCount).toBeGreaterThan(0);

      const generatedFieldIds = updatedStudy.forms
        .flatMap((f) => f.sections)
        .flatMap((s) => s.fields)
        .map((f) => f.id);

      const generatedSectionIds = updatedStudy.forms
        .flatMap((f) => f.sections)
        .map((s) => s.id);

      // Verify no duplicate field or section IDs exist
      const uniqueFieldIds = new Set(generatedFieldIds);
      const uniqueSectionIds = new Set(generatedSectionIds);

      expect(uniqueFieldIds.size).toBe(generatedFieldIds.length);
      expect(uniqueSectionIds.size).toBe(generatedSectionIds.length);

      // Verify high-entropy UUID format
      const uuidPattern =
        /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
      generatedFieldIds.forEach((id) => {
        expect(id).toMatch(uuidPattern);
      });
      generatedSectionIds.forEach((id) => {
        expect(id).toMatch(uuidPattern);
      });
    });
  });

  describe("RetroLabyrinth Canvas Loop Pathfinding Memoization", () => {
    it("ensures Traveling Salesman pathfinding tour calculation is memoized at component level", () => {
      const retroLabyrinthPath = path.resolve(
        __dirname,
        "../components/RetroLabyrinth.tsx"
      );
      const code = fs.readFileSync(retroLabyrinthPath, "utf-8");

      expect(code).toContain("useMemo");
      expect(code).toContain("const tspTour = useMemo(");
      expect(code).toContain("computeShortestTour(");
      expect(code).toContain("tspTour,");

      // Verify computeShortestTour is not invoked inside the real-time canvas drawing loop
      const loopStart = code.indexOf(
        "useAnimationFrame(",
        code.indexOf("// Main Real-Time Game Loop")
      );
      const loopEnd = code.indexOf("isActive: isLoopActive", loopStart);
      expect(loopStart).toBeGreaterThan(-1);
      expect(loopEnd).toBeGreaterThan(loopStart);
      const loopBody = code.slice(loopStart, loopEnd);

      expect(loopBody).not.toContain("computeShortestTour(");
      expect(loopBody).toContain("tspTour");
    });
  });

  describe("CDISC ODM XML Subject Matching & Attribute Escaping Protocol (Requirement 1-4)", () => {
    it("guarantees complete subject record isolation without substring data leaks across subject IDs", () => {
      const subj1: ClinicalSubject = {
        id: "s-1",
        subjectLabel: "1",
        studySite: "Site 001 (Main)",
        observations: [
          {
            id: "o-1",
            field: "Weight",
            rawValue: "70",
            currentValue: "70 kg",
            destination: "VS",
            isResolved: true,
          },
        ],
        status: "submitted",
        timeRemaining: 30,
        maxTime: 30,
        createdAt: 1000,
      };

      const subj10: ClinicalSubject = {
        id: "s-10",
        subjectLabel: "10",
        studySite: "Site 001 (Main)",
        observations: [
          {
            id: "o-10",
            field: "Weight",
            rawValue: "85",
            currentValue: "85 kg (subj 10 data)",
            destination: "VS",
            isResolved: true,
          },
        ],
        status: "submitted",
        timeRemaining: 30,
        maxTime: 30,
        createdAt: 1000,
      };

      const subj11: ClinicalSubject = {
        id: "s-11",
        subjectLabel: "11",
        studySite: "Site 001 (Main)",
        observations: [
          {
            id: "o-11",
            field: "Weight",
            rawValue: "92",
            currentValue: "92 kg (subj 11 data)",
            destination: "VS",
            isResolved: true,
          },
        ],
        status: "submitted",
        timeRemaining: 30,
        maxTime: 30,
        createdAt: 1000,
      };

      const sdtmDataset = generateSDTMDataset([subj1, subj10, subj11]);
      const xmlSubj1 = exportToCDISCODMXML([subj1], sdtmDataset);

      expect(xmlSubj1).toContain('SubjectKey="1"');
      expect(xmlSubj1).toContain("70 kg");
      expect(xmlSubj1).not.toContain("85 kg (subj 10 data)");
      expect(xmlSubj1).not.toContain("92 kg (subj 11 data)");
    });

    it("guarantees 100% valid XML entity escaping across exported attributes containing reserved XML characters", () => {
      const specialStudy = {
        ...ONCOLOGY_RECIST_PRESET,
        protocolNumber: 'P&1<2>"3"',
        version: 'v&1"2"',
        visits: [
          {
            id: "v_&1<2>",
            oid: "SE.VIS&1<2>",
            name: "Visit &1",
            visitType: "Scheduled" as const,
            targetDay: 1,
            windowBefore: 0,
            windowAfter: 0,
            assignedFormIds: ["f_&1<2>"],
          },
        ],
        forms: [
          {
            id: "f_&1<2>",
            name: "Form &1",
            description: "Special test form",
            domain: "DM&LB",
            version: "1.0",
            rules: [],
            sections: [
              {
                id: "sec_&1",
                title: "Section &1",
                fields: [
                  {
                    id: "field_&1",
                    variableName: 'VAR_&1<2>"3"',
                    label: "Label &1 <2>",
                    dataType: "text" as const,
                    columnSpan: 6,
                    required: true,
                    codelistId: "CL_&1",
                  },
                ],
              },
            ],
          },
        ],
      };

      const xml = exportStudyToCdiscOdmXml(specialStudy);

      expect(xml).toContain('FileOID="ODM.P&amp;1&lt;2&gt;&quot;3&quot;.');
      expect(xml).toContain('Study OID="STUDY.P_1_2__3_"');
      expect(xml).toContain('MetaDataVersion OID="MDV.v&amp;1&quot;2&quot;"');
      expect(xml).toContain(
        'StudyEventRef StudyEventOID="SE.VIS&amp;1&lt;2&gt;"'
      );
      expect(xml).toContain('FormRef FormOID="FORM.f_&amp;1&lt;2&gt;"');
      expect(xml).toContain('FormDef OID="FORM.f_&amp;1&lt;2&gt;"');
      expect(xml).toContain(
        'ItemGroupRef ItemGroupOID="IG.DM&amp;LB.sec_&amp;1"'
      );
      expect(xml).toContain('ItemGroupDef OID="IG.DM&amp;LB.sec_&amp;1"');
      expect(xml).toContain(
        'ItemRef ItemOID="IT.VAR_&amp;1&lt;2&gt;&quot;3&quot;"'
      );
      expect(xml).toContain(
        'ItemDef OID="IT.VAR_&amp;1&lt;2&gt;&quot;3&quot;"'
      );
      expect(xml).toContain('CodeListOID="CL_&amp;1"');
    });
  });

  describe("Homepage Teaser Snippet Terminology Swap & Post-Substitution Truncation", () => {
    it("synchronously resolves compiled terminology tags prior to character truncation and strips raw markup", () => {
      const sampleContent =
        'An enterprise-grade **TypeScript** mapping pipeline that transforms raw `<span data-key="edc" data-term="digital trial forms" data-definition="def">Electronic Data Capture (EDC)</span>` datasets into compliant **<span data-key="cdisc-sdtm" data-term="standardized study domain tables" data-definition="Format for study datasets.">CDISC SDTM</span>** domains.';

      const simplifiedText = resolveSnippetTerminology(sampleContent, true);
      expect(simplifiedText).toContain("standardized study domain tables");
      expect(simplifiedText).toContain("digital trial forms");
      expect(simplifiedText).not.toContain("CDISC SDTM");
      expect(simplifiedText).not.toContain("data-key=");
      expect(simplifiedText).not.toContain("<span");

      const technicalText = resolveSnippetTerminology(sampleContent, false);
      expect(technicalText).toContain("CDISC SDTM");
      expect(technicalText).toContain("Electronic Data Capture (EDC)");
      expect(technicalText).not.toContain("standardized study domain tables");
      expect(technicalText).not.toContain("data-key=");
      expect(technicalText).not.toContain("<span");
    });
  });

  describe("CRF Health Calculator Safe Property Guard (Targeted Safe Property Guard)", () => {
    it("safely computes form health metrics for draft forms containing fields with undefined, null, or empty variable names", () => {
      const draftForm: CRFForm = {
        id: "form_draft",
        name: "Draft Vital Signs",
        domain: "VS",
        description: "Draft form with unassigned variable names",
        version: "1.0",
        sections: [
          {
            id: "sec_vs",
            title: "Measurements",
            fields: [
              fromPartial<CRFField>({
                id: "f1",
                label: "Systolic BP",
                dataType: "number",
                required: true,
                columnSpan: 6,
                // variableName undefined
              }),
              {
                id: "f2",
                variableName: fromAny(null),
                label: "Diastolic BP",
                dataType: "number",
                required: false,
                columnSpan: 6,
              },

              {
                id: "f3",
                variableName: "",
                label: "Heart Rate",
                dataType: "number",
                required: false,
                columnSpan: 6,
              },
              {
                id: "f4",
                variableName: "VSTESTCD",
                label: "Vital Signs Test Short Name",
                dataType: "text",
                required: true,
                columnSpan: 6,
              },
            ],
          },
        ],
        rules: [],
      };

      let metrics;
      expect(() => {
        metrics = computeFormHealthMetrics(draftForm);
      }).not.toThrow();

      expect(metrics).toBeDefined();
      expect(metrics!.totalFields).toBe(4);
      expect(metrics!.mandatoryFields).toBe(2);
      // VS core variables: ["VSTESTCD", "VSORRES", "VSDTC"]
      // Present: "VSTESTCD". Missing: "VSORRES", "VSDTC".
      expect(metrics!.missingCoreVariables).toEqual(["VSORRES", "VSDTC"]);
      // 1 of 3 core variables present = 33% conformance
      expect(metrics!.cdashConformancePercentage).toBe(33);
    });
  });

  describe("Telemetry Rate Limiter Circuit Breaker & Cooldown Fallback", () => {
    beforeEach(() => {
      _testCache.reset();
    });

    it("verifies 30-second circuit breaker cooldown prevents unhandled exception cascade on remote rate limit failure", async () => {
      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.55" },
      });

      const now = Date.now();
      const res = await TelemetryService.isRateLimited(req);

      // Verify valid rate limit object returned with fallback headers
      expect(res.limited).toBe(false);
      expect(res.headers).toBeDefined();
      expect(res.headers?.["X-RateLimit-Limit"]).toBe("100");
      expect(res.headers?.["X-RateLimit-Remaining"]).toBe("99");

      // Verify circuit breaker timestamp
      expect(_testCache.circuitBreakerCooldownUntil).toBeGreaterThanOrEqual(
        now
      );
    });
  });

  describe("WebSocket BufferUtil Masking & Neon Serverless Build Environment Guard", () => {
    it("guarantees WS_NO_BUFFER_UTIL and WS_NO_UTF_8_VALIDATE are set so frame masking never calls missing native bufferutil.mask", async () => {
      // Importing lib/db ensures environment initialization
      await import("@/lib/db");

      expect(process.env.WS_NO_BUFFER_UTIL).toBe("1");
      expect(process.env.WS_NO_UTF_8_VALIDATE).toBe("1");

      // Test pure JS frame masking implementation with buffer length >= 48 bytes
      // (the exact threshold where ws would otherwise call bufferUtil.mask)
      const bufferUtilPath = path.resolve(
        process.cwd(),
        "node_modules/ws/lib/buffer-util.js"
      );
      const bufferUtil =
        (await import(bufferUtilPath)).default ||
        (await import(bufferUtilPath));
      expect(typeof bufferUtil.mask).toBe("function");

      const source = Buffer.alloc(64, 0x41); // 64 bytes of 'A'
      const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
      const output = Buffer.alloc(64);

      expect(() => {
        bufferUtil.mask(source, mask, output, 0, 64);
      }).not.toThrow();

      // Verify masking XOR logic
      expect(output[0]).toBe(0x41 ^ 0x12);
      expect(output[1]).toBe(0x41 ^ 0x34);
    });
  });

  describe("Fog-State Prioritized Gesture Isolation & Defogging Regression", () => {
    it("ensures wipeScreenFog reduces fog level monotonically towards 0", () => {
      const state = createInitialState("fenix");
      state.fogLevel = 0.8;

      const wiped1 = wipeScreenFog(state, 140, 140, 35);
      expect(wiped1.fogLevel).toBeLessThan(0.8);
      expect(wiped1.fogLevel).toBeCloseTo(0.58, 2);

      const wiped2 = wipeScreenFog(wiped1, 140, 140, 35);
      expect(wiped2.fogLevel).toBeLessThan(wiped1.fogLevel);

      const wiped3 = wipeScreenFog(wiped2, 140, 140, 35);
      const wiped4 = wipeScreenFog(wiped3, 140, 140, 35);
      expect(wiped4.fogLevel).toBe(0);
    });
  });

  describe("Working With Duck - Interruption Suspension & State Preservation Regression (#602)", () => {
    it("preserves work progress, bladder, and excitement invariantly when game status is paused", () => {
      const state = createInitialDuckGameState(1);
      state.status = "running";
      state.workProgress = 42;
      state.excitement = 75;
      state.bladder = 30;

      // In paused status, stepping must not advance progress or decay stats
      const pausedState = { ...state, status: "paused" as const };
      const afterPauseStep = stepDuckGame(pausedState);

      expect(afterPauseStep.status).toBe("paused");
      expect(afterPauseStep.workProgress).toBe(42);
      expect(afterPauseStep.excitement).toBe(75);
      expect(afterPauseStep.bladder).toBe(30);
    });

    it("ensures terminal win and failed states cannot be unpaused or mutated by stepping", () => {
      const wonState = createInitialDuckGameState(1);
      wonState.status = "won";
      wonState.workProgress = 100;
      const steppedWon = stepDuckGame(wonState);
      expect(steppedWon.status).toBe("won");
      expect(steppedWon.workProgress).toBe(100);

      const failedState = createInitialDuckGameState(1);
      failedState.status = "failed";
      failedState.workProgress = 15;
      const steppedFailed = stepDuckGame(failedState);
      expect(steppedFailed.status).toBe("failed");
      expect(steppedFailed.workProgress).toBe(15);
    });
  });

  describe("Telemetry Raw and Daily Rollup Reconciliation (#1111)", () => {
    it("includes historical rollups and still counts live raw events without a database", async () => {
      const rawGroupBy = vi.fn().mockResolvedValue([
        {
          projectSlug: "/legacy",
          eventType: "page_view",
          _count: { id: 5 },
        },
      ]);
      const rollupGroupBy = vi.fn().mockResolvedValue([
        {
          projectSlug: "/legacy",
          eventType: "page_view",
          _sum: { count: 8 },
        },
        {
          projectSlug: "/archived",
          eventType: "project_click",
          _sum: { count: 3 },
        },
      ]);
      const transactionClient = {
        telemetryEvent: { groupBy: rawGroupBy },
        telemetryDailyRollup: { groupBy: rollupGroupBy },
      };
      const transaction = vi.fn(
        async (callback: (client: typeof transactionClient) => unknown) =>
          callback(transactionClient)
      );
      vi.stubEnv("PLAYWRIGHT_TEST", "");
      vi.doMock("@/lib/db", () => ({ prisma: { $transaction: transaction } }));
      vi.resetModules();

      try {
        const { TelemetryService: isolatedTelemetryService } =
          await import("@/lib/services/telemetry-service");

        await expect(
          isolatedTelemetryService.getAggregateStats()
        ).resolves.toEqual({
          "/legacy": { views: 13, clicks: 0 },
          "/archived": { views: 0, clicks: 3 },
        });
        expect(transaction).toHaveBeenCalledTimes(1);
      } finally {
        vi.doUnmock("@/lib/db");
        vi.resetModules();
        vi.unstubAllEnvs();
      }
    });
  });

  describe("Working With Duck - idle play cannot win a sprint (#1176)", () => {
    it("fails or stalls Sprint 1 when the player never touches Duck", () => {
      let seed = 42;
      const random = vi.spyOn(Math, "random").mockImplementation(() => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      });
      try {
        let state: ReturnType<typeof createInitialDuckGameState> = {
          ...createInitialDuckGameState(1),
          status: "running",
        };
        for (let t = 0; t < 60 * 300 && state.status === "running"; t++) {
          state = stepDuckGame(state);
        }
        expect(state.status).not.toBe("won");
      } finally {
        random.mockRestore();
      }
    });
  });

  describe("CRF SAS codelist comments regression (#1201)", () => {
    it("keeps the Yes/No format definition active after its NCI metadata", () => {
      const sas = exportStudyToSas(ONCOLOGY_RECIST_PRESET);

      expect(sas).toContain(
        "/* Codelist: No Yes Response (NY) | NCI Codelist: C66741 */\n  VALUE $NYF"
      );
      expect(sas).not.toContain("*/ */");
    });
  });

  describe("Neuro QA duplicate-edit regression (#1217)", () => {
    it("does not award a resolved case for repeated edits to one defect voxel", () => {
      const scenario = SCENARIOS.dura_inclusion;
      const volume = generateSyntheticVolume("dura_inclusion");
      const { min, max } = volume.defectRegion;
      let location: { x: number; y: number; z: number } | undefined;
      for (let z = min.z; z <= max.z && !location; z++) {
        for (let y = min.y; y <= max.y && !location; y++) {
          for (let x = min.x; x <= max.x; x++) {
            if (volume.labels[getIndex(x, y, z)] === 5) {
              location = { x, y, z };
              break;
            }
          }
        }
      }
      expect(location).toBeDefined();
      const edits = Array.from({ length: scenario.initialDefects }, () => ({
        ...location!,
        layer: "brainmask" as const,
        originalValue: 1,
        newValue: 0,
      }));

      const metrics = evaluateQAMetrics(scenario, volume, [], edits);
      expect(metrics.isResolved).toBe(false);
      expect(metrics.defectCount).toBeGreaterThan(0);
    });
  });

  describe("Proof workspace export regression (#1227)", () => {
    it("removes the generated Lean theorem when a completed graph is pruned", () => {
      const edges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];

      expect(exportWorkspaceProof("lean", edges, "modus-ponens")).toContain(
        "theorem modus_ponens_pipeline"
      );
      expect(
        exportWorkspaceProof("lean", edges.slice(0, -1), "modus-ponens")
      ).not.toContain("theorem modus_ponens_pipeline");
    });
  });

  describe("CRF PDF section page-break regression (#1101)", () => {
    it("allocates a new page before a section heading that lacks footer clearance", async () => {
      const study = createNearFooterSectionStudy();

      const blob = await generateStudyPdf(study, {
        mode: "blank",
        scope: "all",
        includeTableOfContents: false,
        includeSdtmAppendix: false,
      });
      const pdfSource = await blob.text();
      const pageCount = Number(pdfSource.match(/\/Count\s+(\d+)\b/)?.[1]);

      expect(pageCount).toBe(3);
    });
  });

  describe("Laser Loon - enemy contact costs the loon a hit (#1186)", () => {
    it("an enemy touching the loon takes a hit, and the shield absorbs it", () => {
      const enemy = fromPartial<LoonTarget>({
        x: 120,
        y: 180,
        radius: 20,
        hp: 1,
        frozenTimer: 0,
      });
      const input = {
        targets: [enemy],
        loonX: 120,
        loonY: 180,
        hitsLeft: LOON_MAX_HITS,
        invulnerableUntil: 0,
        now: 1000,
        shielded: false,
      };

      const hit = resolveLoonCollision(input);
      expect(hit.outcome).toBe("hit");
      expect(hit.hitsLeft).toBe(LOON_MAX_HITS - 1);

      const blocked = resolveLoonCollision({ ...input, shielded: true });
      expect(blocked.outcome).toBe("blocked");
      expect(blocked.hitsLeft).toBe(LOON_MAX_HITS);
    });
  });
});

describe("Sandbox target regression (#1234)", () => {
  it("does not discharge a root goal when ring targets a child variable", async () => {
    const { SandboxMode } =
      await import("@/components/QuasiPerfectPuzzler/SandboxMode");
    const { render, screen, fireEvent, cleanup } =
      await import("@testing-library/react/pure");
    try {
      render(React.createElement(SandboxMode));
      fireEvent.click(screen.getByRole("button", { name: /^Tactic ring\./ }));
      fireEvent.click(
        screen.getAllByRole("button", {
          name: "Variable node with value a. Expression: a",
        })[0]
      );
      expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
      expect(
        screen.getByRole("button", { name: /^Equality node/ })
      ).toBeDefined();
    } finally {
      cleanup();
    }
  });
});

describe("Custom Proof session regression (#1225)", () => {
  it("exports changed visitor formulas instead of the shared default theorem", async () => {
    const { createCustomTheorem } = await import("@/lib/proof-custom");
    const theorem = createCustomTheorem(["A", "A -> B", "B -> C"], "C");
    const output = exportWorkspaceProof("markdown", [], theorem);
    expect(output).toContain("A -> B");
    expect(output).not.toContain("P → Q");
  });
});

describe("Garmin setup options reach the engine (#1209)", () => {
  it("maps difficulty and loadout ids to distinct, testable engine parameters", async () => {
    const { resolveRunTuning, DEFAULT_RUN_TUNING } =
      await import("@/lib/garmin-engine");
    expect(resolveRunTuning("normal", "standard-ram")).toEqual(
      DEFAULT_RUN_TUNING
    );
    expect(resolveRunTuning("nope", "nope")).toEqual(DEFAULT_RUN_TUNING);
    const casual = resolveRunTuning("casual", "standard-ram");
    const hard = resolveRunTuning("hard", "standard-ram");
    expect(casual.obstacleSpeedScale).toBeLessThan(1);
    expect(hard.obstacleSpeedScale).toBeGreaterThan(1);
    expect(casual.obstacleIntervalScale).toBeGreaterThan(1);
    expect(hard.allocIntervalScale).toBeLessThan(1);
    expect(resolveRunTuning("normal", "low-power").gcFreezeMs).toBe(350);
    expect(resolveRunTuning("normal", "overclocked").gcBonusFreedKb).toBe(2);
  });

  it("startGame carries the tuning into the run and keeps it on restart", async () => {
    const { createInitialState, startGame, resolveRunTuning } =
      await import("@/lib/garmin-engine");
    const tuning = resolveRunTuning("hard", "low-power");
    const run = startGame(createInitialState("fenix", 0), "fenix", tuning);
    expect(run.gameState).toBe("playing");
    expect(run.tuning).toEqual(tuning);
    expect(startGame(run).tuning).toEqual(tuning);
  });

  it("the loadout changes GC freeze length and battery drain", async () => {
    const {
      createInitialState,
      startGame,
      resolveRunTuning,
      triggerGarbageCollection,
      updateGameSimulation,
    } = await import("@/lib/garmin-engine");
    const run = (loadout: string) =>
      startGame(
        createInitialState("fenix", 0),
        "fenix",
        resolveRunTuning("normal", loadout)
      );
    // GC is a no-op on an empty heap (#1213), so seed collectible garbage.
    const withGarbage = (state: ReturnType<typeof run>) => ({
      ...state,
      variables: [
        ...state.variables,
        {
          id: 9001,
          name: "leakedBuffer",
          type: "array" as const,
          sizeKb: 8,
          allocatedAt: 0,
        },
      ],
    });
    expect(
      triggerGarbageCollection(withGarbage(run("standard-ram"))).state.gcTimerMs
    ).toBe(500);
    expect(
      triggerGarbageCollection(withGarbage(run("low-power"))).state.gcTimerMs
    ).toBe(350);
    const drained = (loadout: string) =>
      100 -
      updateGameSimulation({ ...run(loadout), lastAllocTime: Date.now() }, 1000)
        .battery;
    expect(drained("low-power")).toBeLessThan(drained("standard-ram"));
    expect(drained("overclocked")).toBeGreaterThan(drained("standard-ram"));
  });

  it("the difficulty changes obstacle speed", async () => {
    const {
      createInitialState,
      startGame,
      resolveRunTuning,
      updateGameSimulation,
    } = await import("@/lib/garmin-engine");
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    try {
      const speed = (difficulty: string) => {
        const state = startGame(
          createInitialState("fenix", 0),
          "fenix",
          resolveRunTuning(difficulty, "standard-ram")
        );
        const next = updateGameSimulation(
          { ...state, lastAllocTime: Date.now(), lastObstacleTime: 0 },
          16
        );
        return next.obstacles[0]?.speed ?? 0;
      };
      expect(speed("casual")).toBeGreaterThan(0);
      expect(speed("casual")).toBeLessThan(speed("normal"));
      expect(speed("hard")).toBeGreaterThan(speed("normal"));
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("Garmin NV flash clear survives a restart (#1210)", () => {
  it("does not re-seed the default flash entry after a clear", async () => {
    const store: Record<string, string> = {};
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = String(v);
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });
    const { createInitialState, clearFlashStorage } =
      await import("@/lib/garmin-engine");
    // First boot seeds sys_log.dat.
    const first = createInitialState("fenix", 0);
    expect(first.allocatedFlashKb).toBe(4);
    const cleared = clearFlashStorage(first);
    expect(cleared.flashVariables).toEqual([]);
    expect(cleared.flashFiles).toEqual([]);
    // A fresh initialization must stay empty.
    const reboot = createInitialState("fenix", 0);
    expect(reboot.allocatedFlashKb).toBe(0);
    expect(reboot.flashVariables).toEqual([]);
    expect(reboot.flashFiles).toEqual([]);
  });
});

describe("Quasi-Perfect progress: best score survives weaker replays (#1230)", () => {
  const mk = (over: Partial<LevelScore>): LevelScore => ({
    levelId: 1,
    completed: true,
    usedSorry: false,
    remainingRam: 20,
    stars: 2,
    morality: 100,
    timestamp: 1,
    ...over,
  });

  it("never lets a sorry replay erase an honest proof", () => {
    const honest = mk({});
    const sorry = mk({
      usedSorry: true,
      stars: 0,
      morality: -100,
      timestamp: 2,
    });
    expect(mergeLevelScore(honest, sorry)).toBe(honest);
  });

  it("lets an honest proof replace a sorry admission", () => {
    const sorry = mk({ usedSorry: true, stars: 0, morality: -100 });
    const honest = mk({ timestamp: 2 });
    expect(mergeLevelScore(sorry, honest)).toBe(honest);
  });

  it("keeps higher stars, then more RAM, and ignores equal replays", () => {
    const base = mk({});
    expect(mergeLevelScore(base, mk({ stars: 1 }))).toBe(base);
    const better = mk({ stars: 3 });
    expect(mergeLevelScore(base, better)).toBe(better);
    const moreRam = mk({ remainingRam: 25 });
    expect(mergeLevelScore(base, moreRam)).toBe(moreRam);
    expect(mergeLevelScore(base, mk({ timestamp: 9 }))).toBe(base);
  });

  it("accepts the first score", () => {
    const first = mk({});
    expect(mergeLevelScore(undefined, first)).toBe(first);
  });
});

describe("Quasi-Perfect resume level and RAM rules (#1650, #1651)", () => {
  it("resumes a saved level and falls back to Level 1 on a corrupt index", () => {
    const levels = puzzleLevels;
    expect(
      resolveResumeLevelIndex(
        parseGameProgress('{"completedLevels":{},"currentLevelIndex":4}'),
        levels
      )
    ).toBe(4);
    expect(
      resolveResumeLevelIndex(
        parseGameProgress('{"completedLevels":{},"currentLevelIndex":-3}'),
        levels
      )
    ).toBe(0);
    expect(resolveResumeLevelIndex(parseGameProgress("not json"), levels)).toBe(
      0
    );
  });

  it("refuses sorry at 0 GB and allows it while RAM remains", () => {
    expect(getTacticBlock(tacticDefs.sorry, 0)?.reason).toBe("exhausted");
    expect(getTacticBlock(tacticDefs.sorry, 0.5)).toBeNull();
  });

  it("reports simp's no-progress charge from its failureCost", () => {
    const x: ASTNode = { id: "x", type: "Variable", value: "x" };
    const result = tacticDefs.simp.execute(x, x, []);
    expect(result.ramConsumed).toBe(tacticDefs.simp.failureCost);
    expect(result.message).toContain(`${tacticDefs.simp.failureCost} GB`);
  });
});

describe("Garmin progression is refresh-rate independent (#1212)", () => {
  const simulate = (hz: number, seconds: number, isLightOn = false) => {
    const step = 1000 / hz;
    let state: GameEngineState = {
      ...startGame(createInitialState("fenix", 0), "fenix"),
      isLightOn,
    };
    for (let i = 0; i < Math.round(seconds * hz); i++) {
      // Keep the run alive: no spawns, no random allocation crashes.
      state = updateGameSimulation(
        {
          ...state,
          obstacles: [],
          lastAllocTime: Date.now(),
          lastObstacleTime: Date.now() + 60_000,
        },
        step
      );
    }
    return state;
  };

  it("gives equal score and distance after equal time at 30, 60 and 120 Hz", () => {
    const runs = [30, 60, 120].map((hz) => simulate(hz, 10));
    for (const run of runs) {
      expect(run.score).toBeGreaterThanOrEqual(598);
      expect(run.score).toBeLessThanOrEqual(602);
      expect(run.distanceMeters).toBeCloseTo(150, 0);
    }
  });

  it("drains the battery at 0.1 percent a second with the light off at any rate", () => {
    for (const hz of [30, 60, 120]) {
      expect(100 - simulate(hz, 10).battery).toBeCloseTo(1, 1);
    }
  });

  it("drains 0.4 percent a second with the backlight on at any rate", () => {
    for (const hz of [30, 60, 120]) {
      expect(100 - simulate(hz, 10, true).battery).toBeCloseTo(4, 1);
    }
  });

  it("reaches power loss through normal ticks, not only the debug drain", () => {
    let state: GameEngineState = {
      ...startGame(createInitialState("fenix", 0), "fenix"),
      isLightOn: true,
      battery: 0.5,
    };
    for (let i = 0; i < 600 && state.gameState === "playing"; i++) {
      state = updateGameSimulation(
        {
          ...state,
          obstacles: [],
          lastAllocTime: Date.now(),
          lastObstacleTime: Date.now() + 60_000,
        },
        1000 / 60
      );
    }
    expect(state.gameState).toBe("shutdown");
    expect(state.crashReport?.errorType).toBe("Power Loss");
  });

  it("keeps sub-tick thermal decay from stalling at high refresh rates", () => {
    let state: GameEngineState = {
      ...startGame(createInitialState("fenix", 0), "fenix"),
      thermalStress: 0.5,
      fogLevel: 0.5,
    };
    for (let i = 0; i < 120 * 4; i++) {
      state = updateGameSimulation(
        {
          ...state,
          obstacles: [],
          lastAllocTime: Date.now(),
          lastObstacleTime: Date.now() + 60_000,
        },
        1000 / 120
      );
    }
    // 4 s at 1/14900 per ms is about 0.27 of decay.
    expect(state.thermalStress).toBeLessThan(0.3);
  });
});

describe("Garmin obstacles crash with their own type (#1318)", () => {
  it("maps NULL to Null Pointer and STK to Stack Overflow", async () => {
    const { createInitialState, startGame, updateGameSimulation, GROUND_Y } =
      await import("@/lib/garmin-engine");
    const crash = (type: "null_pointer" | "stack_overflow", label: string) =>
      updateGameSimulation(
        {
          ...startGame(createInitialState("fenix", 0), "fenix"),
          lastObstacleTime: Date.now() + 60_000,
          obstacles: [
            {
              id: 1,
              x: 52,
              y: GROUND_Y - 20,
              width: 16,
              height: 20,
              type,
              label,
              speed: 2.2,
            },
          ],
        },
        16.6
      ).crashReport?.errorType;
    expect(crash("null_pointer", "NULL")).toBe("Null Pointer");
    expect(crash("stack_overflow", "STK")).toBe("Stack Overflow");
  });
});

describe("Clinical Trial Chaos phase-clear report counts the final CRF (#1609)", () => {
  it("reports a 100% clean rate when every CRF of the phase was clean", async () => {
    const {
      buildInspectionReport,
      createInitialAuditorState,
      createInitialScoreState,
      PHASE_TARGETS,
      settleSubmission,
    } = await import("@/lib/clinical-trial-chaos");
    const clean = (id: string): ClinicalSubject => ({
      id,
      subjectLabel: id,
      studySite: "Site 001",
      observations: [
        {
          id: `${id}-obs`,
          field: "Weight",
          rawValue: "70 kg",
          currentValue: "70 kg",
          destination: "VS",
          isResolved: true,
        },
      ],
      status: "queued",
      timeRemaining: 30,
      maxTime: 60,
      createdAt: 1,
    });

    let score = createInitialScoreState();
    let phaseCleared = false;
    for (let i = 0; i < PHASE_TARGETS[1]; i++) {
      const outcome = settleSubmission(
        score,
        clean(`S-${i}`),
        true,
        "campaign",
        1
      );
      score = outcome.scoreState;
      phaseCleared = outcome.phaseCleared;
    }
    expect(phaseCleared).toBe(true);
    expect(
      buildInspectionReport(
        score,
        createInitialAuditorState(),
        [],
        [],
        null,
        []
      ).cleanRate
    ).toBe(100);

    // The component grades the phase on the settled score, not on the score
    // before the final CRF with only the submission count bumped.
    const code = fs.readFileSync(
      path.resolve(__dirname, "../components/ClinicalTrialChaos.tsx"),
      "utf-8"
    );
    expect(code).not.toContain(
      "subjectsSubmitted: scoreState.subjectsSubmitted + 1"
    );
  });
});

describe("Clinical Trial Chaos auditor resumes after a Coffee Break (#1610)", () => {
  it("un-freezes the auditor when a wrong fix raised suspicion during the break", async () => {
    const {
      createInitialAuditorState,
      createInitialPowerUpInventory,
      createInitialScoreState,
      raiseAuditorSuspicion,
      spendPowerUp,
      startCoffeeBreak,
      tickShiftClocks,
    } = await import("@/lib/clinical-trial-chaos");
    const auditor = raiseAuditorSuspicion(
      startCoffeeBreak(createInitialAuditorState()),
      10
    );
    const tick = tickShiftClocks(
      {
        subjects: [],
        auditor,
        scoreState: createInitialScoreState(),
        powerUps: spendPowerUp(
          createInitialPowerUpInventory(),
          "fda-coffee-break"
        ),
        amendment: null,
      },
      9
    );
    expect(tick.coffeeBreakEnded).toBe(true);
    expect(tick.auditor.behavior).toBe("patrolling");
    expect(tick.auditor.isPaused).toBe(false);
  });
});

// Behavioural reproductions live in __tests__/arcade-animation-loops.test.tsx.
describe("Arcade loops read current state (#1628)", () => {
  const readComponent = (name: string) =>
    fs.readFileSync(
      path.resolve(__dirname, `../components/${name}.tsx`),
      "utf-8"
    );
  const loopBody = (code: string, marker: string, end: string) => {
    const start = code.indexOf("useAnimationFrame(", code.indexOf(marker));
    const stop = code.indexOf(end, start);
    expect(start).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(start);
    return code.slice(start, stop);
  };

  it("expires Retro Labyrinth side effects on the clock that stamps them", async () => {
    const { fireWeapon, DEFAULT_WEAPONS } = await import("@/lib/dungeon");
    const nowMs = 1_800_000_000_000;
    const res = fireWeapon(
      "npm_install",
      DEFAULT_WEAPONS,
      1,
      1,
      80,
      80,
      [],
      undefined,
      nowMs,
      32
    );
    expect(res.activeSideEffect?.expiresAt).toBe(nowMs + 4000);

    const body = loopBody(
      readComponent("RetroLabyrinth"),
      "// Main Real-Time Game Loop",
      "isActive: isLoopActive"
    );
    expect(body).toContain("activeSideEffect.expiresAt <= Date.now()");
    expect(body).not.toContain("expiresAt <= timestamp");
  });

  it("reads the current Retro Labyrinth rooms and Clinical Chaos subjects", () => {
    const labyrinth = readComponent("RetroLabyrinth");
    expect(labyrinth).not.toContain("loopCampaignRoomsRef");
    expect(labyrinth).toContain("campaignRoomsRef.current = campaignRooms;");

    const chaos = readComponent("ClinicalTrialChaos");
    expect(chaos).not.toContain("loopStartSubjects");
    const body = loopBody(
      chaos,
      "// 17. Main Game Loop Tick",
      "isActive: playState"
    );
    expect(body).toContain("renderedLoopStateRef.current");
  });
});

describe("Working With Duck - a paused sprint ignores player actions (#1645)", () => {
  const paused = (): WorkingWithDuckState => ({
    ...createInitialDuckGameState(1),
    status: "paused",
    excitement: 42,
    totalScore: 1046,
  });

  it("treats, tricks, drags and scene entry are no-ops while paused", () => {
    const state = paused();
    expect(giveTreat(state)).toBe(state);
    expect(performTrick(state, "SIT")).toBe(state);
    expect(startDraggingDuck(state)).toBe(state);
    expect(dragDuckTo(state, 700, 400)).toBe(state);
    expect(enterDogPark(state)).toBe(state);
  });

  it("does not bank the Back Door potty bonus while paused", () => {
    const base = paused();
    const held: WorkingWithDuckState = {
      ...base,
      duck: {
        ...base.duck,
        state: "DRAGGED",
        x: BACK_DOOR_BOUNDS.x + 10,
        y: BACK_DOOR_BOUNDS.y + 10,
      },
    };
    expect(releaseDuck(held).totalScore).toBe(1046);
    expect(
      releaseDuck({ ...held, status: "running" }).totalScore
    ).toBeGreaterThan(1046);
  });
});

describe("Retro Labyrinth pass-4 playtest (#1665, #1667, #1668, #1669)", () => {
  const labyrinth = () =>
    fs.readFileSync(
      path.resolve(__dirname, "../components/RetroLabyrinth.tsx"),
      "utf-8"
    );

  it("charges HP for enemy contact without ending the run (#1665)", async () => {
    const { updateEnemyAI } = await import("@/lib/dungeon");
    const grid = Array.from({ length: 9 }, () => Array(15).fill(" "));
    const res = updateEnemyAI(
      [
        fromPartial({
          id: "d",
          type: "drone",
          x: 4,
          y: 4,
          hp: 40,
          maxHp: 40,
          state: "patrol",
          patrolDir: "right",
        }),
      ],
      grid,
      5,
      4,
      333
    );
    expect(res.damageToPlayer).toBe(25);
    expect(res.updatedEnemies[0]).toMatchObject({ x: 4, y: 4 });
    expect(labyrinth()).not.toContain("caughtPlayer");
  });

  it("keeps patrols on the floor and moves up patrols up (#1665)", async () => {
    const { updateEnemyAI, isEnemyWalkable, generateRoguelikeCampaign } =
      await import("@/lib/dungeon");
    for (const room of generateRoguelikeCampaign()) {
      let enemies = room.enemies;
      for (let step = 0; step < 60; step++) {
        enemies = updateEnemyAI(enemies, room.grid, 0, 0, 333).updatedEnemies;
        for (const e of enemies) {
          expect(isEnemyWalkable(room.grid, e.x, e.y), room.id).toBe(true);
        }
      }
    }
  });

  it("leaves no static drone copy in campaign rooms (#1665)", () => {
    const code = labyrinth();
    const roguelikeBranch = code.slice(
      code.indexOf("const campaign = generateRoguelikeCampaign();"),
      code.indexOf("const fov = calculateFOV(")
    );
    expect(roguelikeBranch).toContain("setDrones([]);");
    expect(roguelikeBranch).not.toContain('filter((e) => e.type === "drone")');
  });

  it("moves enemies and boss volleys on elapsed time (#1665)", async () => {
    const {
      createFaceForgeBoss,
      updateFaceForgeBoss,
      BOSS_REFERENCE_FRAME_MS,
    } = await import("@/lib/dungeon");
    const fired = updateFaceForgeBoss(
      createFaceForgeBoss(7, 4),
      1,
      4,
      5000,
      15,
      9,
      undefined,
      0
    ).updatedBoss;
    const full = updateFaceForgeBoss(
      fired,
      1,
      4,
      5001,
      15,
      9,
      undefined,
      BOSS_REFERENCE_FRAME_MS
    );
    const half = updateFaceForgeBoss(
      fired,
      1,
      4,
      5001,
      15,
      9,
      undefined,
      BOSS_REFERENCE_FRAME_MS / 2
    );
    const dFull = Math.abs(
      full.updatedBoss.projectiles[0].x - fired.projectiles[0].x
    );
    const dHalf = Math.abs(
      half.updatedBoss.projectiles[0].x - fired.projectiles[0].x
    );
    expect(dHalf).toBeCloseTo(dFull / 2, 6);
    expect(labyrinth()).not.toContain("Math.random() < 0.05");
    expect(labyrinth()).not.toContain("Math.random() < 0.04");
  });

  it("restores weapon ammo on retry (#1667)", () => {
    const code = labyrinth();
    const restart = code.slice(
      code.indexOf("const handleRestart = useCallback("),
      code.indexOf("}, [gameMode, stage, roomIndex, loadRoom]);")
    );
    expect(restart).toContain("setWeapons(entry.weapons);");
  });

  it("scores each crypto coin once at the exit (#1668)", async () => {
    const { computeRoomExitScore } = await import("@/lib/dungeon");
    const room1 = computeRoomExitScore(900, 5, 200);
    expect(computeRoomExitScore(room1, 5, 0)).toBe(room1 + 900);
    expect(labyrinth()).not.toContain(
      "score + Math.max(100, 1000 - nextMoves * 20) + cryptoBounty"
    );
  });

  it("pauses for the manual and swallows overlay keys (#1669)", () => {
    const code = labyrinth();
    expect(code).toContain('data-field-manual="retro-labyrinth"');
    expect(code).toContain("onOpenChange={handleManualOpenChange}");
    expect(code).toContain("OVERLAY_CONSUMED_KEYS.has(e.key)");
  });
});
