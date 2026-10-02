// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as doctor from "../lib/dx/doctor";
import type {
  DiagnosticCheckResult,
  DiagnosticSummary,
} from "../lib/dx/doctor";
import { parseCliArgs } from "../lib/dx/cli-parser";
import { handleVerifyCommand } from "../scripts/dx";

const SUCCESS_BANNER =
  "All AGENTS.md architectural invariants and security checks verified";
const FAILURE_BANNER = "Invariant verification failed.";

function makeCheck(
  status: DiagnosticCheckResult["status"],
  id: string
): DiagnosticCheckResult {
  return {
    id,
    name: `Mock check ${id}`,
    category: "quality",
    status,
    message: `${id} message`,
  };
}

function makeSummary(counts: {
  passed?: number;
  failed?: number;
  warned?: number;
}): DiagnosticSummary {
  const passed = counts.passed ?? 0;
  const failed = counts.failed ?? 0;
  const warned = counts.warned ?? 0;

  const results: DiagnosticCheckResult[] = [
    ...Array.from({ length: passed }, (_, i) => makeCheck("pass", `pass-${i}`)),
    ...Array.from({ length: failed }, (_, i) => makeCheck("fail", `fail-${i}`)),
    ...Array.from({ length: warned }, (_, i) => makeCheck("warn", `warn-${i}`)),
  ];

  return {
    results,
    hasFailures: failed > 0,
    hasWarnings: warned > 0,
    totalPassed: passed,
    totalFailed: failed,
    totalWarned: warned,
    totalFixed: 0,
    remediations: [],
  };
}

const CLEAN_SUMMARY = () => makeSummary({ passed: 3 });
const WARNING_ONLY_SUMMARY = () => makeSummary({ passed: 2, warned: 1 });
const FAILURE_ONLY_SUMMARY = () => makeSummary({ passed: 2, failed: 1 });
const COMBINED_SUMMARY = () => makeSummary({ passed: 1, failed: 1, warned: 1 });

describe("DX-03: handleVerifyCommand output/exit-status alignment", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let diagnosticsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit(${code})`);
      });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
    diagnosticsSpy.mockRestore();
  });

  function humanOutput(): string {
    return [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .map((args) => args.join(" "))
      .join("\n");
  }

  function jsonOutput(): { success: boolean } {
    const lastCall = stdoutSpy.mock.calls.at(-1);
    return JSON.parse(String(lastCall?.[0]));
  }

  describe("human-readable mode", () => {
    it("prints the success banner and does not exit for a clean summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(CLEAN_SUMMARY());

      await handleVerifyCommand(parseCliArgs(["verify"]));

      expect(exitSpy).not.toHaveBeenCalled();
      expect(humanOutput()).toContain(SUCCESS_BANNER);
    });

    it("never prints the success banner and exits 1 for a warning-only summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(WARNING_ONLY_SUMMARY());

      await expect(
        handleVerifyCommand(parseCliArgs(["verify"]))
      ).rejects.toThrow("process.exit(1)");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(humanOutput()).not.toContain(SUCCESS_BANNER);
    });

    it("prints the failure banner instead of the success banner and exits 1 for a failure-only summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(FAILURE_ONLY_SUMMARY());

      await expect(
        handleVerifyCommand(parseCliArgs(["verify"]))
      ).rejects.toThrow("process.exit(1)");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(humanOutput()).not.toContain(SUCCESS_BANNER);
      expect(humanOutput()).toContain(FAILURE_BANNER);
    });

    it("prints the failure banner instead of the success banner and exits 1 for a combined failure+warning summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(COMBINED_SUMMARY());

      await expect(
        handleVerifyCommand(parseCliArgs(["verify"]))
      ).rejects.toThrow("process.exit(1)");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(humanOutput()).not.toContain(SUCCESS_BANNER);
      expect(humanOutput()).toContain(FAILURE_BANNER);
    });
  });

  describe("JSON mode", () => {
    it("reports success: true and does not exit for a clean summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(CLEAN_SUMMARY());

      await handleVerifyCommand(parseCliArgs(["verify", "--json"]));

      expect(exitSpy).not.toHaveBeenCalled();
      expect(jsonOutput().success).toBe(true);
    });

    it("reports success: false and exits 1 for a warning-only summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(WARNING_ONLY_SUMMARY());

      await expect(
        handleVerifyCommand(parseCliArgs(["verify", "--json"]))
      ).rejects.toThrow("process.exit(1)");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(jsonOutput().success).toBe(false);
    });

    it("reports success: false and exits 1 for a failure-only summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(FAILURE_ONLY_SUMMARY());

      await expect(
        handleVerifyCommand(parseCliArgs(["verify", "--json"]))
      ).rejects.toThrow("process.exit(1)");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(jsonOutput().success).toBe(false);
    });

    it("reports success: false and exits 1 for a combined failure+warning summary", async () => {
      diagnosticsSpy = vi
        .spyOn(doctor, "runDiagnostics")
        .mockResolvedValue(COMBINED_SUMMARY());

      await expect(
        handleVerifyCommand(parseCliArgs(["verify", "--json"]))
      ).rejects.toThrow("process.exit(1)");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(jsonOutput().success).toBe(false);
    });
  });
});
