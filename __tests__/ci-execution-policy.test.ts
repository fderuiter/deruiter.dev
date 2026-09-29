import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * CI-02 (#733 follow-up): before this policy existed, the targeted
 * non-chromium visual/touch coverage (`visual.spec.ts`, `touch-controls.spec.ts`
 * against Tablet Safari / Mobile Safari / Mobile Chrome) ran only in a
 * `push`-only job (`post-merge-device-smoke`), *after* a squash-merge had
 * already landed the change on `main`. A PR could merge with a device-engine
 * regression nothing had caught yet. These tests pin the fix: that coverage
 * must be part of the pull_request execution graph, and a single required
 * job (`merge-gate`) must be unable to report success unless every job that
 * gates the merge actually succeeded -- not merely "didn't block" by being
 * skipped or cancelled.
 *
 * CI-03 (#779 follow-up): `merge-gate` originally excluded itself on
 * `workflow_dispatch` (`if: always() && github.event_name !=
 * 'workflow_dispatch'`), which is the same skip-is-a-pass hazard one level
 * up -- a job skipped by its own `if:` still posts a "skipped" conclusion
 * under the required check name, and GitHub treats that as satisfied. The
 * "merge-gate script" describe block below does not just check substrings:
 * it extracts the job's literal `run: |` script, substitutes concrete
 * values for its `${{ }}` expressions the same way GitHub does before the
 * runner sees it, and actually executes the result with bash, asserting on
 * the real exit code for pull_request, push, workflow_dispatch, and
 * unrecognized events alike.
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

  /** Normalizes a `needs:` field (bare id or `[a, b, c]`) to a string array. */
  const needsList = (block: string): string[] => {
    const raw = field(block, "needs");
    if (!raw) return [];
    return raw
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((s) => s.trim())
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
      // This is the actual regression guard: whatever job (by whatever name)
      // owns this coverage, it must be reachable from a PR push. A push-only
      // or workflow_dispatch-only `if:` here silently reintroduces the CI-02
      // gap even if the specs and projects are still correct.
      const deviceSpecJobs = jobNames.filter((name) => {
        if (name === "cross-device-matrix") return false; // full matrix is a distinct, deliberately manual concern
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
      // Guards the "no duplicate full-matrix execution" constraint: the
      // targeted suite should gate the merge exactly once, not run again on
      // the post-merge push against identical code.
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

    it("exists, needs fast-gate, and gates on pull_request only", () => {
      expect(block).not.toBe("");
      expect(needsList(block)).toEqual(["fast-gate"]);
      expect(field(block, "if")).toBe("github.event_name == 'pull_request'");
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

    it("still gates on pull_request only", () => {
      expect(field(block, "if")).toBe("github.event_name == 'pull_request'");
    });

    it("still runs the full e2e suite against chromium", () => {
      expect(block).toMatch(/playwright test --project=chromium\b/);
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

  describe("merge-gate aggregates every job required for a passing merge", () => {
    const block = jobBlock("merge-gate");

    it("exists and needs every gating job from both the fast and heavy paths", () => {
      expect(block).not.toBe("");
      expect(needsList(block).sort()).toEqual(
        ["device-gate", "fast-gate", "heavy-gate", "security-gate"].sort()
      );
    });

    it("runs with if: always(), unconditionally for every trigger (no event carve-out)", () => {
      // CI-03 regression guard: this used to read
      // `always() && github.event_name != 'workflow_dispatch'`, which made
      // the whole job skip itself on a manual dispatch -- and a job skipped
      // by its own `if:` still posts a "skipped" conclusion under this
      // exact required check name, which required-status-checks treats as
      // satisfied rather than blocking. The condition must be exactly
      // `always()`, not `always()` narrowed by any event exclusion, so the
      // job -- and therefore the shell script's own fail-closed default,
      // exercised for real below -- always gets to run and report a real
      // conclusion.
      expect(field(block, "if")).toBe("always()");
    });

    it("inspects every required predecessor's actual .result rather than trusting needs: alone", () => {
      for (const dep of [
        "fast-gate",
        "security-gate",
        "heavy-gate",
        "device-gate",
      ]) {
        expect(block).toContain(`needs.${dep}.result`);
      }
    });

    it("treats any non-success result as fatal, covering failure, cancellation, and skip alike", () => {
      // `!= "success"` catches "failure", "cancelled", and "skipped" in one
      // comparison -- there is no allowlist of "acceptable" non-success
      // states for a required predecessor.
      expect(block).toContain('!= "success"');
      expect(block).toMatch(/exit\s+"?\$\{fail\}"?/);
    });

    it("only requires heavy-gate/device-gate to have succeeded when the event is pull_request", () => {
      const marker = "pull_request)";
      const start = block.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const end = block.indexOf(";;", start);
      expect(end).toBeGreaterThan(start);
      const guardedBlock = block.slice(start, end);
      expect(guardedBlock).toContain("heavy-gate");
      expect(guardedBlock).toContain("device-gate");
    });

    it("declares an explicit catch-all default that fails closed for any other event", () => {
      // Belt-and-suspenders string check alongside the real-execution suite
      // below: the case statement must dispatch on the literal event value
      // and carry a `*)` default arm that sets fail=1, not merely omit
      // handling for unrecognized events (which is what let workflow_dispatch
      // slip through before CI-03 -- the job simply never ran for it).
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
    // Everything above only checks that certain substrings exist in the
    // YAML -- it would not notice if, say, someone flipped `!=` to `==`, or
    // dropped the default case's `fail=1`, while leaving every string this
    // file already asserts on intact. This suite extracts the literal shell
    // script GitHub Actions would run, substitutes concrete values for its
    // `${{ }}` expressions the same way GitHub itself does before the
    // runner ever sees the script, and actually executes the result with
    // bash, asserting on the real exit code -- the only way to prove
    // failure actually propagates rather than merely reading as if it
    // should.
    const block = jobBlock("merge-gate");

    /**
     * Extracts the body of the single `run: |` step in a job block, using
     * the step's own indentation (10 spaces here) to find where the script
     * starts and ends.
     */
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

    const script = extractRunScript(block);

    it("extracted a non-trivial script containing the fail-closed default", () => {
      expect(script.length).toBeGreaterThan(0);
      expect(script).toContain('case "${event}" in');
      expect(script).toContain('exit "${fail}"');
    });

    type ResultsMap = Record<
      "fast-gate" | "security-gate" | "heavy-gate" | "device-gate",
      string
    >;

    const ALL_SUCCESS: ResultsMap = {
      "fast-gate": "success",
      "security-gate": "success",
      "heavy-gate": "success",
      "device-gate": "success",
    };

    /** Substitutes GitHub Actions `${{ }}` expressions with literal test values. */
    const renderScript = (event: string, results: ResultsMap): string => {
      let out = script.replace(/\$\{\{\s*github\.event_name\s*\}\}/g, event);
      for (const job of Object.keys(results) as (keyof ResultsMap)[]) {
        const re = new RegExp(
          `\\$\\{\\{\\s*needs\\.${job}\\.result\\s*\\}\\}`,
          "g"
        );
        out = out.replace(re, results[job]);
      }
      // Any remaining `${{ }}` means a substitution above missed an
      // expression the real script actually contains -- fail loudly here
      // rather than letting bash choke on invalid `${{` syntax with a
      // confusing error.
      if (/\$\{\{/.test(out)) {
        throw new Error(
          `unsubstituted GitHub Actions expression remains in rendered script:\n${out}`
        );
      }
      return out;
    };

    const runScript = (
      event: string,
      results: ResultsMap
    ): { status: number | null; stderr: string } => {
      const rendered = renderScript(event, results);
      const result = spawnSync("bash", ["-c", rendered], { encoding: "utf-8" });
      if (result.error) {
        throw result.error;
      }
      return { status: result.status, stderr: result.stderr };
    };

    const FAILURE_MODES = ["failure", "cancelled", "skipped"] as const;

    describe("pull_request", () => {
      it("exits 0 when every required predecessor succeeded", () => {
        expect(runScript("pull_request", ALL_SUCCESS).status).toBe(0);
      });

      const prRequiredJobs = [
        "fast-gate",
        "security-gate",
        "heavy-gate",
        "device-gate",
      ] as const;
      const prFailureCases = prRequiredJobs.flatMap((job) =>
        FAILURE_MODES.map((mode) => [job, mode] as const)
      );

      it.each(prFailureCases)(
        "exits 1 (never 0) when %s reports %s",
        (job, result) => {
          const results: ResultsMap = { ...ALL_SUCCESS, [job]: result };
          expect(runScript("pull_request", results).status).toBe(1);
        }
      );
    });

    describe("push", () => {
      it("exits 0 when fast-gate/security-gate succeed even though heavy-gate/device-gate are skipped", () => {
        const results: ResultsMap = {
          ...ALL_SUCCESS,
          "heavy-gate": "skipped",
          "device-gate": "skipped",
        };
        expect(runScript("push", results).status).toBe(0);
      });

      const pushRequiredJobs = ["fast-gate", "security-gate"] as const;
      const pushFailureCases = pushRequiredJobs.flatMap((job) =>
        FAILURE_MODES.map((mode) => [job, mode] as const)
      );

      it.each(pushFailureCases)(
        "exits 1 (never 0) when %s reports %s, regardless of heavy-gate/device-gate",
        (job, result) => {
          const results: ResultsMap = {
            ...ALL_SUCCESS,
            "heavy-gate": "skipped",
            "device-gate": "skipped",
            [job]: result,
          };
          expect(runScript("push", results).status).toBe(1);
        }
      );
    });

    describe("workflow_dispatch (manual execution) -- CI-03 regression", () => {
      it("fails closed (exit 1, never skipped/0) even when every job that ran actually succeeded", () => {
        // This is the exact scenario the bug allowed: an operator manually
        // dispatches the workflow against a ref that also has an open PR
        // pointing at the same commit. fast-gate/security-gate run and pass
        // (they carry no `if:`); heavy-gate/device-gate are skipped by their
        // own pull_request-only `if:`. Before CI-03, the whole merge-gate
        // job was itself skipped for this event, which posts a "skipped"
        // conclusion for the required check name -- and required-status-checks
        // treats a skipped required check as satisfied, not blocking. The
        // fix must make this scenario a hard failure, not a skip and not a
        // pass.
        const results: ResultsMap = {
          ...ALL_SUCCESS,
          "heavy-gate": "skipped",
          "device-gate": "skipped",
        };
        const outcome = runScript("workflow_dispatch", results);
        expect(outcome.status).toBe(1);
      });

      it("fails closed even when every job improbably reports success", () => {
        // Belt-and-suspenders: even if every predecessor somehow reported
        // success, a bare manual dispatch must still not be able to satisfy
        // this required check -- there is no event-specific validation
        // branch for workflow_dispatch at all, by design.
        expect(runScript("workflow_dispatch", ALL_SUCCESS).status).toBe(1);
      });
    });

    describe("unsupported/unrecognized events", () => {
      it.each(["schedule", "repository_dispatch", "made_up_event"])(
        "fails closed (exit 1) for event '%s' even when every job succeeded",
        (event) => {
          expect(runScript(event, ALL_SUCCESS).status).toBe(1);
        }
      );
    });

    it("never lets every-job-failed exit 0 on the event with the most required predecessors", () => {
      const results: ResultsMap = {
        "fast-gate": "failure",
        "security-gate": "failure",
        "heavy-gate": "failure",
        "device-gate": "failure",
      };
      expect(runScript("pull_request", results).status).toBe(1);
    });
  });

  describe("main-push confirmation stays bounded", () => {
    it("fast-gate and security-gate remain unconditional (the direct-push safety net)", () => {
      expect(field(jobBlock("fast-gate"), "if")).toBeUndefined();
      expect(field(jobBlock("security-gate"), "if")).toBeUndefined();
    });

    it("no job newly runs the full build+Playwright heavy path on a bare push", () => {
      const heavyOnPush = jobNames.filter((name) => {
        if (name === "fast-gate" || name === "security-gate") return false;
        if (name === "cross-device-matrix") return false;
        const block = jobBlock(name);
        const ifCondition = field(block, "if");
        const runsOnPush =
          ifCondition === undefined || /\bpush\b/.test(ifCondition);
        return runsOnPush && block.includes("npm run build");
      });
      expect(heavyOnPush).toEqual([]);
    });
  });

  /**
   * ADR 0039 (Correction 2026-09-18): `cancel-in-progress` was
   * `${{ github.event_name == 'pull_request' }}`, which evaluates false on
   * `main` pushes. Consecutive merges therefore each got a complete,
   * non-superseding run -- fourteen of them on 2026-09-13, against what is
   * actually a 2,000-minute Free-plan allowance rather than the 3,000 the
   * ADR originally claimed. Superseding is strictly cheaper than letting a
   * stale run finish, because GitHub bills a cancelled job's elapsed time
   * rather than its full cap.
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
   * hang cannot consume a large fraction of the monthly allowance. The
   * specific caps stay provisional pending measurement under #733; that an
   * unbounded job never reappears is enforceable today.
   */
  describe("every job bounds its own cost", () => {
    it.each(jobNames)("%s declares timeout-minutes", (name) => {
      const timeout = field(jobBlock(name), "timeout-minutes");
      expect(timeout).toBeDefined();
      expect(Number(timeout)).toBeGreaterThan(0);
    });
  });
});
