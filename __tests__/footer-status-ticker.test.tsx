// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { FooterStatusTicker } from "@/components/FooterStatusTicker";
import { STATUS_TICKER_ITEMS } from "@/lib/meme-data";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Reduced motion makes the swap instant, and a pass-through AnimatePresence
// drops exiting nodes at once (jsdom never finishes exit animations), so the
// rendered DOM is the state.
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("@/hooks/useMediaQuery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useMediaQuery")>()),
  usePrefersReducedMotion: () => true,
}));

vi.mock("@/lib/meme-audio", () => ({ playMemeSound: vi.fn() }));

describe("FooterStatusTicker rotation (#952)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    global.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const line = () =>
    container.querySelector('[data-testid="footer-status-ticker"] span.block')
      ?.textContent;
  const pauseButton = () =>
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Pause ticker"]'
    )!;
  const tickerRoot = () =>
    container.querySelector<HTMLDivElement>(
      '[data-testid="footer-status-ticker"]'
    )!;

  it("rotates every 4.5s and holds its line while data-ticker-paused is set", async () => {
    await act(async () => root.render(<FooterStatusTicker />));
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[1]);

    container
      .querySelector('[data-testid="footer-status-ticker"]')!
      .setAttribute("data-ticker-paused", "true");
    await act(async () => {
      vi.advanceTimersByTime(4500 * 3);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[1]);

    container
      .querySelector('[data-testid="footer-status-ticker"]')!
      .removeAttribute("data-ticker-paused");
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[2]);
  });

  it("pauses and resumes rotation via toggle button clicks and reflects aria-pressed and data-ticker-paused attributes", async () => {
    await act(async () => root.render(<FooterStatusTicker />));
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);
    expect(pauseButton()).not.toBeNull();
    expect(pauseButton().getAttribute("type")).toBe("button");
    expect(pauseButton().getAttribute("aria-pressed")).toBe("false");
    expect(pauseButton().getAttribute("aria-label")).toBe("Pause ticker");
    expect(tickerRoot().hasAttribute("data-ticker-paused")).toBe(false);

    // Click to pause
    await act(async () => pauseButton().click());
    expect(pauseButton().getAttribute("aria-pressed")).toBe("true");
    expect(pauseButton().getAttribute("aria-label")).toBe("Pause ticker");
    expect(tickerRoot().getAttribute("data-ticker-paused")).toBe("true");

    // Rotation is suspended while paused
    await act(async () => {
      vi.advanceTimersByTime(4500 * 2);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    // Click to resume
    await act(async () => pauseButton().click());
    expect(pauseButton().getAttribute("aria-pressed")).toBe("false");
    expect(pauseButton().getAttribute("aria-label")).toBe("Pause ticker");
    expect(tickerRoot().hasAttribute("data-ticker-paused")).toBe(false);

    // Rotation resumes with a fresh interval
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[1]);
  });

  it("holds rotation while the ticker is hovered and resumes when unhovered (WCAG 2.2.2)", async () => {
    await act(async () => root.render(<FooterStatusTicker />));
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    // Mouse enters the ticker
    await act(async () => {
      fireEvent.mouseEnter(tickerRoot());
    });

    // Rotation is suspended while hovered
    await act(async () => {
      vi.advanceTimersByTime(4500 * 2);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    // Mouse leaves the ticker
    await act(async () => {
      fireEvent.mouseLeave(tickerRoot());
    });

    // Rotation resumes
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[1]);
  });

  it("holds rotation while the ticker has keyboard focus and resumes when blurred (WCAG 2.2.2)", async () => {
    await act(async () => root.render(<FooterStatusTicker />));
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    // Keyboard focus moves into the pause button
    await act(async () => {
      pauseButton().focus();
    });

    // Rotation is suspended while focused
    await act(async () => {
      vi.advanceTimersByTime(4500 * 2);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[0]);

    // Keyboard focus blurs
    await act(async () => {
      pauseButton().blur();
    });

    // Rotation resumes
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    expect(line()).toBe(STATUS_TICKER_ITEMS[1]);
  });

  const bubble = () => container.querySelector("p.font-sans");
  const duck = () =>
    container.querySelector<HTMLButtonElement>(
      'button[aria-label$="pet Duck the puppy"]'
    )!;

  it("keeps a newer duck quote up for the full 3.5s after the latest click (#1136)", async () => {
    await act(async () => root.render(<FooterStatusTicker />));

    await act(async () => duck().click());
    expect(bubble()).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => duck().click());

    // The first click's countdown ends inside this window; the second click's
    // must keep the bubble up.
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(bubble()).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(bubble()).toBeNull();
  });

  it("leaves no timers running after unmount (#1136)", async () => {
    await act(async () => root.render(<FooterStatusTicker />));
    await act(async () => duck().click());
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);

    // Recreate a root so afterEach can unmount it cleanly.
    root = createRoot(container);
  });
});
