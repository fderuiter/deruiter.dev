// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import nextConfig from "@/next.config";
import { config as proxyConfig } from "@/proxy";
import MobileProofPage from "@/app/m/proof/page";
import MobileCrfPage from "@/app/m/crf/page";
import MobileNeuroPage from "@/app/m/neuro/page";
import MobilePatrolPage from "@/app/m/patrol/page";
import { metadata as mobileProofMetadata } from "@/app/m/proof/layout";
import { metadata as mobileCrfMetadata } from "@/app/m/crf/layout";
import { metadata as mobileNeuroMetadata } from "@/app/m/neuro/layout";
import { metadata as mobilePatrolMetadata } from "@/app/m/patrol/layout";
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
    it("sends the four studios and their subpaths to /m/* for phones, temporarily", async () => {
      const redirects = (await nextConfig.redirects!()).filter((r) =>
        r.destination.startsWith("/m/")
      );
      expect(redirects.map((r) => r.has?.[0]?.key)).toEqual([
        "user-agent",
        "sec-ch-ua-mobile",
      ]);
      for (const redirect of redirects) {
        expect(redirect.source).toBe("/:studio(crf|proof|neuro|patrol)/:path*");
        expect(redirect.destination).toBe("/m/:studio/:path*");
        expect(redirect.permanent).toBe(false);
      }
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
      expect(typeof MobileProofPage).toBe("function");
      expect(typeof MobileCrfPage).toBe("function");
      expect(typeof MobileNeuroPage).toBe("function");
      expect(typeof MobilePatrolPage).toBe("function");
    });

    it("exports metadata for mobile routes canonicalizing to primary studio URLs", () => {
      expect(mobileProofMetadata.alternates?.canonical).toBe("/proof");
      expect(mobileCrfMetadata.alternates?.canonical).toBe("/crf");
      expect(mobileNeuroMetadata.alternates?.canonical).toBe("/neuro");
      expect(mobilePatrolMetadata.alternates?.canonical).toBe("/patrol");

      expect(mobileProofMetadata.title).toContain(
        "Mobile Logical Proof Workspace"
      );
      expect(mobileCrfMetadata.title).toContain("Mobile CRF Studio");
      expect(mobileNeuroMetadata.title).toContain("Mobile NeuroRecon Studio");
      expect(mobilePatrolMetadata.title).toContain(
        "Mobile Ski Patrol Shift Studio"
      );
    });

    it("registers mobile routes in PUBLIC_ROUTE_REGISTRY", () => {
      const paths = PUBLIC_ROUTE_REGISTRY.map((r) => r.path);
      expect(paths).toContain("/m/proof");
      expect(paths).toContain("/m/crf");
      expect(paths).toContain("/m/neuro");
      expect(paths).toContain("/m/patrol");
    });
  });
});
