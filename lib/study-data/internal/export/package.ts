/**
 * The study data package: every SDTM and ADaM dataset as Dataset-JSON, CSV
 * and XPT, a Define-XML document and a reviewer guide per layer, laid out
 * like eCTD module 5, with a README, a manifest of SHA-256 hashes and one
 * declared timestamp file.
 *
 * Only `RUN-TIMESTAMP.json` depends on when the package was built. Every
 * other file, the manifest and the zip archive depend only on the run, so the
 * same study, seed and subject count give the same bytes. Hashing uses Web
 * Crypto, which the browser, the pipeline's Web Worker and Node all provide.
 * `jszip` is loaded on demand inside {@link zipStudyDataPackage}, so
 * importing the module costs nothing until a zip is requested.
 */
import {
  PIPELINE_STAGES,
  STANDARD_VERSIONS,
  SYNTHETIC_DATA_NOTICE,
} from "../../presets";
import type {
  ArsReportingEvent,
  Dataset,
  Finding,
  ManifestEntry,
  PipelineRun,
  PipelineStageId,
  RunManifest,
  StandardVersions,
} from "../../types";
import { buildDefine, DEFINE_XML_VERSION } from "../define/build-define";
import { checkDefineParity } from "../define/parity";
import { writeDefineXml } from "../define/write-define-xml";
import { writeReviewerGuideDocument } from "../guides/render-reviewer-guide";
import { buildReviewerGuides } from "../guides/reviewer-guides";
import { checkReportingEvent } from "../tlf/check-reporting-event";
import { utf8 } from "./columns";
import { writeCsv } from "./csv";
import { writeDatasetJson } from "./dataset-json";
import { writeXpt } from "./xpt";

/** Folder of the SDTM tabulation datasets. */
export const SDTM_PACKAGE_DIR = "m5/datasets/tabulations/sdtm";
/** Folder of the ADaM analysis datasets. */
export const ADAM_PACKAGE_DIR = "m5/datasets/analysis/adam";
/** The SDTM Define-XML document, beside the datasets it describes. */
export const SDTM_DEFINE_PATH = `${SDTM_PACKAGE_DIR}/define.xml`;
/** The ADaM Define-XML document, beside the datasets it describes. */
export const ADAM_DEFINE_PATH = `${ADAM_PACKAGE_DIR}/define.xml`;
/** The cSDRG-lite, beside the SDTM datasets it describes. */
export const CSDRG_PATH = `${SDTM_PACKAGE_DIR}/csdrg.html`;
/** The ADRG-lite, beside the ADaM datasets it describes. */
export const ADRG_PATH = `${ADAM_PACKAGE_DIR}/adrg.html`;
/** The manifest file at the package root. */
export const PACKAGE_MANIFEST_PATH = "MANIFEST.json";
/** The README at the package root. */
export const PACKAGE_README_PATH = "README.txt";
/** The one file whose content depends on when the package was built. */
export const PACKAGE_TIMESTAMP_PATH = "RUN-TIMESTAMP.json";
/**
 * Timestamp written wherever a format requires one (Dataset-JSON creation
 * time, XPT headers, zip entry dates): the start of the DOS date range zip
 * uses, so the bytes depend only on the run. The real build time is in
 * {@link PACKAGE_TIMESTAMP_PATH}.
 */
export const PACKAGE_FIXED_TIMESTAMP = "1980-01-01T00:00:00Z";
/** Version of the package layout and manifest shape. */
export const PACKAGE_FORMAT_VERSION = "1.0";

const MEDIA_TYPES = {
  json: "application/json",
  csv: "text/csv",
  xpt: "application/x-sas-xport",
  txt: "text/plain",
  xml: "application/xml",
  html: "text/html",
} as const;

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** One file of the package. */
export interface PackageFile {
  /** Package-relative path. */
  readonly path: string;
  /** Media type. */
  readonly mediaType: string;
  /** File bytes. */
  readonly bytes: Uint8Array;
}

/** `MANIFEST.json`: the run inputs, standards and a hash of every file. */
export interface PackageManifest {
  readonly notice: string;
  readonly formatVersion: string;
  readonly studyId: string;
  readonly seed: number;
  readonly nSubjects: number;
  readonly standards: StandardVersions;
  readonly fileFormats: Readonly<
    Record<"json" | "csv" | "xpt" | "xml" | "html", string>
  >;
  readonly stages: readonly PipelineStageId[];
  readonly fixedTimestamp: string;
  readonly timestampFile: string;
  readonly notHashed: readonly string[];
  readonly csvNotice: string;
  readonly files: readonly (ManifestEntry & {
    readonly bytes: number;
    readonly dataset?: string;
  })[];
  readonly findings: readonly Finding[];
}

/** A built package, before it is zipped. */
export interface StudyDataPackage {
  /** The run manifest with `outputs` filled and the export stage added. */
  readonly manifest: RunManifest;
  /** The content of `MANIFEST.json`. */
  readonly packageManifest: PackageManifest;
  /** SHA-256 of the `MANIFEST.json` bytes, which hold no timestamp. */
  readonly manifestSha256: string;
  /** Every file, the manifest and the timestamp file included, by path. */
  readonly files: readonly PackageFile[];
  /** Findings the formats' limits raised, for example XPT truncations. */
  readonly findings: readonly Finding[];
}

/** Inputs to {@link buildStudyDataPackage}. */
export interface PackageOptions {
  /**
   * When the package was built, as an ISO 8601 timestamp with a zone, for
   * example `new Date().toISOString()`. It is written to
   * `RUN-TIMESTAMP.json` only and is not hashed.
   */
  readonly generatedAt: string;
  /**
   * The run's ARS reporting event, from `buildTlfOutputs`. When given, the
   * ADRG-lite lists every output and the analyses it displays, and every
   * result whose rows do not resolve in the run is a finding.
   */
  readonly reportingEvent?: ArsReportingEvent;
}

const CSV_NOTICE =
  "RFC 4180 CSV has no comment syntax, so a notice line inside a CSV file would be read as a data row. The notice for the CSV files is carried by this manifest and README.txt.";

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

/**
 * Lowercase hex SHA-256 of some bytes, through Web Crypto.
 *
 * @throws Error when the platform has no Web Crypto.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is not available.");
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return toHex(await subtle.digest("SHA-256", copy.buffer));
}

function packageDir(dataset: Dataset): string {
  return dataset.layer === "sdtm" ? SDTM_PACKAGE_DIR : ADAM_PACKAGE_DIR;
}

function readme(run: PipelineRun, generatedFiles: readonly string[]): string {
  const { manifest } = run;
  const lines = [
    `Study data package for ${manifest.studyId}`,
    "",
    SYNTHETIC_DATA_NOTICE,
    "",
    `Seed ${manifest.seed}, ${manifest.nSubjects} subjects. The same study, seed and subject count give the same files, byte for byte.`,
    "",
    "Layout, modelled on eCTD module 5:",
    `  ${SDTM_PACKAGE_DIR}/  SDTM tabulation datasets`,
    `  ${ADAM_PACKAGE_DIR}/  ADaM analysis datasets`,
    "",
    "Each dataset is written three ways:",
    `  .json  structured like CDISC Dataset-JSON ${STANDARD_VERSIONS["Dataset-JSON"]}; the notice is in "originator"`,
    "  .csv   RFC 4180, header row of variable names, CRLF line endings",
    '  .xpt   structured like SAS XPORT v5; the dataset label starts with "Synthetic: "',
    "",
    `Each folder also holds define.xml, Define-XML ${DEFINE_XML_VERSION} metadata for its datasets, generated from the same specifications as the data. Its def:leaf entries point to the .xpt files. The notice is in its study description.`,
    "",
    "Reviewer guides, generated from this run and modelled on the PHUSE templates:",
    `  ${CSDRG_PATH}  cSDRG-lite: data flow, standards, SDTM datasets, conformance findings explained, derivations`,
    `  ${ADRG_PATH}  ADRG-lite: the same for ADaM, plus the analysis output index`,
    "",
    CSV_NOTICE.replace("this manifest", PACKAGE_MANIFEST_PATH),
    "",
    `${PACKAGE_MANIFEST_PATH} lists the SHA-256 of every file except itself and ${PACKAGE_TIMESTAMP_PATH}.`,
    `${PACKAGE_TIMESTAMP_PATH} holds when the package was built. It is the only file that changes between builds of the same run.`,
    `Timestamps required inside the formats (Dataset-JSON creation time, XPT headers, Define-XML creation time, zip entry dates) are fixed at ${PACKAGE_FIXED_TIMESTAMP}.`,
    "",
    "Standards applied:",
    ...Object.entries(manifest.standards).map(
      ([standard, version]) => `  ${standard} ${version}`
    ),
    "",
    `${generatedFiles.length} dataset files.`,
    "",
  ];
  return lines.join("\r\n");
}

/**
 * Builds the study data package for a pipeline run.
 *
 * Every SDTM and ADaM dataset is written as Dataset-JSON, CSV and XPT under
 * the eCTD module 5 folders, and each folder gets a Define-XML document and
 * a reviewer guide (cSDRG-lite or ADRG-lite) for its datasets; collected data
 * is not exported. The returned run manifest has
 * `outputs` filled with the path, media type and SHA-256 of every hashed
 * file, and `define` and `export` added to its stages.
 *
 * @param run - A pipeline run from `runPipeline`.
 * @param options - When the package was built, and the reporting event for
 *   the ADRG-lite's output index.
 * @returns The files, the manifest and the findings the formats raised.
 * @throws RangeError when `generatedAt` is not an ISO 8601 timestamp, two
 *   exported datasets share a name, a dataset cannot be written as XPT, the
 *   metadata cannot be written as Define-XML (see `buildDefine`), or a
 *   derived variable names a method with no derivation text.
 */
export async function buildStudyDataPackage(
  run: PipelineRun,
  options: PackageOptions
): Promise<StudyDataPackage> {
  if (!ISO_TIMESTAMP.test(options.generatedAt)) {
    throw new RangeError(
      `generatedAt must be an ISO 8601 timestamp with a zone, got "${options.generatedAt}".`
    );
  }
  const { manifest } = run;
  const exported = run.datasets.filter(
    (dataset) => dataset.layer === "sdtm" || dataset.layer === "adam"
  );
  const names = new Set<string>();
  for (const dataset of exported) {
    if (names.has(dataset.name)) {
      throw new RangeError(`Two exported datasets are named ${dataset.name}.`);
    }
    names.add(dataset.name);
  }

  const findings: Finding[] = [];
  const datasetFiles: (PackageFile & { readonly dataset: string })[] = [];
  for (const dataset of exported) {
    const base = `${packageDir(dataset)}/${dataset.name.toLowerCase()}`;
    const xpt = writeXpt(dataset);
    findings.push(...xpt.findings);
    datasetFiles.push(
      {
        path: `${base}.json`,
        mediaType: MEDIA_TYPES.json,
        bytes: utf8(
          writeDatasetJson(dataset, {
            studyId: manifest.studyId,
            createdAt: PACKAGE_FIXED_TIMESTAMP,
          })
        ),
        dataset: dataset.name,
      },
      {
        path: `${base}.csv`,
        mediaType: MEDIA_TYPES.csv,
        bytes: utf8(writeCsv(dataset)),
        dataset: dataset.name,
      },
      {
        path: `${base}.xpt`,
        mediaType: MEDIA_TYPES.xpt,
        bytes: xpt.bytes,
        dataset: dataset.name,
      }
    );
  }
  // Each define is checked against the datasets it describes before it is
  // written, so a gap between the two is a finding in the package manifest.
  // A value outside a non-extensible codelist stays in the datasets as
  // collected and out of the define; the run's conformance findings on that
  // variable go into the manifest with it, so the package still downloads
  // and says why (#3020).
  const defineFor = (layer: "sdtm" | "adam") => {
    const define = buildDefine(run, {
      layer,
      createdAt: PACKAGE_FIXED_TIMESTAMP,
      onValuesOutsideCodelist: ({ variables }) => {
        findings.push(
          ...run.findings.filter(
            (finding) =>
              finding.layer === layer &&
              variables.some(
                ({ dataset, variable }) =>
                  finding.dataset === dataset && finding.variable === variable
              ) &&
              !findings.includes(finding)
          )
        );
      },
    });
    findings.push(...checkDefineParity(define, exported));
    return define;
  };
  const defineFiles: PackageFile[] = (["sdtm", "adam"] as const)
    .filter((layer) => exported.some((dataset) => dataset.layer === layer))
    .map((layer) => ({
      path: layer === "sdtm" ? SDTM_DEFINE_PATH : ADAM_DEFINE_PATH,
      mediaType: MEDIA_TYPES.xml,
      bytes: utf8(writeDefineXml(defineFor(layer))),
    }));
  if (options.reportingEvent) {
    findings.push(...checkReportingEvent(options.reportingEvent, run));
  }
  const guides = buildReviewerGuides(run, options.reportingEvent);
  const guideFiles: PackageFile[] = [
    { path: CSDRG_PATH, guide: guides.csdrg },
    { path: ADRG_PATH, guide: guides.adrg },
  ]
    .filter(({ guide }) => guide.datasets.length > 0)
    .map(({ path, guide }) => ({
      path,
      mediaType: MEDIA_TYPES.html,
      bytes: utf8(writeReviewerGuideDocument(guide)),
    }));
  const contentFiles: (PackageFile & { readonly dataset?: string })[] = [
    ...datasetFiles,
    ...defineFiles,
    ...guideFiles,
  ].sort((a, b) => compareCodePoints(a.path, b.path));

  const readmeFile: PackageFile = {
    path: PACKAGE_README_PATH,
    mediaType: MEDIA_TYPES.txt,
    bytes: utf8(
      readme(
        run,
        datasetFiles.map((file) => file.path)
      )
    ),
  };
  const hashed: (PackageFile & { readonly dataset?: string })[] = [
    readmeFile,
    ...contentFiles,
  ];
  const digests = await Promise.all(
    hashed.map((file) => sha256Hex(file.bytes))
  );
  const outputs: ManifestEntry[] = hashed.map((file, index) => ({
    path: file.path,
    mediaType: file.mediaType,
    sha256: digests[index],
  }));
  const exportOrder = PIPELINE_STAGES.map((stage) => stage.id);
  const stages = [
    ...new Set<PipelineStageId>([...manifest.stages, "define", "export"]),
  ].sort((a, b) => exportOrder.indexOf(a) - exportOrder.indexOf(b));
  const runManifest: RunManifest = { ...manifest, stages, outputs };

  const packageManifest: PackageManifest = {
    notice: SYNTHETIC_DATA_NOTICE,
    formatVersion: PACKAGE_FORMAT_VERSION,
    studyId: manifest.studyId,
    seed: manifest.seed,
    nSubjects: manifest.nSubjects,
    standards: manifest.standards,
    fileFormats: {
      json: `Dataset-JSON ${STANDARD_VERSIONS["Dataset-JSON"]}`,
      csv: "RFC 4180",
      xpt: "SAS XPORT v5",
      xml: `Define-XML ${DEFINE_XML_VERSION}`,
      html: "HTML reviewer guides (cSDRG-lite, ADRG-lite)",
    },
    stages,
    fixedTimestamp: PACKAGE_FIXED_TIMESTAMP,
    timestampFile: PACKAGE_TIMESTAMP_PATH,
    notHashed: [PACKAGE_MANIFEST_PATH, PACKAGE_TIMESTAMP_PATH],
    csvNotice: CSV_NOTICE,
    files: hashed.map((file, index) => ({
      ...outputs[index],
      bytes: file.bytes.length,
      ...(file.dataset === undefined ? {} : { dataset: file.dataset }),
    })),
    findings,
  };
  const manifestBytes = utf8(`${JSON.stringify(packageManifest, null, 2)}\n`);
  const timestampBytes = utf8(
    `${JSON.stringify(
      {
        notice: SYNTHETIC_DATA_NOTICE,
        generatedAt: options.generatedAt,
        note: `Not hashed in ${PACKAGE_MANIFEST_PATH}: the only file that differs between builds of the same run.`,
      },
      null,
      2
    )}\n`
  );
  return {
    manifest: runManifest,
    packageManifest,
    manifestSha256: await sha256Hex(manifestBytes),
    files: [
      ...hashed.map(({ path, mediaType, bytes }) => ({
        path,
        mediaType,
        bytes,
      })),
      {
        path: PACKAGE_MANIFEST_PATH,
        mediaType: MEDIA_TYPES.json,
        bytes: manifestBytes,
      },
      {
        path: PACKAGE_TIMESTAMP_PATH,
        mediaType: MEDIA_TYPES.json,
        bytes: timestampBytes,
      },
    ],
    findings,
  };
}

/**
 * Zips a built package. Entries are stored in the package's file order with
 * the fixed timestamp and DEFLATE level 6, so the same package always zips
 * to the same bytes.
 *
 * @param pkg - The result of {@link buildStudyDataPackage}.
 * @returns The archive bytes.
 */
export async function zipStudyDataPackage(
  pkg: StudyDataPackage
): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const date = new Date(PACKAGE_FIXED_TIMESTAMP);
  for (const file of pkg.files) {
    zip.file(file.path, file.bytes, {
      date,
      createFolders: false,
      binary: true,
    });
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "DOS",
  });
}
