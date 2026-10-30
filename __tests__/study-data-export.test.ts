import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  ADAM_DEFINE_PATH,
  ADAM_PACKAGE_DIR,
  CSDRG_PATH,
  MESSY_DATA_SCENARIOS,
  DATASET_JSON_ORIGINATOR,
  DEMO_301_STUDY,
  PACKAGE_FIXED_TIMESTAMP,
  PACKAGE_MANIFEST_PATH,
  PACKAGE_README_PATH,
  PACKAGE_TIMESTAMP_PATH,
  SAS_MISSING_NUMERIC,
  SDTM_DEFINE_PATH,
  SDTM_PACKAGE_DIR,
  STANDARD_VERSIONS,
  SYNTHETIC_DATA_NOTICE,
  XPT_LABEL_PREFIX,
  buildStudyDataPackage,
  encodeIbmFloat,
  exportColumns,
  itemGroupOid,
  itemOid,
  runPipeline,
  sha256Hex,
  toDatasetJson,
  writeCsv,
  writeDatasetJson,
  writeXpt,
  zipStudyDataPackage,
  type Dataset,
  type PackageManifest,
  type VariableMeta,
} from "@/lib/study-data";
import {
  readDatasetJsonSchemaBytes,
  validateDatasetJson,
} from "./helpers/dataset-json-schema";
import { decodeIbmFloat, readXpt, sasDateToIso } from "./helpers/xpt-reader";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const exported = run.datasets.filter(
  (dataset) => dataset.layer !== "collected"
);
const GENERATED_AT = "2026-10-23T12:00:00.000Z";
const options = { studyId: "DEMO-301", createdAt: PACKAGE_FIXED_TIMESTAMP };

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

function variable(
  name: string,
  type: VariableMeta["type"],
  label = name
): VariableMeta {
  return { name, label, type, origin: "Assigned" };
}

function dataset(
  name: string,
  variables: readonly VariableMeta[],
  columns: Record<string, (string | number | null)[]>,
  layer: Dataset["layer"] = "sdtm",
  label = "Test Dataset"
): Dataset {
  const rowCount = Object.values(columns)[0]?.length ?? 0;
  return {
    name,
    label,
    layer,
    class: "Findings",
    keys: [variables[0]?.name ?? ""],
    variables,
    columns,
    rowCount,
  };
}

/** A minimal RFC 4180 parser, to read the CSV back independently. */
function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r" && source[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
    } else cell += char;
  }
  return rows;
}

describe("IBM floating point", () => {
  it.each([
    [0, "0000000000000000"],
    [-0, "0000000000000000"],
    [1, "4110000000000000"],
    [-1, "c110000000000000"],
    [0.5, "4080000000000000"],
    [100, "4264000000000000"],
    [0.1, "401999999999999a"],
    [2 ** 248, "7f10000000000000"],
    [2 ** -260, "0010000000000000"],
    [null, "2e00000000000000"],
  ])("encodes %s as %s", (value, bytes) => {
    expect(hex(encodeIbmFloat(value))).toBe(bytes);
  });

  it("uses the SAS missing value for null", () => {
    expect([...encodeIbmFloat(null)]).toEqual([...SAS_MISSING_NUMERIC]);
    expect(decodeIbmFloat(encodeIbmFloat(null))).toBeNull();
  });

  it.each([Number.NaN, Infinity, -Infinity, 2 ** 252, -(2 ** 252), 2 ** -261])(
    "rejects %s, which an IBM double cannot hold",
    (value) => {
      expect(() => encodeIbmFloat(value)).toThrow(RangeError);
    }
  );

  it("round-trips every double inside the IBM range exactly", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const magnitude = Math.abs(value);
          fc.pre(
            value === 0 || (magnitude < 2 ** 252 && magnitude >= 2 ** -260)
          );
          expect(
            Object.is(
              decodeIbmFloat(encodeIbmFloat(value)),
              value === 0 ? 0 : value
            )
          ).toBe(true);
        }
      ),
      { numRuns: 2000 }
    );
  });
});

describe("Dataset-JSON 1.1", () => {
  it("vendors the schema byte for byte", () => {
    expect(sha256(readDatasetJsonSchemaBytes())).toBe(
      "dd7190ff3782edf31f7de42a3d68c2328e6194e62f9dfbdc2e776edfea2eb09c"
    );
  });

  it("validates every SDTM and ADaM dataset against the published schema", () => {
    for (const data of exported) {
      const doc = JSON.parse(writeDatasetJson(data, options));
      expect(validateDatasetJson(doc), data.name).toEqual([]);
      expect(doc.records).toBe(data.rowCount);
      expect(doc.rows).toHaveLength(data.rowCount);
    }
  });

  it("links datasets and columns through stable OIDs and carries the notice", () => {
    const dm = exported.find((data) => data.name === "DM")!;
    const doc = toDatasetJson(dm, options);
    expect(doc.itemGroupOID).toBe("IG.DM");
    expect(itemGroupOid("DM")).toBe("IG.DM");
    expect(
      doc.columns.find((column) => column.name === "USUBJID")
    ).toMatchObject({
      itemOID: "IT.DM.USUBJID",
      dataType: "string",
      keySequence: 2,
    });
    expect(itemOid("DM", "USUBJID")).toBe("IT.DM.USUBJID");
    expect(doc.originator).toBe(DATASET_JSON_ORIGINATOR);
    expect(doc.originator).toContain(SYNTHETIC_DATA_NOTICE);
    expect(doc.metaDataVersionOID).toBe("MDV.DEMO-301.SDTM");
    expect(
      doc.datasetJSONVersion.startsWith(STANDARD_VERSIONS["Dataset-JSON"])
    ).toBe(true);
  });

  it("marks ADaM dates as SAS numeric dates and keeps SDTM dates as text", () => {
    const adsl = toDatasetJson(
      exported.find((data) => data.name === "ADSL")!,
      options
    );
    expect(
      adsl.columns.find((column) => column.name === "TRTSDT")
    ).toMatchObject({
      dataType: "date",
      targetDataType: "integer",
      displayFormat: "DATE9.",
    });
    const dm = toDatasetJson(
      exported.find((data) => data.name === "DM")!,
      options
    );
    const rfstdtc = dm.columns.find((column) => column.name === "RFSTDTC")!;
    expect(rfstdtc.dataType).toBe("date");
    expect(rfstdtc.targetDataType).toBeUndefined();
    expect(rfstdtc.length).toBe(10);
  });

  it("writes an empty dataset that still validates", () => {
    const empty = dataset(
      "EMPTY",
      [variable("A", "text"), variable("N", "float")],
      {
        A: [],
        N: [],
      }
    );
    const doc = JSON.parse(writeDatasetJson(empty, options));
    expect(validateDatasetJson(doc)).toEqual([]);
    expect(doc.rows).toEqual([]);
    expect(doc.records).toBe(0);
  });

  it("rejects collected data and values that do not match their column", () => {
    const collected = run.datasets.find((data) => data.layer === "collected")!;
    expect(() => toDatasetJson(collected, options)).toThrow(RangeError);
    const bad = dataset("BAD", [variable("N", "integer")], { N: [1.5] });
    expect(() => toDatasetJson(bad, options)).toThrow(TypeError);
    const adam = dataset(
      "ADBAD",
      [variable("ADT", "date")],
      { ADT: ["2030-02"] },
      "adam"
    );
    expect(() => toDatasetJson(adam, options)).toThrow(RangeError);
    const feb30 = dataset(
      "ADBAD",
      [variable("ADT", "date")],
      { ADT: ["2030-02-30"] },
      "adam"
    );
    expect(() => toDatasetJson(feb30, options)).toThrow(RangeError);
  });
});

describe("RFC 4180 CSV", () => {
  it("reads back every value of every dataset", () => {
    for (const data of exported) {
      const csv = writeCsv(data);
      expect(csv.endsWith("\r\n")).toBe(true);
      const [header, ...rows] = parseCsv(csv);
      expect(header).toEqual(data.variables.map((meta) => meta.name));
      expect(rows).toHaveLength(data.rowCount);
      for (const meta of data.variables) {
        const index = header.indexOf(meta.name);
        const expected = data.columns[meta.name].map((value) =>
          value === null ? "" : String(value)
        );
        expect(
          rows.map((row) => row[index]),
          `${data.name}.${meta.name}`
        ).toEqual(expected);
      }
    }
  });

  it("quotes commas, quotes and line breaks, and keeps non-ASCII text", () => {
    const tricky = dataset(
      "TRICKY",
      [variable("A", "text"), variable("N", "float")],
      {
        A: ['say "hi", then go', "line\nbreak", "Ångström µg/L", null],
        N: [1.25, -0, 1e21, null],
      }
    );
    const csv = writeCsv(tricky);
    expect(csv.split("\r\n")[1]).toBe('"say ""hi"", then go",1.25');
    expect(parseCsv(csv)).toEqual([
      ["A", "N"],
      ['say "hi", then go', "1.25"],
      ["line\nbreak", "0"],
      ["Ångström µg/L", "1e+21"],
      ["", ""],
    ]);
  });

  it("writes only the header row for an empty dataset", () => {
    const empty = dataset("EMPTY", [variable("A", "text")], { A: [] });
    expect(writeCsv(empty)).toBe("A\r\n");
  });
});

describe("SAS XPORT v5", () => {
  it("round-trips every value of every SDTM and ADaM dataset", () => {
    for (const data of exported) {
      const { bytes, findings } = writeXpt(data);
      expect(bytes.length % 80).toBe(0);
      const member = readXpt(bytes);
      expect(member.name).toBe(data.name);
      expect(member.label.startsWith(XPT_LABEL_PREFIX)).toBe(true);
      expect(member.rows).toHaveLength(data.rowCount);
      const columns = exportColumns(data);
      columns.forEach((column, index) => {
        const read = member.variables[index];
        expect(read.name).toBe(column.variable.name);
        expect(read.label).toBe(column.variable.label);
        const back = member.rows.map((row) => row[index]);
        const expected =
          column.storage === "sas-date"
            ? back.map((value) =>
                value === null ? null : sasDateToIso(Number(value))
              )
            : back;
        expect(expected, `${data.name}.${column.variable.name}`).toEqual(
          column.values
        );
      });
      expect(
        findings.filter((finding) => finding.ruleId !== "XPT-LABEL-TRUNCATED")
      ).toEqual([]);
    }
  });

  it("writes ADaM dates as numbers with the DATE9. format", () => {
    const adsl = readXpt(
      writeXpt(exported.find((data) => data.name === "ADSL")!).bytes
    );
    const trtsdt = adsl.variables.find((meta) => meta.name === "TRTSDT")!;
    expect(trtsdt).toMatchObject({
      type: "numeric",
      length: 8,
      format: "DATE",
      formatWidth: 9,
    });
    const dm = readXpt(
      writeXpt(exported.find((data) => data.name === "DM")!).bytes
    );
    expect(dm.variables.find((meta) => meta.name === "RFSTDTC")).toMatchObject({
      type: "character",
      length: 10,
    });
  });

  it("writes a dataset with no rows", () => {
    const empty = dataset(
      "EMPTY",
      [variable("A", "text"), variable("N", "float")],
      {
        A: [],
        N: [],
      }
    );
    const member = readXpt(writeXpt(empty).bytes);
    expect(member.variables.map((meta) => meta.name)).toEqual(["A", "N"]);
    expect(member.rows).toEqual([]);
  });

  it("cuts text over 200 bytes at a character boundary and records a finding", () => {
    const long = `${"x".repeat(199)}é and more`;
    const data = dataset("LONG", [variable("TERM", "text")], {
      TERM: [long, "short"],
    });
    const { bytes, findings } = writeXpt(data);
    const member = readXpt(bytes);
    expect(member.variables[0].length).toBe(200);
    expect(member.rows[0][0]).toBe("x".repeat(199));
    expect(member.rows[1][0]).toBe("short");
    expect(findings).toContainEqual(
      expect.objectContaining({
        ruleId: "XPT-VALUE-TRUNCATED",
        severity: "warning",
        dataset: "LONG",
        variable: "TERM",
        row: 0,
      })
    );
    // The other formats keep the full text.
    expect(parseCsv(writeCsv(data))[1][0]).toBe(long);
  });

  it("cuts labels over 40 bytes with a finding and keeps non-ASCII text as UTF-8", () => {
    const data = dataset(
      "UNI",
      [
        variable(
          "UNIT",
          "text",
          "A label that is much longer than forty bytes"
        ),
      ],
      { UNIT: ["µg/L", null, "Ångström"] },
      "sdtm",
      "Unicode"
    );
    const { bytes, findings } = writeXpt(data);
    const member = readXpt(bytes);
    expect(member.label).toBe(`${XPT_LABEL_PREFIX}Unicode`);
    expect(member.variables[0].label).toBe(
      "A label that is much longer than forty b"
    );
    expect(member.variables[0].length).toBe(Buffer.byteLength("Ångström"));
    expect(member.rows.map((row) => row[0])).toEqual([
      "µg/L",
      null,
      "Ångström",
    ]);
    expect(findings.map((finding) => finding.ruleId).sort()).toEqual([
      "XPT-LABEL-TRUNCATED",
      "XPT-NON-ASCII",
    ]);
  });

  it("cannot tell trailing all-blank rows from record padding, a v5 limit", () => {
    // XPT v5 stores no row count. A short, all-character final row that is
    // entirely missing looks like the blank padding of the last record, so
    // readers drop it. Pipeline datasets always carry STUDYID, so none ends
    // with such a row.
    const data = dataset("PAD", [variable("A", "text")], { A: ["x", null] });
    expect(readXpt(writeXpt(data).bytes).rows).toEqual([["x"]]);
    for (const data of exported) {
      const last = data.variables.map((meta) => data.columns[meta.name].at(-1));
      expect(last.some((value) => value !== null && value !== undefined)).toBe(
        data.rowCount > 0
      );
    }
  });

  it.each([
    ["dataset", dataset("TOOLONGNAME", [variable("A", "text")], { A: ["x"] })],
    [
      "variable",
      dataset("OK", [variable("LONGERNAME", "text")], { LONGERNAME: ["x"] }),
    ],
    ["variable", dataset("OK", [variable("1BAD", "text")], { "1BAD": ["x"] })],
    ["dataset", dataset("OK", [], {})],
  ])("rejects a %s that XPT v5 cannot name or hold", (_kind, data) => {
    expect(() => writeXpt(data)).toThrow(RangeError);
  });
});

describe("study data package", () => {
  it("downloads a value outside a non-extensible codelist as collected, with its finding (#3020)", async () => {
    const offList = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 60,
      scenarios: ["off-codelist-non-extensible"],
    });
    const finding = offList.findings.find(
      (f) => f.ruleId === "SD-021" && f.dataset === "DM" && f.variable === "SEX"
    );
    expect(finding).toBeDefined();

    const pkg = await buildStudyDataPackage(offList, {
      generatedAt: GENERATED_AT,
    });
    const file = (path: string) =>
      text(pkg.files.find((f) => f.path === path)!.bytes);

    // The datasets keep the value as collected.
    expect(file(`${SDTM_PACKAGE_DIR}/dm.csv`)).toContain("FEMALE");
    // The define describes the planned SEX codelist, without the value.
    expect(file(SDTM_DEFINE_PATH)).not.toContain('CodedValue="FEMALE"');
    // The manifest and the reviewer guide carry the conformance finding.
    expect(pkg.packageManifest.findings).toContainEqual(finding);
    expect(file(CSDRG_PATH)).toContain("SD-021");
  });

  it("downloads every messy-data scenario", async () => {
    for (const scenario of MESSY_DATA_SCENARIOS) {
      const messy = runPipeline(DEMO_301_STUDY, {
        seed: 301,
        nSubjects: 60,
        scenarios: [scenario.id],
      });
      await expect(
        buildStudyDataPackage(messy, { generatedAt: GENERATED_AT }),
        scenario.id
      ).resolves.toBeDefined();
    }
    // One package per scenario: slower than the default timeout under load.
  }, 120_000);

  it("lays files out like eCTD module 5 and hashes every one of them", async () => {
    const pkg = await buildStudyDataPackage(run, { generatedAt: GENERATED_AT });
    const paths = pkg.files.map((file) => file.path);
    expect(paths).toContain(`${SDTM_PACKAGE_DIR}/dm.json`);
    expect(paths).toContain(`${SDTM_PACKAGE_DIR}/dm.csv`);
    expect(paths).toContain(`${SDTM_PACKAGE_DIR}/dm.xpt`);
    expect(paths).toContain(`${ADAM_PACKAGE_DIR}/adsl.xpt`);
    expect(paths).toContain(SDTM_DEFINE_PATH);
    expect(paths).toContain(ADAM_DEFINE_PATH);
    // Three files per dataset, a define.xml and a reviewer guide per layer,
    // README, MANIFEST and RUN-TIMESTAMP.
    expect(paths).toHaveLength(exported.length * 3 + 2 + 2 + 3);
    expect(paths.slice(-2)).toEqual([
      PACKAGE_MANIFEST_PATH,
      PACKAGE_TIMESTAMP_PATH,
    ]);

    const manifest: PackageManifest = JSON.parse(
      text(pkg.files.find((file) => file.path === PACKAGE_MANIFEST_PATH)!.bytes)
    );
    expect(manifest).toEqual(pkg.packageManifest);
    expect(manifest.notHashed).toEqual([
      PACKAGE_MANIFEST_PATH,
      PACKAGE_TIMESTAMP_PATH,
    ]);
    expect(manifest.seed).toBe(301);
    expect(manifest.standards).toEqual(STANDARD_VERSIONS);
    expect(manifest.fileFormats.xml).toBe("Define-XML 2.1.0");
    expect(
      manifest.files
        .filter((file) => file.path.endsWith("/define.xml"))
        .map((file) => [file.path, file.mediaType])
    ).toEqual([
      [ADAM_DEFINE_PATH, "application/xml"],
      [SDTM_DEFINE_PATH, "application/xml"],
    ]);
    const hashed = pkg.files.filter(
      (file) => !manifest.notHashed.includes(file.path)
    );
    expect(manifest.files.map((file) => file.path)).toEqual(
      hashed.map((file) => file.path)
    );
    for (const file of hashed) {
      const entry = manifest.files.find(
        (candidate) => candidate.path === file.path
      )!;
      expect(entry.sha256).toBe(sha256(file.bytes));
      expect(entry.bytes).toBe(file.bytes.length);
    }
    expect(pkg.manifestSha256).toBe(
      sha256(
        pkg.files.find((file) => file.path === PACKAGE_MANIFEST_PATH)!.bytes
      )
    );
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      sha256("abc")
    );
    // The only findings for seed 301: three dataset labels that do not fit
    // XPT's 40 bytes once the "Synthetic: " prefix is added.
    expect(
      pkg.findings.map((finding) => `${finding.ruleId} ${finding.dataset}`)
    ).toEqual([
      "XPT-LABEL-TRUNCATED TI",
      "XPT-LABEL-TRUNCATED IE",
      "XPT-LABEL-TRUNCATED SUPPDM",
      "XPT-LABEL-TRUNCATED ADSL",
    ]);
    expect(manifest.findings).toEqual(pkg.findings);
  });

  it("fills the run manifest's outputs without changing the run", async () => {
    const before = JSON.stringify(run);
    const pkg = await buildStudyDataPackage(run, { generatedAt: GENERATED_AT });
    expect(JSON.stringify(run)).toBe(before);
    expect(run.manifest.outputs).toEqual([]);
    expect(pkg.manifest.stages).toEqual([
      ...run.manifest.stages,
      "define",
      "export",
    ]);
    expect(pkg.manifest.outputs).toEqual(
      pkg.packageManifest.files.map(({ path, mediaType, sha256: digest }) => ({
        path,
        mediaType,
        sha256: digest,
      }))
    );
    expect(pkg.manifest).toMatchObject({
      studyId: run.manifest.studyId,
      seed: run.manifest.seed,
      nSubjects: run.manifest.nSubjects,
      standards: run.manifest.standards,
    });
  });

  it("carries the synthetic-data notice in every file", async () => {
    const pkg = await buildStudyDataPackage(run, { generatedAt: GENERATED_AT });
    for (const file of pkg.files) {
      if (file.path.endsWith(".csv")) continue;
      if (file.path.endsWith(".xpt")) {
        expect(
          readXpt(file.bytes).label.startsWith(XPT_LABEL_PREFIX),
          file.path
        ).toBe(true);
        continue;
      }
      expect(text(file.bytes), file.path).toContain(SYNTHETIC_DATA_NOTICE);
    }
    const readme = text(
      pkg.files.find((file) => file.path === PACKAGE_README_PATH)!.bytes
    );
    expect(readme).toContain("RFC 4180");
    expect(pkg.packageManifest.csvNotice).toContain("RFC 4180");
  });

  it("matches the seed-301 golden hashes", async () => {
    const pkg = await buildStudyDataPackage(run, { generatedAt: GENERATED_AT });
    const expected = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "__tests__/fixtures/study-data/export/seed-301.json"
        ),
        "utf8"
      )
    );
    expect({
      manifestSha256: pkg.manifestSha256,
      files: Object.fromEntries(
        pkg.packageManifest.files.map((file) => [
          file.path,
          { bytes: file.bytes, sha256: file.sha256 },
        ])
      ),
    }).toEqual(expected);
  });

  it("gives byte-identical packages for the same seed, except the timestamp file", async () => {
    const first = await buildStudyDataPackage(run, {
      generatedAt: GENERATED_AT,
    });
    const again = await buildStudyDataPackage(
      runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 }),
      { generatedAt: GENERATED_AT }
    );
    const later = await buildStudyDataPackage(run, {
      generatedAt: "2027-01-01T08:30:00+01:00",
    });
    const zipFirst = await zipStudyDataPackage(first);
    expect(hex(await zipStudyDataPackage(again))).toBe(hex(zipFirst));
    const zipLater = await zipStudyDataPackage(later);
    expect(hex(zipLater)).not.toBe(hex(zipFirst));

    const read = async (bytes: Uint8Array) => {
      const zip = await JSZip.loadAsync(bytes);
      const entries: Record<string, string> = {};
      for (const entry of Object.values(zip.files)) {
        expect(entry.date.toISOString()).toBe("1980-01-01T00:00:00.000Z");
        entries[entry.name] = sha256(await entry.async("uint8array"));
      }
      return entries;
    };
    const a = await read(zipFirst);
    const b = await read(zipLater);
    expect(Object.keys(a)).toEqual(first.files.map((file) => file.path));
    const differing = Object.keys(a).filter((path) => a[path] !== b[path]);
    expect(differing).toEqual([PACKAGE_TIMESTAMP_PATH]);
    expect(
      JSON.parse(
        text(
          later.files.find((file) => file.path === PACKAGE_TIMESTAMP_PATH)!
            .bytes
        )
      ).generatedAt
    ).toBe("2027-01-01T08:30:00+01:00");
  });

  it("changes dataset hashes when the seed changes", async () => {
    const other = await buildStudyDataPackage(
      runPipeline(DEMO_301_STUDY, { seed: 302, nSubjects: 90 }),
      { generatedAt: GENERATED_AT }
    );
    const base = await buildStudyDataPackage(run, {
      generatedAt: GENERATED_AT,
    });
    const dm = (pkg: typeof base) =>
      pkg.manifest.outputs.find(
        (entry) => entry.path === `${SDTM_PACKAGE_DIR}/dm.xpt`
      )!.sha256;
    expect(dm(other)).not.toBe(dm(base));
    expect(other.packageManifest.seed).toBe(302);
  });

  it.each(["", "2026-10-23", "2026-10-23T12:00:00", "yesterday"])(
    "rejects generatedAt %j",
    async (generatedAt) => {
      await expect(buildStudyDataPackage(run, { generatedAt })).rejects.toThrow(
        RangeError
      );
    }
  );
});
