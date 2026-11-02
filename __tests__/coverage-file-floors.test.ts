// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  fileFloorFailures,
  type CoverageSummary,
  type FileFloorConfig,
} from "../scripts/check-coverage-file-floors";

// #3486 (G1 of #2513): every file under lib/ and hooks/ meets a coverage
// floor of its own, so a well-covered folder cannot hide a weak file. Files
// below it when the check landed are recorded in a baseline that can only
// shrink.
const ROOT = "/repo";

function metrics(statements: number, branches: number, branchTotal = 10) {
  return {
    statements: { total: 10, covered: statements / 10, pct: statements },
    branches: {
      total: branchTotal,
      covered: (branches * branchTotal) / 100,
      pct: branches,
    },
  };
}

const CONFIG: FileFloorConfig = {
  include: ["lib/", "hooks/"],
  floor: { statements: 60, branches: 50 },
  baseline: { "lib/old.ts": { statements: 40, branches: 30 } },
};

function summary(
  files: Record<string, ReturnType<typeof metrics>>
): CoverageSummary {
  return {
    total: metrics(90, 90),
    ...Object.fromEntries(
      Object.entries(files).map(([file, value]) => [`${ROOT}/${file}`, value])
    ),
  };
}

describe("fileFloorFailures", () => {
  it("passes files at the floor and the baseline at its recorded coverage", () => {
    expect(
      fileFloorFailures(
        summary({
          "lib/a.ts": metrics(60, 50),
          "hooks/useB.ts": metrics(95, 90),
          "lib/old.ts": metrics(40, 30),
        }),
        CONFIG,
        ROOT
      )
    ).toEqual([]);
  });

  it("fails a new file below the floor on either metric", () => {
    expect(
      fileFloorFailures(
        summary({
          "lib/old.ts": metrics(40, 30),
          "lib/new.ts": metrics(59.9, 80),
          "hooks/useNew.ts": metrics(80, 49),
        }),
        CONFIG,
        ROOT
      )
    ).toEqual([
      "hooks/useNew.ts: branches 49.00% is below the per-file floor of 50%.",
      "lib/new.ts: statements 59.90% is below the per-file floor of 60%.",
    ]);
  });

  it("fails a baseline file that falls below its recorded coverage", () => {
    expect(
      fileFloorFailures(
        summary({ "lib/old.ts": metrics(35, 30) }),
        CONFIG,
        ROOT
      )
    ).toEqual([
      "lib/old.ts: statements 35.00% fell below its baseline of 40%.",
    ]);
  });

  it("asks for a baseline entry to go once the file meets the floor", () => {
    expect(
      fileFloorFailures(
        summary({ "lib/old.ts": metrics(70, 55) }),
        CONFIG,
        ROOT
      )
    ).toEqual([
      "lib/old.ts: meets the floor now; remove its entry from the baseline.",
    ]);
  });

  it("asks for a baseline entry to go once its file is gone", () => {
    expect(fileFloorFailures(summary({}), CONFIG, ROOT)).toEqual([
      "lib/old.ts: has no coverage entry (moved or deleted); remove it from the baseline.",
    ]);
  });

  it("ignores files outside the included prefixes", () => {
    expect(
      fileFloorFailures(
        summary({
          "lib/old.ts": metrics(40, 30),
          "components/Weak.tsx": metrics(10, 0),
        }),
        CONFIG,
        ROOT
      )
    ).toEqual([]);
  });

  it("counts a file with no branches as fully covered for branches", () => {
    expect(
      fileFloorFailures(
        summary({
          "lib/old.ts": metrics(40, 30),
          "lib/flat.ts": metrics(80, 0, 0),
        }),
        CONFIG,
        ROOT
      )
    ).toEqual([]);
  });
});

describe("config/coverage-file-floors.json", () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "config/coverage-file-floors.json"),
      "utf8"
    )
  ) as FileFloorConfig;

  it("holds lib/ and hooks/ to 60% statements and 50% branches", () => {
    expect(config.include).toEqual(["lib/", "hooks/"]);
    expect(config.floor).toEqual({ statements: 60, branches: 50 });
  });

  it("lists only existing files that sit below the floor", () => {
    expect(Object.keys(config.baseline).length).toBeGreaterThan(0);
    for (const [file, recorded] of Object.entries(config.baseline)) {
      expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(true);
      expect(
        config.include.some((include) => file.startsWith(include)),
        file
      ).toBe(true);
      expect(
        recorded.statements < config.floor.statements ||
          recorded.branches < config.floor.branches,
        file
      ).toBe(true);
    }
  });

  it("is checked in the merged coverage job", () => {
    const ci = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8"
    );
    const job = ci.slice(
      ci.indexOf("  unit-coverage:"),
      ci.indexOf("  mutation-gate:")
    );
    expect(job).toContain(
      "scripts/check-coverage-file-floors.ts coverage/coverage-summary.json"
    );
  });
});
