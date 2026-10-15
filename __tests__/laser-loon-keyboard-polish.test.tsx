// Laser Loon keyboard and screen-reader polish (#2142): the fallback controls
// show when focused, status reads words, and the creator's name is spelled
// the way the rest of the site spells it.
import React from "react";
import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { FLAG_MUSEUM } from "@/lib/laser-loon";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { LaserLoon } from "@/components/LaserLoon";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

describe("Laser Loon fallback controls (#2142)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });
  afterEach(() => {
    cleanup();
  });

  it("become a visible strip while focus is inside them", () => {
    const { container } = render(<LaserLoon />);
    const strip = container.querySelector(
      'div[aria-label="Laser Loon Accessible Subtree"]'
    );
    expect(strip?.classList.contains("sr-only")).toBe(true);
    expect(strip?.classList.contains("focus-within:not-sr-only")).toBe(true);
    // The status outputs stay off screen even while the strip shows.
    const status = strip?.querySelector(
      '[aria-label="Laser Loon Telemetry and Status"]'
    );
    expect(status?.classList.contains("sr-only")).toBe(true);
  });

  it("reads mode and state as words, and shows no clock outside arcade", () => {
    const { container } = render(<LaserLoon />);
    const text = Array.from(container.querySelectorAll("output"))
      .map((o) => o.textContent)
      .join(" | ");
    expect(text).toContain("Mode: Campaign");
    expect(text).toMatch(/Game Status: (Title screen|Act briefing)/);
    expect(text).not.toContain("999");
  });

  it("switches mode through the same path as the visible mode buttons", async () => {
    render(<LaserLoon />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Arcade Mode" }));
    });
    expect(
      screen.getByRole("button", { name: "Arcade Mode" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "components/LaserLoon.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/onClick=\{\(\) => setMode\(/);
  });
});

describe("Laser Loon credits (#2142)", () => {
  it("spells the creator Fred de Ruiter everywhere", () => {
    const f277 = FLAG_MUSEUM.find((f) => f.id === "f277-laser-loon");
    expect(JSON.stringify(FLAG_MUSEUM)).not.toContain("deRuiter");
    expect(f277?.creator).toBe("Fred de Ruiter");
    expect(JSON.stringify(GAME_MANUALS["laser-loon"])).not.toContain(
      "deRuiter"
    );
  });

  it("lists Space as a fire key in the pause menu", () => {
    const pause = fs.readFileSync(
      path.resolve(process.cwd(), "components/laser-loon/PauseMenu.tsx"),
      "utf8"
    );
    expect(pause).toContain("Click / Space: Fire");
  });
});
