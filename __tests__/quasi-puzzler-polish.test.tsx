// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { QuasiPuzzlerClient } from "@/components/arcade/QuasiPuzzlerClient";

// Mocks
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: vi.fn(),
  }),
}));

describe("Quasi-Perfect Puzzler Polish & Access Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders updated pre-launch controls documentation in QuasiPuzzlerClient", () => {
    render(<QuasiPuzzlerClient />);

    expect(screen.getAllByText(/Quasi-Perfect/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Apply Tactic/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Undo \/ Redo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reset Level/i).length).toBeGreaterThan(0);
  });

  // #1555: the panel said "Z / Y", but only Ctrl/Cmd+Z and Ctrl/Cmd+Y undo
  // and redo, and the M mode switch was undocumented.
  it("labels undo/redo with the modifier and documents the M mode switch (#1555)", () => {
    render(<QuasiPuzzlerClient />);

    expect(screen.getAllByText("Ctrl/⌘ + Z / Y").length).toBeGreaterThan(0);
    expect(screen.queryByText("Z / Y")).toBeNull();
    expect(screen.getAllByText("R / M").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Switch Mode/).length).toBeGreaterThan(0);
  });

  it("switches modes between Story Mode and Hacker Mode smoothly", () => {
    render(<QuasiPerfectPuzzler />);

    const hackerBtn = screen.getByRole("button", { name: /Hacker Mode/i });
    fireEvent.click(hackerBtn);

    const hackerBtns = screen.getAllByRole("button", { name: /Hacker Mode/i });
    expect(hackerBtns.length).toBeGreaterThan(0);

    const storyBtn = screen.getByRole("button", { name: /Story Mode/i });
    fireEvent.click(storyBtn);

    const storyBtns = screen.getAllByRole("button", { name: /Story Mode/i });
    expect(storyBtns.length).toBeGreaterThan(0);
  });

  it("provides min 44px touch targets on chapter and level selector buttons", () => {
    render(<QuasiPerfectPuzzler />);

    const l1Btns = screen.getAllByRole("button", { name: /^L1/i });
    expect(l1Btns[0].className).toContain("min-h-[44px]");
    expect(l1Btns[0].className).toContain("min-w-[44px]");
  });
});
