import { describe, it, expect } from "vitest";
import {
  generateBashScript,
  generatePythonScript,
  escapeShellArg,
  escapePythonString,
  extractFlagValue,
} from "@/lib/terminal-script-generator";

describe("Terminal Script Generator Utility Suite", () => {
  describe("Helper Functions", () => {
    it("escapes shell arguments safely for single quotes", () => {
      expect(escapeShellArg("BRIGHT-01")).toBe("'BRIGHT-01'");
      expect(escapeShellArg("study's name")).toBe("'study'\\''s name'");
    });

    it("escapes python strings safely", () => {
      expect(escapePythonString("SUB-123")).toBe('"SUB-123"');
      expect(escapePythonString('hello "world"')).toBe('"hello \\"world\\""');
    });

    it("extracts flag values from CLI commands", () => {
      expect(extractFlagValue("imednet subjects get --id 123", "--id")).toBe(
        "123"
      );
      expect(
        extractFlagValue(
          'imednet records search --study "BRIGHT-01"',
          "--study"
        )
      ).toBe("BRIGHT-01");
      expect(extractFlagValue("imednet studies list", "--id")).toBeNull();
    });
  });

  describe("Bash Script Generator", () => {
    it("generates a syntactically valid bash script with shebang and header metadata", () => {
      const commands = [
        "imednet studies list",
        "imednet subjects get --id 123",
        "imednet records search --study BRIGHT-01",
      ];
      const script = generateBashScript(commands, {
        slug: "imednet-python-sdk",
        studyId: "BRIGHT-01",
        timestamp: "2026-10-01T12:00:00Z",
      });

      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("# Generated on: 2026-10-01T12:00:00Z");
      expect(script).toContain("# Target Project / SDK: imednet-python-sdk");
      expect(script).toContain("set -euo pipefail");
      expect(script).toContain('curl -s -X GET "${IMEDNET_API_URL}/studies"');
      expect(script).toContain("SUB_ID='123'");
      expect(script).toContain("STUDY_NAME='BRIGHT-01'");
    });

    it("falls back to default commands when command list is empty", () => {
      const script = generateBashScript([]);
      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("imednet studies list");
    });
  });

  describe("Python Script Generator", () => {
    it("generates a syntactically valid python script with shebang and header metadata", () => {
      const commands = [
        "imednet studies list",
        "imednet subjects get --id SUB-456",
        "imednet records search --study ONCO-2026",
      ];
      const script = generatePythonScript(commands, {
        slug: "imednet-python-sdk",
        studyId: "ONCO-2026",
        timestamp: "2026-10-01T12:00:00Z",
      });

      expect(script).toContain("#!/usr/bin/env python3");
      expect(script).toContain("# Generated on: 2026-10-01T12:00:00Z");
      expect(script).toContain("import requests");
      expect(script).toContain('subject_id = "SUB-456"');
      expect(script).toContain('study_id = "ONCO-2026"');
      expect(script).toContain('if __name__ == "__main__":');
    });

    it("falls back to default commands when command list is empty", () => {
      const script = generatePythonScript([]);
      expect(script).toContain("#!/usr/bin/env python3");
      expect(script).toContain("def run_pipeline():");
    });
  });
});
