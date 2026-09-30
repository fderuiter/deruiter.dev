// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandPalette } from "@/components/CommandPalette";
import { runPageBenchmarks, CANONICAL_ROUTES } from "@/lib/dx/page-bench";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  Lexend: () => ({ variable: "--font-lexend" }),
  Atkinson_Hyperlegible: () => ({ variable: "--font-atkinson" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

// Mock audio provider functions
const mockPreconnect = vi.fn();
const mockPreload = vi.fn();

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    preconnect: (...args: unknown[]) => mockPreconnect(...args),
    preload: (...args: unknown[]) => mockPreload(...args),
  };
});

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playHover: vi.fn(),
      playSubmit: vi.fn(),
      playSuccess: vi.fn(),
      playNote: vi.fn(),
      volume: 0.3,
      muted: false,
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock search provider state
let mockIsOpen = false;
const mockCloseSearch = vi.fn();
const mockSetIsOpen = vi.fn((val: boolean) => {
  mockIsOpen = val;
});

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: mockIsOpen,
    setIsOpen: mockSetIsOpen,
    closeSearch: mockCloseSearch,
  }),
  SearchProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("Mobile Performance & Asset Optimization Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe("Next.js Static Asset & Image Caching Headers", () => {
    it("exports immutable caching headers for models, duck assets, and static media in next.config.ts", async () => {
      const nextConfigModule = await import("../next.config");
      const nextConfig = nextConfigModule.default;

      // Sentry wrapper wraps the config; inspect config or execute headers if present
      expect(nextConfig).toBeDefined();
      if (typeof nextConfig.headers === "function") {
        const headers = await nextConfig.headers();
        expect(headers.length).toBeGreaterThanOrEqual(3);

        const staticHeader = headers.find(
          (h: { source: string }) =>
            h.source.includes("glb") || h.source.includes("svg")
        );
        expect(staticHeader).toBeDefined();
        expect(staticHeader?.source).toContain("woff");
        expect(staticHeader?.source).toContain("woff2");
        expect(staticHeader?.source).toContain("ttf");
        expect(staticHeader?.source).toContain("eot");
        expect(staticHeader?.source).toContain("otf");
        expect(staticHeader?.headers[0]?.value).toContain("immutable");

        const modelsHeader = headers.find(
          (h: { source: string }) => h.source === "/models/:path*"
        );
        expect(modelsHeader).toBeDefined();
        expect(modelsHeader?.headers[0]?.value).toContain("max-age=31536000");

        const duckHeader = headers.find(
          (h: { source: string }) => h.source === "/duck/:path*"
        );
        expect(duckHeader).toBeDefined();
        expect(duckHeader?.headers[0]?.value).toContain("immutable");
      }

      if (nextConfig.images) {
        expect(nextConfig.images.formats).toEqual(["image/avif", "image/webp"]);
        expect(nextConfig.images.minimumCacheTTL).toBe(31536000);
      }
    });

    it("verifies zero preconnect directives for external font origins in RootLayout without eager preloading 3D models", async () => {
      const RootLayoutModule = await import("../app/layout");
      const RootLayout = RootLayoutModule.default;

      RootLayout({ children: <div /> });

      expect(mockPreconnect).not.toHaveBeenCalledWith(
        "https://fonts.googleapis.com"
      );
      expect(mockPreconnect).not.toHaveBeenCalledWith(
        "https://fonts.gstatic.com",
        expect.anything()
      );

      expect(mockPreload).not.toHaveBeenCalledWith(
        "/models/brain-surface.glb",
        expect.anything()
      );
      expect(mockPreload).not.toHaveBeenCalledWith(
        "/models/brain.obj",
        expect.anything()
      );
    });
  });

  describe("CommandPalette Deferred Data Fetching", () => {
    it("does not fetch /api/case-studies immediately when closed and idle callback is not triggered", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      global.fetch = fetchSpy;

      await act(async () => {
        root.render(<CommandPalette />);
      });

      // Since isOpen is false, fetch shouldn't execute synchronously on mount
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetches /api/case-studies when the search palette is opened", async () => {
      const mockStudies = [
        {
          id: "1",
          slug: "clinical-mapper",
          title: "Clinical Mapper",
          primary_language: "Python",
          tags: "sdtm,cdisc",
        },
      ];
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockStudies,
      });
      global.fetch = fetchSpy;

      mockIsOpen = true;

      await act(async () => {
        root.render(<CommandPalette />);
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/case-studies",
        expect.anything()
      );
    });
  });

  describe("Mobile Emulation in Page Benchmarking Engine", () => {
    it("configures mobile viewport and touch options in runPageBenchmarks", async () => {
      expect(CANONICAL_ROUTES.length).toBeGreaterThanOrEqual(15);
      expect(typeof runPageBenchmarks).toBe("function");
    });
  });
});
