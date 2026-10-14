// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { LaserLoon } from "@/components/LaserLoon";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playLaser: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

describe("Laser Loon act intro field guide (#2052)", () => {
  afterEach(() => {
    cleanup();
  });

  it("names the optic each new Act I enemy wants", () => {
    render(<LaserLoon />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
    );

    const guide = screen.getByTestId("laser-loon-field-guide");
    const rows = Array.from(guide.querySelectorAll("li")).map(
      (li) => li.textContent
    );
    expect(rows).toEqual([
      "Laser MosquitoCyan Pulse [2]",
      "Glacial HailRuby Laser [1]",
      "Rogue Jet-SkiCryo-Mortar [4]",
    ]);
  });
});
