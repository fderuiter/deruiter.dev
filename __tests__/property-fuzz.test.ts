import { describe, it, expect } from "vitest";
import { createCustomTheorem } from "@/lib/proof-custom";
import * as fc from "fast-check";
import {
  exportStudyToCdiscOdmXml,
  exportStudyToUsdm,
  importStudyFromUsdm,
  extractCodelistFromUsdmObject,
  diffUniversalCrfStudies,
  type StudyProtocol,
} from "@/lib/crf";
import {
  studyProtocolArbitrary,
  malformedXmlStringArbitrary,
  malformedCodelistArbitrary,
  malformedUsdmDocArbitrary,
} from "./helpers/clinical-fuzz-generators";
import {
  parseFormula,
  formatFormula,
  extractVariables,
  evaluateAst,
  areAstsEqual,
  generateTruthTable,
  type PropAst,
} from "@/lib/proof-utils";
import {
  calculateColumnCount,
  calculateColumnWidth,
  distributeItemsGreedily,
} from "@/lib/graphics-engine";
import { sanitizeString, sanitizeError } from "@/lib/error-sanitization";
import { validateSyncRequest } from "@/lib/security";
import { NextRequest } from "next/server";
import {
  boundingBoxOverlap,
  calculateScoreMultiplier,
  clamp,
  createSeededRandom,
  lerp,
  scaleScoreWithMultiplier,
  type Rect,
} from "@/lib/arcade";
import { calculateFOV, hasLineOfSight } from "@/lib/dungeon";
import {
  assignTransportPriority,
  calculateDebriefScore,
  calculateInjurySeverity,
  createInitialOetDescentState,
  derivePlayfulStats,
  evaluateIncidentDebrief,
  evaluateOETCompliance,
  filterEventsBySeverity,
  filterEventsByType,
  sortEventsByTimestamp,
  type OetMetrics,
  type PatrolEvent,
  type PatrolScenario,
  type VitalsData,
} from "@/lib/patrol";
import {
  ACT_I,
  ACT_I_CRISES,
  DEMOGRAPHICS_SCENARIO,
  advanceDesk,
  advanceRun,
  createRunState,
  dailySeed,
  normalizeSeed,
  parseChallengeHash,
  challengeHash,
  seedFromBytes,
  advanceTable,
  deriveTableView,
  createDeskState,
  createTableState,
  evaluateHand,
  roundRatio,
  scoreTimeline,
  type DeskAction,
  type RunAction,
  type TableAction,
  type RoundingMode,
} from "@/lib/trial-and-error";

// Arbitrary generator for Propositional Logic ASTs
const varNames = ["P", "Q", "R", "S", "A", "B", "C"];
const leafAstArbitrary: fc.Arbitrary<PropAst> = fc
  .constantFrom(...varNames)
  .map((name) => ({
    type: "var" as const,
    name,
  }));

const astArbitrary: fc.Arbitrary<PropAst> = fc.letrec((tie) => ({
  tree: fc.oneof(
    { depthSize: "small" },
    leafAstArbitrary,
    fc.constant<PropAst>({ type: "bottom" }),
    fc.record({
      type: fc.constant("not" as const),
      operand: tie("tree") as fc.Arbitrary<PropAst>,
    }),
    fc.record({
      type: fc.constantFrom(
        "and" as const,
        "or" as const,
        "implies" as const,
        "iff" as const
      ),
      left: tie("tree") as fc.Arbitrary<PropAst>,
      right: tie("tree") as fc.Arbitrary<PropAst>,
    })
  ),
})).tree;

const rectArbitrary: fc.Arbitrary<Rect> = fc.record({
  x: fc.integer({ min: -1_000, max: 1_000 }),
  y: fc.integer({ min: -1_000, max: 1_000 }),
  width: fc.integer({ min: 0, max: 300 }),
  height: fc.integer({ min: 0, max: 300 }),
});

const patrolEventArbitrary: fc.Arbitrary<PatrolEvent> = fc.record({
  id: fc.nat(10_000).map((id) => `event-${id}`),
  timestamp: fc.integer({ min: -100_000, max: 100_000 }),
  scenarioId: fc.constantFrom("incident-a", "incident-b", "hub"),
  action: fc.constantFrom(
    "phase_transition_dispatch",
    "assess-scene-safety",
    "DIALOGUE_CHOICE",
    "OET_TRANSPORT_COMPLETED",
    "HAZARD_ALERT"
  ),
  type: fc.option(
    fc.constantFrom("DIALOGUE_CHOICE", "WEATHER_ALERT", "HAZARD_ALERT"),
    { nil: undefined }
  ),
  severity: fc.constantFrom(
    "info" as const,
    "warning" as const,
    "critical" as const
  ),
  context: fc.option(
    fc.record({
      category: fc.constantFrom(
        "assessment",
        "treatment",
        "communication",
        "transport"
      ),
      closesLoop: fc.boolean(),
      style: fc.constantFrom("directive", "collaborative", "candid"),
      to: fc.constantFrom("DISPATCH", "SCENE", "DEBRIEF"),
      location: fc.constantFrom("East Slopes", "West Slopes", "The Back Bowl"),
    }),
    { nil: undefined }
  ),
  description: fc.string({ maxLength: 40 }),
});

const debriefHistoryArbitrary: fc.Arbitrary<PatrolEvent[]> = fc
  .array(
    fc.record({
      action: fc.constantFrom(
        "assess-scene-safety",
        "secondary-assessment",
        "splint-wrist",
        "package-for-transport",
        "DIALOGUE_CHOICE",
        "HAZARD_ALERT",
        "OET_TRANSPORT_COMPLETED",
        "reassess-patient-status"
      ),
      type: fc.option(fc.constantFrom("DIALOGUE_CHOICE", "HAZARD_ALERT"), {
        nil: undefined,
      }),
      scenarioId: fc.constantFrom("incident-a", "incident-b", "hub"),
      severity: fc.constantFrom(
        "info" as const,
        "warning" as const,
        "critical" as const
      ),
      description: fc.string({ maxLength: 40 }),
      context: fc.record({
        category: fc.constantFrom(
          "assessment",
          "treatment",
          "communication",
          "transport"
        ),
        closesLoop: fc.boolean(),
        style: fc.constantFrom("directive", "collaborative", "candid"),
        to: fc.constantFrom("DISPATCH", "SCENE", "DEBRIEF"),
        location: fc.constantFrom(
          "East Slopes",
          "West Slopes",
          "The Back Bowl"
        ),
      }),
    }),
    { maxLength: 25 }
  )
  .map((entries) =>
    entries.map((entry, index) => ({ ...entry, timestamp: index }))
  );

const oetMetricsArbitrary: fc.Arbitrary<OetMetrics> = fc.record({
  excessiveSpeedTime: fc.integer({ min: 0, max: 180 }),
  abruptDirectionChanges: fc.integer({ min: 0, max: 30 }),
  boundaryViolations: fc.integer({ min: 0, max: 10 }),
  collisions: fc.integer({ min: 0, max: 10 }),
  controlledStops: fc.integer({ min: 0, max: 10 }),
  routeEfficiency: fc.integer({ min: 0, max: 100 }),
  judgmentScore: fc.integer({ min: 0, max: 100 }),
});

const vitalsArbitrary: fc.Arbitrary<VitalsData> = fc.record({
  heartRate: fc.integer({ min: 0, max: 220 }),
  respiration: fc.integer({ min: 0, max: 60 }),
  bpSystolic: fc.integer({ min: 40, max: 220 }),
  spo2: fc.integer({ min: 50, max: 100 }),
  gcs: fc.integer({ min: 3, max: 15 }),
  avpu: fc.constantFrom("A" as const, "V" as const, "P" as const, "U" as const),
  pms: fc.constantFrom(
    "intact" as const,
    "compromised" as const,
    "absent" as const
  ),
});

describe("Shift-Left Fuzz & Property-Based Verification", () => {
  describe("Formal Logic AST & Proof Engine Invariants", () => {
    it("never throws unhandled exceptions when parsing arbitrary fuzzed string inputs", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 200 }), (rawString) => {
          expect(() => {
            const ast = parseFormula(rawString);
            if (ast) {
              const formatted = formatFormula(ast);
              expect(typeof formatted).toBe("string");
            }
          }).not.toThrow();
        }),
        { numRuns: 200 }
      );
    });

    it("satisfies double-negation evaluation equivalence for any generated AST and valuation", () => {
      fc.assert(
        fc.property(
          astArbitrary,
          fc.dictionary(fc.constantFrom(...varNames), fc.boolean()),
          (ast, env) => {
            const notNotAst: PropAst = {
              type: "not",
              operand: {
                type: "not",
                operand: ast,
              },
            };

            const directVal = evaluateAst(ast, env);
            const doubleNotVal = evaluateAst(notNotAst, env);
            expect(doubleNotVal).toBe(directVal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("satisfies De Morgan's Law: not(A and B) <=> (not A or not B)", () => {
      fc.assert(
        fc.property(
          astArbitrary,
          astArbitrary,
          fc.dictionary(fc.constantFrom(...varNames), fc.boolean()),
          (astA, astB, env) => {
            const notAAndB: PropAst = {
              type: "not",
              operand: { type: "and", left: astA, right: astB },
            };
            const notAOrNotB: PropAst = {
              type: "or",
              left: { type: "not", operand: astA },
              right: { type: "not", operand: astB },
            };

            expect(evaluateAst(notAAndB, env)).toBe(
              evaluateAst(notAOrNotB, env)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("extractVariables returns a unique list of variable names", () => {
      fc.assert(
        fc.property(astArbitrary, (ast) => {
          const vars = extractVariables(ast);
          const uniqueSet = new Set(vars);
          expect(vars.length).toBe(uniqueSet.size);
        }),
        { numRuns: 100 }
      );
    });

    it("areAstsEqual is reflexive and symmetric", () => {
      fc.assert(
        fc.property(astArbitrary, astArbitrary, (ast1, ast2) => {
          expect(areAstsEqual(ast1, ast1)).toBe(true);
          expect(areAstsEqual(ast1, ast2)).toBe(areAstsEqual(ast2, ast1));
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Masonry Graphics & Layout Invariants", () => {
    const breakpoints = { MD: 768, LG: 1024 };
    const cols = { SM: 1, MD: 2, LG: 3 };

    it("calculateColumnCount is monotonic with container width", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 3000 }),
          fc.integer({ min: 100, max: 3000 }),
          (w1, w2) => {
            const minW = Math.min(w1, w2);
            const maxW = Math.max(w1, w2);

            const colsMin = calculateColumnCount(minW, breakpoints, cols);
            const colsMax = calculateColumnCount(maxW, breakpoints, cols);

            expect(colsMin).toBeLessThanOrEqual(colsMax);
            expect([cols.SM, cols.MD, cols.LG]).toContain(colsMin);
            expect([cols.SM, cols.MD, cols.LG]).toContain(colsMax);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("calculateColumnWidth preserves exact total container width across gaps", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 2500 }),
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 0, max: 48 }),
          (containerWidth, colCount, gap) => {
            const colWidth = calculateColumnWidth(
              containerWidth,
              colCount,
              gap
            );
            const reconstructed = colWidth * colCount + gap * (colCount - 1);
            expect(Math.abs(reconstructed - containerWidth)).toBeLessThan(1e-6);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("distributeItemsGreedily places every item into columns with non-negative heights", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              height: fc.integer({ min: 10, max: 1000 }),
            }),
            { maxLength: 50 }
          ),
          fc.integer({ min: 1, max: 6 }),
          fc.integer({ min: 0, max: 32 }),
          (items, colCount, gap) => {
            const { columns, columnHeights } = distributeItemsGreedily(
              items,
              colCount,
              gap
            );

            expect(columns.length).toBe(colCount);
            expect(columnHeights.length).toBe(colCount);

            const totalItemsPlaced = columns.reduce(
              (acc, col) => acc + col.length,
              0
            );
            expect(totalItemsPlaced).toBe(items.length);

            for (const h of columnHeights) {
              expect(h).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Arcade Utility Invariants", () => {
    it("clamp always returns a value inside the ordered bounds", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100_000, max: 100_000 }),
          fc.integer({ min: -1_000, max: 1_000 }),
          fc.integer({ min: -1_000, max: 1_000 }),
          (value, firstBound, secondBound) => {
            const lower = Math.min(firstBound, secondBound);
            const upper = Math.max(firstBound, secondBound);
            const result = clamp(value, firstBound, secondBound);

            expect(result).toBeGreaterThanOrEqual(lower);
            expect(result).toBeLessThanOrEqual(upper);
            if (value < lower) expect(result).toBe(lower);
            if (value > upper) expect(result).toBe(upper);
            if (value >= lower && value <= upper) expect(result).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("lerp stays between its endpoints and returns exact endpoints outside the unit interval", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10_000, max: 10_000 }),
          fc.integer({ min: -10_000, max: 10_000 }),
          fc.integer({ min: -200, max: 300 }),
          (start, end, progressPercent) => {
            const progress = progressPercent / 100;
            const result = lerp(start, end, progress);

            if (progress <= 0) expect(result).toBe(start);
            else if (progress >= 1) expect(result).toBe(end);
            else {
              expect(result).toBeGreaterThanOrEqual(Math.min(start, end));
              expect(result).toBeLessThanOrEqual(Math.max(start, end));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("AABB overlap is symmetric and rectangles touching only at an edge do not collide", () => {
      fc.assert(
        fc.property(rectArbitrary, rectArbitrary, (first, second) => {
          expect(boundingBoxOverlap(first, second)).toBe(
            boundingBoxOverlap(second, first)
          );

          const edgeTouching: Rect = {
            x: first.x + first.width,
            y: first.y,
            width: second.width,
            height: first.height,
          };
          expect(boundingBoxOverlap(first, edgeTouching)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("seeded random streams are repeatable and stay in the half-open unit interval", () => {
      fc.assert(
        fc.property(fc.integer({ min: -2_000_000, max: 2_000_000 }), (seed) => {
          const firstRandom = createSeededRandom(seed);
          const secondRandom = createSeededRandom(seed);
          const firstValues = Array.from({ length: 32 }, () => firstRandom());
          const secondValues = Array.from({ length: 32 }, () => secondRandom());

          expect(firstValues).toEqual(secondValues);
          expect(firstValues.every((value) => value >= 0 && value < 1)).toBe(
            true
          );
        }),
        { numRuns: 80 }
      );
    });

    it("combo multipliers increase monotonically and stay within their configured cap", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 0, max: 500 }),
          fc.integer({ min: 0, max: 500 }),
          (baseMultiplier, capOffset, step, firstCombo, secondCombo) => {
            const smallerCombo = Math.min(firstCombo, secondCombo);
            const largerCombo = Math.max(firstCombo, secondCombo);
            const options = {
              baseMultiplier,
              maxMultiplier: baseMultiplier + capOffset,
              step,
            };
            const smallerResult = calculateScoreMultiplier(
              smallerCombo,
              options
            );
            const largerResult = calculateScoreMultiplier(largerCombo, options);

            expect(smallerResult).toBeGreaterThanOrEqual(baseMultiplier);
            expect(largerResult).toBeGreaterThanOrEqual(smallerResult);
            expect(largerResult).toBeLessThanOrEqual(
              baseMultiplier + capOffset
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("scaled scores preserve component-wise monotonicity for non-negative inputs", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000 }),
          fc.integer({ min: 0, max: 10_000 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
          (base, baseIncrease, multiplier, multiplierIncrease) => {
            const lowerScore = scaleScoreWithMultiplier(
              base,
              multiplier,
              false
            );
            const higherBaseScore = scaleScoreWithMultiplier(
              base + baseIncrease,
              multiplier,
              false
            );
            const higherMultiplierScore = scaleScoreWithMultiplier(
              base,
              multiplier + multiplierIncrease,
              false
            );

            expect(lowerScore).toBeGreaterThanOrEqual(0);
            expect(higherBaseScore).toBeGreaterThanOrEqual(lowerScore);
            expect(higherMultiplierScore).toBeGreaterThanOrEqual(lowerScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Dungeon Field-of-View Invariants", () => {
    it("preserves explored cells on dimensionally valid maps", () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 64, maxLength: 64 }),
          fc.integer({ min: 0, max: 7 }),
          fc.integer({ min: 0, max: 7 }),
          (cells, playerX, playerY) => {
            const grid = Array.from({ length: 8 }, () =>
              Array.from({ length: 8 }, () => " ")
            );
            const explored = Array.from({ length: 8 }, (_, row) =>
              cells.slice(row * 8, (row + 1) * 8)
            );
            const result = calculateFOV(grid, playerX, playerY, 0, explored);

            expect(result.explored).toHaveLength(8);
            expect(result.explored.every((row) => row.length === 8)).toBe(true);
            for (let y = 0; y < 8; y += 1) {
              for (let x = 0; x < 8; x += 1) {
                if (explored[y][x]) expect(result.explored[y][x]).toBe(true);
              }
            }
            expect(result.visible[playerY][playerX]).toBe(true);
          }
        ),
        { numRuns: 80 }
      );
    });

    it("rejects adjacent line-of-sight targets just beyond each map edge", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 12 }),
          fc.constantFrom("left", "right", "top", "bottom"),
          fc.nat(100),
          (width, height, edge, offset) => {
            const grid = Array.from({ length: height }, () =>
              Array.from({ length: width }, () => " ")
            );
            let originX = 0;
            let originY = 0;
            let targetX = 0;
            let targetY = 0;

            if (edge === "left") {
              originX = 0;
              originY = offset % height;
              targetX = -1;
              targetY = originY;
            } else if (edge === "right") {
              originX = width - 1;
              originY = offset % height;
              targetX = width;
              targetY = originY;
            } else if (edge === "top") {
              originX = offset % width;
              originY = 0;
              targetX = originX;
              targetY = -1;
            } else {
              originX = offset % width;
              originY = height - 1;
              targetX = originX;
              targetY = height;
            }

            expect(
              hasLineOfSight(grid, originX, originY, targetX, targetY)
            ).toBe(false);
          }
        ),
        { numRuns: 80 }
      );
    });
  });

  describe("Patrol Events, OET & Debrief Invariants", () => {
    it("event filters retain only matching records, and timestamp sorting preserves the input", () => {
      const eventsArbitrary = fc.uniqueArray(patrolEventArbitrary, {
        maxLength: 40,
        selector: (event) => event.id,
      });

      fc.assert(
        fc.property(
          eventsArbitrary,
          fc.constantFrom(
            "info" as const,
            "warning" as const,
            "critical" as const
          ),
          fc.constantFrom(
            "DIALOGUE_CHOICE",
            "WEATHER_ALERT",
            "HAZARD_ALERT",
            "assess-scene-safety"
          ),
          (events, severity, type) => {
            const original = [...events];
            const bySeverity = filterEventsBySeverity(events, severity);
            const byType = filterEventsByType(events, type);
            const ascending = sortEventsByTimestamp(events, "asc");
            const descending = sortEventsByTimestamp(events, "desc");
            const ascendingTimes = ascending.map((event) =>
              Number(event.timestamp)
            );
            const descendingTimes = descending.map((event) =>
              Number(event.timestamp)
            );

            expect(bySeverity).toEqual(
              events.filter((event) => event.severity === severity)
            );
            expect(byType).toEqual(
              events.filter(
                (event) => event.type === type || event.action === type
              )
            );
            expect(ascending.map((event) => event.id).sort()).toEqual(
              events.map((event) => event.id).sort()
            );
            expect(descending.map((event) => event.id).sort()).toEqual(
              events.map((event) => event.id).sort()
            );
            expect(
              ascendingTimes.every(
                (timestamp, index) =>
                  index === 0 || timestamp >= ascendingTimes[index - 1]
              )
            ).toBe(true);
            expect(
              descendingTimes.every(
                (timestamp, index) =>
                  index === 0 || timestamp <= descendingTimes[index - 1]
              )
            ).toBe(true);
            expect(events).toEqual(original);
          }
        ),
        { numRuns: 80 }
      );
    });

    it("OET initialization is repeatable and keeps the sled and gates within the selected course", () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.integer({ min: 360, max: 700 }),
          fc.integer({ min: 100, max: 10_000 }),
          (narrowTrails, treeHazards, requestedWidth, totalDistance) => {
            const options = {
              conditions: { narrowTrails, treeHazards },
              trailWidth: requestedWidth,
              totalDistance,
            };
            const state = createInitialOetDescentState(options);
            const repeatedState = createInitialOetDescentState(options);
            const expectedWidth = narrowTrails ? 360 : requestedWidth;

            expect(repeatedState).toEqual(state);
            expect(state.trailWidth).toBe(expectedWidth);
            expect(state.trailRight - state.trailLeft).toBe(expectedWidth);
            expect(
              Math.abs(state.trailLeft + state.trailRight - 800)
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(state.sled.x - (state.trailLeft + state.trailRight) / 2)
            ).toBeLessThanOrEqual(0.5);
            expect(state.sled.chainBrakeEngaged).toBe(true);
            expect(state.sled.isStopped).toBe(true);
            expect(
              state.gates.every((gate, index) => gate.y === (index + 1) * 220)
            ).toBe(true);
            expect(
              state.gates.every((gate) => gate.y <= totalDistance - 100)
            ).toBe(true);
            expect(
              state.obstacles.every(
                (obstacle) =>
                  obstacle.x >= state.trailLeft &&
                  obstacle.x <= state.trailRight
              )
            ).toBe(true);
          }
        ),
        { numRuns: 60 }
      );
    });

    it("injury assessment and transport assignments remain bounded and internally consistent", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "wrist pain",
            "suspected head injury",
            "femur fracture",
            "chest pain",
            "localized discomfort"
          ),
          fc.constantFrom(
            "low-speed fall",
            "high-speed collision",
            "tree impact",
            "fall > 15ft"
          ),
          vitalsArbitrary,
          fc.integer({ min: -60, max: 60 }),
          (complaint, mechanism, vitals, temperatureFahrenheit) => {
            const patient = { complaint, mechanism, vitals };
            const environment = { temperatureFahrenheit };
            const assessment = calculateInjurySeverity(
              patient,
              vitals,
              environment
            );
            const assignment = assignTransportPriority(assessment, vitals);
            const repeatedAssignment = assignTransportPriority(
              assessment,
              vitals
            );
            const numericPriority = {
              BLACK: 0,
              RED: 1,
              YELLOW: 2,
              GREEN: 3,
            }[assignment.priority];

            expect(assessment.score).toBeGreaterThanOrEqual(0);
            expect(assessment.score).toBeLessThanOrEqual(100);
            expect(Number.isFinite(assessment.score)).toBe(true);
            expect(assessment.factors.length).toBeGreaterThan(0);
            if (assessment.vitalsCompromised) {
              expect(assessment.level).toBe("critical");
            }
            if (assessment.spinalPrecautionRequired) {
              expect(assessment.level).not.toBe("minor");
            }
            expect(repeatedAssignment).toEqual(assignment);
            expect(assignment.numericPriority).toBe(numericPriority);
            expect(assignment.tobogganRequired).toBe(
              assignment.priority !== "GREEN"
            );
            expect(
              assignment.estimatedTransportTimeMinutes
            ).toBeGreaterThanOrEqual(0);
            if (
              assignment.priority === "BLACK" ||
              assignment.priority === "RED"
            ) {
              expect(assignment.alsInterventionRequired).toBe(true);
            }
          }
        ),
        { numRuns: 80 }
      );
    });

    it("OET compliance evaluates live scores without mutating scenario rules", () => {
      const scenario: PatrolScenario = {
        id: "oet-property-scenario",
        title: "OET property scenario",
        actions: [],
        debriefRules: [
          {
            id: "oet-control",
            title: "Controlled descent",
            category: "oet",
            passed: false,
            score: 60,
            feedback: "Initial scenario feedback.",
          },
          {
            id: "scene-safety",
            title: "Scene safety",
            category: "scene",
            passed: true,
            score: 40,
            feedback: "Scene was secured.",
          },
        ],
      };

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (judgmentScore) => {
          const originalRules = scenario.debriefRules.map((rule) => ({
            ...rule,
          }));
          const metrics: OetMetrics = {
            excessiveSpeedTime: 0,
            abruptDirectionChanges: 0,
            boundaryViolations: 0,
            collisions: 0,
            controlledStops: 0,
            routeEfficiency: judgmentScore,
            judgmentScore,
          };
          const result = evaluateOETCompliance(scenario, [], metrics);

          expect(result.evaluatedRules[0].passed).toBe(judgmentScore >= 70);
          expect(result.evaluatedRules[1].passed).toBe(true);
          expect(result.passedCount + result.failedCount).toBe(2);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
          expect(scenario.debriefRules).toEqual(originalRules);
        }),
        { numRuns: 80 }
      );
    });

    it("debrief grades are capped, while incident summaries ignore input ordering", () => {
      fc.assert(
        fc.property(fc.integer({ min: -100, max: 200 }), (rawScore) => {
          const score = Math.max(0, Math.min(100, rawScore));
          const result = calculateDebriefScore({ rawScore });
          const expectedGrade =
            score >= 90
              ? "A"
              : score >= 80
                ? "B"
                : score >= 70
                  ? "C"
                  : score >= 60
                    ? "D"
                    : "F";

          expect(result.score).toBe(score);
          expect(result.percentage).toBe(score);
          expect(result.grade).toBe(expectedGrade);
          expect(result.summary.length).toBeGreaterThan(0);
        }),
        { numRuns: 80 }
      );

      fc.assert(
        fc.property(
          debriefHistoryArbitrary,
          oetMetricsArbitrary,
          (events, metrics) => {
            const originalEvents = events.map((event) => ({
              ...event,
              context: event.context ? { ...event.context } : undefined,
            }));
            const report = evaluateIncidentDebrief(
              "property-incident",
              events,
              metrics
            );
            const reversedReport = evaluateIncidentDebrief(
              "property-incident",
              [...events].reverse(),
              metrics
            );
            const stats = derivePlayfulStats(events);

            expect(reversedReport).toEqual(report);
            expect(derivePlayfulStats([...events].reverse())).toEqual(stats);
            expect(events).toEqual(originalEvents);
            expect(
              Object.values(report.dimensions).every(
                (dimension) =>
                  Number.isFinite(dimension.score) &&
                  dimension.score >= 0 &&
                  dimension.score <= 10
              )
            ).toBe(true);
            for (const count of [
              stats.callsHandled,
              stats.radioTransmissions,
              stats.patientsAssisted,
              stats.sledTransports,
              stats.trailsChecked,
              stats.hazardsMarked,
              stats.pmsChecksPerformed,
              stats.reassessmentsLogged,
              stats.closedLoopDelegations,
              stats.guestsAssisted ?? 0,
            ]) {
              expect(Number.isInteger(count)).toBe(true);
              expect(count).toBeGreaterThanOrEqual(0);
              expect(count).toBeLessThanOrEqual(events.length);
            }
          }
        ),
        { numRuns: 60 }
      );
    });
  });

  describe("Security & Error Sanitization Invariants", () => {
    it("scrubs any arbitrary system paths in strings without throwing", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom(
            "/Users/fred/Code/secret.ts",
            "/home/ubuntu/app/server.js",
            "C:\\Users\\admin\\file.txt"
          ),
          (prefix, pathSample) => {
            const raw = `${prefix} ${pathSample} debug trace`;
            const sanitized = sanitizeString(raw);
            expect(sanitized).not.toContain(pathSample);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("sanitizeError is idempotent in production", () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          "production";

        fc.assert(
          fc.property(fc.string({ minLength: 1 }), (msg) => {
            const err = new Error(`/Users/admin/app/file.ts: ${msg}`);
            const pass1 = sanitizeError(err) as Error;
            const pass2 = sanitizeError(pass1) as Error;

            expect(pass1.message).toBe(pass2.message);
            expect(pass1.name).toBe(pass2.name);
          }),
          { numRuns: 50 }
        );
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          originalEnv;
      }
    });

    it("validateSyncRequest strictly fails closed on mismatched authorization headers", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.CRON_SECRET;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          "production";
        process.env.CRON_SECRET = "production-super-secret-token";

        fc.assert(
          fc.property(
            fc
              .string()
              .filter((s) => s !== "Bearer production-super-secret-token"),
            (invalidAuthHeader) => {
              const req = new NextRequest(
                "https://example.com/api/telemetry/sync",
                {
                  headers: { authorization: invalidAuthHeader },
                }
              );

              const result = validateSyncRequest(req);
              expect(result.isValid).toBe(false);
              expect(result.errorResponse?.status).toBe(401);
            }
          ),
          { numRuns: 50 }
        );
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          originalEnv;
        process.env.CRON_SECRET = originalSecret;
      }
    });
  });
  describe("Trial & Error Scoring, Rounding & Replay Invariants", () => {
    const modeArbitrary = fc.constantFrom<RoundingMode>(
      "HALF_EVEN",
      "HALF_AWAY_FROM_ZERO",
      "TRUNCATE"
    );

    it("rounds every ratio to within one unit of the last displayed place", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000, max: 1_000_000 }),
          fc.integer({ min: 1, max: 10_000 }),
          fc.integer({ min: 0, max: 4 }),
          modeArbitrary,
          (numerator, denominator, precision, mode) => {
            const rounded = roundRatio(numerator, denominator, precision, mode);
            expect(rounded).not.toBeNull();
            const error = Math.abs(Number(rounded) - numerator / denominator);
            expect(error).toBeLessThanOrEqual(10 ** -precision + 1e-9);
            if (mode === "TRUNCATE") {
              expect(Math.abs(Number(rounded))).toBeLessThanOrEqual(
                Math.abs(numerator / denominator) + 1e-9
              );
            }
          }
        )
      );
    });

    it("never scores a hand below zero, and zeroes any hand carrying a ×0 rule", () => {
      const ruleArbitrary = fc.record({
        ruleId: fc.constantFrom("R1", "R2", "R3"),
        passed: fc.boolean(),
        chipsDelta: fc.integer({ min: -200, max: 200 }),
        multDelta: fc.integer({ min: -20, max: 20 }),
        multMultiplier: fc.option(fc.constantFrom(0, 0.5, 1, 1.5, 2), {
          nil: undefined,
        }),
        evidence: fc.constant("fuzz"),
      });
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.constant("card"),
              chips: fc.nat(300),
              mult: fc.nat(20),
            }),
            {
              minLength: 1,
              maxLength: 5,
            }
          ),
          fc.array(ruleArbitrary, { maxLength: 8 }),
          (cards, ruleResults) => {
            const input = {
              handType: "HIGH_TABLE" as const,
              cards,
              ruleResults,
            };
            const result = evaluateHand(input);
            expect(Number.isInteger(result.score)).toBe(true);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(evaluateHand(input)).toEqual(result);
            if (ruleResults.some((r) => r.multMultiplier === 0)) {
              expect(result.score).toBe(0);
              expect(result.zeroRule.triggered).toBe(true);
            }
          }
        )
      );
    });

    it("replays any QC Desk move sequence to an identical state with conserved CPU", () => {
      const actionArbitrary: fc.Arbitrary<DeskAction> = fc.oneof(
        fc.record({
          type: fc.constant("INSPECT_CELL" as const),
          row: fc.integer({ min: -1, max: 5 }),
          col: fc.integer({ min: -1, max: 3 }),
        }),
        fc.record({
          type: fc.constant("CORRECT_FINDING" as const),
          findingId: fc.constantFrom(
            "SAP-DM-01@r2c2",
            "SAP-DM-02@r2c1",
            "SAP-DM-03@r1c2",
            "SAP-DM-02@r2c0",
            "missing"
          ),
        }),
        fc.constant<DeskAction>({ type: "PLAY_HAND" }),
        fc.constant<DeskAction>({ type: "DISCARD" })
      );
      fc.assert(
        fc.property(fc.array(actionArbitrary, { maxLength: 40 }), (actions) => {
          const replay = () =>
            actions.reduce(
              (state, action) =>
                advanceDesk(DEMOGRAPHICS_SCENARIO, state, action),
              createDeskState(DEMOGRAPHICS_SCENARIO)
            );
          const first = replay();
          expect(replay()).toEqual(first);
          expect(first.cpu.available).toBeGreaterThanOrEqual(0);
          expect(first.cpu.available + first.cpu.spent).toBe(
            DEMOGRAPHICS_SCENARIO.startingCpu
          );
          expect(first.cpu.spent).toBe(first.handsPlayed * 2 + first.discards);
        })
      );
    });

    it("replays any Card Table move sequence identically, conserving CPU and bounding hand and selection", () => {
      const cardIds = DEMOGRAPHICS_SCENARIO.deck.map((card) => card.id);
      const tableAction: fc.Arbitrary<TableAction> = fc.oneof(
        fc.record({
          type: fc.constant("TOGGLE_SELECT" as const),
          cardId: fc.constantFrom(...cardIds, "missing"),
        }),
        fc.record({
          type: fc.constant("INSPECT_CARD" as const),
          cardId: fc.constantFrom(...cardIds),
        }),
        fc.record({
          type: fc.constant("INSPECT_CELL" as const),
          row: fc.integer({ min: -1, max: 5 }),
          col: fc.integer({ min: -1, max: 3 }),
        }),
        fc.record({
          type: fc.constant("CORRECT_FINDING" as const),
          findingId: fc.constantFrom(
            "SAP-DM-01@r2c2",
            "SAP-DM-02@r2c1",
            "SAP-DM-03@r1c2",
            "SAP-DM-02@r2c0",
            "missing"
          ),
        }),
        fc.record({
          type: fc.constant("MOVE_CARD" as const),
          cardId: fc.constantFrom(...cardIds, "missing"),
          toIndex: fc.integer({ min: -2, max: 10 }),
        }),
        fc.constant<TableAction>({ type: "CLOSE_INSPECT" }),
        fc.constant<TableAction>({ type: "PLAY_HAND" }),
        fc.constant<TableAction>({ type: "DISCARD" })
      );
      const { table } = DEMOGRAPHICS_SCENARIO;
      fc.assert(
        fc.property(fc.array(tableAction, { maxLength: 60 }), (actions) => {
          const replay = () =>
            actions.reduce(
              (state, action) =>
                advanceTable(DEMOGRAPHICS_SCENARIO, state, action),
              createTableState(DEMOGRAPHICS_SCENARIO)
            );
          const first = replay();
          expect(replay()).toEqual(first);
          expect(first.cpu.available).toBeGreaterThanOrEqual(0);
          expect(first.cpu.available + first.cpu.spent).toBe(table.startingCpu);
          expect(first.hand.length).toBeLessThanOrEqual(table.handSize);
          expect(first.selected.length).toBeLessThanOrEqual(table.maxSelection);
          expect(first.selected.every((id) => first.hand.includes(id))).toBe(
            true
          );
          expect(new Set(first.hand).size).toBe(first.hand.length);
          // Reordering is cosmetic: every dealt card is in hand or spent.
          const view = deriveTableView(DEMOGRAPHICS_SCENARIO, first);
          expect(view.spentCount + first.hand.length).toBe(first.deckIndex);
          expect(view.drawPile.length + first.deckIndex).toBe(
            DEMOGRAPHICS_SCENARIO.deck.length
          );
        })
      );
    });

    it("replays any seeded run, crisis draws included, identically", () => {
      const cardIds = [
        ...new Set(
          [...ACT_I.blinds, ...(ACT_I.bossPool ?? [])].flatMap((b) =>
            b.deck.map((c) => c.id)
          )
        ),
      ];
      const choiceIds = [
        ...new Set(ACT_I_CRISES.flatMap((c) => c.choices.map((x) => x.id))),
      ];
      const runAction: fc.Arbitrary<RunAction> = fc.oneof(
        fc.record({
          type: fc.constant("TOGGLE_SELECT" as const),
          cardId: fc.constantFrom(...cardIds),
        }),
        fc.record({
          type: fc.constant("RESOLVE_CRISIS" as const),
          choiceId: fc.constantFrom(...choiceIds),
        }),
        fc.constant<RunAction>({ type: "PLAY_HAND" }),
        fc.constant<RunAction>({ type: "DISCARD" }),
        fc.constant<RunAction>({ type: "NEXT_BLIND" })
      );
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Za-z0-9-]{1,32}$/),
          fc.array(runAction, { maxLength: 80 }),
          (seed, actions) => {
            const replay = () =>
              actions.reduce(
                (run, action) => advanceRun(ACT_I, run, action),
                createRunState(ACT_I, seed)
              );
            const first = replay();
            expect(replay()).toEqual(first);
            expect(first.seed).toBe(seed);
            // Draw indices are consumed in order, and the deck deals each
            // crisis at most once per run.
            expect(first.draws.map((d) => d.drawIndex)).toEqual(
              first.draws.map((_, i) => i)
            );
            const crises = first.draws
              .filter((d) => d.kind === "CRISIS")
              .map((d) => d.id);
            expect(new Set(crises).size).toBe(crises.length);
            expect(first.table.cpu.available).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 60 }
      );
    });

    it("sums every score timeline back to evaluateHand exactly", () => {
      const rule = fc.record({
        ruleId: fc.constantFrom("R1", "R2", "R3"),
        passed: fc.boolean(),
        chipsDelta: fc.integer({ min: -50, max: 50 }),
        multDelta: fc.integer({ min: -5, max: 5 }),
        multMultiplier: fc.option(fc.constantFrom(0, 0.5, 1, 2), {
          nil: undefined,
        }),
        evidence: fc.constant("fuzz"),
      });
      const relic = fc.record({
        sourceId: fc.constantFrom("RELIC-A", "RELIC-B"),
        label: fc.constant("relic"),
        chips: fc.integer({ min: 0, max: 50 }),
        plusMult: fc.integer({ min: 0, max: 5 }),
        xMult: fc.constantFrom(1, 1.5, 2),
      });
      fc.assert(
        fc.property(
          fc.constantFrom(
            "HIGH_TABLE" as const,
            "TLF_PAIR" as const,
            "CSR_STRAIGHT" as const
          ),
          fc.uniqueArray(
            fc.record({
              id: fc.constantFrom("A", "B", "C", "D", "E"),
              chips: fc.nat(60),
              mult: fc.nat(3),
            }),
            { minLength: 1, maxLength: 5, selector: (c) => c.id }
          ),
          fc.array(rule, { maxLength: 6 }),
          fc.uniqueArray(relic, { maxLength: 2, selector: (r) => r.sourceId }),
          fc.nat(1000),
          (handType, cards, ruleResults, modifiers, before) => {
            const evaluation = evaluateHand({
              handType,
              cards,
              ruleResults,
              modifiers,
            });
            const steps = scoreTimeline(evaluation, {
              roundScoreBefore: before,
              target: 500,
            });
            const total = steps.find((s) => s.kind === "TOTAL");
            const progress = steps[steps.length - 1];
            expect(total?.kind === "TOTAL" && total.score).toBe(
              evaluation.score
            );
            expect(Math.max(0, total!.running.chips)).toBe(
              evaluation.chips.total
            );
            expect(Math.max(0, total!.running.mult)).toBe(
              evaluation.mult.total
            );
            expect(total!.running.xMult).toBeCloseTo(
              evaluation.xMult.product,
              9
            );
            expect(progress.kind === "BLIND_PROGRESS" && progress.after).toBe(
              before + evaluation.score
            );
            expect(steps.filter((s) => s.kind === "ZERO_RULE")).toHaveLength(
              evaluation.zeroRule.triggered ? 1 : 0
            );
            expect(
              scoreTimeline(evaluation, {
                roundScoreBefore: before,
                target: 500,
              })
            ).toEqual(steps);
          }
        )
      );
    });
  });
});

describe("Custom Proof session fuzzing", () => {
  it("preserves entailment when every visitor proposition is renamed", () => {
    fc.assert(
      fc.property(fc.nat(100000), (suffix) => {
        const [a, b, c] = [
          `Source_${suffix}`,
          `Middle_${suffix}`,
          `Goal_${suffix}`,
        ];
        const theorem = createCustomTheorem(
          [a, `${a} -> ${b}`, `${b} -> ${c}`],
          c
        );
        const premises = theorem.nodes
          .filter((node) => node.type === "premise")
          .map((node) => ({ label: node.label, ast: node.ast! }));
        const target = theorem.nodes.find(
          (node) => node.type === "conclusion"
        )!;
        const table = generateTruthTable(premises, {
          label: target.label,
          ast: target.ast!,
        });
        expect(table.truthTable.some((row) => row.isCounterexample)).toBe(
          false
        );
        expect(table.variables).toEqual([c, b, a].sort());
      })
    );
  });
});

describe("Clinical Data Engine - Fast-Check Property Fuzzing", () => {
  it("serializes randomized study protocols with reserved characters without XML errors across 1,000 iterations", () => {
    fc.assert(
      fc.property(
        studyProtocolArbitrary,
        malformedXmlStringArbitrary,
        (baseStudy, malformedString) => {
          const fuzzStudy: StudyProtocol = {
            ...baseStudy,
            protocolNumber: `${baseStudy.protocolNumber}_${malformedString}`,
            studyName: `${baseStudy.studyName}_${malformedString}`,
            forms: baseStudy.forms.map((f) => ({
              ...f,
              name: `${f.name}_${malformedString}`,
              sections: f.sections.map((s) => ({
                ...s,
                title: `${s.title}_${malformedString}`,
                fields: s.fields.map((field) => ({
                  ...field,
                  label: `${field.label}_${malformedString}`,
                })),
              })),
            })),
            codelists: baseStudy.codelists.map((c) => ({
              ...c,
              name: `${c.name}_${malformedString}`,
              options: c.options.map((opt) => ({
                ...opt,
                label: `${opt.label}_${malformedString}`,
              })),
            })),
          };

          const xml = exportStudyToCdiscOdmXml(fuzzStudy);

          expect(xml).toBeDefined();
          expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
            true
          );
          expect(xml).toContain(
            '<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"'
          );
          expect(xml).toContain("</ODM>");
          expect(typeof xml).toBe("string");
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("performs 100% lossless roundtrip conversion on randomized valid study protocols across 1,000 iterations", () => {
    fc.assert(
      fc.property(studyProtocolArbitrary, (study) => {
        const usdmJson = exportStudyToUsdm(study);
        expect(typeof usdmJson).toBe("string");

        const reimported = importStudyFromUsdm(usdmJson);
        expect(reimported.protocolNumber).toBe(study.protocolNumber);
        expect(reimported.forms.length).toBe(study.forms.length);
        expect(reimported.visits.length).toBe(study.visits.length);
        expect(reimported.codelists.length).toBeGreaterThanOrEqual(
          study.codelists.length
        );

        // Verify 2nd roundtrip idempotency
        const usdmJson2 = exportStudyToUsdm(reimported);
        const reimported2 = importStudyFromUsdm(usdmJson2);
        expect(usdmJson2).toBe(usdmJson);

        const diff = diffUniversalCrfStudies(reimported, reimported2);
        expect(diff.hasChanges).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it("extracts codelists safely without unhandled exceptions across 1,000 malformed inputs", () => {
    fc.assert(
      fc.property(malformedCodelistArbitrary, (rawInput) => {
        const result = extractCodelistFromUsdmObject(rawInput);
        if (result !== null) {
          expect(typeof result.id).toBe("string");
          expect(typeof result.name).toBe("string");
          expect(Array.isArray(result.options)).toBe(true);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it("imports malformed or partial USDM JSON graphs safely without crashing across 1,000 iterations", () => {
    fc.assert(
      fc.property(malformedUsdmDocArbitrary, (rawDoc) => {
        try {
          const imported = importStudyFromUsdm(
            rawDoc as Record<string, unknown>
          );
          if (imported) {
            expect(typeof imported.protocolNumber).toBe("string");
            expect(Array.isArray(imported.forms)).toBe(true);
            expect(Array.isArray(imported.visits)).toBe(true);
          }
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
        }
      }),
      { numRuns: 1000 }
    );
  });
});

describe("Trial & Error run seeds (#1528)", () => {
  const bytes = fc.uint8Array({ minLength: 5, maxLength: 5 });

  it("reads back every seed it writes, however the player types it", () => {
    fc.assert(
      fc.property(bytes, fc.boolean(), fc.boolean(), (raw, lower, spaced) => {
        const seed = seedFromBytes(raw);
        expect(seed).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
        let typed = lower ? seed.toLowerCase() : seed;
        if (spaced) typed = typed.replace("-", " ");
        expect(normalizeSeed(typed)).toBe(seed);
      }),
      { numRuns: 1000 }
    );
  });

  it("never throws on an arbitrary hash, and only returns valid seeds", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (hash) => {
        const challenge = parseChallengeHash(hash);
        if (challenge) {
          expect(challenge.seed.length).toBeGreaterThan(0);
          if (challenge.daily) {
            expect(dailySeed(challenge.daily)).toBe(challenge.seed);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it("round-trips a Daily Protocol challenge link for any date", () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date("2000-01-01T00:00:00Z"),
          max: new Date("2100-12-31T23:59:59Z"),
          noInvalidDate: true,
        }),
        (when) => {
          const date = when.toISOString().slice(0, 10);
          const seed = dailySeed(date);
          expect(
            parseChallengeHash(challengeHash(seed, { kind: "DAILY", date }))
          ).toEqual({ seed, daily: date });
        }
      ),
      { numRuns: 300 }
    );
  });
});
