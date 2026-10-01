import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { checkInstallScriptAllowlist } from "../lib/dx/preflight";
import {
  parseIgnoreRules,
  matchAdvisoryRule,
  type Advisory,
} from "../scripts/security-audit";

// #854: installs must be reproducible. Vercel picks the newest Node major that
// satisfies engines.node, so an open-ended range silently moves production to
// the next major. Dependency lifecycle scripts run arbitrary code during
// `npm ci`, so each one is listed and justified, and a new one fails here
// instead of arriving unnoticed with a lockfile bump.
describe("reproducible install policy (#854)", () => {
  const root = process.cwd();
  const readJson = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  const allowlist: Record<string, string> = readJson(
    "scripts/install-script-allowlist.json"
  );

  it("bounds engines.node below the next major after the one CI runs", () => {
    const ciWorkflow = fs.readFileSync(
      path.join(root, ".github", "workflows", "ci.yml"),
      "utf8"
    );
    const ciMajors = new Set(
      [...ciWorkflow.matchAll(/node-version:\s*(\d+)/g)].map((m) => m[1])
    );
    expect(ciMajors.size).toBe(1);
    const [ciMajor] = [...ciMajors];

    expect(pkg.engines.node).toBe(`>=22.0.0 <${Number(ciMajor) + 1}.0.0`);
  });

  it("lists every dependency that runs an install script, and nothing else", () => {
    const withInstallScripts = new Set(
      Object.entries(
        lock.packages as Record<string, { hasInstallScript?: boolean }>
      )
        .filter(([key, meta]) => key !== "" && meta.hasInstallScript)
        .map(([key]) => key.slice(key.lastIndexOf("node_modules/") + 13))
    );

    const unreviewed = [...withInstallScripts].filter((n) => !(n in allowlist));
    const stale = Object.keys(allowlist).filter(
      (n) => !withInstallScripts.has(n)
    );

    expect(
      unreviewed,
      "New install scripts: review each package's lifecycle script, then add it to scripts/install-script-allowlist.json with a reason."
    ).toEqual([]);
    expect(
      stale,
      "These packages no longer run install scripts; remove them from scripts/install-script-allowlist.json."
    ).toEqual([]);
    for (const [name, reason] of Object.entries(allowlist)) {
      expect(reason.trim().length, `${name} needs a reason`).toBeGreaterThan(0);
    }
  });

  it("configures standard allowScripts in package.json and removes unsupported keys", () => {
    expect(
      pkg.ignoreScripts,
      "ignoreScripts must be removed from package.json"
    ).toBeUndefined();
    expect(
      pkg.trustedDependencies,
      "trustedDependencies must be removed from package.json"
    ).toBeUndefined();

    expect(
      pkg.allowScripts,
      "allowScripts must be defined in package.json"
    ).toBeDefined();
    expect(typeof pkg.allowScripts).toBe("object");

    const allowScriptsKeys = Object.keys(
      pkg.allowScripts as Record<string, boolean>
    ).sort();
    const allowlistKeys = Object.keys(allowlist).sort();

    expect(
      allowScriptsKeys,
      "package.json allowScripts must match scripts/install-script-allowlist.json registry"
    ).toEqual(allowlistKeys);

    for (const [name, enabled] of Object.entries(
      pkg.allowScripts as Record<string, boolean>
    )) {
      expect(enabled, `allowScripts entry for ${name} must be true`).toBe(true);
    }
  });

  it("validates lifecycle script allowlist through preflight check", () => {
    const result = checkInstallScriptAllowlist(root);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("allowScripts matches");
  });

  it("evaluates expanded moderate severity gate and override rules", () => {
    const fixedNow = new Date("2026-10-01T00:00:00Z");
    const modRuleInput = [
      {
        advisory: "GHSA-hrr3-gc8f-f4qj",
        package: "fast-uri",
        expiresAt: "2026-11-15T00:00:00Z",
        createdAt: "2026-10-01T00:00:00Z",
        severity: "moderate",
        reason:
          "URL parser case normalization flaw in non-critical dev tool dependency",
        owner: "security-team",
        followUp: "#1401",
      },
    ];

    const rules = parseIgnoreRules(modRuleInput, fixedNow);
    expect(rules).toHaveLength(1);
    expect(rules[0].isValid).toBe(true);
    expect(rules[0].severity).toBe("moderate");
    expect(rules[0].remainingDays).toBe(45);

    const adv: Advisory = {
      source: "GHSA-hrr3-gc8f-f4qj",
      name: "fast-uri",
      severity: "moderate",
      title: "fast-uri host case normalization",
    };

    expect(matchAdvisoryRule(rules[0], adv, "fast-uri")).toBe(true);
  });
});
