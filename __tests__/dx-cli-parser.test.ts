// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseCliArgs,
  sanitizeCliInput,
  createDxEnvelope,
  COMMAND_REGISTRY,
  type DxEnvelope,
  type RemediationAction,
} from "@/lib/dx/cli-parser";

describe("DX CLI Parser & Agent Protocol Engine", () => {
  describe("parseCliArgs", () => {
    it("parses subcommands and standard flags", () => {
      const parsed = parseCliArgs(["doctor", "--fix", "--json"]);
      expect(parsed.command).toBe("doctor");
      expect(parsed.flags.fix).toBe(true);
      expect(parsed.flags.json).toBe(true);
    });

    it("parses key=value and key value options", () => {
      const parsed1 = parseCliArgs([
        "scaffold",
        "--type=component",
        "--name=UserBadge",
      ]);
      expect(parsed1.command).toBe("scaffold");
      expect(parsed1.flags.type).toBe("component");
      expect(parsed1.flags.name).toBe("UserBadge");

      const parsed2 = parseCliArgs([
        "scaffold",
        "--type",
        "hook",
        "--name",
        "use-counter",
      ]);
      expect(parsed2.command).toBe("scaffold");
      expect(parsed2.flags.type).toBe("hook");
      expect(parsed2.flags.name).toBe("use-counter");
    });

    it("expands short flag aliases correctly", () => {
      const parsed = parseCliArgs(["doctor", "-j", "-f", "-c"]);
      expect(parsed.flags.json).toBe(true);
      expect(parsed.flags.fix).toBe(true);
      expect(parsed.flags.ci).toBe(true);
    });

    it("handles short flag clusters (e.g. -yj)", () => {
      const parsed = parseCliArgs(["setup", "-yj"]);
      expect(parsed.command).toBe("setup");
      expect(parsed.flags.yes).toBe(true);
      expect(parsed.flags.json).toBe(true);
    });

    it("preserves positional arguments", () => {
      const parsed = parseCliArgs([
        "scaffold",
        "arcade",
        "matrix-defender",
        "--dry-run",
      ]);
      expect(parsed.command).toBe("scaffold");
      expect(parsed.positionals).toEqual(["arcade", "matrix-defender"]);
      expect(parsed.flags.dryRun || parsed.flags["dry-run"]).toBe(true);
    });
  });

  describe("sanitizeCliInput (Axis 5: Input Hardening)", () => {
    it("accepts valid alphanumeric names, hyphens, and slashes", () => {
      expect(sanitizeCliInput("feat/dx-upgrades", "Branch")).toBe(
        "feat/dx-upgrades"
      );
      expect(sanitizeCliInput("matrix-defender", "Game")).toBe(
        "matrix-defender"
      );
      expect(sanitizeCliInput("useTelemetry", "Hook")).toBe("useTelemetry");
    });

    it("rejects control characters", () => {
      expect(() => sanitizeCliInput("malicious\x00input", "Input")).toThrow(
        "invalid control characters"
      );
      expect(() => sanitizeCliInput("injection\x1B[31m", "Input")).toThrow(
        "invalid control characters"
      );
    });

    it("rejects directory traversal sequences", () => {
      expect(() => sanitizeCliInput("../etc/passwd", "Path")).toThrow(
        "directory traversal sequences"
      );
      expect(() => sanitizeCliInput("..\\windows\\system32", "Path")).toThrow(
        "directory traversal sequences"
      );
      expect(() => sanitizeCliInput("..", "Path")).toThrow(
        "directory traversal sequences"
      );
    });
  });

  describe("createDxEnvelope (Machine-Readable JSON Output)", () => {
    it("creates a standardized envelope with duration and timestamps", () => {
      const remediations: RemediationAction[] = [
        {
          id: "doctor-fix",
          title: "Auto-fix invariants",
          command: "npm run doctor:fix",
          autoFixable: true,
        },
      ];

      const envelope: DxEnvelope<{ count: number }> = createDxEnvelope({
        command: "doctor",
        success: false,
        durationMs: 42,
        data: { count: 3 },
        remediations,
        metadata: { version: "0.1.0" },
      });

      expect(envelope.command).toBe("doctor");
      expect(envelope.success).toBe(false);
      expect(envelope.durationMs).toBe(42);
      expect(envelope.data).toEqual({ count: 3 });
      expect(envelope.remediations).toHaveLength(1);
      expect(envelope.remediations[0].command).toBe("npm run doctor:fix");
      expect(envelope.metadata?.version).toBe("0.1.0");
      expect(typeof envelope.timestamp).toBe("string");
    });
  });

  describe("COMMAND_REGISTRY (Axis 3: Schema Introspection)", () => {
    it("contains complete command descriptors for all first-class dx commands", () => {
      expect(COMMAND_REGISTRY.length).toBeGreaterThanOrEqual(12);

      const commandNames = COMMAND_REGISTRY.map((c) => c.name);
      expect(commandNames).toContain("doctor");
      expect(commandNames).toContain("verify");
      expect(commandNames).toContain("dead-code");
      expect(commandNames).toContain("analyze");
      expect(commandNames).toContain("scaffold");
      expect(commandNames).toContain("commit");
      expect(commandNames).toContain("branch");
      expect(commandNames).toContain("env");
      expect(commandNames).toContain("bench");
      expect(commandNames).toContain("describe");
    });

    it("declares option types, categories, and examples for every command", () => {
      for (const cmd of COMMAND_REGISTRY) {
        expect(cmd.summary.length).toBeGreaterThan(5);
        expect(cmd.description.length).toBeGreaterThan(10);
        expect([
          "diagnostics",
          "workflow",
          "scaffolding",
          "performance",
          "system",
        ]).toContain(cmd.category);
        expect(Array.isArray(cmd.examples)).toBe(true);
        expect(cmd.examples.length).toBeGreaterThan(0);

        for (const opt of cmd.options) {
          expect(opt.name.length).toBeGreaterThan(0);
          expect(["boolean", "string", "number"]).toContain(opt.type);
          expect(opt.description.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
