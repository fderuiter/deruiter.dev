// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  renderHook,
  act,
} from "@testing-library/react";
import { useFontPreference } from "@/hooks/useFontPreference";
import { SkipToContent } from "@/components/SkipToContent";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  cssPropertyCache,
  fontConfigCache,
  textPrepareCache,
  textLayoutCache,
  richLayoutCache,
} from "@/lib/graphics-engine";

// Mock ResizeObserver
global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as unknown as typeof ResizeObserver;

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    volume: 0.5,
    muted: false,
    profile: "8-bit",
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
}));

// Mock PersonaProvider
vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({
    persona: "technical",
    setPersona: vi.fn(),
  }),
}));

// Mock SearchProvider
vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock useAnnouncer from both locations
const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

vi.mock("@/components/providers/A11yProvider", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

describe("Wave 2: Cognitive Accessibility & Dyslexia Typography (#738, #739, #740)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-font-mode");
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-font-mode");
  });

  describe("useFontPreference hook", () => {
    it("initializes with default mode when localStorage is empty", () => {
      const { result } = renderHook(() => useFontPreference());
      expect(result.current.fontMode).toBe("default");
      expect(result.current.isDyslexic).toBe(false);
      expect(
        document.documentElement.getAttribute("data-font-mode")
      ).toBeNull();
    });

    it("toggles dyslexia mode and sets data-font-mode attribute on documentElement", () => {
      const { result } = renderHook(() => useFontPreference());

      act(() => {
        result.current.toggleDyslexiaMode();
      });

      expect(result.current.fontMode).toBe("opendyslexic");
      expect(result.current.isDyslexic).toBe(true);
      expect(document.documentElement.getAttribute("data-font-mode")).toBe(
        "opendyslexic"
      );
      expect(localStorage.getItem("portfolio-font-mode")).toContain(
        "opendyslexic"
      );

      act(() => {
        result.current.toggleDyslexiaMode();
      });

      expect(result.current.fontMode).toBe("default");
      expect(result.current.isDyslexic).toBe(false);
      expect(
        document.documentElement.getAttribute("data-font-mode")
      ).toBeNull();
      expect(localStorage.getItem("portfolio-font-mode")).toContain("default");
    });

    it("purges graphics engine and Pretext caches on font mode transition", () => {
      cssPropertyCache.set("test-key", "test-val" as never);
      fontConfigCache.set("test-key", {} as never);
      textPrepareCache.set("test-key", {} as never);
      textLayoutCache.set("test-key", {} as never);
      richLayoutCache.set("test-key", {} as never);

      expect(cssPropertyCache.size).toBeGreaterThan(0);

      const { result } = renderHook(() => useFontPreference());

      act(() => {
        result.current.setFontMode("opendyslexic");
      });

      expect(cssPropertyCache.size).toBe(0);
      expect(fontConfigCache.size).toBe(0);
      expect(textPrepareCache.size).toBe(0);
      expect(textLayoutCache.size).toBe(0);
      expect(richLayoutCache.size).toBe(0);
    });
  });

  describe("SkipToContent First Tab-Stop Accessibility", () => {
    it("renders dyslexia toggle button prior to Skip to Main Content", () => {
      render(<SkipToContent />);

      const dyslexiaBtn = screen.getByRole("button", {
        name: /Enable Dyslexia Font \(OpenDyslexic\)/i,
      });
      const skipLink = screen.getByRole("link", {
        name: /Skip to main content/i,
      });

      expect(dyslexiaBtn).toBeDefined();
      expect(skipLink).toBeDefined();

      // Verify DOM document order: dyslexia button precedes skip link for 1st tab-stop
      const position = dyslexiaBtn.compareDocumentPosition(skipLink);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("triggers dyslexia mode toggle and announcement on click", () => {
      render(<SkipToContent />);

      const dyslexiaBtn = screen.getByRole("button", {
        name: /Enable Dyslexia Font \(OpenDyslexic\)/i,
      });

      fireEvent.click(dyslexiaBtn);

      expect(document.documentElement.getAttribute("data-font-mode")).toBe(
        "opendyslexic"
      );
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining("Dyslexia font mode enabled"),
        "polite"
      );
    });
  });

  describe("Navbar Dyslexia Mode Toggle Controls ARIA Parity", () => {
    it("exports valid aria-pressed attributes in the Preferences menu and the mobile drawer", () => {
      render(<Navbar />);

      // The single Preferences menu holds the dyslexia toggle (Text section).
      fireEvent.click(
        screen.getByRole("button", { name: /Open navigation preferences/i })
      );
      const menuToggle = screen.getByRole("button", {
        name: /Enable OpenDyslexic font mode/i,
      });
      expect(menuToggle.getAttribute("aria-pressed")).toBe("false");

      // The mobile drawer renders the same panel.
      fireEvent.click(
        screen.getByRole("button", { name: /Open navigation menu/i })
      );
      const toggles = screen.getAllByRole("button", {
        name: /Enable OpenDyslexic font mode/i,
      });
      expect(toggles).toHaveLength(2);
      toggles.forEach((btn) => {
        expect(btn.getAttribute("aria-pressed")).toBe("false");
      });

      fireEvent.click(toggles[0]);

      expect(document.documentElement.getAttribute("data-font-mode")).toBe(
        "opendyslexic"
      );
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining("Dyslexia font mode enabled"),
        "polite"
      );

      const activeToggles = screen.getAllByRole("button", {
        name: /Disable OpenDyslexic font mode/i,
      });
      expect(activeToggles).toHaveLength(2);
      activeToggles.forEach((btn) => {
        expect(btn.getAttribute("aria-pressed")).toBe("true");
      });
    });
  });

  describe("Footer Persistent Dyslexia Controls & Linkage", () => {
    it("renders dyslexia toggle button in bottom strip", () => {
      render(<Footer />);

      const footerDyslexiaBtn = screen.getByRole("button", {
        name: /Enable Dyslexia Mode \(OpenDyslexic font\)/i,
      });
      expect(footerDyslexiaBtn).toBeDefined();
      expect(footerDyslexiaBtn.getAttribute("aria-pressed")).toBe("false");

      fireEvent.click(footerDyslexiaBtn);

      expect(document.documentElement.getAttribute("data-font-mode")).toBe(
        "opendyslexic"
      );
      expect(footerDyslexiaBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("includes link to Designing for My Brother case study", () => {
      render(<Footer />);

      const caseStudyLink = screen.getByRole("link", {
        name: /Designing for My Brother/i,
      });
      expect(caseStudyLink).toBeDefined();
      expect(caseStudyLink.getAttribute("href")).toBe(
        "/case-studies/designing-for-my-brother"
      );
    });
  });

  describe("Designing for My Brother Canonical Case Study (#740)", () => {
    it("exists in FALLBACK_CASE_STUDIES with required 5-section narrative structure", () => {
      const study = FALLBACK_CASE_STUDIES.find(
        (s) => s.slug === "designing-for-my-brother"
      );
      expect(study).toBeDefined();
      expect(study?.title).toContain("Designing for My Brother");
      expect(study?.primary_language).toBe("TypeScript");
      expect(study?.published).toBe(true);

      const narrative = study?.architectural_narrative || "";
      expect(narrative).toContain("<h3>The problem</h3>");
      expect(narrative).toContain("<h3>How it works</h3>");
      expect(narrative).toContain("<h3>How the pieces connect</h3>");
      expect(narrative).toContain("<h3>Implementation notes</h3>");
      expect(narrative).toContain("<h3>Tradeoffs and lessons</h3>");
      expect(narrative).toContain("language-mermaid");
    });

    it("has registered route metadata in ROUTE_METADATA_CONFIGS", () => {
      const config = ROUTE_METADATA_CONFIGS.designingForMyBrother;
      expect(config).toBeDefined();
      expect(config.path).toBe("/case-studies/designing-for-my-brother");
      expect(config.title).toContain("Designing for My Brother");
      expect(config.keywords).toContain("OpenDyslexic");
      expect(config.keywords).toContain("Atkinson Hyperlegible");
      expect(config.keywords).toContain("Lexend");
    });

    it("has valid interactive sandbox commands and playback definitions", () => {
      const study = FALLBACK_CASE_STUDIES.find(
        (s) => s.slug === "designing-for-my-brother"
      );
      expect(study?.commands_json).toBeDefined();
      expect(study?.playback_json).toBeDefined();

      const commands = JSON.parse(study?.commands_json || "{}");
      const playback = JSON.parse(study?.playback_json || "[]");

      expect(Object.keys(commands).length).toBeGreaterThanOrEqual(3);
      expect(playback.length).toBeGreaterThanOrEqual(3);
      expect(commands["typography inspect --target runtime"]).toBeDefined();
      expect(commands["typography test-dyslexia --enable"]).toBeDefined();
    });
  });
});
