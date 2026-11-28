// @vitest-environment node
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

// ADR 0063: Production ships only through the weekly release train's Deploy
// Hook, so every Git-triggered deployment stays off.
describe("production deploy configuration", () => {
  const root = process.cwd();
  const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  const vercelConfig = JSON.parse(read("vercel.json"));
  const workflowDir = path.join(root, ".github", "workflows");
  const workflows = fs.readdirSync(workflowDir).map((file) => ({
    file,
    content: fs.readFileSync(path.join(workflowDir, file), "utf8"),
  }));

  it("builds the Next.js app with the repository's own install and build commands", () => {
    expect(vercelConfig.framework).toBe("nextjs");
    expect(vercelConfig.installCommand).toBe("npm ci");
    expect(vercelConfig.buildCommand).toBe("npm run build");
  });

  it("disables all Git-triggered deployments (the train fires a Deploy Hook)", () => {
    expect(vercelConfig.git.deploymentEnabled).toBe(false);
  });

  it("schedules exactly one daily cron, the maintenance route (Vercel Hobby limit)", () => {
    expect(vercelConfig.crons).toEqual([
      { path: "/api/cron/maintenance", schedule: "0 0 * * *" },
    ]);
  });

  // Behaviour lives in __tests__/build.test.ts, which runs scripts/build.js
  // with spawnSync mocked: off-Vercel and preview builds never migrate, a
  // production build without DATABASE_URL_UNPOOLED exits 1 before compiling,
  // and the migration subprocess receives the unpooled endpoint as DIRECT_URL.
  // This test pins the source shape those cases rely on: one migration call,
  // and it sits behind both halves of the guard.
  it("migrates only inside the Vercel production guard in scripts/build.js", () => {
    const script = read("scripts/build.js");
    const guard =
      /if \(\s*process\.env\.VERCEL === "1"\s*&&\s*process\.env\.VERCEL_ENV === "production"\s*\)\s*\{/;
    const guardMatch = guard.exec(script);
    expect(guardMatch, "Vercel production guard").not.toBeNull();

    const migrateCall = /\["prisma",\s*"migrate",\s*"deploy"\]/g;
    const calls = [...script.matchAll(migrateCall)];
    expect(calls).toHaveLength(1);

    const guardStart = guardMatch?.index ?? -1;
    const guardEnd = script.indexOf("\n}\n", guardStart);
    expect(calls[0].index).toBeGreaterThan(guardStart);
    expect(calls[0].index).toBeLessThan(guardEnd);
    expect(script.slice(guardStart, guardEnd)).toContain(
      "process.env.DATABASE_URL_UNPOOLED"
    );
  });

  it("has no GitHub release or deployment workflow", () => {
    expect(
      fs.existsSync(path.join(workflowDir, "release.yml")) ||
        fs.existsSync(path.join(workflowDir, "release.yaml"))
    ).toBe(false);

    for (const { file, content } of workflows) {
      expect(file).not.toMatch(/release|deploy|promot/i);
      // A GitHub deployment environment is how a workflow would hold deploy
      // secrets or approvals; CI needs neither.
      expect(content, file).not.toMatch(/^\s*environment:/m);
      expect(content, file).not.toMatch(/deployments:\s*write/);
    }
  });

  it("keeps deploys out of GitHub Actions so secrets live only in Vercel", () => {
    for (const { file, content } of workflows) {
      expect(content, file).not.toMatch(
        /vercel(@[\w.${}]+)?"?\s+(deploy|promote|build|--prod)\b/
      );
      expect(content, file).not.toMatch(/vercel-action/i);
      for (const secret of [
        "PRODUCTION_MIGRATION_DATABASE_URL",
        "DATABASE_URL_UNPOOLED",
        "VERCEL_TOKEN",
      ]) {
        expect(content, file).not.toContain(secret);
      }
    }
  });

  // ADR 0063 (Proposed): the one workflow allowed to start a release, and
  // only by POSTing the Deploy Hook behind the operator's switch and holds.
  it("builds in CI and the train under Vercel's Hobby build machine limits", () => {
    // 2026-10-28: two out-of-memory failures reached Vercel because CI and the
    // train built on 4 cores and 16 GB. The wrapper holds the build to 2
    // cores, 8 GB and no swap, and fails above 85% of that memory.
    const wrapper = fs.readFileSync(
      path.join(process.cwd(), "scripts/vercel-shaped-build.sh"),
      "utf8"
    );
    expect(wrapper).toMatch(/^export VERCEL=1$/m);
    expect(wrapper).toMatch(/^unset VERCEL_ENV$/m);
    expect(wrapper).toMatch(
      /^LIMIT_BYTES=\$\(\(8 \* 1024 \* 1024 \* 1024\)\)$/m
    );
    expect(wrapper).toMatch(/^CPUS="0-1"$/m);
    expect(wrapper).toMatch(/^BUDGET_PERCENT=85$/m);
    expect(wrapper).toContain('echo 0 | sudo tee "$CG/memory.swap.max"');
    expect(wrapper).toContain(
      'echo "$CPUSET_MEMS" | sudo tee "$CG/cpuset.mems"'
    );
    expect(wrapper).toContain("trap cleanup EXIT");
    expect(wrapper).toContain("trap 'handle_signal INT' INT");
    expect(wrapper).toContain("trap 'handle_signal TERM' TERM");
    expect(wrapper).toContain('cat "$CG/memory.peak"');
    expect(wrapper).toContain("exec npm run build");
    expect(wrapper).toMatch(/oom_kill/);

    for (const file of ["ci.yml", "weekly-train.yml"]) {
      const workflow = fs.readFileSync(
        path.join(process.cwd(), ".github/workflows", file),
        "utf8"
      );
      expect(workflow, file).toContain(
        "run: bash scripts/vercel-shaped-build.sh"
      );
      expect(workflow, file).toMatch(/VERCEL:\s*"1"/);
      expect(workflow, file).not.toMatch(/VERCEL_ENV:/);
      expect(workflow, file).not.toContain("public/garmin-engine.js");
      expect(workflow, file).not.toContain("public/monkey-c-mayhem.js");
      // Vercel builds on Node 24.x.
      expect(workflow, file).toMatch(/node-version: 24\b/);
    }
  });

  it("enforces VERCEL=1 without VERCEL_ENV, cpuset.mems ordering, memory.peak budget, and trap cleanup at runtime", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "vercel-shaped-build-test-")
    );
    try {
      const binDir = path.join(tempDir, "bin");
      const cgroupRoot = path.join(tempDir, "cgroup");
      fs.mkdirSync(binDir, { recursive: true });
      fs.mkdirSync(cgroupRoot, { recursive: true });

      fs.writeFileSync(
        path.join(cgroupRoot, "cgroup.controllers"),
        "cpuset memory\n"
      );
      fs.writeFileSync(path.join(cgroupRoot, "cgroup.subtree_control"), "");
      fs.writeFileSync(path.join(cgroupRoot, "cpuset.mems.effective"), "0-1\n");

      const sudoBin = path.join(binDir, "sudo");
      fs.writeFileSync(sudoBin, '#!/usr/bin/env bash\nexec "$@"\n', {
        mode: 0o755,
      });

      const npmBin = path.join(binDir, "npm");
      const capturedStatePath = path.join(tempDir, "captured-state.json");
      fs.writeFileSync(
        npmBin,
        `#!/usr/bin/env bash
set -euo pipefail
cg="$CGROUP_ROOT/vercel-shaped-build"
node -e '
  const fs = require("fs");
  const cg = process.argv[1];
  const out = process.argv[2];
  fs.writeFileSync(out, JSON.stringify({
    vercel: process.env.VERCEL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    cpusetCpus: fs.readFileSync(cg + "/cpuset.cpus", "utf8").trim(),
    cpusetMems: fs.readFileSync(cg + "/cpuset.mems", "utf8").trim(),
    procs: fs.readFileSync(cg + "/cgroup.procs", "utf8").trim(),
  }));
' "$cg" "${capturedStatePath}"
echo "anon \${MOCK_ANON_BYTES:-1048576}" >"$cg/memory.stat"
echo "\${MOCK_PEAK_BYTES:-1048576}" >"$cg/memory.peak"
echo "oom_kill \${MOCK_OOM_KILLS:-0}" >"$cg/memory.events"
if [ "\${MOCK_SLEEP_SECONDS:-0}" -gt 0 ]; then
  sleep "\$MOCK_SLEEP_SECONDS"
fi
`,
        { mode: 0o755 }
      );
      // Keep metrics readable until wrapper finishes, then let mock sudo rmdir clean up.
      fs.writeFileSync(
        sudoBin,
        `#!/usr/bin/env bash
if [ "\${1:-}" = "rmdir" ]; then
  rm -rf "\$2"
  exit 0
fi
exec "$@"
`,
        { mode: 0o755 }
      );

      const baseEnv = {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CGROUP_ROOT: cgroupRoot,
        TMPDIR: tempDir,
        VERCEL_ENV: "preview",
      };

      const passRun = spawnSync(
        "bash",
        [path.join(root, "scripts/vercel-shaped-build.sh")],
        { cwd: root, env: baseEnv, encoding: "utf8" }
      );
      expect(passRun.status).toBe(0);
      const captured = JSON.parse(fs.readFileSync(capturedStatePath, "utf8"));
      expect(captured).toMatchObject({
        vercel: "1",
        vercelEnv: null,
        cpusetCpus: "0-1",
        cpusetMems: "0-1",
      });
      expect(captured.procs).toMatch(/^\d+$/);
      expect(fs.existsSync(path.join(cgroupRoot, "vercel-shaped-build"))).toBe(
        false
      );
      expect(
        fs.readdirSync(tempDir).filter((name) => name.startsWith("tmp."))
      ).toEqual([]);

      // Gate on kernel memory.peak > 85% of 8 GiB even when anon stays tiny.
      const overPeakBytes = String(7 * 1024 * 1024 * 1024);
      const peakFailRun = spawnSync(
        "bash",
        [path.join(root, "scripts/vercel-shaped-build.sh")],
        {
          cwd: root,
          env: {
            ...baseEnv,
            MOCK_ANON_BYTES: "1048576",
            MOCK_PEAK_BYTES: overPeakBytes,
          },
          encoding: "utf8",
        }
      );
      expect(peakFailRun.status).toBe(1);
      expect(peakFailRun.stdout + peakFailRun.stderr).toContain("memory.peak");
      expect(fs.existsSync(path.join(cgroupRoot, "vercel-shaped-build"))).toBe(
        false
      );

      // Signal trap cleans up $CG and $PEAK_FILE on SIGTERM.
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "bash",
          [path.join(root, "scripts/vercel-shaped-build.sh")],
          {
            cwd: root,
            env: { ...baseEnv, MOCK_SLEEP_SECONDS: "30" },
          }
        );
        const cgDir = path.join(cgroupRoot, "vercel-shaped-build");
        const poll = setInterval(() => {
          if (fs.existsSync(path.join(cgDir, "cgroup.procs"))) {
            clearInterval(poll);
            child.kill("SIGTERM");
          }
        }, 25);
        child.on("error", (err) => {
          clearInterval(poll);
          reject(err);
        });
        child.on("exit", () => {
          clearInterval(poll);
          try {
            expect(fs.existsSync(cgDir)).toBe(false);
            expect(
              fs.readdirSync(tempDir).filter((name) => name.startsWith("tmp."))
            ).toEqual([]);
            resolve();
          } catch (assertionError) {
            reject(assertionError);
          }
        });
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps the weekly train behind its switch, holds and gates", () => {
    const train = read(".github/workflows/weekly-train.yml");

    expect(train).toContain('- cron: "0 1 * * 1"');
    expect(train.match(/- cron:/g)).toHaveLength(1);
    expect(train).toMatch(/workflow_dispatch:/);
    expect(train).toMatch(
      /permissions:\s*\n\s*contents: write\s*\n\s*checks: read\s*\n\s*issues: write\s*\n/
    );
    expect(train).toMatch(/timeout-minutes: \d+/);

    expect(train).toContain('"$EVENT" = "schedule" ] && [ "$SWITCH" != "on" ]');
    expect(train).toContain("SWITCH: ${{ vars.WEEKLY_TRAIN }}");
    expect(train).toContain('--label "release:hold"');
    expect(train).toContain("ignore_release_hold:");
    expect(train).toContain("IGNORE_HOLD: ${{ inputs.ignore_release_hold }}");
    expect(train).toContain('if [ "$IGNORE_HOLD" = "true" ]; then');
    expect(train).toContain("Merge Gate (Required Checks Summary)");
    expect(train).toContain("scripts/check-migration-safety.ts");
    expect(train).toContain("${{ secrets.VERCEL_DEPLOY_HOOK_MAIN }}");
    expect(train).toContain("gh release create");
    expect(train).toContain("--draft");

    // Vercel builds and migrates; the train only asks it to.
    expect(train).not.toMatch(/prisma migrate|npx vercel/);

    // Its own build only tests the release candidate (#2536): one build, in
    // the read-only rc-build job, against a database that cannot answer, and
    // nothing fires unless the browser suite passed on that commit.
    const job = (name: string) => {
      const start = train.indexOf(`\n  ${name}:\n`);
      const next = train.slice(start + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
      return next === -1
        ? train.slice(start)
        : train.slice(start, start + 1 + next);
    };
    // The one build runs through the Vercel-shaped wrapper, so a candidate
    // that would run out of memory on Vercel fails before the hook fires.
    expect(
      train.match(/run: bash scripts\/vercel-shaped-build\.sh/g)
    ).toHaveLength(1);
    const rcBuild = job("rc-build");
    expect(rcBuild).toContain("run: bash scripts/vercel-shaped-build.sh");
    expect(rcBuild).toContain("127.0.0.1:59999");
    expect(rcBuild).toContain("npm run analyze:bundle -- --strict");
    for (const name of ["rc-build", "rc-browser"]) {
      expect(job(name), name).toMatch(
        /permissions:\s*\n\s*contents: read\s*\n/
      );
      expect(job(name), name).toContain(
        "ref: ${{ needs.gate.outputs.candidate }}"
      );
    }
    expect(job("rc-browser")).toContain("playwright test --project=chromium");
    expect(job("train")).toContain("needs.rc-browser.result == 'success'");
    const secrets = [...train.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(secrets)).toEqual(new Set(["VERCEL_DEPLOY_HOOK_MAIN"]));

    // The release is published only after the live site reports its commit.
    const fire = train.indexOf('-X POST "$HOOK"');
    const publish = train.indexOf("gh release edit");
    expect(fire).toBeGreaterThan(-1);
    expect(publish).toBeGreaterThan(fire);
    expect(train.slice(fire, publish)).toContain("/api/version");
    // ...and the synthetic probes passed against it (#2538).
    expect(train).toContain("uses: ./.github/workflows/synthetic-probes.yml");
    expect(train).toContain("needs.probe.result == 'success'");
    // The dry run skips the release candidate jobs, so the probe job must not
    // rely on the implicit success(), which a skipped upstream job fails (#3021).
    const probeJob = train.slice(
      train.indexOf("\n  probe:"),
      train.indexOf("\n  publish:")
    );
    expect(probeJob).toMatch(
      /if: \$\{\{ !cancelled\(\) && needs\.train\.result == 'success'/
    );
    expect(read(".github/workflows/synthetic-probes.yml")).toMatch(
      /workflow_call:/
    );

    const adr = read("adr/0063-weekly-release-train.md");
    expect(adr).toMatch(/## Status\s+Accepted/);
  });

  it("still sends the protection bypass header when a probe targets a protected URL", () => {
    expect(read("playwright.config.ts")).toContain(
      "x-vercel-protection-bypass"
    );
  });

  // The webpack compile ran Vercel's 8 GB build machine out of memory on
  // 2026-10-28; Next's webpack memory optimizations keep it under the limit.
  it("keeps Next's webpack memory optimizations on for the 8 GB build machine", () => {
    expect(read("next.config.ts")).toMatch(
      /webpackMemoryOptimizations:\s*true/
    );
  });

  // Issue #995: bundling jsdom pulled @exodus/bytes (ESM-only) through
  // html-encoding-sniffer into a require() chain and every SSR page returned
  // 500 with ERR_REQUIRE_ESM. All four packages must stay external.
  it("keeps jsdom, isomorphic-dompurify, @exodus/bytes, and html-encoding-sniffer out of the server bundle", () => {
    const serverExternals = /serverExternalPackages:\s*\[([^\]]*)\]/.exec(
      read("next.config.ts")
    );
    expect(serverExternals, "serverExternalPackages").not.toBeNull();
    const packages = [
      ...(serverExternals?.[1] ?? "").matchAll(/["']([^"']+)["']/g),
    ].map((match) => match[1]);
    expect(packages).toEqual(
      expect.arrayContaining([
        "jsdom",
        "isomorphic-dompurify",
        "@exodus/bytes",
        "html-encoding-sniffer",
      ])
    );
  });

  it("documents Vercel as the only production migration path", () => {
    const productionDocs = [
      "docs/how-to/write-a-database-migration.md",
      "SECURITY.md",
      "CONTRIBUTING.md",
      "docs/how-to/release-and-deploy.md",
    ].map((file) => ({ file, content: read(file) }));

    for (const { file, content } of productionDocs) {
      expect(content, file).not.toMatch(/release:gate|release-gate\.ts/i);
      expect(content, file).not.toMatch(/npx prisma migrate deploy/i);
    }

    const migrationGuide = productionDocs[0].content;
    expect(migrationGuide).toContain("VERCEL=1");
    expect(migrationGuide).toContain("VERCEL_ENV=production");
    expect(migrationGuide).toContain("DATABASE_URL_UNPOOLED");
  });

  it("ships Production through the accepted weekly train, with ADR 0051 superseded", () => {
    const runbook = read("docs/how-to/release-and-deploy.md");
    for (const step of [
      "adr/0049-deploy-main-on-green-ci.md",
      "adr/0051-manual-production-releases.md",
      "Merge Gate (Required Checks Summary)",
      "Deployment Checks",
      "DATABASE_URL_UNPOOLED",
      "Instant Rollback",
      "vercel.json",
      "Create Deployment",
    ]) {
      expect(runbook).toContain(step);
    }

    const adr = read("adr/0049-deploy-main-on-green-ci.md");
    expect(adr).toMatch(/## Status\s+Accepted/);
    expect(adr).toMatch(/"\*": false,\s*"main": true/);

    const train = read("adr/0063-weekly-release-train.md");
    expect(train).toMatch(/## Status\s+Accepted/);
    expect(runbook).toContain("adr/0063-weekly-release-train.md");

    const temporaryAdr = read("adr/0051-manual-production-releases.md");
    expect(temporaryAdr).toMatch(/## Status\s+Superseded by \[ADR 0063\]/);
    expect(temporaryAdr).toContain("1168");
    expect(temporaryAdr).toMatch(/Deployments → Create\s+Deployment/);

    expect(read("AGENTS.md")).toMatch(
      /GitHub Actions runs CI and never deploys/
    );

    for (const file of [
      "AGENTS.md",
      "ARCHITECTURE.md",
      "CONTRIBUTING.md",
      "DEPLOYMENT.md",
      "adr/0008-proactive-defect-interception-strategy.md",
      "adr/0049-deploy-main-on-green-ci.md",
      "adr/0050-jules-consolidation-release.md",
      "adr/0051-manual-production-releases.md",
      "docs/how-to/release-and-deploy.md",
      "docs/how-to/configure-integrations.md",
      "docs/how-to/monitor-github-actions-minutes.md",
      "docs/how-to/monitor-vercel-headroom.md",
      "docs/how-to/restore-the-production-database.md",
      "docs/reference/integrations-catalog.md",
      "docs/reference/vercel-retention-inventory.md",
      "scripts/git-guardrail.sh",
    ]) {
      expect(read(file), file).not.toMatch(/2026-10-01|October 1/);
    }
  });

  // ADR 0049 records the removal of the GitHub release path, so it may name
  // it. Everything else current must not; text that an ADR explicitly marks
  // superseded (a whole ADR whose Status opens with **Superseded, or a
  // blockquote that does) is history and is skipped.
  it("names the removed GitHub release path only in superseded history", () => {
    const listMarkdown = (dir: string) =>
      fs
        .readdirSync(path.join(root, dir))
        .filter((file) => file.endsWith(".md"))
        .map((file) => path.posix.join(dir, file));
    const corpus = [
      ...listMarkdown("."),
      ...listMarkdown("adr"),
      ...listMarkdown("docs/how-to"),
    ].filter(
      (file) =>
        file !== "CHANGELOG.md" &&
        file !== "adr/0049-deploy-main-on-green-ci.md"
    );

    const isSupersededAdr = (content: string) =>
      /## Status\s+\*\*Superseded/.test(content);
    const withoutSupersededQuotes = (content: string) =>
      content
        .split(/\n[ \t]*\n/)
        .filter(
          (block) => !/^\s*>/.test(block) || !block.includes("**Superseded")
        )
        .join("\n\n");

    const current = corpus
      .map((file) => ({ file, content: read(file) }))
      .filter(({ content }) => !isSupersededAdr(content));
    expect(current.map(({ file }) => file)).toContain(
      "adr/0039-github-pro-plan-capabilities-and-actions-minutes-governance.md"
    );
    expect(current.map(({ file }) => file)).not.toContain(
      "adr/0038-protected-build-once-production-releases.md"
    );

    for (const { file, content } of current) {
      expect(withoutSupersededQuotes(content), file).not.toMatch(
        /release\.ya?ml|production-release\b|release:gate|release-gate\.ts/
      );
    }
  });
});
