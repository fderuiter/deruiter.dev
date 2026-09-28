// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Configure React 19 act environment
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SearchProvider } from "@/components/providers/SearchProvider";
import { AudioProvider } from "@/components/providers/AudioProvider";
import NotFound from "@/app/not-found";
import CaseStudyNotFound from "@/app/desktop/case-studies/[slug]/not-found";

const MockRetroLabyrinth = () => <div>SYSTEM_LABYRINTH.EXE</div>;

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamic(props: Record<string, unknown>) {
      return React.createElement(MockRetroLabyrinth, props);
    };
  },
}));

describe("NotFound component & dynamic metadata hoisting", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
      get length() {
        return storage.size;
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      })
    );

    // Mock window.location and NEXT_PUBLIC_APP_URL dynamically
    const testAppUrl = "https://my-custom-test-domain.com";
    vi.stubEnv("NEXT_PUBLIC_APP_URL", testAppUrl);

    const originalLocation = window.location;
    vi.stubGlobal("location", {
      ...originalLocation,
      href: `${testAppUrl}/some-broken-path`,
      pathname: "/some-broken-path",
      origin: testAppUrl,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    // Clean up hoisted elements in head
    const robots = document.head.querySelectorAll('meta[name="robots"]');
    robots.forEach((el) => el.remove());
    const canonicals = document.head.querySelectorAll('link[rel="canonical"]');
    canonicals.forEach((el) => el.remove());
    document.title = "";

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dynamically hoists correct metadata robots, canonical link and page title to head", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <NotFound />
          </SearchProvider>
        </AudioProvider>
      );
    });

    // Check title updated in document head
    expect(document.title).toBe("ERROR 404 - This page wandered off.");

    // Check robots meta tag is hoisted to head
    const robotsMeta = document.head.querySelector('meta[name="robots"]');
    expect(robotsMeta).toBeDefined();
    expect(robotsMeta?.getAttribute("content")).toBe("noindex, nofollow");

    // Check canonical link tag is hoisted to head and matches window.location.href
    const canonicalLink = document.head.querySelector('link[rel="canonical"]');
    expect(canonicalLink).toBeDefined();
    expect(canonicalLink?.getAttribute("href")).toBe(
      "https://my-custom-test-domain.com/some-broken-path"
    );
  });

  it("global NotFound recovery action targets the top of primary landing page /", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <NotFound />
          </SearchProvider>
        </AudioProvider>
      );
    });

    const actionLink = container.querySelector('a[href="/"]');
    expect(actionLink).not.toBeNull();
    expect(actionLink?.textContent).toContain("Back to Home");
  });

  it("renders CaseStudyNotFound with custom badge, title, interactive retro mini-game, and /#case-studies anchor", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <CaseStudyNotFound />
          </SearchProvider>
        </AudioProvider>
      );
    });

    // Check custom case study badge, title, and description
    expect(container.textContent).toContain("CASE_NOT_FOUND");
    expect(container.textContent).toContain("Case Study Unresolved");
    expect(container.textContent).toContain(
      "The requested clinical case study narrative does not exist"
    );

    // Check retro mini-game Insert Coin preview is rendered initially
    expect(container.textContent).toContain("INSERT COIN");
    expect(container.textContent).toContain(
      "HOVER OR CLICK TO LAUNCH MINI-GAME"
    );

    const preview = container.querySelector(
      '[data-testid="insert-coin-preview"]'
    ) as HTMLDivElement;
    expect(preview).not.toBeNull();

    // Trigger hover interaction on the Insert Coin preview card to activate game
    await act(async () => {
      preview.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });

    expect(container.textContent).toContain("SYSTEM_LABYRINTH.EXE");

    // Check secondary action link targets portfolio section anchor
    const actionLink = container.querySelector('a[href="/#case-studies"]');
    expect(actionLink).not.toBeNull();
    expect(actionLink?.textContent).toContain("Return to Core Feed");

    // Check page title hoisted in head
    expect(document.title).toBe("CASE_NOT_FOUND - Case Study Unresolved");
  });
});
