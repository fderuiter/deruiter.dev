import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// ADR 0051: all Git-triggered deployments are paused during the manual hold.
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

  it("disables all Git-triggered deployments during the manual hold", () => {
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

  it("still sends the protection bypass header when a probe targets a protected URL", () => {
    expect(read("playwright.config.ts")).toContain(
      "x-vercel-protection-bypass"
    );
  });

  // Issue #995: bundling jsdom pulled @exodus/bytes (ESM-only) through
  // html-encoding-sniffer into a require() chain and every SSR page returned
  // 500 with ERR_REQUIRE_ESM. Both packages must stay external.
  it("keeps jsdom and isomorphic-dompurify out of the server bundle", () => {
    const serverExternals = /serverExternalPackages:\s*\[([^\]]*)\]/.exec(
      read("next.config.ts")
    );
    expect(serverExternals, "serverExternalPackages").not.toBeNull();
    const packages = [
      ...(serverExternals?.[1] ?? "").matchAll(/["']([^"']+)["']/g),
    ].map((match) => match[1]);
    expect(packages).toEqual(
      expect.arrayContaining(["jsdom", "isomorphic-dompurify"])
    );
  });

  it("documents Vercel as the only production migration path", () => {
    const productionDocs = [
      "DATABASE_MIGRATIONS.md",
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

  it("keeps the manual release hold until an approved and verified replacement", () => {
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

    const temporaryAdr = read("adr/0051-manual-production-releases.md");
    expect(temporaryAdr).toContain("approved and verified");
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
