/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { FooterStatusTicker } from "@/components/FooterStatusTicker";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";

let globalObserverCallback: ((entries: any[]) => void) | null = null;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockResizeObserver {
  constructor(cb: any) {
    globalObserverCallback = cb;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

globalThis.ResizeObserver = MockResizeObserver as any;

// Mock required providers
vi.mock("@/components/providers/AudioProvider", () => ({
  registerAudioCleanup: vi.fn(() => vi.fn()),
  useAudio: () => ({
    playHover: vi.fn(),
    playClick: vi.fn(),
    playSuccess: vi.fn(),
    muted: false,
    profile: "synth",
  }),
}));

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    openSearch: vi.fn(),
  }),
}));

vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({
    persona: "executive",
    setPersona: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/arcade",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Dynamic Viewport Heights & CSS Custom Variable Space Contract", () => {
  beforeEach(() => {
    document.documentElement.style.cssText = "";
    globalObserverCallback = null;
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Requirement 1: Navigation Header and Footer expose CSS variables", () => {
    it("Navbar exposes --header-height and --navbar-height CSS properties when observed", async () => {
      render(<Navbar />);

      await act(async () => {
        if (globalObserverCallback) {
          globalObserverCallback([
            { contentRect: { width: 1200, height: 72 }, target: null },
          ]);
        }
      });

      expect(
        document.documentElement.style.getPropertyValue("--header-height")
      ).toBe("72px");
      expect(
        document.documentElement.style.getPropertyValue("--navbar-height")
      ).toBe("72px");
    });

    it("FooterStatusTicker exposes --footer-height and --ticker-height CSS properties when observed", async () => {
      render(<FooterStatusTicker />);

      await act(async () => {
        if (globalObserverCallback) {
          globalObserverCallback([
            { contentRect: { width: 1200, height: 44 }, target: null },
          ]);
        }
      });

      expect(
        document.documentElement.style.getPropertyValue("--footer-height")
      ).toBe("44px");
      expect(
        document.documentElement.style.getPropertyValue("--ticker-height")
      ).toBe("44px");
    });
  });

  describe("Requirement 2 & 4: Workspace, Studio, and Arcade Cabinet calculations", () => {
    it("PlayCabinet keeps windowed content in natural flow without a viewport height cap", async () => {
      vi.useFakeTimers();

      const { container } = render(
        <PlayCabinet
          gameId="laser-loon"
          title="Laser Loon"
          instructions="Test instructions"
          controls={[]}
          icon={<div>Icon</div>}
          importComponent={() => Promise.resolve({ default: () => <div /> })}
        >
          <div>Game Canvas Content</div>
        </PlayCabinet>
      );

      const launchBtn = screen.getByRole("button", {
        name: /launch|play|start/i,
      });
      await act(async () => {
        launchBtn.click();
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const gameArea = container.querySelector(".arcade-cabinet-stage");
      expect(gameArea).not.toBeNull();
      expect(gameArea?.className).not.toContain("max-h-");
      expect(gameArea?.className).toContain("justify-start");

      vi.useRealTimers();
    });

    it("CRFStudioContainer grows on phones and uses the viewport budget on desktop", () => {
      const { container } = render(<CRFStudioContainer />);

      const studioWrapper = container.querySelector("[data-studio-theme]");
      expect(studioWrapper).not.toBeNull();
      expect(studioWrapper?.className).toContain("min-h-dvh");
      expect(studioWrapper?.className).toContain(
        "md:h-[var(--layout-studio-budget,calc(100dvh-var(--header-height,80px)))]"
      );
    });
  });
});
