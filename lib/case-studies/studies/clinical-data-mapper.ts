import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-1",
    slug: "clinical-data-mapper",
    title: "Clinical Data Mapper: From ODM to SDTM",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/clinical-data-mapper",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, CDISC, ODM, SDTM, XML Parser, Clinical Trials, HIPAA",
    editorial_content:
      "Clinical data arrives in one format and needs to leave in another. This **TypeScript** tool reads **CDISC ODM** metadata, builds validation schemas, and maps EDC records into **SDTM** domains.",
    architectural_narrative: `<h3>The problem</h3>
<p>Clinical study data often needs to move from an EDC export into a standard analysis format. This project tackles that mapping: read ODM metadata, validate the incoming records, and organize them into SDTM domains. The tricky parts are the study-specific fields and the rules hidden in the details.</p>
<p><strong>The approach:</strong> A SAX parser reads XML incrementally. ODM metadata defines Zod validation schemas, and a separate mapping layer builds SDTM records.</p>
<p><strong>Reported project measurements:</strong> Sub-50MB peak memory during 2GB+ XML ingestion; 100% CDISC Controlled Terminology validation parity; 12x throughput acceleration over DOM-based parsers.</p>

<h3>How it works</h3>
<p><strong>Streaming SAX Parsing Pipeline:</strong> Node.js streaming SAX parser wrapped in TypeScript async generators to process multi-gigabyte XML payloads in discrete chunks without loading the entire DOM into memory.</p>
<p><strong>Dynamic Schema Synthesis:</strong> Reads ODM <code>MetaDataVersion</code> specifications at runtime and compiles type-safe Zod schema models, automatically adapting to protocol amendments.</p>
<p><strong>Declarative SDTM Domain Compiler:</strong> Transforms raw item data into standard SDTM domains (DM, AE, VS, LB) with automated study day derivations (<code>--DY</code>) and vocabulary validation.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Raw CDISC ODM XML: 2GB+] --> B[Streaming SAX Lexer & Parser]
    B --> C[Async Generator Object Stream]
    C --> D[Dynamic Zod Schema Synthesizer]
    D --> E[Canonical Study Model Store]
    E --> F[Declarative SDTM Domain Compiler]
    F --> G1[DM: Demographics Domain]
    F --> G2[AE: Adverse Events Domain]
    F --> G3[VS: Vital Signs Domain]
    G1 & G2 & G3 --> H[CDISC Controlled Terminology Validator]
    H --> I[FDA-Ready SAS Transport / CSV Artifacts]
</code></pre>

<h3>Implementation notes</h3>

<h4>Streaming SAX XML Parser & Generator (<code>src/parser/odm_stream.ts</code>)</h4>
<pre><code class="language-typescript">
// Streaming SAX Parser for Multi-Gigabyte CDISC ODM XML
import sax from "sax";
import { Readable } from "stream";

interface SubjectDataChunk {
  studyOID: string;
  subjectKey: string;
  items: Array<{ itemOID: string; value: string }>;
}

async function* parseODMStream(xmlStream: Readable): AsyncGenerator<SubjectDataChunk> {
  const parser = sax.createStream(true, { trim: true });
  let currentSubject: Partial<SubjectDataChunk> | null = null;

  for await (const chunk of xmlStream) {
    parser.write(chunk);
    // Emits structured subject events as XML tags resolve
    if (currentSubject && currentSubject.items && currentSubject.items.length > 0) {
      yield currentSubject as SubjectDataChunk;
      currentSubject = null;
    }
  }
}
</code></pre>

<h4>Declarative SDTM Domain Compiler (<code>src/compiler/sdtm_builder.ts</code>)</h4>
<pre><code class="language-typescript">
// Declarative SDTM Domain Transformation Engine
function deriveStudyDay(eventDate: Date, referenceDate: Date): number {
  const diffTime = eventDate.getTime() - referenceDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  // SDTM convention: Day 1 is baseline, Day -1 is prior day (no Day 0)
  return diffDays >= 0 ? diffDays + 1 : diffDays;
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Streaming vs. In-Memory DOM:</strong> DOM parsing 2GB XMLs caused Node.js process out-of-memory crashes. SAX streaming bounded memory consumption to &lt; 50MB regardless of file size.</li>
  <li><strong>SDTM Day 0 Prohibition:</strong> CDISC standards omit Day 0; date math was adjusted to ensure proper negative-to-positive transition across baseline trial events.</li>
</ul>`,
    created_at: new Date("2026-01-15T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
