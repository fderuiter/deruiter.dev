// @vitest-environment jsdom
//
// #1314: the keyboard stopped the loon at y=340 while the mouse could take it
// to y=380, and weapon 4 went by four different names.
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { LaserLoon } from "@/components/LaserLoon";
import {
  DEFAULT_CANVAS_HEIGHT,
  LOON_MAX_Y,
  LOON_MIN_Y,
  WEAPONS,
} from "@/lib/laser-loon";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playLaser: vi.fn(),
  }),
}));

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: mockAnnounce }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

describe("Laser Loon movement bounds and weapon naming (#1314)", () => {
  afterEach(() => {
    cleanup();
    mockAnnounce.mockClear();
  });

  it("uses one vertical range for keyboard and pointer", () => {
    expect(LOON_MIN_Y).toBe(40);
    expect(LOON_MAX_Y).toBe(DEFAULT_CANVAS_HEIGHT - 40);
  });

  it("lets the keyboard reach the same lowest point as the mouse", () => {
    render(<LaserLoon />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
    );
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));
    const playfield = screen.getByRole("application", {
      name: /Laser Loon Arcade Game/i,
    }).parentElement as HTMLElement;

    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(playfield, { key: "ArrowDown" });
    }

    const last = mockAnnounce.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.startsWith("Loon moved down"))
      .at(-1);
    expect(last).toContain(`vertical position: ${LOON_MAX_Y}`);
  });

  it("calls weapon 4 the Cryo-Mortar everywhere", () => {
    render(<LaserLoon />);
    expect(WEAPONS["ice-cannon"].name).toContain("Cryo-Mortar");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Cryo-Mortar (4)");
    expect(text).not.toMatch(/Ice Cannon|Ice Mortar|(?<!Cryo-)Mortar \(4\)/);
  });
});
