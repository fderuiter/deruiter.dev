// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

// The same definition as site-chrome-no-glow.test.ts: a zero-offset coloured
// shadow, a drop-shadow halo, a heavy blurred orb or a *-glow custom
// property is a glow. Offset black elevation shadows and backdrop blur are
// not. Satori cards spell the orb as a `filter: "blur(...)"` style.
const GLOW =
  /shadow-\[0_0_|drop-shadow-\[0_0_|(?<!backdrop-)blur-(?:2xl|3xl|\[\d+px\])|--[a-z-]*glow|filter: "blur\(/u;

// AGENTS.md section 20 lets a game use glow inside its launched cabinet.
// These files render arcade cabinets, game canvases and their overlays, or
// the Laser Loon case study's in-world assets, and are left to their own
// game-visuals work; everything else under app/ and components/ is page
// content and must not glow (#2526, after the site chrome in #2312).
const GAME_SURFACES = [
  "components/arcade/",
  "components/laser-loon/",
  "components/QuasiPerfectPuzzler/",
  "components/ui/VirtualDPad.tsx",
  "components/ClinicalTrialChaos.tsx",
  "components/LaserLoon.tsx",
  "components/RetroChaosOverlay.tsx",
  "components/RetroLabyrinth.tsx",
  // The Labyrinth's views (ADR 0062) and the layout they share draw inside
  // its cabinet (#2839, #2859).
  "components/retro-labyrinth/views/",
  "components/retro-labyrinth/parts/LabyrinthLayout.tsx",
  "components/WorkingWithDuck.tsx",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(rel);
      return /\.tsx?$/u.test(entry.name) ? [rel] : [];
    }
  );
}

const PAGE_CONTENT = [
  ...sourceFiles("app"),
  ...sourceFiles("components"),
  "lib/og-image.tsx",
].filter((file) => !GAME_SURFACES.some((prefix) => file.startsWith(prefix)));

describe("page content carries no glow (#2526)", () => {
  it("scans the pages and components the issue named", () => {
    for (const file of [
      "app/blog/page.tsx",
      "app/case-studies/page.tsx",
      "app/contact/page.tsx",
      "app/schedule/page.tsx",
      "components/stack/StackOverviewView.tsx",
      "components/stack/StackLayerCards.tsx",
      "components/CaseStudyShowcase.tsx",
      "components/Timeline.tsx",
      "components/SandboxTerminal.tsx",
      "components/ui/CaseStudyBentoCard.tsx",
      "components/ContactForm.tsx",
      "lib/og-image.tsx",
    ]) {
      expect(PAGE_CONTENT).toContain(file);
    }
  });

  it.each(PAGE_CONTENT)("%s uses no glow treatment", (file) => {
    expect(readFileSync(path.join(root, file), "utf8")).not.toMatch(GLOW);
  });
});
