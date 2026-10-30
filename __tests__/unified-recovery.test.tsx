// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Configure React 19 act environment
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SearchProvider, useSearch } from "@/components/providers/SearchProvider";
import { AudioProvider } from "@/components/providers/AudioProvider";
const MockRetroLabyrinth = () => <div>SYSTEM_LABYRINTH.EXE</div>;

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamic(props: Record<string, unknown>) {
      return React.createElement(MockRetroLabyrinth, props);
    };
  },
}));

import { UnifiedErrorLayout } from "@/components/UnifiedErrorLayout";

describe("SearchProvider & useSearch Context", () => {
  it("should throw an error when useSearch is used outside of a SearchProvider", () => {
    expect(() => {
      useSearch();
    }).toThrow();
  });

  it("should export UnifiedErrorLayout and make it available", () => {
    expect(UnifiedErrorLayout).toBeDefined();
    expect(typeof UnifiedErrorLayout).toBe("function");
  });
});

describe("UnifiedErrorLayout JSDOM state and interactivity", () => {
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

    // Mock global fetch to return clean responses and prevent error logs
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/case-studies")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: "1", slug: "clinical-mapper", title: "Clinical Mapper", primary_language: "Python", tags: "Clinical" }
          ])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    }));
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders with badge, title and description", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <UnifiedErrorLayout
              badge="TEST_BADGE"
              title="Test Title"
              description="Test description text"
              showRetroLabyrinth={false}
            />
          </SearchProvider>
        </AudioProvider>
      );
    });

    expect(container.textContent).toContain("TEST_BADGE");
    expect(container.textContent).toContain("Test Title");
    expect(container.textContent).toContain("Test description text");
    expect(container.textContent).not.toContain("SYSTEM_LABYRINTH.EXE");
  });

  it("renders Insert Coin preview initially when showRetroLabyrinth is true and activates RetroLabyrinth upon interaction", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <UnifiedErrorLayout
              badge="TEST_BADGE"
              title="Test Title"
              description="Test description text"
              showRetroLabyrinth={true}
            />
          </SearchProvider>
        </AudioProvider>
      );
    });

    // Check preview graphic prompt is rendered initially
    expect(container.textContent).toContain("INSERT COIN");
    expect(container.textContent).toContain("HOVER OR CLICK TO LAUNCH MINI-GAME");

    const preview = container.querySelector('[data-testid="insert-coin-preview"]') as HTMLDivElement;
    expect(preview).not.toBeNull();

    // Trigger hover interaction to dynamically activate the game
    await act(async () => {
      preview.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });

    // Verify game component is mounted after activation
    expect(container.textContent).toContain("SYSTEM_LABYRINTH.EXE");
  });

  it("focuses on the search button when clicked", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <UnifiedErrorLayout
              badge="TEST_BADGE"
              title="Test Title"
              description="Test description text"
              showRetroLabyrinth={false}
            />
          </SearchProvider>
        </AudioProvider>
      );
    });

    const searchButton = container.querySelector("button") as HTMLButtonElement;
    expect(searchButton).toBeDefined();
    expect(searchButton.textContent).toBe("Search Site");

    await act(async () => {
      searchButton.click();
    });

    // Check if the search button becomes the focused element
    expect(document.activeElement).toBe(searchButton);
  });

  it("derives client canonical URL and displays requested invalid path once mounted", async () => {
    const originalLocation = window.location;
    vi.stubGlobal("location", {
      ...originalLocation,
      href: "https://example.com/missing-test-path",
      pathname: "/missing-test-path",
      origin: "https://example.com",
    });

    await act(async () => {
      root = createRoot(container);
      root.render(
        <AudioProvider>
          <SearchProvider>
            <UnifiedErrorLayout
              badge="TEST_BADGE"
              title="Test Title"
              description="Test description text"
            />
          </SearchProvider>
        </AudioProvider>
      );
    });

    // Check invalid requested path is rendered on mount
    expect(container.textContent).toContain("Requested Address");
    expect(container.textContent).toContain("/missing-test-path");

    // Check canonical link matches client window location href
    const canonicalLink = document.head.querySelector('link[rel="canonical"]');
    expect(canonicalLink?.getAttribute("href")).toBe(
      "https://example.com/missing-test-path"
    );
  });
});

