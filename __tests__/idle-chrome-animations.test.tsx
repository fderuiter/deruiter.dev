// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { type ReactNode } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, cleanup } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FooterStatusTicker } from "@/components/FooterStatusTicker";
import { FieldManualButton } from "@/components/FieldManualButton";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

/**
 * #1596: shared site chrome must be calm at rest (ADR 0046, AGENTS.md
 * section 16). Status dots and badges may pulse a few times on arrival
 * (`animate-ping-settle` / `animate-pulse-settle`, finite iteration counts
 * in app/globals.css) but never loop forever with Tailwind's infinite
 * `animate-ping` / `animate-pulse`.
 */

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    volume: 0.3,
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playNote: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({ persona: "recruiter", setPersona: vi.fn() }),
}));

// Dyslexia mode on, so the footer's "Dyslexia: ON" status dot renders.
vi.mock("@/hooks/useFontPreference", () => ({
  useFontPreference: () => ({
    isDyslexic: true,
    toggleDyslexiaMode: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/meme-audio", () => ({ playMemeSound: vi.fn() }));

const INFINITE_LOOPS = ["animate-ping", "animate-pulse"];

const infiniteLoopElements = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) =>
    INFINITE_LOOPS.some((cls) => el.classList.contains(cls))
  );

describe("site chrome is calm at rest (#1596)", () => {
  beforeEach(() => {
    localStorage.clear();
    const observer = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    global.IntersectionObserver =
      observer as unknown as typeof IntersectionObserver;
    global.ResizeObserver = observer as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("Navbar and Footer run no infinite ping or pulse loops", () => {
    const { container } = render(
      <>
        <Navbar />
        <Footer />
      </>
    );
    expect(infiniteLoopElements(container)).toEqual([]);

    const nav = container.querySelector("nav, header");
    const footer = container.querySelector("footer");
    expect(nav?.querySelector(".animate-ping-settle")).not.toBeNull();
    // Brand dot and the footnotes ticker dot.
    expect(
      footer?.querySelectorAll(".animate-ping-settle").length
    ).toBeGreaterThanOrEqual(2);
    // Project Notes dot and the Dyslexia: ON dot.
    expect(
      footer?.querySelectorAll(".animate-pulse-settle").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("the footer status ticker dot settles instead of pinging forever", () => {
    const { container } = render(<FooterStatusTicker />);
    expect(infiniteLoopElements(container)).toEqual([]);
    expect(container.querySelector(".animate-ping-settle")).not.toBeNull();
  });

  it("the unseen Field Manual badge pings a bounded number of times", () => {
    const { container } = render(
      <FieldManualButton manualId="working-with-duck" />
    );
    const badge = container.querySelector(".animate-ping-settle");
    expect(badge).not.toBeNull();
    // The solid dot stays, so the badge still reads without motion.
    expect(badge?.nextElementSibling?.classList.contains("bg-cyan-500")).toBe(
      true
    );
    expect(infiniteLoopElements(container)).toEqual([]);
  });

  it("the PlayCabinet attract screen has no infinite status loops", () => {
    const { container } = render(
      <PlayCabinet
        gameId="laser-loon"
        title="Laser Loon"
        subtitle="Quest for the State Flag"
        icon={<span />}
        instructions="Fly the loon."
        controls={[{ key: "Space", action: "Fire" }]}
        importComponent={() => Promise.resolve({})}
      >
        <div />
      </PlayCabinet>
    );
    expect(infiniteLoopElements(container)).toEqual([]);
  });

  it("defines the settle animations with a finite iteration count", () => {
    const css = readFileSync(
      path.resolve(process.cwd(), "app/globals.css"),
      "utf8"
    );
    const ping = css.match(/--animate-ping-settle:\s*([^;]+);/)?.[1] ?? "";
    const pulse = css.match(/--animate-pulse-settle:\s*([^;]+);/)?.[1] ?? "";

    for (const decl of [ping, pulse]) {
      expect(decl).not.toBe("");
      expect(decl).not.toMatch(/infinite/);
      expect(decl).toMatch(/\s\d+(\s|$)/);
    }
    // The halo finishes hidden so only the solid dot remains.
    expect(ping).toMatch(/forwards/);
    expect(css).toMatch(/@keyframes ping-settle/);
    expect(css).toMatch(/@keyframes pulse-settle/);
  });
});
