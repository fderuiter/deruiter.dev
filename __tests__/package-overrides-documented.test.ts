// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// #1109: every npm override is a pin someone has to re-audit, so each one
// keeps a row in SECURITY.md saying why it exists and what lifting it costs.

const root = process.cwd();
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf-8")
) as { overrides?: Record<string, string | Record<string, string>> };
// A nested override (`{ parent: { child: range } }`) pins `child` only inside
// `parent`'s subtree, and is documented as `parent > child`.
const pins = Object.entries(pkg.overrides ?? {}).flatMap(([name, range]) =>
  typeof range === "string"
    ? [[name, range]]
    : Object.entries(range).map(([child, r]) => [`${name} > ${child}`, r])
);
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const security = fs.readFileSync(path.join(root, "SECURITY.md"), "utf-8");

describe("npm package overrides are documented (#1109)", () => {
  const section = security.split("## npm Package Overrides")[1] ?? "";

  it("has an overrides section in SECURITY.md", () => {
    expect(section).not.toBe("");
  });

  it.each(pins)("documents %s at its pinned range", (name, range) => {
    const row = section
      .split("\n")
      .find((line) =>
        new RegExp(`^\\|\\s*\`${escapeRegExp(name)}\`\\s*\\|`).test(line)
      );
    expect(row, `${name} needs a row in SECURITY.md`).toBeDefined();
    expect(row).toContain(`\`${range}\``);
  });
});
