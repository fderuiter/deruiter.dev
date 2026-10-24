/**
 * The reporting stage: runs the reporting plan against a pipeline run and
 * returns the ARS reporting event and the tables, and writes them as files.
 */
import { STANDARD_VERSIONS, SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  ArsDisplaySection,
  ArsListItem,
  ArsOutput,
  ArsReportingEvent,
  PipelineRun,
  StudyDefinition,
  TlfOutputs,
  TlfTable,
} from "../../types";
import { utf8 } from "../export/columns";
import type { PackageFile } from "../export/package";
import { evaluateAnalyses } from "./evaluate";
import { writeTableHtml } from "./html";
import { buildReportingPlan, type ReportingPlan } from "./plan";
import { writeTableRtf } from "./rtf";
import { buildTables } from "./tables";

/** Folder the table files are written to. */
export const TLF_OUTPUT_DIR = "tlf";
/** Path of the ARS reporting event JSON, next to the tables. */
export const ARS_REPORTING_EVENT_PATH = `${TLF_OUTPUT_DIR}/ars-reporting-event.json`;

function analysisIdsOf(table: TlfTable): readonly string[] {
  const ids = new Set<string>();
  const add = (resultId: string) => ids.add(resultId.replace(/\.\d+$/, ""));
  for (const column of table.columns) add(column.bigNResultId);
  for (const section of table.sections) {
    for (const cell of section.cells ?? []) cell.resultIds.forEach(add);
    for (const row of section.rows) {
      for (const cell of row.cells) cell.resultIds.forEach(add);
    }
  }
  return [...ids];
}

function displaySections(table: TlfTable): ArsDisplaySection[] {
  const subSections = (prefix: string, texts: readonly string[]) =>
    texts.map((text, index) => ({
      order: index + 1,
      subSection: { id: `${table.displayId}_${prefix}${index + 1}`, text },
    }));
  return [
    {
      sectionType: "Title",
      orderedSubSections: subSections("Title", [
        `Table ${table.number}`,
        table.title,
        table.population,
      ]),
    },
    {
      sectionType: "Rowlabel Header",
      orderedSubSections: subSections("Rowlabel", [table.stubHeader]),
    },
    {
      sectionType: "Footnote",
      orderedSubSections: subSections("Footnote", [
        ...table.footnotes,
        table.notice,
      ]),
    },
  ];
}

function output(table: TlfTable): ArsOutput {
  return {
    id: table.outputId,
    name: `Table ${table.number}`,
    version: 1,
    fileSpecifications: (["html", "rtf"] as const).map((type) => ({
      name: `${table.fileBase}.${type}`,
      fileType: { controlledTerm: type },
      location: `${table.fileBase}.${type}`,
    })),
    displays: [
      {
        order: 1,
        display: {
          id: table.displayId,
          name: `Table ${table.number}`,
          version: 1,
          displayTitle: `Table ${table.number}: ${table.title} (${table.population})`,
          displaySections: displaySections(table),
        },
      },
    ],
  };
}

function reportingEvent(
  run: PipelineRun,
  plan: ReportingPlan,
  evaluation: ReturnType<typeof evaluateAnalyses>,
  tables: readonly TlfTable[]
): ArsReportingEvent {
  const { manifest } = run;
  const listItems: ArsListItem[] = tables.map((table, index) => ({
    name: `Table ${table.number}: ${table.title}`,
    level: 1,
    order: index + 1,
    outputId: table.outputId,
    sublist: {
      listItems: analysisIdsOf(table).map((analysisId, position) => ({
        name:
          evaluation.analyses.find((analysis) => analysis.id === analysisId)
            ?.name ?? analysisId,
        level: 2,
        order: position + 1,
        analysisId,
      })),
    },
  }));
  return {
    id: `RE_${manifest.studyId}`,
    name: `${manifest.studyId} analysis results`,
    description: `Analysis results for ${manifest.studyId}, seed ${manifest.seed}, ${manifest.nSubjects} screened subjects, in an ARS ${STANDARD_VERSIONS.ARS}-shaped metadata model. Every result links to the ADaM rows it was computed from.`,
    version: 1,
    notice: SYNTHETIC_DATA_NOTICE,
    studyId: manifest.studyId,
    seed: manifest.seed,
    nSubjects: manifest.nSubjects,
    standards: { ARS: STANDARD_VERSIONS.ARS, ADaMIG: STANDARD_VERSIONS.ADaMIG },
    mainListOfContents: {
      name: "Tables",
      contentsList: { listItems },
    },
    analysisSets: plan.analysisSets,
    analysisGroupings: plan.analysisGroupings,
    dataSubsets: plan.dataSubsets,
    methods: plan.methods,
    analyses: evaluation.analyses,
    outputs: tables.map(output),
    rowSets: evaluation.rowSets,
  };
}

/**
 * Runs the reporting plan against a pipeline run: Table 14.1.1
 * (demographic and baseline characteristics, Safety Set), Table 14.2.1
 * (systolic blood pressure, observed values and change from baseline by
 * visit, Full Analysis Set) and Table 14.3.1 (TEAEs by system organ class
 * and preferred term, Safety Set).
 *
 * Analysis sets, groupings, data subsets, methods and analyses are declared
 * as data and returned in an ARS 1.0-shaped reporting event. Every result
 * records, through row sets, the ADaM rows it was computed from: the ADSL
 * rows of its population and the records it counted or summarised. Nothing
 * depends on the clock, so the same run always gives the same outputs.
 *
 * @param definition - The study the run was made from; treatment groups and
 *   visits come from it.
 * @param run - A run from `runPipeline`.
 * @returns The reporting event and the three tables.
 * @throws RangeError when the run is of another study, an ADaM dataset the
 *   plan reads is missing, or two ADaM rows share an id.
 */
export function buildTlfOutputs(
  definition: StudyDefinition,
  run: PipelineRun
): TlfOutputs {
  if (definition.studyId !== run.manifest.studyId) {
    throw new RangeError(
      `The run is of ${run.manifest.studyId}, not ${definition.studyId}.`
    );
  }
  const plan = buildReportingPlan(definition);
  const evaluation = evaluateAnalyses(run.datasets, plan);
  const tables = buildTables(definition, plan, evaluation.analyses);
  return {
    reportingEvent: reportingEvent(run, plan, evaluation, tables),
    tables,
  };
}

/**
 * Serialises a reporting event as JSON: two-space indentation and a final
 * newline. Key order follows the model, so the same event always gives the
 * same bytes.
 */
export function writeArsJson(event: ArsReportingEvent): string {
  return `${JSON.stringify(event, null, 2)}\n`;
}

/**
 * Every output of {@link buildTlfOutputs} as a file: each table as HTML and
 * RTF, and the reporting event as JSON, all under {@link TLF_OUTPUT_DIR}.
 * Files are in path order and hold no timestamps.
 */
export function writeTlfFiles(outputs: TlfOutputs): readonly PackageFile[] {
  const files: PackageFile[] = [
    {
      path: ARS_REPORTING_EVENT_PATH,
      mediaType: "application/json",
      bytes: utf8(writeArsJson(outputs.reportingEvent)),
    },
  ];
  for (const table of outputs.tables) {
    files.push(
      {
        path: `${TLF_OUTPUT_DIR}/${table.fileBase}.html`,
        mediaType: "text/html",
        bytes: utf8(writeTableHtml(table)),
      },
      {
        path: `${TLF_OUTPUT_DIR}/${table.fileBase}.rtf`,
        mediaType: "application/rtf",
        bytes: utf8(writeTableRtf(table)),
      }
    );
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
