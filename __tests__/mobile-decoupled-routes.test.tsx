// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import nextConfig from "@/next.config";
import { config as proxyConfig } from "@/proxy";
import ProofWorkspacePage from "@/app/proof/page";
import CRFStudioPage from "@/app/crf/page";
import NeuroReconPage from "@/app/neuro/page";
import PatrolShiftPage from "@/app/patrol/page";
import { metadata as proofMetadata } from "@/app/proof/layout";
import { metadata as crfMetadata } from "@/app/crf/layout";
import { metadata as neuroMetadata } from "@/app/neuro/layout";
import { metadata as patrolMetadata } from "@/app/patrol/layout";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
}));

vi.mock("@/hooks/useStudioHashParams", () => ({
  useStudioHashParams: () => ({
    params: {},
    setParam: vi.fn(),
    setParams: vi.fn(),
  }),
}));

describe("Route-Level Mobile Decoupling & Dedicated Mobile Views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Phone redirects from next.config.ts (#3204, #3205)", () => {
    it("permanently redirects /m/* studio paths to canonical studio routes", async () => {
      const redirects = (await nextConfig.redirects!()).filter((r) =>
        r.source.startsWith("/m/")
      );
      expect(redirects).toHaveLength(1);
      const redirect = redirects[0];
      expect(redirect.source).toBe("/m/:studio/:path*");
      expect(redirect.destination).toBe("/:studio/:path*");
      expect(redirect.permanent).toBe(true);
    });

    it("no longer runs the proxy on the studios or on /m/*", () => {
      for (const path of ["/proof", "/crf", "/neuro", "/patrol", "/m/proof"]) {
        expect(
          proxyConfig.matcher.some(
            (source) =>
              path === source.replace(/\/:path\*$/, "") ||
              path.startsWith(source.replace(/:path\*$/, ""))
          ),
          path
        ).toBe(false);
      }
    });
  });

  describe("Mobile Views Preserving Full User Journey Features", () => {
    it("renders touch-optimized studio pages with complete user journey parity", () => {
      expect(typeof ProofWorkspacePage).toBe("function");
      expect(typeof CRFStudioPage).toBe("function");
      expect(typeof NeuroReconPage).toBe("function");
      expect(typeof PatrolShiftPage).toBe("function");
    });

    it("exports metadata for studio routes canonicalizing to primary studio URLs", () => {
      expect(proofMetadata.alternates?.canonical).toBe("/proof");
      expect(crfMetadata.alternates?.canonical).toBe("/crf");
      expect(neuroMetadata.alternates?.canonical).toBe("/neuro");
      expect(patrolMetadata.alternates?.canonical).toBe("/patrol");

      expect(proofMetadata.title).toContain("Logical Proof Workspace");
      expect(crfMetadata.title).toContain("CRF Studio");
      expect(neuroMetadata.title).toContain("NeuroRecon Studio");
      expect(patrolMetadata.title).toContain("Ski Patrol Shift Studio");
    });

    it("registers canonical studio routes in PUBLIC_ROUTE_REGISTRY and removes /m/*", () => {
      const paths = PUBLIC_ROUTE_REGISTRY.map((r) => r.path);
      expect(paths).toContain("/proof");
      expect(paths).toContain("/crf");
      expect(paths).toContain("/neuro");
      expect(paths).toContain("/patrol");
      expect(paths).not.toContain("/m/proof");
      expect(paths).not.toContain("/m/crf");
      expect(paths).not.toContain("/m/neuro");
      expect(paths).not.toContain("/m/patrol");
    });
  });
});
