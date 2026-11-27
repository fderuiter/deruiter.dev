// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CaseStudyBentoCard } from "@/components/ui/CaseStudyBentoCard";
import { TerminologyProvider } from "@/components/providers/TerminologyProvider";
import { TerminologyToggle } from "@/components/TerminologyToggle";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

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

describe("CaseStudyBentoCard Inline Terminology Parsing Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  const mockStudy = {
    ...FALLBACK_CASE_STUDIES[0],
    editorial_content:
      "Lead architect for GxP compliant eCRF systems with Node.js and XML data.",
    githubStats: null,
  };

  it("renders canonical terminology strings by default when simplified mode is inactive", async () => {
    await act(async () => {
      root.render(
        <TerminologyProvider>
          <CaseStudyBentoCard study={mockStudy} />
        </TerminologyProvider>
      );
    });

    const cardText = container.textContent || "";
    // Canonical terms should be visible
    expect(cardText).toContain("GxP");
    expect(cardText).toContain("eCRF");
    expect(cardText).toContain("Node.js");
    expect(cardText).toContain("XML");

    // Simplified terms should NOT be visible
    expect(cardText).not.toContain("Quality Standard");
    expect(cardText).not.toContain("electronic forms");
  });

  it("dynamically updates terminology text across pitch card mode when toggling simplified mode", async () => {
    await act(async () => {
      root.render(
        <TerminologyProvider>
          <TerminologyToggle />
          <CaseStudyBentoCard study={mockStudy} />
        </TerminologyProvider>
      );
    });

    // Before toggle: Canonical terms
    expect(container.textContent).toContain("GxP");
    expect(container.textContent).toContain("eCRF");

    // Click toggle button to switch to simplified mode
    const toggleButton = container.querySelector("button")!;
    await act(async () => {
      toggleButton.click();
    });

    // After toggle: Simplified terms dynamically replace canonical jargon
    const updatedCardText = container.textContent || "";
    expect(updatedCardText).toContain("industry-standard");
    expect(updatedCardText).toContain("digital case report form");
    expect(updatedCardText).not.toContain("GxP");
    expect(updatedCardText).not.toContain("eCRF");
  });

  it("supports terminology translation in reality card mode", async () => {
    const realityStudy = {
      ...mockStudy,
      slug: "cadence-clinical",
    };

    await act(async () => {
      root.render(
        <TerminologyProvider>
          <TerminologyToggle />
          <CaseStudyBentoCard study={realityStudy} />
        </TerminologyProvider>
      );
    });

    // Switch card to THE REALITY mode
    const realityButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("THE REALITY")
    )!;

    await act(async () => {
      realityButton.click();
    });

    // Canonical check in reality mode
    expect(container.textContent).toContain("eCRF");

    // Toggle terminology to simplified mode
    const toggleButton =
      Array.from(container.querySelectorAll("button")).find(
        (b) =>
          b.getAttribute("aria-label")?.includes("Terminology") ||
          b.textContent?.includes("Mode") ||
          b.getAttribute("title")?.includes("Terminology")
      ) || container.querySelector("button")!;

    await act(async () => {
      toggleButton.click();
    });

    // Simplified check in reality mode ("eCRF" -> "digital case report form")
    const updatedText = container.textContent || "";
    expect(updatedText).toContain("digital case report form");
    expect(updatedText).not.toContain("eCRF orchestrator");
  });

  it("preserves markdown formatting (bold, code, italic) alongside parsed terms", async () => {
    const formattedStudy = {
      ...mockStudy,
      editorial_content:
        "**GxP compliant** eCRF with `node index.js` and *SAX streaming*.",
    };

    await act(async () => {
      root.render(
        <TerminologyProvider>
          <CaseStudyBentoCard study={formattedStudy} />
        </TerminologyProvider>
      );
    });

    const strongEl = container.querySelector("strong");
    const codeEl = container.querySelector("code");
    const emEl = container.querySelector("em");

    expect(strongEl).not.toBeNull();
    expect(strongEl?.textContent).toContain("GxP compliant");

    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toContain("node index.js");

    expect(emEl).not.toBeNull();
    expect(emEl?.textContent).toContain("SAX streaming");
  });

  it("does not render raw HTML markup tags or escaped string literals", async () => {
    const rawTagStudy = {
      ...mockStudy,
      editorial_content:
        'Lead for <span data-key="ecrf" data-term="electronic forms" data-definition="def">eCRF &amp; GxP</span> systems.',
    };

    await act(async () => {
      root.render(
        <TerminologyProvider>
          <CaseStudyBentoCard study={rawTagStudy} />
        </TerminologyProvider>
      );
    });

    const innerHTML = container.innerHTML;
    // Ensure no literal '<span data-key' is visible as escaped text
    expect(innerHTML).not.toContain("&lt;span");
    expect(innerHTML).not.toContain("data-key=");
    expect(container.textContent).not.toContain("<span");
    expect(container.textContent).not.toContain("data-key");
    expect(container.textContent).not.toContain("&amp;");
    expect(container.textContent).toContain("&");
  });
});
