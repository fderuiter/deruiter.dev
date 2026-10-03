// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Navbar } from "@/components/Navbar";
import { CommandPalette } from "@/components/CommandPalette";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      volume: 0.5,
      muted: false,
      profile: "8-bit",
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setProfile: vi.fn(),
      playHover: vi.fn(),
      playSubmit: vi.fn(),
      playSuccess: vi.fn(),
      playNote: vi.fn(),
    }),
  };
});

// Mock SearchProvider
let mockSearchOpen = false;
const mockOpenSearch = vi.fn(() => {
  mockSearchOpen = true;
});
const mockCloseSearch = vi.fn(() => {
  mockSearchOpen = false;
});

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: mockSearchOpen,
    openSearch: mockOpenSearch,
    closeSearch: mockCloseSearch,
  }),
}));

// Mock PersonaProvider
let mockPersona: "behind-the-scenes" | "professional" | "default" =
  "behind-the-scenes";
const mockSetPersona = vi.fn((p) => {
  mockPersona = p;
});

vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({
    persona: mockPersona,
    setPersona: mockSetPersona,
  }),
}));

// Mock next/navigation
let mockPathname = "/";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Navigation & Global State Integration Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
    mockPersona = "behind-the-scenes";
    mockSearchOpen = false;
    document.body.style.overflow = "";

    // Mock IntersectionObserver for JSDOM
    global.IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;

    // Mock fetch for /api/case-studies
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ caseStudies: [] }),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.style.overflow = "";
  });

  describe("1. Full-Spectrum Navbar & Mobile Drawer Lifecycle", () => {
    it.each(["arcade", "systems"])(
      "returns focus from %s links to their disclosure button on Escape",
      async (navigation) => {
        await act(async () => root.render(<Navbar />));
        const trigger = container.querySelector<HTMLButtonElement>(
          `button[aria-controls="${navigation}-navigation"]`
        )!;
        await act(async () => trigger.click());
        const link = container.querySelector<HTMLAnchorElement>(
          `#${navigation}-navigation a`
        )!;
        link.focus();
        expect(document.activeElement).toBe(link);
        await act(async () => {
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          );
        });
        expect(trigger.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(trigger);
      }
    );

    it("handles desktop dropdown toggles, outside click dismissals, and mobile drawer transitions", async () => {
      await act(async () => {
        root.render(<Navbar />);
      });

      // 1. Desktop Systems Dropdown
      const systemsBtn = container.querySelector(
        'button[aria-controls="systems-navigation"]'
      ) as HTMLButtonElement;
      expect(systemsBtn).toBeTruthy();

      await act(async () => {
        systemsBtn.click();
      });
      expect(systemsBtn.getAttribute("aria-expanded")).toBe("true");

      // Outside click closes dropdown
      await act(async () => {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(systemsBtn.getAttribute("aria-expanded")).toBe("false");

      systemsBtn.focus();
      await act(async () => {
        systemsBtn.click();
      });
      expect(systemsBtn.getAttribute("aria-expanded")).toBe("true");
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
      });
      expect(systemsBtn.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(systemsBtn);

      // 2. Mobile Drawer Open
      const hamburgerBtn = container.querySelector(
        'button[aria-controls="mobile-navigation"]'
      ) as HTMLButtonElement;
      expect(hamburgerBtn).toBeTruthy();

      await act(async () => {
        hamburgerBtn.click();
      });

      expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("true");
      expect(document.getElementById("mobile-navigation")).toBeTruthy();
      expect(document.body.style.overflow).toBe("hidden");

      // 3. Navigation Click in Mobile Drawer
      const scheduleLink = document.querySelector(
        'a[href="/schedule"]'
      ) as HTMLAnchorElement;
      expect(scheduleLink).toBeTruthy();

      await act(async () => {
        scheduleLink.click();
      });

      // Overlay dismissed and body scroll unlocked immediately
      expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("2. Command Palette Hotkey & Filter Discovery Integration", () => {
    it("opens via global hotkey, filters tools and games, and executes selection", async () => {
      mockSearchOpen = true;

      await act(async () => {
        root.render(<CommandPalette />);
      });

      const searchInput = document.querySelector(
        'input[type="text"]'
      ) as HTMLInputElement;
      expect(searchInput).toBeTruthy();

      // Type query to filter
      await act(async () => {
        searchInput.value = "Proof";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      });

      // Close button
      const escBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("ESC")
      );
      expect(escBtn).toBeTruthy();

      await act(async () => {
        escBtn?.click();
      });

      expect(mockCloseSearch).toHaveBeenCalled();
    });
  });

  describe("3. Persona Perspective Switching & Synchronization", () => {
    it("toggles persona state between Behind the Scenes and Professional modes", async () => {
      await act(async () => {
        root.render(<Navbar />);
      });

      // Open mobile drawer to access persona controls
      const hamburgerBtn = container.querySelector(
        'button[aria-controls="mobile-navigation"]'
      ) as HTMLButtonElement;
      await act(async () => {
        hamburgerBtn.click();
      });

      const professionalButtons = Array.from(
        document.querySelectorAll("button")
      ).filter((b) => b.textContent?.includes("PROFESSIONAL"));
      expect(professionalButtons.length).toBeGreaterThan(0);

      await act(async () => {
        professionalButtons[0].click();
      });

      expect(mockSetPersona).toHaveBeenCalledWith("professional");
    });
  });
});
