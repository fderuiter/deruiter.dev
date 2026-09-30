import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import type { ESLint as ESLintType } from "eslint";

// Web Storage goes through lib/safe-storage (#1631). These tests lint source
// text as if it lived at a given path, against the repository's own
// eslint.config.mjs, so they fail if a later block silently replaces the rule.
describe("ESLint Web Storage restriction (#1631)", () => {
  const root = process.cwd();
  const storageRules = new Set([
    "no-restricted-properties",
    "no-restricted-globals",
  ]);
  let eslint: ESLintType;

  beforeAll(async () => {
    const { ESLint } = await import("eslint");
    eslint = new ESLint({ cwd: root });
  }, 60_000);

  async function lintAs(source: string, relativePath: string) {
    const [result] = await eslint.lintText(source, {
      filePath: path.join(root, relativePath),
    });
    return result.messages.filter(
      (m) => m.ruleId !== null && storageRules.has(m.ruleId)
    );
  }

  it.each([
    [
      "window.localStorage",
      'export const read = () => window.localStorage.getItem("k");\n',
    ],
    [
      "window.sessionStorage",
      'export const read = () => window.sessionStorage.getItem("k");\n',
    ],
    [
      "globalThis.localStorage",
      'export const read = () => globalThis.localStorage.getItem("k");\n',
    ],
    [
      "bare localStorage",
      'export const read = () => localStorage.getItem("k");\n',
    ],
    [
      "bare sessionStorage",
      'export const read = () => sessionStorage.getItem("k");\n',
    ],
  ])(
    "flags %s in a component",
    async (_label, source) => {
      const messages = await lintAs(source, "components/StorageProbe.tsx");
      expect(messages).toHaveLength(1);
      expect(messages[0].severity).toBe(2);
      expect(messages[0].message).toContain("@/lib/safe-storage");
    },
    60_000
  );

  it.each([
    "app/probe/page.tsx",
    "hooks/useStorageProbe.ts",
    "lib/storage-probe.ts",
  ])(
    "flags direct access in %s",
    async (file) => {
      const messages = await lintAs(
        'export const read = () => localStorage.getItem("k");\n',
        file
      );
      expect(messages).toHaveLength(1);
    },
    60_000
  );

  it.each([
    "lib/safe-storage.ts",
    "lib/garmin-engine.ts",
    "components/patrol/MedicalDisclaimerBanner.tsx",
    "__tests__/storage-probe.test.ts",
  ])(
    "allows direct access in %s",
    async (file) => {
      const messages = await lintAs(
        [
          'export const a = () => window.localStorage.getItem("k");',
          'export const b = () => window.sessionStorage.getItem("k");',
          'export const c = () => localStorage.getItem("k");',
          "",
        ].join("\n"),
        file
      );
      expect(messages).toHaveLength(0);
    },
    60_000
  );

  it("does not see storage reads inside a string literal", async () => {
    const messages = await lintAs(
      "export const script = `var v = localStorage.getItem('portfolio-font-mode');`;\n",
      "app/layout.tsx"
    );
    expect(messages).toHaveLength(0);
  }, 60_000);

  // The storage restriction shares no-restricted-properties with the
  // navigator.vibrate one (#1130); each block must restate both.
  it("keeps the navigator.vibrate restriction in storage-exempt files", async () => {
    const messages = await lintAs(
      "export const buzz = () => navigator.vibrate(15);\n",
      "lib/garmin-engine.ts"
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("triggerHaptic");
  }, 60_000);

  it("keeps the storage restriction in lib/haptics.ts", async () => {
    const messages = await lintAs(
      'export const read = () => window.localStorage.getItem("k");\n',
      "lib/haptics.ts"
    );
    expect(messages).toHaveLength(1);
  }, 60_000);

  it("flags storage and vibrate together in an application module", async () => {
    const messages = await lintAs(
      [
        "export const buzz = () => navigator.vibrate(15);",
        'export const read = () => window.localStorage.getItem("k");',
        "",
      ].join("\n"),
      "components/StorageProbe.tsx"
    );
    expect(messages).toHaveLength(2);
  }, 60_000);
});
