/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { CardTitle, type HeadingTag } from "@/components/BentoGrid";
import { PretextCard } from "@/components/PretextCard";
import { CaseStudyBentoCard } from "@/components/ui/CaseStudyBentoCard";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

// Mock ResizeObserver and IntersectionObserver
global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock useAudio hook as done in case-studies-page.test.tsx
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

describe("Polymorphic CardTitle Heading Configuration", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Base CardTitle Component", () => {
    it("renders as h3 by default", () => {
      render(<CardTitle>Test Default Title</CardTitle>);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeDefined();
      expect(heading.tagName.toLowerCase()).toBe("h3");
      expect(heading.textContent).toBe("Test Default Title");
    });

    it("renders h1-h6 when valid heading tag is passed as the 'as' prop", () => {
      const headingLevels: HeadingTag[] = ["h1", "h2", "h3", "h4", "h5", "h6"];
      headingLevels.forEach((level) => {
        const { unmount } = render(
          <CardTitle as={level}>Level {level}</CardTitle>
        );
        const levelNum = parseInt(level[1]);
        const heading = screen.getByRole("heading", { level: levelNum });
        expect(heading).toBeDefined();
        expect(heading.tagName.toLowerCase()).toBe(level);
        unmount();
      });
    });

    it("falls back to h3 when invalid/non-heading tag is passed", () => {
      render(<CardTitle as="div">Fallback Test</CardTitle>);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeDefined();
      expect(heading.tagName.toLowerCase()).toBe("h3");
    });

    it("falls back to h3 when arbitrary string or unsupported tag is passed", () => {
      render(<CardTitle as="section">Fallback Test</CardTitle>);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeDefined();
      expect(heading.tagName.toLowerCase()).toBe("h3");
    });

    it("preserves Tailwind transition classes and hover styling", () => {
      render(<CardTitle as="h2">Style Check</CardTitle>);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.className).toContain("font-heading");
      expect(heading.className).toContain("font-bold");
      expect(heading.className).toContain("text-neutral-100");
      expect(heading.className).toContain("group-hover:text-accent");
      expect(heading.className).toContain("transition-colors");
    });

    it("applies margin spacing to avoid browser margin collapsing", () => {
      render(<CardTitle as="h4">Margin Check</CardTitle>);
      const heading = screen.getByRole("heading", { level: 4 });
      expect(heading.className).toContain("my-2");
    });
  });

  describe("PretextCard Integration", () => {
    it("renders nested CardTitle as h3 by default", () => {
      render(
        <PretextCard title="Pretext Title" description="Some Description" />
      );
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeDefined();
      expect(heading.textContent).toBe("Pretext Title");
    });

    it("renders alternative heading tag h4 when headingTag prop is specified", () => {
      render(
        <PretextCard
          title="Pretext Title"
          description="Some Description"
          headingTag="h4"
        />
      );
      const heading = screen.getByRole("heading", { level: 4 });
      expect(heading).toBeDefined();
      expect(heading.tagName.toLowerCase()).toBe("h4");
    });
  });

  describe("CaseStudyBentoCard Integration", () => {
    const mockStudy = {
      ...FALLBACK_CASE_STUDIES[0],
      githubStats: null,
    };

    it("renders nested CardTitle as h3 by default", () => {
      render(<CaseStudyBentoCard study={mockStudy} />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeDefined();
      expect(heading.textContent).toBe(mockStudy.title);
    });

    it("renders alternative heading tag h5 when headingTag prop is specified", () => {
      render(<CaseStudyBentoCard study={mockStudy} headingTag="h5" />);
      const heading = screen.getByRole("heading", { level: 5 });
      expect(heading).toBeDefined();
      expect(heading.tagName.toLowerCase()).toBe("h5");
    });

    it("maintains its custom extra-bold styling and classes on alternative heading levels", () => {
      render(<CaseStudyBentoCard study={mockStudy} headingTag="h2" />);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.className).toContain("font-extrabold");
      expect(heading.className).toContain("text-base");
      expect(heading.className).toContain("tracking-tight");
    });
  });
});
