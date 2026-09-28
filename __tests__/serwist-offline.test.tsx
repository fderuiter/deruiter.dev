/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import OfflineFallbackPage from "@/app/desktop/offline/page";
import { SerwistRegister } from "@/components/providers/SerwistRegister";
import { loadExternalBrainMesh } from "@/lib/neuro/asset-loader";
import { fromAny } from "@total-typescript/shoehorn";
import fs from "fs";
import path from "path";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/offline",
}));

describe("Serwist PWA Engine & Offline App Shell Integration", () => {
  let originalLocation: Location;
  let originalOnLineDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLocation = window.location;
    originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "onLine"
    );
  });

  afterEach(() => {
    cleanup();
    if (originalOnLineDescriptor) {
      Object.defineProperty(navigator, "onLine", originalOnLineDescriptor);
    }
    vi.restoreAllMocks();
  });

  describe("Requirement 1 & 3: Offline Fallback Page", () => {
    it("describes an online navigation failure without claiming the visitor is offline", () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });

      render(<OfflineFallbackPage />);

      expect(
        screen.getByRole("heading", {
          name: /This page is taking longer than expected/i,
        })
      ).toBeDefined();
      expect(
        screen.queryByRole("heading", {
          name: /This page isn’t available offline/i,
        })
      ).toBeNull();
    });

    it("renders the dedicated offline fallback page with status and retry controls", () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });

      render(<OfflineFallbackPage />);

      expect(
        screen.getByText(/This page isn’t available offline/i)
      ).toBeDefined();
      expect(
        screen.getByText(
          /This page hasn’t been saved for offline use|You’re back online/i
        )
      ).toBeDefined();
      expect(
        screen.getAllByRole("button", { name: /Retry Connection/i })[0]
      ).toBeDefined();
      expect(screen.getByText(/Pages to Try Offline/i)).toBeDefined();
    });

    it("triggers window location reload when Retry Connection is clicked", () => {
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...originalLocation, reload: reloadMock },
      });

      render(<OfflineFallbackPage />);
      const retryButtons = screen.getAllByRole("button", {
        name: /Retry Connection/i,
      });
      fireEvent.click(retryButtons[0]);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("displays links to all core precached app shell routes", () => {
      render(<OfflineFallbackPage />);

      const expectedLinks = [
        "/",
        "/proof",
        "/simulator",
        "/neuro",
        "/crf",
        "/stack",
        "/arcade",
      ];
      const anchorElements = screen.getAllByRole("link");
      const hrefs = anchorElements.map((a) => a.getAttribute("href"));

      expectedLinks.forEach((expectedHref) => {
        expect(hrefs).toContain(expectedHref);
      });
    });
  });

  describe("Requirement 2: 3D Model Procedural Fallback Verification", () => {
    it("falls back gracefully to procedural cortical mesh when external 3D model fails to load", async () => {
      // Pass a non-existent URL to force fetch/load failure in loadExternalBrainMesh
      const resultGroup = await loadExternalBrainMesh(
        "/models/non-existent-brain.glb",
        "pial",
        "both"
      );

      expect(resultGroup).toBeDefined();
      expect(resultGroup.children.length).toBeGreaterThan(0);
    });
  });

  describe("Requirement 5: Silent Service Worker Registration", () => {
    it("executes registration silently on client mount without throwing errors", () => {
      const mockRegister = vi.fn().mockResolvedValue(fromAny(undefined));

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register: mockRegister,
        },
      });

      const { container } = render(<SerwistRegister />);
      expect(container.firstChild).toBeNull();
      expect(mockRegister).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    });

    it("uses window.serwist.register when available", () => {
      const mockSerwistRegister = vi.fn().mockResolvedValue(undefined);
      const customWindow = window as typeof window & {
        serwist?: { register: typeof mockSerwistRegister };
      };
      customWindow.serwist = {
        register: mockSerwistRegister,
      };

      render(<SerwistRegister />);
      expect(mockSerwistRegister).toHaveBeenCalledTimes(1);

      delete customWindow.serwist;
    });
  });

  describe("Requirement 4 & Architecture Verification: Service Worker Configuration Invariants", () => {
    it("verifies app/sw.ts enforces NetworkOnly strategy for telemetry and Sentry", () => {
      const swFilePath = path.resolve(process.cwd(), "app/sw.ts");
      expect(fs.existsSync(swFilePath)).toBe(true);

      const swContent = fs.readFileSync(swFilePath, "utf-8");

      // Verify Telemetry & Sentry matching
      expect(swContent).toContain('pathname.startsWith("/api/telemetry")');
      expect(swContent).toContain('hostname.includes("sentry")');
      expect(swContent).toContain("new NetworkOnly()");

      // Verify 3D Model CacheFirst
      expect(swContent).toContain("new CacheFirst");
      expect(swContent).toContain("3d-models-cache");

      // Verify Offline Fallback Route
      expect(swContent).toContain('url: "/offline"');
      expect(swContent).toContain('request.destination === "document"');
    });
  });
});
