// @vitest-environment jsdom
// #1636: at 200% text size, the shared chrome rows (mobile navbar actions,
// PlayCabinet header controls and footer controls, site footer utility row)
// must wrap inside their container instead of widening the page at 320px and
// 375px. JSDOM has no layout, so these tests pin the classes that let each
// row wrap (AGENTS.md section 13) and the 44px touch targets it must keep.
// The real-browser measurement lives in __tests__/e2e/visual.spec.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

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
  }),
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const classesOf = (el: Element | null) => {
  expect(el).not.toBeNull();
  return (el?.getAttribute("class") ?? "").split(/\s+/);
};

// A row that wraps instead of overflowing: flex-wrap, and neither a fixed
// width nor a content-sized minimum that could push it past its parent.
function expectWrappingRow(el: Element | null) {
  const classes = classesOf(el);
  expect(classes).toContain("flex");
  expect(classes).toContain("flex-wrap");
  expect(classes).toContain("min-w-0");
  expect(classes).toContain("max-w-full");
  expect(classes.filter((c) => /^w-\d/.test(c))).toEqual([]);
}

function expectTouchTargets(row: Element | null) {
  const buttons = Array.from(row?.querySelectorAll("button") ?? []);
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    const classes = classesOf(button);
    expect(
      classes.some((c) => c === "min-h-12" || c === "min-h-[44px]"),
      `button "${button.textContent}" keeps a 44px minimum height`
    ).toBe(true);
    expect(
      classes.some((c) => c === "min-w-12" || c === "min-w-[44px]"),
      `button "${button.textContent}" keeps a 44px minimum width`
    ).toBe(true);
  }
}

describe("shared chrome wraps at 200% text size (#1636)", () => {
  beforeEach(() => {
    global.IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("wraps the mobile navbar actions onto their own line", () => {
    render(<Navbar />);
    const bar = screen.getByTestId("navbar-mobile-bar");
    expectWrappingRow(bar);
    expect(classesOf(bar)).toContain("ml-auto");
    // The header row itself must allow the bar to drop below the wordmark.
    expect(classesOf(bar.parentElement)).toContain("flex-wrap");
    // Stacking stays inside the -z-10..z-50 band.
    expect(classesOf(bar)).toContain("z-50");
    expectTouchTargets(bar);
  });

  it("wraps the site footer utility row", () => {
    render(<Footer />);
    const row = screen.getByTestId("footer-utility-row");
    expectWrappingRow(row);
    expect(row.textContent).toContain("Logic & Proofs");
    expect(row.textContent).toContain("Back to Top");
  });

  it("wraps the PlayCabinet header and footer controls", async () => {
    vi.useFakeTimers();
    render(
      <PlayCabinet
        gameId="test-game"
        title="A Cabinet Title Long Enough To Truncate"
        icon={<span>G</span>}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
      >
        <div>Active Game Running</div>
      </PlayCabinet>
    );
    const launch = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.click(launch);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const header = screen.getByTestId("cabinet-header-controls");
    expectWrappingRow(header);
    expect(classesOf(header)).toContain("ml-auto");
    expect(classesOf(header.parentElement)).toContain("flex-wrap");
    expect(header.querySelectorAll("button")).toHaveLength(3);
    expectTouchTargets(header);

    // The title keeps truncating rather than claiming the whole row.
    const titleGroup = header.parentElement?.firstElementChild ?? null;
    expect(classesOf(titleGroup)).toContain("min-w-0");
    expect(titleGroup?.querySelectorAll(".truncate")).toHaveLength(1);

    const footer = screen.getByTestId("cabinet-footer-controls");
    expectWrappingRow(footer);
    expect(footer.textContent).toContain("Setup Wizard");
    expect(footer.textContent).toContain("Reset Cabinet");
    expectTouchTargets(footer);
  });
});
