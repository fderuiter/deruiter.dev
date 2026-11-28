// @vitest-environment node
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
import {
  computeShippedLockPaths,
  renderThirdPartyNotices,
  type LockfileShape,
} from "../lib/oss-credits";

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
  lock: Record<string, Record<string, unknown>>;
  root?: Record<string, unknown>;
  exceptions?: LicenseException[];
  notices?: string;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "license-shipped-"));
  dirs.push(dir);
  const inferredDeps = Object.fromEntries(
    Object.entries(opts.lock)
      .filter(
        ([lockPath, entry]) =>
          lockPath.startsWith("node_modules/") &&
          !lockPath.slice("node_modules/".length).includes("node_modules/") &&
          !entry.dev &&
          !entry.devOptional
      )
      .map(([lockPath, entry]) => [
        lockPath.slice("node_modules/".length),
        String(entry.version ?? "*"),
      ])
  );
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    JSON.stringify({
      packages: {
        "": opts.root ?? { dependencies: inferredDeps },
        ...opts.lock,
      },
    })
  );
  fs.mkdirSync(path.join(dir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "config", "license-policy.json"),
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

  it("treats unreachable devOptional entries as tooling while keeping sharp and detect-libc in runtime", () => {
    const dir = workspace({
      root: {
        dependencies: { sharp: "^0.35.5" },
        devDependencies: { prisma: "^7.10.1", typescript: "^6.0.2" },
      },
      lock: {
        "node_modules/sharp": {
          version: "0.35.5",
          license: "Apache-2.0",
          dependencies: { "detect-libc": "^2.1.2" },
          peerDependencies: { typescript: ">=5.0.0" },
          peerDependenciesMeta: { typescript: { optional: true } },
        },
        "node_modules/detect-libc": {
          version: "2.1.2",
          license: "Apache-2.0",
        },
        "node_modules/prisma": {
          version: "7.10.1",
          license: "GPL-3.0-only",
          devOptional: true,
        },
        "node_modules/typescript": {
          version: "6.0.3",
          license: "GPL-3.0-only",
          devOptional: true,
        },
      },
      exceptions: [
        exception({ packageName: "prisma", license: "GPL-3.0-only" }),
        exception({ packageName: "typescript", license: "GPL-3.0-only" }),
      ],
    });
    // Allowed licenses in workspace() are MIT/ISC, so add Apache-2.0 for sharp/detect-libc.
    fs.writeFileSync(
      path.join(dir, "config", "license-policy.json"),
      JSON.stringify({
        allowedLicenses: ["MIT", "ISC", "Apache-2.0"],
        exceptions: [
          exception({ packageName: "prisma", license: "GPL-3.0-only" }),
          exception({ packageName: "typescript", license: "GPL-3.0-only" }),
        ],
      })
    );
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.passed).toBe(true);
    expect(report.shippedPackages).toBe(2);
    expect(report.toolingPackages).toBe(2);

    const repoLock = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "package-lock.json"),
        "utf8"
      )
    ) as LockfileShape;
    const shippedPaths = computeShippedLockPaths(repoLock);
    expect(shippedPaths.has("node_modules/sharp")).toBe(true);
    expect(shippedPaths.has("node_modules/detect-libc")).toBe(true);
    for (const devOpt of [
      "node_modules/prisma",
      "node_modules/@playwright/test",
      "node_modules/typescript",
      "node_modules/effect",
    ]) {
      expect(shippedPaths.has(devOpt), devOpt).toBe(false);
    }
  });
});

describe("license audit: notices", () => {
  const lock = {
    "node_modules/a": { version: "1.0.0", license: "MIT" },
    "node_modules/b": { version: "2.0.0", license: "ISC" },
    "node_modules/dev-only": { version: "1.0.0", license: "MIT", dev: true },
  };
  const LICENSE_BODY =
    "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction.";
  const notices = (...entries: [string, string][]) =>
    renderThirdPartyNotices(
      entries.map(([name, version]) => ({
        name,
        version,
        license: "MIT",
        licenseText: `Copyright (c) Someone\n\n${LICENSE_BODY}`,
      }))
    );

  it("passes when every shipped package sits under a license text", () => {
    const dir = workspace({
      lock,
      notices: notices(["a", "1.0.0"], ["b", "2.0.0"]),
    });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.noticesMissing).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("fails and names a shipped package missing from the notices", () => {
    const dir = workspace({ lock, notices: notices(["a", "1.0.0"]) });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.noticesMissing).toEqual(["b@2.0.0"]);
    expect(report.passed).toBe(false);
  });

  it("fails a package that is only listed by SPDX identifier", () => {
    // The shape the first generator produced: named, linked, no license text.
    const identifierOnly = [
      notices(["a", "1.0.0"]),
      "PACKAGES THAT DISTRIBUTE NO LICENSE FILE",
      "",
      "b@2.0.0 (ISC)",
      "",
    ].join("\n");
    const dir = workspace({ lock, notices: identifierOnly });
    const report = runLicenseAudit({ workspaceRoot: dir, now: NOW });
    expect(report.noticesMissing).toEqual(["b@2.0.0"]);
    expect(report.passed).toBe(false);
  });

  it("fails a package whose entry has a heading but no text", () => {
    const hollow = [
      notices(["a", "1.0.0"]),
      "=".repeat(78),
      "LICENSE TEXT 2 of 2, applies to 1 package(s):",
      "",
      "- b@2.0.0 (ISC)",
      "",
      "ISC",
      "",
    ].join("\n");
    const dir = workspace({ lock, notices: hollow });
    expect(
      runLicenseAudit({ workspaceRoot: dir, now: NOW }).noticesMissing
    ).toEqual(["b@2.0.0"]);
  });

  it("does not require dev-only packages in the notices", () => {
    const dir = workspace({
      lock,
      notices: notices(["a", "1.0.0"], ["b", "2.0.0"]),
    });
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
