// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const css = read("app/globals.css");

// Site chrome that every route renders, plus the global command palette.
// In-cabinet loud moments ([data-te-cabinet][data-te-loud="on"], --te-*) and
// game canvases are the AGENTS.md section 20 exception and are not listed.
const CHROME = [
  "components/Navbar.tsx",
  "components/Footer.tsx",
  "components/FooterStatusTicker.tsx",
  "components/nav/DesktopNavMenu.tsx",
  "components/nav/MobileNavSections.tsx",
  "components/nav/PreferencesMenu.tsx",
  "components/ui/TracingBeam.tsx",
  "components/UnifiedErrorLayout.tsx",
  "components/CommandPalette.tsx",
];

// A zero-offset coloured shadow, a drop-shadow halo, a heavy blurred orb or a
// *-glow custom property is a glow. Offset black elevation shadows and the
// backdrop blur behind fixed bars and scrims are not.
const GLOW =
  /shadow-\[0_0_|drop-shadow-\[0_0_|(?<!backdrop-)blur-(?:2xl|3xl|\[\d+px\])|--[a-z-]*glow/u;

describe("site chrome carries no glow (#2312)", () => {
  it.each([
    ".glass-panel-glow",
    ".glow-cyan-sm",
    ".glow-cyan-md",
    ".glow-cyan-border",
    ".svg-glow-cyan",
    ".svg-glow-blue",
  ])("globals.css no longer defines %s", (selector) => {
    expect(css).not.toContain(`${selector} {`);
  });

  it.each(["--brand-cyan-glow", "--cyan-glow", "--brand-blue-glow"])(
    "globals.css no longer defines the %s token",
    (token) => {
      expect(css).not.toContain(`${token}:`);
    }
  );

  it.each(["app/icon.svg", "public/favicon.svg"])(
    "%s draws the telemetry dot as a solid inline fill with no filter",
    (file) => {
      const svg = read(file);
      expect(svg).not.toMatch(/<filter\b|filter[:=]/u);
      expect(svg).toMatch(/<circle class="telemetry-dot" fill="#10B981"/u);
    }
  );

  it.each(CHROME)("%s uses no glow treatment", (file) => {
    expect(read(file)).not.toMatch(GLOW);
  });
});
