// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Hero } from "@/components/Hero";
import { TextReveal } from "@/components/TextReveal";

const mockUseReducedMotion = vi.fn().mockReturnValue(false);
vi.mock("framer-motion", async (importOriginal) => {
  const original = await importOriginal<typeof import("framer-motion")>();
  return {
    ...original,
    useReducedMotion: () => mockUseReducedMotion(),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// Mock AnimatedGridPattern
vi.mock("@/components/AnimatedGridPattern", () => ({
  AnimatedGridPattern: () => <div data-testid="animated-grid-pattern" />,
}));

describe("[UI/UX 01] Homepage First Impression & Architectural Hierarchy Suite", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Hero Value Copy & Grounded Editorial Positioning", () => {
    it("uses the approved location caption in the existing desktop-only cue", () => {
      render(<Hero />);

      const locationCaption = screen.getByText("LOC: Minneapolis");
      expect(locationCaption.parentElement?.className).toContain(
        "hidden lg:flex"
      );
      expect(screen.queryByText("LOC: ROCHESTER & NYC")).toBeNull();
    });

    it("renders the clear, grounded headline and intro without exaggerated absolute claims", () => {
      render(<Hero />);

      // Headline and identity badge
      expect(
        screen.getByText(/FREDERICK DE RUITER \/ SOFTWARE & SYSTEMS/i)
      ).toBeDefined();
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /Hi, I’m Fred\. I make complicated things usable\./i,
        })
      ).toBeDefined();

      // Semantic heading presentation maintains consistent editorial typography (#817, ADR 0052)
      const headingElement = screen.getByRole("heading", { level: 1 });
      expect(headingElement.className).toContain("heading-editorial");

      // Intro text: single authentic semantic body layer (#817, ADR 0052)
      const introText = document.querySelector('[data-pretext-layer="body"]');
      expect(introText).not.toBeNull();
      expect(introText?.textContent).toContain(
        "My background is in clinical research"
      );

      // Invariant telemetry badges state honest scope rather than absolute claims
      expect(screen.queryByText(/TRY THE DEMOS/i)).toBeNull();
      expect(screen.getByText(/CLINICAL OPERATIONS EXPERIENCE/i)).toBeDefined();
      expect(screen.getByText(/SOURCE ON GITHUB/i)).toBeDefined();

      // Absolutes must not be present
      const heroContainer = document.getElementById("hero");
      const textContent = heroContainer?.textContent || "";
      expect(textContent).not.toContain("ZERO LATENCY");
      expect(textContent).not.toContain("ZERO BLOAT");
      expect(textContent).not.toContain("ZERO JARGON GUARANTEE");
      expect(textContent).not.toContain("doesn't break");
    });

    it("presents one clear primary action pointing directly to case studies", () => {
      render(<Hero />);

      const primaryCta = screen.getByRole("link", { name: /Explore my work/i });
      expect(primaryCta.getAttribute("href")).toBe("#case-studies");
      expect(primaryCta.className).toContain("bg-amber-400");
      expect(primaryCta.className).toContain("min-h-[48px]");
      expect(primaryCta.className).toContain("focus-visible:ring-2");
      expect(primaryCta.className).toContain("focus-visible:ring-amber-400");
    });

    it("pairs secondary actions with visible focus rings, minimum touch heights, and accessible labels", () => {
      render(<Hero />);

      const arcadeLink = screen.getByRole("link", { name: /Arcade & Labs/i });
      expect(arcadeLink.getAttribute("href")).toBe("/arcade");
      expect(arcadeLink.className).toContain("min-h-[44px]");
      expect(arcadeLink.className).toContain("focus-visible:ring-amber-400");

      const githubLink = screen.getByRole("link", { name: /GitHub/i });
      expect(githubLink.getAttribute("href")).toBe(
        "https://github.com/fderuiter"
      );
      expect(githubLink.className).toContain("min-h-[44px]");
      expect(githubLink.className).toContain("focus-visible:ring-amber-400");
    });
  });

  describe("2. Hero Duck BioSpotlight", () => {
    it("shows the Duck growth story in place of the sample engineering demos", () => {
      render(<Hero />);

      expect(screen.getByTestId("bio-spotlight")).toBeDefined();
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /Meet Duck: From 8-Week Fluff to 80-lb Marshmallow/i,
        })
      ).toBeDefined();
      expect(screen.queryByText(/A FEW THINGS TO TRY/i)).toBeNull();
      expect(screen.queryByText(/ONE SMALL LOGIC PROOF/i)).toBeNull();
      expect(screen.queryByText(/TRY THE CONTROLS · NO LIVE DATA/i)).toBeNull();
    });

    it("keeps the milestone controls labeled, focusable, and large enough to tap", () => {
      render(<Hero />);

      const milestoneGroup = screen.getByRole("group", {
        name: /Photo growth milestones/i,
      });
      const milestoneButtons = milestoneGroup.querySelectorAll("button");
      expect(milestoneButtons.length).toBe(6);

      for (const button of milestoneButtons) {
        expect(button.getAttribute("aria-label")).toMatch(/milestone/i);
        expect(button.className).toContain("min-h-11");
        expect(button.className).toContain("focus-visible:ring-2");
      }
      expect(milestoneButtons[0].getAttribute("aria-pressed")).toBe("true");

      for (const name of [
        /Previous co-pilot milestone photo/i,
        /Next co-pilot milestone photo/i,
      ]) {
        const navigationButton = screen.getByRole("button", { name });
        expect(navigationButton.className).toContain("min-h-11");
        expect(navigationButton.className).toContain("focus-visible:ring-2");
      }
    });
  });

  describe("3. Philosophy TextReveal & Reduced Motion Governance", () => {
    it("renders readable text content in the philosophy statement with standard section padding", () => {
      const statement =
        "Good software makes complexity understandable. I build for the people who depend on it, and the details that earn their trust.";
      const { container } = render(<TextReveal>{statement}</TextReveal>);

      expect(container.textContent).toContain(
        "Good software makes complexity understandable"
      );
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.className).toContain("py-16");
      expect(rootDiv.className).not.toContain("h-[100vh]");
      expect(rootDiv.className).not.toContain("h-[75vh]");
      expect(rootDiv.className).not.toContain("xl:lg-3");
    });

    it("honors reduced motion by rendering a calm static layout with identical section rhythm", () => {
      mockUseReducedMotion.mockReturnValue(true);

      const statement =
        "Good software makes complexity understandable. I build for the people who depend on it, and the details that earn their trust.";
      const { container } = render(<TextReveal>{statement}</TextReveal>);

      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.className).not.toContain("h-[100vh]");
      expect(rootDiv.className).not.toContain("h-[75vh]");
      expect(rootDiv.className).toContain("py-16");
    });
  });
});
