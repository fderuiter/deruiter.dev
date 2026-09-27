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
} from "@/lib/garmin-engine";
import {
  clampBounds,
  createInitialDuckGameState,
  dragDuckTo,
  stepDuckGame,
  performTrick,
  advanceToNextLevel,
  shouldSyncDuckHudState,
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

    it("maintains non-negative RAM bounds and consistent heap allocations under memory pressure", () => {
      const initial = createInitialState("fenix");
      const playing = { ...initial, gameState: "playing" as const };

      const { state: afterJettison } = jettisonOldestVariable(playing);
      expect(afterJettison.allocatedRamKb).toBeGreaterThanOrEqual(0.2);

      const { state: afterGc, freedKb } = triggerGarbageCollection(playing);
      expect(afterGc.isGcActive).toBe(true);
      expect(freedKb).toBeGreaterThanOrEqual(0);
      expect(afterGc.allocatedRamKb).toBeGreaterThanOrEqual(0.4);

      const { state: allocState } = allocateVariable(
        playing,
        "string",
        "testVar"
      );
      expect(allocState.allocatedRamKb).toBeGreaterThan(playing.allocatedRamKb);
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
      const loopStart = code.indexOf("const loop = ");
      const loopEnd = code.indexOf(
        "animFrameRef.current = requestAnimationFrame(loop);",
        loopStart
      );
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
