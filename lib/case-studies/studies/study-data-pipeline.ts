import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-23",
    slug: "study-data-pipeline",
    title: "Study Data Pipeline: USDM to SDTM, ADaM and TLFs",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/deruiter.dev",
    interactive_url: "/study-data",
    interactive_label: "Run the pipeline",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, CDISC, USDM, SDTM, ADaM, Define-XML, Dataset-JSON, ARS, Web Workers, Golden Tests, Traceability",
    editorial_content:
      "One fictional study, DEMO-301, defined once in **USDM** and carried in the browser through synthetic collection, **SDTM**, conformance checks, **ADaM**, **Define-XML**, and the tables and figures a clinical study report needs. Every result traces back to the records behind it, and the same seed gives the same bytes. All data are synthetic.",
    architectural_narrative: `<h3>The problem</h3>
<p>Clinical data standards are usually shown one at a time: a CRF here, an SDTM mapping there, a table shell somewhere else. The hard part of the work sits between them. A variable defined in the protocol has to arrive in the analysis with its meaning, its codelist and its derivation intact, and a reviewer has to be able to follow it back.</p>
<p>This project takes one study the whole way, end to end, in the visitor's browser. The study, DEMO-301, is fictional and every subject is synthetic. It is a demonstration of the practices, not a production submission workflow, and the page says so wherever data appear. <a href="/study-data">Run the pipeline</a> to see every stage, change the seed or the number of subjects, and download the package.</p>

<h3>How it works</h3>
<p><strong>One definition.</strong> The study design (arms, epochs, visits, activities and the schedule of assessments) is a USDM study definition. The same reader accepts the USDM export from CRF Studio, so a study built there can be run here, with any activity the pipeline cannot tabulate listed before the run.</p>
<p><strong>Seeded synthetic collection.</strong> One seeded generator draws every value, keyed by subject, domain, visit and variable, so adding a subject never rerolls the others. The generator also plants a few realistic problems on purpose: late visits, out-of-range labs, partial adverse event dates and events before first dose.</p>
<p><strong>SDTM, then conformance.</strong> The trial design domains (TA, TE, TV, TI, TS) and the subject domains (DM, SV, EX, AE, VS, LB, DS, with SUPPDM) are built from typed mapping specifications. A conformance stage checks controlled terminology and a subset of published rules, each finding citing the rule it models. It is not a validator of record and links to CDISC CORE for that.</p>
<p><strong>ADaM and metadata from one source.</strong> ADSL, ADVS, ADLB, ADAE and ADTTE are derived from SDTM only. Every variable carries its label, type, origin, codelist and derivation method, so Define-XML 2.1, Dataset-JSON, CSV and XPT are serialisers over the same structure and cannot drift from the data.</p>
<p><strong>Outputs linked through ARS.</strong> Demographics, systolic blood pressure by visit, treatment-emergent adverse events by system organ class and preferred term, and a Kaplan-Meier figure are defined as Analysis Results Standard analyses. Each cell knows the ADaM records it was computed from, and each of those knows its SDTM and collected predecessors.</p>
<p><strong>Reviewer guides from the run.</strong> A cSDRG-lite and an ADRG-lite are written from the run itself: data flow, standards and versions, datasets, every conformance finding with the reason it occurs, derivations and the analysis output index. They ship inside the package beside the datasets they describe.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart LR
    A[USDM study definition] --&gt; B[Seeded synthetic collection]
    B --&gt; C[SDTM trial design and subject domains]
    C --&gt; D[Conformance findings]
    C --&gt; E[ADaM: ADSL, ADVS, ADLB, ADAE, ADTTE]
    E --&gt; F[ARS analyses: tables and figure]
    C &amp; E --&gt; G[Define-XML 2.1]
    C &amp; E --&gt; H[Dataset-JSON, CSV, XPT, hashed manifest]
    D &amp; E &amp; F --&gt; I[cSDRG-lite and ADRG-lite]
    F --&gt;|lineage| E --&gt;|lineage| C --&gt;|lineage| B
</code></pre>

<h3>Practices it demonstrates</h3>
<ul>
  <li><strong>Reproducibility:</strong> the same definition, seed and subject count give byte-identical packages. A manifest records the inputs and a SHA-256 of every file, and golden tests pin the hashes.</li>
  <li><strong>Independent QC:</strong> the key derivations are programmed a second time from their specifications, without reusing pipeline code, and compared row for row across 200 seeds.</li>
  <li><strong>Traceability:</strong> a lineage explorer walks from a table cell to the analysis records, the SDTM rows and the collected values behind it, and from a scheduled activity forward to every result it feeds.</li>
  <li><strong>Pinned standards:</strong> every standard version is declared once and appears in the trial summary, Define-XML and the manifest.</li>
  <li><strong>Honest scope:</strong> the conformance stage models a subset of rules, the controlled terminology is a local subset aligned to one NCI EVS package, and expected findings are explained rather than hidden.</li>
  <li><strong>No server cost:</strong> the run happens in a Web Worker in the visitor's browser, so it touches no database and no provider quota.</li>
</ul>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Encoding by hand:</strong> every variable and rule is written out and cited by id rather than loaded from CDISC Library. That is slower, and coverage is a deliberate subset, but it keeps the site free of API keys and licensed content.</li>
  <li><strong>Columns with metadata attached:</strong> one column-oriented dataset shape for every layer made Define-XML and the datasets a single source, at the cost of more careful typing than row records need.</li>
  <li><strong>Planted problems are part of the test:</strong> because the generator plants specific issues at known rates, any other conformance finding is a defect, and the reviewer guides say which is which.</li>
</ul>`,
    created_at: new Date("2026-10-24T00:00:00Z"),
    updated_at: new Date("2026-10-24T00:00:00Z"),
  });
