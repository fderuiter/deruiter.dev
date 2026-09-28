// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextRequest } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";
import { proxy } from "@/proxy";
import { MobileProofClient } from "@/app/m/proof/MobileProofClient";
import { MobileCrfClient } from "@/app/m/crf/MobileCrfClient";
import { MobileNeuroClient } from "@/app/m/neuro/MobileNeuroClient";
import { MobilePatrolClient } from "@/app/m/patrol/MobilePatrolClient";

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

  describe("Mobile Proof Workspace (Zero Mounted Canvas/Terminal Nodes)", () => {
    it("renders lightweight mobile deduction list without mounting desktop canvas or CLI terminal", () => {
      const { container } = render(<MobileProofClient />);

      expect(screen.getByText("PROOF STUDIO (MOBILE)")).toBeDefined();
      expect(screen.getByText(/Deduction Steps/i)).toBeDefined();

      // Assert ZERO canvas or WebGL element nodes in DOM
      expect(container.querySelector("canvas")).toBeNull();

      // Assert CLI Terminal console overlay is unmounted
      expect(container.querySelector("#proof-cli")).toBeNull();
      expect(
        container.querySelector("input[aria-label='Terminal input']")
      ).toBeNull();
    });

    it("allows switching theorems and inspecting steps on touch interfaces", () => {
      render(<MobileProofClient />);

      const modusTollensBtn = screen.getByText("Modus Tollens");
      fireEvent.click(modusTollensBtn);

      expect(screen.getByText("Switched to Modus Tollens")).toBeDefined();
    });
  });

  describe("Mobile CRF Studio (Zero Multi-Pane Canvas Splitters)", () => {
    it("renders touch card list without mounting desktop multi-pane canvas splitters", () => {
      const { container } = render(<MobileCrfClient />);

      expect(screen.getByText("CRF STUDIO (MOBILE)")).toBeDefined();
      expect(screen.getByText("Sections & Fields")).toBeDefined();

      // Assert zero desktop canvas splitters or heavy overlays
      expect(container.querySelector("canvas")).toBeNull();
    });
  });

  describe("Mobile NeuroRecon Studio (Zero Mounted 3D WebGL / 2D Canvas)", () => {
    it("renders structural morphometry metrics without mounting Three.js 3D or 2D slice canvas", () => {
      const { container } = render(<MobileNeuroClient />);

      expect(screen.getByText("NEURORECON (MOBILE)")).toBeDefined();
      expect(screen.getByText("MORPHOMETRIC OVERVIEW")).toBeDefined();

      // Assert zero <canvas> nodes
      expect(container.querySelector("canvas")).toBeNull();
    });
  });

  describe("Mobile Patrol Shift Studio (Zero Mounted Canvas Physics Loop)", () => {
    it("renders triage & intervention touch cards without mounting OET canvas physics loop", () => {
      const { container } = render(<MobilePatrolClient />);

      expect(screen.getByText("PATROL SHIFT (MOBILE)")).toBeDefined();
      expect(screen.getByText("SHIFT BRIEFING")).toBeDefined();

      // Assert zero <canvas> nodes
      expect(container.querySelector("canvas")).toBeNull();
    });
  });
});
