// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { TextReveal } from "@/components/TextReveal";
import { TracingBeam } from "@/components/ui/TracingBeam";
import { FooterStatusTicker } from "@/components/FooterStatusTicker";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/meme-audio", () => ({ playMemeSound: vi.fn() }));

// framer-motion's own hook, as it behaves: null while the server renders,
// the real preference in the browser from the first render on.
const framerReducedMotion = vi.hoisted(() => ({
  value: null as boolean | null,
}));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => framerReducedMotion.value,
}));

/**
 * A visitor with Reduce Motion on used to get React #418 on the home page and
 * every case study: framer-motion's useReducedMotion() is null on the server
 * and true on the first client render, so these components rendered different
 * markup on each side (#2893).
 */
describe("reduced-motion hydration parity (#2893)", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    global.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
    window.matchMedia = originalMatchMedia;
  });

  const make: Record<string, () => React.ReactElement> = {
    TextReveal: () => <TextReveal>Complicated things made usable</TextReveal>,
    TracingBeam: () => (
      <TracingBeam>
        <p>Case study body</p>
      </TracingBeam>
    ),
    FooterStatusTicker: () => <FooterStatusTicker />,
  };

  it.each(["TextReveal", "TracingBeam", "FooterStatusTicker"])(
    "%s hydrates without a mismatch",
    async (name) => {
      // The server cannot read the media query, whatever the visitor prefers.
      framerReducedMotion.value = null;
      const html = renderToString(make[name]());
      container.innerHTML = html;

      framerReducedMotion.value = true;
      const recoverable = vi.fn();
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await act(async () => {
        root = hydrateRoot(container, make[name](), {
          onRecoverableError: recoverable,
        });
      });
      const mismatchLogs = consoleError.mock.calls.filter((args) =>
        String(args[0]).includes("hydrat")
      );
      consoleError.mockRestore();

      expect(recoverable).not.toHaveBeenCalled();
      expect(mismatchLogs).toEqual([]);
    }
  );
});
