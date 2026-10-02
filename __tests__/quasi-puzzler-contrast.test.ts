// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(process.cwd(), "components/QuasiPerfectPuzzler");

/**
 * zinc-500 and zinc-600 text on the graphite surfaces falls below the 4.5:1
 * WCAG AA ratio (#1436). Disabled controls are exempt, so the disabled level
 * button in GridCanvas is the one allowed use.
 */
describe("QuasiPerfectPuzzler text contrast", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

  it.each(files)("%s uses no low-contrast zinc text", (file) => {
    const source = readFileSync(path.join(dir, file), "utf8");
    const offenders = source
      .split("\n")
      .filter((line) => /(?<![:\w-])text-zinc-[56]00\b/.test(line))
      .filter((line) => !line.includes("cursor-not-allowed"));
    expect(offenders).toEqual([]);
  });
});
