// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  getSimulatedStats,
  getSimulatedTerminalCommand,
  getSimulatedTerminalLogs,
  generateMockCommitActivity,
} from "@/lib/github";

describe("Language-Tailored Simulated Telemetry Engine", () => {
  describe("Metrics Generation (Requirement 2 & 4)", () => {
    it("should generate correct stats structure for Haskell", () => {
      const stats = getSimulatedStats("Haskell");
      expect(stats.stars).toBe(74);
      expect(stats.forks).toBe(11);
      expect(stats.openIssues).toBe(0);
      expect(stats.languages).toContainEqual({
        name: "Haskell",
        percentage: 91,
      });
      expect(stats.commitActivity).toHaveLength(52);
      expect(stats.recentCommits).toHaveLength(5);
      expect(stats.recentCommits[0].message).toContain("ghc-9.2-upgrade");
    });

    it("should generate correct stats structure for TypeScript", () => {
      const stats = getSimulatedStats("TypeScript");
      expect(stats.stars).toBe(148);
      expect(stats.forks).toBe(24);
      expect(stats.languages).toContainEqual({
        name: "TypeScript",
        percentage: 88,
      });
      expect(stats.recentCommits[0].message).toContain(
        "web worker message transfer"
      );
    });

    it("should generate correct stats structure for Python", () => {
      const stats = getSimulatedStats("Python");
      expect(stats.stars).toBe(112);
      expect(stats.forks).toBe(18);
      expect(stats.languages).toContainEqual({
        name: "Python",
        percentage: 95,
      });
      expect(stats.recentCommits[0].message).toContain(
        "clinical-data transport layer security"
      );
    });

    it("should fallback to generic stats for unsupported languages", () => {
      const stats = getSimulatedStats("Rust");
      expect(stats.stars).toBe(50);
      expect(stats.languages).toContainEqual({ name: "Rust", percentage: 100 });
      expect(stats.recentCommits).toHaveLength(5);
    });
  });

  describe("Terminal Commands (Requirement 3)", () => {
    it("should return the correct build/compiler command for Haskell", () => {
      const cmd = getSimulatedTerminalCommand("Haskell");
      expect(cmd).toBe("stack build --fast");
    });

    it("should return the correct build/compiler command for TypeScript", () => {
      const cmd = getSimulatedTerminalCommand("TypeScript");
      expect(cmd).toBe("tsc --build --watch");
    });

    it("should return the correct build/compiler command for Python", () => {
      const cmd = getSimulatedTerminalCommand("Python");
      expect(cmd).toBe("pytest -v --color=yes");
    });

    it("should return a generic build command as fallback", () => {
      const cmd = getSimulatedTerminalCommand("Go");
      expect(cmd).toBe("make build");
    });
  });

  describe("Terminal Log Sequences (Requirement 3)", () => {
    it("should return Haskell-tailored compiler build steps", () => {
      const logs = getSimulatedTerminalLogs("Haskell");
      expect(logs.some((log) => log.text.includes("Compiling Core.AST"))).toBe(
        true
      );
      expect(logs.some((log) => log.text.includes("Build successful"))).toBe(
        true
      );
    });

    it("should return TypeScript-tailored compilation steps", () => {
      const logs = getSimulatedTerminalLogs("TypeScript");
      expect(
        logs.some((log) =>
          log.text.includes("Starting compilation in watch mode")
        )
      ).toBe(true);
      expect(
        logs.some((log) => log.text.includes("Re-compiled successfully"))
      ).toBe(true);
    });

    it("should return Python-tailored pytest steps", () => {
      const logs = getSimulatedTerminalLogs("Python");
      expect(logs.some((log) => log.text.includes("test session starts"))).toBe(
        true
      );
      expect(logs.some((log) => log.text.includes("passed in 0.42s"))).toBe(
        true
      );
    });

    it("should return generic build logs as fallback", () => {
      const logs = getSimulatedTerminalLogs("Ruby");
      expect(
        logs.some((log) => log.text.includes("Initializing compiler pipeline"))
      ).toBe(true);
    });
  });

  describe("Centralized Single-Curve Refactoring Invariants (Requirements 1, 2, 3)", () => {
    it("should produce exactly 52 data points", () => {
      const activity = generateMockCommitActivity();
      expect(activity).toHaveLength(52);
    });

    it("should produce identical value distributions for both simulation and central mock triggers", () => {
      const centralActivity = generateMockCommitActivity();

      const haskellStats = getSimulatedStats("Haskell");
      const typescriptStats = getSimulatedStats("TypeScript");
      const pythonStats = getSimulatedStats("Python");
      const fallbackStats = getSimulatedStats("Rust");

      expect(haskellStats.commitActivity).toEqual(centralActivity);
      expect(typescriptStats.commitActivity).toEqual(centralActivity);
      expect(pythonStats.commitActivity).toEqual(centralActivity);
      expect(fallbackStats.commitActivity).toEqual(centralActivity);
    });

    it("should output static, non-parameterized curves with constant peaks and baselines", () => {
      const activity1 = generateMockCommitActivity();
      const activity2 = generateMockCommitActivity();
      expect(activity1).toEqual(activity2);
    });
  });
});
