import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";
import {
  ARCADE_STORAGE_KEYS,
  ARCADE_TROPHIES,
} from "@/lib/arcade-achievements";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { PUBLIC_ROUTE_PATHS } from "@/lib/public-routes";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

const ROUTE = "/arcade/protocol-drift";
const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Protocol Drift discovery matrix", () => {
  it("is listed in the command palette, navbar and footer", () => {
    expect(read("components/CommandPalette.tsx")).toContain(`url: "${ROUTE}"`);
    expect(read("components/Navbar.tsx")).toContain(`href: "${ROUTE}"`);
    expect(read("components/Footer.tsx")).toContain(`href="${ROUTE}"`);
  });

  it("has canonical SEO metadata and a public route entry", () => {
    expect(ROUTE_METADATA_CONFIGS.protocolDrift.path).toBe(ROUTE);
    expect(PUBLIC_ROUTE_PATHS).toContain(ROUTE);
  });

  it("ships an opengraph image and a preview thumbnail", () => {
    expect(
      fs.existsSync(
        path.join(root, "app/arcade/protocol-drift/opengraph-image.tsx")
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(root, "public/images/arcade/previews/protocol-drift.webp")
      )
    ).toBe(true);
  });

  it("declares header clearance on the page and never renders a second Navbar", () => {
    const page = read("app/arcade/protocol-drift/page.tsx");
    expect(page).toContain("PageLayout");
    expect(page).toContain("pt-28");
    expect(page).not.toContain("<Navbar");
  });
});

describe("Protocol Drift arcade registrations", () => {
  it("has a hub card, manual, storage key and trophies", () => {
    const card = ARCADE_GAMES_METADATA.find((g) => g.id === "protocol-drift");
    expect(card?.route).toBe(ROUTE);
    expect(card?.storageKey).toBe(ARCADE_STORAGE_KEYS["protocol-drift"]);
    expect(GAME_MANUALS["protocol-drift"]?.route).toBe(ROUTE);
    expect(
      ARCADE_TROPHIES.filter((t) => t.gameId === "protocol-drift").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("uses the DOM CRT profile rather than a canvas surface", () => {
    expect(read("lib/arcade/crt-pipeline.ts")).toMatch(
      /"protocol-drift":\s*\{\s*surface:\s*"dom"/
    );
  });
});
