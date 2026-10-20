// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

// Content cards on public pages. Fixed bars (navbar), modal scrims and
// in-cabinet game overlays keep their blur and are not listed here.
const CARD_FILES = [
  "app/contact/page.tsx",
  "app/offline/page.tsx",
  "components/SkillsGrid.tsx",
  "components/ProjectTeaserGrid.tsx",
  "components/CaseStudyShowcase.tsx",
  "components/Timeline.tsx",
  "components/blog/TableOfContents.tsx",
  "components/stack/StackLayerCards.tsx",
  "components/stack/StackOverviewView.tsx",
  "components/stack/InvariantsMatrix.tsx",
  "components/stack/AudioSynthLab.tsx",
  "components/stack/PretextBenchmarkLab.tsx",
  "components/UnifiedErrorLayout.tsx",
  "components/FooterStatusTicker.tsx",
  "components/nav/DesktopNavMenu.tsx",
];

describe("solid card surfaces (#2310)", () => {
  it("defines both surface tokens as opaque graphite", () => {
    expect(css).toMatch(/--surface-1:\s*#13151a;/);
    expect(css).toMatch(/--surface-2:\s*#191c22;/);
  });

  it.each([
    ".dossier-card",
    ".glass-panel",
    ".glass-panel-glow",
    ".tool-shell",
    ".editorial-surface",
  ])("%s has an opaque fill and no backdrop filter", (selector) => {
    const body = rule(selector);
    expect(body).not.toMatch(/backdrop-filter/);
    expect(body).toMatch(/background:\s*var\(--surface-1\);/);
  });

  it.each(CARD_FILES)("%s cards do not use backdrop blur", (file) => {
    const source = readFileSync(path.join(root, file), "utf8");
    expect(source).not.toMatch(/backdrop-blur/);
  });

  it("keeps the blur on the fixed navbar", () => {
    const navbar = readFileSync(
      path.join(root, "components/Navbar.tsx"),
      "utf8"
    );
    expect(navbar).toMatch(/backdrop-blur/);
  });
});
