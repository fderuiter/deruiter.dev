// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  BOT_BRANCH_PREFIXES,
  FULL_SUITE_LABEL,
  HUMAN_BRANCH_PREFIXES,
  computeRunPolicy,
  formatOutputs,
  isBotBranch,
  isNonCodePath,
} from "../scripts/ci-run-policy.mjs";
import { validateBranchName } from "../lib/dx/git-guard";

/**
 * #1773: the `changes` job in ci.yml runs scripts/ci-run-policy.mjs to decide
 * which gate groups run. These cases pin the decision table Merge Gate relies
 * on: docs-only PRs skip only the browser gates, drafts skip them until
 * ready, bot PRs run quick checks until promoted, and anything unknown counts
 * as a code change.
 */
describe("CI run policy (#1773)", () => {
  describe("bot prefix list stays tied to validateBranchName()", () => {
    /** The prefixes the guard accepts, read from its own error message. */
    const guardPrefixes = (() => {
      const result = validateBranchName("no-prefix-here");
      const listed = result.error?.match(/Expected prefixes: ([^(]+)\(/)?.[1];
      return (listed ?? "")
        .split(",")
        .map((prefix) => prefix.trim())
        .filter(Boolean);
    })();

    it("reads the guard's prefix list", () => {
      expect(guardPrefixes.length).toBeGreaterThan(5);
      expect(guardPrefixes).toContain("jules/");
    });

    it("classifies every prefix the guard accepts as exactly one of human or bot", () => {
      // A new prefix added to lib/dx/git-guard.ts fails here until it is
      // listed in scripts/ci-run-policy.mjs, so the two cannot drift.
      for (const prefix of guardPrefixes) {
        const human = HUMAN_BRANCH_PREFIXES.includes(prefix);
        const bot = BOT_BRANCH_PREFIXES.includes(prefix);
        expect(
          human !== bot,
          `prefix "${prefix}" must be classified exactly once`
        ).toBe(true);
      }
    });

    it("lists only human prefixes the guard actually accepts", () => {
      for (const prefix of HUMAN_BRANCH_PREFIXES) {
        expect(guardPrefixes).toContain(prefix);
        expect(validateBranchName(`${prefix}example`).valid).toBe(true);
      }
    });

    it("treats the Jules prefix the guard reserves for its agent as a bot", () => {
      expect(validateBranchName("jules/example").valid).toBe(true);
      expect(isBotBranch("jules/example")).toBe(true);
    });

    it("treats stitch/ as a bot prefix the local guard never lets a person use", () => {
      expect(validateBranchName("stitch/feat/example").valid).toBe(false);
      expect(isBotBranch("stitch/feat/example")).toBe(true);
    });

    it("never treats a human branch as a bot branch", () => {
      for (const prefix of HUMAN_BRANCH_PREFIXES) {
        expect(isBotBranch(`${prefix}example`)).toBe(false);
      }
      expect(isBotBranch("main")).toBe(false);
      expect(isBotBranch(undefined)).toBe(false);
    });
  });

  describe("non-code path allowlist fails safe", () => {
    it.each([
      "README.md",
      "CHANGELOG.md",
      "adr/0039-github-pro-plan-capabilities-and-actions-minutes-governance.md",
      "docs/how-to/monitor-github-actions-minutes.md",
      "docs/reference/api/README.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/pull_request_template.md",
      ".agents/skills/example/SKILL.md",
      "LICENSE",
    ])("%s is documentation", (file) => {
      expect(isNonCodePath(file)).toBe(true);
    });

    it.each([
      "app/page.tsx",
      "app/notes/content.md",
      "components/notes.md",
      // Markdown under an app source root may be bundled, so it counts too.
      "lib/README.md",
      "public/llms.txt",
      "public/notes.md",
      "lib/dx/doctor.ts",
      "package.json",
      "package-lock.json",
      ".github/workflows/ci.yml",
      "scripts/ci-run-policy.mjs",
      "next.config.ts",
      "something-new.txt",
      "../escape.md",
      "",
    ])("%s counts as code", (file) => {
      expect(isNonCodePath(file)).toBe(false);
    });
  });

  describe("decision table", () => {
    const pr = (overrides: Record<string, unknown> = {}) =>
      computeRunPolicy({
        eventName: "pull_request",
        headRef: "feat/example",
        draft: false,
        labels: [],
        changedFiles: ["app/page.tsx"],
        ...overrides,
      });

    it("runs every gate for a ready code PR", () => {
      expect(pr()).toMatchObject({
        appChanged: true,
        runUnit: true,
        runBrowser: true,
        botPr: false,
        draft: false,
      });
    });

    it("skips only the browser gates for a docs-only PR", () => {
      expect(
        pr({ changedFiles: ["README.md", "docs/how-to/x.md"] })
      ).toMatchObject({ appChanged: false, runUnit: true, runBrowser: false });
    });

    it("runs the browser gates when one changed file is code", () => {
      expect(pr({ changedFiles: ["README.md", "lib/utils.ts"] })).toMatchObject(
        { appChanged: true, runBrowser: true }
      );
    });

    it("treats an unknown or empty change set as a code change", () => {
      expect(pr({ changedFiles: null })).toMatchObject({
        appChanged: true,
        runBrowser: true,
        strykerForce: true,
      });
      expect(pr({ changedFiles: [] })).toMatchObject({
        appChanged: true,
        runBrowser: true,
      });
    });

    it("keeps the cheap gates but not the browser gates on a draft", () => {
      expect(pr({ draft: true })).toMatchObject({
        draft: true,
        runUnit: true,
        runBrowser: false,
      });
    });

    it("runs quick checks only for an unpromoted bot PR", () => {
      expect(pr({ headRef: "stitch/feat/x" })).toMatchObject({
        botPr: true,
        promoted: false,
        runUnit: false,
        runBrowser: false,
      });
    });

    it(`runs the full suite once a bot PR carries the ${FULL_SUITE_LABEL} label`, () => {
      expect(
        pr({ headRef: "jules/fix-x", labels: ["triage", FULL_SUITE_LABEL] })
      ).toMatchObject({
        botPr: true,
        promoted: true,
        runUnit: true,
        runBrowser: true,
      });
    });

    it("forces a full Stryker run when Stryker's inputs change", () => {
      for (const file of [
        "stryker.config.mjs",
        "vitest.stryker.config.mts",
        "package-lock.json",
      ]) {
        expect(pr({ changedFiles: [file] }).strykerForce).toBe(true);
      }
      expect(pr().strykerForce).toBe(false);
    });

    it.each(["push", "workflow_dispatch"])(
      "runs the unit and mutation gates and no PR browser gates on %s",
      (eventName) => {
        expect(computeRunPolicy({ eventName })).toMatchObject({
          runUnit: true,
          runBrowser: false,
          botPr: false,
        });
      }
    );

    it("writes every output the workflow reads", () => {
      const output = formatOutputs(pr());
      const ci = fs.readFileSync(
        path.join(process.cwd(), ".github/workflows/ci.yml"),
        "utf8"
      );
      const declared = [
        ...ci.matchAll(
          /^ {6}(\w+): \$\{\{ steps\.policy\.outputs\.(\w+) \}\}$/gm
        ),
      ];
      expect(declared.length).toBeGreaterThan(0);
      for (const [, name, source] of declared) {
        expect(name).toBe(source);
        expect(output).toMatch(new RegExp(`^${source}=(true|false)$`, "m"));
      }
    });

    it("names the same promotion label in Merge Gate's failure message", () => {
      const ci = fs.readFileSync(
        path.join(process.cwd(), ".github/workflows/ci.yml"),
        "utf8"
      );
      expect(ci).toContain(
        `bot PR: full suite runs when marked ready (a maintainer applies the '${FULL_SUITE_LABEL}' label)`
      );
    });
  });
});
