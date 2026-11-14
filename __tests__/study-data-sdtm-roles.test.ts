import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";

/**
 * The SDTMIG 3.4 role of every variable the pipeline writes, by dataset,
 * taken from the CDISC Library metadata CORE caches (#2868). CORE-001081
 * compares the Define-XML roles against the same metadata. Each dataset's
 * variables are listed in the IG's order, which CORE-000852 checks (#2870).
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

/**
 * SDTM model variables the pipeline writes that the SDTMIG 3.4 domain tables
 * do not list. MH's MHBDSYCD carries the synthetic SOC code from the AE
 * dictionary (#3719). --BDSYCD is an Events-class variable in SDTM v2.0, so
 * it belongs in MH itself: CORE-000024 expects a code beside MHBODSYS, and
 * CORE-000783 reports a SUPPMH QNAM of MHBDSYCD because the model defines it.
 * The IG metadata has no role for it, so these names skip the IG checks.
 */
const OUTSIDE_IG: Record<string, readonly string[]> = {
  MH: ["MHBDSYCD"],
};
const inIg = (dataset: string, variable: string) =>
  !OUTSIDE_IG[dataset]?.includes(variable);

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
        if (!inIg(name, variable.name)) continue;
        const key = `${name}.${variable.name}`;
        expect(
          IG_ROLES[name][variable.name],
          `${key} is not in the IG`
        ).toBeDefined();
        expect(variable.role, key).toBe(IG_ROLES[name][variable.name]);
      }
    }
  );

  it.each(sdtm.map((dataset) => [dataset.name, dataset] as const))(
    "writes %s's variables in SDTMIG 3.4 order",
    (name, dataset) => {
      const order = Object.keys(IG_ROLES[name]);
      const names = dataset.variables
        .map((variable) => variable.name)
        .filter((variable) => inIg(name, variable));
      expect(names).toEqual(
        [...names].sort((a, b) => order.indexOf(a) - order.indexOf(b))
      );
    }
  );
});
