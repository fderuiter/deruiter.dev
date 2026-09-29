import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  SECRET_DETECTORS,
  SECRET_DETECTOR_FIXTURES,
  formatFinding,
  getDetectorsForSurface,
  isAllowlistedSecretValue,
  scanFile,
  scanHistorySnapshot,
  scanText,
  type SecretDetectorId,
} from "@/lib/security-scan";
import { checkSecretLeaks } from "@/lib/dx/doctor";

const detectorIds = SECRET_DETECTORS.map((d) => d.id);
const contentGuardDetectors = getDetectorsForSurface("contentGuard");
const historyAuditDetectors = getDetectorsForSurface("historyAudit");

// vitest's it.each/describe.each widen array-derived callback params to
// `string`; these helpers re-narrow at the lookup site instead of casting
// at every call, since the lookups themselves prove the id is valid.
function detector(id: string) {
  const found = SECRET_DETECTORS.find((d) => d.id === id);
  if (!found) throw new Error(`no detector registered for ${id}`);
  return found;
}

function fixturesFor(id: string) {
  return SECRET_DETECTOR_FIXTURES[id as SecretDetectorId];
}

describe("the catalog itself", () => {
  it("has a unique id for every detector", () => {
    expect(new Set(detectorIds).size).toBe(detectorIds.length);
  });

  it("gives every detector a description, gitPattern, and at least one surface", () => {
    for (const d of SECRET_DETECTORS) {
      expect(d.description.length).toBeGreaterThan(5);
      expect(d.gitPattern.length).toBeGreaterThan(0);
      expect(d.appliesTo.length).toBeGreaterThan(0);
    }
  });

  it("has a fixture set for every detector, and no fixtures for unknown detectors", () => {
    expect(Object.keys(SECRET_DETECTOR_FIXTURES).sort()).toEqual(
      [...detectorIds].sort()
    );
  });

  it("gives every detector at least one positive and one negative fixture", () => {
    for (const id of detectorIds) {
      const fixtures = fixturesFor(id);
      expect(fixtures.positive.length).toBeGreaterThan(0);
      expect(fixtures.negative.length).toBeGreaterThan(0);
    }
  });
});

describe("every detector's own regex agrees with its positive fixtures", () => {
  it.each(detectorIds)("%s: regex matches every positive fixture", (id) => {
    const { regex } = detector(id);
    for (const value of fixturesFor(id).positive) {
      regex.lastIndex = 0;
      expect(regex.test(value)).toBe(true);
    }
  });
});

// Negative fixtures are verified at the scanText/scanHistorySnapshot level
// below, not against the raw regex: some are safe only because of
// allowlisting (e.g. a credentialed localhost URL), not because the regex
// fails to match them.

describe("contentGuard surface: scanText/scanFile (DX Doctor + pre-commit guard)", () => {
  it.each(contentGuardDetectors.map((d) => d.id))(
    "%s: scanText reports it for every positive fixture from an arbitrary file",
    (id) => {
      for (const value of fixturesFor(id).positive) {
        const findings = scanText(value, "some/random/file.ts");
        expect(findings.some((f) => f.detectorId === id)).toBe(true);
      }
    }
  );

  it.each(contentGuardDetectors.map((d) => d.id))(
    "%s: scanText never reports it for that detector's negative fixtures",
    (id) => {
      for (const value of fixturesFor(id).negative) {
        const findings = scanText(value, "some/random/file.ts");
        expect(findings.every((f) => f.detectorId !== id)).toBe(true);
      }
    }
  );

  it("every contentGuard detector is reachable through scanFile too", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "security-scan-file-"));
    try {
      for (const d of contentGuardDetectors) {
        const file = path.join(dir, "leak.txt");
        fs.writeFileSync(file, fixturesFor(d.id).positive[0] + "\n");
        const findings = scanFile(file, "leak.txt");
        expect(findings.some((f) => f.detectorId === d.id)).toBe(true);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("historyAudit surface: scanHistorySnapshot (reachable-history audit)", () => {
  it.each(historyAuditDetectors.map((d) => d.id))(
    "%s: scanHistorySnapshot reports it for every positive fixture",
    (id) => {
      for (const value of fixturesFor(id).positive) {
        const findings = scanHistorySnapshot(value, {
          commit: "0".repeat(40),
          file: "some/random/file.ts",
        });
        expect(findings.some((f) => f.detectorId === id)).toBe(true);
      }
    }
  );

  it.each(historyAuditDetectors.map((d) => d.id))(
    "%s: scanHistorySnapshot never reports it for that detector's negative fixtures",
    (id) => {
      for (const value of fixturesFor(id).negative) {
        const findings = scanHistorySnapshot(value, {
          commit: "0".repeat(40),
          file: "some/random/file.ts",
        });
        expect(findings.every((f) => f.detectorId !== id)).toBe(true);
      }
    }
  );
});

describe("historyAudit surface: gitPattern is a real, working git-log -G pickaxe pattern", () => {
  let repoDir: string;

  function git(args: string[]): string {
    return execFileSync("git", args, { cwd: repoDir, encoding: "utf8" });
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-scan-pickaxe-"));
    git(["init", "-q"]);
    git(["config", "user.email", "fixture-bot@example.com"]);
    git(["config", "user.name", "Fixture Bot"]);

    for (const d of historyAuditDetectors) {
      const fileName = `${d.id}.txt`;
      fs.writeFileSync(
        path.join(repoDir, fileName),
        fixturesFor(d.id).positive.join("\n") + "\n"
      );
      git(["add", fileName]);
      git(["commit", "-q", "-m", `add ${d.id} fixture`]);
    }
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it.each(historyAuditDetectors.map((d) => d.id))(
    "%s: git log -G<gitPattern> finds the commit that introduced its fixture",
    (id) => {
      const output = git([
        "log",
        "--all",
        `-G${detector(id).gitPattern}`,
        "--format=%s",
        "--",
        `${id}.txt`,
      ]);
      expect(output).toContain(`add ${id} fixture`);
    }
  );
});

describe("DX Doctor's checkSecretLeaks consumes the same catalog", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-scan-doctor-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(contentGuardDetectors.map((d) => d.id))(
    "%s: a repository file containing its positive fixture fails the doctor check",
    (id) => {
      fs.writeFileSync(
        path.join(tempDir, "leaked.ts"),
        `const value = "leak"; // ${fixturesFor(id).positive[0]}\n`
      );
      const result = checkSecretLeaks(tempDir);
      expect(result.status).toBe("fail");
    }
  );

  it("passes cleanly on a repository with no secret-shaped content", () => {
    fs.writeFileSync(
      path.join(tempDir, "clean.ts"),
      'export const greeting = "hello world";\n'
    );
    const result = checkSecretLeaks(tempDir);
    expect(result.status).toBe("pass");
  });
});

describe("redaction: formatFinding never carries a candidate value", () => {
  it.each(detectorIds)(
    "%s: the formatted line never contains the positive fixture text",
    (id) => {
      const d = detector(id);
      for (const value of fixturesFor(id).positive) {
        const output = formatFinding({
          detectorId: id,
          category: d.description,
          file: "some/file.ts",
          line: 1,
        });
        expect(output).not.toContain(value);
      }
    }
  );

  it("formats a history finding with a truncated commit and no value", () => {
    const output = formatFinding({
      detectorId: "github-token",
      category: "GitHub token",
      file: "src/config.ts",
      line: 12,
      commit: "abcdef0123456789abcdef0123456789abcdef01",
    });
    expect(output).toBe(
      "  - src/config.ts:12 at abcdef012345 [GitHub token] (value redacted)"
    );
  });
});

describe("isAllowlistedSecretValue: allowlisting rules", () => {
  it("allows localhost and 127.0.0.1 hosts", () => {
    expect(isAllowlistedSecretValue("postgresql://u:p@localhost:5432/db")).toBe(
      true
    );
    expect(isAllowlistedSecretValue("postgresql://u:p@127.0.0.1:5432/db")).toBe(
      true
    );
  });

  it("allows *.example.com hosts but not other remote hosts", () => {
    expect(isAllowlistedSecretValue("postgresql://u:p@db.example.com/db")).toBe(
      true
    );
    const remoteHostValue = [
      "postgresql",
      "://u:p@db.prod.acme.internal/db",
    ].join("");
    expect(isAllowlistedSecretValue(remoteHostValue)).toBe(false);
  });

  it("allows well-known global safe literals", () => {
    expect(isAllowlistedSecretValue("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(isAllowlistedSecretValue("sk_test_example_secret_key")).toBe(true);
    expect(isAllowlistedSecretValue("example_dev_token")).toBe(true);
  });

  it("scopes migration-replay fixtures to their known files only", () => {
    const value = [
      "postgresql",
      "://admin:secret@ep-live.neon.tech/portfolio",
    ].join("");
    expect(
      isAllowlistedSecretValue(value, "__tests__/migration-replay.test.ts")
    ).toBe(true);
    expect(isAllowlistedSecretValue(value, "app/random-file.ts")).toBe(false);
  });
});

describe("documentation and generated-file false-positive avoidance", () => {
  it("accepts historical hook fixtures only in their two source files", () => {
    const password = ["npg_", "SecretPass1234"].join("");
    const url = [
      "postgresql",
      "://user:",
      password,
      "@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb",
    ].join("");
    const historicalFiles = [
      "__tests__/husky-hook-wiring.test.ts",
      "lib/security-scan/internal/allowlist.ts",
    ];
    for (const file of historicalFiles) {
      expect(scanHistorySnapshot(url, { commit: "fixture", file })).toEqual([]);
      expect(
        scanHistorySnapshot(password, { commit: "fixture", file })
      ).toEqual([]);
      expect(scanText(password.replace("1234", "5678"), file)).not.toEqual([]);
    }
    for (const file of [
      "app/config.ts",
      "__tests__/migration-replay.test.ts",
    ]) {
      expect(scanHistorySnapshot(url, { commit: "fixture", file })).not.toEqual(
        []
      );
      expect(scanText(password, file)).not.toEqual([]);
    }
  });

  it("does not flag the local-dev .env.example connection string", () => {
    const line =
      'DATABASE_URL="postgresql://local_user:local_secret@localhost:5432/portfolio_dev?sslmode=disable"';
    expect(scanText(line, ".env.example")).toEqual([]);
  });

  it("does not flag Clerk's public test publishable key", () => {
    const line =
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
    expect(scanText(line, "docs/how-to/configure-integrations.md")).toEqual([]);
  });

  it("does not flag the AWS-published example access key in a doc", () => {
    const line = "Example: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
    expect(scanText(line, "README.md")).toEqual([]);
  });

  it("does not flag the Neon migration-replay fixture inside its own test, but still flags a copy elsewhere", () => {
    const line = [
      "postgres",
      "://admin:p%40ss%3Aword!@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require",
    ].join("");
    expect(scanText(line, "__tests__/migration-replay.test.ts")).toEqual([]);
    expect(scanText(line, "docs/leak.md")).not.toEqual([]);
  });

  it("flags a bare Neon role password, including a new one in the file that once held a rotated value", () => {
    // Joined so this file never holds a contiguous npg_ literal itself.
    const line = `expect(generated).not.toContain("${["npg_", "AbCdEfGh5678"].join("")}");`;
    for (const file of ["docs/leak.md", "__tests__/dx-tooling.test.ts"]) {
      expect(scanText(line, file).map((f) => f.detectorId)).toEqual([
        "neon-role-password",
      ]);
    }
  });

  it("does not flag TypeDoc-generated markdown that only names env vars, never values", () => {
    const generated =
      "`CLERK_SECRET_KEY`: `ZodOptional`\\<`ZodString`\\>; `UPSTASH_REDIS_REST_TOKEN`: `ZodOptional`\\<`ZodString`\\>";
    expect(
      scanText(
        generated,
        "docs/reference/api/lib/env/variables/serverEnvSchema.md"
      )
    ).toEqual([]);
  });

  it("the fixtures module itself is inert when scanned for real (self-referential allowlisting)", () => {
    const findings = scanFile(
      path.join(process.cwd(), "lib/security-scan/internal/fixtures.ts"),
      "lib/security-scan/internal/fixtures.ts"
    );
    expect(findings).toEqual([]);
  });
});
