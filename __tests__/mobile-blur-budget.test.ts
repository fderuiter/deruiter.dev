// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const HEAVY_BLUR = /blur-\[(\d{3,})px\]/gu;
const THRESHOLD_PX = 100;

/** Recursively collects .tsx files under a directory. */
function collectComponents(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith("."))
        return [];
      return collectComponents(full);
    }
    return entry.isFile() && entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/**
 * AGENTS.md section 16 bounds GPU rasterisation on mobile. A blur(160px) filter
 * forces the compositor to rasterise a large blurred surface every frame, and
 * several of these layers are position: fixed, so they are re-composited during
 * scroll rather than scrolling away.
 */
describe("Mobile GPU blur budget", () => {
  const files = [
    ...collectComponents(path.join(workspaceRoot, "app")),
    ...collectComponents(path.join(workspaceRoot, "components")),
  ];

  it("finds source files to audit", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("gates or substitutes every heavy blur layer on mobile", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const line of source.split("\n")) {
        HEAVY_BLUR.lastIndex = 0;
        const matches = [...line.matchAll(HEAVY_BLUR)];
        const heavy = matches.filter(
          (match) => Number(match[1]) >= THRESHOLD_PX
        );
        if (heavy.length === 0) continue;

        const gated =
          line.includes("hidden sm:block") || line.includes("sm:hidden");
        if (!gated) {
          offenders.push(
            `${path.relative(workspaceRoot, file)}: ${heavy[0][0]}`
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the mobile navigation drawer visually intact", () => {
    // The drawer is a mobile surface, so its blur pair is substituted with a
    // radial gradient rather than gated away to nothing.
    const navbar = fs.readFileSync(
      path.join(workspaceRoot, "components/Navbar.tsx"),
      "utf8"
    );
    expect(navbar).toContain("sm:hidden");
    expect(navbar).toContain("radial-gradient");
  });
});
