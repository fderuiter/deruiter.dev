// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * CI-02 (#733 follow-up): before this policy existed, the targeted
 * non-chromium visual/touch coverage (`visual.spec.ts`, `touch-controls.spec.ts`
 * against Tablet Safari / Mobile Safari / Mobile Chrome) ran only in a
 * `push`-only job (`post-merge-device-smoke`), *after* a squash-merge had
 * already landed the change on `main`. These tests pin the fix: that coverage
 * must be part of the pull_request execution graph, and a single required
 * job (`merge-gate`) must be unable to report success unless every job that
 * gates the merge actually succeeded -- not merely "didn't block" by being
 * skipped or cancelled.
 *
 * CI-03 (#779 follow-up): `merge-gate` originally excluded itself on
 * `workflow_dispatch`, which is the same skip-is-a-pass hazard one level up.
 * The "merge-gate script" describe block below does not just check
 * substrings: it extracts the job's literal `run: |` script and its `env:`
 * mapping, supplies concrete values the way GitHub does before the runner
 * sees them, and executes the result with bash, asserting on the real exit
 * code for pull_request, push, workflow_dispatch, and unrecognized events.
 *
 * #1767 split the old fast/heavy gates into parallel jobs, and #1773 added
 * the docs-only, draft and bot-branch policies. The script tests cover each:
 * a skipped browser gate passes only for a docs-only change that `changes`
 * itself reported successfully; a draft and an unpromoted bot PR always fail.
 *
 * No YAML parser is used here (js-yaml is present only as a transitive
 * `overrides` pin for eslint, not a direct dependency this repo can rely on
 * having types for), so job blocks are located the same way the sibling
 * ci-*.test.ts files do: by their literal 2-space-indented header line under
 * `jobs:`.
 */
describe("CI Execution Policy", () => {
  const ciPath = path.join(process.cwd(), ".github/workflows/ci.yml");
  const ci = fs.readFileSync(ciPath, "utf8");
  const lines = ci.split("\n");

  const jobsSectionStart = lines.findIndex((line) => line === "jobs:");

  /** Every top-level job id and the line index its header starts at. */
  const jobHeaders = lines
    .map((line, index) => ({ line, index }))
    .filter(
      ({ line, index }) =>
        index > jobsSectionStart && /^ {2}[a-zA-Z0-9_-]+:\s*$/.test(line)
    )
    .map(({ line, index }) => ({
      name: line.trim().replace(/:$/, ""),
      index,
    }));

  it("finds the jobs: section and at least one job in it", () => {
    expect(jobsSectionStart).toBeGreaterThan(-1);
    expect(jobHeaders.length).toBeGreaterThan(0);
  });

  /** Raw text of one job block, from its header to the next job's header. */
  const jobBlock = (name: string): string => {
    const i = jobHeaders.findIndex((h) => h.name === name);
    if (i === -1) return "";
    const start = jobHeaders[i].index;
    const end =
      i + 1 < jobHeaders.length ? jobHeaders[i + 1].index : lines.length;
    return lines.slice(start, end).join("\n");
  };

  /** The single-line value of a `key:` field at 4-space indent in a block. */
  const field = (block: string, key: string): string | undefined =>
    block.match(new RegExp(`^ {4}${key}:\\s*(.+)$`, "m"))?.[1].trim();

  /** Normalizes a `needs:` field (bare id, `[a, b]`, or a wrapped list). */
  const needsList = (block: string): string[] => {
    const match = block.match(/^ {4}needs:\s*([\s\S]*?)\n {4}[a-z-]+:/m);
    if (!match) return [];
    return match[1]
      .replace(/[[\]\s]/g, "")
      .split(",")
      .filter(Boolean);
  };

  const DEVICE_SPECS = [
    "__tests__/e2e/visual.spec.ts",
    "__tests__/e2e/touch-controls.spec.ts",
  ];

  const NON_CHROMIUM_PROJECTS = [
    '--project="Tablet Safari"',
    '--project="Mobile Safari"',
    '--project="Mobile Chrome"',
  ];

  const BROWSER_GATE_IF =
    "github.event_name == 'pull_request' && needs.changes.outputs.run_browser == 'true'";

  const jobNames = jobHeaders.map((h) => h.name);

  describe("regression: targeted device coverage is present on pull_request", () => {
    it("finds at least one job that runs both device-engine dependent specs", () => {
      const deviceSpecJobs = jobNames.filter((name) => {
        const block = jobBlock(name);
        return DEVICE_SPECS.every((spec) => block.includes(spec));
      });

      expect(deviceSpecJobs.length).toBeGreaterThan(0);
    });

    it("requires every job running those specs against the non-chromium projects to trigger on pull_request", () => {
      const deviceSpecJobs = jobNames.filter((name) => {
        if (name === "cross-device-matrix") return false;
        const block = jobBlock(name);
        return (
          DEVICE_SPECS.every((spec) => block.includes(spec)) &&
          NON_CHROMIUM_PROJECTS.every((proj) => block.includes(proj))
        );
      });

      expect(deviceSpecJobs.length).toBeGreaterThan(0);
      for (const name of deviceSpecJobs) {
        const ifCondition = field(jobBlock(name), "if");
        expect(
          ifCondition,
          `job "${name}" carries the targeted device suite but does not gate on pull_request`
        ).toMatch(/\bpull_request\b/);
      }
    });

    it("does not leave a duplicate push-triggered run of the same targeted device suite", () => {
      const pushTriggeredDuplicates = jobNames.filter((name) => {
        if (name === "cross-device-matrix") return false;
        const block = jobBlock(name);
        const hasDeviceSuite = DEVICE_SPECS.every((spec) =>
          block.includes(spec)
        );
        const ifCondition = field(block, "if");
        const runsOnPush =
          ifCondition === undefined || /\bpush\b/.test(ifCondition);
        return hasDeviceSuite && runsOnPush;
      });

      expect(pushTriggeredDuplicates).toEqual([]);
    });
  });

  describe("device-gate", () => {
    const block = jobBlock("device-gate");

    it("exists, needs only the run policy and the shared build, and gates on pull_request", () => {
      expect(block).not.toBe("");
      expect(needsList(block)).toEqual(["changes", "build"]);
      expect(field(block, "if")).toBe(BROWSER_GATE_IF);
    });

    it("scopes to the three non-chromium projects, not chromium", () => {
      for (const proj of NON_CHROMIUM_PROJECTS) {
        expect(block).toContain(proj);
      }
      expect(block).not.toMatch(/--project="?chromium"?/);
    });

    it("declares a timeout so a hang cannot run unbounded", () => {
      const timeout = Number(field(block, "timeout-minutes"));
      expect(timeout).toBeGreaterThan(0);
    });
  });

  describe("heavy-gate keeps full chromium PR coverage", () => {
    const block = jobBlock("heavy-gate");

    it("still gates on pull_request only, after the shared build", () => {
      expect(field(block, "if")).toBe(BROWSER_GATE_IF);
      expect(needsList(block)).toEqual(["changes", "build"]);
    });

    it("still runs the full e2e suite against chromium", () => {
      expect(block).toMatch(/playwright test --project=chromium\b/);
    });
  });

  describe("#1768: the old fast gate is three parallel jobs", () => {
    it("removes fast-gate", () => {
      expect(jobNames).not.toContain("fast-gate");
    });

    it("static-gate runs every trigger, needs nothing, and owns the drift, docs, typecheck and lint checks", () => {
      const block = jobBlock("static-gate");
      expect(field(block, "if")).toBeUndefined();
      expect(needsList(block)).toEqual([]);
      for (const command of [
        "npm run migration:replay",
        "npm run check:migrations:drift",
        "npm run check-docs-drift",
        "npm run lint:docs",
        "npm run typecheck",
        "npm run lint",
        "npm run verify -- --skip-benchmark-evidence",
      ]) {
        expect(block, command).toContain(command);
      }
      expect(block).toMatch(/services:\s*\n\s+postgres:/);
    });

    it("unit-gate and mutation-gate run whenever the policy allows unit work", () => {
      for (const job of ["unit-gate", "mutation-gate"]) {
        const block = jobBlock(job);
        expect(needsList(block)).toEqual(["changes"]);
        expect(field(block, "if")).toBe(
          "needs.changes.outputs.run_unit == 'true'"
        );
      }
      expect(jobBlock("mutation-gate")).toContain("npm run test:mutation");
    });

    it("runs property fuzzing inside the unit suite rather than as a second step", () => {
      expect(ci).not.toContain("npm run test:fuzz");
      const config = fs.readFileSync(
        path.join(process.cwd(), "vitest.config.mts"),
        "utf8"
      );
      expect(config).toContain(
        'include: ["__tests__/**/*.{test,spec}.{ts,tsx}"]'
      );
      expect(
        fs.existsSync(
          path.join(process.cwd(), "__tests__/property-fuzz.test.ts")
        )
      ).toBe(true);
    });

    it("keeps typecheck and lint incremental only through content-keyed caches", () => {
      const block = jobBlock("static-gate");
      expect(block).toContain("npm run typecheck -- --incremental");
      expect(block).toContain(
        "npm run lint -- --cache --cache-strategy content --cache-location .eslintcache"
      );
      expect(block).toMatch(
        /key: static-incremental-\$\{\{ hashFiles\('package-lock\.json'\) \}\}-\$\{\{ github\.sha \}\}/
      );
    });
  });

  describe("#1772: Stryker runs incrementally without weakening the gate", () => {
    const block = jobBlock("mutation-gate");

    it("restores main's incremental report and saves only from a main push", () => {
      expect(block).toMatch(
        /uses: actions\/cache\/restore@[0-9a-f]{40} # v6\.1\.0\n\s+with:\n\s+path: reports\/stryker-incremental\.json\n\s+key: stryker-incremental-\$\{\{ github\.sha \}\}\n\s+restore-keys: \|\n\s+stryker-incremental-\n/
      );
      const save = block.slice(
        block.indexOf("Save Stryker Incremental Report")
      );
      expect(save).toMatch(
        /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/
      );
      expect(save).toMatch(/uses: actions\/cache\/save@/);
      // No step in this job uses the combined restore+save action, which
      // would save a PR-scoped (possibly fork-written) report.
      expect(block).not.toMatch(/uses: actions\/cache@/);
    });

    it("runs incrementally except on manual dispatch, and forces a full run when Stryker's inputs change", () => {
      expect(block).toContain(
        'if [ "${EVENT_NAME}" != "workflow_dispatch" ]; then'
      );
      expect(block).toContain("args+=(--incremental)");
      expect(block).toContain("args+=(--force)");
      expect(block).toContain('npm run test:mutation -- "${args[@]}"');
      expect(block).toContain('if [ "${STRYKER_FORCE}" = "true" ]; then');
      expect(block).toContain(
        "STRYKER_FORCE: ${{ needs.changes.outputs.stryker_force }}"
      );
    });

    it("keeps a weekly and on-demand full run that refreshes the baseline", () => {
      const weekly = fs.readFileSync(
        path.join(process.cwd(), ".github/workflows/mutation-weekly.yml"),
        "utf8"
      );
      expect(weekly).toMatch(/schedule:\s*\n\s+- cron: /);
      expect(weekly).toMatch(/workflow_dispatch:/);
      expect(weekly).toContain(
        "npm run test:mutation -- --incremental --force"
      );
      expect(weekly).toMatch(/timeout-minutes: \d+/);
    });
  });

  describe("cross-device-matrix retains manual full-matrix capability", () => {
    const block = jobBlock("cross-device-matrix");

    it("stays gated behind workflow_dispatch and the cross_device_matrix input", () => {
      expect(field(block, "if")).toBe(
        "github.event_name == 'workflow_dispatch' && inputs.cross_device_matrix"
      );
    });

    it("runs the full suite with no project filter", () => {
      expect(block).toContain("npx --no-install playwright test");
      expect(block).not.toMatch(
        /npx --no-install playwright test[^\n]*--project=/
      );
    });
  });

  /** Every job merge-gate must wait for, in `needs:` order. */
  const GATES = [
    "changes",
    "static-gate",
    "unit-gate",
    "unit-coverage",
    "mutation-gate",
    "security-gate",
    "build",
    "heavy-gate",
    "bench-gate",
    "heavy-gate-report",
    "device-gate",
  ] as const;
  type Gate = (typeof GATES)[number];
  const BROWSER_GATES: Gate[] = [
    "build",
    "heavy-gate",
    "bench-gate",
    "heavy-gate-report",
    "device-gate",
  ];
  const ALWAYS_ON_PR: Gate[] = ["changes", "static-gate", "security-gate"];
  const UNIT_GATES: Gate[] = ["unit-gate", "unit-coverage", "mutation-gate"];

  describe("merge-gate aggregates every job required for a passing merge", () => {
    const block = jobBlock("merge-gate");

    it("exists and needs every gating job", () => {
      expect(block).not.toBe("");
      expect(needsList(block).sort()).toEqual([...GATES].sort());
    });

    it("runs with if: always(), unconditionally for every trigger (no event carve-out)", () => {
      expect(field(block, "if")).toBe("always()");
    });

    it("inspects every required predecessor's actual .result rather than trusting needs: alone", () => {
      for (const dep of GATES) {
        expect(block).toContain(`needs.${dep}.result`);
      }
    });

    it("treats any non-success result as fatal, covering failure, cancellation, and skip alike", () => {
      expect(block).toContain('if [ "${result}" != "success" ]; then');
      expect(block).toMatch(/exit\s+"?\$\{fail\}"?/);
    });

    it("passes values through env, never interpolating ${{ }} into the script", () => {
      const script = block.slice(block.indexOf("run: |"));
      expect(script).not.toMatch(/\$\{\{/);
    });

    it("declares an explicit catch-all default that fails closed for any other event", () => {
      expect(block).toContain('case "${event}" in');
      const defaultStart = block.indexOf("\n            *)");
      expect(defaultStart).toBeGreaterThan(-1);
      const defaultEnd = block.indexOf(";;", defaultStart);
      const defaultArm = block.slice(defaultStart, defaultEnd);
      expect(defaultArm).toContain("fail=1");
    });

    it("declares a timeout so the summary step itself cannot hang unbounded", () => {
      const timeout = Number(field(block, "timeout-minutes"));
      expect(timeout).toBeGreaterThan(0);
    });
  });

  describe("merge-gate script: real execution against controlled event/result inputs", () => {
    const block = jobBlock("merge-gate");

    /** Body of the single `run: |` step, de-indented by its 10 spaces. */
    const extractRunScript = (jobBlockText: string): string => {
      const marker = "run: |\n";
      const idx = jobBlockText.indexOf(marker);
      if (idx === -1) {
        throw new Error("no `run: |` step found in job block");
      }
      const after = jobBlockText.slice(idx + marker.length);
      const scriptLines: string[] = [];
      for (const line of after.split("\n")) {
        if (line.trim() === "") {
          scriptLines.push("");
          continue;
        }
        const indent = line.match(/^ */)?.[0].length ?? 0;
        if (indent < 10) break;
        scriptLines.push(line.slice(10));
      }
      return scriptLines.join("\n");
    };

    /** The step's `env:` mapping: variable name -> GitHub expression. */
    const extractEnv = (jobBlockText: string): Record<string, string> => {
      const start = jobBlockText.indexOf("        env:\n");
      const end = jobBlockText.indexOf("        run: |");
      const env: Record<string, string> = {};
      for (const match of jobBlockText
        .slice(start, end)
        .matchAll(/^ {10}([A-Z_]+): \$\{\{ (.+?) \}\}$/gm)) {
        env[match[1]] = match[2];
      }
      return env;
    };

    const script = extractRunScript(block);
    const envMapping = extractEnv(block);

    it("extracted a non-trivial script containing the fail-closed default", () => {
      expect(script.length).toBeGreaterThan(0);
      expect(script).toContain('case "${event}" in');
      expect(script).toContain('exit "${fail}"');
    });

    it("maps every gate's result and the policy outputs into the script's environment", () => {
      for (const gate of GATES) {
        const variable = `RESULT_${gate.toUpperCase().replace(/-/g, "_")}`;
        expect(envMapping[variable], variable).toBe(`needs.${gate}.result`);
        expect(script).toContain(`"\${${variable}}"`);
      }
      expect(envMapping).toMatchObject({
        EVENT_NAME: "github.event_name",
        PR_DRAFT: "github.event.pull_request.draft",
        APP_CHANGED: "needs.changes.outputs.app_changed",
        BOT_PR: "needs.changes.outputs.bot_pr",
        PROMOTED: "needs.changes.outputs.promoted",
      });
    });

    type ResultsMap = Record<Gate, string>;

    const ALL_SUCCESS = Object.fromEntries(
      GATES.map((gate) => [gate, "success"])
    ) as ResultsMap;

    interface Scenario {
      event: string;
      results: ResultsMap;
      draft?: string;
      appChanged?: string;
      botPr?: string;
      promoted?: string;
    }

    /** Runs the script with the environment GitHub would give it. */
    const runScript = ({
      event,
      results,
      draft = "false",
      appChanged = "true",
      botPr = "false",
      promoted = "false",
    }: Scenario): { status: number | null; stdout: string } => {
      const env: Record<string, string> = {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        EVENT_NAME: event,
        PR_DRAFT: draft,
        APP_CHANGED: appChanged,
        BOT_PR: botPr,
        PROMOTED: promoted,
      };
      for (const gate of GATES) {
        env[`RESULT_${gate.toUpperCase().replace(/-/g, "_")}`] = results[gate];
      }
      const result = spawnSync("bash", ["-c", script], {
        encoding: "utf-8",
        env: fromPartial<NodeJS.ProcessEnv>(env),
      });
      if (result.error) {
        throw result.error;
      }
      return { status: result.status, stdout: result.stdout };
    };

    const FAILURE_MODES = ["failure", "cancelled", "skipped"] as const;

    const BROWSER_SKIPPED = {
      ...ALL_SUCCESS,
      ...Object.fromEntries(BROWSER_GATES.map((gate) => [gate, "skipped"])),
    } as ResultsMap;

    describe("pull_request: code change", () => {
      it("exits 0 when every required predecessor succeeded", () => {
        expect(
          runScript({ event: "pull_request", results: ALL_SUCCESS }).status
        ).toBe(0);
      });

      it.each(GATES.flatMap((job) => FAILURE_MODES.map((mode) => [job, mode])))(
        "exits 1 (never 0) when %s reports %s",
        (job, result) => {
          const results = { ...ALL_SUCCESS, [job]: result } as ResultsMap;
          expect(runScript({ event: "pull_request", results }).status).toBe(1);
        }
      );

      it("exits 1 when an unset result variable reaches the script", () => {
        const env = {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          EVENT_NAME: "pull_request",
        };
        const outcome = spawnSync("bash", ["-c", script], {
          encoding: "utf-8",
          env: fromPartial<NodeJS.ProcessEnv>(env),
        });
        expect(outcome.status).not.toBe(0);
      });
    });

    describe("pull_request: docs-only change (#1773)", () => {
      it("exits 0 when the browser gates were skipped by the docs-only policy", () => {
        expect(
          runScript({
            event: "pull_request",
            results: BROWSER_SKIPPED,
            appChanged: "false",
          }).status
        ).toBe(0);
      });

      it.each(BROWSER_GATES)(
        "still exits 1 when %s failed on a docs-only change",
        (job) => {
          const results = {
            ...BROWSER_SKIPPED,
            [job]: "failure",
          } as ResultsMap;
          expect(
            runScript({ event: "pull_request", results, appChanged: "false" })
              .status
          ).toBe(1);
        }
      );

      it.each([...ALWAYS_ON_PR, ...UNIT_GATES])(
        "still requires %s on a docs-only change",
        (job) => {
          for (const mode of FAILURE_MODES) {
            const results = { ...BROWSER_SKIPPED, [job]: mode } as ResultsMap;
            expect(
              runScript({ event: "pull_request", results, appChanged: "false" })
                .status
            ).toBe(1);
          }
        }
      );

      it.each(["failure", "cancelled", "skipped"])(
        "requires every browser gate when the changes job itself reported %s",
        (mode) => {
          // Outputs of a failed job are empty, but even a stale "false"
          // must not excuse a skipped gate.
          const results = { ...BROWSER_SKIPPED, changes: mode } as ResultsMap;
          expect(
            runScript({ event: "pull_request", results, appChanged: "false" })
              .status
          ).toBe(1);
          const unknown = runScript({
            event: "pull_request",
            results: { ...BROWSER_SKIPPED, changes: "success" } as ResultsMap,
            appChanged: "",
          });
          expect(unknown.status).toBe(1);
        }
      );
    });

    describe("pull_request: draft (#1773)", () => {
      it("fails on a draft even when every gate that ran passed", () => {
        const outcome = runScript({
          event: "pull_request",
          results: BROWSER_SKIPPED,
          draft: "true",
        });
        expect(outcome.status).toBe(1);
        expect(outcome.stdout).toContain("draft PR");
      });

      it("fails on a draft even if every gate somehow succeeded", () => {
        expect(
          runScript({
            event: "pull_request",
            results: ALL_SUCCESS,
            draft: "true",
          }).status
        ).toBe(1);
      });
    });

    describe("pull_request: bot branch (#1773)", () => {
      const QUICK_ONLY = {
        ...ALL_SUCCESS,
        ...Object.fromEntries(
          [...UNIT_GATES, ...BROWSER_GATES].map((gate) => [gate, "skipped"])
        ),
      } as ResultsMap;

      it("fails an unpromoted bot PR with the documented message", () => {
        const outcome = runScript({
          event: "pull_request",
          results: QUICK_ONLY,
          botPr: "true",
        });
        expect(outcome.status).toBe(1);
        expect(outcome.stdout).toContain(
          "bot PR: full suite runs when marked ready"
        );
      });

      it("fails an unpromoted bot PR even if every gate somehow succeeded", () => {
        expect(
          runScript({
            event: "pull_request",
            results: ALL_SUCCESS,
            botPr: "true",
          }).status
        ).toBe(1);
      });

      it("fails an unpromoted docs-only bot PR", () => {
        expect(
          runScript({
            event: "pull_request",
            results: QUICK_ONLY,
            botPr: "true",
            appChanged: "false",
          }).status
        ).toBe(1);
      });

      it("passes a promoted bot PR once the full suite succeeded", () => {
        expect(
          runScript({
            event: "pull_request",
            results: ALL_SUCCESS,
            botPr: "true",
            promoted: "true",
          }).status
        ).toBe(0);
      });

      it("fails a promoted bot PR whose unit gate was skipped", () => {
        expect(
          runScript({
            event: "pull_request",
            results: { ...ALL_SUCCESS, "unit-gate": "skipped" },
            botPr: "true",
            promoted: "true",
          }).status
        ).toBe(1);
      });
    });

    describe("push", () => {
      it("exits 0 when the push gates succeed even though the browser gates are skipped", () => {
        expect(
          runScript({ event: "push", results: BROWSER_SKIPPED }).status
        ).toBe(0);
      });

      const pushRequiredJobs: Gate[] = [
        "changes",
        "static-gate",
        "unit-gate",
        "unit-coverage",
        "mutation-gate",
        "security-gate",
      ];

      it.each(
        pushRequiredJobs.flatMap((job) =>
          FAILURE_MODES.map((mode) => [job, mode])
        )
      )(
        "exits 1 (never 0) when %s reports %s, regardless of the browser gates",
        (job, result) => {
          const results = { ...BROWSER_SKIPPED, [job]: result } as ResultsMap;
          expect(runScript({ event: "push", results }).status).toBe(1);
        }
      );
    });

    describe("workflow_dispatch (manual execution) -- CI-03 regression", () => {
      it("fails closed (exit 1, never skipped/0) even when every job that ran actually succeeded", () => {
        expect(
          runScript({ event: "workflow_dispatch", results: BROWSER_SKIPPED })
            .status
        ).toBe(1);
      });

      it("fails closed even when every job improbably reports success", () => {
        expect(
          runScript({ event: "workflow_dispatch", results: ALL_SUCCESS }).status
        ).toBe(1);
      });
    });

    describe("unsupported/unrecognized events", () => {
      it.each(["schedule", "repository_dispatch", "made_up_event"])(
        "fails closed (exit 1) for event '%s' even when every job succeeded",
        (event) => {
          expect(runScript({ event, results: ALL_SUCCESS }).status).toBe(1);
        }
      );
    });

    it("never lets every-job-failed exit 0 on the event with the most required predecessors", () => {
      const results = Object.fromEntries(
        GATES.map((gate) => [gate, "failure"])
      ) as ResultsMap;
      expect(runScript({ event: "pull_request", results }).status).toBe(1);
    });
  });

  describe("#1773: triggers and policy wiring", () => {
    it("runs pull requests on the activity types that can change the verdict", () => {
      expect(ci).toMatch(
        /pull_request:\n\s+branches: \["main"\]\n(?:\s+#.*\n)*\s+types: \[opened, synchronize, reopened, ready_for_review, labeled\]/
      );
    });

    it("runs the policy before installing anything, with untrusted values passed through env", () => {
      const block = jobBlock("changes");
      expect(block).toContain("run: node scripts/ci-run-policy.mjs");
      expect(block).not.toContain("npm ci");
      expect(block).toMatch(/fetch-depth: 2/);
      expect(block).toContain("HEAD_REF: ${{ github.head_ref }}");
      expect(block).not.toMatch(/run: .*\$\{\{/);
    });

    it.each(["build", "heavy-gate", "bench-gate", "device-gate"])(
      "%s runs only when the policy allows browser work",
      (job) => {
        expect(field(jobBlock(job), "if")).toBe(BROWSER_GATE_IF);
      }
    );
  });

  describe("main-push confirmation stays bounded", () => {
    it("static-gate and security-gate remain unconditional (the direct-push safety net)", () => {
      expect(field(jobBlock("static-gate"), "if")).toBeUndefined();
      expect(field(jobBlock("security-gate"), "if")).toBeUndefined();
    });

    it("no gate runs the build+Playwright heavy path on a bare push; only the non-gating cache warm builds", () => {
      const heavyOnPush = jobNames.filter((name) => {
        if (name === "cross-device-matrix") return false;
        const block = jobBlock(name);
        const ifCondition = field(block, "if");
        const runsOnPush =
          ifCondition === undefined || /\bpush\b/.test(ifCondition);
        return runsOnPush && block.includes("npm run build");
      });
      expect(heavyOnPush).toEqual(["cache-warm"]);
      expect(field(jobBlock("cache-warm"), "if")).toBe(
        "github.event_name == 'push' && github.ref == 'refs/heads/main'"
      );
      expect(jobBlock("cache-warm")).not.toContain("playwright test");
      expect(needsList(jobBlock("merge-gate"))).not.toContain("cache-warm");
    });
  });

  /**
   * ADR 0039 (Correction 2026-09-18): `cancel-in-progress` was
   * `${{ github.event_name == 'pull_request' }}`, which evaluates false on
   * `main` pushes. Superseding is strictly cheaper than letting a stale run
   * finish, because GitHub bills a cancelled job's elapsed time rather than
   * its full cap.
   */
  describe("redundant runs supersede rather than accumulate", () => {
    const concurrency = ci.slice(
      ci.indexOf("\nconcurrency:"),
      ci.indexOf("\npermissions:")
    );

    it("cancels superseded runs on every event, including main pushes", () => {
      expect(concurrency).toContain("cancel-in-progress: true");
      expect(concurrency).not.toContain("github.event_name == 'pull_request'");
    });

    it("keys the concurrency group per pull request or per ref", () => {
      expect(concurrency).toContain(
        "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}"
      );
    });
  });

  /**
   * ADR 0039 requires every job to declare a `timeout-minutes` bound so one
   * hang cannot consume a large fraction of the monthly allowance, on a
   * standard hosted runner.
   */
  describe("every job bounds its own cost", () => {
    it.each(jobNames)(
      "%s declares timeout-minutes on ubuntu-latest",
      (name) => {
        const timeout = field(jobBlock(name), "timeout-minutes");
        expect(timeout).toBeDefined();
        expect(Number(timeout)).toBeGreaterThan(0);
        expect(field(jobBlock(name), "runs-on")).toBe("ubuntu-latest");
      }
    );
  });
});
