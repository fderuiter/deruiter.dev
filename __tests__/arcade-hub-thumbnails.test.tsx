import React from "react";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";
import { ARCADE_GAME_ROUTES } from "@/lib/arcade";

const thumbnailSources = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("img"))
    .map((img) => img.getAttribute("src") ?? "")
    .filter((src) => src.includes("/images/arcade/previews/"));

describe("arcade hub thumbnails (#1530)", () => {
  it("shows a gameplay still for every hub game", () => {
    const { container } = render(<ArcadeHubClient />);
    const sources = thumbnailSources(container);
    // Meme Vault is listed under Labs now, so the hub shows no card for it
    // (#3151).
    const expected = [...ARCADE_GAME_ROUTES].map(
      (route) => `/images/arcade/previews/${route.split("/").pop()}.webp`
    );
    for (const src of expected) expect(sources).toContain(src);
  });

  it("ships every referenced still in public/", () => {
    const { container } = render(<ArcadeHubClient />);
    for (const src of thumbnailSources(container)) {
      expect(existsSync(path.resolve(process.cwd(), "public" + src))).toBe(
        true
      );
    }
  });

  it("keeps thumbnail links out of the tab order", () => {
    const { container } = render(<ArcadeHubClient />);
    for (const img of Array.from(container.querySelectorAll("img"))) {
      const link = img.closest("a");
      expect(link?.getAttribute("tabindex")).toBe("-1");
      expect(link?.getAttribute("aria-hidden")).toBe("true");
      expect(img.getAttribute("alt")).toBe("");
    }
  });
});
