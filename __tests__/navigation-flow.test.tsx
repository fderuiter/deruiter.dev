// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { Footer } from "@/components/Footer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/arcade/laser-loon",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

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
      playHover: vi.fn(),
      playSubmit: vi.fn(),
      playSuccess: vi.fn(),
      playError: vi.fn(),
      playAutocomplete: vi.fn(),
    }),
  };
});

describe("Navigation Flow Components Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe("<Breadcrumbs />", () => {
    it("renders semantic breadcrumb navigation with home and active page", async () => {
      await act(async () => {
        root.render(
          <Breadcrumbs
            items={[
              { label: "Arcade Hub", href: "/arcade" },
              { label: "Laser Loon" },
            ]}
          />
        );
      });

      const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
      expect(nav).not.toBeNull();

      expect(container.textContent).toContain("Home");
      expect(container.textContent).toContain("Arcade Hub");
      expect(container.textContent).toContain("Laser Loon");

      const activeItem = container.querySelector('[aria-current="page"]');
      expect(activeItem).not.toBeNull();
      expect(activeItem?.textContent).toBe("Laser Loon");
    });
  });

  describe("<NextPrevNav />", () => {
    it("renders previous, next, and back-to-hub targets", async () => {
      await act(async () => {
        root.render(
          <NextPrevNav
            prev={{
              title: "Working With Duck",
              href: "/arcade/working-with-duck",
              label: "Previous Game",
              tag: "Pet Simulation",
            }}
            next={{
              title: "Quasi-Perfect Puzzler",
              href: "/arcade/quasi-puzzler",
              label: "Next Game",
              tag: "Formal Logic",
            }}
            backToHub={{
              title: "All Arcade Games",
              href: "/arcade",
            }}
          />
        );
      });

      expect(container.textContent).toContain("Working With Duck");
      expect(container.textContent).toContain("Quasi-Perfect Puzzler");
      expect(container.textContent).toContain("All Arcade Games");
      expect(container.textContent).toContain("Pet Simulation");
      expect(container.textContent).toContain("Formal Logic");
    });
  });

  describe("<Footer />", () => {
    it("renders categorized navigation links, live operational status, and back to top", async () => {
      const scrollSpy = vi.fn();
      window.scrollTo = scrollSpy;

      await act(async () => {
        root.render(<Footer />);
      });

      expect(container.textContent).toContain("FDERUITER");
      expect(container.textContent).toContain("Explore the projects");

      // Arcade links
      expect(container.textContent).toContain("Arcade ↗");
      expect(container.textContent).toContain("Laser Loon");
      expect(container.textContent).toContain("Quasi-Puzzler");
      expect(container.textContent).toContain("Monkey C Mayhem");

      // Systems links
      expect(container.textContent).toContain("Proof Workspace");
      expect(container.textContent).toContain("NeuroRecon Studio");
      expect(container.textContent).toContain("Incident Simulator");

      // Connect links & Newsletter
      expect(container.textContent).toContain("Book a Chat ↗");
      expect(container.textContent).toContain("Contact ↗");
      expect(container.textContent).toContain("Project Notes");
      expect(container.textContent).not.toContain("fpderuiter@gmail.com");

      // Back to top button
      const backToTopBtn = container.querySelector(
        'button[aria-label="Scroll back to top of page"]'
      );
      expect(backToTopBtn).not.toBeNull();

      act(() => {
        (backToTopBtn as HTMLButtonElement).click();
      });

      expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
  });
});
