// @vitest-environment node
/**
 * Vendored agent skills stay byte-identical to the upstream commit their
 * UPSTREAM.md records, so a local edit can't pass as upstream text (#3041).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();

/** Update these with each folder's UPSTREAM.md when a vendored copy moves. */
const VENDORED = [
  {
    skill: "humanizer",
    source: "https://github.com/blader/humanizer",
    commit: "8c307f367c91bd974002f10f2be2965d642c13df",
    files: {
      "SKILL.md":
        "0612f1dfb1672b0ea9b97e139bf1f06cabe98d8b27424fe8ff01e1fb4cc99cad",
      LICENSE:
        "4ac4810254ab36d45419141aeb8e69bf50652cfafe5b2dab947d06d44e5cbf96",
    },
  },
] as const;

function read(skill: string, file: string): Buffer {
  return fs.readFileSync(path.join(ROOT, ".claude/skills", skill, file));
}

describe.each(VENDORED)("vendored $skill skill", (vendored) => {
  it.each(Object.entries(vendored.files))(
    "%s matches the pinned upstream copy",
    (file, hash) => {
      const actual = createHash("sha256")
        .update(read(vendored.skill, file))
        .digest("hex");
      expect(actual).toBe(hash);
    }
  );

  it("records its source and pinned commit in UPSTREAM.md", () => {
    const upstream = read(vendored.skill, "UPSTREAM.md").toString("utf8");
    expect(upstream).toContain(vendored.commit);
    expect(upstream).toContain(vendored.source);
  });

  it("keeps its MIT licence beside it", () => {
    const skill = read(vendored.skill, "SKILL.md").toString("utf8");
    expect(skill).toMatch(new RegExp(`^name: ${vendored.skill}$`, "m"));
    expect(skill).toMatch(/^license: MIT$/m);
    expect(read(vendored.skill, "LICENSE").toString("utf8")).toMatch(
      /^MIT License/
    );
  });
});

describe("site-prose overlay skill", () => {
  it("builds on the vendored humanizer skill", () => {
    const overlay = fs.readFileSync(
      path.join(ROOT, ".claude/skills/site-prose/SKILL.md"),
      "utf8"
    );
    expect(overlay).toMatch(/^name: site-prose$/m);
    expect(overlay).toContain(".claude/skills/humanizer/");
  });
});
