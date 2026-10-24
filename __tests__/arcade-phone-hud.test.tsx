// @vitest-environment jsdom
// #2361: the phone HUD. One 44px row of at most four chips, an overflow chip
// that opens a sheet with every stat, and a polite, throttled read-out.
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import axe from "axe-core";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PhoneHud, type PhoneHudChip } from "@/components/arcade/mobile/ui";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const chips = (score: number, extra = 0): PhoneHudChip[] => [
  { id: "score", label: "Score", value: score, accent: true },
  { id: "lives", label: "Lives", value: 3 },
  { id: "time", label: "Time", value: "1:20", announce: false },
  { id: "combo", label: "Combo", value: "x2" },
  ...Array.from({ length: extra }, (_, i) => ({
    id: `extra-${i}`,
    label: `Extra ${i + 1}`,
    value: i + 1,
  })),
];

function liveText(): string {
  return screen.getByRole("status").textContent ?? "";
}

describe("PhoneHud (#2361)", () => {
  it("shows up to four chips in one 44px row, with no overflow chip", () => {
    render(<PhoneHud chips={chips(0)} />);
    const hud = screen.getByRole("group", { name: "Game status" });
    expect(hud.className).toContain("h-11");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("moves stats past four behind an overflow chip that opens a sheet of every stat", () => {
    render(<PhoneHud chips={chips(0, 2)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const more = screen.getByRole("button", { name: "+2 more stats" });
    fireEvent.click(more);
    const sheet = screen.getByRole("dialog", { name: "All stats" });
    const terms = Array.from(sheet.querySelectorAll("dt")).map(
      (dt) => dt.textContent
    );
    expect(terms).toEqual([
      "Score",
      "Lives",
      "Time",
      "Combo",
      "Extra 1",
      "Extra 2",
    ]);
  });

  it("reads changed values politely, at most once per window, and never the opted-out ones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { rerender } = render(<PhoneHud chips={chips(0)} />);
    // The first values are on screen already; nothing is read.
    act(() => vi.advanceTimersByTime(5000));
    expect(liveText()).toBe("");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");

    rerender(<PhoneHud chips={chips(10)} />);
    act(() => vi.advanceTimersByTime(0));
    expect(liveText()).toBe("Score 10");

    // Changes inside the window wait; the last one is read when it ends.
    rerender(<PhoneHud chips={chips(20)} />);
    rerender(<PhoneHud chips={chips(30)} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(liveText()).toBe("Score 10");
    act(() => vi.advanceTimersByTime(1000));
    expect(liveText()).toBe("Score 30");

    // A ticking timer (announce: false) is never read on its own.
    const ticking = chips(30).map((chip) =>
      chip.id === "time" ? { ...chip, value: "1:19" } : chip
    );
    rerender(<PhoneHud chips={ticking} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(liveText()).toBe("Score 30");
  });

  it("keeps every piece of text at 12px or larger", () => {
    render(<PhoneHud chips={chips(0, 1)} />);
    const small = Array.from(document.querySelectorAll("[class]")).filter(
      (el) => /text-\[(?:[0-9]|1[01])px\]/.test(el.getAttribute("class") ?? "")
    );
    expect(small).toEqual([]);
  });

  it("never sets text under 12px in any phone UI pattern", () => {
    const dir = path.resolve(process.cwd(), "components/arcade/mobile/ui");
    const tooSmall = readdirSync(dir)
      .filter((file) => file.endsWith(".tsx"))
      .flatMap((file) =>
        (
          readFileSync(path.join(dir, file), "utf8").match(
            /text-\[(?:\d|1[01])(?:\.\d+)?px\]/g
          ) ?? []
        ).map((match) => `${file}: ${match}`)
      );
    expect(tooSmall).toEqual([]);
  });

  it("has zero axe violations, closed and with the overflow sheet open", async () => {
    const { container } = render(
      <main>
        <PhoneHud chips={chips(0, 2)} />
      </main>
    );
    const options = {
      runOnly: {
        type: "tag" as const,
        values: ["wcag2a", "wcag2aa", "wcag21aa"],
      },
    };
    expect((await axe.run(container, options)).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "+2 more stats" }));
    expect((await axe.run(container, options)).violations).toEqual([]);
  });
});
