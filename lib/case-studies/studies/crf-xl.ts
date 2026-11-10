import { compileCaseStudy } from "../compiler";
import type { CaseStudyCommands, CaseStudyData, CaseStudyPlayback } from "../types";

export const CRF_XL_COMMANDS_OBJ: CaseStudyCommands = {
  "crf-xl compile --input oncology_study_protocol.xlsx --format cdisc-odm": {
    description:
      "Ingests Excel protocol matrix and compiles into CDISC ODM-XML v1.3.2.",
    payload: {
      status: "COMPILATION_SUCCESS",
      studyOid: "STUDY-ONCO-2026",
      formsCount: 18,
      itemGroupsCount: 42,
      itemsTotal: 312,
      cdashComplianceScore: "100%",
      xmlSizeKb: 184.2,
      auditHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  },
  'crf-xl ast eval --formula "RECIST_SLD_CHANGE(SUM_CURRENT, SUM_BASELINE)" --data \'{"SUM_CURRENT": 34, "SUM_BASELINE": 50}\'':
    {
      description:
        "Evaluates clinical RECIST 1.1 percentage change formula using the zero-eval AST engine.",
      payload: {
        formula: "RECIST_SLD_CHANGE(SUM_CURRENT, SUM_BASELINE)",
        variables: { SUM_CURRENT: 34, SUM_BASELINE: 50 },
        calculatedResult: -32.0,
        unit: "percent",
        clinicalCategory: "PARTIAL_RESPONSE_PR",
        astExecutionTimeMicrosec: 42,
      },
    },
  "crf-xl lint --standards CDASH-2.2,21CFR11": {
    description:
      "Lints compiled CRF specifications against CDASH terminology and 21 CFR Part 11 audit invariants.",
    payload: {
      lintStatus: "PASSED_CLEAN",
      diagnostics: [],
      checksPerformed: [
        "Variable name CDASH conformity (<= 8 chars)",
        "Controlled Terminology OID resolution",
        "Audit trail mandatory flag verification",
        "Zero circular AST formula dependencies",
      ],
    },
  },
};

export const CRF_XL_PLAYBACK_OBJ: CaseStudyPlayback = [
  {
    command:
      "crf-xl compile --input oncology_study_protocol.xlsx --format cdisc-odm",
    description: "Compile Excel protocol matrix into CDISC ODM-XML v1.3.2",
  },
  {
    command:
      'crf-xl ast eval --formula "RECIST_SLD_CHANGE(SUM_CURRENT, SUM_BASELINE)" --data \'{"SUM_CURRENT": 34, "SUM_BASELINE": 50}\'',
    description:
      "Evaluate clinical RECIST 1.1 formula using zero-eval AST engine",
  },
  {
    command: "crf-xl lint --standards CDASH-2.2,21CFR11",
    description:
      "Lint CRF specifications against CDASH 2.2 and 21 CFR Part 11 invariants",
  },
];

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-19",
    slug: "crf-xl",
    title: "CRF.xl: From Spreadsheet to Clinical Forms",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/CRF.xl",
    interactive_url: "/crf",
    interactive_label: "Launch CRF Studio",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, React, Office.js, Web Workers, CDISC, ODM-XML, CDISC ODM, DAG Validation, 21 CFR Part 11, Playwright, Jest",
    editorial_content:
      "An **Excel add-in** that turns protocol spreadsheets into **CDISC CDASH** forms and **ODM-XML** exports. It checks rule dependencies and runs compilation in background workers so the workbook stays usable.",
    architectural_narrative: `<h3>The problem</h3>
<p>Clinical form specifications often begin in Excel. CRF.xl works from that starting point, turning workbook grids into form definitions and ODM-XML while checking the dependencies between calculation rules.</p>
<p><strong>The approach:</strong> Office.js reads the workbook, a dependency graph checks formula relationships, and Web Workers generate the clinical form exports.</p>
<p><strong>Reported project measurements:</strong> Sub-10ms UI thread responsiveness during 10,000+ item parsing via asynchronous chunking workers; 100% strict compliance verification against CDISC ODM 1.3.2 foundation schemas; automated 21 CFR Part 11 audit trails with cryptographic state digests.</p>

<p>The fields a CRF collects decide which metrics a study can report later. The platform demo's <a href="/platform/explore">study metrics explorer</a> groups and filters governed metrics built from that kind of collected data, on synthetic studies.</p>

<h3>How it works</h3>
<p>The Office.js taskpane's React components sit apart from the domain layer (<code>src/taskpane/core/</code>). Transformations and validation gates run as a chain of composable middleware.</p>
<p>Parsing, AST construction and XML serialization run in Web Workers (<code>engine.worker.ts</code>, <code>customxml-worker.ts</code>), so the taskpane stays responsive in the limited Office Webview.</p>
<p>Conditional logic and skip rules are parsed into an AST and checked with a topological DAG traversal (<code>dag-validator.ts</code>, <code>rules-parser.ts</code>), which finds circular dependencies and references to missing items while the form is being written.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph IngestionLayer [Office.js Client Ingestion]
        A[Excel Taskpane UI / React] -->|Trigger Ingestion/Sync| B[App Orchestrator]
        B --> C[Office.js Chunking Ingestion Layer]
    end
    subgraph WebWorkerPipeline [Web Worker Processing Engine]
        C -->|Transfer ArrayBuffer/Chunks| D[Web Worker Engine]
        D --> E[Excel/Rules Parser & AST Generator]
        E --> F[DAG Dependency & Circular Ref Validator]
        F --> G[CDISC Controlled Terminology Resolver]
        G --> H[Serialization Pipeline]
    end
    H -->|Emits ODM-XML / aCRF| I[Office.js CustomXML / Blob Exporter]
    H -->|Validation Errors| J[Interactive Grid Error Annotator]
</code></pre>

<h3>Implementation notes</h3>

<h4>DAG Circular Dependency Detection Solver (<code>src/taskpane/core/dag-validator.ts</code>)</h4>
<pre><code class="language-typescript">
// Topological DAG Validation Solver for Clinical Skip & Derivation Logic
interface RuleNode {
  id: string;
  dependsOn: string[];
}

function detectCircularLogicDependencies(nodes: RuleNode[]): string[][] {
  const adjList = new Map&lt;string, string[]&gt;();
  nodes.forEach((n) => adjList.set(n.id, n.dependsOn || []));

  const visited = new Set&lt;string&gt;();
  const recStack = new Set&lt;string&gt;();
  const cycles: string[][] = [];

  function dfs(current: string, path: string[]) {
    visited.add(current);
    recStack.add(current);

    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStartIndex), neighbor]);
      }
    }

    recStack.delete(current);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, [node.id]);
    }
  }

  return cycles;
}
</code></pre>

<h4>Office.js Memory-Efficient Range Chunking (<code>src/taskpane/office/excel-reader.ts</code>)</h4>
<pre><code class="language-typescript">
// Non-blocking chunked reading of large clinical protocol worksheets in Office.js
async function readWorkbookInChunks(
  context: Excel.RequestContext,
  sheetName: string,
  chunkSize: number = 500,
  onChunk: (rows: any[][], progress: number) => Promise&lt;void&gt;
): Promise&lt;void&gt; {
  const sheet = context.workbook.worksheets.getItem(sheetName);
  const usedRange = sheet.getUsedRange();
  usedRange.load(["rowCount", "columnCount", "values"]);
  await context.sync();

  const totalRows = usedRange.rowCount;
  for (let offset = 0; offset < totalRows; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, totalRows);
    const chunkValues = usedRange.values.slice(offset, end);
    const progress = Math.round((end / totalRows) * 100);
    await onChunk(chunkValues, progress);
  }
}
</code></pre>

<h4>CDISC ODM-XML v1.3.2 Serializer (<code>src/taskpane/export/odm-serializer.ts</code>)</h4>
<pre><code class="language-typescript">
// Regulatory-grade CDISC ODM-XML 1.3.2 Snapshot Serializer
function serializeODMStudy(study: {
  oid: string;
  name: string;
  protocolId: string;
  forms: Array&lt;{ oid: string; name: string; itemGroups: Array&lt;{ oid: string }&gt; }&gt;;
}): string {
  const formsXml = study.forms
    .map(
      (f) =>
        \`&lt;FormDef OID="\${f.oid}" Name="\${f.name}" Repeating="No"&gt;\` +
        f.itemGroups.map((g) => \`&lt;ItemGroupRef ItemGroupOID="\${g.oid}" Mandatory="Yes"/&gt;\`).join("") +
        \`&lt;/FormDef&gt;\`
    )
    .join("");

  return (
    \`&lt;?xml version="1.0" encoding="UTF-8"?&gt;\\n\` +
    \`&lt;ODM xmlns="http://www.cdisc.org/ns/odm/v1.3" ODMVersion="1.3.2" FileType="Snapshot"&gt;\\n\` +
    \`  &lt;Study OID="\${study.oid}"&gt;\\n\` +
    \`    &lt;GlobalVariables&gt;\\n\` +
    \`      &lt;StudyName&gt;\${study.name}&lt;/StudyName&gt;\\n\` +
    \`      &lt;ProtocolName&gt;\${study.protocolId}&lt;/ProtocolName&gt;\\n\` +
    \`    &lt;/GlobalVariables&gt;\\n\` +
    \`    &lt;MetaDataVersion OID="MDV.1" Name="CDASH 2.2 Specification"&gt;\\n\` +
    \`      \${formsXml}\\n\` +
    \`    &lt;/MetaDataVersion&gt;\\n\` +
    \`  &lt;/Study&gt;\\n\` +
    \`&lt;/ODM&gt;\`
  );
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li>Reading 10,000+ rows on the main Office.js thread made Office Webview stutter badly. Passing the raw data to Web Workers in chunked ArrayBuffers brought the UI back to 60fps.</li>
  <li>Checking skip conditions for cycles on blur stops a circular rule from setting off an endless validation cascade while the protocol is being written.</li>
  <li>Writing strict XML and validating against CDASH 2.2 controlled terminology prevents data migration failures in the EDC downstream.</li>
</ul>`,
    commands_json: JSON.stringify(CRF_XL_COMMANDS_OBJ),
    playback_json: JSON.stringify(CRF_XL_PLAYBACK_OBJ),
    created_at: new Date("2026-03-22T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
