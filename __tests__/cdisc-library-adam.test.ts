// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  collectVariables,
  crawlProduct,
  linkHrefs,
  pickAdamProducts,
  serializeMetadata,
} from "../scripts/cdisc-library-adam";

// Hand-written in the shape of CDISC Library responses: names and codes
// only, no CDISC text.
const products = {
  _links: {
    self: { href: "/mdr/products" },
    "data-analysis": {
      _links: {
        adam: [
          { href: "/mdr/adam/adam-2-1", title: "x" },
          { href: "/mdr/adam/adamig-1-2", title: "x" },
          { href: "/mdr/adam/adamig-1-3", title: "x" },
          { href: "/mdr/adam/adam-occds-1-0", title: "x" },
          { href: "/mdr/adam/adam-occds-1-1", title: "x" },
        ],
      },
    },
  },
};

const embedded = {
  _links: { self: { href: "/mdr/adam/adamig-1-3" } },
  dataStructures: [
    {
      name: "ADSL",
      analysisVariableSets: [
        {
          name: "Identifier",
          analysisVariables: [
            {
              name: "STUDYID",
              core: "Req",
              simpleDatatype: "Char",
              _links: { self: { href: "/x" } },
            },
            {
              name: "SEX",
              core: "Req",
              simpleDatatype: "Char",
              _links: {
                codelist: [
                  { href: "/mdr/root/ct/sdtmct/codelists/C66731" },
                  { href: "/mdr/root/ct/sdtmct/codelists/C66731" },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: "BDS",
      analysisVariableSets: [
        {
          name: "Analysis Parameter",
          analysisVariables: [
            { name: "PARAMCD", core: "Req", simpleDatatype: "Char" },
            { name: "BASE", core: "Cond", simpleDatatype: "Num" },
          ],
        },
      ],
    },
  ],
};

describe("CDISC Library ADaM metadata (#2992 step 7)", () => {
  it("collects every link href", () => {
    expect(linkHrefs(products)).toContain("/mdr/adam/adam-occds-1-0");
  });

  it("picks the pinned ADaMIG and OCCDS, and names what is listed when one is missing", () => {
    expect(pickAdamProducts(products, { adamig: "1.3", occds: "1.0" })).toEqual(
      { adamig: "/mdr/adam/adamig-1-3", occds: "/mdr/adam/adam-occds-1-0" }
    );
    expect(() =>
      pickAdamProducts(products, { adamig: "1.4", occds: "1.0" })
    ).toThrow(/no ADaMIG 1\.4\. ADaM products listed: \/mdr\/adam\/adam-2-1/);
  });

  it("reads variables by structure from an embedded product", () => {
    const found = collectVariables(embedded);
    expect([...found.keys()]).toEqual(["ADSL", "BDS"]);
    expect(found.get("ADSL")).toEqual([
      { name: "STUDYID", core: "Req", dataType: "Char", codelists: [] },
      { name: "SEX", core: "Req", dataType: "Char", codelists: ["C66731"] },
    ]);
    expect(found.get("BDS")?.map((v) => `${v.name}:${v.core}`)).toEqual([
      "PARAMCD:Req",
      "BASE:Cond",
    ]);
  });

  it("follows links when the product does not embed its variables", async () => {
    const pages: Record<string, unknown> = {
      "/mdr/adam/adam-occds-1-0": {
        _links: {
          dataStructures: [
            { href: "/mdr/adam/adam-occds-1-0/datastructures/OCCDS" },
          ],
          elsewhere: { href: "/mdr/root/ct/sdtmct/codelists/C66731" },
        },
      },
      "/mdr/adam/adam-occds-1-0/datastructures/OCCDS": {
        _links: {
          analysisVariables: [
            {
              href: "/mdr/adam/adam-occds-1-0/datastructures/OCCDS/variables/AEDECOD",
            },
            {
              href: "/mdr/adam/adam-occds-1-0/datastructures/OCCDS/variables/TRTEMFL",
            },
          ],
        },
      },
      "/mdr/adam/adam-occds-1-0/datastructures/OCCDS/variables/AEDECOD": {
        name: "AEDECOD",
        core: "Req",
        simpleDatatype: "Char",
        _links: {
          self: {
            href: "/mdr/adam/adam-occds-1-0/datastructures/OCCDS/variables/AEDECOD",
          },
        },
      },
      "/mdr/adam/adam-occds-1-0/datastructures/OCCDS/variables/TRTEMFL": {
        name: "TRTEMFL",
        core: "Cond",
        _links: {
          parentDatastructure: {
            href: "/mdr/adam/adam-occds-1-0/datastructures/OCCDS",
          },
        },
      },
    };
    const requested: string[] = [];
    const found = await crawlProduct(async (href) => {
      requested.push(href);
      return pages[href];
    }, "/mdr/adam/adam-occds-1-0");
    expect(found.get("OCCDS")?.map((v) => `${v.name}:${v.core}`)).toEqual([
      "AEDECOD:Req",
      "TRTEMFL:Cond",
    ]);
    expect(requested).not.toContain("/mdr/root/ct/sdtmct/codelists/C66731");
    expect(requested).toHaveLength(4);
  });

  it("stops one request after the product when the product embeds everything", async () => {
    let calls = 0;
    await crawlProduct(async () => {
      calls += 1;
      return embedded;
    }, "/mdr/adam/adamig-1-3");
    expect(calls).toBe(1);
  });

  it("refuses to crawl without bound", async () => {
    let n = 0;
    await expect(
      crawlProduct(
        async () => ({ _links: { next: { href: `/p/x/${(n += 1)}` } } }),
        "/p/x",
        5
      )
    ).rejects.toThrow("Stopped after 5 requests");
  });

  it("serializes deterministically, with no labels or descriptions", () => {
    const structures = collectVariables(embedded);
    const text = serializeMetadata(
      { occds: "/mdr/adam/adam-occds-1-0", adamig: "/mdr/adam/adamig-1-3" },
      new Map([...structures].reverse())
    );
    expect(text).toBe(
      serializeMetadata(
        { adamig: "/mdr/adam/adamig-1-3", occds: "/mdr/adam/adam-occds-1-0" },
        structures
      )
    );
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed.structures)).toEqual(["ADSL", "BDS"]);
    expect(Object.keys(parsed.products)).toEqual(["adamig", "occds"]);
    expect(text).not.toMatch(/"(label|description|definition)"/);
  });
});
