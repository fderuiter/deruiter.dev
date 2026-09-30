// @vitest-environment jsdom
import React from "react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

const root = process.cwd();

const renderCabinet = () =>
  render(
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

describe("PlayCabinet attract screen (#1576)", () => {
  afterEach(cleanup);

  it("shows the game's preview still as a decorative backdrop", () => {
    const { container } = renderCabinet();
    const img = container.querySelector(
      'img[src*="/images/arcade/previews/laser-loon.webp"]'
    );
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("marks the cabinet with data-game so it picks up the game's accent", () => {
    const { container } = renderCabinet();
    expect(container.querySelector('[data-game="laser-loon"]')).not.toBeNull();
    expect(
      container.querySelector(".arcade-launch-button")?.textContent
    ).toMatch(/Launch Cabinet/);
  });

  it("does not pulse the status dot while the cabinet is idle", () => {
    const { container } = renderCabinet();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("has a preview still for every game that mounts a cabinet", () => {
    const dir = path.resolve(root, "components/arcade");
    const ids = readdirSync(dir)
      .filter((f) => f.endsWith("Client.tsx"))
      .flatMap((f) =>
        [
          ...readFileSync(path.join(dir, f), "utf8").matchAll(
            /<PlayCabinet[\s\S]*?gameId="([a-z-]+)"/g
          ),
        ].map((m) => m[1])
      );
    expect(ids.length).toBeGreaterThanOrEqual(8);
    for (const id of ids) {
      expect(
        existsSync(
          path.resolve(root, `public/images/arcade/previews/${id}.webp`)
        ),
        id
      ).toBe(true);
    }
  });

  it("gives every cabinet game its own accent token", () => {
    const css = readFileSync(
      path.resolve(root, "app/arcade/arcade.css"),
      "utf8"
    );
    for (const id of [
      "working-with-duck",
      "laser-loon",
      "quasi-puzzler",
      "garmin-watch",
      "clinical-chaos",
      "retro-labyrinth",
    ]) {
      expect(css).toContain(`[data-game="${id}"]`);
    }
  });
});
