// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// #1109: every npm override is a pin someone has to re-audit, so each one
// keeps a row in SECURITY.md saying why it exists and what lifting it costs.

const root = process.cwd();
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf-8")
) as { overrides?: Record<string, string> };
const security = fs.readFileSync(path.join(root, "SECURITY.md"), "utf-8");

describe("npm package overrides are documented (#1109)", () => {
  const section = security.split("## npm Package Overrides")[1] ?? "";

  it("has an overrides section in SECURITY.md", () => {
    expect(section).not.toBe("");
  });

  it.each(Object.entries(pkg.overrides ?? {}))(
    "documents %s at its pinned range",
    (name, range) => {
      const row = section
        .split("\n")
        .find((line) => new RegExp(`^\\|\\s*\`${name}\`\\s*\\|`).test(line));
      expect(row, `${name} needs a row in SECURITY.md`).toBeDefined();
      expect(row).toContain(`\`${range}\``);
    }
  );
});
