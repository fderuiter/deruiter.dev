// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateSbom } from "../scripts/generate-sbom";

describe("CycloneDX SBOM Generation & Provenance Catalog Invariant", () => {
  const workspaceRoot = process.cwd();
  const sbomPath = path.join(workspaceRoot, "public", "sbom.json");

  it("generates a valid CycloneDX v1.5 JSON manifest within performance budget", async () => {
    const startTime = Date.now();
    await generateSbom({ rootDir: workspaceRoot, outputFile: sbomPath });
    const duration = Date.now() - startTime;

    expect(fs.existsSync(sbomPath)).toBe(true);
    expect(duration).toBeLessThan(5000);

    const sbomContent = fs.readFileSync(sbomPath, "utf-8");
    const sbom = JSON.parse(sbomContent);

    expect(sbom.bomFormat).toBe("CycloneDX");
    expect(sbom.specVersion).toBe("1.5");
    expect(Array.isArray(sbom.components)).toBe(true);
    expect(sbom.components.length).toBeGreaterThan(0);
  });

  it("catalogs standalone engine bundle artifacts in sbom.components", async () => {
    await generateSbom({ rootDir: workspaceRoot, outputFile: sbomPath });
    const sbomContent = fs.readFileSync(sbomPath, "utf-8");
    const sbom = JSON.parse(sbomContent);

    const garminComponent = sbom.components.find(
      (c: { name: string }) => c.name === "garmin-engine"
    );
    const monkeyComponent = sbom.components.find(
      (c: { name: string }) => c.name === "monkey-c-mayhem"
    );

    expect(garminComponent).toBeDefined();
    expect(garminComponent?.type).toBe("application");
    expect(garminComponent?.hashes?.[0]?.alg).toBe("SHA-256");
    expect(garminComponent?.hashes?.[0]?.content).toMatch(/^[a-f0-9]{64}$/i);

    expect(monkeyComponent).toBeDefined();
    expect(monkeyComponent?.type).toBe("application");
    expect(monkeyComponent?.hashes?.[0]?.alg).toBe("SHA-256");
    expect(monkeyComponent?.hashes?.[0]?.content).toMatch(/^[a-f0-9]{64}$/i);
  });

  it("excludes sensitive environment secrets and connection strings from sbom.json", async () => {
    await generateSbom({ rootDir: workspaceRoot, outputFile: sbomPath });
    const sbomContent = fs.readFileSync(sbomPath, "utf-8");

    expect(sbomContent).not.toMatch(/postgres(?:ql)?:\/\/[^\s"']+/i);
    expect(sbomContent).not.toContain("CRON_SECRET");
    expect(sbomContent).not.toContain("CLERK_SECRET_KEY");
    expect(sbomContent).not.toContain("UPSTASH_REDIS_REST_TOKEN");
  });
});
