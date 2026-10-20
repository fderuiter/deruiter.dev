// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ARCADE_DAILY_GAME_IDS, ARCADE_DAILY_GAMES } from "@/lib/arcade/daily";
import {
  ARCADE_GAME_COUNT,
  ARCADE_GAME_ROUTES,
  ARCADE_REGISTRY,
  getArcadeRegistryEntry,
  isPhoneGated,
} from "@/lib/arcade";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import { checkArcadeRegistryParity } from "@/lib/dx/doctor";

describe("arcade registry (#2353)", () => {
  it("lists every game in the metadata exactly once, with the same route", () => {
    const slugs = ARCADE_REGISTRY.map((game) => game.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect([...slugs].sort()).toEqual(
      ARCADE_GAMES_METADATA.map((game) => game.slug).sort()
    );
    for (const game of ARCADE_REGISTRY) {
      const meta = ARCADE_GAMES_METADATA.find((m) => m.slug === game.slug);
      expect(meta?.route).toBe(game.route);
    }
  });

  it("derives the hub routes and count from the hub listing, in order", () => {
    const hub = ARCADE_REGISTRY.filter((game) => game.listing === "hub");
    expect(ARCADE_GAME_ROUTES).toEqual(hub.map((game) => game.route));
    expect(ARCADE_GAME_COUNT).toBe(10);
    expect(ARCADE_GAME_ROUTES).not.toContain("/arcade/meme-vault");
    expect(ARCADE_GAME_ROUTES).not.toContain("/protocol-drift");
  });

  it("keeps the daily ids equal to the registry's daily games", () => {
    expect([...ARCADE_DAILY_GAME_IDS].sort()).toEqual(
      ARCADE_REGISTRY.filter((game) => game.daily)
        .map((game) => game.slug)
        .sort()
    );
  });

  it("reads each daily badge from the registry", () => {
    for (const game of ARCADE_DAILY_GAMES) {
      expect(game.desktopOnly).toBe(
        getArcadeRegistryEntry(game.id).views.phone === "gated"
      );
    }
  });

  it("reports which games are still gated on phones", () => {
    expect(isPhoneGated("trial-and-error")).toBe(false);
    expect(isPhoneGated("meme-vault")).toBe(false);
    expect(isPhoneGated("retro-labyrinth")).toBe(true);
    expect(isPhoneGated("no-such-game")).toBe(false);
    expect(() => getArcadeRegistryEntry("no-such-game")).toThrow(
      /Unknown arcade game/
    );
  });

  it("marks desktop and tablet ready for every game", () => {
    for (const game of ARCADE_REGISTRY) {
      expect(game.views.desktop).toBe("ready");
      expect(game.views.tablet).toBe("ready");
    }
  });
});

describe("checkArcadeRegistryParity", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "arcade-registry-"));
    roots.push(root);
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), content);
    }
    return root;
  }

  const registry = `route: "/arcade/a",\nroute: "/b",`;

  it("passes on the real workspace", () => {
    expect(checkArcadeRegistryParity(process.cwd()).status).toBe("pass");
  });

  it("passes when every surface lists every route", () => {
    const listed = `"/arcade/a" "/b"`;
    const root = fixture({
      "lib/arcade/registry.ts": registry,
      "lib/seo-metadata.ts": listed,
      "lib/public-routes.ts": listed,
      "components/CommandPalette.tsx": listed,
    });
    expect(checkArcadeRegistryParity(root).status).toBe("pass");
  });

  it("names each missing route and surface", () => {
    const root = fixture({
      "lib/arcade/registry.ts": registry,
      "lib/seo-metadata.ts": `"/arcade/a" "/b"`,
      "lib/public-routes.ts": `"/arcade/a"`,
      "components/CommandPalette.tsx": `"/b"`,
    });
    const result = checkArcadeRegistryParity(root);
    expect(result.status).toBe("fail");
    expect(result.details).toEqual([
      "/b is missing from PUBLIC_ROUTE_REGISTRY (lib/public-routes.ts)",
      "/arcade/a is missing from CommandPalette staticNavs (components/CommandPalette.tsx)",
    ]);
  });

  it("fails when the registry file is missing", () => {
    expect(checkArcadeRegistryParity(fixture({})).status).toBe("fail");
  });
});
