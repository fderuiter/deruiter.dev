// @vitest-environment jsdom
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import axe from "axe-core";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

const ARCADE_DIR = path.resolve(process.cwd(), "components/arcade");

/** The cabinet and every game client's loading fallback. */
function bootSources(): { file: string; source: string }[] {
  const files = readdirSync(ARCADE_DIR).filter(
    (file) => file === "PlayCabinet.tsx" || /Client\.tsx$/.test(file)
  );
  return files.map((file) => ({
    file,
    source: readFileSync(path.join(ARCADE_DIR, file), "utf8"),
  }));
}

/** Every string literal that carries a Tailwind class list. */
function classLists(source: string): string[] {
  return Array.from(
    source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g),
    (match) => match[1] ?? match[2]
  ).concat(Array.from(source.matchAll(/"([^"]*animate-[^"]*)"/g), (m) => m[1]));
}

describe("arcade boot and loading text (#2797)", () => {
  afterEach(() => {
    cleanup();
  });

  it("finds the cabinet and the game clients", () => {
    const files = bootSources().map(({ file }) => file);
    expect(files).toContain("PlayCabinet.tsx");
    expect(files.length).toBeGreaterThan(5);
  });

  it("never sets loading text in zinc-500 or darker with a pulse", () => {
    for (const { file, source } of bootSources()) {
      for (const list of classLists(source)) {
        if (!list.includes("animate-pulse")) continue;
        expect(
          list,
          `${file}: pulsing text below WCAG AA contrast`
        ).not.toMatch(/\btext-zinc-(500|600|700)\b/);
      }
    }
  });

  it("stops every loading pulse and spinner under reduced motion", () => {
    for (const { file, source } of bootSources()) {
      for (const list of classLists(source)) {
        if (!/\banimate-(pulse|spin)\b/.test(list)) continue;
        expect(list, `${file}: loops under reduced motion`).toContain(
          "motion-reduce:animate-none"
        );
      }
    }
  });

  it("has zero axe violations on the boot screen", async () => {
    const { container } = render(
      <main>
        <PlayCabinet
          gameId="trial-and-error"
          title="Trial & Error"
          icon={<span aria-hidden="true">T</span>}
          instructions="Play cards."
          controls={[]}
          // A chunk that never arrives holds the boot screen at 85%.
          importComponent={() => new Promise<never>(() => {})}
        >
          <div>Game</div>
        </PlayCabinet>
      </main>
    );
    let result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Launch Cabinet/i }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    const warming = screen.getByText(/Warming up CRT display/);
    expect(warming.className).toContain("motion-reduce:animate-none");
    expect(warming.parentElement?.className).toContain("cabinet-standby-text");
    result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);
  });
});
