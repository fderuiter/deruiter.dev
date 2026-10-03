import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EXPIRY_WARNING_DAYS,
  findExpiringExceptions,
  runLicenseAudit,
  shippedCodeExceptions,
  type LicenseException,
} from "../scripts/license-audit";

const NOW = new Date("2026-10-03T12:00:00Z");

function exception(overrides: Partial<LicenseException>): LicenseException {
  return {
    packageName: "pkg",
    license: "LGPL-3.0-or-later",
    expiresAt: "2026-12-30",
    riskOwner: "owner@example.com",
    ticket: "SEC-1",
    rationale: "reviewed",
    ...overrides,
  };
}

const dirs: string[] = [];
function workspace(opts: {
  lock: Record<string, unknown>;
  exceptions?: LicenseException[];
  notices?: string;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "license-shipped-"));
  dirs.push(dir);
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    JSON.stringify({ packages: { "": {}, ...opts.lock } })
  );
  fs.writeFileSync(
    path.join(dir, "license-policy.json"),
    JSON.stringify({
      allowedLicenses: ["MIT", "ISC"],
      exceptions: opts.exceptions ?? [],
    })
  );
  if (opts.notices !== undefined) {
    fs.mkdirSync(path.join(dir, "public"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "public/third-party-notices.txt"),
      opts.notices
    );
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe("license audit: what ships", () => {
  it("drops wildcard and strong-copyleft waivers for shipped code", () => {
    const kept = shippedCodeExceptions([
      exception({ license: "*" }),
      exception({ license: "AGPL-3.0-only" }),
      exception({ license: "GPL-3.0-or-later" }),
      exception({ license: "LGPL-3.0-or-later" }),
    ]);
    expect(kept.map((e) => e.license)).toEqual(["LGPL-3.0-or-later"]);
  });

  it("fails a shipped GPL package even when an exception names it", () => {
    const dir = workspace({
      lock: {
        "node_modules/gpl-lib": { version: "1.0.0", license: "GPL-3.0-only" },
      },
      exceptions: [
        exception({ packageName: "gpl-lib", license: "GPL-3.0-only" }),
      ],
    });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.passed).toBe(false);
    expect(report.violations[0].reason).toContain("cannot be waived");
  });

  it("lets a dev-only GPL package pass with a valid exception", () => {
    const dir = workspace({
      lock: {
        "node_modules/gpl-tool": {
          version: "1.0.0",
          license: "GPL-3.0-only",
          dev: true,
        },
      },
      exceptions: [
        exception({ packageName: "gpl-tool", license: "GPL-3.0-only" }),
      ],
    });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.passed).toBe(true);
    expect(report.toolingPackages).toBe(1);
    expect(report.shippedPackages).toBe(0);
  });

  it("accepts a shipped dual license when a permissive option exists", () => {
    const dir = workspace({
      lock: {
        "node_modules/dual": {
          version: "1.0.0",
          license: "(MIT OR GPL-3.0-or-later)",
        },
      },
    });
    expect(runLicenseAudit({ workspaceRoot: dir, now: NOW }).passed).toBe(true);
  });

  it("keeps an LGPL exception working for shipped binaries", () => {
    const dir = workspace({
      lock: {
        "node_modules/lib-binary": {
          version: "1.0.0",
          license: "LGPL-3.0-or-later",
        },
      },
      exceptions: [exception({ packageName: "lib-binary" })],
    });
    expect(runLicenseAudit({ workspaceRoot: dir, now: NOW }).passed).toBe(true);
  });
});

describe("license audit: notices", () => {
  const lock = {
    "node_modules/a": { version: "1.0.0", license: "MIT" },
    "node_modules/b": { version: "2.0.0", license: "ISC" },
    "node_modules/dev-only": { version: "1.0.0", license: "MIT", dev: true },
  };

  it("passes when every shipped package is listed", () => {
    const dir = workspace({ lock, notices: "a@1.0.0 (MIT)\nb@2.0.0 (ISC)\n" });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.noticesMissing).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("fails and names a shipped package missing from the notices", () => {
    const dir = workspace({ lock, notices: "a@1.0.0 (MIT)\n" });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.noticesMissing).toEqual(["b@2.0.0"]);
    expect(report.passed).toBe(false);
  });

  it("does not require dev-only packages in the notices", () => {
    const dir = workspace({ lock, notices: "a@1.0.0\nb@2.0.0\n" });
    expect(
      runLicenseAudit({ workspaceRoot: dir, now: NOW }).noticesMissing
    ).toEqual([]);
  });

  it("fails when notices are required and the file is absent", () => {
    const dir = workspace({ lock });
    const report = runLicenseAudit({
      workspaceRoot: dir,
      now: NOW,
      requireNotices: true,
    });
    expect(report.passed).toBe(false);
    expect(report.noticesMissing).toEqual(["a@1.0.0", "b@2.0.0"]);
  });
});

describe("license audit: exception expiry warnings", () => {
  it(`warns within ${EXPIRY_WARNING_DAYS} days, nearest first`, () => {
    const warnings = findExpiringExceptions(
      [
        exception({ packageName: "late", expiresAt: "2026-12-30" }),
        exception({ packageName: "soon", expiresAt: "2026-10-20" }),
        exception({ packageName: "sooner", expiresAt: "2026-10-10" }),
      ],
      NOW
    );
    expect(warnings.map((w) => w.packageName)).toEqual(["sooner", "soon"]);
    expect(warnings[0].daysLeft).toBe(7);
  });

  it("reports the warning in the audit without failing it", () => {
    const dir = workspace({
      lock: {
        "node_modules/x": { version: "1.0.0", license: "LGPL-3.0-or-later" },
      },
      exceptions: [exception({ packageName: "x", expiresAt: "2026-10-20" })],
    });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.passed).toBe(true);
    expect(report.expiringSoon).toHaveLength(1);
  });
});
