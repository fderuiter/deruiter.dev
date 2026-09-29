// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  prefersReducedMotion,
  resolveScrollBehavior,
  scrollToElement,
} from "@/lib/scroll";
import { useScrollToAnchor } from "@/hooks/useScrollToAnchor";
import { SkipToContent } from "@/components/SkipToContent";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

function addTarget(tag: string, id: string): HTMLElement {
  const el = document.createElement(tag);
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

function resetHash() {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

describe("scrollToElement", () => {
  beforeEach(() => {
    stubReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    resetHash();
  });

  it("scrolls smoothly to the start of the target by default", () => {
    const section = addTarget("section", "results");

    expect(scrollToElement("results")).toBe(section);
    expect(section.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("scrolls instantly when the reader prefers reduced motion", () => {
    stubReducedMotion(true);
    const section = addTarget("section", "results");

    scrollToElement(section);

    expect(prefersReducedMotion()).toBe(true);
    expect(section.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("leaves a non-smooth behavior alone and treats a missing matchMedia as no preference", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(prefersReducedMotion()).toBe(false);
    expect(resolveScrollBehavior()).toBe("smooth");
    expect(resolveScrollBehavior("instant")).toBe("instant");
  });

  it("returns null and does nothing when the target does not exist", () => {
    const pushState = vi.spyOn(window.history, "pushState");

    expect(scrollToElement("missing", { updateHash: "push" })).toBeNull();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("focuses a non-focusable target with a temporary tabindex and preventScroll", () => {
    const section = addTarget("section", "results");
    const focus = vi.spyOn(section, "focus");

    scrollToElement("results");

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(section);
    expect(section.getAttribute("tabindex")).toBe("-1");

    section.blur();
    expect(section.hasAttribute("tabindex")).toBe(false);
  });

  it("keeps a tabindex the target already declares", () => {
    const main = addTarget("main", "main-content");
    main.tabIndex = -1;

    scrollToElement(main);
    main.blur();

    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("does not add a tabindex to a natively focusable target", () => {
    const button = addTarget("button", "action");

    scrollToElement(button);

    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute("tabindex")).toBe(false);
  });

  it("skips focus when asked to", () => {
    const section = addTarget("section", "results");

    scrollToElement(section, { focus: false });

    expect(document.activeElement).not.toBe(section);
    expect(section.hasAttribute("tabindex")).toBe(false);
  });

  it("leaves the URL alone unless a hash mode is requested", () => {
    addTarget("section", "results");

    scrollToElement("results");

    expect(window.location.hash).toBe("");
  });

  it("pushes the hash once and does not duplicate an unchanged entry", () => {
    addTarget("section", "results");
    const pushState = vi.spyOn(window.history, "pushState");

    scrollToElement("results", { updateHash: "push" });
    scrollToElement("results", { updateHash: "push" });

    expect(window.location.hash).toBe("#results");
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("replaces the hash without adding a history entry", () => {
    addTarget("section", "results");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");

    scrollToElement("results", { updateHash: "replace" });

    expect(window.location.hash).toBe("#results");
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });
});

function AnchorHarness({ onNavigate }: { onNavigate: (id: string) => void }) {
  const scrollToAnchor = useScrollToAnchor({ onNavigate });
  return (
    <a href="#results" onClick={(e) => scrollToAnchor(e, "results")}>
      Jump to results
    </a>
  );
}

describe("useScrollToAnchor", () => {
  beforeEach(() => {
    stubReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    resetHash();
  });

  it("handles a plain click in page and moves focus to the target", () => {
    const section = addTarget("section", "results");
    const onNavigate = vi.fn();
    render(<AnchorHarness onNavigate={onNavigate} />);
    const link = screen.getByRole("link", { name: "Jump to results" });

    const notCancelled = fireEvent.click(link);

    expect(notCancelled).toBe(false);
    expect(onNavigate).toHaveBeenCalledWith("results");
    expect(section.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement).toBe(section);
  });

  it.each([
    ["meta", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
  ])("leaves a %s-click to the browser", (_name, modifiers) => {
    const section = addTarget("section", "results");
    const onNavigate = vi.fn();
    render(<AnchorHarness onNavigate={onNavigate} />);
    const link = screen.getByRole("link", { name: "Jump to results" });
    // jsdom would otherwise try to navigate when the default is not prevented.
    link.addEventListener("click", (e) => e.preventDefault());

    fireEvent.click(link, modifiers);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(section.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("SkipToContent on the shared primitive", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("jumps to main content without animating under reduced motion", () => {
    stubReducedMotion(true);
    const main = addTarget("main", "main-content");
    main.tabIndex = -1;
    render(<SkipToContent />);

    screen.getByRole("link", { name: "Skip to main content" }).click();

    expect(main.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(document.activeElement).toBe(main);
  });
});
