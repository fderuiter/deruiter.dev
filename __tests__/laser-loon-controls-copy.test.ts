// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { GAME_MANUALS } from "@/lib/game-manuals";

// #1178: Space fires and U triggers the Tremolo. Every place that documents
// the controls has to say the same thing.
describe("Laser Loon controls copy (#1178)", () => {
  const root = process.cwd();
  const read = (file: string) =>
    fs.readFileSync(path.resolve(root, file), "utf8");

  it("binds the Tremolo to U, not Space, in the field manual", () => {
    const tremolo = GAME_MANUALS["laser-loon"].controls.find((c) =>
      c.action.includes("Tremolo")
    );
    expect(tremolo?.key).toMatch(/^U\b/);
    expect(tremolo?.key).not.toMatch(/space/i);
  });

  it("never documents Space as the Tremolo key in the game or its cabinet", () => {
    for (const file of [
      "components/LaserLoon.tsx",
      "components/arcade/LaserLoonClient.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toMatch(
        /SPACE\s*\/\s*U|Space \/ U|Press Space to\s+unleash/
      );
    }
  });
});
