// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  BOT_BRANCH_PREFIXES,
  ARCADE_DEVICE_GAMES,
  FULL_SUITE_LABEL,
  HUMAN_BRANCH_PREFIXES,
  arcadeDeviceGrep,
  computeRunPolicy,
  evaluateMergeGate,
  formatOutputs,
  isBotBranch,
  isNonCodePath,
  MERGE_GATE_JOBS,
  readLiveDraft,
} from "../scripts/ci-run-policy.mjs";
import { validateBranchName } from "../lib/dx/git-guard";

/**
 * #1773: the `changes` job in ci.yml runs scripts/ci-run-policy.mjs to decide
 * which gate groups run. These cases pin the decision table Merge Gate relies
 * on: docs-only PRs skip only the browser gates, drafts run quick checks
 * until ready (#2541), bot PRs run quick checks until promoted, and anything unknown counts
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
      ".claude/skills/tdd",
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

    it("runs quick checks only on a draft (#2541)", () => {
      expect(pr({ draft: true })).toMatchObject({
        draft: true,
        runUnit: false,
        runBrowser: false,
      });
      expect(pr({ draft: true }).reason).toContain("draft PR");
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
        "config/stryker/stryker.config.mjs",
        "config/stryker/vitest.stryker.config.mts",
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
        const value = source === "arcade_device_grep" ? ".*" : "(true|false)";
        expect(output).toMatch(new RegExp(`^${source}=${value}$`, "m"));
      }
    });

    it("names the same promotion label in Merge Gate's failure message", () => {
      // #3601: Merge Gate's message now comes from evaluateMergeGate().
      const verdict = evaluateMergeGate({
        eventName: "pull_request",
        needs: {
          changes: { result: "success", outputs: { bot_pr: "true" } },
        },
      });
      expect(verdict.lines).toContain(
        "::error::bot PR: full suite runs when marked ready (a maintainer applies the 'ci:full' label)."
      );
      expect(FULL_SUITE_LABEL).toBe("ci:full");
    });
  });

  describe("arcade device specs for touched games (#2517)", () => {
    const grep = (files: string[] | null) =>
      new RegExp(arcadeDeviceGrep(files) || "(?!)");

    it("selects only the game a change belongs to", () => {
      const pattern = arcadeDeviceGrep(["components/LaserLoon.tsx"]);
      expect(pattern).toBe("Laser Loon");
      expect(
        grep(["components/laser-loon/PauseMenu.tsx"]).test(
          "Laser Loon on a tablet (iPad projects, #2081)"
        )
      ).toBe(true);
    });

    it("maps engine and spec paths to their game", () => {
      expect(arcadeDeviceGrep(["lib/dungeon/generator.ts"])).toBe(
        "Retro Labyrinth"
      );
      expect(arcadeDeviceGrep(["lib/garmin/engine.ts"])).toBe(
        "Monkey C Mayhem"
      );
      expect(
        arcadeDeviceGrep(["__tests__/e2e/for-better-or-bulk-tablet.spec.ts"])
      ).toBe("For Better or Bulk");
      expect(arcadeDeviceGrep(["app/arcade/meme-vault/page.tsx"])).toBe(
        "Meme Vault"
      );
    });

    it("adds the shared kit blocks when cabinet code changes", () => {
      const pattern = grep(["components/arcade/PlayCabinet.tsx"]);
      expect(
        pattern.test("Tablet arcade kit (iPad projects) /arcade/laser-loon")
      ).toBe(true);
      expect(pattern.test("Mobile arcade kit: immersive touch cabinet")).toBe(
        true
      );
      expect(pattern.test("Laser Loon on a tablet")).toBe(false);
    });

    it("runs the kit blocks when the phone kit or its harness changes (#2365)", () => {
      for (const file of [
        "__tests__/e2e/phone-kit.spec.ts",
        "__tests__/e2e/mobile-harness.ts",
        "playwright.config.ts",
      ]) {
        expect(arcadeDeviceGrep([file])).toBe(
          "Tablet arcade kit|Mobile arcade kit"
        );
      }
    });

    it("selects Retro Labyrinth for its phone spec and the specs it shares with the tablet", () => {
      for (const file of [
        "__tests__/e2e/retro-labyrinth-phone.spec.ts",
        "__tests__/e2e/helpers/retro-labyrinth-device.ts",
      ]) {
        expect(arcadeDeviceGrep([file])).toBe("Retro Labyrinth");
      }
    });

    it("runs the kit blocks when this selection logic itself changes", () => {
      expect(arcadeDeviceGrep(["scripts/ci-run-policy.mjs"])).toBe(
        "Tablet arcade kit|Mobile arcade kit"
      );
    });

    it("ignores unit tests, which cannot change what a device spec sees", () => {
      expect(
        arcadeDeviceGrep([
          "__tests__/retro-labyrinth-run-rules.test.ts",
          "__tests__/patty-drive-thru-dilemmas.test.ts",
          "__tests__/crf/scenario-impact.test.ts",
        ])
      ).toBe("");
      expect(
        arcadeDeviceGrep([
          "__tests__/garmin-ceiling.test.ts",
          "__tests__/e2e/retro-labyrinth-tablet.spec.ts",
        ])
      ).toBe("Retro Labyrinth");
    });

    it("ignores documentation, including the generated reference", () => {
      expect(
        arcadeDeviceGrep([
          "docs/reference/api/lib/patty-drive-thru/presets/variables/SCENARIO_LIMITS.md",
          "docs/reference/api/lib/study-director/index.md",
          "docs/how-to/play-retro-labyrinth.md",
        ])
      ).toBe("");
      expect(
        arcadeDeviceGrep([
          "docs/reference/api/lib/protocol-drift/index.md",
          "components/protocol-drift/ProtocolDriftGame.tsx",
        ])
      ).toBe("Protocol Drift");
    });

    it("runs nothing for a change outside the arcade", () => {
      expect(arcadeDeviceGrep(["components/Hero.tsx", "lib/seo.ts"])).toBe("");
    });

    it("runs everything when the change set is unknown", () => {
      expect(arcadeDeviceGrep(null)).toBe(".");
      expect(arcadeDeviceGrep([])).toBe(".");
    });

    it("gives every game a pattern that matches its own spec titles", () => {
      for (const [name] of ARCADE_DEVICE_GAMES) {
        expect(new RegExp(name).test(`${name} on a tablet`)).toBe(true);
      }
      const both = grep([
        "components/patty-drive-thru/BoothScene.tsx",
        "components/trial-and-error/CardTable.tsx",
      ]);
      expect(
        both.test("Patty's Drive-Thru on a tablet (iPad projects, #2116)")
      ).toBe(true);
      expect(
        both.test("Trial & Error on a tablet (iPad projects, #2120)")
      ).toBe(true);
      expect(both.test("Laser Loon on a tablet")).toBe(false);
    });

    it("is emitted on a code PR and empty when browser gates are skipped", () => {
      const code = computeRunPolicy({
        eventName: "pull_request",
        headRef: "feat/x",
        changedFiles: ["components/RetroLabyrinth.tsx"],
      });
      expect(code.arcadeDeviceGrep).toBe("Retro Labyrinth");
      const draft = computeRunPolicy({
        eventName: "pull_request",
        headRef: "feat/x",
        draft: true,
        changedFiles: ["components/RetroLabyrinth.tsx"],
      });
      expect(draft.arcadeDeviceGrep).toBe("");
      expect(computeRunPolicy({ eventName: "push" }).arcadeDeviceGrep).toBe("");
    });
  });
  /**
   * #3185: a push run queued after "Ready for review" used to cancel the
   * ready run, keep `draft: true` from its own payload and fail Merge Gate
   * on a ready PR (#2559, #2810). The policy now reads the live PR.
   */
  describe("live draft state (#3185)", () => {
    const options = {
      apiUrl: "https://api.github.com",
      repository: "owner/repo",
      prNumber: "42",
      token: "test-token",
    };

    const respond = (status: number, body: unknown) =>
      (async () =>
        new Response(JSON.stringify(body), { status })) as typeof fetch;

    it("asks the pulls endpoint for the PR, with the token", async () => {
      const calls: Array<{ url: string; auth: string | null }> = [];
      const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          auth: new Headers(init?.headers).get("authorization"),
        });
        return new Response(JSON.stringify({ draft: false }), { status: 200 });
      }) as typeof fetch;
      await expect(readLiveDraft({ ...options, fetchImpl })).resolves.toBe(
        false
      );
      expect(calls).toEqual([
        {
          url: "https://api.github.com/repos/owner/repo/pulls/42",
          auth: "Bearer test-token",
        },
      ]);
    });

    it("returns the PR's current flag, whatever the payload said", async () => {
      await expect(
        readLiveDraft({ ...options, fetchImpl: respond(200, { draft: true }) })
      ).resolves.toBe(true);
      await expect(
        readLiveDraft({ ...options, fetchImpl: respond(200, { draft: false }) })
      ).resolves.toBe(false);
    });

    it.each([
      ["a non-2xx status", respond(404, { message: "Not Found" })],
      ["a body without a boolean draft", respond(200, { draft: "false" })],
      [
        "a network error",
        (async () => {
          throw new TypeError("fetch failed");
        }) as typeof fetch,
      ],
    ])(
      "returns null on %s, so the payload's flag is kept",
      async (_, fetchImpl) => {
        await expect(
          readLiveDraft({ ...options, fetchImpl })
        ).resolves.toBeNull();
      }
    );

    it.each([
      ["no token", { token: undefined }],
      ["no repository", { repository: undefined }],
      ["a non-numeric PR number", { prNumber: "42/../../x" }],
    ])("does not call the API with %s", async (_, override) => {
      let called = false;
      const fetchImpl = (async () => {
        called = true;
        return new Response("{}", { status: 200 });
      }) as typeof fetch;
      await expect(
        readLiveDraft({ ...options, ...override, fetchImpl })
      ).resolves.toBeNull();
      expect(called).toBe(false);
    });

    it("gives the changes job the PR number, a token and read access to pull requests", () => {
      const ci = fs.readFileSync(
        path.resolve(process.cwd(), ".github/workflows/ci.yml"),
        "utf-8"
      );
      const start = ci.indexOf("\n  changes:\n");
      const end = ci.indexOf("\n  static-gate:\n");
      expect(start).toBeGreaterThan(-1);
      const job = ci.slice(start, end);
      expect(job).toMatch(
        /^ {4}permissions:\n {6}contents: read\n {6}pull-requests: read$/m
      );
      expect(job).toContain(
        "PR_NUMBER: ${{ github.event.pull_request.number }}"
      );
      expect(job).toContain("GITHUB_TOKEN: ${{ github.token }}");
    });

    it("keeps one concurrency group per PR, so the newest run still supersedes", () => {
      // Splitting the group by event action would leave the stale push run
      // alive beside the ready run, and would stop cancel-closed-pr-ci.yml,
      // which joins this exact group, from cancelling a closed PR's runs.
      const ci = fs.readFileSync(
        path.resolve(process.cwd(), ".github/workflows/ci.yml"),
        "utf-8"
      );
      expect(ci).toContain(
        "  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}\n  cancel-in-progress: true"
      );
    });
  });

  describe("security audit PR scoping", () => {
    it("skips live npm vulnerability auditing on PRs that do not touch dependencies or security policy", () => {
      const policy = computeRunPolicy({
        eventName: "pull_request",
        headRef: "feat/ui-polish",
        changedFiles: ["app/page.tsx", "docs/README.md"],
      });
      expect(policy.runSecurityAudit).toBe(false);
      expect(formatOutputs(policy)).toContain("run_security_audit=false");
    });

    it.each([
      "package.json",
      "package-lock.json",
      "SECURITY.md",
      "config/security-audit-ignore.json",
      "config/license-policy.json",
      "config/license-policy.schema.json",
      "infra/docker/postgres/Dockerfile",
      "scripts/security-audit.ts",
      "scripts/overrides-audit.ts",
      "scripts/license-audit.ts",
      "scripts/deps-fix.ts",
      "scripts/triage-security-issue.ts",
      "scripts/ci-run-policy.mjs",
      "scripts/study-data-core-constraints.txt",
      ".github/dependabot.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/scheduled-security-audit.yml",
      ".github/workflows/overrides-audit.yml",
      ".github/workflows/study-data-core.yml",
      ".github/workflows/neon-backup.yml",
    ])("runs live npm vulnerability auditing when %s changes", (file) => {
      const policy = computeRunPolicy({
        eventName: "pull_request",
        headRef: "chore/deps-update",
        changedFiles: ["app/page.tsx", file],
      });
      expect(policy.runSecurityAudit).toBe(true);
      expect(formatOutputs(policy)).toContain("run_security_audit=true");
    });

    it("fails safe to running the security audit when changed files are unknown or empty, and always on push", () => {
      expect(
        computeRunPolicy({
          eventName: "pull_request",
          headRef: "feat/unknown",
          changedFiles: null,
        }).runSecurityAudit
      ).toBe(true);
      expect(
        computeRunPolicy({
          eventName: "pull_request",
          headRef: "feat/empty",
          changedFiles: [],
        }).runSecurityAudit
      ).toBe(true);
      expect(
        computeRunPolicy({
          eventName: "push",
        }).runSecurityAudit
      ).toBe(true);
    });
  });
});

/**
 * #3601: Merge Gate reads the run-scope table instead of restating it in
 * shell. These cases drive `evaluateMergeGate()` with the `needs` object
 * GitHub passes it (`toJSON(needs)`), job by job.
 */
describe("Merge Gate verdict from the run-scope table (#3601)", () => {
  const ALWAYS = ["changes", "static-gate", "security-gate"];
  const UNIT = ["unit-gate", "unit-coverage", "mutation-gate"];
  const BROWSER = [
    "build",
    "heavy-gate",
    "bench-gate",
    "heavy-gate-report",
    "device-gate",
  ];
  const ALL = [...ALWAYS, ...UNIT, ...BROWSER];

  const needsFor = (
    results: Record<string, string>,
    outputs: Record<string, string> = {}
  ) =>
    Object.fromEntries(
      ALL.map((job) => [
        job,
        {
          result: results[job] ?? "success",
          outputs: job === "changes" ? outputs : {},
        },
      ])
    );
  const CODE_PR = {
    app_changed: "true",
    draft: "false",
    bot_pr: "false",
    promoted: "false",
  };
  const DOCS_PR = { ...CODE_PR, app_changed: "false" };
  const skipped = (jobs: string[]) =>
    Object.fromEntries(jobs.map((job) => [job, "skipped"]));

  it("covers exactly the eleven gate jobs, once each", () => {
    const jobs = MERGE_GATE_JOBS.map((row) => row.job);
    expect(new Set(jobs).size).toBe(jobs.length);
    expect([...jobs].sort()).toEqual([...ALL].sort());
  });

  it("passes a ready code PR whose every gate succeeded", () => {
    const verdict = evaluateMergeGate({
      eventName: "pull_request",
      needs: needsFor({}, CODE_PR),
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.lines.some((line) => line.startsWith("::error::"))).toBe(
      false
    );
  });

  it.each(
    ALL.flatMap((job) =>
      ["failure", "cancelled", "skipped"].map((r) => [job, r])
    )
  )("fails a code PR when %s reports %s", (job, result) => {
    const verdict = evaluateMergeGate({
      eventName: "pull_request",
      needs: needsFor({ [job]: result }, CODE_PR),
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.lines).toContain(
      `::error::Required job '${job}' did not succeed (result: ${result})`
    );
  });

  it("fails closed when a gate is missing from needs", () => {
    const needs = needsFor({}, CODE_PR);
    delete (needs as Record<string, unknown>)["device-gate"];
    const verdict = evaluateMergeGate({ eventName: "pull_request", needs });
    expect(verdict.passed).toBe(false);
    expect(verdict.lines).toContain(
      "::error::Required job 'device-gate' did not succeed (result: missing)"
    );
  });

  it("accepts skipped browser gates on a docs-only PR, and nothing else", () => {
    expect(
      evaluateMergeGate({
        eventName: "pull_request",
        needs: needsFor(skipped(BROWSER), DOCS_PR),
      }).passed
    ).toBe(true);
    expect(
      evaluateMergeGate({
        eventName: "pull_request",
        needs: needsFor({ ...skipped(BROWSER), build: "failure" }, DOCS_PR),
      }).passed
    ).toBe(false);
    expect(
      evaluateMergeGate({
        eventName: "pull_request",
        needs: needsFor(
          { ...skipped(BROWSER), "unit-gate": "skipped" },
          DOCS_PR
        ),
      }).passed
    ).toBe(false);
  });

  it("does not trust a docs-only output from a changes job that failed", () => {
    expect(
      evaluateMergeGate({
        eventName: "pull_request",
        needs: needsFor({ ...skipped(BROWSER), changes: "failure" }, DOCS_PR),
      }).passed
    ).toBe(false);
  });

  it("fails a draft even when every gate succeeded", () => {
    const verdict = evaluateMergeGate({
      eventName: "pull_request",
      needs: needsFor({}, { ...CODE_PR, draft: "true" }),
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.lines.join("\n")).toContain(
      "PR is a draft; mark it ready for review to run every gate."
    );
  });

  it("fails an unpromoted bot PR even when every gate succeeded, and passes a promoted one", () => {
    const unpromoted = evaluateMergeGate({
      eventName: "pull_request",
      needs: needsFor({}, { ...CODE_PR, bot_pr: "true" }),
    });
    expect(unpromoted.passed).toBe(false);
    expect(unpromoted.lines.join("\n")).toContain(
      "bot PR: full suite runs when marked ready"
    );
    expect(
      evaluateMergeGate({
        eventName: "pull_request",
        needs: needsFor({}, { ...CODE_PR, bot_pr: "true", promoted: "true" }),
      }).passed
    ).toBe(true);
  });

  it("on push requires the static, security and unit gates and ignores the browser gates", () => {
    expect(
      evaluateMergeGate({
        eventName: "push",
        needs: needsFor({ ...skipped(BROWSER), build: "failure" }),
      }).passed
    ).toBe(true);
    for (const job of [...ALWAYS, ...UNIT]) {
      expect(
        evaluateMergeGate({
          eventName: "push",
          needs: needsFor({ ...skipped(BROWSER), [job]: "skipped" }),
        }).passed,
        job
      ).toBe(false);
    }
  });

  it.each(["workflow_dispatch", "schedule", ""])(
    "fails closed for event '%s' even when every gate succeeded",
    (eventName) => {
      const verdict = evaluateMergeGate({ eventName, needs: needsFor({}) });
      expect(verdict.passed).toBe(false);
      expect(verdict.lines.join("\n")).toContain("failing closed");
    }
  );
});
