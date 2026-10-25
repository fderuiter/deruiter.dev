import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";

/**
 * The SDTMIG 3.4 role of every variable the pipeline writes, by dataset,
 * taken from the CDISC Library metadata CORE caches (#2868). CORE-001081
 * compares the Define-XML roles against the same metadata.
 */
const IG_ROLES: Record<string, Record<string, string>> = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "__tests__/fixtures/study-data/sdtmig-3-4-roles.json"
    ),
    "utf8"
  )
);

/** Variables the IG does not define for their dataset, with the issue that removes them. */
const NOT_IN_IG = new Set(["SV.EPOCH"]); // #2869

const sdtm = runPipeline(DEMO_301_STUDY, {
  seed: 301,
  nSubjects: 90,
}).datasets.filter(
  (dataset) => dataset.layer === "sdtm" && IG_ROLES[dataset.name]
);

describe("SDTM variable roles", () => {
  it.each(sdtm.map((dataset) => [dataset.name, dataset] as const))(
    "gives %s the SDTMIG 3.4 role of each variable",
    (name, dataset) => {
      for (const variable of dataset.variables) {
        const key = `${name}.${variable.name}`;
        if (NOT_IN_IG.has(key)) continue;
        expect(
          IG_ROLES[name][variable.name],
          `${key} is not in the IG`
        ).toBeDefined();
        expect(variable.role, key).toBe(IG_ROLES[name][variable.name]);
      }
    }
  );
});
