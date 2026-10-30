import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ADAM_DEFINE_PATH,
  CONTROLLED_TERMINOLOGY,
  DEFINE_PARITY_RULES,
  DEFINE_XML_VERSION,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  PACKAGE_FIXED_TIMESTAMP,
  SDTM_DEFINE_PATH,
  STANDARD_VERSIONS,
  SYNTHETIC_DATA_NOTICE,
  VALUE_LEVEL,
  buildDefine,
  buildStudyDataPackage,
  checkDefineParity,
  defineFileOid,
  itemGroupOid,
  itemOid,
  metaDataVersionOid,
  renderDefineHtml,
  runPipeline,
  toDatasetJson,
  writeDefineXml,
  type Dataset,
  type DefineDocument,
  type DefineLayer,
  type DefineValuesOutsideCodelist,
  type PipelineRun,
} from "@/lib/study-data";
import {
  listDefineSchemaFiles,
  readDefineSchemaFile,
  validateDefineXml,
} from "./helpers/define-xml-schema";

const ODM_NS = "http://www.cdisc.org/ns/odm/v1.3";
const DEF_NS = "http://www.cdisc.org/ns/def/v2.1";
const LAYERS: readonly DefineLayer[] = ["sdtm", "adam"];

/**
 * SHA-256 of every vendored schema file. They must match the table in
 * `__tests__/fixtures/schemas/define-xml-2.1/SOURCE.md`; update both when
 * the schemas are refreshed.
 */
const VENDORED_SHA256: Readonly<Record<string, string>> = {
  LICENSE: "683f463922ef377a1090f17a47e0d5a6466321b64d33392cec2864ea9be2ffd2",
  "cdisc-define-2.1/define-enumerations.xsd":
    "8cc033aa2153c37d6b98ea7b571724988d470acb9109902d19853bbcf6b35960",
  "cdisc-define-2.1/define-extension.xsd":
    "26ea16dbb81c341635f122555e46dc7699d09083a3ec352fa0a50ebae7f3cdb2",
  "cdisc-define-2.1/define-ns.xsd":
    "fd26bc307925600cb075e9400dd1fd3bb98578686274e6db600e19e4ac54e344",
  "cdisc-define-2.1/define2-1-0.xsd":
    "62618c24aa046ecc3f4cb332e95de1281b1d7cbff12702ff2012ed65f3171f18",
  "cdisc-odm-1.3.2/ODM1-3-2-foundation.xsd":
    "005df55770a816a69c9e9262019b2c909c6a952e57138ca661f7afda5a72b271",
  "cdisc-odm-1.3.2/ODM1-3-2.xsd":
    "5f3b701df3e80db4ef27dea1dcfeb8d7dee613fb6946550ec2c1e31606b61cb7",
  "core/LICENSE-W3C":
    "5ecc35275c910850ce41cee0fcd5d95d542d3aaf46918b623bf7788cad2d0625",
  "core/xlink.xsd":
    "e4b134b25c547bc74808bbcc0818febd2f4a58b759556443999365ec4d53d594",
  "core/xml.xsd":
    "258ac9c0f078fc9692735140f2d21541e8bf16941bed42833c1a5f965b52c6dc",
  "core/xmldsig-core-schema.xsd":
    "111a972ccb9916cb95df9af4b6c1775307292463639de69d6fe63516bb2d850e",
};

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const defineOf = (
  source: PipelineRun,
  layer: DefineLayer,
  createdAt = PACKAGE_FIXED_TIMESTAMP
) => buildDefine(source, { layer, createdAt });
const defines: Readonly<Record<DefineLayer, DefineDocument>> = {
  sdtm: defineOf(run, "sdtm"),
  adam: defineOf(run, "adam"),
};
const xml: Readonly<Record<DefineLayer, string>> = {
  sdtm: writeDefineXml(defines.sdtm),
  adam: writeDefineXml(defines.adam),
};

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const utf8Length = (value: string) => new TextEncoder().encode(value).length;

function parseXml(source: string): Document {
  const document = new DOMParser().parseFromString(source, "application/xml");
  const error = document.getElementsByTagName("parsererror")[0];
  if (error) throw new Error(`Not well-formed: ${error.textContent}`);
  return document;
}

const docs: Readonly<Record<DefineLayer, Document>> = {
  sdtm: parseXml(xml.sdtm),
  adam: parseXml(xml.adam),
};

const all = (node: Document | Element, ns: string, name: string) =>
  Array.from(node.getElementsByTagNameNS(ns, name));
const children = (node: Element, ns: string, name: string) =>
  Array.from(node.children).filter(
    (child) => child.namespaceURI === ns && child.localName === name
  );
const attr = (node: Element, name: string) => node.getAttribute(name) ?? "";
const defAttr = (node: Element, name: string) =>
  node.getAttributeNS(DEF_NS, name) ?? "";

const datasetsOf = (source: PipelineRun, layer: DefineLayer) =>
  source.datasets.filter((dataset) => dataset.layer === layer);
const distinct = (values: readonly unknown[]) => [
  ...new Set(
    values.filter((value): value is string => typeof value === "string")
  ),
];

function itemDefs(document: Document): Map<string, Element> {
  return new Map(
    all(document, ODM_NS, "ItemDef").map((node) => [attr(node, "OID"), node])
  );
}

function withDataset(
  name: string,
  change: (dataset: Dataset) => Dataset
): PipelineRun {
  return {
    ...run,
    datasets: run.datasets.map((dataset) =>
      dataset.name === name && dataset.layer !== "collected"
        ? change(dataset)
        : dataset
    ),
  };
}

describe("vendored Define-XML 2.1 schema", () => {
  it("is byte for byte the recorded library-xml copy", () => {
    const files = listDefineSchemaFiles().filter(
      (file) => file !== "SOURCE.md"
    );
    expect(files).toEqual(Object.keys(VENDORED_SHA256).sort());
    for (const file of files) {
      expect(sha256(readDefineSchemaFile(file)), file).toBe(
        VENDORED_SHA256[file]
      );
    }
  });

  it("records the source, licences and hashes in SOURCE.md", () => {
    const source = readDefineSchemaFile("SOURCE.md").toString("utf8");
    expect(source).toContain("f0ca31eae065802e624e2735f3cefa6e73e8a2ec");
    expect(source).toContain("https://github.com/cdisc-org/library-xml");
    const table = Object.fromEntries(
      [
        ...source.matchAll(
          /^\| `([^`]+)`(?: \(written here\))?\s*\| `([0-9a-f]{64})` \|$/gm
        ),
      ].map(([, file, digest]) => [file, digest])
    );
    expect(table).toEqual(VENDORED_SHA256);
    const licence = readDefineSchemaFile("LICENSE").toString("utf8");
    expect(licence).toMatch(/^MIT License\n\nCopyright \(c\) 2021 cdisc\n/);
    expect(readDefineSchemaFile("core/LICENSE-W3C").toString("utf8")).toContain(
      "W3C Software and Document license - 2023 version"
    );
  });

  it("is the Define-XML version the documents declare", () => {
    const schema = readDefineSchemaFile(
      "cdisc-define-2.1/define2-1-0.xsd"
    ).toString("utf8");
    expect(schema).toContain(`Define-XML ${DEFINE_XML_VERSION} schema`);
    expect(DEFINE_XML_VERSION).toBe("2.1.0");
    expect(
      DEFINE_XML_VERSION.startsWith(`${STANDARD_VERSIONS["Define-XML"]}.`)
    ).toBe(true);
    for (const layer of LAYERS) {
      const version = all(docs[layer], ODM_NS, "MetaDataVersion")[0];
      expect(defAttr(version, "DefineVersion")).toBe(DEFINE_XML_VERSION);
    }
  });
});

describe("Define-XML schema validation", () => {
  it("validates the seed-301 SDTM and ADaM documents and a one-subject run", async () => {
    const small = runPipeline(DEMO_301_STUDY, { seed: 7, nSubjects: 1 });
    const errors = await validateDefineXml({
      "sdtm.xml": xml.sdtm,
      "adam.xml": xml.adam,
      "sdtm-1.xml": writeDefineXml(defineOf(small, "sdtm")),
      "adam-1.xml": writeDefineXml(defineOf(small, "adam")),
    });
    expect(errors).toEqual({
      "sdtm.xml": [],
      "adam.xml": [],
      "sdtm-1.xml": [],
      "adam-1.xml": [],
    });
  });

  it("rejects a duplicate OID, a missing structure and an unknown class", async () => {
    // The ODM schema checks that OIDs are unique but not that references
    // resolve; the parity tests below check the references.
    expect(xml.sdtm).toContain('<CodeList OID="CL.SEX"');
    const errors = await validateDefineXml({
      "duplicate-oid.xml": xml.sdtm.replace(
        '<CodeList OID="CL.SEX"',
        '<CodeList OID="CL.NY"'
      ),
      "no-structure.xml": xml.sdtm.replace(/ def:Structure="[^"]*"/, ""),
      "bad-class.xml": xml.adam.replace(
        '<def:Class Name="BASIC DATA STRUCTURE"',
        '<def:Class Name="BASIC"'
      ),
    });
    expect(errors["duplicate-oid.xml"].join("\n")).toMatch(/CL\.NY/);
    expect(errors["no-structure.xml"].join("\n")).toMatch(/Structure/);
    expect(errors["bad-class.xml"].join("\n")).toMatch(/BASIC/);
  });

  it("rejects a document that is not well-formed", async () => {
    const errors = await validateDefineXml({
      "truncated.xml": xml.adam.slice(0, xml.adam.length / 2),
    });
    expect(errors["truncated.xml"].length).toBeGreaterThan(0);
  });
});

describe.each(LAYERS)("%s define/data parity", (layer) => {
  const document = docs[layer];
  const datasets = datasetsOf(run, layer);
  const items = itemDefs(document);
  const groups = all(document, ODM_NS, "ItemGroupDef");

  it("describes every dataset and every variable, in data order, with shared OIDs", () => {
    expect(groups.map((group) => attr(group, "Name"))).toEqual(
      datasets.map((dataset) => dataset.name)
    );
    for (const dataset of datasets) {
      const group = groups.find((node) => attr(node, "Name") === dataset.name)!;
      expect(attr(group, "OID")).toBe(itemGroupOid(dataset.name));
      expect(attr(group, "def:Structure")).toBe(dataset.structure);
      expect(attr(group, "Purpose")).toBe(
        layer === "sdtm" ? "Tabulation" : "Analysis"
      );
      const refs = children(group, ODM_NS, "ItemRef");
      const json = toDatasetJson(dataset, {
        studyId: "DEMO-301",
        createdAt: PACKAGE_FIXED_TIMESTAMP,
      });
      expect(refs.map((ref) => attr(ref, "ItemOID"))).toEqual(
        json.columns.map((column) => column.itemOID)
      );
      expect(refs.map((ref) => attr(ref, "ItemOID"))).toEqual(
        dataset.variables.map((variable) =>
          itemOid(dataset.name, variable.name)
        )
      );
      for (const [index, key] of dataset.keys.entries()) {
        const ref = refs.find(
          (node) => attr(node, "ItemOID") === itemOid(dataset.name, key)
        )!;
        expect(attr(ref, "KeySequence")).toBe(String(index + 1));
        expect(attr(ref, "Mandatory")).toBe("Yes");
      }
    }
  });

  it("agrees with Dataset-JSON on name, label, type and length", () => {
    for (const dataset of datasets) {
      const json = toDatasetJson(dataset, {
        studyId: "DEMO-301",
        createdAt: PACKAGE_FIXED_TIMESTAMP,
      });
      for (const column of json.columns) {
        const item = items.get(column.itemOID)!;
        const where = `${dataset.name}.${column.name}`;
        expect(item, where).toBeDefined();
        expect(attr(item, "Name"), where).toBe(column.name);
        expect(item.textContent?.trim(), where).toContain(column.label);
        const dataType = attr(item, "DataType");
        if (column.targetDataType === "integer") {
          expect(dataType, where).toBe("integer");
          expect(defAttr(item, "DisplayFormat"), where).toBe(
            column.displayFormat
          );
        } else if (column.dataType === "string") {
          expect(dataType, where).toBe("text");
          expect(attr(item, "Length"), where).toBe(String(column.length));
        } else if (column.dataType === "double") {
          expect(dataType, where).toBe("float");
        } else {
          expect(dataType, where).toBe(column.dataType);
        }
      }
    }
  });

  it("resolves every OID reference", () => {
    const defined = new Set(
      Array.from(document.getElementsByTagName("*")).flatMap((node) =>
        node.hasAttribute("OID") ? [attr(node, "OID")] : []
      )
    );
    const leaves = new Set(
      all(document, DEF_NS, "leaf").map((leaf) => attr(leaf, "ID"))
    );
    let references = 0;
    for (const node of Array.from(document.getElementsByTagName("*"))) {
      for (const attribute of Array.from(node.attributes)) {
        const name = attribute.localName;
        if (name === "leafID") {
          expect(leaves.has(attribute.value), attribute.value).toBe(true);
        } else if (
          name.endsWith("OID") &&
          name !== "OID" &&
          name !== "FileOID"
        ) {
          expect(
            defined.has(attribute.value),
            `${name}=${attribute.value}`
          ).toBe(true);
          references += 1;
        }
      }
    }
    expect(references).toBeGreaterThan(200);
  });

  it("has data behind every variable it describes and no unreferenced items", () => {
    const referenced = new Set(
      [
        ...groups.flatMap((group) => children(group, ODM_NS, "ItemRef")),
        ...all(document, DEF_NS, "ValueListDef").flatMap((list) =>
          children(list, ODM_NS, "ItemRef")
        ),
      ].map((ref) => attr(ref, "ItemOID"))
    );
    expect([...items.keys()].sort()).toEqual([...referenced].sort());
    for (const oid of items.keys()) {
      const [, datasetName, variable] = oid.split(".");
      const dataset = datasets.find(
        (candidate) => candidate.name === datasetName
      );
      expect(dataset, oid).toBeDefined();
      expect(dataset!.columns[variable], oid).toHaveLength(dataset!.rowCount);
    }
  });

  it("lists every coded value the data holds in its codelist", () => {
    const codeLists = new Map(
      all(document, ODM_NS, "CodeList").map((list) => [
        attr(list, "OID"),
        new Set(
          [
            ...children(list, ODM_NS, "CodeListItem"),
            ...children(list, ODM_NS, "EnumeratedItem"),
          ].map((term) => attr(term, "CodedValue"))
        ),
      ])
    );
    let checked = 0;
    for (const dataset of datasets) {
      for (const variable of dataset.variables) {
        const item = items.get(itemOid(dataset.name, variable.name))!;
        const ref = children(item, ODM_NS, "CodeListRef")[0];
        if (!ref) continue;
        const terms = codeLists.get(attr(ref, "CodeListOID"))!;
        for (const value of distinct(dataset.columns[variable.name])) {
          expect(
            terms.has(value),
            `${dataset.name}.${variable.name} ${value}`
          ).toBe(true);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("gives every derived variable a method and every collected one a source", () => {
    const methods = new Set(
      all(document, ODM_NS, "MethodDef").map((method) => attr(method, "OID"))
    );
    for (const dataset of datasets) {
      const refs = children(
        groups.find((node) => attr(node, "Name") === dataset.name)!,
        ODM_NS,
        "ItemRef"
      );
      for (const variable of dataset.variables) {
        const oid = itemOid(dataset.name, variable.name);
        const origin = children(items.get(oid)!, DEF_NS, "Origin")[0];
        expect(attr(origin, "Type"), oid).toBe(variable.origin);
        const ref = refs.find((node) => attr(node, "ItemOID") === oid)!;
        if (variable.origin === "Derived") {
          expect(methods.has(attr(ref, "MethodOID")), oid).toBe(true);
        }
        if (variable.origin === "Collected") {
          expect(attr(origin, "Source"), oid).toBe("Investigator");
          expect(origin.textContent, oid).toContain(variable.source);
        }
        if (variable.origin === "Predecessor") {
          expect(origin.textContent, oid).toContain(variable.source);
        }
      }
    }
    for (const method of all(document, ODM_NS, "MethodDef")) {
      expect(method.textContent?.trim().length).toBeGreaterThan(20);
    }
  });
});

describe("checkDefineParity (#2931)", () => {
  const ruleIds = (findings: readonly { ruleId: string }[]) =>
    findings.map((finding) => finding.ruleId);

  it("finds no gap between seed 301's defines and its datasets", () => {
    for (const layer of LAYERS) {
      expect(checkDefineParity(defines[layer], run.datasets)).toEqual([]);
    }
  });

  it("finds no gap across seeds and the messy-data scenarios", () => {
    // Every scenario, the off-codelist ones included: a value outside a
    // non-extensible codelist is kept in the data and left out of the define
    // (#3020), which parity does not compare.
    const scenarios = MESSY_DATA_SCENARIOS.map((scenario) => scenario.id);
    const runs = [
      ...[1, 2, 302, 999].map((seed) => ({ seed })),
      { seed: 301, scenarios },
    ];
    for (const options of runs) {
      const source = runPipeline(DEMO_301_STUDY, { ...options, nSubjects: 60 });
      for (const layer of LAYERS) {
        expect(
          checkDefineParity(defineOf(source, layer), source.datasets),
          `${JSON.stringify(options)} ${layer}`
        ).toEqual([]);
      }
    }
  });

  it("reports an ItemDef no dataset or value list uses", () => {
    const define = defines.sdtm;
    const stray = {
      ...define.items.find((item) => item.dataset === "DM")!,
      oid: "IT.DM.STRAY",
      name: "STRAY",
    };
    const findings = checkDefineParity(
      { ...define, items: [...define.items, stray] },
      run.datasets
    );
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: DEFINE_PARITY_RULES.itemUnused,
        severity: "error",
        layer: "sdtm",
        dataset: "DM",
        variable: "STRAY",
      }),
    ]);
  });

  it("reports a data column the define does not describe", () => {
    const dm = run.datasets.find(
      (dataset) => dataset.layer === "sdtm" && dataset.name === "DM"
    )!;
    const extra: Dataset = {
      ...dm,
      columns: { ...dm.columns, EXTRA: dm.columns.USUBJID },
    };
    const findings = checkDefineParity(
      defines.sdtm,
      run.datasets.map((dataset) => (dataset === dm ? extra : dataset))
    );
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: DEFINE_PARITY_RULES.itemMissing,
        dataset: "DM",
        variable: "EXTRA",
      }),
    ]);
  });

  it("reports a Derived variable whose ItemRef names no method", () => {
    const define = defines.adam;
    const derived = define.items.find(
      (item) => item.origin.type === "Derived" && !item.whereValue
    )!;
    const methodOid = define.itemGroups
      .flatMap((group) => group.itemRefs)
      .find((ref) => ref.itemOid === derived.oid)!.methodOid;
    const findings = checkDefineParity(
      {
        ...define,
        itemGroups: define.itemGroups.map((group) => ({
          ...group,
          itemRefs: group.itemRefs.map((ref) => {
            if (ref.itemOid !== derived.oid) return ref;
            const { methodOid: _dropped, ...rest } = ref;
            return rest;
          }),
        })),
      },
      run.datasets
    );
    const shared = define.itemGroups
      .flatMap((group) => group.itemRefs)
      .filter((ref) => ref.methodOid === methodOid).length;
    expect(ruleIds(findings)).toEqual([
      DEFINE_PARITY_RULES.methodMissing,
      ...(shared === 1 ? [DEFINE_PARITY_RULES.methodUnused] : []),
    ]);
    expect(findings[0]).toMatchObject({
      dataset: derived.dataset,
      variable: derived.name,
    });
  });

  it("reports a dangling codelist reference and a codelist nothing uses", () => {
    const define = defines.sdtm;
    const coded = define.items.findIndex((item) => item.codeListOid);
    const items = define.items.map((item, index) =>
      index === coded ? { ...item, codeListOid: "CL.MISSING" } : item
    );
    const orphan = { ...define.codeLists[0], oid: "CL.ORPHAN", id: "ORPHAN" };
    const findings = checkDefineParity(
      { ...define, items, codeLists: [...define.codeLists, orphan] },
      run.datasets
    );
    expect(ruleIds(findings)).toContain(DEFINE_PARITY_RULES.codeListMissing);
    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId: DEFINE_PARITY_RULES.codeListUnused,
        message: "CodeList CL.ORPHAN is not referenced by any ItemDef.",
      })
    );
  });

  it("reports a dataset with no ItemGroupDef and a dangling where clause", () => {
    const define = defines.sdtm;
    const vs = define.valueLists.find((list) => list.dataset === "VS")!;
    const findings = checkDefineParity(
      {
        ...define,
        itemGroups: define.itemGroups.filter((group) => group.name !== "AE"),
        whereClauses: define.whereClauses.filter(
          (clause) => clause.oid !== vs.itemRefs[0].whereClauseOid
        ),
      },
      run.datasets
    );
    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId: DEFINE_PARITY_RULES.groupMissing,
        dataset: "AE",
      })
    );
    expect(ruleIds(findings)).toContain(DEFINE_PARITY_RULES.whereClauseMissing);
    expect(ruleIds(findings)).toContain(DEFINE_PARITY_RULES.itemUnused);
  });

  it("puts parity findings in the package manifest", async () => {
    const withExtra: PipelineRun = {
      ...run,
      datasets: run.datasets.map((dataset) =>
        dataset.name === "DM"
          ? {
              ...dataset,
              columns: { ...dataset.columns, EXTRA: dataset.columns.USUBJID },
            }
          : dataset
      ),
    };
    const pkg = await buildStudyDataPackage(withExtra, {
      generatedAt: "2026-10-23T12:00:00.000Z",
    });
    expect(
      pkg.packageManifest.findings.filter((finding) =>
        finding.ruleId.startsWith("DEFINE-PARITY-")
      )
    ).toEqual([
      expect.objectContaining({
        ruleId: DEFINE_PARITY_RULES.itemMissing,
        dataset: "DM",
        variable: "EXTRA",
      }),
    ]);
  });
});

describe("value-level metadata", () => {
  it.each([
    ["sdtm", "VS"],
    ["sdtm", "LB"],
    ["adam", "ADVS"],
    ["adam", "ADLB"],
  ] as const)(
    "%s %s has one where clause per parameter in the data",
    (layer, name) => {
      const dataset = datasetsOf(run, layer).find(
        (value) => value.name === name
      )!;
      const spec = VALUE_LEVEL[name];
      const parameters = distinct(dataset.columns[spec.by]).sort();
      const document = docs[layer];
      const clauses = all(document, DEF_NS, "WhereClauseDef").filter((clause) =>
        attr(clause, "OID").startsWith(`WC.${name}.${spec.by}.`)
      );
      expect(
        clauses
          .map((clause) => all(clause, ODM_NS, "CheckValue")[0].textContent)
          .sort()
      ).toEqual(parameters);
      const items = itemDefs(document);
      for (const variable of spec.variables) {
        const list = all(document, DEF_NS, "ValueListDef").find(
          (node) => attr(node, "OID") === `VL.${name}.${variable}`
        )!;
        expect(children(list, ODM_NS, "ItemRef")).toHaveLength(
          parameters.length
        );
        const parent = items.get(itemOid(name, variable))!;
        expect(
          attr(children(parent, DEF_NS, "ValueListRef")[0], "ValueListOID")
        ).toBe(`VL.${name}.${variable}`);
        if (attr(parent, "DataType") !== "text") continue;
        for (const parameter of parameters) {
          const subset = dataset.columns[variable].filter(
            (_, row) => dataset.columns[spec.by][row] === parameter
          );
          const length = Math.max(1, ...distinct(subset).map(utf8Length));
          expect(
            attr(
              items.get(`${itemOid(name, variable)}.${parameter}`)!,
              "Length"
            )
          ).toBe(String(length));
        }
      }
    }
  );
});

describe("codelists", () => {
  const terms = (layer: DefineLayer, oid: string) =>
    defines[layer].codeLists.find((list) => list.oid === oid)!.terms;

  it("flags values the data adds to extensible CDISC codelists", () => {
    const extended = (layer: DefineLayer) =>
      defines[layer].codeLists.flatMap((list) =>
        list.terms
          .filter((term) => term.extended)
          .map((term) => `${list.id} ${term.codedValue}`)
      );
    expect(extended("adam")).toEqual(["SBJTSTAT SCREEN FAILURE"]);
    const node = all(docs.adam, ODM_NS, "EnumeratedItem").find(
      (item) => attr(item, "CodedValue") === "SCREEN FAILURE"
    )!;
    expect(defAttr(node, "ExtendedValue")).toBe("Yes");
    expect(children(node, ODM_NS, "Alias")).toHaveLength(0);
  });

  // #2727: the dose unit is the UNIT term TABLET (C48542), not an extension
  // TABLETS borrowed from the CRF Studio codelist.
  it("writes the tablet dose unit as the CDISC UNIT term", () => {
    expect(
      defines.sdtm.codeLists.flatMap((list) =>
        list.terms.filter((term) => term.extended)
      )
    ).toEqual([]);
    expect(
      terms("sdtm", "CL.UNIT").find((term) => term.codedValue === "TABLET")
    ).toMatchObject({ codedValue: "TABLET", extended: false });
    expect(
      terms("sdtm", "CL.UNIT").some((term) => term.codedValue === "TABLETS")
    ).toBe(false);
  });

  it("carries NCI codes on CDISC codelists and their terms, and none on sponsor lists", () => {
    for (const layer of LAYERS) {
      for (const list of all(docs[layer], ODM_NS, "CodeList")) {
        const id = attr(list, "OID").slice("CL.".length);
        const planned = CONTROLLED_TERMINOLOGY.find(
          (entry) => entry.id === id
        )!;
        const alias = children(list, ODM_NS, "Alias")[0];
        if (!planned.nciCode) {
          expect(alias, id).toBeUndefined();
          continue;
        }
        expect(attr(alias, "Context")).toBe("nci:ExtCodeID");
        expect(attr(alias, "Name")).toBe(planned.nciCode);
        for (const term of [
          ...children(list, ODM_NS, "CodeListItem"),
          ...children(list, ODM_NS, "EnumeratedItem"),
        ]) {
          const termAlias = children(term, ODM_NS, "Alias")[0];
          if (defAttr(term, "ExtendedValue") === "Yes") {
            expect(termAlias).toBeUndefined();
          } else {
            expect(
              attr(termAlias, "Name"),
              `${id} ${attr(term, "CodedValue")}`
            ).toMatch(/^C\d+$/);
          }
        }
      }
    }
  });

  it("decodes test codes with the test names the data carries", () => {
    expect(terms("sdtm", "CL.VSTESTCD").map((term) => term.decode)).toEqual(
      terms("sdtm", "CL.VSTESTCD").map(
        (term) =>
          datasetsOf(run, "sdtm").find((dataset) => dataset.name === "VS")!
            .columns.VSTEST[
            datasetsOf(run, "sdtm")
              .find((dataset) => dataset.name === "VS")!
              .columns.VSTESTCD.indexOf(term.codedValue)
          ]
      )
    );
  });
});

describe("reproducibility and notices", () => {
  it("writes the same bytes for the same seed", () => {
    const again = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    for (const layer of LAYERS) {
      expect(sha256(writeDefineXml(defineOf(again, layer)))).toBe(
        sha256(xml[layer])
      );
    }
  });

  it("uses the caller's creation time and no other clock", () => {
    for (const layer of LAYERS) {
      expect(attr(docs[layer].documentElement, "CreationDateTime")).toBe(
        "1980-01-01T00:00:00Z"
      );
      const later = writeDefineXml(
        defineOf(run, layer, "2027-01-01T08:30:00+01:00")
      );
      expect(later).toBe(
        xml[layer].replace(
          'CreationDateTime="1980-01-01T00:00:00Z"',
          'CreationDateTime="2027-01-01T08:30:00+01:00"'
        )
      );
    }
  });

  it("puts the define files in the package beside the datasets", async () => {
    const pkg = await buildStudyDataPackage(run, {
      generatedAt: "2026-10-23T12:00:00.000Z",
    });
    const text = (path: string) =>
      new TextDecoder().decode(
        pkg.files.find((file) => file.path === path)!.bytes
      );
    expect(text(SDTM_DEFINE_PATH)).toBe(xml.sdtm);
    expect(text(ADAM_DEFINE_PATH)).toBe(xml.adam);
  });

  it("carries the synthetic-data notice and makes no conformance claims", () => {
    for (const layer of LAYERS) {
      const root = docs[layer].documentElement;
      expect(attr(root, "FileOID")).toBe(defineFileOid("DEMO-301", layer));
      expect(attr(root, "Description")).toBe(SYNTHETIC_DATA_NOTICE);
      expect(attr(all(docs[layer], ODM_NS, "MetaDataVersion")[0], "OID")).toBe(
        metaDataVersionOid("DEMO-301", layer)
      );
      expect(xml[layer].split("\n")[1]).toBe(
        `<!-- ${SYNTHETIC_DATA_NOTICE} -->`
      );
      expect(
        all(docs[layer], ODM_NS, "StudyDescription")[0].textContent
      ).toContain(SYNTHETIC_DATA_NOTICE);
      const html = renderDefineHtml(defines[layer]);
      expect(html).toContain(SYNTHETIC_DATA_NOTICE);
      for (const output of [xml[layer], html]) {
        expect(output).not.toMatch(/compliant|validated|Part 11/i);
        expect(output).toContain("is checked against the NCI EVS");
      }
    }
  });
});

describe("buildDefine rejects metadata it cannot describe", () => {
  const sexValue = (dataset: Dataset): Dataset => ({
    ...dataset,
    columns: {
      ...dataset.columns,
      SEX: dataset.columns.SEX.map((value, row) => (row === 0 ? "X" : value)),
    },
  });
  const firstDerived = (dataset: Dataset): Dataset => {
    const index = dataset.variables.findIndex(
      (variable) => variable.origin === "Derived"
    );
    return {
      ...dataset,
      variables: dataset.variables.map((variable, position) =>
        position === index ? { ...variable, method: undefined } : variable
      ),
    };
  };
  it.each([
    ["a creation time without a zone", run, "sdtm", "2026-10-24T10:00:00"],
    [
      "an empty layer",
      { ...run, datasets: datasetsOf(run, "sdtm") },
      "adam",
      PACKAGE_FIXED_TIMESTAMP,
    ],
    [
      "a dataset without a structure",
      withDataset("DM", (dataset) => ({ ...dataset, structure: undefined })),
      "sdtm",
      PACKAGE_FIXED_TIMESTAMP,
    ],
    [
      "an unknown class",
      withDataset("ADSL", (dataset) => ({ ...dataset, class: "Fantasy" })),
      "adam",
      PACKAGE_FIXED_TIMESTAMP,
    ],
    [
      "a Derived variable without a method",
      withDataset("ADSL", firstDerived),
      "adam",
      PACKAGE_FIXED_TIMESTAMP,
    ],
    [
      "a key with missing values",
      withDataset("AE", (dataset) => ({
        ...dataset,
        columns: {
          ...dataset.columns,
          AESEQ: dataset.columns.AESEQ.map((value, row) =>
            row === 0 ? null : value
          ),
        },
      })),
      "sdtm",
      PACKAGE_FIXED_TIMESTAMP,
    ],
  ] as const)("rejects %s", (_case, source, layer, createdAt) => {
    expect(() => buildDefine(source, { layer, createdAt })).toThrow(RangeError);
  });

  it("describes the planned codelist when a value falls outside a non-extensible one (#3020)", () => {
    const source = withDataset("DM", sexValue);
    const outside: DefineValuesOutsideCodelist[] = [];
    const define = buildDefine(source, {
      layer: "sdtm",
      createdAt: PACKAGE_FIXED_TIMESTAMP,
      onValuesOutsideCodelist: (values) => outside.push(values),
    });

    const sexItem = define.items.find(
      (item) => item.dataset === "DM" && item.name === "SEX"
    );
    const sexList = define.codeLists.find(
      (list) => list.oid === sexItem?.codeListOid
    );
    const planned = CONTROLLED_TERMINOLOGY.find(
      (list) => list.id === sexList?.id
    );
    expect(planned?.extensible).toBe(false);
    expect(sexList?.terms.map((term) => term.codedValue)).toEqual(
      planned?.terms.map((term) => term.value)
    );
    expect(outside).toEqual([
      {
        codelist: planned?.id,
        values: ["X"],
        variables: [{ dataset: "DM", variable: "SEX" }],
      },
    ]);
  });
});

describe("renderDefineHtml", () => {
  const html = renderDefineHtml(defines.adam);
  const page = new DOMParser().parseFromString(html, "text/html");

  it("is a pure function of the document", () => {
    expect(renderDefineHtml(defines.adam)).toBe(html);
    expect(
      html.startsWith(
        '<article class="define-xml" lang="en" data-layer="adam">'
      )
    ).toBe(true);
    expect(html).not.toMatch(/<script|<style|\son\w+=/i);
  });

  it("escapes values and links only to anchors it defines", () => {
    expect(html).toContain("&lt;40");
    expect(html).not.toContain("<40");
    const ids = Array.from(page.querySelectorAll("[id]")).map(
      (node) => node.id
    );
    expect(new Set(ids).size).toBe(ids.length);
    const targets = Array.from(page.querySelectorAll('a[href^="#"]')).map(
      (link) => link.getAttribute("href")!.slice(1)
    );
    expect(targets.length).toBeGreaterThan(100);
    for (const target of targets) expect(ids, target).toContain(target);
    expect(page.querySelector('[role="note"]')?.textContent).toBe(
      SYNTHETIC_DATA_NOTICE
    );
  });

  it("shows every dataset, variable and extended term", () => {
    for (const group of defines.adam.itemGroups) {
      const section = page.getElementById(`define-adam-${group.oid}`);
      expect(section, group.name).not.toBeNull();
      for (const ref of group.itemRefs) {
        expect(section!.closest("section")!.textContent).toContain(ref.name);
      }
    }
    expect(page.body.textContent).toContain("SCREEN FAILURE");
    expect(page.body.textContent).toContain("Yes, not in the CT subset");
  });

  it("escapes markup in any field", () => {
    const hostile = '<img src=x onerror="alert(1)"> & "quoted"';
    const document: DefineDocument = {
      ...defines.sdtm,
      metaDataVersionName: hostile,
    };
    const rendered = renderDefineHtml(document);
    expect(rendered).not.toContain("<img");
    expect(rendered).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;quoted&quot;"
    );
    const written = parseXml(writeDefineXml(document));
    expect(attr(all(written, ODM_NS, "MetaDataVersion")[0], "Name")).toBe(
      hostile
    );
  });
});
