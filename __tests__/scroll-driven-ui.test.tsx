// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import React, { Profiler, type ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { Navbar } from "@/components/Navbar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    volume: 0.3,
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playNote: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({ persona: "professional", setPersona: vi.fn() }),
}));

vi.mock("@/hooks/useFontPreference", () => ({
  useFontPreference: () => ({
    isDyslexic: false,
    toggleDyslexiaMode: vi.fn(),
  }),
}));

function stubScrollTimelineSupport(supported: boolean) {
  Object.defineProperty(globalThis, "CSS", {
    value: {
      supports: vi.fn((condition: string) =>
        condition === "animation-timeline: scroll()" ? supported : false
      ),
    },
    writable: true,
    configurable: true,
  });
}

describe("Scroll-driven CSS UI (#4068)", () => {
  const originalCss = globalThis.CSS;

  beforeEach(() => {
    const observer = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    global.IntersectionObserver =
      observer as unknown as typeof IntersectionObserver;
    global.ResizeObserver = observer as unknown as typeof ResizeObserver;
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(globalThis, "CSS", {
      value: originalCss,
      writable: true,
      configurable: true,
    });
  });

  describe("ReadingProgressBar", () => {
    it("uses scroll-driven CSS without scroll listeners or re-renders when supported", () => {
      stubScrollTimelineSupport(true);
      const addSpy = vi.spyOn(window, "addEventListener");
      const onRender = vi.fn();

      const { container } = render(
        <Profiler id="reading-progress" onRender={onRender}>
          <ReadingProgressBar />
        </Profiler>
      );

      const outer = container.firstElementChild as HTMLElement;
      const fill = outer.firstElementChild as HTMLElement;

      expect(outer.getAttribute("aria-hidden")).toBe("true");
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(fill.classList.contains("reading-progress-fill")).toBe(true);
      expect(fill.classList.contains("duration-75")).toBe(false);
      expect(fill.style.transform).toBe("");
      expect(
        addSpy.mock.calls.filter(([event]) => event === "scroll")
      ).toHaveLength(0);

      const commitCountAfterMount = onRender.mock.calls.length;
      act(() => {
        Object.defineProperty(window, "scrollY", {
          value: 400,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("scroll"));
      });
      expect(onRender.mock.calls.length).toBe(commitCountAfterMount);
    });

    it("falls back to requestAnimationFrame scroll measurement when unsupported", () => {
      stubScrollTimelineSupport(false);
      const rafCallbacks: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

      Object.defineProperty(document.documentElement, "scrollHeight", {
        value: 2000,
        configurable: true,
      });
      Object.defineProperty(window, "innerHeight", {
        value: 1000,
        configurable: true,
      });

      const { container } = render(<ReadingProgressBar />);
      const outer = container.firstElementChild as HTMLElement;
      const fill = outer.firstElementChild as HTMLElement;

      expect(outer.getAttribute("aria-hidden")).toBe("true");
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(fill.classList.contains("duration-75")).toBe(true);
      expect(fill.classList.contains("reading-progress-fill")).toBe(false);

      act(() => {
        while (rafCallbacks.length > 0) {
          rafCallbacks.shift()?.(0);
        }
      });
      expect(fill.style.transform).toBe("scaleX(0)");

      act(() => {
        Object.defineProperty(window, "scrollY", {
          value: 500,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("scroll"));
        while (rafCallbacks.length > 0) {
          rafCallbacks.shift()?.(16);
        }
      });
      expect(fill.style.transform).toBe("scaleX(0.5)");
    });
  });

  describe("Navbar", () => {
    it("uses scroll-driven CSS backdrop without scroll listeners when supported", () => {
      stubScrollTimelineSupport(true);
      const addSpy = vi.spyOn(window, "addEventListener");
      const onRender = vi.fn();

      const { container } = render(
        <Profiler id="navbar-css" onRender={onRender}>
          <Navbar />
        </Profiler>
      );

      const header = container.querySelector("header")!;
      expect(header.classList.contains("navbar-scroll-driven")).toBe(true);
      expect(header.classList.contains("bg-transparent")).toBe(true);
      expect(
        addSpy.mock.calls.filter(([event]) => event === "scroll")
      ).toHaveLength(0);

      const commitCountAfterMount = onRender.mock.calls.length;
      act(() => {
        Object.defineProperty(window, "scrollY", {
          value: 100,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("scroll"));
      });
      expect(onRender.mock.calls.length).toBe(commitCountAfterMount);
    });

    it("falls back to the JS scroll listener when scroll-driven CSS is unsupported", () => {
      stubScrollTimelineSupport(false);
      const { container } = render(<Navbar />);
      const header = container.querySelector("header")!;

      expect(header.classList.contains("navbar-scroll-driven")).toBe(false);
      expect(header.classList.contains("bg-transparent")).toBe(true);
      expect(header.classList.contains("py-5")).toBe(true);

      act(() => {
        Object.defineProperty(window, "scrollY", {
          value: 40,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("scroll"));
      });
      expect(header.classList.contains("bg-[#0d0e11]/95")).toBe(true);
      expect(header.classList.contains("backdrop-blur-xl")).toBe(true);
      expect(header.classList.contains("border-b")).toBe(true);
      expect(header.classList.contains("py-3")).toBe(true);

      act(() => {
        Object.defineProperty(window, "scrollY", {
          value: 0,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("scroll"));
      });
      expect(header.classList.contains("bg-transparent")).toBe(true);
      expect(header.classList.contains("py-5")).toBe(true);
    });
  });

  describe("app/globals.css scroll-driven contract", () => {
    it("gates compositor-only scroll-timeline rules behind @supports", () => {
      const css = fs.readFileSync(
        path.resolve(process.cwd(), "app/globals.css"),
        "utf-8"
      );

      expect(css).toMatch(
        /@supports\s*\(\s*animation-timeline:\s*scroll\(\)\s*\)/
      );
      expect(css).toContain(".reading-progress-fill");
      expect(css).toContain(".navbar-scroll-driven::before");
      expect(css).toMatch(/animation-timeline:\s*scroll\(root block\)/);
      expect(css).toMatch(/animation-range:\s*0px 20px/);

      const progressKeyframe =
        /@keyframes reading-progress-scale\s*\{([\s\S]*?\})\s*\}/.exec(
          css
        )?.[1] ?? "";
      expect(progressKeyframe).toContain("transform: scaleX(0)");
      expect(progressKeyframe).toContain("transform: scaleX(1)");

      const navbarKeyframe =
        /@keyframes navbar-backdrop-reveal\s*\{([\s\S]*?\})\s*\}/.exec(
          css
        )?.[1] ?? "";
      expect(navbarKeyframe).toContain("opacity: 0");
      expect(navbarKeyframe).toContain("opacity: 1");
    });
  });
});
