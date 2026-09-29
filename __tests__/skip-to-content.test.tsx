import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { SkipToContent } from "@/components/SkipToContent";

describe("SkipToContent Component & Bypass Blocks", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });
  it("renders a link with href pointing to the target main content ID", () => {
    render(
      <SkipToContent targetId="main-content" label="Skip to main content" />
    );
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("#main-content");
  });

  it("focuses and scrolls target element into view on click", () => {
    const mainEl = document.createElement("main");
    mainEl.id = "main-content";
    mainEl.tabIndex = -1;
    mainEl.scrollIntoView = vi.fn();
    mainEl.focus = vi.fn();
    document.body.appendChild(mainEl);

    render(<SkipToContent targetId="main-content" />);
    const link = screen.getByRole("link", { name: "Skip to main content" });

    link.click();

    expect(mainEl.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(mainEl.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    document.body.removeChild(mainEl);
  });
});
