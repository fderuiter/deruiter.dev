// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { RichNarrative } from "@/components/RichNarrative";
import { extractAndInjectHeadings, type HeadingItem } from "@/lib/blog/headings";

describe("TableOfContents Component (Ticket #1058)", () => {
  const headings: HeadingItem[] = [
    { id: "the-challenge", text: "The Challenge: Memory Exhaustion", level: 2 },
    { id: "streaming-xml", text: "Streaming XML Tokenization", level: 3 },
    { id: "enforcing-sdtm", text: "Enforcing SDTM Conformance", level: 2 },
  ];

  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    // Mock IntersectionObserver
    const mockIntersectionObserver = vi.fn(function (
      this: Record<string, unknown>,
      _callback: IntersectionObserverCallback
    ) {
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
    });
    vi.stubGlobal("IntersectionObserver", mockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders navigation list with heading links", () => {
    render(<TableOfContents headings={headings} />);

    const nav = screen.getByRole("navigation", { name: /table of contents/i });
    expect(nav).toBeDefined();

    expect(screen.getByText("The Challenge: Memory Exhaustion")).toBeDefined();
    expect(screen.getByText("Streaming XML Tokenization")).toBeDefined();
    expect(screen.getByText("Enforcing SDTM Conformance")).toBeDefined();
  });

  it("returns null when headings count is less than 2", () => {
    const singleHeading: HeadingItem[] = [
      { id: "intro", text: "Introduction", level: 2 },
    ];
    const { container } = render(<TableOfContents headings={singleHeading} />);
    expect(container.firstChild).toBeNull();
  });

  it("indents h3 headings relative to h2 headings", () => {
    render(<TableOfContents headings={headings} />);

    const h3Link = screen.getByText("Streaming XML Tokenization").closest("a");
    expect(h3Link?.className).toContain("pl-4");
  });

  it("allows toggling mobile collapsible menu", () => {
    const { container } = render(<TableOfContents headings={headings} />);

    const toggleButton = screen.getByRole("button", {
      name: /toggle table of contents/i,
    });
    const linkGroup = container.querySelector("#blog-toc-links");

    expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
    expect(toggleButton.getAttribute("aria-controls")).toBe("blog-toc-links");
    expect(linkGroup?.className).toContain("hidden");

    fireEvent.click(toggleButton);
    expect(toggleButton.getAttribute("aria-expanded")).toBe("true");
    expect(linkGroup?.className).toContain("block");

    fireEvent.click(toggleButton);
    expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
    expect(linkGroup?.className).toContain("hidden");
  });

  it("tracks and navigates live headings after RichNarrative replaces server HTML", async () => {
    const source = `
      <h2>Audit trail</h2>
      <p>Preserve the sequence of evidence.</p>
      <h3>Evidence retention</h3>
      <ol><li>Keep the original record.</li></ol>
      <h2>Audit trail</h2>
      <pre><code class="language-typescript">const retained = true;</code></pre>
    `;
    const processed = extractAndInjectHeadings(source);
    const renderReader = () => (
      <>
        <TableOfContents headings={processed.headings} />
        <article>
          <RichNarrative html={processed.html} />
        </article>
      </>
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(renderReader());
    document.body.appendChild(host);

    const firstId = processed.headings[0].id;
    const secondId = processed.headings[1].id;
    const duplicateId = processed.headings[2].id;
    const serverHeading = host.querySelector<HTMLElement>(`[id="${firstId}"]`);
    const pendingFrames: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, renderReader());
      });

      await waitFor(() => {
        expect(
          host.querySelector('button[aria-label="Copy code to clipboard"]')
        ).not.toBeNull();
      });

      const firstHeading = host.querySelector<HTMLElement>(`[id="${firstId}"]`);
      const secondHeading = host.querySelector<HTMLElement>(
        `[id="${secondId}"]`
      );
      const duplicateHeading = host.querySelector<HTMLElement>(
        `[id="${duplicateId}"]`
      );

      expect(serverHeading).not.toBeNull();
      expect(firstHeading).not.toBe(serverHeading);
      expect(serverHeading?.isConnected).toBe(false);
      expect(host.querySelectorAll(`[id="${firstId}"]`)).toHaveLength(1);
      expect(host.querySelectorAll(`[id="${secondId}"]`)).toHaveLength(1);
      expect(host.querySelectorAll(`[id="${duplicateId}"]`)).toHaveLength(1);
      expect(host.querySelectorAll("article h2")).toHaveLength(2);
      expect(host.querySelectorAll("article h3")).toHaveLength(1);
      expect(host.querySelector("article ol > li")?.textContent).toBe(
        "Keep the original record."
      );

      const links = host.querySelectorAll<HTMLAnchorElement>(
        'nav[aria-label="Table of contents"] a'
      );
      expect(Array.from(links, (link) => link.getAttribute("href"))).toEqual([
        `#${firstId}`,
        `#${secondId}`,
        `#${duplicateId}`,
      ]);

      pendingFrames.splice(0).forEach((callback) => callback(0));
      vi.spyOn(firstHeading!, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 500, 600, 32)
      );
      vi.spyOn(secondHeading!, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 100, 600, 32)
      );
      vi.spyOn(duplicateHeading!, "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 600, 600, 32)
      );

      window.dispatchEvent(new Event("scroll"));
      pendingFrames.splice(0).forEach((callback) => callback(0));

      await waitFor(() => {
        expect(
          host
            .querySelector<HTMLAnchorElement>(`a[href="#${secondId}"]`)
            ?.getAttribute("aria-current")
        ).toBe("location");
      });

      const scrollIntoView = vi.fn();
      Object.defineProperty(secondHeading, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });
      fireEvent.click(
        host.querySelector<HTMLAnchorElement>(`a[href="#${secondId}"]`)!
      );

      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(
        host
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Toggle table of contents"]'
          )
          ?.getAttribute("aria-expanded")
      ).toBe("false");
      pendingFrames.splice(0).forEach((callback) => callback(0));
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(window.location.hash).toBe(`#${secondId}`);
    } finally {
      if (root) {
        await act(async () => root?.unmount());
      }
      host.remove();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
    }
  });
});
