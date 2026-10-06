// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOOTER_EXTRA_ITEMS,
  PRIMARY_NAV,
  filterNavItems,
  getAllNavHrefs,
  getAllNavItems,
  getNavGroup,
  getNavHref,
  isNavGroupActive,
  isNavMenu,
} from "@/lib/navigation";
import { ARCADE_GAME_ROUTES } from "@/lib/arcade";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";
import nextConfig from "../next.config";

// Pages that are reached through something other than a menu entry.
// The wordmark links home, and the offline page is a service worker fallback.
const NOT_NAVIGATION = new Set(["/", "/offline"]);

describe("navigation structure (#1842, #1843)", () => {
  it("has exactly the six top bar items, in order", () => {
    expect(PRIMARY_NAV.map((g) => g.label)).toEqual([
      "Work",
      "Blog",
      "Arcade",
      "Simulators",
      "About",
      "Contact",
    ]);
  });

  it("makes Arcade, Simulators and About menus and the rest plain links", () => {
    expect(PRIMARY_NAV.filter(isNavMenu).map((g) => g.id)).toEqual([
      "arcade",
      "simulators",
      "about",
    ]);
  });

  it("lists games only under Arcade, matching the hub registry", () => {
    const hrefs = getNavGroup("arcade")
      .sections.flatMap((s) => s.items)
      .map((i) => i.href);
    expect(hrefs[0]).toBe("/arcade");
    // The Meme Vault is listed but sits outside the previous/next ring.
    expect(hrefs.slice(1).sort()).toEqual(
      [...ARCADE_GAME_ROUTES, "/arcade/meme-vault"].sort()
    );
    expect(hrefs).not.toContain("/merch");
    expect(hrefs).not.toContain("/protocol-drift");
  });

  it("splits Simulators into Simulators and Studios", () => {
    const sections = getNavGroup("simulators").sections;
    expect(sections.map((s) => s.label)).toEqual(["Simulators", "Studios"]);
    expect(sections[0].items.map((i) => i.href)).toEqual([
      "/protocol-drift",
      "/simulator",
      "/patrol",
    ]);
    expect(sections[1].items.map((i) => i.href)).toEqual([
      "/crf",
      "/proof",
      "/neuro",
    ]);
  });

  it("puts the site pages under About, with GitHub opening off-site", () => {
    const items = getNavGroup("about").sections[0].items;
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.stack.href).toBe("/stack");
    expect(byId.credits.href).toBe("/acknowledgments");
    expect(byId.github.external).toBe(true);
    expect(byId.github.href.startsWith("https://")).toBe(true);
  });

  it("keeps every item reachable in two clicks: bar, then menu", () => {
    for (const group of PRIMARY_NAV) {
      if (isNavMenu(group)) {
        expect(getAllNavItems().length).toBeGreaterThan(0);
      }
    }
    const reachable = new Set(getAllNavHrefs());
    for (const href of [
      "/case-studies/designing-for-my-brother",
      "/stack",
      "/acknowledgments",
      "/merch",
      "/protocol-drift",
    ]) {
      expect(reachable.has(href), href).toBe(true);
    }
  });

  it("gives unique ids and hrefs to menu items", () => {
    const items = getAllNavItems();
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
  });

  it("hides items by reading mode and swaps phone variants", () => {
    const sims = getNavGroup("simulators").sections[0].items;
    expect(
      filterNavItems(sims, "behind-the-scenes").map((i) => i.href)
    ).toEqual(["/protocol-drift", "/patrol"]);
    expect(filterNavItems(sims, "professional")).toHaveLength(sims.length);
    const patrol = sims.find((i) => i.id === "patrol-shift")!;
    expect(getNavHref(patrol, "mobile")).toBe("/m/patrol");
    expect(getNavHref(patrol, "desktop")).toBe("/patrol");
  });

  it("marks the right group current", () => {
    const current = (p: string) =>
      PRIMARY_NAV.filter((g) => isNavGroupActive(g, p)).map((g) => g.id);
    expect(current("/arcade/study-director")).toEqual(["arcade"]);
    expect(current("/merch")).toEqual(["arcade"]);
    expect(current("/protocol-drift")).toEqual(["simulators"]);
    expect(current("/patrol")).toEqual(["simulators"]);
    expect(current("/m/crf")).toEqual(["simulators"]);
    expect(current("/stack")).toEqual(["about"]);
    expect(current("/case-studies/equipose-randomization")).toEqual(["work"]);
    expect(current("/blog/some-post")).toEqual(["blog"]);
    expect(current("/contact")).toEqual(["contact"]);
    expect(current("/")).toEqual([]);
  });

  it("covers every first-class public route", () => {
    const reachable = new Set(getAllNavHrefs());
    const missing = PUBLIC_ROUTE_REGISTRY.map((r) => r.path).filter(
      (p) =>
        !reachable.has(p) &&
        !NOT_NAVIGATION.has(p) &&
        // Phone variants are reached through their desktop item's mobileHref.
        !p.startsWith("/m/") &&
        // Individual case studies and posts hang off the Work and Blog links.
        !p.startsWith("/case-studies/") &&
        !p.startsWith("/blog/") &&
        !p.startsWith("/work/")
    );
    expect(
      missing,
      `routes in no navigation group: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("links every phone variant it names to a registered route", () => {
    const registered = new Set<string>(
      PUBLIC_ROUTE_REGISTRY.map((r) => r.path)
    );
    for (const item of getAllNavItems()) {
      if (item.mobileHref) {
        expect(registered.has(item.mobileHref), item.mobileHref).toBe(true);
      }
    }
    expect(FOOTER_EXTRA_ITEMS.every((i) => !i.mobileHref)).toBe(true);
  });

  it("is covered by the command palette", () => {
    const palette = fs.readFileSync(
      path.join(process.cwd(), "components/CommandPalette.tsx"),
      "utf8"
    );
    const internal = getAllNavItems().filter((i) => !i.external);
    const missing = internal
      .map((i) => i.href)
      // Anchors on the home page are reached by the palette's "About" entry.
      .filter((href) => !href.startsWith("/#"))
      .filter((href) => !palette.includes(`"${href}"`));
    expect(missing, `palette is missing: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("Protocol Drift redirect (#1841)", () => {
  it("permanently redirects the old arcade URL to the simulator", async () => {
    const redirects = await nextConfig.redirects?.();
    const rule = redirects?.find((r) => r.source === "/arcade/protocol-drift");
    expect(rule?.destination).toBe("/protocol-drift");
    expect(rule?.permanent).toBe(true);
  });

  it("no longer serves the game from the arcade folder", () => {
    expect(
      fs.existsSync(path.join(process.cwd(), "app/arcade/protocol-drift"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(process.cwd(), "app/protocol-drift/page.tsx"))
    ).toBe(true);
  });
});
