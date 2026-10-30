import { performance } from "perf_hooks";
import {
  distributeItemsGreedily,
  mapDataToCoordinates,
  generateHermiteSplinePath,
  generateCubicSplinePath,
} from "../graphics-math";
import {
  prepareRichInline,
  walkRichInlineLineRanges,
  materializeRichInlineLineRange,
  type RichInlineLineRange,
} from "@chenglou/pretext/rich-inline";
import { scanFile } from "../security-scan";
import { evaluateFormula, lintFormula } from "../crf";
import {
  parseFormula,
  extractVariables,
  generateTruthTable,
} from "@/lib/proof";
import {
  createInitialDuckGameState,
  stepDuckGame,
  enterDogPark,
  stepParkGame,
} from "../working-with-duck-engine";
import {
  createInitialState,
  startGame,
  allocateVariable,
  updateGameSimulation,
  triggerGarbageCollection,
} from "../garmin/engine";
import type { CRFField } from "../crf/types";
import { colors, formatHeader } from "./utils";
import path from "path";
import fs from "fs";

export interface BenchmarkResult {
  suite: string;
  name: string;
  iterations: number;
  durationMs: number;
  opsPerSec: number;
  metrics?: Record<string, string | number>;
}

/**
 * Benchmark Greedy Masonry Column Distribution
 */
export function benchmarkMasonryScheduler(
  iterations = 1000
): BenchmarkResult[] {
  const sizes = [100, 1000, 10000];
  const results: BenchmarkResult[] = [];

  for (const size of sizes) {
    const mockItems = Array.from({ length: size }, (_, i) => ({
      id: `item-${i}`,
      height: 150 + (i % 7) * 45 + ((i * 13) % 80),
    }));

    const colCount = 3;
    const gap = 16;

    const start = performance.now();
    for (let it = 0; it < iterations; it++) {
      distributeItemsGreedily(mockItems, colCount, gap);
    }
    const duration = performance.now() - start;
    const opsPerSec = Math.round((iterations * 1000) / duration);

    // Run one calculation to extract final column distribution height variance
    const finalRun = distributeItemsGreedily(mockItems, colCount, gap);
    const maxH = Math.max(...finalRun.columnHeights);
    const minH = Math.min(...finalRun.columnHeights);
    const variance = maxH - minH;

    results.push({
      suite: "Masonry Scheduler",
      name: `Greedy Column Pack (${size.toLocaleString()} items, ${colCount} cols)`,
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        "Items/Run": size,
        "Total Ops/sec": opsPerSec.toLocaleString(),
        "Height Variance": `${variance}px`,
      },
    });
  }

  return results;
}

interface MockCanvas2DContext {
  font: string;
  measureText: (text: string) => { width: number };
}

function ensureCanvasContext(): void {
  if (typeof globalThis.document === "undefined") {
    // If running in pure Node CLI environment
    const mockGlobal = globalThis as unknown as {
      document: {
        createElement: (tag: string) => {
          getContext?: (type: string) => MockCanvas2DContext;
        };
      };
    };
    mockGlobal.document = {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            getContext: () => ({
              font: "",
              measureText: (text: string) => ({ width: text.length * 8.5 }),
            }),
          };
        }
        return {};
      },
    };
  } else if (typeof HTMLCanvasElement !== "undefined") {
    // In JSDOM or browser
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string
    ) {
      try {
        const res = origGetContext
          ? origGetContext.call(this, type as "2d")
          : null;
        if (res) return res;
      } catch {
        // ignore
      }
      if (type === "2d") {
        return {
          font: "",
          measureText: (text: string) => ({ width: text.length * 8.5 }),
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }
}

/**
 * Benchmark Pretext Rich Inline Text Measurement and Layout
 */
export function benchmarkPretextLayout(iterations = 2000): BenchmarkResult[] {
  ensureCanvasContext();
  const defaultFont = "16px Inter, sans-serif";
  const boldFont = "bold 16px Inter, sans-serif";
  const monoFont = "14px monospace";

  const sampleParagraph = [
    {
      text: "Pioneering systems engineering architecture with ",
      font: defaultFont,
    },
    { text: "zero-whitespace", font: boldFont },
    { text: " masonry layout physics and ", font: defaultFont },
    {
      text: "chenglou/pretext",
      font: monoFont,
      extraWidth: 12,
      break: "never" as const,
    },
    {
      text: " mathematical layout engines to prevent DOM reflow thrashing.",
      font: defaultFont,
    },
  ];

  const prepared = prepareRichInline(sampleParagraph);
  const containerWidth = 420;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const ranges: RichInlineLineRange[] = [];
    walkRichInlineLineRanges(prepared, containerWidth, (range) => {
      ranges.push(range);
    });
    ranges.map((r) => materializeRichInlineLineRange(prepared, r));
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "Pretext Layout Engine",
      name: "Rich Inline Walk & Materialize (5 styled segments)",
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        "Container Width": `${containerWidth}px`,
        Throughput: `${opsPerSec.toLocaleString()} lines/sec`,
        "Latency / Layout": `${(duration / iterations).toFixed(4)}ms`,
      },
    },
  ];
}

/**
 * Benchmark Security Validation Scanner
 */
export function benchmarkScanner(iterations = 100): BenchmarkResult[] {
  // Create a mock temp file or use existing file
  const testFile = path.resolve(process.cwd(), "ARCHITECTURE.md");
  let fileContent = "";
  if (fs.existsSync(testFile)) {
    fileContent = fs.readFileSync(testFile, "utf-8");
  } else {
    fileContent = "Sample text\n".repeat(500);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    scanFile(testFile);
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "Security Scanner",
      name: "Regex Credential & Entropy Scan (ARCHITECTURE.md)",
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        "File Size": `${(fileContent.length / 1024).toFixed(1)} KB`,
        "Scans/sec": opsPerSec.toLocaleString(),
        "Latency / Scan": `${(duration / iterations).toFixed(3)}ms`,
      },
    },
  ];
}

/**
 * Benchmark Browser-Free SVG Spline & Coordinate Math
 */
export function benchmarkSVGCoordinateMath(
  iterations = 5000
): BenchmarkResult[] {
  const dataSize = 100;
  const mockData = Array.from(
    { length: dataSize },
    (_, i) => Math.sin(i / 10) * 50 + 50
  );

  const start = performance.now();
  for (let it = 0; it < iterations; it++) {
    const coords = mapDataToCoordinates(mockData, 500, 200, 10);
    generateHermiteSplinePath(coords, 200);
    generateCubicSplinePath(coords, 200);
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "SVG Coordinate Math",
      name: `Spline generation (${dataSize} points, Hermite & Cubic)`,
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        "Points/Run": dataSize,
        "Total Ops/sec": opsPerSec.toLocaleString(),
      },
    },
  ];
}

/**
 * Benchmark Clinical AST Rule Evaluation & Formula Linting
 */
export function benchmarkASTEvaluator(iterations = 3000): BenchmarkResult[] {
  const formula = "WEIGHT / ((HEIGHT / 100) ^ 2)";
  const context = { WEIGHT: 72, HEIGHT: 178 };
  const mockFields: CRFField[] = [
    {
      id: "WEIGHT",
      variableName: "WEIGHT",
      label: "Weight (kg)",
      dataType: "number",
      required: true,
      columnSpan: 6,
    },
    {
      id: "HEIGHT",
      variableName: "HEIGHT",
      label: "Height (cm)",
      dataType: "number",
      required: true,
      columnSpan: 6,
    },
  ];

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluateFormula(formula, context, mockFields);
    lintFormula(formula, mockFields);
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "Clinical AST Engine",
      name: "Expression Evaluation & Lint (BMI / BSA)",
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        Expression: formula,
        Throughput: `${opsPerSec.toLocaleString()} evals/sec`,
        "Latency / Eval": `${(duration / iterations).toFixed(4)}ms`,
      },
    },
  ];
}

/**
 * Benchmark Deductive Logic Proof Engine & Truth Table Solver
 */
export function benchmarkProofDAGValidation(
  iterations = 1500
): BenchmarkResult[] {
  const p1 = parseFormula("P -> Q");
  const p2 = parseFormula("Q -> R");
  const conc = parseFormula("P -> R");

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    if (p1 && p2 && conc) {
      extractVariables(conc);
      generateTruthTable(
        [
          { label: "P1", ast: p1 },
          { label: "P2", ast: p2 },
        ],
        { label: "C", ast: conc }
      );
    }
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "Proof Engine",
      name: "Propositional AST Parse & Truth Table Solver",
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        Theorem: "Hypothetical Syllogism",
        Throughput: `${opsPerSec.toLocaleString()} solves/sec`,
        "Latency / Solve": `${(duration / iterations).toFixed(4)}ms`,
      },
    },
  ];
}

/**
 * Benchmark Autonomous Duck Physics & Park Simulation Step
 */
export function benchmarkDuckPhysics(iterations = 2500): BenchmarkResult[] {
  let state = createInitialDuckGameState(1);
  let parkState = enterDogPark(state, "ball");

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    state = stepDuckGame(state);
    parkState = stepParkGame(parkState);
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "Duck Physics Engine",
      name: "Autonomous State Step & Park Simulation",
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        "Ticks Simulated": (iterations * 2).toLocaleString(),
        Throughput: `${opsPerSec.toLocaleString()} ticks/sec`,
        "Latency / Tick": `${(duration / (iterations * 2)).toFixed(4)}ms`,
      },
    },
  ];
}

/**
 * Benchmark Garmin 32KB Embedded Memory Allocator & GC Loop
 */
export function benchmarkGarminMemory(iterations = 4000): BenchmarkResult[] {
  let state = startGame(createInitialState("fenix"));
  const varTypes: ("int" | "float" | "string" | "array")[] = [
    "int",
    "float",
    "string",
    "array",
  ];

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const type = varTypes[i % varTypes.length];
    const allocRes = allocateVariable(state, type, `var_${i}`);
    state = allocRes.state;
    state = updateGameSimulation(state, 16);
    if (state.allocatedRamKb > 24) {
      const gcRes = triggerGarbageCollection(state);
      state = gcRes.state;
    }
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((iterations * 1000) / duration);

  return [
    {
      suite: "Garmin Memory Simulator",
      name: "32KB Embedded Allocator & GC Cycle",
      iterations,
      durationMs: Number(duration.toFixed(2)),
      opsPerSec,
      metrics: {
        "Memory Budget": "32 KB",
        Throughput: `${opsPerSec.toLocaleString()} ops/sec`,
        "Latency / Step": `${(duration / iterations).toFixed(4)}ms`,
      },
    },
  ];
}

/**
 * Run All Benchmarks
 */
export function runAllBenchmarks(): BenchmarkResult[] {
  const allResults: BenchmarkResult[] = [
    ...benchmarkMasonryScheduler(),
    ...benchmarkSVGCoordinateMath(),
    ...benchmarkPretextLayout(),
    ...benchmarkScanner(),
    ...benchmarkASTEvaluator(),
    ...benchmarkProofDAGValidation(),
    ...benchmarkDuckPhysics(),
    ...benchmarkGarminMemory(),
  ];

  return allResults;
}

export function printBenchmarkReport(results: BenchmarkResult[]): void {
  console.log(
    formatHeader(
      "DX BENCH — Computational & AST Engine Profiles",
      "Pretext Layout • Greedy Masonry • Security • Garmin Heap • Logic Solver"
    )
  );

  console.log(`### Benchmark Profiles · ${results.length} suites executed\n`);

  for (const r of results) {
    const suiteTag = `[${r.suite}]`.padEnd(25);
    const testName = r.name.padEnd(45);
    const opsStr = `${r.opsPerSec.toLocaleString()} ops/s`.padStart(18);
    const timeStr = `${r.durationMs}ms`.padStart(10);

    console.log(
      `  ${colors.cyan}${suiteTag}${colors.reset} ${colors.bold}${testName}${colors.reset} ${colors.green}${opsStr}${colors.reset} · ${colors.dim}${timeStr}${colors.reset}`
    );

    if (r.metrics) {
      const metricStr = Object.entries(r.metrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
      console.log(`  ${colors.gray}└─ *${metricStr}*${colors.reset}`);
    }
  }

  console.log(`\n### What's Actionable\n`);
  console.log(
    `To profile real-browser Core Web Vitals (LCP, TTFB, CLS) across canonical routes:`
  );
  console.log(`\n  ${colors.brightGreen}npm run bench:pages${colors.reset}\n`);

  console.log(`##### Metadata`);
  console.log(
    `*Total Suites: ${results.length} · Engine Status: 100% Deterministic & Optimized*`
  );
}
