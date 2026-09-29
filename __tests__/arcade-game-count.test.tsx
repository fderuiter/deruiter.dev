import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";
import { ARCADE_GAME_COUNT, ARCADE_GAME_ROUTES } from "@/lib/arcade";

describe("arcade game count (#1344)", () => {
  it("hub badge count matches the number of game cards and the registry", () => {
    const { container } = render(<ArcadeHubClient />);
    const playLinks = Array.from(container.querySelectorAll("a")).filter((a) =>
      /Play Game/.test(a.textContent ?? "")
    );
    const hrefs = playLinks.map((a) => a.getAttribute("href")).sort();
    expect(hrefs).toEqual([...ARCADE_GAME_ROUTES].sort());
    expect(ARCADE_GAME_COUNT).toBe(playLinks.length);
    expect(
      screen.getByText(`${ARCADE_GAME_COUNT} Playable Games`)
    ).toBeTruthy();
  });

  it("does not hardcode a stale count in public copy", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    for (const f of [
      "app/schedule/page.tsx",
      "app/arcade/opengraph-image.tsx",
      "components/arcade/ArcadeHubClient.tsx",
    ]) {
      const src = readFileSync(path.resolve(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/\b\d+ (Playable )?Games\b/i);
    }
  });
});
