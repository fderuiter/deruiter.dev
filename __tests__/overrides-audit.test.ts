// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  advisories,
  classifyPin,
  documentedPins,
  listPins,
  placements,
  removable,
  renderSummary,
  versionsOf,
  withoutPin,
  type PinResult,
} from "../scripts/overrides-audit";

/**
 * The npm overrides re-audit (#3671). The scratch installs need the
 * registry, so these tests cover the pure parts: reading pins, removing one,
 * comparing per installed copy, and the report. A live run is
 * `npm run audit:overrides`.
 */

const OVERRIDES = {
  qs: "^6.16.1",
  "markdownlint-cli": { "js-yaml": "~5.4.3", minimatch: "^11.0.1" },
  "@serwist/next": { zod: "$zod" },
};

describe("reading and removing pins", () => {
  it("lists global and scoped pins under SECURITY.md's names", () => {
    expect(listPins(OVERRIDES).map((pin) => pin.label)).toEqual([
      "qs",
      "markdownlint-cli > js-yaml",
      "markdownlint-cli > minimatch",
      "@serwist/next > zod",
    ]);
  });

  it("removes one scoped pin and keeps its siblings", () => {
    const [, yaml] = listPins(OVERRIDES);
    expect(withoutPin(OVERRIDES, yaml)).toEqual({
      qs: "^6.16.1",
      "markdownlint-cli": { minimatch: "^11.0.1" },
      "@serwist/next": { zod: "$zod" },
    });
  });

  it("drops a parent whose last pin is removed, and leaves the input alone", () => {
    const zod = listPins(OVERRIDES).at(-1)!;
    const before = structuredClone(OVERRIDES);
    expect(withoutPin(OVERRIDES, zod)).not.toHaveProperty("@serwist/next");
    expect(OVERRIDES).toEqual(before);
  });
});

describe("comparing per installed copy", () => {
  const lock = {
    packages: {
      "": {},
      "node_modules/minimatch": { version: "3.1.5" },
      "node_modules/typedoc/node_modules/minimatch": { version: "10.2.6" },
      "node_modules/markdownlint-cli/node_modules/minimatch": {
        version: "11.0.3",
      },
      "node_modules/minimatch-extra": { version: "1.0.0" },
    },
  };

  it("lists every copy of a package by path and version", () => {
    expect(placements(lock, "minimatch")).toEqual([
      "node_modules/markdownlint-cli/node_modules/minimatch@11.0.3",
      "node_modules/minimatch@3.1.5",
      "node_modules/typedoc/node_modules/minimatch@10.2.6",
    ]);
    expect(versionsOf(placements(lock, "minimatch"))).toEqual([
      "10.2.6",
      "11.0.3",
      "3.1.5",
    ]);
  });

  it("names each vulnerable copy, and only a package's own advisories", () => {
    const audit = {
      vulnerabilities: {
        minimatch: {
          via: [
            {
              name: "minimatch",
              url: "https://github.com/advisories/GHSA-g3hv-75wg-m249",
              severity: "moderate",
            },
          ],
          nodes: [
            "node_modules/minimatch",
            "node_modules/typedoc/node_modules/minimatch",
          ],
        },
        typedoc: { via: ["minimatch"], nodes: ["node_modules/typedoc"] },
      },
    };
    expect(advisories(audit)).toEqual([
      "GHSA-g3hv-75wg-m249 moderate at node_modules/minimatch",
      "GHSA-g3hv-75wg-m249 moderate at node_modules/typedoc/node_modules/minimatch",
    ]);
  });

  it("counts a new vulnerable copy as needed even when the advisory is already waived elsewhere", () => {
    const baseline = ["GHSA-g3hv-75wg-m249 moderate at node_modules/minimatch"];
    const without = [
      ...baseline,
      "GHSA-g3hv-75wg-m249 moderate at node_modules/markdownlint-cli/node_modules/minimatch",
    ];
    expect(classifyPin(baseline, without, [], [])).toBe("needed");
  });

  it("calls a pin that changes nothing no-effect, and one that moves versions no-new-advisory", () => {
    const placed = ["node_modules/qs@6.16.1"];
    expect(classifyPin([], [], placed, placed)).toBe("no-effect");
    expect(classifyPin([], [], placed, ["node_modules/qs@6.17.1"])).toBe(
      "no-new-advisory"
    );
  });
});

describe("SECURITY.md and the report", () => {
  it("reads the pins SECURITY.md keeps for a reason that is not a vulnerability", () => {
    const security = fs.readFileSync(
      path.resolve(process.cwd(), "SECURITY.md"),
      "utf8"
    );
    expect([...documentedPins(security)]).toEqual([
      "isomorphic-dompurify > jsdom",
    ]);
  });

  it("lists every pin and counts the ones that could go", () => {
    const pins = listPins(OVERRIDES);
    const results: PinResult[] = [
      {
        pin: pins[0],
        status: "needed",
        addedAdvisories: ["GHSA-x moderate at node_modules/qs"],
        versionsWith: ["6.16.1"],
        versionsWithout: ["6.15.1"],
      },
      {
        pin: pins[2],
        status: "no-effect",
        addedAdvisories: [],
        versionsWith: ["11.0.3"],
        versionsWithout: ["11.0.3"],
      },
      {
        pin: pins[3],
        status: "documented",
        addedAdvisories: [],
        versionsWith: ["4.6.7"],
        versionsWithout: ["4.6.5", "4.6.7"],
      },
    ];
    expect(removable(results).map((result) => result.pin.label)).toEqual([
      "markdownlint-cli > minimatch",
    ]);
    const summary = renderSummary(results);
    expect(summary).toContain("3 pins checked; 1 could go.");
    expect(summary).toContain(
      "| `markdownlint-cli > minimatch` | `^11.0.1` | **drop: no effect** | 11.0.3 | none |"
    );
    expect(summary).toContain("kept: reason in SECURITY.md");
  });
});
