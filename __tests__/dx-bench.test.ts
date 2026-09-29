import { describe, it, expect } from "vitest";
import {
  benchmarkMasonryScheduler,
  benchmarkPretextLayout,
  benchmarkScanner,
  benchmarkSVGCoordinateMath,
  benchmarkASTEvaluator,
  benchmarkProofDAGValidation,
  benchmarkDuckPhysics,
  benchmarkGarminMemory,
  runAllBenchmarks,
  printBenchmarkReport,
} from "@/lib/dx/bench";

describe("DX Micro-Benchmark Suite", () => {
  it("benchmarks masonry column scheduler with various sizes", () => {
    const results = benchmarkMasonryScheduler(50);
    expect(results.length).toBe(3); // 100, 1000, 10000 items

    for (const r of results) {
      expect(r.opsPerSec).toBeGreaterThan(100);
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
      expect(r.metrics?.["Height Variance"]).toBeDefined();
    }
  });

  it("benchmarks pretext rich inline layout with throughput SLA", () => {
    const results = benchmarkPretextLayout(100);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(1000);
    expect(results[0].metrics?.["Throughput"]).toBeDefined();
  });

  it("benchmarks security validation scanner", () => {
    const results = benchmarkScanner(10);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(100);
  });

  it("benchmarks SVG coordinate math and spline generation", () => {
    const results = benchmarkSVGCoordinateMath(100);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(500);
    expect(results[0].metrics?.["Total Ops/sec"]).toBeDefined();
  });

  it("benchmarks clinical AST rule evaluation and formula linting", () => {
    const results = benchmarkASTEvaluator(100);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(100);
    expect(results[0].metrics?.["Throughput"]).toBeDefined();
  });

  it("benchmarks proof engine truth table solver and AST traversal", () => {
    const results = benchmarkProofDAGValidation(100);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(100);
    expect(results[0].metrics?.["Throughput"]).toBeDefined();
  });

  it("benchmarks duck autonomous physics and park simulation", () => {
    const results = benchmarkDuckPhysics(100);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(500);
    expect(results[0].metrics?.["Ticks Simulated"]).toBeDefined();
  });

  it("benchmarks Garmin 32KB memory allocator and GC cycle", () => {
    const results = benchmarkGarminMemory(100);
    expect(results.length).toBe(1);
    expect(results[0].opsPerSec).toBeGreaterThan(1000);
    expect(results[0].metrics?.["Memory Budget"]).toBe("32 KB");
  });

  it("runs all 8 benchmark suites cleanly and prints formatted report", () => {
    const results = runAllBenchmarks();
    expect(results.length).toBe(10);

    expect(() => printBenchmarkReport(results)).not.toThrow();
  });
});
