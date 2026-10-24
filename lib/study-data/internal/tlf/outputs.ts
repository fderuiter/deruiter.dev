/**
 * The reporting stage: runs the reporting plan against a pipeline run and
 * returns the ARS reporting event, the tables and the figure, and writes
 * them as files.
 */
import { STANDARD_VERSIONS, SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  ArsDisplaySection,
  ArsListItem,
  ArsOutput,
  ArsReportingEvent,
  PipelineRun,
  StudyDefinition,
  TlfKmFigure,
  TlfOutputs,
  TlfTable,
} from "../../types";
import { utf8 } from "../export/columns";
import type { PackageFile } from "../export/package";
import { evaluateAnalyses } from "./evaluate";
import { writeTableHtml } from "./html";
import { buildKmFigure } from "./km-figure";
import { writeKmFigureHtml, writeKmFigureSvg } from "./km-svg";
import { buildReportingPlan, type ReportingPlan } from "./plan";
import { writeTableRtf } from "./rtf";
import { buildTables } from "./tables";

/** Folder the table and figure files are written to. */
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

function figureAnalysisIds(figure: TlfKmFigure): readonly string[] {
  const ids = new Set<string>();
  const add = (resultId: string) => ids.add(resultId.replace(/\.\d+$/, ""));
  for (const curve of figure.curves) {
    add(curve.bigNResultId);
    for (const point of curve.points) point.resultIds.forEach(add);
  }
  for (const row of figure.atRisk) {
    for (const cell of row.cells) cell.resultIds.forEach(add);
  }
  figure.test.resultIds.forEach(add);
  return [...ids];
}

function figureOutput(figure: TlfKmFigure): ArsOutput {
  const subSections = (prefix: string, texts: readonly string[]) =>
    texts.map((text, index) => ({
      order: index + 1,
      subSection: { id: `${figure.displayId}_${prefix}${index + 1}`, text },
    }));
  return {
    id: figure.outputId,
    name: `Figure ${figure.number}`,
    version: 1,
    fileSpecifications: (["html", "svg"] as const).map((type) => ({
      name: `${figure.fileBase}.${type}`,
      fileType: { controlledTerm: type },
      location: `${figure.fileBase}.${type}`,
    })),
    displays: [
      {
        order: 1,
        display: {
          id: figure.displayId,
          name: `Figure ${figure.number}`,
          version: 1,
          displayTitle: `Figure ${figure.number}: ${figure.title} (${figure.population})`,
          displaySections: [
            {
              sectionType: "Title",
              orderedSubSections: subSections("Title", [
                `Figure ${figure.number}`,
                figure.title,
                figure.population,
              ]),
            },
            {
              sectionType: "Legend",
              orderedSubSections: subSections(
                "Legend",
                figure.curves.map((curve) => `${curve.label} (N=${curve.bigN})`)
              ),
            },
            {
              sectionType: "Footnote",
              orderedSubSections: subSections("Footnote", [
                figure.test.text,
                ...figure.footnotes,
                figure.notice,
              ]),
            },
          ],
        },
      },
    ],
  };
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
  tables: readonly TlfTable[],
  figures: readonly TlfKmFigure[]
): ArsReportingEvent {
  const { manifest } = run;
  const entries = [
    ...tables.map((table) => ({
      name: `Table ${table.number}: ${table.title}`,
      outputId: table.outputId,
      analysisIds: analysisIdsOf(table),
    })),
    ...figures.map((figure) => ({
      name: `Figure ${figure.number}: ${figure.title}`,
      outputId: figure.outputId,
      analysisIds: figureAnalysisIds(figure),
    })),
  ];
  const listItems: ArsListItem[] = entries.map((entry, index) => ({
    name: entry.name,
    level: 1,
    order: index + 1,
    outputId: entry.outputId,
    sublist: {
      listItems: entry.analysisIds.map((analysisId, position) => ({
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
      name: "Tables and figures",
      contentsList: { listItems },
    },
    analysisSets: plan.analysisSets,
    analysisGroupings: plan.analysisGroupings,
    dataSubsets: plan.dataSubsets,
    methods: plan.methods,
    analyses: evaluation.analyses,
    outputs: [...tables.map(output), ...figures.map(figureOutput)],
    rowSets: evaluation.rowSets,
  };
}

/**
 * Runs the reporting plan against a pipeline run: Table 14.1.1
 * (demographic and baseline characteristics, Safety Set), Table 14.2.1
 * (systolic blood pressure, observed values and change from baseline by
 * visit, Full Analysis Set), Table 14.3.1 (TEAEs by system organ class
 * and preferred term, Safety Set) and Figure 14.2.2 (Kaplan-Meier estimate
 * of time to first TEAE leading to discontinuation, with the number at
 * risk, Greenwood log-log 95% limits and the log-rank test, Safety Set).
 *
 * Analysis sets, groupings, data subsets, methods and analyses are declared
 * as data and returned in an ARS 1.0-shaped reporting event. Every result
 * records, through row sets, the ADaM rows it was computed from: the ADSL
 * rows of its population and the records it counted, summarised or
 * estimated from. Nothing
 * depends on the clock, so the same run always gives the same outputs.
 *
 * @param definition - The study the run was made from; treatment groups and
 *   visits come from it.
 * @param run - A run from `runPipeline`.
 * @returns The reporting event, the three tables and the figure.
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
  const figures = [buildKmFigure(definition, plan, evaluation.analyses)];
  return {
    reportingEvent: reportingEvent(run, plan, evaluation, tables, figures),
    tables,
    figures,
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
 * RTF, each figure as HTML (with its data tables) and SVG, and the reporting
 * event as JSON, all under {@link TLF_OUTPUT_DIR}.
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
  for (const figure of outputs.figures) {
    files.push(
      {
        path: `${TLF_OUTPUT_DIR}/${figure.fileBase}.html`,
        mediaType: "text/html",
        bytes: utf8(writeKmFigureHtml(figure)),
      },
      {
        path: `${TLF_OUTPUT_DIR}/${figure.fileBase}.svg`,
        mediaType: "image/svg+xml",
        bytes: utf8(writeKmFigureSvg(figure)),
      }
    );
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
