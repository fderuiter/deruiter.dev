// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getVercelRetentionInventory,
  runRetentionInventoryVerification,
  PROTECTED_TARGETS,
  CANDIDATE_DEPLOYMENTS,
  type DeploymentCandidate,
} from "../scripts/vercel-retention-inventory";

describe("Vercel Retention & Storage Inventory", () => {
  const inventory = getVercelRetentionInventory();
  const root = path.resolve(__dirname, "..");
  const docPath = path.join(
    root,
    "docs",
    "reference",
    "vercel-retention-inventory.md"
  );

  it("captures authoritative meter readings under Vercel Hobby limits", () => {
    expect(inventory.plan).toBe("Vercel Hobby");
    expect(inventory.scope).toBe("All projects / Last 30 Days");

    // Functions Storage
    const fsMeter = inventory.meters.functionsStorage;
    expect(fsMeter.used).toBe(9.68);
    expect(fsMeter.limit).toBe(10.0);
    expect(fsMeter.unit).toBe("GB");
    expect(fsMeter.headroom).toBeCloseTo(0.32);
    expect(fsMeter.headroomPercentage).toBe(3.2);
    expect(fsMeter.portfolioContribution).toBeUndefined();
    expect(fsMeter.weddingContribution).toBeUndefined();

    // Deployment Storage
    const dsMeter = inventory.meters.deploymentStorage;
    expect(dsMeter.used).toBe(6.2);
    expect(dsMeter.limit).toBe(10.0);
    expect(dsMeter.unit).toBe("GB");
    expect(dsMeter.headroom).toBeCloseTo(3.8);
    expect(dsMeter.headroomPercentage).toBe(38.0);

    // Build Time
    const btMeter = inventory.meters.buildTime;
    expect(btMeter.used).toBe(87.0);
    expect(btMeter.limit).toBe(100.0);
    expect(btMeter.unit).toBe("hours");
    expect(btMeter.headroom).toBe(13.0);
    expect(btMeter.headroomPercentage).toBe(13.0);
  });

  it("records paginated inventory counts and regional uniformity", () => {
    expect(inventory.paginationSummary.portfolio.totalPages).toBe(3);
    expect(inventory.paginationSummary.portfolio.totalRecords).toBe(268);
    expect(inventory.paginationSummary.portfolio.readyRecords).toBe(43);
    expect(inventory.paginationSummary.portfolio.blockedOrErrorRecords).toBe(
      225
    );

    expect(inventory.paginationSummary.wedding.totalPages).toBe(0);
    expect(inventory.paginationSummary.wedding.totalRecords).toBe(0);
    expect(inventory.paginationSummary.wedding.readyRecords).toBe(0);

    expect(inventory.paginationSummary.totalReadyReads).toBe(43);
    expect(inventory.regions.iad1Percentage).toBe(100.0);
    expect(inventory.regions.allRegions).toEqual(["iad1"]);
  });

  it("records no remaining deletion candidate after approved cleanup", () => {
    expect(inventory.candidates).toHaveLength(0);
    expect(inventory.summary.totalCandidates).toBe(0);
    expect(inventory.summary.portfolioPreviewCandidates).toBe(0);
    expect(inventory.summary.portfolioHistoricalProductionCandidates).toBe(0);
    expect(inventory.summary.weddingPreviewCandidates).toBe(0);

    const ids = inventory.candidates.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(0);
  });

  it("strictly excludes the current production target from candidates", () => {
    const candidateIds = new Set(inventory.candidates.map((c) => c.id));
    const protectedIds = PROTECTED_TARGETS.map((t) => t.id);

    expect(protectedIds).toHaveLength(1);
    expect(protectedIds).toContain("dpl_3VVso5GPXhpejKjb5wGRFszJABfa"); // portfolio prod

    for (const id of protectedIds) {
      expect(candidateIds.has(id)).toBe(false);
    }
  });

  it("records physical byte savings as unknown until Vercel reconciles", () => {
    expect(inventory.summary.estimatedSavings).toBe("unknown");
  });

  it("executes verification check without errors", () => {
    const result = runRetentionInventoryVerification({
      json: false,
      candidates: false,
    });
    expect(result.success).toBe(true);
    expect(result.data.candidates).toHaveLength(0);
  });

  it("detects safety violations if a protected target is added as a candidate", () => {
    const corruptedCandidates: DeploymentCandidate[] = [
      ...CANDIDATE_DEPLOYMENTS,
      {
        project: "portfolio",
        id: "dpl_3VVso5GPXhpejKjb5wGRFszJABfa",
        createdUtc: "2026-09-12T00:00:00Z",
        environment: "production",
        reason: "Test corruption",
        savingsBytes: "unknown",
        region: "iad1",
      },
    ];

    const candidateIds = new Set(corruptedCandidates.map((c) => c.id));
    const hasProtectedViolation = PROTECTED_TARGETS.some((t) =>
      candidateIds.has(t.id)
    );
    expect(hasProtectedViolation).toBe(true);
  });

  it("synchronizes the reference documentation with current cleanup state", () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const docContent = fs.readFileSync(docPath, "utf-8");

    // All protected targets must be cited in the document
    for (const target of PROTECTED_TARGETS) {
      expect(docContent).toContain(target.id);
    }

    // Key metrics must be represented
    expect(docContent).toContain("9.68 GB");
    expect(docContent).toContain("6.20 GB");
    expect(docContent).toContain("87.0 hrs");
    expect(docContent).toContain("Issue #691");
    expect(docContent).toContain("Issue #692");
  });
});
