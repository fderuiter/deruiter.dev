// @vitest-environment node
/**
 * The conformance rule crosswalk (#2994). Every local rule is recorded either
 * against the CDISC CORE rules that catch the same defect, measured by
 * planting the defect and running CORE, or as local with the reason CORE does
 * not cover it. A rule cannot be added, removed or renamed without the ledger
 * following, which is the regression net for retiring duplicates (#2992).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONFORMANCE_RULES } from "@/lib/study-data";

interface CrosswalkEntry {
  readonly ruleId: string;
  readonly core: readonly string[];
  readonly coverage: "same-defect" | "related" | "none";
  readonly planted?: string;
  readonly reason: string;
}

const crosswalk = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "scripts/study-data-core-crosswalk.json"),
    "utf8"
  )
) as {
  readonly engine: string;
  readonly standard: string;
  readonly entries: readonly CrosswalkEntry[];
};

describe("conformance rule crosswalk to CDISC CORE", () => {
  it("records every local rule exactly once, in rule order", () => {
    expect(crosswalk.entries.map((entry) => entry.ruleId)).toEqual(
      CONFORMANCE_RULES.map((rule) => rule.id)
    );
  });

  it("names the CORE release the pairings were measured with", () => {
    expect(crosswalk.engine).toMatch(/^CDISC CORE v\d+\.\d+\.\d+$/);
    expect(crosswalk.standard).toBe("SDTMIG 3.4");
  });

  it.each(crosswalk.entries)("$ruleId has CORE ids or a reason", (entry) => {
    expect(entry.reason.length).toBeGreaterThan(20);
    for (const id of entry.core) expect(id).toMatch(/^CORE-\d{6}$/);
    expect(new Set(entry.core).size).toBe(entry.core.length);
    if (entry.coverage === "none") expect(entry.core).toEqual([]);
    else expect(entry.core.length).toBeGreaterThan(0);
  });

  it("records how each SDTM pairing was measured", () => {
    const sdtm = new Set(
      CONFORMANCE_RULES.filter(
        (rule) => rule.scope.layer === "sdtm" && rule.kind !== "lineage"
      ).map((rule) => rule.id)
    );
    for (const entry of crosswalk.entries.filter((item) =>
      sdtm.has(item.ruleId)
    ))
      expect(entry.planted, entry.ruleId).toEqual(expect.any(String));
  });

  it("keeps ADaM and lineage rules local, since CORE has no rules for them", () => {
    const local = CONFORMANCE_RULES.filter(
      (rule) => rule.scope.layer === "adam" || rule.kind === "lineage"
    ).map((rule) => rule.id);
    for (const entry of crosswalk.entries.filter((item) =>
      local.includes(item.ruleId)
    ))
      expect(entry.coverage, entry.ruleId).toBe("none");
  });
});
