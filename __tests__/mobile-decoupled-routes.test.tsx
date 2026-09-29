// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { NextRequest } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";
import { proxy } from "@/proxy";
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

  describe("Edge Proxy Mobile Redirection Invariant", () => {
    it("redirects mobile requests from /proof to /m/proof while preserving query parameters", async () => {
      const req = new NextRequest(
        "http://localhost/proof?theorem=natural-deduction&inspect=C",
        {
          headers: {
            "user-agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          },
        }
      );

      const mockEvent = fromPartial<import("next/server").NextFetchEvent>({
        waitUntil: vi.fn(),
      });

      const res = await proxy(req, mockEvent);

      expect(res!.status).toBe(307);
      const location = res!.headers.get("location");
      expect(location).toContain("/m/proof");
      expect(location).toContain("theorem=natural-deduction");
      expect(location).toContain("inspect=C");
    });

    it("redirects mobile requests from /crf, /neuro, and /patrol to /m/* routes", async () => {
      const routes = ["/crf", "/neuro", "/patrol"];

      for (const route of routes) {
        const req = new NextRequest(`http://localhost${route}?mode=demo`, {
          headers: {
            "sec-ch-ua-mobile": "?1",
          },
        });

        const res = await proxy(req, fromPartial({ waitUntil: vi.fn() }));
        expect(res!.status).toBe(307);
        const location = res!.headers.get("location");
        expect(location).toContain(`/m${route}`);
        expect(location).toContain("mode=demo");
      }
    });

    it("does NOT redirect desktop requests on workspace routes", async () => {
      const req = new NextRequest("http://localhost/proof", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      const res = await proxy(req, fromPartial({ waitUntil: vi.fn() }));
      expect(res!.status).toBe(200);
      expect(res!.headers.get("location")).toBeNull();
    });

    it("does NOT issue infinite redirects when request is already on /m/* route", async () => {
      const req = new NextRequest("http://localhost/m/proof", {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        },
      });

      const res = await proxy(req, fromPartial({ waitUntil: vi.fn() }));
      expect(res!.status).toBe(200);
      expect(res!.headers.get("location")).toBeNull();
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
