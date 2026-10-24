import { existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PLATFORM_CAPABILITIES,
  capabilityStatus,
} from "@/app/platform/capabilities";
import PlatformPage from "@/app/platform/page";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

describe("Clinical Data Platform hub", () => {
  it("maps all thirteen ADR 0066 capabilities to reachable evidence", () => {
    const publicPaths = new Set<string>(
      PUBLIC_ROUTE_REGISTRY.map((entry) => entry.path)
    );
    expect(PLATFORM_CAPABILITIES).toHaveLength(13);
    expect(
      new Set(PLATFORM_CAPABILITIES.map((capability) => capability.id)).size
    ).toBe(13);

    for (const capability of PLATFORM_CAPABILITIES) {
      expect(capability.evidence.length, capability.id).toBeGreaterThan(0);
      for (const evidence of capability.evidence) {
        if (evidence.kind === "route") {
          expect(publicPaths.has(evidence.href), evidence.href).toBe(true);
          expect(
            existsSync(
              path.resolve(process.cwd(), `app${evidence.href}/page.tsx`)
            ),
            evidence.href
          ).toBe(true);
        } else {
          expect(evidence.href).toMatch(
            /^https:\/\/github\.com\/fderuiter\/deruiter\.dev\//
          );
        }
      }
      expect(capabilityStatus(capability)).toBe(
        capability.evidence.some(
          (evidence) =>
            evidence.kind === "route" && !evidence.href.startsWith("/arcade/")
        )
          ? "Live demo"
          : "In progress"
      );
    }
  });

  it("never counts an arcade game as live control evidence", () => {
    const regulations = PLATFORM_CAPABILITIES.find(
      (capability) => capability.id === "regulations"
    );
    if (!regulations) throw new Error("regulations capability missing");
    expect(
      regulations.evidence.some((link) => link.href.startsWith("/arcade/"))
    ).toBe(true);
    expect(capabilityStatus(regulations)).toBe("In progress");
  });

  it("renders the architecture, synthetic scope and a registered route", () => {
    const html = renderToStaticMarkup(<PlatformPage />);
    expect(html).toContain("Clinical Data Platform");
    expect(html).toContain("Bronze");
    expect(html).toContain("Semantic");
    expect(html).toContain("Synthetic data for demonstration");
    expect(html).toContain("Designed to these controls");
    expect(html).toContain('href="/crf"');
    expect(html).toContain('href="/study-data"');
    expect(ROUTE_METADATA_CONFIGS.platform.path).toBe("/platform");
  });
});
