#!/usr/bin/env tsx
/**
 * Re-audits the npm overrides in package.json (#3671).
 *
 * For each pin, a scratch copy of package.json and package-lock.json drops
 * that pin, regenerates the lockfile with `npm install --package-lock-only`
 * and runs `npm audit --package-lock-only`. The result is compared with the
 * committed tree per installed copy, not per package: an advisory already
 * waived for one copy of a package says nothing about a second copy the
 * removal would add.
 *
 * - `needed`: removing it adds a vulnerable copy. Keep it.
 * - `no-effect`: removing it adds no vulnerable copy and installs the pinned
 *   package at the same places and versions. It does nothing, so drop it.
 * - `no-new-advisory`: removing it adds no vulnerable copy but installs other
 *   versions. Drop it, unless it is `documented`.
 * - `documented`: as `no-new-advisory`, but its SECURITY.md row says removing
 *   it adds "no new advisories" and gives the reason it stays (the jsdom pin
 *   is one). SECURITY.md is the one place that reason lives.
 *
 * It reads the registry and writes only into temporary folders, never the
 * checkout. It reports and does not fail: `.github/workflows/overrides-audit.yml`
 * runs it monthly and opens an issue when a pin can go.
 *
 * Usage: tsx scripts/overrides-audit.ts [--summary <file>] [--json <file>]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Overrides = Record<string, string | Record<string, string>>;

/** One pin: a global one names the package, a scoped one its parent too. */
export interface OverridePin {
  /** `qs`, or `parent > child` for a scoped pin, as SECURITY.md names it. */
  readonly label: string;
  /** The parent of a scoped pin. */
  readonly parent?: string;
  /** The package the pin sets. */
  readonly name: string;
  /** The range or alias it sets. */
  readonly range: string;
}

/** What the audit found for one pin. */
export interface PinResult {
  readonly pin: OverridePin;
  readonly status:
    "needed" | "no-effect" | "no-new-advisory" | "documented" | "error";
  /** Vulnerable copies the removal adds, as `GHSA-id severity at path`. */
  readonly addedAdvisories: readonly string[];
  /** Distinct versions of the pinned package with and without the pin. */
  readonly versionsWith: readonly string[];
  readonly versionsWithout: readonly string[];
  /** Why the scratch install failed, for `error`. */
  readonly error?: string;
}

/** Every pin in an overrides block, in its order. */
export function listPins(overrides: Overrides): OverridePin[] {
  return Object.entries(overrides).flatMap(([key, value]) =>
    typeof value === "string"
      ? [{ label: key, name: key, range: value }]
      : Object.entries(value).map(([child, range]) => ({
          label: `${key} > ${child}`,
          parent: key,
          name: child,
          range,
        }))
  );
}

/** The overrides block with one pin removed, and an emptied parent dropped. */
export function withoutPin(overrides: Overrides, pin: OverridePin): Overrides {
  const next: Overrides = structuredClone(overrides);
  if (pin.parent === undefined) {
    delete next[pin.name];
    return next;
  }
  const scoped = { ...(next[pin.parent] as Record<string, string>) };
  delete scoped[pin.name];
  if (Object.keys(scoped).length === 0) delete next[pin.parent];
  else next[pin.parent] = scoped;
  return next;
}

interface LockShape {
  readonly packages?: Record<string, { readonly version?: string }>;
}

/** Every installed copy of a package in a lockfile, as `path@version`, sorted. */
export function placements(lock: LockShape, name: string): string[] {
  return Object.entries(lock.packages ?? {})
    .filter(
      ([key, entry]) =>
        key.split("node_modules/").at(-1) === name && Boolean(entry.version)
    )
    .map(([key, entry]) => `${key}@${entry.version}`)
    .sort();
}

/** The distinct versions among placements, sorted, for the report. */
export function versionsOf(placed: readonly string[]): string[] {
  return [
    ...new Set(placed.map((item) => item.slice(item.lastIndexOf("@") + 1))),
  ].sort();
}

interface AuditVia {
  readonly name?: string;
  readonly url?: string;
  readonly severity?: string;
}

interface AuditShape {
  readonly vulnerabilities?: Record<
    string,
    {
      readonly via?: readonly (string | AuditVia)[];
      readonly nodes?: readonly string[];
    }
  >;
}

/**
 * Every vulnerable copy an `npm audit --json` report names, as
 * `GHSA-id severity at path`. Only a package's own advisories count; one it
 * reaches through a dependency belongs to that dependency's copies.
 */
export function advisories(audit: AuditShape): string[] {
  const found = new Set<string>();
  for (const [name, entry] of Object.entries(audit.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
      if (typeof via !== "object" || via.name !== name) continue;
      const id = via.url?.split("/").pop() ?? "unknown";
      for (const node of entry.nodes ?? [`node_modules/${name}`]) {
        found.add(`${id} ${via.severity ?? "?"} at ${node}`);
      }
    }
  }
  return [...found].sort();
}

/**
 * The pins SECURITY.md keeps for a reason that is not a vulnerability: rows
 * of its "npm Package Overrides" table whose "Effect of removing it" begins
 * "no new advisories".
 */
export function documentedPins(security: string): Set<string> {
  const section = security.split("## npm Package Overrides")[1] ?? "";
  const pins = new Set<string>();
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const label = /^`(.+)`$/.exec(cells[1] ?? "")?.[1];
    if (label && /^no new advisories/i.test(cells[5] ?? "")) pins.add(label);
  }
  return pins;
}

/** Sorts a pin by what its removal changes. */
export function classifyPin(
  baseline: readonly string[],
  without: readonly string[],
  placedWith: readonly string[],
  placedWithout: readonly string[]
): Exclude<PinResult["status"], "error" | "documented"> {
  const known = new Set(baseline);
  if (without.some((advisory) => !known.has(advisory))) return "needed";
  const same =
    placedWith.length === placedWithout.length &&
    placedWith.every((item, index) => item === placedWithout[index]);
  return same ? "no-effect" : "no-new-advisory";
}

const STATUS_TEXT: Record<PinResult["status"], string> = {
  needed: "needed",
  "no-effect": "**drop: no effect**",
  "no-new-advisory": "**review: no new advisory**",
  documented: "kept: reason in SECURITY.md",
  error: "**error**",
};

/** Pins the audit says could go. */
export function removable(results: readonly PinResult[]): PinResult[] {
  return results.filter(
    (result) =>
      result.status === "no-effect" || result.status === "no-new-advisory"
  );
}

/** The Markdown report: one row per pin, and what to do. */
export function renderSummary(results: readonly PinResult[]): string {
  const rows = results.map((result) => {
    const cells = [
      `\`${result.pin.label}\``,
      `\`${result.pin.range}\``,
      STATUS_TEXT[result.status],
      result.status === "error"
        ? (result.error ?? "")
        : result.versionsWithout.join(", ") || "not in the tree",
      result.addedAdvisories.join("; ") || "none",
    ].map((cell) => cell.replaceAll("|", "\\|"));
    return `| ${cells.join(" | ")} |`;
  });
  return [
    "# npm overrides re-audit",
    "",
    `${results.length} pins checked; ${removable(results).length} could go. A pin is dropped only when removing it adds no vulnerable copy and SECURITY.md states no other reason to keep it.`,
    "",
    "| Override | Pinned to | Result | Versions without the pin | Vulnerable copies its removal adds |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function npm(cwd: string, args: readonly string[]): string {
  try {
    return execFileSync("npm", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // npm audit exits non-zero when it finds anything; its report is stdout.
    const stdout = (error as { stdout?: string }).stdout;
    if (args[0] === "audit" && stdout) return stdout;
    throw error;
  }
}

function scratchCopy(root: string, overrides: Overrides): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overrides-audit-"));
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ ...pkg, overrides }, null, 2)}\n`
  );
  for (const file of ["package-lock.json", ".npmrc"]) {
    const source = path.join(root, file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(dir, file));
  }
  return dir;
}

function auditIn(dir: string): string[] {
  return advisories(
    JSON.parse(npm(dir, ["audit", "--package-lock-only", "--json"]))
  );
}

/** Runs the re-audit against the checkout at `root`. */
export function auditOverrides(root: string): PinResult[] {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const overrides: Overrides = pkg.overrides ?? {};
  const committedLock: LockShape = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8")
  );
  const baseDir = scratchCopy(root, overrides);
  let baseline: string[];
  try {
    baseline = auditIn(baseDir);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
  const known = new Set(baseline);
  const securityFile = path.join(root, "SECURITY.md");
  const documented = documentedPins(
    fs.existsSync(securityFile) ? fs.readFileSync(securityFile, "utf8") : ""
  );
  return listPins(overrides).map((pin): PinResult => {
    const placedWith = placements(committedLock, pin.name);
    const dir = scratchCopy(root, withoutPin(overrides, pin));
    try {
      npm(dir, [
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
      ]);
      const without = auditIn(dir);
      const placedWithout = placements(
        JSON.parse(
          fs.readFileSync(path.join(dir, "package-lock.json"), "utf8")
        ),
        pin.name
      );
      const status = classifyPin(baseline, without, placedWith, placedWithout);
      return {
        pin,
        status:
          status === "no-new-advisory" && documented.has(pin.label)
            ? "documented"
            : status,
        addedAdvisories: without.filter((advisory) => !known.has(advisory)),
        versionsWith: versionsOf(placedWith),
        versionsWithout: versionsOf(placedWithout),
      };
    } catch (error) {
      const detail = String(
        (error as { stderr?: string }).stderr || (error as Error).message
      );
      return {
        pin,
        status: "error",
        addedAdvisories: [],
        versionsWith: versionsOf(placedWith),
        versionsWithout: [],
        error: detail.split("\n").filter(Boolean).at(-1),
      };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function main(argv: readonly string[]): number {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const option = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const results = auditOverrides(root);
  const summary = renderSummary(results);
  const summaryFile = option("--summary");
  const jsonFile = option("--json");
  if (summaryFile) fs.writeFileSync(summaryFile, summary);
  if (jsonFile) {
    fs.writeFileSync(jsonFile, `${JSON.stringify(results, null, 2)}\n`);
  }
  console.log(summary);
  return 0;
}

if (
  typeof process.env.VITEST === "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv.slice(2));
}
