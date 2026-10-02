#!/usr/bin/env node
/**
 * CI run policy for `.github/workflows/ci.yml` (#1773).
 *
 * The `changes` job runs this file with plain Node before anything is
 * installed, so it has no dependencies. It decides, for one workflow run,
 * which gate groups execute:
 *
 * - `run_unit`: the Vitest shards and the Stryker gate.
 * - `run_browser`: the build, the Playwright shards, the device gate and the
 *   Web Vitals bench.
 *
 * Merge Gate stays the single required check and reads the same outputs, so
 * a skipped gate is only ever accepted where this policy says it may be.
 *
 * The bot branch prefixes live here and nowhere else.
 * `__tests__/ci-run-policy.test.ts` ties them to `validateBranchName()` in
 * `lib/dx/git-guard.ts`, so a prefix added to the guard has to be classified
 * as a human or a bot prefix before the tests pass.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** Branch prefixes opened by bot tools. Their PRs run quick checks only. */
export const BOT_BRANCH_PREFIXES = Object.freeze(["stitch/", "jules/"]);

/**
 * Branch prefixes people (and Claude threads) use. Listed so that every
 * prefix `validateBranchName()` accepts is classified exactly once.
 */
export const HUMAN_BRANCH_PREFIXES = Object.freeze([
  "feat/",
  "fix/",
  "chore/",
  "refactor/",
  "docs/",
  "perf/",
  "dx/",
  "test/",
  "dev/",
]);

/** A maintainer applies this label to promote a bot PR to the full suite. */
export const FULL_SUITE_LABEL = "ci:full";

/**
 * Top-level directories whose Markdown can reach the running app or its
 * build. A Markdown change there counts as a code change.
 */
const APP_SOURCE_ROOTS = new Set([
  "app",
  "components",
  "hooks",
  "lib",
  "prisma",
  "public",
  "types",
]);

/** Exact non-code paths outside the Markdown rule. */
const NON_CODE_FILES = new Set([
  "LICENSE",
  "NOTICE",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
]);

/** Directory prefixes whose every file is prose or agent configuration. */
const NON_CODE_DIRECTORIES = Object.freeze([
  "adr/",
  "docs/",
  ".github/ISSUE_TEMPLATE/",
  ".agents/skills/",
]);

/**
 * True only for paths on the explicit non-code allowlist. Anything else,
 * including a path this list has never heard of, counts as code, so the
 * filter fails safe.
 *
 * @param {string} file Repository-relative path, forward slashes.
 * @returns {boolean}
 */
export function isNonCodePath(file) {
  const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized === "" || normalized.includes("..")) return false;
  if (NON_CODE_FILES.has(normalized)) return true;
  if (NON_CODE_DIRECTORIES.some((dir) => normalized.startsWith(dir))) {
    return true;
  }
  if (normalized.toLowerCase().endsWith(".md")) {
    const [first] = normalized.split("/");
    return !(normalized.includes("/") && APP_SOURCE_ROOTS.has(first));
  }
  return false;
}

/**
 * True when the PR head branch belongs to a bot tool.
 *
 * @param {string | undefined | null} headRef
 * @returns {boolean}
 */
export function isBotBranch(headRef) {
  const ref = (headRef ?? "").trim();
  return BOT_BRANCH_PREFIXES.some((prefix) => ref.startsWith(prefix));
}

/**
 * @typedef {object} RunPolicyInput
 * @property {string} eventName `github.event_name`.
 * @property {string} [headRef] `github.head_ref` on pull_request.
 * @property {boolean} [draft] `github.event.pull_request.draft`.
 * @property {string[]} [labels] PR label names.
 * @property {string[] | null} [changedFiles] Files the PR changes, or null
 *   when they could not be determined.
 */

/**
 * @typedef {object} RunPolicy
 * @property {boolean} appChanged
 * @property {boolean} botPr
 * @property {boolean} promoted
 * @property {boolean} draft
 * @property {boolean} runUnit
 * @property {boolean} runBrowser
 * @property {boolean} strykerForce
 * @property {string} reason
 */

/** Files whose change invalidates Stryker's incremental report (#1772). */
const STRYKER_INPUTS = [
  "stryker.config.mjs",
  "vitest.stryker.config.ts",
  "package.json",
  "package-lock.json",
];

/**
 * Decides which gate groups run. Pure, so the tests can drive every case.
 *
 * @param {RunPolicyInput} input
 * @returns {RunPolicy}
 */
export function computeRunPolicy(input) {
  const { eventName } = input;
  if (eventName !== "pull_request") {
    // push to main and workflow_dispatch: the unit and mutation gates run,
    // the browser gates follow their own event conditions in ci.yml.
    return {
      appChanged: true,
      botPr: false,
      promoted: false,
      draft: false,
      runUnit: true,
      runBrowser: false,
      strykerForce: false,
      reason: `${eventName}: unit and mutation gates run; browser gates are pull_request only.`,
    };
  }

  const files = input.changedFiles;
  // Unknown change set: assume code changed.
  const appChanged =
    !Array.isArray(files) ||
    files.length === 0 ||
    files.some((file) => !isNonCodePath(file));
  const botPr = isBotBranch(input.headRef);
  const promoted = (input.labels ?? []).includes(FULL_SUITE_LABEL);
  const draft = input.draft === true;
  const quickOnly = botPr && !promoted;
  const runUnit = !quickOnly;
  const runBrowser = !quickOnly && !draft && appChanged;
  const strykerForce =
    !Array.isArray(files) ||
    files.some((file) => STRYKER_INPUTS.includes(file));

  let reason;
  if (quickOnly) {
    reason = `bot PR (${input.headRef}): static and security checks only until a maintainer applies '${FULL_SUITE_LABEL}'.`;
  } else if (draft) {
    reason = "draft PR: browser gates run once the PR is marked ready.";
  } else if (!appChanged) {
    reason = "docs-only PR: build, Playwright, device and bench gates skipped.";
  } else {
    reason = "code change: every gate runs.";
  }

  return {
    appChanged,
    botPr,
    promoted,
    draft,
    runUnit,
    runBrowser,
    strykerForce,
    reason,
  };
}

/**
 * Formats a policy as `key=value` lines for `$GITHUB_OUTPUT`.
 *
 * @param {RunPolicy} policy
 * @returns {string}
 */
export function formatOutputs(policy) {
  const flag = (value) => (value ? "true" : "false");
  return [
    `app_changed=${flag(policy.appChanged)}`,
    `bot_pr=${flag(policy.botPr)}`,
    `promoted=${flag(policy.promoted)}`,
    `draft=${flag(policy.draft)}`,
    `run_unit=${flag(policy.runUnit)}`,
    `run_browser=${flag(policy.runBrowser)}`,
    `stryker_force=${flag(policy.strykerForce)}`,
    "",
  ].join("\n");
}

/**
 * Files the checked-out pull_request merge commit changes against its base
 * (the merge commit's first parent). Null when git cannot answer, or when
 * HEAD is not the test-merge commit of the expected PR head, so a plain
 * commit's own diff is never mistaken for the whole PR.
 *
 * @param {string | undefined} prHeadSha `github.event.pull_request.head.sha`.
 * @returns {string[] | null}
 */
function readChangedFiles(prHeadSha) {
  try {
    const parents = execFileSync(
      "git",
      ["rev-list", "--parents", "-n", "1", "HEAD"],
      { encoding: "utf-8" }
    )
      .trim()
      .split(/\s+/);
    if (parents.length !== 3) return null;
    if (prHeadSha && parents[2] !== prHeadSha) return null;
    const out = execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"],
      { encoding: "utf-8" }
    );
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function main() {
  const eventName = process.env.EVENT_NAME ?? "";
  let labels = [];
  try {
    labels = JSON.parse(process.env.PR_LABELS || "[]");
  } catch {
    labels = [];
  }
  const changedFiles =
    eventName === "pull_request"
      ? readChangedFiles(process.env.PR_HEAD_SHA)
      : [];
  const policy = computeRunPolicy({
    eventName,
    headRef: process.env.HEAD_REF,
    draft: process.env.PR_DRAFT === "true",
    labels: Array.isArray(labels) ? labels.map(String) : [],
    changedFiles,
  });

  console.log(`Run policy: ${policy.reason}`);
  if (Array.isArray(changedFiles) && eventName === "pull_request") {
    console.log(`Changed files (${changedFiles.length}):`);
    for (const file of changedFiles) {
      console.log(`  ${isNonCodePath(file) ? "docs" : "code"}  ${file}`);
    }
  } else if (changedFiles === null) {
    console.log(
      "Could not list changed files; treating the PR as a code change."
    );
  }

  const output = formatOutputs(policy);
  process.stdout.write(output);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### CI run policy\n\n${policy.reason}\n`
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
