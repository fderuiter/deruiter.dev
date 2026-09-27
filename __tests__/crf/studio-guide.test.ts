import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GAME_MANUALS } from "@/lib/game-manuals";

const read = (file: string) =>
  readFileSync(path.join(process.cwd(), file), "utf8");

// #1208: the tour must point at controls that exist, and the studio's
// shortcuts must agree with what the header, tour and guide tell visitors.
describe("CRF Studio guide and tour (#1208)", () => {
  const tour = read("components/crf/Wizard/SpotlightTourOverlay.tsx");
  const container = read("components/crf/CRFStudioContainer.tsx");
  const header = read("components/crf/StudioHeader.tsx");

  it("gives every tour step a target that the studio renders", () => {
    const targets = [...tour.matchAll(/target: "([a-z-]+)"/g)].map(
      ([, t]) => t
    );
    expect(targets.length).toBe(5);
    for (const target of targets) {
      expect(container + header).toContain(`data-tour="${target}"`);
    }
  });

  it("does not claim site-wide shortcuts owned by search and the guide", () => {
    expect(container).not.toMatch(/e\.key\.toLowerCase\(\) === "k"/);
    expect(container).not.toMatch(/e\.key === "\?"/);
    expect(tour).not.toContain("⌘K");
  });

  it("maps number keys to modes in the order the mode bar shows", () => {
    const badges = [
      ...header.matchAll(/mode: "([a-z]+)",[\s\S]*?shortcut: "(\d)"/g),
    ].map(([, mode, key]) => [key, mode]);
    expect(badges.length).toBe(7);
    for (const [key, mode] of badges) {
      expect(container).toContain(`"${key}": "${mode}"`);
    }
  });

  it("registers a Studio Guide manual that the page renders", () => {
    expect(GAME_MANUALS.crf.route).toBe("/crf");
    expect(read("app/crf/page.tsx")).toContain('manualId="crf"');
  });
});
