/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

vi.mock("@/hooks/useMasonryLayout", () => ({
  useMasonryLayout: (_all: unknown, filtered: Array<{ id: string }>) => ({
    containerRef: { current: null },
    layoutState: { isReady: true, columns: [filtered] },
  }),
}));

import { CaseStudyShowcase } from "@/components/CaseStudyShowcase";
import { PersonaProvider } from "@/components/providers/PersonaProvider";

// Regression coverage for #581: the filter tab list was hardcoded to
// ["All", "TypeScript", "Python"], so real entries like Rust or "Graphic
// Design" case studies had no way to be filtered to, and the selected filter
// lived only in local useState — a browser Back from a case-study detail
// page (a fresh mount of this component) always reset it to "All".
const mockCaseStudies = [
  {
    id: "1",
    slug: "a",
    title: "Project Alpha",
    primary_language: "TypeScript",
    editorial_content: "Executive summary for Alpha",
    architectural_narrative: "Deep architecture for Alpha",
    tags: "TypeScript, React",
    published: true,
    simulated_telemetry: false,
    githubStats: null,
  },
  {
    id: "2",
    slug: "b",
    title: "Project Beta",
    primary_language: "Rust",
    editorial_content: "Executive summary for Beta",
    architectural_narrative: "Deep architecture for Beta",
    tags: "Rust, Systems",
    published: true,
    simulated_telemetry: false,
    githubStats: null,
  },
  {
    id: "3",
    slug: "c",
    title: "Project Gamma",
    primary_language: "Graphic Design",
    editorial_content: "Executive summary for Gamma",
    architectural_narrative: "Deep architecture for Gamma",
    tags: "Design, UI",
    published: true,
    simulated_telemetry: false,
    githubStats: null,
  },
] as any;

describe("CaseStudyShowcase filtering (#581)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.history.replaceState(null, "", "/case-studies");
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

  it("derives filter tabs from the actual case-study collection, not a hardcoded list", async () => {
    await act(async () => {
      root.render(<CaseStudyShowcase caseStudies={mockCaseStudies} />);
    });

    const tabLabels = Array.from(container.querySelectorAll("button")).map(
      (b) => b.textContent
    );
    expect(tabLabels.some((t) => t?.includes("RUST"))).toBe(true);
    expect(tabLabels.some((t) => t?.includes("GRAPHIC DESIGN"))).toBe(true);
  });

  it("restores the selected filter from the URL hash instead of always defaulting to All", async () => {
    window.history.replaceState(null, "", "/case-studies#lang=Rust");

    await act(async () => {
      root.render(<CaseStudyShowcase caseStudies={mockCaseStudies} />);
    });

    // Only the Rust study's card should render.
    expect(container.textContent).not.toContain("No projects found");
    const rustTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("RUST")
    );
    expect(rustTab?.className).toContain("text-brand-cyan");
  });

  it("writes the selected filter into the URL hash (via replaceState) so Back restores it", async () => {
    await act(async () => {
      root.render(<CaseStudyShowcase caseStudies={mockCaseStudies} />);
    });

    const rustTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("RUST")
    );
    expect(rustTab).toBeTruthy();

    await act(async () => {
      rustTab!.click();
    });

    expect(window.location.hash).toBe("#lang=Rust");
  });

  it("clears the URL hash filter param when All Projects is selected", async () => {
    window.history.replaceState(null, "", "/case-studies#lang=Rust");

    await act(async () => {
      root.render(<CaseStudyShowcase caseStudies={mockCaseStudies} />);
    });

    const allTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("ALL PROJECTS")
    );
    await act(async () => {
      allTab!.click();
    });

    expect(window.location.hash).toBe("");
  });

  // #1755: a tablist must own role=tab children (axe aria-required-children).
  // These are toggle filters, not tabs that switch panels, so they are a
  // labelled group of aria-pressed buttons.
  it("exposes the persona and language filters as labelled groups of toggle buttons", async () => {
    await act(async () => {
      root.render(
        <PersonaProvider>
          <CaseStudyShowcase caseStudies={mockCaseStudies} />
        </PersonaProvider>
      );
    });

    expect(container.querySelector('[role="tablist"]')).toBeNull();
    for (const label of ["Persona view filter", "Language filter"]) {
      const group = container.querySelector(`[aria-label="${label}"]`);
      expect(group?.getAttribute("role")).toBe("group");
      const buttons = Array.from(group!.querySelectorAll("button"));
      expect(buttons.length).toBeGreaterThan(1);
      for (const button of buttons) {
        expect(button.hasAttribute("aria-pressed")).toBe(true);
      }
    }
  });

  it("includes dedicated persona filter tabs in the primary filter control bar", async () => {
    await act(async () => {
      root.render(
        <PersonaProvider>
          <CaseStudyShowcase caseStudies={mockCaseStudies} />
        </PersonaProvider>
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const buttonTexts = buttons.map((b) => b.textContent);

    expect(buttonTexts).toContain("ALL VIEWS");
    expect(buttonTexts).toContain("PROFESSIONAL / HIGHLIGHTS");
    expect(buttonTexts).toContain("BEHIND THE SCENES / ARCHITECTURE");
  });

  it("updates URL hash and persona mode when selecting Professional or Behind the Scenes tabs", async () => {
    await act(async () => {
      root.render(
        <PersonaProvider>
          <CaseStudyShowcase caseStudies={mockCaseStudies} />
        </PersonaProvider>
      );
    });

    const storyTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("BEHIND THE SCENES / ARCHITECTURE")
    );
    expect(storyTab).toBeTruthy();

    await act(async () => {
      storyTab!.click();
    });

    expect(window.location.hash).toContain("role=behind-the-scenes");

    const professionalTab = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("PROFESSIONAL / HIGHLIGHTS"));
    expect(professionalTab).toBeTruthy();

    await act(async () => {
      professionalTab!.click();
    });

    expect(window.location.hash).toContain("role=professional");
  });

  it("allows language filtering and persona filtering to operate simultaneously without state collision", async () => {
    window.history.replaceState(
      null,
      "",
      "/case-studies#role=behind-the-scenes"
    );

    await act(async () => {
      root.render(
        <PersonaProvider>
          <CaseStudyShowcase caseStudies={mockCaseStudies} />
        </PersonaProvider>
      );
    });

    const rustTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("RUST")
    );
    expect(rustTab).toBeTruthy();

    await act(async () => {
      rustTab!.click();
    });

    expect(window.location.hash).toContain("role=behind-the-scenes");
    expect(window.location.hash).toContain("lang=Rust");
  });

  it.each([
    ["technical", "BEHIND THE SCENES / ARCHITECTURE"],
    ["recruiter", "PROFESSIONAL / HIGHLIGHTS"],
  ])(
    "resolves a pre-rename #role=%s deep link to the renamed tab",
    async (legacy, label) => {
      window.history.replaceState(null, "", `/case-studies#role=${legacy}`);

      await act(async () => {
        root.render(
          <PersonaProvider>
            <CaseStudyShowcase caseStudies={mockCaseStudies} />
          </PersonaProvider>
        );
      });

      const tab = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === label
      );
      expect(tab?.getAttribute("aria-pressed")).toBe("true");
    }
  );
});
