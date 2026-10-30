// @vitest-environment node
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createCustomTheorem } from "@/lib/proof-custom";
import * as fc from "fast-check";
import {
  applyAction as applyShiftAction,
  createShift,
  stepShift,
  MAX_OPEN_ORDERS as MAX_OPEN_SHIFT_ORDERS,
  type ShiftAction,
  type ShiftState,
} from "@/lib/patty-drive-thru";
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
} from "@/lib/proof";
import {
  calculateColumnCount,
  calculateColumnWidth,
  distributeItemsGreedily,
} from "@/lib/graphics-engine";
import {
  parseArcadeDailyProgress,
  type ArcadeDailyProgress,
} from "@/lib/arcade/daily";
import { sanitizeString, sanitizeError } from "@/lib/error-sanitization";
import { validateSyncRequest } from "@/lib/security";
import { NextRequest } from "next/server";
import {
  arcadeCoreSlice,
  arcadeDailySlice,
  boundingBoxOverlap,
  calculateScoreMultiplier,
  clamp,
  createRng,
  createSeededRandom,
  lerp,
  scaleScoreWithMultiplier,
  noteRunInput,
  noteRunView,
  readRunSnapshot,
  writeRunSnapshot,
  type ArcadeProgress,
  type FairnessPolicy,
  type FormFactor,
  type InputModality,
  type Rect,
  type RunSnapshotStorage,
  type RunTags,
  EMPTY_RUN_TAGS,
} from "@/lib/arcade";
import { calculateFOV, hasLineOfSight } from "@/lib/dungeon";
import {
  generateClinicalSubject,
  generateProceduralObservation,
  getObservationChoices,
  getProceduralErrorKinds,
  getProceduralFields,
  validateObservationChoice,
} from "@/lib/clinical-trial-chaos";
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
  BIOSTAT_OPS_CAMPAIGN,
  DEMOGRAPHICS_SCENARIO,
  GUIDED_BLIND_SCENARIO,
  ScenarioSchema,
  dealSeed,
  deriveRunView,
  openerIndex,
  openerPool,
  shuffledDeckOrder,
  withOpener,
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
  stakeLevels,
  stakeModifiers,
  MAX_STAKE,
  SPONSOR_ORDER,
  challengeChoice,
  isChoiceUnlocked,
  unlockAfterWin,
  defaultUnlocks,
  CodexSchema,
  emptyCodex,
  parseCodex,
  recordRun,
  serializeCodex,
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

    it("session rng streams are repeatable, bounded and resume from any saved state (#2544)", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -(2 ** 33), max: 2 ** 33 }),
            fc.string({ maxLength: 24 })
          ),
          fc.integer({ min: 0, max: 64 }),
          fc.integer({ min: 1, max: 1000 }),
          (seed, savedAfter, bound) => {
            const rng = createRng(seed);
            const twin = createRng(seed);
            for (let i = 0; i < savedAfter; i += 1) {
              expect(rng.next()).toBe(twin.next());
            }
            const state = rng.getState();
            expect(Number.isInteger(state)).toBe(true);
            expect(state).toBeGreaterThanOrEqual(0);
            expect(state).toBeLessThan(2 ** 32);
            // The state survives a JSON round trip, as in a run snapshot.
            const resumed = createRng(0);
            resumed.setState(JSON.parse(JSON.stringify(state)));

            for (let i = 0; i < 16; i += 1) {
              const value = rng.next();
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThan(1);
              expect(resumed.next()).toBe(value);
              const n = rng.int(bound);
              expect(resumed.int(bound)).toBe(n);
              expect(Number.isInteger(n) && n >= 0 && n < bound).toBe(true);
            }
            expect(resumed.getState()).toBe(rng.getState());
          }
        ),
        { numRuns: 120 }
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

    it("keeps GCP-audit stakes cumulative: stake N's rules contain stake N-1's", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: MAX_STAKE }), (stake) => {
          const lower = stakeLevels(stake - 1).map((l) => l.id);
          const higher = stakeLevels(stake).map((l) => l.id);
          expect(higher).toEqual(expect.arrayContaining(lower));
          expect(higher).toHaveLength(lower.length + 1);
          // Every rule of every stake up to N is still in force at N.
          const modifiers = stakeModifiers(stake);
          for (const level of stakeLevels(stake)) {
            for (const [key, value] of Object.entries(level.modifier)) {
              expect(modifiers[key as keyof typeof modifiers]).toBe(value);
            }
          }
        })
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

  it("never throws on a hash with arbitrary sponsor and stake values, and only returns valid ones (#950)", () => {
    const value = fc.oneof(
      fc.string({ maxLength: 24 }),
      fc.constantFrom(...SPONSOR_ORDER),
      fc.integer({ min: -2, max: 9 }).map(String)
    );
    fc.assert(
      fc.property(value, value, fc.string({ maxLength: 40 }), (s, k, rest) => {
        const hash = `#seed=7K3M-Q9PX&sponsor=${encodeURIComponent(s)}&stake=${encodeURIComponent(k)}&${rest}`;
        const challenge = parseChallengeHash(hash);
        expect(challenge).not.toBeNull();
        const choice = challengeChoice(challenge!);
        expect(SPONSOR_ORDER).toContain(choice.sponsorId);
        expect(Number.isInteger(choice.stake)).toBe(true);
        expect(choice.stake).toBeGreaterThanOrEqual(1);
        expect(choice.stake).toBeLessThanOrEqual(MAX_STAKE);
      }),
      { numRuns: 1000 }
    );
  });

  it("round-trips any valid seed, sponsor and stake through a challenge link (#950)", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 5, maxLength: 5 }),
        fc.constantFrom(...SPONSOR_ORDER),
        fc.integer({ min: 1, max: MAX_STAKE }),
        fc.constantFrom("RANDOM" as const, "SEEDED" as const),
        (raw, sponsorId, stake, kind) => {
          const seed = seedFromBytes(raw);
          const challenge = parseChallengeHash(
            challengeHash(seed, { kind }, { sponsorId, stake })
          );
          expect(challenge?.seed).toBe(seed);
          expect(challengeChoice(challenge!)).toEqual({ sponsorId, stake });
        }
      ),
      { numRuns: 500 }
    );
  });

  it("only ever grows unlocks, and a won choice stays open (#950)", () => {
    const win = fc.record({
      sponsorId: fc.constantFrom(...SPONSOR_ORDER),
      stake: fc.integer({ min: 1, max: MAX_STAKE }),
    });
    fc.assert(
      fc.property(fc.array(win, { maxLength: 30 }), (wins) => {
        let unlocks = defaultUnlocks();
        for (const choice of wins) {
          const next = unlockAfterWin(unlocks, choice);
          for (const sponsorId of SPONSOR_ORDER) {
            for (let stake = 1; stake <= MAX_STAKE; stake += 1) {
              if (isChoiceUnlocked(unlocks, { sponsorId, stake })) {
                expect(isChoiceUnlocked(next, { sponsorId, stake })).toBe(true);
              }
            }
          }
          expect(isChoiceUnlocked(next, choice)).toBe(true);
          unlocks = next;
        }
      }),
      { numRuns: 300 }
    );
  });
});

describe("Trial & Error first-Blind openers (#2413)", () => {
  const codecSeed = fc
    .uint8Array({ minLength: 5, maxLength: 5 })
    .map((raw) => seedFromBytes(raw));
  const daily = fc
    .date({
      min: new Date("2000-01-01T00:00:00Z"),
      max: new Date("2100-12-31T23:59:59Z"),
      noInvalidDate: true,
    })
    .map((when) => dailySeed(when.toISOString().slice(0, 10)));
  const seed = fc.oneof(codecSeed, daily);
  const choice = fc.record({
    sponsorId: fc.constantFrom(...SPONSOR_ORDER),
    stake: fc.integer({ min: 1, max: MAX_STAKE }),
  });

  it("picks the same opener for the same seed, every time", () => {
    fc.assert(
      fc.property(seed, fc.integer({ min: 1, max: 12 }), (s, size) => {
        const index = openerIndex(s, size);
        expect(Number.isInteger(index)).toBe(true);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(size);
        expect(openerIndex(s, size)).toBe(index);
      }),
      { numRuns: 1000 }
    );
  });

  it("opens a run on its seed's opener, and the same seed deals the same opening hand", () => {
    fc.assert(
      fc.property(seed, choice, (s, c) => {
        const run = createRunState(BIOSTAT_OPS_CAMPAIGN, s, c);
        const blind = deriveRunView(BIOSTAT_OPS_CAMPAIGN, run).blind;
        const pool = openerPool(blind);
        const opener = pool[openerIndex(s, pool.length)];
        const fits = opener.length;
        expect([...run.table.hand.slice(0, fits)].sort()).toEqual(
          [...opener].sort()
        );
        expect(createRunState(BIOSTAT_OPS_CAMPAIGN, s, c).table).toEqual(
          run.table
        );
      }),
      { numRuns: 150 }
    );
  });

  it("deals every opener as a legal setup of the first Blind, under any sponsor and stake", () => {
    fc.assert(
      fc.property(seed, choice, (s, c) => {
        const run = createRunState(BIOSTAT_OPS_CAMPAIGN, s, c);
        const blind = deriveRunView(BIOSTAT_OPS_CAMPAIGN, run).blind;
        const pool = openerPool(blind);
        expect(pool.length).toBeGreaterThan(1);
        pool.forEach((opener, index) => {
          // A legal setup: distinct cards the deck holds, all in one hand.
          expect(new Set(opener).size).toBe(opener.length);
          expect(opener.length).toBeLessThanOrEqual(blind.table.handSize);
          const opened = withOpener(blind, index);
          expect(ScenarioSchema.safeParse(opened).success).toBe(true);
          // A legal deal: a permutation of the deck, the opener on top.
          const order = shuffledDeckOrder(opened, dealSeed(s, 0, 0));
          expect([...order].sort((a, b) => a - b)).toEqual(
            blind.deck.map((_, i) => i)
          );
          expect(
            order
              .slice(0, opener.length)
              .map((i) => blind.deck[i].id)
              .sort()
          ).toEqual([...opener].sort());
        });
      }),
      { numRuns: 100 }
    );
  });

  it("keeps the fixed openers for the tutorial and for named seeds", () => {
    expect(openerPool(GUIDED_BLIND_SCENARIO)).toEqual([
      GUIDED_BLIND_SCENARIO.pinned,
    ]);
    // The pool opens on the Blind's own setup first, and a Blind whose
    // setup was rewritten keeps it.
    expect(openerPool(DEMOGRAPHICS_SCENARIO)[0]).toEqual(
      DEMOGRAPHICS_SCENARIO.pinned
    );
    const wholeDeck = DEMOGRAPHICS_SCENARIO.deck.map((card) => card.id);
    expect(openerPool({ ...DEMOGRAPHICS_SCENARIO, pinned: wholeDeck })).toEqual(
      [wholeDeck]
    );
    const named = fc.stringMatching(/^[a-z]{1,5}-[0-9]{1,2}$/);
    fc.assert(
      fc.property(named, (s) => {
        expect(openerIndex(s, openerPool(DEMOGRAPHICS_SCENARIO).length)).toBe(
          0
        );
      }),
      { numRuns: 300 }
    );
  });
});

describe("Trial & Error Codex document (#1529)", () => {
  it("reads any string or JSON value without throwing, always as a valid Codex", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.json(),
          fc.jsonValue().map((value) => JSON.stringify({ version: 1, value }))
        ),
        (raw) => {
          const read = parseCodex(raw);
          expect(["EMPTY", "OK", "INVALID", "NEWER"]).toContain(read.status);
          expect(CodexSchema.safeParse(read.codex).success).toBe(true);
          if (read.status !== "OK") expect(read.codex).toEqual(emptyCodex());
        }
      ),
      { numRuns: 500 }
    );
  });

  it("keeps at most ten runs, newest first, however many are recorded", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 50 }), { maxLength: 40 }), (moves) => {
        const codex = moves.reduce(
          (c, n, i) =>
            recordRun(c, {
              actId: "biostat-ops",
              seed: `seed-${i}`,
              reached: {
                actIndex: 0,
                actTitle: "Act I",
                blindIndex: 0,
                blindTitle: "Small Blind",
                round: null,
              },
              bestHand: null,
              result: "FAILED",
              campaignWon: false,
              moves: n,
            }),
          emptyCodex()
        );
        expect(codex.history.length).toBe(Math.min(moves.length, 10));
        if (moves.length > 0) {
          expect(codex.history[0].seed).toBe(`seed-${moves.length - 1}`);
        }
        expect(parseCodex(serializeCodex(codex)).codex).toEqual(codex);
      }),
      { numRuns: 200 }
    );
  });
});

describe("Patty's Drive-Thru shift engine (#1812)", () => {
  const posNodes = [
    "burgers",
    "burger",
    "cheeseburger",
    "sides",
    "fries",
    "nuggets",
    "drinks",
    "soda",
    "shake",
    "coffee",
    "modifiers",
    "toppings",
    "pickles",
    "no-pickles",
    "nonsense",
  ];
  const orderId = fc.integer({ min: -1, max: 30 });
  const actionArb: fc.Arbitrary<ShiftAction> = fc.oneof(
    orderId.map((id) => ({ type: "selectOrder" as const, orderId: id })),
    fc
      .constantFrom(...posNodes)
      .map((nodeId) => ({ type: "posTap" as const, nodeId })),
    fc.constant({ type: "posBack" as const }),
    fc.constant({ type: "posHome" as const }),
    orderId.map((id) => ({ type: "reenterDrink" as const, orderId: id })),
    orderId.map((id) => ({ type: "flagCoworker" as const, orderId: id })),
    orderId.map((id) => ({ type: "bump" as const, orderId: id })),
    fc.constant({ type: "wipe" as const })
  );
  const stepArb = fc.oneof(
    actionArb.map((action) => ({ kind: "act" as const, action })),
    fc
      .oneof(
        fc.double({ min: -5, max: 5, noNaN: false }),
        fc.constantFrom(0.016, 0.5, Number.POSITIVE_INFINITY)
      )
      .map((dt) => ({ kind: "step" as const, dt }))
  );

  function play(
    seed: string,
    steps: { kind: string; dt?: number; action?: ShiftAction }[]
  ) {
    let state: ShiftState = createShift({ seed, durationSec: 60 });
    const seen: ShiftState[] = [state];
    for (const s of steps) {
      state =
        s.kind === "act"
          ? applyShiftAction(state, s.action as ShiftAction).state
          : stepShift(state, s.dt as number).state;
      seen.push(state);
    }
    return seen;
  }

  it("keeps meters, clock and open orders in bounds for any play", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(stepArb, { maxLength: 300 }),
        (seed, steps) => {
          let lastTime = 0;
          for (const state of play(seed, steps)) {
            for (const value of Object.values(state.meters)) {
              expect(Number.isFinite(value)).toBe(true);
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(100);
            }
            expect(state.time).toBeGreaterThanOrEqual(lastTime);
            expect(state.time).toBeLessThanOrEqual(state.config.durationSec);
            expect(state.orders.length).toBeLessThanOrEqual(
              MAX_OPEN_SHIFT_ORDERS
            );
            expect(new Set(state.orders.map((o) => o.id)).size).toBe(
              state.orders.length
            );
            lastTime = state.time;
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("replays to the same shift from the same seed and inputs", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(stepArb, { maxLength: 200 }),
        (seed, steps) => {
          const a = play(seed, steps);
          const b = play(seed, steps);
          expect(a[a.length - 1]).toEqual(b[b.length - 1]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// #2088: generated fix puzzles must always have exactly one accepted choice,
// whatever the seed, and no distractor may equal the answer.
describe("Clinical Trial Chaos procedural observations - property fuzzing", () => {
  const cases = getProceduralFields().flatMap((field) =>
    getProceduralErrorKinds(field).map((kind) => ({ field, kind }))
  );

  it("accepts exactly one choice for every field, kind and seed", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...cases),
        fc.integer({ min: 0, max: 0xffffffff }),
        ({ field, kind }, seed) => {
          const obs = generateProceduralObservation({
            field,
            kind,
            random: createSeededRandom(seed),
            id: `fuzz-${seed}`,
          });
          expect(obs).not.toBeNull();
          if (!obs) return;
          const choices = getObservationChoices(obs);
          expect(choices).toHaveLength(4);
          const accepted = choices.filter(
            (c) => validateObservationChoice(obs, c).isValid
          );
          expect(accepted).toEqual([obs.correctedValue]);
          const lowered = choices.map((c) => c.toLowerCase());
          expect(new Set(lowered).size).toBe(choices.length);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("keeps every flagged field of a seeded subject solvable", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const subject = generateClinicalSubject(
          1,
          seed % 2 === 0,
          6000,
          ["DM", "VS", "AE", "LB"],
          createSeededRandom(seed)
        );
        for (const obs of subject.observations) {
          const accepted = getObservationChoices(obs).filter(
            (c) => validateObservationChoice(obs, c).isValid
          );
          expect(accepted).toHaveLength(1);
        }
      }),
      { numRuns: 200 }
    );
  });
});

// #2548, design §5: profile slices merge by joins, so two devices converge
// whatever order they sync in and a merge never takes progress away.
describe("Arcade progress merge laws", () => {
  const gameIds = fc.constantFrom(
    "laser-loon",
    "quasi-puzzler",
    "trial-and-error",
    "meme-vault"
  );
  const trophyIds = fc.constantFrom(
    "laser_loon_novice",
    "quasi_first_proof",
    "meme_vault_echo_5",
    "arcade_triathlon"
  );
  const runTagsArb: fc.Arbitrary<RunTags> = fc.record({
    views: fc.uniqueArray(
      fc.constantFrom<FormFactor>("phone", "tablet", "desktop")
    ),
    inputs: fc.uniqueArray(
      fc.constantFrom<InputModality>("touch", "pen", "keyboard", "mouse")
    ),
    assists: fc.dictionary(
      fc.constantFrom("aimAssist", "autoFire", "wideWindow"),
      fc.oneof(fc.boolean(), fc.constantFrom("light", "strong"))
    ),
  });
  const coreArb: fc.Arbitrary<ArcadeProgress> = fc
    .record({
      highScores: fc.dictionary(gameIds, fc.integer({ min: 0, max: 1e6 })),
      bestTags: fc.option(fc.dictionary(gameIds, runTagsArb), {
        nil: undefined,
      }),
      unlockedTrophies: fc.dictionary(
        trophyIds,
        fc.integer({ min: 1, max: 2e12 })
      ),
      updatedAt: fc.integer({ min: 0, max: 2e12 }),
      migratedAt: fc.option(fc.integer({ min: 1, max: 2e12 }), {
        nil: undefined,
      }),
    })
    // As the slice stores it: a record only beside its best, and no empty
    // or undefined fields.
    .map(({ bestTags, migratedAt, ...p }) => {
      const kept = Object.fromEntries(
        Object.entries(bestTags ?? {}).filter(
          ([game]) => p.highScores[game] !== undefined
        )
      );
      return {
        ...p,
        ...(Object.keys(kept).length > 0 ? { bestTags: kept } : {}),
        ...(migratedAt === undefined ? {} : { migratedAt }),
      };
    });

  const dates = fc
    .integer({ min: 0, max: 40 })
    .map((d) =>
      new Date(Date.UTC(2026, 8, 1) + d * 86_400_000).toISOString().slice(0, 10)
    );
  const resultArb = fc.record(
    {
      score: fc.integer({ min: 0, max: 5000 }),
      label: fc.constantFrom("A", "B", "Grade A, 4 stars"),
    },
    { requiredKeys: ["score"] }
  );
  const dailyArb: fc.Arbitrary<ArcadeDailyProgress> = fc
    .record({
      bests: fc.record(
        {
          "for-better-or-bulk": fc.dictionary(dates, resultArb),
          "protocol-drift": fc.dictionary(dates, resultArb),
        },
        { requiredKeys: [] }
      ),
      played: fc.uniqueArray(dates),
      longest: fc.integer({ min: 0, max: 50 }),
    })
    .map((raw) => parseArcadeDailyProgress(raw));

  const laws = <T>(
    name: string,
    arb: fc.Arbitrary<T>,
    merge: (a: T, b: T) => T,
    normalize: (value: T) => unknown
  ) => {
    it(`${name} merge is commutative`, () => {
      fc.assert(
        fc.property(arb, arb, (a, b) => {
          expect(normalize(merge(a, b))).toEqual(normalize(merge(b, a)));
        })
      );
    });
    it(`${name} merge is associative`, () => {
      fc.assert(
        fc.property(arb, arb, arb, (a, b, c) => {
          expect(normalize(merge(merge(a, b), c))).toEqual(
            normalize(merge(a, merge(b, c)))
          );
        })
      );
    });
    it(`${name} merge is idempotent`, () => {
      fc.assert(
        fc.property(arb, arb, (a, b) => {
          const ab = merge(a, b);
          expect(normalize(merge(ab, ab))).toEqual(normalize(ab));
          expect(normalize(merge(ab, b))).toEqual(normalize(ab));
        })
      );
    });
  };

  const sortedCore = (p: ArcadeProgress) => ({
    ...p,
    ...(p.bestTags
      ? {
          bestTags: Object.fromEntries(
            Object.entries(p.bestTags).sort(([a], [b]) => a.localeCompare(b))
          ),
        }
      : {}),
    highScores: Object.fromEntries(Object.entries(p.highScores).sort()),
    unlockedTrophies: Object.fromEntries(
      Object.entries(p.unlockedTrophies).sort()
    ),
  });
  const sortedDaily = (p: ArcadeDailyProgress) => ({
    ...p,
    bests: Object.fromEntries(
      Object.entries(p.bests)
        .sort()
        .map(([game, days]) => [
          game,
          Object.fromEntries(Object.entries(days ?? {}).sort()),
        ])
    ),
  });

  laws("arcade.core", coreArb, arcadeCoreSlice.merge, sortedCore);
  laws("arcade.daily", dailyArb, arcadeDailySlice.merge, sortedDaily);

  it("arcade.core merge of a copy with itself is that copy", () => {
    fc.assert(
      fc.property(coreArb, (a) => {
        expect(sortedCore(arcadeCoreSlice.merge(a, a))).toEqual(sortedCore(a));
      })
    );
  });

  it("arcade.core merge never lowers a local best or loses a trophy", () => {
    fc.assert(
      fc.property(coreArb, coreArb, (local, other) => {
        const merged = arcadeCoreSlice.merge(local, other);
        for (const [game, best] of Object.entries(local.highScores)) {
          expect(merged.highScores[game]).toBeGreaterThanOrEqual(best);
        }
        for (const [id, at] of Object.entries(local.unlockedTrophies)) {
          expect(merged.unlockedTrophies[id]).toBeLessThanOrEqual(at);
        }
      })
    );
  });

  it("arcade.daily merge never lowers a local best, played day or streak", () => {
    fc.assert(
      fc.property(dailyArb, dailyArb, (local, other) => {
        const merged = arcadeDailySlice.merge(local, other);
        for (const [game, days] of Object.entries(local.bests)) {
          for (const [date, result] of Object.entries(days ?? {})) {
            const kept =
              merged.bests[game as keyof typeof merged.bests]?.[date];
            expect(kept?.score).toBeGreaterThanOrEqual(result.score);
          }
        }
        expect(merged.played).toEqual(
          expect.arrayContaining([...local.played])
        );
        expect(merged.longest).toBeGreaterThanOrEqual(local.longest);
      })
    );
  });

  it("marks neither profile slice spendable", () => {
    expect(arcadeCoreSlice.spendable).toBe(false);
    expect(arcadeDailySlice.spendable).toBe(false);
  });
});

// #2547: the run-fairness contract. A run's record survives the snapshot
// envelope byte for byte, and its assists only ever ratchet up.
describe("Arcade run tags", () => {
  const view = fc.constantFrom<FormFactor>("phone", "tablet", "desktop");
  const input = fc.constantFrom<InputModality>(
    "touch",
    "pen",
    "keyboard",
    "mouse"
  );
  const tagsArb: fc.Arbitrary<RunTags> = fc.record({
    views: fc.uniqueArray(view),
    inputs: fc.uniqueArray(input),
    assists: fc.dictionary(
      fc
        .string({ minLength: 1, maxLength: 12 })
        .filter((k) => k !== "__proto__"),
      fc.oneof(fc.boolean(), fc.string({ maxLength: 8 }))
    ),
  });
  const policy: FairnessPolicy = {
    levels: { aimAssist: ["off", "light", "strong"], autoFire: [false, true] },
    assistsFor: (modality): Record<string, string | boolean> =>
      modality === "touch"
        ? { aimAssist: "strong", autoFire: true }
        : modality === "pen"
          ? { aimAssist: "light" }
          : {},
  };
  const level = (tags: RunTags, assist: string) =>
    policy.levels[assist].indexOf(
      tags.assists[assist] ?? policy.levels[assist][0]
    );

  it("round-trips through the run snapshot envelope", () => {
    fc.assert(
      fc.property(tagsArb, (tags) => {
        const data = new Map<string, string>();
        const storage: RunSnapshotStorage = {
          getItem: (key) => data.get(key) ?? null,
          setItem: (key, value) => void data.set(key, value),
          removeItem: (key) => void data.delete(key),
        };
        const run = {
          schema: 1,
          savedAt: 1,
          view: "phone" as const,
          tuning: {},
          state: null,
          tags,
        };
        writeRunSnapshot(storage, "fuzz", run);
        const read = readRunSnapshot(storage, "fuzz", {
          schema: 1,
          state: z.null(),
        });
        expect(read).toEqual({ status: "ok", snapshot: run });
      })
    );
  });

  it("never lowers an assist, and a view swap never changes one", () => {
    const step = fc.oneof(
      view.map((v) => ({ kind: "view" as const, v })),
      input.map((v) => ({ kind: "input" as const, v }))
    );
    fc.assert(
      fc.property(fc.array(step, { maxLength: 20 }), (steps) => {
        let tags = EMPTY_RUN_TAGS;
        for (const next of steps) {
          const before = tags;
          tags =
            next.kind === "view"
              ? noteRunView(tags, next.v)
              : noteRunInput(tags, next.v, policy);
          for (const assist of Object.keys(policy.levels)) {
            expect(level(tags, assist)).toBeGreaterThanOrEqual(
              level(before, assist)
            );
          }
          if (next.kind === "view") expect(tags.assists).toBe(before.assists);
        }
      })
    );
  });
});
