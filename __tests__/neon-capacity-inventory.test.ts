// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getNeonCapacityInventory,
  runNeonCapacityInventoryVerification,
  PROTECTED_NEON_TARGETS,
  HISTORICAL_NEON_CANDIDATES,
  NEON_FREE_TIER_LIMIT_BYTES,
  NEON_FREE_TIER_LIMIT_GIB,
  type NeonCleanupCandidate,
} from "../scripts/neon-capacity-inventory";

describe("Neon Capacity & Branch Inventory", () => {
  const inventory = getNeonCapacityInventory();
  const root = path.resolve(__dirname, "..");
  const docPath = path.join(
    root,
    "docs",
    "reference",
    "neon-capacity-inventory.md"
  );

  it("captures policy storage meters and records observed provider usage under the Neon 0.5 GiB free tier limit", () => {
    expect(inventory.plan).toContain("Neon Free Tier");
    expect(inventory.scope).toContain("Neon Postgres");
    expect(inventory.providerInventoryAvailable).toBe(true);

    const meter = inventory.storageMeter;
    expect(meter.limitBytes).toBe(NEON_FREE_TIER_LIMIT_BYTES);
    expect(meter.limitGiB).toBe(NEON_FREE_TIER_LIMIT_GIB);
    expect(meter.providerStatus).toBe("observed");
    expect(inventory.summary.providerDataStatus).toBe("observed");

    // Observed usage must be real and within the limit. Zero was the sentinel
    // for "unobserved" and must not silently return.
    expect(meter.usedBytes).toBeGreaterThan(0);
    expect(meter.usedBytes).toBeLessThan(NEON_FREE_TIER_LIMIT_BYTES);
    expect(meter.headroomPercentage).toBeGreaterThan(0);
    expect(meter.headroomPercentage).toBeLessThanOrEqual(100);
  });

  it("enforces compute policies (0.25 CU, 5-minute auto-suspend)", () => {
    const compute = inventory.computePolicy;
    expect(compute.autoSuspendMinutes).toBe(5);
    expect(compute.autoSuspendSeconds).toBe(300);
    expect(compute.maxComputeUnits).toBe(0.25);
    expect(compute.readThroughShieldRequirement).toContain(
      "Upstash Read-Through Cache"
    );
  });

  it("enforces connection URL hygiene (pooled for runtime, direct for migrations)", () => {
    const hygiene = inventory.connectionHygiene;
    expect(hygiene.runtimePooledUrl.variable).toBe("DATABASE_URL");
    expect(hygiene.runtimePooledUrl.purpose).toContain(
      "Serverless route handlers"
    );

    expect(hygiene.migrationDirectUrl.variable).toBe("DATABASE_URL_UNPOOLED");
    expect(hygiene.migrationDirectUrl.purpose).toContain(
      "Guarded Vercel production-build migrations"
    );
  });

  it("strictly protects the production branch from deletion candidates", () => {
    const candidateProjectBranchPairs = inventory.candidates.map(
      (c) => `${c.projectId}/${c.branchName ?? ""}`
    );

    for (const protectedTarget of PROTECTED_NEON_TARGETS) {
      const protectedPair = `${protectedTarget.projectId}/${protectedTarget.branchName}`;
      expect(candidateProjectBranchPairs).not.toContain(protectedPair);
    }

    // Only `main` exists. A previous revision asserted a protected `dev`
    // branch; ADR 0037 replaced the persistent dev environment and no such
    // branch is present at the provider (verified 2026-09-19).
    expect(PROTECTED_NEON_TARGETS).toHaveLength(1);
    expect(PROTECTED_NEON_TARGETS[0].branchName).toBe("main");
    expect(PROTECTED_NEON_TARGETS.map((t) => t.branchName)).not.toContain(
      "dev"
    );
  });

  it("enforces zero approved candidates until an authorized provider snapshot is captured (Issue #621)", () => {
    expect(inventory.candidates).toHaveLength(0);
    expect(inventory.summary.candidateCount).toBe(0);
    expect(inventory.summary.expectedRecoverableStorageMiB).toBe(0);
    expect(inventory.summary.projectedPostCleanupHeadroomGiB).toBe(
      NEON_FREE_TIER_LIMIT_GIB
    );
  });

  it("verifies the non-destructive invariant across all candidates", () => {
    expect(inventory.summary.nonDestructiveInvariantVerified).toBe(true);

    for (const candidate of inventory.candidates) {
      expect(candidate.destructiveActionExecuted).toBe(false);
    }
  });

  it("executes verification check without errors", () => {
    const result = runNeonCapacityInventoryVerification({
      json: false,
      candidates: false,
      summary: true,
    });
    expect(result.success).toBe(true);
    expect(result.data.summary.nonDestructiveInvariantVerified).toBe(true);
  });

  it("detects safety violation if a protected branch is added to candidates", () => {
    const corruptedCandidates: NeonCleanupCandidate[] = [
      ...HISTORICAL_NEON_CANDIDATES,
      {
        targetId: "br-main-prod-corrupted",
        targetType: "branch",
        projectId: "portfolio",
        branchName: "main",
        environment: "preview",
        storageBytes: 100,
        storageMiB: 1,
        reason: "Test corruption",
        requiredApproval: "None",
        destructiveActionExecuted: false,
      },
    ];

    const candidatePairs = corruptedCandidates.map(
      (c) => `${c.projectId}/${c.branchName ?? ""}`
    );

    const hasViolation = PROTECTED_NEON_TARGETS.some((t) =>
      candidatePairs.includes(`${t.projectId}/${t.branchName}`)
    );

    expect(hasViolation).toBe(true);
  });

  it("synchronizes the reference documentation with current inventory snapshot", () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const docContent = fs.readFileSync(docPath, "utf-8");

    // Every protected target must be cited in the document, and nothing the
    // script does not know about may be presented there as protected.
    expect(docContent).toContain("neon-gray-drum");
    for (const target of PROTECTED_NEON_TARGETS) {
      expect(docContent).toContain(`\`${target.branchName}\``);
    }

    // Regression guard. This assertion previously read `toContain("\`dev\`")`,
    // which pinned a branch that does not exist and let a doc rewrite that
    // contradicted the script pass unnoticed. The document may still discuss
    // `dev` historically, but must not assert it as a protected branch.
    expect(docContent).not.toMatch(/\|\s*`dev`\s*\|[^\n]*\*\*Protected\*\*/);

    // Observed figures in the document must match the snapshot the script
    // reports, so the two cannot drift apart silently again.
    expect(docContent).toContain(
      String(inventory.projects[0].branches[0].branchId)
    );
    expect(docContent).toContain("6 hours");

    // Policy bounds & governance must be represented
    expect(docContent).toContain("0.500 GiB");
    expect(docContent).toContain("5 minutes");
    expect(docContent).toContain("DATABASE_URL");
    expect(docContent).toContain("DIRECT_URL");
    expect(docContent).toContain("ADR 0036");
    expect(docContent).toContain("Issue #621");

    // Must not contain fabricated provider IDs or fake claims
    expect(docContent).not.toContain("0.308 GiB");
    expect(docContent).not.toContain("ep-portfolio-main-prod");
    expect(docContent).not.toContain("ep-legacy-wedding-db");
    expect(docContent).not.toContain("br-preview-pr-687");
  });
});
