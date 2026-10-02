// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FALLBACK_CASE_STUDIES } from "../lib/case-studies-data";
import { FALLBACK_BLOG_POSTS } from "../lib/fallback-blog-posts";
import { PUBLIC_ROUTE_REGISTRY } from "../lib/public-routes";
import { routeExistsOnDisk } from "../lib/dx/doctor";

/**
 * Regression coverage for #1611: after #919 reframed /simulator as the
 * Architectural Archetype Simulator, several links elsewhere still used it as
 * a stand-in for the CRF Studio or the 3D brain viewer, or called it by its
 * old "Engineering Alignment" name.
 */

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");

const simulatorName = PUBLIC_ROUTE_REGISTRY.find(
  (route) => route.path === "/simulator"
)?.name;

function internalHrefs(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const pattern = /<a\s+href="(\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    links.push({ href: match[1], text: match[2] });
  }
  return links;
}

describe("stale /simulator links (#1611)", () => {
  it("registers the simulator under its archetype name", () => {
    expect(simulatorName).toBe("Architectural Archetype Simulator");
  });

  it("points the CRF.xl case study's launch button at the CRF Studio", () => {
    const crfXl = FALLBACK_CASE_STUDIES.find(
      (study) => study.slug === "crf-xl"
    );
    expect(crfXl?.interactive_url).toBe("/crf");
    expect(crfXl?.interactive_label).toMatch(/CRF Studio/);
  });

  it("gives every internal case-study launch link a real route", () => {
    for (const study of FALLBACK_CASE_STUDIES) {
      const url = study.interactive_url;
      if (!url || !url.startsWith("/")) continue;
      const routePath = url.split("#")[0] || "/";
      expect(
        routeExistsOnDisk(routePath, APP_DIR),
        `${study.slug} -> ${url}`
      ).toBe(true);
    }
  });

  it("only links /simulator from blog posts when naming the simulator", () => {
    for (const post of FALLBACK_BLOG_POSTS) {
      for (const { href, text } of internalHrefs(post.body)) {
        if (href.split("#")[0] !== "/simulator") continue;
        expect(text, `${post.slug} links /simulator as "${text}"`).toMatch(
          /Simulator/
        );
        expect(text).not.toMatch(/Brain|CRF|Alignment/i);
      }
    }
  });

  it("links the 3D brain viewer mention to /neuro", () => {
    const post = FALLBACK_BLOG_POSTS.find(
      (entry) =>
        entry.slug ===
        "statecharts-invariant-verification-high-assurance-frontends"
    );
    expect(post).toBeDefined();
    const brainLinks = internalHrefs(post!.body).filter(({ text }) =>
      /Brain/.test(text)
    );
    expect(brainLinks.length).toBeGreaterThan(0);
    for (const link of brainLinks) {
      expect(link.href).toBe("/neuro");
    }
  });

  it("gives every internal blog link a real route", () => {
    for (const post of FALLBACK_BLOG_POSTS) {
      for (const { href } of internalHrefs(post.body)) {
        const routePath = href.split("#")[0] || "/";
        expect(
          routeExistsOnDisk(routePath, APP_DIR),
          `${post.slug} -> ${href}`
        ).toBe(true);
      }
    }
  });

  it("names the simulator by its current title in the Neuro page's next link", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "neuro", "page.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/Alignment Simulator|Engineering Leadership/);
    expect(source).toMatch(
      new RegExp(`title: "${simulatorName}",\\s*href: "/simulator"`)
    );
  });
});
