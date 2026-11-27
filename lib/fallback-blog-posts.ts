import { compileTerms } from "./term-compiler";

/**
 * Raw blog post data shape conforming to the BlogPost Prisma model.
 */
export interface BlogPostData {
  id: string;
  slug: string;
  title: string;
  dek: string;
  body: string;
  pillar: string;
  tags: string;
  published: boolean;
  reading_time_minutes: number | null;
  hero_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

// Edit post prose with the humanizer skill in .agents/skills/humanizer/
// before it ships; the wording guards in __tests__/ still apply (#3041).
const rawFallbackBlogPosts: BlogPostData[] = [
  {
    id: "fallback-blog-22",
    slug: "oxidizemath-when-the-paper-is-part-of-the-build",
    title: "OxidizeMath: when the paper is part of the build",
    dek: "A Rust workspace where the LaTeX papers, the code and the CI gates check each other. What that catches, what it misses, and what I would reuse.",
    pillar: "formal-verification",
    tags: "rust, formal-verification, scientific-computing, webassembly, traceability, coding-agents",
    published: true,
    reading_time_minutes: 9,
    hero_image_url: null,
    created_at: new Date("2026-11-22T17:00:00.000Z"),
    updated_at: new Date("2026-11-22T17:00:00.000Z"),
    body: `
<p>A scientific model usually lives in two places. There is the paper, where the equation is derived and argued for, and there is the code, where it runs. On day one they agree. By month three somebody has fixed a sign in the code, the paper still has the old one, and a comment halfway down the file has a third version that was copied in by hand and never touched again.</p>
<p><a href="https://github.com/fderuiter/OxidizeMath">OxidizeMath</a> is my attempt to make the build notice. It is a Rust workspace for scientific simulation, and the README calls it a verifiable playground. I think that is fair. It is a playground: the topics run from an MRI Bloch simulator and Lattice Boltzmann fluids to Hodgkin-Huxley neurons, Turing patterns, SIR epidemics, pharmacokinetics, a clinical win ratio and a short satirical paper proving the uniqueness of the favorite child. The verifiable part is what this post is about.</p>
<p>You can run it in a browser on <a href="https://fderuiter.github.io/OxidizeMath/">GitHub Pages</a>, or read the shorter <a href="/case-studies/oxidizemath">case study</a>.</p>

<h2>What is in the repository</h2>
<p>On the default branch today: 1,353 commits since October 2024, 20 workspace crates, 28 LaTeX papers, about 184,000 lines of Rust and 1,696 unit tests. The crates are layered. Developer tooling sits at the bottom, then a verification core (<code>verified_engine</code>, its macros, <code>oxidize_core</code>), then shared math (<code>pure_math</code>, <code>math_commons</code>, <code>scientific_metadata</code>), then one crate per domain (AI, physics, biology, applied, climate, epidemiology), and the egui application on top.</p>
<p>The same GUI compiles to native binaries for Linux, Windows and macOS and to WebAssembly. Simulations that would block a browser tab run in a web worker, and a tool's settings live in the URL hash, so a link reopens the simulation you were looking at.</p>
<p>More than half the commits come from coding agents. That shaped the design more than anything else. When a lot of code arrives quickly, you want the rules in the compiler and the CI, where they apply to every change, and not in a style guide somebody has to remember to read.</p>

<h2>The equation comes from the paper</h2>
<p>The central idea is a procedural macro called <code>embed_theory</code>. On the chirp-z transform used for radar gating, it looks like this:</p>
<pre><code class="language-rust">#[verified_engine::embed_theory("papers/mmwave_radiotherapy_setup.tex", label = "eq:czt")]
#[verified_engine::verified]
pub fn chirp_z_transform(/* ... */) { /* ... */ }</code></pre>
<p>At compile time the macro opens the paper, finds the environment carrying <code>\\label{eq:czt}</code>, converts it and puts it in the function's rustdoc. If the label is gone because someone renamed it in the paper, the crate stops compiling. If a developer also writes display math by hand in that doc comment, the macro rejects it, so the equation exists once, in the paper.</p>
<p>Then it does a rough consistency check. It parses the LaTeX into a set of operators, walks the Rust function's syntax tree for the same, and fails if the paper uses an operator the code never does. The repository's own test is a good example: the paper says <code>\\frac{f}{2 B}</code>, the function body is <code>beat * bw</code>, and the build fails with "expected Div".</p>
<p>It is a set comparison, so it catches a missing division but not a division in the wrong place. I still like it. It is cheap, it runs on every build, and it catches the drift I described at the top of this post, where code and paper disagree because one of them changed alone.</p>

<h2>Rules the compiler enforces</h2>
<p>The <code>#[verified]</code> attribute is on 2,575 functions. It applies two of NASA's Power of Ten rules at compile time: no direct recursion (rule 1) and no function longer than 60 statements (rule 4). Breaking either is a compile error. An exemption has to be written into the attribute as <code>opt_out = "reason"</code>, which means it shows up in review and in a search.</p>
<p>The same macro injects counters into the function body for arithmetic operations, indexed loads and calls. Those feed a <code>ComplexityMetrics</code> struct you get back from a verified run, which turns "this solver got slower" into a number a test can assert on.</p>
<p>Rule 3, no dynamic allocation after initialization, is enforced at run time instead. <code>VerifiedAllocator</code> wraps the system allocator, and while a verified run holds the lock, any call to <code>alloc</code>, <code>alloc_zeroed</code> or <code>realloc</code> panics:</p>
<pre><code class="language-rust">unsafe fn alloc(&amp;self, layout: Layout) -&gt; *mut u8 {
    if MEMORY_LOCK.load(Ordering::SeqCst) &amp;&amp; crate::metrics::is_verification_enabled() {
        runtime_violation!("VIOLATION: Dynamic memory allocation after initialization.");
    }
    unsafe { System.alloc(layout) }
}</code></pre>
<p>Setup can allocate whatever it needs. The inner loop can't. The Lattice Boltzmann fluid solver keeps two grids and swaps them each step, which is how a grid simulation stays inside that rule.</p>
<p>Models also carry their provenance as data. A <code>#[derive(Theory)]</code> on the hidden Markov model, for instance, records a description and a citation to Rabiner's 1989 tutorial, so the source travels with the type.</p>

<h2>Gates outside the compiler</h2>
<p>A workspace tool, <code>unified_verification</code>, runs the checks that a macro can't. Before any build, CI lints the workflow files, checks the release profile, looks for duplicated code by comparing syntax trees, compares the public API against a recorded baseline, checks that architecture decisions have records, runs the paper traceability check, holds every file to 500 lines, scans for secrets and high-entropy strings, and runs documentation, doctest and link checks. Clippy denies <code>too_many_lines</code> and <code>cognitive_complexity</code> across the workspace.</p>
<p>After that, the four platform builds run. The web bundle has to fit a 3 MB compressed budget and pass a Playwright smoke test in Chromium before it deploys to Pages.</p>
<p>One setting I would copy anywhere: the release profile keeps <code>overflow-checks = true</code> and sets <code>panic = "abort"</code>. An integer overflow in a shipped build stops the program. In a numerical tool, a crash is much easier to notice than an overflow that quietly wraps around and produces a believable wrong number.</p>

<h2>What the numbers say</h2>
<p>The repository publishes a <code>Verification_Certificate.json</code>. It reports 84.5% native line coverage and 64.2% coverage on the WebAssembly path. The browser build is the less-tested build by about twenty points, and that is the build most people will open first. I would rather have that written down in the repository than find it out from a bug report.</p>

<h2>What the checks can't tell</h2>
<p>The traceability gate checks that every domain module links to a paper, that the paper exists, and that no paper is orphaned. It passes. But some links in <code>traceability.toml</code> point at papers that are only loosely related, and the MRI module currently points at the favorite-child paper. Nothing in the check can know that. It confirms a link exists. Whether the link is right takes someone reading both ends.</p>
<p>Clinical statistics has the same gap. An analysis plan and the program that runs it are separate documents, and a traceability matrix between them proves only that someone filled in the matrix. OxidizeMath's win ratio module is a small example of the alternative: the paper is <code>papers/win_ratio.tex</code>, and the code implements matched and unmatched pairing over a hierarchy of endpoints, with each comparison rule (higher is better, lower is better, a threshold) as its own strategy. The link is still only as good as the review, but at least the paper and the code are in the same commit.</p>

<h2>What I would reuse</h2>
<ul>
  <li>Keep one copy of an equation and generate the others. A doc comment built from the paper can't drift from it.</li>
  <li>Put the rules where every change meets them. A compile error applies to a coding agent and a tired human the same way.</li>
  <li>Make exceptions write down their reason. An <code>opt_out</code> with a sentence attached is something a reviewer can disagree with.</li>
  <li>Publish the coverage of each build separately, especially the one people open first.</li>
  <li>Treat a trace link as a claim until someone has read both ends.</li>
</ul>
<p>The code is AGPL licensed, and the GUI runs in the browser if you want to poke at it.</p>
`.trim(),
  },
  {
    id: "fallback-blog-21",
    slug: "ai-in-clinical-data-management-show-me-the-source",
    title: "AI in clinical data management: show me the source",
    dek: "What's being used in clinical data management, what changed since 2024, and my guesses through 2031. Bring the source footnote.",
    pillar: "clinical-data-engineering",
    tags: "ai, clinical-data-management, clinical-data-engineering, cdisc, usdm, data-quality",
    published: true,
    reading_time_minutes: 14,
    hero_image_url: null,
    created_at: new Date("2026-11-16T17:00:00.000Z"),
    updated_at: new Date("2026-11-16T17:00:00.000Z"),
    body: `
<p>Imagine a protocol amendment has changed a visit window.</p>
<p>The form needs updating. The edit checks need updating. The test cases and mapping specifications would also like a word. Somewhere, a spreadsheet continues to describe the previous version of the study. Nobody has told the spreadsheet. It is having a good day.</p>
<p>That is where my mind goes when someone says artificial intelligence will make clinical research more efficient.</p>
<p>I&#39;m interested. There is plenty of work here that a person should be delighted to stop doing. Finding the same requirement in several documents comes to mind. So does assembling a review listing so someone can finally begin reviewing it.</p>
<p>But I want to follow the work past the demonstration. After the software produces an answer, somebody has to decide whether it belongs in the study. If that person spends an afternoon repairing a draft that took twelve seconds to generate, we should include the afternoon in the calculation.</p>
<p>Clinical data management lives between the study somebody intended and the data everybody eventually has to explain. That makes it a useful place to examine what AI can do now, what changed over the past two years, and what might come next.</p>
<h2>What changed since 2024</h2>
<p>The easy story would be that two years ago we had experiments, and now we have products. Unfortunately for the easy story, the products were already there.</p>
<p>Medidata <a href="https://www.3ds.com/newsroom/press-releases/medidata-launches-clinical-data-studio-leveraging-ai-modernize-data-experience-clinical-trials">launched Clinical Data Studio in June 2024</a>, describing AI-assisted reconciliation and anomaly detection alongside data integration and review. EMA adopted its <a href="https://www.ema.europa.eu/en/scientific-guidelines/use-artificial-intelligence-ai-medicinal-product-lifecycle">reflection paper on AI in the medicinal product lifecycle</a> that September. By late 2024, both the technology and the questions about using it responsibly were well underway.</p>
<p>What I see changing through 2025 and 2026 is how much of the workflow the software is being asked to handle. The examples include organizations describing their implementations, review systems preparing queries, and agents intended to configure parts of a study.</p>
<p>That is a change in responsibility. An answer in a chat window can be read and discarded. A proposed database change needs a different inspection. We need to know what the software read, which interpretation it used, and what accepting its suggestion would change.</p>
<p>These examples don&#39;t tell us how widely every capability has been adopted. They do give us more to discuss than whether a model can summarize a document. Increasingly, the question is what happens when we let it participate in the work.</p>
<h2>What we are calling AI</h2>
<p>Several different technologies have been given the same name. This has been convenient for the people selling them and less convenient for the people testing them.</p>
<p>An empty required field can be found with an ordinary rule. A model looking for unusual site data has a different job. A language model proposing a form has another one. I would assess them differently:</p>
<ul>
<li><strong>Rules and metadata-driven automation</strong>: Required fields, visit assignments, unit conversions. Check whether the rule matches the specification and handles exceptions.</li>
<li><strong>Statistical methods and machine learning</strong>: Unusual patterns, review priorities, coding suggestions. Check missed issues, false alarms and performance across studies or sites.</li>
<li><strong>Document extraction, OCR and language models</strong>: Reading protocol tables, lab documents and clinical notes. Check agreement with the source, including footnotes and missing information.</li>
<li><strong>Retrieval-augmented generation, or RAG</strong>: Answering questions using selected documents. Check whether the right version was retrieved and the passage supports the answer.</li>
<li><strong>Agents with access to tools</strong>: Carrying out a limited sequence of tasks. Check permissions, proposed changes and recovery when a step fails.</li>
</ul>
<p>RAG retrieves material for a language model to use when answering. It can make an answer easier to inspect. It can also retrieve the wrong passage, or miss the one that matters. <a href="https://learn.microsoft.com/en-us/azure/foundry/concepts/retrieval-augmented-generation?view=foundry-classic">Microsoft&#39;s documentation</a> describes the possibility of incomplete or inaccurate answers even with grounding.</p>
<p>For a study, finding a protocol is a start. Finding the applicable amendment and the footnote that changes the meaning of the table is better. A citation is useful when you open it and discover that it supports the sentence beside it.</p>
<h2>What&#39;s in use, and what&#39;s on the way</h2>
<p>There are implementation accounts worth reading. In <a href="https://www.iconplc.com/insights/blog/2025/04/10/partnered-perspective-2025-medidata-next-conference">April 2025, ICON described Clinical Data Studio as its primary data review platform</a>, with AI-supported review alongside statistical models and integrated data. That is an account from the organization using the system. It doesn&#39;t separate the benefit of the model from the benefit of bringing the data together and changing the process.</p>
<p>The individual products are getting more specific, too. <a href="https://www.medidata.com/en/data-experience/clinical-data-studio-data-surveillance/">Medidata&#39;s data surveillance offering</a> describes multi-source review, AI-assisted reconciliation and query workflows. <a href="https://www.veeva.com/resources/veeva-dqs-cleans-data-for-more-than-1-million-subjects-across-over-1000-studies/">Veeva reported in October 2026</a> that DQS had aggregated and cleaned data across more than 1,000 studies. That indicates vendor-reported scale; it doesn&#39;t mean every automated query was generated by AI.</p>
<p><a href="https://who-umc.org/whodrug/whodrug-global/applications-and-services/koda/">UMC&#39;s WHODrug Koda</a> applies machine learning to drug coding through an API or web application. <a href="https://cluepoints.com/solutions/intelligent-query-detection-iqd/">CluePoints&#39; Intelligent Query Detection</a> describes cross-domain discrepancy detection with supporting evidence and editable query text. CluePoints reports evaluation across at least 100 production studies. Those are defined tasks and attributed claims, which give a team somewhere to begin its own evaluation.</p>
<p>Then there is <a href="https://www.veeva.com/resources/new-veeva-study-builder-agent-to-configure-clinical-studies-in-as-little-as-one-day/">Veeva&#39;s Study Builder Agent</a>, announced to configure forms, visits, edit checks and listings from a protocol using organizational standards and USDM. Early-adopter availability is planned for December 2026. As I write this in November, December remains next month. The future is very good at arriving on a slide before it arrives in a working system.</p>
<p>I also appreciate a specific boundary in <a href="https://docs.oracle.com/en/industries/life-sciences/ai-agents/aiaug/overview-life-sciences-ai-agents.html">Oracle&#39;s Life Sciences AI Agents documentation</a>. It describes connected oversight and planning, then states that the application uses standard analytics and rule-based logic and does not alter or calculate clinical measurements. That helps me understand the intended use.</p>
<p>None of these sources gives us a comparison of the products on the same study. To establish time saved, we still need to count the work of review and correction. Preferably before purchasing the celebratory cake.</p>
<h2>The protocol still needs interpretation</h2>
<p>A protocol describes what the study intends to do. A database needs explicit instructions about what to collect and when. There is room for a surprising amount of disagreement between those two things.</p>
<p>A language model could help draft that translation. Each proposed assessment should point to the passage that supports it. When the protocol leaves something unresolved, the proposal should leave it unresolved too. &quot;The protocol doesn&#39;t specify this&quot; can save a team a great deal of trouble.</p>
<p>Suppose a fictional device study requires an assessment at follow-up, with a timing exception in a footnote. The assistant needs to carry that exception into the proposed visit assignment and tests. A beautifully labeled form at the wrong visit is still at the wrong visit.</p>
<p>CDISC&#39;s <a href="https://www.cdisc.org/ddf">Digital Data Flow work and Unified Study Definitions Model</a> help represent study design in a machine-readable form. That gives downstream systems a shared structure to consume. The <a href="https://cdisc-org.github.io/data-definition-engine/">CDISC Data Definition Engine</a> generates Define-XML and ODM CRF artifacts from USDM-based inputs and supporting metadata. Its documentation labels it under development and describes incomplete concept coverage and visit links that may need manual refinement.</p>
<p>I like being told where the manual work remains. A missing piece is easier to plan for when it has been admitted to exist.</p>
<h2>A number needs a history</h2>
<p>Reading clinical notes into structured fields is another promising use. It also makes a good case for looking closely at what an accuracy score means.</p>
<p>A <a href="https://pubmed.ncbi.nlm.nih.gov/41859030/">2026 radiation oncology study</a> examined extraction from medical notes into structured CRFs. It included 100 patients: 90 for prompt development and 10 for independent testing. The authors reported 83.8% matching accuracy in the test dataset. They also found that approximately 7.5% of routinely collected test data disagreed with an independent manual review.</p>
<p>The reference data needed checking too. That is an important part of the result. Someone had to establish which values were right before the model&#39;s performance could mean much.</p>
<p>With 10 patients in the independent test set, I would be careful about extending the finding to another specialty or workflow. I&#39;d also want to examine the errors by field. A formatting difference and an invented measurement should not disappear into the same average. The review screen needs to show the proposed value beside its source and allow a value to remain unknown.</p>
<p>Sometimes the useful technology is a better connection between systems. FDA&#39;s <a href="https://www.fda.gov/science-research/advancing-regulatory-science/source-data-capture-electronic-health-records-ehrs-using-standardized-clinical-research-data">OneSource research</a> demonstrated structured EHR-to-EDC transfer using interoperability standards. If a value is already structured and available, I&#39;d first investigate transferring it directly. Asking a model to reconstruct it from prose introduces another opportunity to get it wrong.</p>
<p>Wearables and electronic patient-reported assessments deserve the same attention to how data was produced. A sensor stream might be incomplete because the participant wasn&#39;t wearing the device. It might have another explanation. Before asking AI to explain a trend, I want to understand the acquisition method and algorithm version. FDA&#39;s <a href="https://www.fda.gov/regulatory-information/search-fda-guidance-documents/digital-health-technologies-remote-data-acquisition-clinical-investigations">guidance on digital health technologies for remote data acquisition</a> is relevant to that collection layer.</p>
<p>The summary can be fluent while the measurement is misunderstood.</p>
<h2>Somebody has to answer the query</h2>
<p>An adverse event, a medication and a lab result may each look reasonable on their own. Together, they may deserve attention. Medidata&#39;s <a href="https://www.medidata.com/en/data-experience/clinical-data-studio-medical-monitoring/">medical monitoring documentation</a> describes biomedical knowledge graphs and AI-assisted reconciliation for contextual review.</p>
<p>This is work I&#39;d like software to help with. Bringing the relevant records together can give a reviewer more time to consider what they mean. A possible relationship still needs examining before it becomes a query somebody at a site must answer.</p>
<p>Imagine an adverse-event record with a partial onset date. A medication appears to have started earlier. The tool should preserve the partial date and show the uncertainty. Completing the date because it makes the comparison easier would give us a tidier fiction. If an analysis has a prespecified imputation rule, that belongs in a documented derivation, with the source preserved.</p>
<p>Coding needs similar care. An ambiguous term still needs a disposition. A dictionary update needs checking against the study&#39;s coding conventions. A suggestion can read very well and still be the wrong match.</p>
<p>I would count the important issues resolved and the time needed to resolve them. I&#39;d count the weak suggestions the reviewer had to dismiss, too. A system that manufactures unnecessary queries has found a way to move its workload into somebody else&#39;s inbox. That person is unlikely to call this progress.</p>
<h2>Checking the work still counts as work</h2>
<p>AI can propose a mapping or draft transformation code. The result needs checks that can be rerun independently of its explanation. <a href="https://www.cdisc.org/core">CDISC&#39;s Open Rules and CORE work</a> provides machine-executable conformance rules and an execution engine, with a defined scope. Passing an implemented rule doesn&#39;t establish that the data can answer the endpoint question.</p>
<p>Generated tests deserve scrutiny as well. An assistant can misunderstand a visit-window rule, implement its misunderstanding, and then write a test that agrees. Everything passes. The protocol remains unconvinced. Expected results need their own grounding and review.</p>
<p>An <a href="https://formative.jmir.org/2026/1/e100769">October 2026 study of clinical trial data pipeline tasks</a> found benefits from curated domain context in a synthetic evaluation. Its workflow-guided approach did not outperform flat context loading on the standard task panel. I take that as a reason to compare an elaborate agent arrangement with a simpler baseline. More coordination creates more things to debug.</p>
<p>The guidance gives us useful places to start. FDA and EMA&#39;s <a href="https://www.fda.gov/media/189581/download">January 2026 good AI practice principles for drug development</a> address context of use, governance, performance assessment and lifecycle management, including the complete system and its interaction with people.</p>
<p>FDA&#39;s <a href="https://www.fda.gov/regulatory-information/search-fda-guidance-documents/considerations-use-artificial-intelligence-support-regulatory-decision-making-drug-and-biological">January 2025 AI guidance</a> remains listed as draft guidance. Its proposed credibility framework concerns AI producing information to support regulatory decisions about drugs and biological products. That scope matters when discussing medical-device studies.</p>
<p>The final <a href="https://www.fda.gov/regulatory-information/search-fda-guidance-documents/e6r3-good-clinical-practice-gcp">ICH E6 Good Clinical Practice guidance</a> emphasizes quality by design and proportionate, risk-based approaches. FDA&#39;s <a href="https://www.fda.gov/regulatory-information/search-fda-guidance-documents/electronic-systems-electronic-records-and-electronic-signatures-clinical-investigations-questions">October 2024 guidance on electronic systems, records and signatures</a> addresses the system in which the AI feature operates. <a href="https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence">NIST&#39;s Generative AI Profile</a> adds a voluntary, cross-sector engineering perspective. These documents have different purposes. None is a blanket approval of clinical AI.</p>
<p>For an evaluation, I&#39;d start with a narrow task and reference cases reviewed by people who understand the study. Give the system ambiguous language, missing information and an amendment. Look at missed critical items and unsupported interpretations. Measure the reviewer&#39;s complete task, including corrections.</p>
<p>Then change something. Update the source document. Deny access to a required file. Let a tool fail. See whether the system leaves an intelligible problem for someone to resolve. Keep the inputs and software versions needed to investigate the result afterward.</p>
<p>The team also needs to understand where study content goes, who can retrieve it and what ends up in logs. A synthetic example can test a workflow without establishing that the deployment is suitable for participant data.</p>
<p>And give the reviewer enough time to disagree. Putting a person between the software and an Approve button only helps if the person has the evidence and authority to use their judgment.</p>
<h2>My guesses through 2031</h2>
<p>These are my expectations as of November 2026. They are speculation, with dates attached so they can eventually embarrass me in an orderly fashion.</p>
<p>Through 2028, I expect more assistance inside the EDC, coding and review systems teams already use. A proposed match with the dictionary context attached is useful. So is a discrepancy suggestion with the source records already open. Moving an answer out of a separate chat window and back into the working system is another handoff somebody has to manage.</p>
<p>I put more confidence in these limited tasks than in a broadly autonomous study builder. The output is easier to inspect, and the team has somewhere to record its decision.</p>
<p>I also expect evaluation to become a recurring part of the workload. A changed model, terminology package or document parser could change the result while leaving the button exactly where it was. Teams will need to know when their reference cases should be rerun. Saving the prompt won&#39;t describe the whole system.</p>
<p>I would revise that outlook if independent evaluations showed that correction routinely consumes the time saved. A faster draft can produce a slower afternoon.</p>
<p>From 2029 through 2031, my stronger bet is on reuse of structured study definitions. AI could help interpret a legacy document or propose an amendment, while accepted specifications carry the decisions into downstream artifacts and tests. The USDM and metadata work discussed earlier gives that direction a technical basis.</p>
<p>A changed visit window could trigger an impact assessment covering forms, rules and mappings. The software could prepare related revisions together and leave the unresolved interpretation questions with the people qualified to answer them. I&#39;d be pleased to see that work well.</p>
<p>It will depend on maintained metadata and usable integrations. Decisions scattered across meeting notes and undocumented scripts will be difficult to reconstruct reliably. I expect uneven progress, with reusable standards helping some teams automate a defined workflow long before others can do the same for a heavily customized study.</p>
<p>I am less confident about predicting largely autonomous study builds or database lock. Incomplete evidence and responsibility for the final result remain difficult questions. I would need stronger performance evidence across studies, including their inconvenient exceptions, before putting a date on broad autonomy.</p>
<h2>The person behind the field</h2>
<p>Clinical data management knowledge matters here because somebody has to recognize when a plausible result answers the wrong question. A field can be easy to collect and useless for the intended endpoint. A mapping can look sensible while losing a distinction the analysis needs.</p>
<p>I think that expertise will be especially useful when it becomes something other people can inspect and software can use: a clear specification, a documented decision, a test case with an expected result somebody has thought through.</p>
<p>I&#39;m optimistic about software doing more of the assembly work. Bring the changed passage and affected specifications together. Draft the proposed revision. Give the reviewer time to consider it, with a way to correct it when necessary.</p>
<p>And count the unnecessary questions we stop sending to sites. Somewhere, a person has to answer each one while doing the rest of their job. Before the data became a row, another person gave part of their day to a study. I&#39;d like the technology to help us make good use of both people&#39;s time.</p>
<p><em>Sources and availability checked November 16, 2026. Product and implementation claims are attributed to their sources. The outlook through 2031 is my own speculation.</em></p>
`.trim(),
  },
  {
    id: "fallback-blog-1",
    slug: "cdisc-odm-sdtm-clinical-data-pipelines",
    title: "Architecting CDISC ODM & SDTM Clinical Data Pipelines",
    dek: "How to stream CDISC ODM XML into submission-style SDTM datasets in bounded memory, with the same output on every run.",
    pillar: "clinical-data-engineering",
    tags: "cdisc, odm, sdtm, edc, fda, clinical-data-systems",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-01T00:00:00.000Z"),
    updated_at: new Date("2026-03-01T00:00:00.000Z"),
    body: `
<h2>Why DOM parsers run out of memory</h2>
<p>Electronic Data Capture (EDC) systems export large XML files in the <strong>CDISC Operational Data Model (ODM)</strong> format. Once a study reaches hundreds of sites and tens of thousands of subject records, a DOM parser that builds the whole document as an in-memory tree gets into trouble: multi-gigabyte heaps, long garbage collection pauses, latency spikes, and serverless workers that crash under peak load.</p>

<p>In a clinical study a failed ingestion costs more than an operations ticket. A failed extract delays monitoring audits, holds up interim safety reviews, and puts database lock deadlines, which are set by submission windows, at risk.</p>

<h2>Streaming the XML instead</h2>
<p>An event-driven SAX parser handles the study one record at a time. The tokenizer walks through the document and emits a typed event each time an element opens or closes, so the whole archive never sits in memory.</p>

<h3>Bounded memory</h3>
<p>Each study event, form definition, item group and item compiles straight into a typed domain object. The heap stays under 50 MB whether the incoming file is 5 megabytes or 5 gigabytes:</p>

<pre><code class="language-typescript">
interface ItemDataRecord {
  itemOID: string;
  value: string;
  transactionType?: "Insert" | "Update" | "Upsert";
  auditRecord?: {
    userRef: string;
    dateTimeStamp: string;
    reasonForChange?: string;
  };
}

interface ClinicalSubjectStream {
  studyOID: string;
  metaDataVersionOID: string;
  subjectKey: string;
  items: AsyncIterable&lt;ItemDataRecord&gt;;
}
</code></pre>

<p>Because the pipeline is a stream, a worker can push back on the upstream broker whenever the database starts throttling writes, so buffers never pile up.</p>

<h2>Mapping to SDTM</h2>
<p>The FDA and PMDA require <strong>CDISC SDTM</strong> for human drug submissions. Turning operational EDC extracts into tabulation domains (such as Demographics <code>DM</code>, Adverse Events <code>AE</code> and Vital Signs <code>VS</code>) takes several normalization passes:</p>

<ul>
  <li>Check coded values against the quarterly NCI EVS codelists, pinned to one snapshot version.</li>
  <li>Turn partial dates into valid ISO 8601 character values for SDTM without silently truncating them.</li>
  <li>Hash the inputs to every derived observation with SHA-256, Part 11 style, so a reviewer can check where a record came from and spot tampering.</li>
</ul>

<h3>Provenance for every record</h3>
<p>Database transaction logs are volatile, so the pipeline doesn't rely on them. Every transformed observation carries a hash that links the tabulation record back to its source ODM XML token offset and to the version of the rule that produced it:</p>

<pre><code class="language-typescript">
interface ProvenanceCertificate {
  sourceOID: string;
  mappingRuleId: string;
  ruleVersion: string;
  sourceInputHash: string; // SHA-256 digest of raw ODM token
  compiledAtUtc: string;
}
</code></pre>

<h2>Load test results</h2>
<p>In an automated load test against a 1.2 GB CDISC ODM study export with 45,000 subject visits, the streaming pipeline finished the whole SDTM transformation in 14.2 seconds on a single vCPU container, and memory peaked at 38.4 MB. The old DOM parser crashed on the same workload with an unrecoverable heap exhaustion error after allocating 2.8 GB.</p>

<p>The <a href="/case-studies/cadence-clinical">Cadence Clinical</a> case study and the <a href="/case-studies/clinical-data-mapper">Clinical Data Mapper</a> architecture show the boundaries that keep the audit surface small. To watch form rules compile as you edit them, open <a href="/crf">CRF Studio</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-2",
    slug: "statecharts-invariant-verification-high-assurance-frontends",
    title: "Statecharts and Invariant Verification in High-Assurance Frontends",
    dek: "Modelling frontend UI state as a statechart, so a high-stakes workflow has no impossible states and no unreachable ones.",
    pillar: "formal-verification",
    tags: "formal-methods, verification, statecharts, invariants, tla, distributed-systems",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-05T00:00:00.000Z"),
    updated_at: new Date("2026-03-05T00:00:00.000Z"),
    body: `
<h2>Boolean flags multiply states</h2>
<p>High-assurance frontends (clinical dosing calculators, radiation oncology planners, medical telemetry consoles) often track state with separate boolean flags such as <code>isLoading</code>, <code>isError</code> and <code>isSubmitting</code>. The combinations grow exponentially. Four independent flags allow 16 states, and only four or five of them are valid clinical operations.</p>
<p>Sooner or later the impossible states show up in production: a stale error dialog drawn over a spinning loader, or a submit button that re-enables while the request is still in flight. In a consumer web app, the user refreshes the page. In regulated medical software, an ambiguous screen can lead to a duplicate dispense or a dose calculation nobody verified.</p>

<h2>Statecharts as the contract</h2>
<p>A <strong>statechart</strong> is a hierarchical state machine. Define the UI as one and its transitions become deterministic and closed. Every valid state, every permitted event and the full transition matrix are written down as the contract:</p>

<pre><code class="language-typescript">
type DosingWorkflowState =
  | { status: "idle" }
  | { status: "calculating"; inputHash: string }
  | { status: "verified"; dosageMg: number; auditSig: string }
  | { status: "flagged_contraindication"; code: string; rationale: string };

type DosingWorkflowEvent =
  | { type: "INPUT_SUBMITTED"; patientWeightKg: number; serumCreatinine: number }
  | { type: "CALCULATION_SUCCEEDED"; dosageMg: number; auditSig: string }
  | { type: "CONTRAINDICATION_DETECTED"; code: string; rationale: string }
  | { type: "RESET" };
</code></pre>

<h3>Hierarchy</h3>
<p>Statecharts add hierarchy, orthogonal regions and guarded transitions to plain finite state machines. A multi-step wizard doesn't have to flatten into dozens of loose states: nested compound states keep their own invariants without leaking them into the parent.</p>

<h2>Checking the model</h2>
<p>A statechart is a formal object, so it can be checked before any code runs in a browser. Automated state space exploration tests reachability across every possible sequence of user interactions:</p>

<ul>
  <li>No deadlocks: no sequence of states can trap the user without a reset or an exit.</li>
  <li>Safety: the app can never enter <code>dispensed</code> unless it passed through <code>verified</code> with a cryptographic audit signature that hadn't expired.</li>
  <li>Event coverage: an unexpected event that arrives during network lag is either handled or dropped, never left to throw at runtime.</li>
</ul>

<h3>Race conditions removed by construction</h3>
<p>Take the classic typeahead race. A user types query A, then query B. Response B arrives first, and then the stale response A overwrites the view. In a statechart, entering the <code>searching</code> state cancels any pending actor invocations from earlier queries, so the race can't happen and there is no cancellation token to bolt on.</p>

<h2>What adoption takes</h2>
<p>Statecharts ask you to think about discrete transitions before you write any event callbacks in React hooks, and that takes some getting used to. The payoff grows over the life of a system. When clinical requirements change, updating the transition matrix shows the missing edges and unreachable states at compile time.</p>

<p>To see formal verification applied to interactive directed acyclic graphs (DAGs), try the <a href="/proof">Proof Studio</a>, or read about the compiler architecture in the <a href="/case-studies/crf-xl">CRF-XL Case Study</a>. The <a href="/neuro">NeuroRecon 3D Brain Studio</a> checks its simulation invariants live.</p>
`.trim(),
  },
  {
    id: "fallback-blog-3",
    slug: "sub-pixel-canvas-deterministic-browser-physics",
    title:
      "Sub-Pixel Canvas Rasterization and Deterministic 60 FPS Browser Physics",
    dek: "Fixed-timestep physics that runs the same on every screen, sub-pixel rasterization, and a browser game loop that allocates nothing.",
    pillar: "browser-graphics-engineering",
    tags: "browser-physics, canvas, game-loop, webgl, performance, 60fps",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-10T00:00:00.000Z"),
    updated_at: new Date("2026-03-10T00:00:00.000Z"),
    body: `
<h2>Variable timesteps cause drift</h2>
<p>Browser displays refresh at very different rates: 60 Hz on phones, 120 Hz on ProMotion laptops, 144 Hz or 240 Hz on gaming monitors. Tie a physics simulation directly to the <code>requestAnimationFrame</code> timestamp deltas and you get integration drift, unpredictable collision tunnelling, and gameplay that differs from one machine to the next.</p>

<p>With Euler integration and a variable <code>dt</code>, two players who enter identical inputs on different machines see their rigid bodies diverge within seconds. In a competitive arcade engine or a physics model that has to be checked, replays stop being reproducible and anti-cheat validation becomes impossible.</p>

<h2>A fixed-timestep accumulator</h2>
<p>To get bit-identical physics at any refresh rate, separate the physics step from the drawing. The simulation advances in fixed slices (here exactly 16.666ms per step), and the renderer interpolates between the previous and current positions:</p>

<pre><code class="language-typescript">
const FIXED_TIMESTEP_MS = 1000 / 60; // Exactly 16.666ms
let accumulator = 0;
let lastTimestamp = performance.now();

function gameLoop(now: number) {
  const frameDelta = Math.min(now - lastTimestamp, 250); // Bound spiral of death
  lastTimestamp = now;
  accumulator += frameDelta;

  while (accumulator &gt;= FIXED_TIMESTEP_MS) {
    integrateRigidBodies(physicsState, FIXED_TIMESTEP_MS);
    resolveCollisions(physicsState);
    accumulator -= FIXED_TIMESTEP_MS;
  }

  // Fractional alpha for butter-smooth visual interpolation
  const alpha = accumulator / FIXED_TIMESTEP_MS;
  renderInterpolated(renderContext, physicsState, alpha);

  requestAnimationFrame(gameLoop);
}
</code></pre>

<h3>Interpolating between ticks</h3>
<p>The fraction <code>alpha</code> says how far the renderer is between the previous physics tick and the current one. Interpolate position and rotation with <code>lerp(prevPos, currPos, alpha)</code> and a 144 Hz monitor draws smooth frames with no jitter, while the physics underneath runs at a locked 60 Hz.</p>

<h2>Allocating nothing in the loop</h2>
<p>Garbage collection spikes cause most of the micro-stutters and dropped frames in busy 2D canvas scenes. Creating temporary objects, such as coordinate vectors, inside the inner simulation loop makes the runtime collect garbage often.</p>

<h3>TypedArray pools and ring buffers</h3>
<p>Allocate contiguous <code>Float64Array</code> pools and circular ring buffers once, when the engine starts, and gameplay allocates no memory at all:</p>

<pre><code class="language-typescript">
class ParticleRingBuffer {
  private readonly positions: Float64Array; // [x0, y0, vx0, vy0, ...]
  private head = 0;

  constructor(public readonly capacity: number) {
    this.positions = new Float64Array(capacity * 4);
  }

  spawn(x: number, y: number, vx: number, vy: number): void {
    const idx = (this.head % this.capacity) * 4;
    this.positions[idx] = x;
    this.positions[idx + 1] = y;
    this.positions[idx + 2] = vx;
    this.positions[idx + 3] = vy;
    this.head++;
  }
}
</code></pre>

<h2>Sharp canvases on high-DPI screens</h2>
<p>On high-DPI displays (such as Apple Retina panels with <code>devicePixelRatio = 2</code> or <code>3</code>), a canvas sized the naive way comes out blurry. Scale the backing buffer by the device pixel ratio and hold the CSS size fixed, and the canvas rasterizes crisply at the sub-pixel level, with proper anti-aliasing.</p>

<p>To see these physics loops and memory pools running, play the <a href="/arcade/quasi-puzzler">Quasi-Perfect Puzzler</a> or work through the physics obstacles in <a href="/arcade/retro-labyrinth">Retro Labyrinth</a>. The maths behind them is in the <a href="/work/laser-loon">Laser Loon Architecture</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-4",
    slug: "ast-compilers-vs-regex-clinical-form-validation",
    title: "Why AST Compilers Replace Regex in Clinical Form Validation",
    dek: "Why regular expressions break down on clinical edit checks that an auditor will question, and how compiling each rule to an Abstract Syntax Tree gives it one defined meaning.",
    pillar: "formal-verification",
    tags: "ast-compilers, compilers, parsing, formal-methods, json-schema, validation",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-15T00:00:00.000Z"),
    updated_at: new Date("2026-03-15T00:00:00.000Z"),
    body: `
<h2>Where regular expressions break</h2>
<p>Validation on electronic Case Report Forms (eCRF) for multi-cohort drug trials involves arithmetic formulas that depend on each other, consistency checks across forms, and comparisons with earlier visits. Teams often try to patch these rules with complicated regular expressions, and soon run into catastrophic backtracking, patterns nobody can maintain, and checks that quietly let bad values through.</p>

<p>A regex reads characters. It knows nothing about the rule's syntax, scope or operator precedence. When an investigator writes an expression such as <code>LAB.CREATININE &gt; 1.5 AND (VISITA.DOSE != NULL OR LAB.ALT &gt; 3 * UPPER_LIMIT)</code>, a regular expression can't build an evaluation context, check types or promise to terminate, and it risks catastrophic backtracking (ReDoS) that freezes the investigator's browser tab.</p>

<h2>A domain-specific AST evaluator</h2>
<p>Our clinical schema engine turns rule expressions into <strong>Abstract Syntax Trees (ASTs)</strong> instead of matching strings. A deterministic scanner tokenizes each rule, and the parser builds a recursive tree of nodes:</p>

<pre><code class="language-typescript">
type ASTNode =
  | { type: "Literal"; value: string | number | boolean }
  | { type: "Identifier"; fieldRef: string }
  | { type: "BinaryExpression"; operator: "+" | "-" | "*" | "/" | "&gt;" | "&lt;" | "=="; left: ASTNode; right: ASTNode }
  | { type: "LogicalExpression"; operator: "AND" | "OR"; left: ASTNode; right: ASTNode }
  | { type: "FunctionCall"; name: string; args: ASTNode[] };
</code></pre>

<h3>Recursive descent parsing</h3>
<p>A hand-written recursive-descent parser enforces operator precedence (arithmetic before relational, relational before logical) without <code>eval()</code> or <code>new Function()</code>. Variable references bind to an immutable trial dataset scope, so evaluation is a pure fold over the syntax tree.</p>

<h2>Bounded time and a record of every result</h2>
<p>Validation runs in the coordinator's browser during a live subject visit, so every rule has to finish in bounded time. The AST traversal allows no unbounded recursion and no circular loops:</p>

<ul>
  <li>Before anything runs, the rule graph is checked for cyclic dependencies between form fields.</li>
  <li>Tree depth is capped at 32 levels, so evaluation finishes in under 1 millisecond per form item.</li>
  <li>Every evaluation produces a derivation tree you can inspect, showing <em>why</em> a check failed: the kind of traceability a Part 11 reviewer looks for.</li>
</ul>

<h3>No ReDoS, and a derivation for every warning</h3>
<p>A regular expression can backtrack exponentially on hostile or unusual input. Recursive AST evaluation is linear, $O(N)$ in the number of nodes in the syntax tree. If an FDA audit asks about an edit check warning from eighteen months earlier, the system can rebuild the exact derivation tree that raised it.</p>

<h2>Trying it</h2>
<p>Moving from regular expressions to AST compilation removed hundreds of silent validation escapes across our clinical form pipelines. The same compiler runs in the client-side form wizards and in the server-side batch ETL validation, so a rule evaluates bit for bit the same in both.</p>

<p>You can design eCRF forms and watch the AST rules evaluate as you type in <a href="/crf">CRF Studio</a>. The <a href="/case-studies/crf-xl">CRF-XL Case Study</a> covers AST compilation in clinical pipelines in more depth, and <a href="/proof">Proof Studio</a> has the formal proofs.</p>
`.trim(),
  },
  {
    id: "fallback-blog-5",
    slug: "pipelines-that-survive-an-audit",
    title: "Pipelines That Survive an Audit",
    dek: "An inspector asks you to prove what your pipeline did to one record on one date. Most pipelines can't answer.",
    pillar: "clinical-data-engineering",
    tags: "cdisc, 21-cfr-part-11, audit-trail, controlled-terminology, clinical-data-systems, provenance",
    published: true,
    reading_time_minutes: 9,
    hero_image_url: null,
    created_at: new Date("2026-09-19T00:00:00.000Z"),
    updated_at: new Date("2026-09-19T00:00:00.000Z"),
    body: `
<h2>Working is the easy half</h2>
<p>A clinical data pipeline that transforms EDC exports into submission-ready datasets is a solved engineering problem. Parse, map, validate, emit. The hard half arrives eighteen months later, when someone asks why subject 4021's visit date changed between two extracts, and the honest answer is that nobody knows.</p>
<p>A regulatory inspection checks whether you can demonstrate what the software did to a specific record at a specific time, and show that the demonstration itself wasn't edited afterwards. Correct software doesn't give you that for free. It has to be designed in, and it can't be added under deadline.</p>

<h2>Three properties that must be structural</h2>
<p><strong>1. Every value carries its provenance.</strong> A transformed value that doesn't know where it came from proves nothing. Store each value together with its source record, the rule that produced it, and the version of that rule.</p>

<pre><code class="language-typescript">
interface DerivedValue&lt;T&gt; {
  value: T;
  sourceOID: string;        // the ODM item this came from
  ruleId: string;           // which mapping produced it
  ruleVersion: string;      // pinned, never "latest"
  derivedAt: string;        // ISO 8601, UTC
  inputHash: string;        // hash of the inputs, not the output
}
</code></pre>

<p>Hashing the <em>inputs</em> rather than the output is the part people get backwards. An output hash proves the value has not been tampered with. An input hash proves the value is reproducible: re-run the pinned rule against the same inputs and you must get the same answer. Only the second one survives being asked "show me."</p>

<p><strong>2. Controlled terminology is pinned, not fetched.</strong> NCI EVS publishes updates quarterly. A pipeline that resolves codelists at runtime produces different output on different days from identical input, and the difference is invisible until an inspector diffs two extracts. Pin the dictionary version per study, store it alongside the data, and treat a terminology upgrade as a deliberate migration with its own record.</p>

<p><strong>3. The audit trail is append-only or it is decorative.</strong> If the process that writes audit records can also update or delete them, the trail proves nothing beyond the good intentions of whoever held the credentials. This is the single most common gap, and it is usually justified by a cleanup job that "only removes duplicates."</p>

<h2>The failure that is hardest to catch</h2>
<p>A pipeline that fails loudly is a good pipeline. The dangerous one succeeds while doing nothing.</p>
<p>Fallback behaviour is the usual culprit. A service that substitutes static content when a query fails is correct at runtime: a visitor should still get a page. Run that same code at build time and it bakes the fallback into an artifact that ships as though it were real, and every downstream check passes, because from the outside a complete dataset and a complete <em>substitute</em> dataset are indistinguishable.</p>
<p>The rule worth internalising: <strong>gate on build versus runtime, not on production versus non-production.</strong> A production build satisfies every "is this production?" check while having no business touching a database at all. Make the build fail on an unreachable data source, and make an empty-but-successful query a non-failure, because those two states are different and conflating them produces either false alarms or false confidence.</p>

<h2>What to test</h2>
<p>Conformance suites check that output matches a schema. They do not check that the output is <em>this</em> input's output. Add tests that:</p>
<ul>
  <li>Re-run a pinned rule against a stored input hash and assert byte equality with the recorded result.</li>
  <li>Attempt to update an audit row and assert the write is rejected: not that it is "not done", that it <em>cannot</em> be done.</li>
  <li>Assert the build exits non-zero when the data source is unreachable. A green build is only evidence if a red one was possible.</li>
</ul>
<p>That last one is the test people skip, because it feels like testing the framework. What it tests is the one assumption every other test rests on.</p>

<p>The <a href="/case-studies/crf-xl">CRF-XL</a> and <a href="/case-studies/clinical-data-mapper">clinical data mapper</a> case studies walk through the AST and streaming-transform mechanics; <a href="/case-studies/cadence-clinical">Cadence Clinical</a> covers the hexagonal boundary that keeps the audit surface small enough to reason about. You can drive the rule evaluator directly at <a href="/crf">/crf</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-6",
    slug: "typography-as-accessibility-infrastructure",
    title: "Typography Is Infrastructure, Not Decoration",
    dek: "Treating a typeface as a brand decision rather than a reading system is a defensible choice, right up until you watch someone you love fail to read your page.",
    pillar: "accessibility-engineering",
    tags: "accessibility, typography, dyslexia, wcag, cls, opendyslexic, cognitive-load",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-09-19T00:00:00.000Z"),
    updated_at: new Date("2026-09-19T00:00:00.000Z"),
    body: `
<h2>The part a checklist will not tell you</h2>
<p>An automated accessibility audit will confirm your contrast ratios and your heading order. It will pass a page that is exhausting to read, because the properties that make prose readable for a dyslexic reader (glyph disambiguation, character orientation, line rhythm, the absence of reflow) are not in the checklist.</p>
<p>The tooling can only check what it can measure. Contrast is measurable from a pair of colours. Whether <strong>b</strong>, <strong>d</strong>, <strong>p</strong> and <strong>q</strong> are rotationally confusable in a given typeface is a property of the letterforms, and no linter has an opinion about it.</p>

<h2>Three jobs, three typefaces</h2>
<p>The instinct is to pick one accessible font and apply it everywhere. That trades one compromise for another, because headings and body prose are doing different work.</p>
<ul>
  <li><strong>Headings: Lexend.</strong> Designed around reading-speed research, with expanded spacing and distinct silhouettes. Headings are scanned, not read; silhouette matters more than fine detail.</li>
  <li><strong>Prose and UI: Atkinson Hyperlegible.</strong> Commissioned by the Braille Institute specifically to disambiguate the pairs that collapse in most grotesques: uppercase I, lowercase l, and the numeral 1. Body text is read linearly, so per-character certainty is what counts.</li>
  <li><strong>Opt-in mode: OpenDyslexic.</strong> Weighted bottoms anchor each glyph's orientation, which is what prevents the rotational flipping that makes letters "swim".</li>
</ul>
<p>OpenDyslexic is an <em>option</em> on purpose. The evidence for dyslexia-specific typefaces is mixed, and imposing one on every reader substitutes a different assumption for the one you removed. Making it a one-click persistent toggle respects that the reader knows their own needs better than the research aggregate does.</p>

<h2>Layout shift is an accessibility bug</h2>
<p>Layout shift usually gets filed under performance. A reader who has lost their place in a paragraph because the page reflowed has to find it again. For a fluent reader that costs a fraction of a second. For someone who is decoding effortfully, it can mean restarting the paragraph. Cumulative Layout Shift is a cognitive cost first and a performance metric second, and a font switch is the most disruptive shift there is, because it moves every line simultaneously.</p>
<p>So a typography toggle has an unusually strict requirement: it must produce no layout shift at all. That rules out swapping a stylesheet and hoping metrics are close, and it rules out reading the preference in an effect after hydration; by then the first paint has already happened in the wrong font.</p>

<pre><code class="language-typescript">
// Measure before paint, not after mount.
// Reading persisted preference in an effect guarantees a flash: the
// server-rendered markup has already committed to the default face.
const mode = useSyncExternalStore(
  subscribeToTypographyMode,
  getTypographyMode,      // client snapshot
  getServerTypographyMode // server snapshot - must not read storage
);
</code></pre>

<p>The general technique: precompute text layout against known font metrics rather than letting the browser discover them, so the space a block will occupy is decided before anything renders into it. Swapping the face then changes glyphs without moving lines.</p>

<h2>Why this is worth the effort</h2>
<p>Accessible typography is usually justified as compliance, which is true and also the least interesting reason. The honest version is narrower: someone specific could not read the thing you made, and you could fix it.</p>
<p>The techniques generalise to a reader with a migraine, a reader on a phone in sunlight, or a reader in their fourth hour of a long shift. But they generalise <em>because</em> they were designed for a hard case rather than an average one. Designing for the average produces the geometric grotesque everyone already ships.</p>

<p>The full build (the tripartite hierarchy, the zero-FOUT initialisation, and the Pretext reflow engine) is documented in <a href="/case-studies/designing-for-my-brother">Designing for My Brother</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-7",
    slug: "what-agent-first-tooling-actually-requires",
    title: "What Agent-First Tooling Actually Requires",
    dek: "Most repositories that claim to be agent-ready have documented their conventions and wired none of them. An agent reads the document and believes it.",
    pillar: "agent-first-dx",
    tags: "agents, developer-experience, tooling, ci, conventions, guardrails",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-09-19T00:00:00.000Z"),
    updated_at: new Date("2026-09-19T00:00:00.000Z"),
    body: `
<h2>The document is not the control</h2>
<p>A repository convention exists in one of three states: written down, implemented, or enforced. They are routinely confused, and an agent has no way to tell them apart: it reads the convention, assumes it holds, and builds on it.</p>
<p>A concrete example from this repository. The branch-naming convention was documented. A <code>validateBranchName()</code> function existed. A unit test asserted it worked, and passed continuously. Nothing anywhere called it. The convention was written, implemented, and tested. It was also unenforced for months, while every artifact suggested otherwise.</p>
<p>That is the characteristic agent-first failure, and it is worse for agents than for humans. A human who has been on the team a while knows which rules are real. An agent has only the artifacts, and the artifacts said it was enforced.</p>

<h2>Test that the control is invoked, not that it works</h2>
<p>This turns the usual advice to test behaviour over implementation on its head, on purpose.</p>
<p>A test asserting <code>validateBranchName("feat/x")</code> returns true tells you the logic is right. It tells you nothing about whether anything calls it. For a guardrail, "is it wired in" is the property that matters, because unwired logic fails open and silently.</p>

<pre><code class="language-typescript">
// Weak: passes forever while the hook does not exist.
expect(validateBranchName("nonsense")).toBe(false);

// Strong: fails the moment the guardrail is disconnected.
const hook = readFileSync(".husky/pre-push", "utf8");
expect(hook).toMatch(/validate-branch/);
</code></pre>

<p>Source-level assertions feel crude. They are appropriate here precisely because they assert a fact about the system rather than about a function; the fact is the thing that keeps being untrue.</p>

<h2>Make the remedy executable</h2>
<p>When a gate fails, the message it prints is the entire interface. An agent will do exactly what it says, so a message that describes a problem without naming a command produces a guess.</p>
<p>"Documentation is out of sync" sends an agent looking for the files. "Run <code>npm run doctor:fix</code>" gets it fixed in one step. The remediation command usually already exists; it is just not named at the point of failure. The cost of that omission compounds: every failure spends a full cycle rediscovering it.</p>

<h2>Scope selection is a correctness property</h2>
<p>Running only tests related to changed files is a sensible optimisation, and it has a sharp edge: relatedness is computed through the import graph. A change to a build script that nothing imports has no related tests, so the pre-commit hook runs none and reports success.</p>
<p>In this repository that precise gap shipped a regression that printed a live production credential into test output. The hook passed. It was correct to pass, given its rules. The rules were wrong.</p>
<p>Scoped testing can stay. Some paths (build scripts, configuration, seeds, and anything widely depended upon but imported by nothing) just have to force a broader run, whatever the graph says.</p>

<h2>A short checklist</h2>
<ul>
  <li>For every documented convention, name the file and line that enforces it. If you cannot, it is documentation, not a control.</li>
  <li>For every guardrail, write a test that fails when it is disconnected, then check that the test fails by disconnecting it.</li>
  <li>For every failure message, include the exact command that fixes it.</li>
  <li>For every scoped optimisation, enumerate what it deliberately skips and decide whether that set is acceptable.</li>
  <li>Prefer a loud failure to a quiet fallback anywhere an agent will read the outcome as success.</li>
</ul>
<p>None of this is specific to agents. Agents just remove the slack that made the gaps survivable: they do not know which rules are real, so unenforced conventions get discovered at the worst possible moment.</p>

<p><a href="/case-studies/promptops">PromptOps</a> covers versioning and evaluating prompts as build artifacts; <a href="/case-studies/hono-kiln">Hono Kiln</a> covers the monorepo boundaries that make scoped checks tractable in the first place.</p>
`.trim(),
  },
  {
    id: "fallback-blog-8",
    slug: "proving-numerical-code-lean4-and-rust",
    title: "Proving Numerical Code With Lean 4 and Rust",
    dek: "A test suite samples a function's behaviour. A proof quantifies over it. Knowing which one a problem deserves is most of the engineering.",
    pillar: "formal-verification",
    tags: "lean4, rust, formal-verification, numerical-methods, proofs, wasm",
    published: true,
    reading_time_minutes: 10,
    hero_image_url: null,
    created_at: new Date("2026-09-19T00:00:00.000Z"),
    updated_at: new Date("2026-09-19T00:00:00.000Z"),
    body: `
<h2>Where testing stops being enough</h2>
<p>Property-based testing is the right default for numerical code. Generate thousands of inputs, assert invariants, shrink failures to a minimal case. It finds real bugs cheaply and it scales with almost no thought.</p>
<p>It is also a sampling technique. It tells you a property held on the inputs it tried. For most software that is sufficient, because the cost of a rare wrong answer is a bug report. For a small class of code (a numerical kernel other results are derived from, an allocation algorithm that must not be predictable, or a transform in a regulated pipeline), the cost of a rare wrong answer is that everything downstream is quietly wrong too, and nobody finds out for a year.</p>
<p>That is the boundary: code where <em>being wrong is hard to detect from the outside</em>. "Important code" is too wide a line, because all code is important to someone.</p>

<h2>Two tools, two jobs</h2>
<p>The useful split is between proving the mathematics and enforcing the implementation.</p>
<p><strong>Lean 4 proves the theorem.</strong> It operates on mathematical objects (the actual integers, the actual reals) with no representation limits. You state a property, and the proof either closes or it does not. There is no sampling and no flakiness.</p>
<p><strong>Rust enforces the boundary.</strong> The type system cannot express "this converges", but it can express, at compile time, that a value was range-checked, that an invariant type cannot be constructed from unvalidated input, and that the unsafe numeric edges are confined to functions you can enumerate.</p>

<pre><code class="language-rust">
// The proof says the algorithm is correct for all real inputs.
// The type says this f64 was actually checked before we got here.
pub struct Finite(f64);

impl Finite {
    pub fn new(x: f64) -&gt; Option&lt;Finite&gt; {
        if x.is_finite() { Some(Finite(x)) } else { None }
    }
}

// Cannot be called with NaN or infinity. Not by convention - by construction.
pub fn newton_step(x: Finite, fx: Finite, dfx: NonZeroFinite) -&gt; Finite { /* ... */ }
</code></pre>

<p>Neither tool covers the other's ground. A Lean proof about the reals says nothing about what your <code>f64</code> does at the boundary, because <code>f64</code> is not the reals; it is a finite approximation with its own arithmetic, where addition is not associative. A Rust type system says nothing about whether your iteration converges.</p>

<h2>The gap everyone underestimates</h2>
<p>Verification efforts usually fail between the two tools.</p>
<p>You prove a theorem about real-valued Newton iteration. You implement it in floating point. The proof is valid. The implementation is a different algorithm operating on a different number system, and the proof does not transfer. It constrains the design and rules out whole families of mistakes, but it does not certify the binary.</p>
<p>Closing that gap honestly means stating what was proved about what. "Convergence proven for exact arithmetic; floating-point error bounded empirically at 1e-12 over the tested domain" is a true and useful claim. "Formally verified" is neither, and it is the claim that gets made.</p>

<h2>What a proof buys that a test does not</h2>
<ul>
  <li>Quantification. "For all n" instead of "for the 10,000 values of n we tried." The difference matters exactly when the counterexample is rare and structured, which is when property testing is weakest.</li>
  <li>Non-rot. A proof that still compiles still holds. A test suite can pass while asserting something that stopped being true; this is the silent-success failure mode in a different costume.</li>
  <li>Forced precision. Most of the value arrives before the proof closes. Stating the theorem exactly enough for a proof assistant surfaces the unstated assumptions, and those are usually where the bug was.</li>
</ul>

<h2>When not to do this</h2>
<p>Proof effort is superlinear in specification complexity. A property about number theory closes in an afternoon; the same rigour applied to a stateful system with I/O is a research project.</p>
<p>Reach for proofs when the specification is small and the consequences of being wrong are large and hard to observe. Everywhere else, property-based testing plus a type system that makes illegal states unrepresentable gets most of the benefit for a fraction of the cost, and, unlike a proof, your colleagues can modify it.</p>

<p><a href="/case-studies/ualbf">UALBF</a> pairs Lean 4 proofs with Rust and C implementations across a number-theoretic problem; <a href="/case-studies/oxidizemath">OxidizeMath</a> covers compiling verified numerics to WebAssembly without losing the guarantees at the boundary; <a href="/case-studies/polyglot-tsp">Polyglot TSP</a> benchmarks the same algorithm across toolchains, which is how you find out what the abstraction actually cost.</p>
`.trim(),
  },
  {
    id: "fallback-blog-9",
    slug: "the-cost-of-being-wrong-quietly",
    title: "The Cost of Being Wrong Quietly",
    dek: "In one week this project found four controls that reported success while being wrong. Every one was caught the same way, and none by the tooling built to catch it.",
    pillar: "field-notes",
    tags: "incidents, verification, postmortem, ci, tooling, engineering-practice",
    published: true,
    reading_time_minutes: 9,
    hero_image_url: null,
    created_at: new Date("2026-09-19T00:00:00.000Z"),
    updated_at: new Date("2026-09-19T00:00:00.000Z"),
    body: `
<h2>Four green checks</h2>
<p>Over about a week, preparing a release, this project found four separate controls that were reporting success while being wrong. None was flaky or intermittently misconfigured. Each was wrong every time, with a passing check on top.</p>
<ul>
  <li>A production build exited <code>0</code> having never contacted a database. It assigned a placeholder connection string before reading any environment file, generated every page from static fallbacks, and reported success. Two such builds were taken as evidence the artifact was sound.</li>
  <li>The written convention was itself wrong. It prescribed gating build-time warnings on "is this production", which a production build also satisfies. The code implemented that faithfully across twenty-three call sites and produced several hundred stack traces per build.</li>
  <li>An infrastructure inventory documented two protections that did not exist.</li>
  <li>That inventory's own tests <strong>enforced</strong> the fiction, asserting the name of a branch that had never been created.</li>
</ul>
<p>The fourth is the one worth sitting with. The test was not absent or skipped. It ran, it passed, and what it protected was a belief.</p>

<h2>The common shape</h2>
<p>None of these were failures to check. All four were checks that could not fail.</p>
<p>The build could not fail on an unreachable database, because nothing in it treated that as an error; its success carried no information. The convention could not be violated, because the condition was always true. The inventory could not drift, because its test asserted the document against itself rather than against the provider.</p>
<p>Which gives a usable test for your own tooling: <strong>a green check is only evidence when a red one was possible.</strong> For any check you rely on, you should be able to name the change that turns it red. If you can't, the check only reports that it ran.</p>

<h2>How every one was actually found</h2>
<p>Each was found by comparing what a tool claimed against what the system was observed to do: the provider's API rather than the document describing it, the running site rather than the build log.</p>
<p>Two of the week's wrong turns came from reading the tail of a long log and declaring success. The contradicting warning was near the top both times, in language that read as routine: <em>"Setting dummy connection string for offline compilation."</em> Perfectly clear, printed on every silent build, and missed because it described an intended mode. A warning that sounds like a status line is not a warning.</p>

<h2>The fifth one, caused on purpose</h2>
<p>The other four were found. This one was manufactured, by finally running a database restore rehearsal that had sat on the backlog specifically because nobody had ever done it.</p>
<p>The rehearsal cut production over. The tool did what it was told: the parameter controlling that behaviour defaults to "yes, promote this", and the documentation says so plainly. It was read, and the default was accepted anyway, which is its own small lesson about how documentation performs under momentum.</p>
<p>No data was lost, and that was verified rather than assumed: identical schema and content fingerprints before and after, and the newest write in the database predated the restore point by thirty-four days. The rollback was the instructive part. Reversing the designation did not move the compute endpoint with it, and the provider refuses both to delete a root branch's endpoint and to add a second one to an occupied branch. The operation was not symmetric, and nothing said so in advance.</p>
<p>The rehearsal was worth more for that than for the number it produced. A recovery procedure nobody has executed is a hypothesis. This one turned out to have a sixty-four second recovery time and a footgun in the second step, and only one of those was discoverable from the documentation.</p>

<h2>What actually changed</h2>
<p>The useful changes were structural:</p>
<ul>
  <li>Make the build fail on an unreachable data source, so that a green build means something. Distinguish an empty result from a failed one: they are different states, and conflating them buys false alarms or false confidence.</li>
  <li>Gate on build versus runtime, not production versus non-production.</li>
  <li>Verify controls against the provider, not against the artifact describing the provider.</li>
  <li>For every guardrail, confirm the test fails when the guardrail is removed. Do this by removing it.</li>
  <li>Write down the failure modes that are silent, separately from the ones that crash. They need different detection, and only the second kind gets found by watching for errors.</li>
</ul>

<h2>The uncomfortable part</h2>
<p>Every one of these controls was built deliberately, by someone trying to be careful. The build guard, the convention, the inventory, and the test were each a good-faith attempt to prevent exactly the class of problem they went on to conceal.</p>
<p>The answer is to ask of each control, every so often: what would it look like if this were broken, and would I be able to tell? For four controls here, the answer was that it would look precisely like it looked every day.</p>
`.trim(),
  },
  {
    id: "fallback-blog-10",
    slug: "notes-from-my-first-job",
    title: "Patty's Drive-Thru: Notes From My First Job",
    dek: "My first job was a drive-thru window, on and off from 2014 to 2017. I turned one shift of it into a small first-person game. These are the notes behind it.",
    pillar: "field-notes",
    tags: "personal, first-job, game-design, arcade, patty-drive-thru",
    published: true,
    reading_time_minutes: 3,
    hero_image_url: null,
    created_at: new Date("2026-10-06T00:00:00.000Z"),
    updated_at: new Date("2026-10-06T00:00:00.000Z"),
    body: `
<p>Most of this site is about systems: clinical data, proofs, pipelines. This entry is about the person who builds them. My first job was the drive-thru window at a fast-food place. I don't remember it fondly, but it shaped me, so I wrote one shift of it down the way I most like to make things: as a game. You can <a href="/arcade/patty-drive-thru">clock in at Patty's Drive-Thru</a> in the arcade.</p>

<h2>What made it into the booth</h2>
<p>The order screen over the counter, where tickets turn yellow, then red, while you watch. A register that hid simple requests several menus deep. The automatic drink machine, which lost drinks often enough that re-entering them was part of the work. The coffee button I was not allowed to press, because I was not eighteen yet. A shift manager who could not stand to see anyone idle. Customers who talked into the speaker as if nobody was on the other end.</p>

<h2>What stayed out</h2>
<p>The chain in the game is made up and the people in it are renamed. Some of that job does not belong in a game, and it is not in this one.</p>

<h2>What it taught me</h2>
<p>The best manager I had there was the general manager, who was kind without having to be. Most of what I learned came from the rest of it: how quickly people stop seeing the person in the uniform, and how little it costs to be decent anyway.</p>

<h2>Next shifts</h2>
<p>Later slices may add the fry station on Fridays, the plastic trays I used to sing about, and the dish pit. For now there is one booth and one shift: <a href="/arcade/patty-drive-thru">clock in at Patty's Drive-Thru</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-11",
    slug: "the-claim-has-to-be-smaller-than-the-code",
    title: "The Claim Has to Be Smaller Than the Code",
    dek: "My CRF Studio advertised compliance the code never implemented. Taking the claim down took a day. Checking what was left underneath found far more.",
    pillar: "clinical-data-engineering",
    tags: "cdisc, controlled-terminology, cdisc-core, independent-qc, clinical-data-systems, honesty",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-10-25T03:00:00.000Z"),
    updated_at: new Date("2026-10-25T03:00:00.000Z"),
    body: `
<h2>A badge I should not have shipped</h2>
<p>This week I had my own site reviewed the way a clinical data manager would read it, and I did not like what came back. CRF Studio carried a badge announcing one hundred percent conformance with CDISC and SDTM. Its audit log was described as an unalterable Part 11 trail. A status line declared the whole thing ready for regulated work.</p>
<p>None of that was implemented. What existed was a useful subset of design checks from the CDASH and SDTM implementation guides, an audit trail that lives in browser state, and a local slice of controlled terminology. That is a reasonable thing for a portfolio to show. The copy claimed far more, and the people the clinical work is written for are the readers who notice the gap and stop trusting the rest of the page.</p>
<p>I cannot quote the old wording here. This file is one of more than 130 that a test now scans for it, and the build would fail.</p>

<h2>Describe what is implemented</h2>
<p>The replacement rule is easy to state: copy describes the checks that exist, never the standard they are aimed at. A clean run now reads "No findings from the implemented checks." The audit trail is a "Part 11-style audit trail (simulation)". The terminology is a local subset aligned to one NCI EVS package.</p>
<p>A rule like that decays once nobody is watching, so I wrote it as a function. <code>findClinicalClaims()</code> matches the shapes that kept appearing: a standard or regulation followed by "compliant", a percentage score in front of a standard, a promise to comply with a regulation, an audit trail that cannot be changed. A test runs it across the clinical routes, components and libraries, the social card presets and this blog, and names the phrase and the file when it fails. It also has to let honest sentences through, so the test keeps a list of those as well. "Three non-compliant records." must pass.</p>

<h2>Then I checked the codes</h2>
<p>"Aligned to the package" was itself a claim, so the next job was to check it. Every codelist and term in CRF Studio went up against the NCI EVS SDTM terminology file for the package date the site declares.</p>
<p>It was worse than the issue I had filed. Most term codes were wrong or missing from the package, and several codelists sat under codes that belong to <em>other</em> codelists:</p>
<ul>
  <li>The yes/no codelist used C66741, which is the vital signs test code list. Sex used C66742, which is the yes/no list.</li>
  <li>Race and ethnicity pointed at codelists that have been retired; their last appearance was the 2025-09-26 package. Collection now uses C128689 and C128690.</li>
  <li>Severity was filed with CTCAE grade codes. Mild, moderate and severe have their own: C41338, C41339 and C41340.</li>
</ul>
<p>The wrong codes were published in ODM <code>def:NCICode</code> attributes, SAS format comments, the annotated CRF and the Word export. Every one of them looked right, which is the worst property a wrong identifier can have. A misspelled term fails a lookup. A real code from the neighbouring codelist passes every check that does not go back to the source file.</p>
<p>The error had spread, too. The study data pipeline wrote a dose unit of <code>TABLETS</code>, an extension that existed only to match the wrong CRF code. It now writes the package's own <code>TABLET</code>, C48542, and the golden files that changed changed for that reason alone.</p>

<h2>An outside opinion, in CI</h2>
<p>My own conformance stage checks my own reading of the rules. That is circular, so the pipeline's outputs now also go through CDISC's open-source rules engine, CORE, pinned to v0.17.1, in a separate workflow that runs whenever the pipeline changes and once a week.</p>
<p>The first run reported findings on 69 rule and dataset pairs. Sorted by cause:</p>
<ul>
  <li>55 are real defects in my pipeline or its study definition, each tracked in an issue.</li>
  <li>12 are engine limitations, such as duplicate-check rules that misfire on the fixture.</li>
  <li>1 is by design: adverse events carry no epoch.</li>
  <li>1 is a gap in the engine's terminology cache.</li>
</ul>
<p>The design decision worth copying is the allowlist that explains them. CI fails on any finding the list does not explain, which is the usual rule. It also fails on any entry that CORE <em>no longer</em> reports. A fix proves itself by making its allowlist entry stale, so the list cannot turn into a museum of problems solved months ago.</p>
<p>The job summary also says what was not checked. CORE's newest cached terminology is from March while the pipeline declares September, so the export substitutes the older release and says so. CORE has no ADaMIG rules yet, so the analysis layer is reported as "not run". The workflow asks the engine for its rule list rather than hardcoding that, so it will notice when they arrive.</p>

<h2>Program it twice</h2>
<p>Clinical programming has an old answer to "how do you know the derivation is right": a second programmer writes it again from the specification, without looking at the first, and the outputs are compared. The pipeline now has that, as a test suite. Study days, baseline selection, change from baseline, last observation carried forward, adverse event date imputation, treatment-emergent flags, time to event and the three summary tables are each derived again from the specification and compared row for row with the pipeline, on the study's own seed and on 200 generated ones.</p>
<p>Its pull request listed what it could not test. The synthetic generator never lands an adverse event on the edge of the treatment-emergent window, so a mutant that moves that edge from fourteen days after last dose to thirteen survives. That gap is written down next to the suite.</p>

<h2>Smaller claims, more checks</h2>
<p>The page that runs the pipeline now says what it is: one fictional study, synthetic subjects, and a conformance stage that models a subset of published rules and is not a validator of record. That is a much smaller sentence than the badge was. Behind it sit a wording guard, a terminology check against the source file, an outside rules engine whose findings are tracked one by one, and an independent second implementation.</p>
<p>I would rather publish the small sentence with all of that behind it than the large one with nothing.</p>

<p>You can <a href="/study-data">run the pipeline</a> and download its package, or read how it is built in the <a href="/case-studies/study-data-pipeline">Study Data Pipeline</a> case study. <a href="/crf">CRF Studio</a> is where the corrected codes now live.</p>
`.trim(),
  },
  {
    id: "fallback-blog-12",
    slug: "four-lanes-one-merge-slot",
    title: "Four Lanes, One Merge Slot",
    dek: "Thirty-eight pull requests reached main in one day from four parallel agent lanes. What made it work was a plain rule: only one of them merges at a time.",
    pillar: "agent-first-dx",
    tags: "agents, ci, pull-requests, merge-queue, parallel-work, typescript",
    published: true,
    reading_time_minutes: 7,
    hero_image_url: null,
    created_at: new Date("2026-10-25T02:00:00.000Z"),
    updated_at: new Date("2026-10-25T02:00:00.000Z"),
    body: `
<h2>The day in numbers</h2>
<p>On 24 October, main took 38 squash merges. They came from four lanes running in parallel: clinical release blockers, the clinical data platform, the arcade's phone work, and CI and test debt. Each lane is a coding agent working through its own queue of issues. I set the queues, make the product calls, and press the buttons only a person should press.</p>
<p>The throughput came from a rule about how their work reaches main, and the rule came from a bad evening the day before.</p>

<h2>What stacking cost</h2>
<p>That evening I let one wave of work land as a stack: each pull request based on the branch of the one below it, so they would merge in order. It looks tidy. It went badly, for reasons that are specific to this repository's setup and are probably true of yours:</p>
<ul>
  <li>Nothing above the bottom of the stack got CI. The workflow runs for pull requests into <code>main</code>. A pull request into another branch ran no gates at all, so the stack was green the way an empty test suite is green.</li>
  <li>Squash merges into intermediate branches leave add-versus-nothing conflicts that have to be resolved by hand, and every resolution is a chance to drop someone's change.</li>
  <li>Closing keywords only fire on a merge into the default branch, so issues stayed open after their work had merged.</li>
  <li>The history stopped describing itself. When the stack collapsed, the commit on main titled for Dataset-JSON, CSV and XPT exports also carried the arcade's stage-fitting layout and its tests. Anyone bisecting a layout regression later lands on a commit whose message is about clinical exports.</li>
</ul>

<h2>The rule: one slot</h2>
<p>Since then every pull request is cut from main and targets main. Work stays in draft until its quick checks pass. Only one pull request at a time may be marked ready: the one holding the slot. Whoever takes the slot merges the current main into their branch, reruns the fast checks if main moved, pushes, marks it ready and turns on auto-merge once. When it lands, the next one moves up.</p>
<p>A few files are touched by nearly every feature: the command palette, the navigation data, the sitemap, the route metadata, <code>package.json</code>, the CI workflow and the README. Those take a lock in the lane file before anyone edits them, so two lanes never find the conflict at merge time.</p>
<p>In effect it is a merge queue written in Markdown, and every agent reads it before any pull request action. Each pull request waits longer than it would in a free-for-all, but the day goes faster, because almost nothing has to be done twice.</p>

<h2>What the slot does not protect</h2>
<p>Serialising merges does not serialise <em>resources</em>. Two pull requests that day, Duck's Halloween mode and the new study data page, each passed every gate on its own and failed together. The cold type check needed about 2.54 GB of live heap, and CI's budget was 2,560 MB. Neither change was large. The program was around 5,800 files by then, and those two happened to be the pair that crossed the line.</p>
<p>Both ceilings went up by 512 MB, with the CI budget still 512 MB below the production build's, so growth still fails a pull request before it can reach a deploy. Before raising anything, the obvious suspects were measured. Leaving the tests out of the program dropped memory from about 3.0 GB to 2.0 GB. Stubbing a 7.6 MB icon declaration file down to the 262 icons actually used made no difference that rose above the run-to-run noise of about 300 MB. That second result saved a refactor nobody needed.</p>
<p>A budget gate is a shared resource. Parallel lanes spend it together, and the lane that crosses it is rarely the one that grew it most.</p>

<h2>Two smaller lessons</h2>
<p>First, push everything before you turn on auto-merge. The metric registry merged while its governance commit was still being written, because auto-merge does exactly what it says. The follow-up became its own pull request from main. Now a branch is finished before auto-merge goes on, or the next change is a fresh pull request.</p>
<p>Second, a shared types file is a serial resource too. Every platform pull request added to the same types file and the same table in the architecture decision record. One evening I marked three of them ready and turned on auto-merge for all three at once. Each merge forced the other two to merge main again and resolve the same two files. Resolving additively (keep both type blocks, keep both table rows, regenerate the docs) made it safe. Following my own rule would have made it unnecessary.</p>

<h2>What I would tell someone starting</h2>
<ul>
  <li>Build in parallel and merge one at a time. Agents in separate lanes are cheap, and merges that race cost rework.</li>
  <li>Do not stack branches unless CI runs on every base. Check that before you trust a green tick.</li>
  <li>Write the lane rules where the agents read them before acting, and keep each edit small and dated.</li>
  <li>Treat every budget CI enforces, whether memory, time or bundle size, as shared by every lane, and measure before you raise one.</li>
  <li>Name the files everyone touches, and lock them.</li>
</ul>

<p><a href="/blog/what-agent-first-tooling-actually-requires">What Agent-First Tooling Actually Requires</a> covers the guardrails each agent works inside. This post is about what happens when several of them work at once.</p>
`.trim(),
  },
  {
    id: "fallback-blog-13",
    slug: "one-game-three-screens",
    title: "One Game, Three Screens",
    dek: "Each arcade game here is being split into one headless session and three views. The first move touched 57 files and, by design, none of the gameplay.",
    pillar: "browser-graphics-engineering",
    tags: "arcade, react, architecture, refactoring, mobile, canvas, testing",
    published: true,
    reading_time_minutes: 7,
    hero_image_url: null,
    created_at: new Date("2026-10-25T01:00:00.000Z"),
    updated_at: new Date("2026-10-25T01:00:00.000Z"),
    body: `
<h2>Where touch support had got to</h2>
<p>Every game in the arcade has had an iPad pass, and every pass made "tablet" a branch rather than a view. A game's single component, between three and six thousand lines, gained touch conditionals and a scoped touch stylesheet. Phones are still behind a desktop-only notice. Adding a phone layout the same way would put a third branch into every one of those conditionals, and every desktop change would then risk two touch layouts.</p>
<p>The games also repeated each other. There were eight copies of the same auto-pause module, seven bespoke touch docks, four ways to size a canvas and seven copies of the high-score store.</p>

<h2>One session, three views</h2>
<p>The plan gives each game one headless session and three views: desktop, tablet and phone.</p>
<ul>
  <li>The session owns the game: state, the fixed-step loop, timers, saves, scoring and an action map. It never reads the viewport or the pointer type.</li>
  <li>The session is an external store. It exposes <code>getState</code>, <code>subscribe</code> and <code>dispatch</code>, plus an <code>onFrame</code> channel that asks the mounted view to paint once per frame. HUD components read slices of it, so a frame does not re-render React.</li>
  <li>A view only lays out and paints. Views never branch on the device. Choosing the view is the branch.</li>
  <li>The session holds no DOM. Canvases and WebGL contexts belong to the view and are disposed of when it unmounts. iOS caps a page at roughly sixteen live WebGL contexts, so a swap that leaked one would run out within a few rotations.</li>
</ul>
<p>Rotating a phone or narrowing a window pauses the game, swaps the view and keeps the run.</p>

<h2>Moving code without changing it</h2>
<p>Retro Labyrinth went first. The rule for the move was that code moved as it was and nothing was rewritten. The game's state and rules went into <code>useRetroLabyrinthSession</code>, the view now reads a typed snapshot and acts through named intents, and the presentation pieces went into shared parts. The view component went from 4,387 lines to about 1,430.</p>
<p>"No gameplay change" is an easy claim to make about 57 changed files and a hard one to check by playing. Two things checked it instead:</p>
<ul>
  <li>Replays: five runs had been recorded on main before the move. After the move, all five replay to exactly the same result.</li>
  <li>Pixels: screenshots at 1024, 1280 and 1440 pixels wide, with a frozen clock and seeded randomness, were compared against main. The launched and moved states are identical.</li>
</ul>
<p>The screenshot comparison also found that a developer-only view picker was showing in production builds, and that patrols started moving while the view's code was still downloading. The loop now runs only while a view has registered a painter and the room is not paused.</p>

<h2>Generate the docs from the map</h2>
<p>Keys and gamepad buttons now come from one action map. The cabinet's control list and the field manual's key column are generated from it, which fixed a small, old lie: the control list said the tools sat on keys 1 to 3, and the game read 1 to 5.</p>

<h2>A retry is not a pass</h2>
<p>The first CI run of that pull request failed device tests that had passed locally. They had passed locally because Playwright retried them. The summary said 120 passed, and the tests that only passed on a second attempt were counted inside that number. Device runs are now repeated with retries off before a pull request asks for review.</p>

<h2>A report that was not a bug</h2>
<p>A report said the touch controls in Working With Duck vanished after closing the wardrobe. That was intended: a hardware Escape key had switched the input mode to keyboard, and the touch dock fades out until the next tap. Looking into it still turned up two real bugs. The same dialog had close buttons with no accessible name and a heading order that skipped a level, and both are fixed.</p>

<h2>Where it stands</h2>
<p>One registry now decides, per game, whether the phone notice shows, which badge the hub card carries and which games the notice suggests instead. Two of the twelve games play on a phone today: Trial &amp; Error and Meme Vault. Retro Labyrinth's phone view is next. A game comes off the notice only after it has been played on a real phone and is fun there, not just when its tests pass.</p>

<p>The <a href="/arcade">arcade</a> is open on desktop and tablet. On a phone, the notice points to the games that are ready.</p>
`.trim(),
  },
  {
    id: "fallback-blog-14",
    slug: "coverage-counts-what-ran",
    title: "Coverage Counts What Ran. Mutants Count What Was Checked.",
    dek: "A mutation run over the study data derivations found weak spots that coverage missed, and one gap that was not in the tests at all but in the test data.",
    pillar: "formal-verification",
    tags: "mutation-testing, stryker, vitest, coverage, testing, clinical-data-systems",
    published: true,
    reading_time_minutes: 7,
    hero_image_url: null,
    created_at: new Date("2026-10-25T00:00:00.000Z"),
    updated_at: new Date("2026-10-25T00:00:00.000Z"),
    body: `
<h2>What coverage cannot tell you</h2>
<p>Line and branch coverage answer one question: did the tests execute this code? They say nothing about whether any test would notice if the code were wrong. A suite can run every line of a derivation and assert only that it returned an array.</p>
<p>Mutation testing asks the second question. A tool (Stryker, here) makes small changes to the source one at a time: it flips a comparison, removes a <code>+ 1</code>, swaps <code>&amp;&amp;</code> for <code>||</code>. Then it runs the tests against each mutant. A mutant that no test kills is a change in behaviour your suite would have shipped.</p>

<h2>The study data derivations</h2>
<p>Until this week nothing mutation-tested the SDTM, ADaM and table derivations behind the <a href="/study-data">study data pipeline</a>. They sat under the library-wide coverage floor of 70% of branches, which is a low bar for code that decides who counts as having a treatment-emergent adverse event.</p>
<p>The first run scored 80.65% over 1,891 mutants, and the spread between files told me more than the total. Each file now has its own floor at its measured score: the ADaM core and the table filters at 91, the Kaplan-Meier code at 88, and the table assembly at 56. That last number is low, and it sits in the configuration as it is instead of being averaged into the others.</p>
<p>Writing tests aimed at the surviving mutants added 27 edge cases on hand-made SDTM fixtures: baseline ties on the first-dose day, age-group boundaries, overlapping analysis windows, year-only partial dates, censoring for a subject with no contact at all. Branch coverage on the ADaM core went from 82% to 96%, and on the event derivations from 76% to 91%.</p>

<h2>A ratchet instead of a target</h2>
<p>The issue asked for 95% branch coverage across the module. Measured coverage after the new tests was 86.8%, and most of the remaining branches are <code>?? []</code> fallbacks that the public API cannot reach. Tests written to hit them would exercise paths that real inputs never take, only to move a number.</p>
<p>I chose a ratchet instead. The floor is set at today's measurement (96% of statements, 86% of branches, 99% of functions and 96% of lines), and a test pins it so it can only go up. A target records where you would like to be. A ratchet records where you are and stops you sliding back.</p>

<h2>The mutant that was a data problem</h2>
<p>An independent QC suite programs the key derivations a second time from their specifications and compares them with the pipeline across 200 generated seeds. One mutant survives it anyway: move the end of the treatment-emergent window from fourteen days after last dose to thirteen, and nothing fails.</p>
<p>The QC logic for that boundary is in place. The gap is in the data: the synthetic generator never lands an adverse event on that boundary, never writes a partial end date, and never discontinues a subject for any reason other than an adverse event. No assertion can catch a case the data never contains.</p>
<p>So the fix belongs in the test data: a library of deliberately messy scenarios, each with the findings it is expected to produce, is where those cases will come from.</p>

<h2>What it costs</h2>
<p>Mutation testing is slow, and the cost decides where it runs. The study data scope took 119 minutes on a loaded four-core container, so it runs weekly with a 150-minute bound, not on every pull request. The independent QC suite stays out of the mutation run: it costs about 30 seconds per re-import, which pushed the estimate past five hours.</p>
<p>The tooling can fail too. This time it failed loudly. Upgrading to Vitest 5 broke the Stryker runner: it built test-name filters with spaces, Vitest 5 joins test names with <code>" &gt; "</code>, and every mutant ran zero tests. The gate scored 0%. At least a zero is obviously wrong. A filter that matched half the tests would have produced a plausible number, and I would have believed it. Once the runner was updated, the pull request gate came back at 82.24%, the same as before the upgrade, which is the check that the upgrade changed nothing it should not have.</p>

<h2>When to bother</h2>
<p>Most code does not need this. Derivations do, along with anything where a wrong answer looks like a right one: a count that is off by the subjects on a boundary day still renders as a perfectly good table. For that kind of code, coverage shows the tests ran, and mutants show whether they would notice a mistake.</p>
`.trim(),
  },
  {
    id: "fallback-blog-15",
    slug: "a-check-that-always-fails",
    title: "A Check That Always Fails Is Worse Than None",
    dek: "For twelve days every release of this site needed a manual override past a failing check. The fix was to delete the check, and the reason is worth keeping.",
    pillar: "field-notes",
    tags: "deployment, vercel, ci, quality-gates, incidents, engineering-practice",
    published: true,
    reading_time_minutes: 5,
    hero_image_url: null,
    created_at: new Date("2026-10-26T12:00:00.000Z"),
    updated_at: new Date("2026-10-26T12:00:00.000Z"),
    body: `
<h2>Twelve days of Force Promote</h2>
<p>Every production deploy of this site since 14 October went the same way. The build finished and the deployment showed READY. Then nothing happened. The domain stayed on the old deployment until I opened the Vercel dashboard and pressed Force Promote. On 25 October one deployment sat READY for almost an hour before I did.</p>
<p>I had stopped noticing. Pressing Force Promote had become a step in the release, the same as pressing Deploy.</p>

<h2>What was failing</h2>
<p>Vercel holds a production deployment off its domains until the project's Deployment Checks pass. This project had two, Lint and Typecheck, which Vercel runs itself in a separate sandbox. The runbook, the deployment guide and an architecture decision record all said something else: that the check waited for the GitHub Merge Gate. That check had never been configured. The documents described a control that did not exist, and nobody re-read the settings page because the documents sounded sure.</p>
<p>Lint passed every time. Typecheck printed "Types generated successfully", ran for about 80 seconds, and exited with code 137. Every production deployment checked since the 14th had failed the same way: eight of them.</p>
<p>Exit 137 is a SIGKILL from the out-of-memory killer. The sandbox ran <code>tsc</code> with a 3,584 MB heap ceiling alongside ESLint, and the two did not fit in its memory together. This project had already raised that ceiling twice, most recently on 24 October, after two pull requests crossed the CI budget together. A third raise would not have helped: <code>--max-old-space-size</code> moves V8's limit, not the machine's.</p>

<h2>Remove it, don't fix it</h2>
<p>One fix was to make the check pass with a smaller program, a bigger sandbox or lint on its own. First I asked what the check caught that nothing else did, and the answer was nothing.</p>
<ul>
  <li>CI already runs both. The static gate runs lint and a cold type check on every pull request and every push to main, and the main branch requires it.</li>
  <li>The production build type-checks itself. It runs the type check as its own step before anything is compiled. A type error fails the build, so it never gets far enough for a deployment check to hold it.</li>
</ul>
<p>The Typecheck check was a third run of the same verification, on a machine too small for it. When it worked, it added nothing. When it failed, which was always, it taught the person releasing to override it. I removed both checks. The next production deploy had the domain 2.6 seconds after it was READY.</p>

<h2>Don't swap in the obvious replacement</h2>
<p>The documents had promised a Merge Gate check, so wiring one up looked like the obvious fix, but it would have failed in a new way. CI cancels an in-progress run on main when a newer merge lands, which keeps the queue short. A commit whose run was cancelled never gets a passing Merge Gate, so on a busy day the check would have held back any commit that was not the last to land. The documents now say what is configured, which is nothing, and why.</p>

<h2>A gate is worth what only it catches</h2>
<p>An earlier post here, <a href="/blog/the-cost-of-being-wrong-quietly">The Cost of Being Wrong Quietly</a>, argued that a green check is only evidence when a red one was possible. A check that is always red is no evidence either, and it does more damage than having no check, because it trains people to click past red. By the time a real failure arrived, Force Promote would have been muscle memory.</p>
<p>Questions I now ask of any gate:</p>
<ul>
  <li>What does it catch that nothing earlier catches? If the answer is nothing, it is cost and noise.</li>
  <li>When did it last pass? A gate that has not passed in a week has become a step people skip.</li>
  <li>Does the documentation match the settings page? Check the provider's settings. Here the runbook and the provider disagreed about which check even existed.</li>
  <li>Is the fix more resources, or less duplication? Raising a limit is right when the work is necessary. Here it was the third copy of the same work.</li>
</ul>
<p>An override button is useful, and it should feel unusual every time you press it. Once pressing it is routine, look at the thing it overrides.</p>
`.trim(),
  },
  {
    id: "fallback-blog-16",
    slug: "the-engine-checks-the-standard-not-the-study",
    title: "A Conformance Engine Checks the Standard, Not the Study",
    dek: "I ran CDISC's own rules engine over sixteen deliberately messy versions of a study. Its output was unchanged for twelve of them, and that is the right answer to a different question.",
    pillar: "clinical-data-engineering",
    tags: "cdisc, sdtm, data-quality, conformance, traceability, ci",
    published: true,
    reading_time_minutes: 6,
    hero_image_url: null,
    created_at: new Date("2026-10-27T12:00:00.000Z"),
    updated_at: new Date("2026-10-27T12:00:00.000Z"),
    body: `
<h2>Sixteen ways to break a study</h2>
<p>The <a href="/study-data">study data pipeline</a> on this site has an "Inject an issue" menu. Each of its sixteen scenarios changes the synthetic study in one way real study data gets messy: an adverse event that started on 30 February, a screen failure screened again under the same subject number, a vital sign entered twice, sex recorded as FEMALE instead of F, a lab unit that changes mid-study, a missing baseline, a death on treatment. Each scenario also declares which of the site's own checks should fire and what the derivations should do with the bad value.</p>
<p>The site's own checks flag or handle all sixteen as declared. That proves little, since they were written alongside the scenarios. So on 26 October I ran CDISC CORE, the open-source engine CDISC publishes for its conformance rules, over the clean run and every scenario, and committed what it found.</p>

<h2>What CORE saw</h2>
<p>On the clean run, CORE evaluated 430 SDTM rules. 282 passed, 136 did not apply to this study, 9 reported issues, and 3 hit engine errors. Every reported issue was already explained in the pipeline's list of known, justified findings.</p>
<p>Then the scenarios. For twelve of the sixteen, CORE's output was identical to the clean run. For the other four:</p>
<ul>
  <li>Impossible date: CORE said the adverse event had no epoch, which is empty because no epoch can be derived from a day that does not exist. Right row, indirect reason.</li>
  <li>Rescreened subject: caught directly. The subject identifier is no longer unique in demographics, and the supplemental qualifiers are no longer unique per subject.</li>
  <li>Death during treatment and withdrawal before Week 12: a finding that already existed on the disposition record changed its value. Nothing new was reported.</li>
</ul>
<p>The duplicated vital sign, FEMALE on a codelist that admits only F and M, the unit change and the missing baseline produced nothing at all.</p>

<h2>What CORE is for</h2>
<p>CORE answers one question: does this dataset have the shape the standard requires? Are the required variables present, are the keys unique, do references resolve, do values sit where the implementation guide says they go? Reviewers ask that question first.</p>
<p>Whether a measurement was entered twice, whether a subject has a baseline, whether a date exists on the calendar: those are questions about this study's data, and a published standard cannot answer them. A dataset can pass every structural rule and still say something false about a patient.</p>
<p>So a clinical warehouse needs both layers:</p>
<ul>
  <li>Conformance to the published standard. Run the engine the standard's authors publish, pinned to a recorded version, instead of a home-grown copy of their rules. When the engine and your copy disagree, your copy has to explain itself.</li>
  <li>Study-specific data quality. Rules written against the protocol and the data: duplicates, missing baselines, impossible dates, units that drift. This layer is yours to write, and nobody else can.</li>
</ul>
<p>The twelve silent scenarios also say which of the site's own rules are worth keeping. A local rule that duplicates a CORE rule is a second implementation to maintain. A local rule that catches what CORE cannot is the reason to have local rules. The next step of this work retires only the first kind.</p>

<h2>The file that went stale in four minutes</h2>
<p>CORE needs Python and several minutes per run, so it runs in a CI workflow, and its findings are committed to the repository as a JSON file the site can read with no server compute. Every view in that file carries a SHA-256 fingerprint of the pipeline output CORE ran on. A unit test recomputes the fingerprints and fails when any of them differ, so a stale file fails <code>npm test</code> in seconds, without Python.</p>
<p>That test paid for itself within the hour. A pull request that added the inclusion and exclusion domain for screen failures merged at 23:51 UTC. The CORE pull request merged at 23:55. Each had passed CI against a main that did not contain the other. Together, the pipeline now produced a domain the recorded findings had never seen, and the test failed for all seventeen views. The fix reran CORE and recorded again: two new findings, both already explained, and five rules that had skipped for want of that domain now passed.</p>
<p>Without the fingerprint nothing would have failed, and the file would have gone on describing a dataset that no longer existed, and the site would have shown CDISC's verdict on data CDISC never saw.</p>

<h2>What I would take to any warehouse</h2>
<ul>
  <li>Plant defects, then see which layer catches each one. The gaps tell you what your own rules are for.</li>
  <li>Silence from a conformance engine means the structure is sound. It says nothing about whether the data is clean.</li>
  <li>Record the engine's version with its results. A finding without the rule set that produced it cannot be reproduced.</li>
  <li>Treat every committed derived file as a cache. Store the fingerprint of its inputs beside it and test that the two still match. Two green pull requests are not a green merge when one generates a file from the other's inputs.</li>
</ul>
<p>CDISC CORE is CDISC's open-source engine. Running it here does not imply CDISC endorsement.</p>
`.trim(),
  },
  {
    id: "fallback-blog-17",
    slug: "merging-is-not-releasing",
    title: "Merging Is Not Releasing",
    dek: "This site used to ship whenever I remembered to press a button. Now it ships once a week, and a release only counts after the live site has passed its checks.",
    pillar: "field-notes",
    tags: "release-engineering, change-control, ci, github-actions, vercel, engineering-practice",
    published: true,
    reading_time_minutes: 6,
    hero_image_url: null,
    created_at: new Date("2026-10-27T13:00:00.000Z"),
    updated_at: new Date("2026-10-27T13:00:00.000Z"),
    body: `
<h2>What a release used to be</h2>
<p>Until 26 October, production shipped when I opened the Vercel dashboard and pressed Create Deployment. About fourteen commits reach main on a typical day. I released five times between 4 and 19 October, and the last version tag was v0.4.1, from 30 September. If you had asked which version was live, the true answer was a commit SHA from <code>/api/version</code> and whatever I remembered about it.</p>
<p>Clinical systems often have the same shape. Each change is reviewed and tested on its own, but the release, the moment changes reach the people using them, rests on one person's memory. Change control asks a release four questions: what changed, who decided it should ship, what evidence showed it worked, and how do we get back. A pull request answers them for one change. Nothing answered them for the batch that went live.</p>

<h2>Merges never deploy</h2>
<p>The first rule is that a merge does nothing to production. <code>vercel.json</code> sets <code>git.deploymentEnabled</code> to <code>false</code>, so merges and branch pushes never start a build. Production ships from one GitHub Actions workflow, the weekly release train, every Sunday evening at 7 PM Central. I can also start it by hand.</p>
<p>The train checks its gates in order and stops at the first that fails:</p>
<ul>
  <li>It runs only while a repository variable says it is on, and not at all while any open issue carries the <code>release:hold</code> label.</li>
  <li>The candidate is the head of main. If the live site already serves it, there is nothing to release.</li>
  <li>The repository's required check, Merge Gate, must have passed on that exact commit.</li>
  <li>A script reads every database migration added between the live commit and the candidate and flags statements that would break the running app: dropped tables or columns, renames, new NOT NULL constraints, type changes. A finding holds the release so that I ship it by hand.</li>
</ul>

<h2>Test the commit you ship</h2>
<p>I did not see this gap coming. Every pull request passes the full browser suite before it merges. A squash merge then creates a new commit, and CI on main skips the browser jobs, so the commit that ships has never been in a browser. It is almost always the same code as the pull request, and "almost always" is a poor thing to write in a release record.</p>
<p>So the train builds the candidate itself, with the same bundle budgets as CI, and runs the full Chromium Playwright suite against it in three shards, in the same digest-pinned container image. Those jobs get a read-only token. If they fail, nothing ships and the train opens an issue for me. That issue does not hold next week's train, because production has not changed.</p>

<h2>Publish after production answers</h2>
<p>With the gates passed, the train drafts a GitHub Release. The version comes from the commit messages since the last tag: a feature bumps the minor number, anything else the patch. It checks that main still points at the candidate, then POSTs a Vercel Deploy Hook. The hook can build main and do nothing else, and its URL is the only production-related value GitHub holds. Database credentials stay in Vercel. The train never holds a Vercel token, never runs a migration and never builds what ships.</p>
<p>Then it waits up to 40 minutes for <code>/api/version</code> to report the release commit, runs the synthetic probes against the live site, and only after they pass publishes the Release, which creates the tag. If any of that fails, the Release stays a draft and the train opens a <code>release:hold</code> issue assigned to me, which also stops next week's run. A version tag on this repository now records a commit that passed in production.</p>
<p>v1.0.0 shipped this way on 27 October, from a manual run. Every gate passed, and the Deploy Hook built production while Git deployments were switched off. Vercel does not document that those two work together. The first real run is how we found out, and the decision record says what to do if Vercel changes it.</p>

<h2>The dry run that probed nothing</h2>
<p>The train has a dry-run mode that probes the live site without drafting or deploying anything. The first dry run finished green. Its smoke-test job had been skipped.</p>
<p>The probe job's <code>if</code> condition had no status function, so GitHub Actions added an implicit <code>success()</code>, which is false whenever any upstream job was skipped. A dry run always skips the release-candidate jobs. The fix was an explicit condition starting with <code>!cancelled()</code>, and a test now pins it (#3027). A skipped job shows as a grey icon in a green run, and nobody reads grey icons, so a gate needs a test that proves it ran.</p>

<h2>What I would keep anywhere</h2>
<ul>
  <li>Separate merging from releasing, and give each release its own record: a version, notes, a compare link and the evidence.</li>
  <li>Test the artifact you ship. If your merge strategy creates a new commit, test that commit.</li>
  <li>Publish the release record after production has answered, so it describes what happened.</li>
  <li>Make holding a release cheaper than overriding a check. Here a label on an issue stops the train, and removing it is a deliberate act.</li>
  <li>Keep the deploy credential narrow. A URL that can only rebuild one branch can do far less harm than a token that can do anything.</li>
</ul>
<p>Rollback is still a person, using Vercel's Instant Rollback. None of this makes the site a validated system. It does mean every week's changes have a record a reviewer can follow from the Release to each pull request in it.</p>
`.trim(),
  },
  {
    id: "fallback-blog-18",
    slug: "an-export-is-a-claim-until-the-schema-agrees",
    title: "An Export Is a Claim Until the Official Schema Agrees",
    dek: "Every form CRF Studio exported failed CDISC's own ODM schema, and nothing on the site had noticed. Here is what turned up when I checked the exports against the standards' own tools.",
    pillar: "clinical-data-engineering",
    tags: "cdisc, odm, usdm, ars, controlled-terminology, conformance, ci",
    published: true,
    reading_time_minutes: 7,
    hero_image_url: null,
    created_at: new Date("2026-10-27T14:00:00.000Z"),
    updated_at: new Date("2026-10-27T14:00:00.000Z"),
    body: `
<h2>Shaped like the standard</h2>
<p><a href="/crf">CRF Studio</a> builds case report forms and exports them as CDISC ODM XML, the format EDC systems use to exchange study metadata. It also exports a USDM study design. The <a href="/study-data">study data pipeline</a> writes an ARS reporting event that describes its analysis results. All of those files looked right. The element names matched the specifications, the structure was plausible, and our own importer read every file back without complaint.</p>
<p>Then I checked every preset's ODM export against the official XSD that CDISC publishes. Every one failed, for four reasons:</p>
<ul>
  <li>Item definitions carried a <code>CodeListOID</code> attribute where the schema expects a <code>CodeListRef</code> child element.</li>
  <li>An annotated-CRF element sat inside the item definition, where the schema does not allow it.</li>
  <li>NCI codes were written as an attribute that neither ODM nor Define-XML defines.</li>
  <li>The design audit trail was written as ODM elements that do not exist.</li>
</ul>
<p>Nothing had caught these because the only reader of the files was our own importer, written alongside the exporter. A round trip proves the two halves agree with each other. It says nothing about the standard.</p>

<h2>Use the schema the authors publish</h2>
<p>Each fix was small (#3039). The audit trail moved into a CRF Studio namespace in ODM's extension slot, which is how Define-XML extends ODM, with its own small extension schema. The importer still reads files saved before the change. The test matters most: every preset is now checked against the vendored official XSD on every run, so the next drift fails CI instead of somebody's import.</p>
<p>The ARS reporting event got the same treatment (#3045). Checked against the official ARS JSON schema, it failed in five ways. Lineage fields sat on classes that do not define them. Some analyses had no purpose. Nested where clauses had no level or order. Two file types were outside ARS's enumeration. Results carried ids ARS has no place for. The lineage was worth keeping, so it moved to its own file beside the ARS file, and a test proves the two files together rebuild the whole event. The schema test runs over the default study, two other seeds and all sixteen messy-data scenarios.</p>

<h2>Codes that looked right</h2>
<p>In controlled terminology, plausible and wrong are hard to tell apart, because a C-code is a letter and some digits. I swept the 213 NCI codes cited in the site's code against the published NCI EVS release of CDISC terminology (#3050). Some were wrong in ways nobody would catch by eye:</p>
<ul>
  <li>The USDM screening and follow-up epochs used general NCI Thesaurus concepts instead of the DDF epoch type terms.</li>
  <li>The code given for the NYHA class codelist belonged to a different codelist, and the PHQ-9 codelist code belonged to another questionnaire.</li>
  <li>One concept that exists only in the NCI Thesaurus was filed under the CDISC code system.</li>
</ul>
<p>The gate is a script that reads the hash-pinned EVS exports and writes a subset of only the codes the repository cites: 34 codelists and 186 concepts. A test fails if a cited code is not published, if the subset holds a code nothing cites, or if a CRF Studio term is not a term of its own codelist. EVS answers a request for a missing archive with an HTML page instead of an error, so the script also refuses HTML.</p>

<h2>Then the rules engine</h2>
<p>A schema checks shape. CDISC CORE, the open-source conformance engine CDISC publishes, checks rules on top of it. <a href="/blog/the-engine-checks-the-standard-not-the-study">An earlier post</a> covered running CORE over the study data pipeline. On 27 October we ran its USDM rules over every CRF Studio preset's export as well (#3055). It reported 103 findings, which came down to 19 explanations.</p>
<p>Three of the nineteen were CORE's own mistakes: a rule that flags next and previous chains that are correct, one that reports a study's only title twice, and one that reports governance dates the export does not contain. Those are recorded as engine limitations, each with its reason. Changing the export to silence them would have made it worse. The other sixteen were real export defects, among them missing eligibility criteria and five of the six presets with no arms, epochs or cells.</p>
<p>A follow-up fixed the ones the export code caused (#3061). The sponsor is now named as a study role. Every visit falls in an epoch, an unscheduled one in the epoch of the visit before it. The timeline orders visits the same way the visits order themselves. A one-arm design is labelled single group instead of parallel. That removed seven of the sixteen allowlist entries and narrowed two more. What remains is content CRF Studio does not hold yet, such as eligibility and endpoints, and the allowlist names each gap.</p>

<h2>Check the checker too</h2>
<p>I would point to the three misfires when someone asks how to evaluate a tool, from a vendor or from your own team. An outside reference helps only if you read what it says and are willing to disagree with it in writing. A suppressed finding needs a reason a reviewer can read. A finding you cannot explain needs a fix.</p>
<p>What I would take to any team that exports a standard:</p>
<ul>
  <li>Get the official schema and run it in CI. A round trip through your own importer only proves you agree with yourself.</li>
  <li>Pin every reference: the schema, the terminology release, the engine version. A result can be reproduced only with its inputs.</li>
  <li>Check terminology codes against the published release instead of a list someone typed once.</li>
  <li>Treat the reference engine as a second opinion to evaluate. Record its false positives with reasons, and fix everything else.</li>
</ul>
<p>CDISC CORE and these schemas are CDISC's. Using them here does not imply CDISC endorsement.</p>
`.trim(),
  },
  {
    id: "fallback-blog-19",
    slug: "a-cloud-warehouse-no-visitor-waits-on",
    title: "A Cloud Warehouse No Visitor Ever Waits On",
    dek: "The clinical data platform on this site now has an AWS warehouse of record. It runs on free quotas, no stored key can reach it, and no page request ever touches it.",
    pillar: "clinical-data-engineering",
    tags: "aws, aurora-dsql, dynamodb, data-warehouse, architecture, governance",
    published: true,
    reading_time_minutes: 6,
    hero_image_url: null,
    created_at: new Date("2026-10-27T15:00:00.000Z"),
    updated_at: new Date("2026-10-27T15:00:00.000Z"),
    body: `
<h2>The constraints came first</h2>
<p>The <a href="/platform">clinical data platform</a> on this site runs on a synthetic study warehouse that lives in the browser, in DuckDB. Its cloud side had stayed on paper: an earlier decision record kept the AWS reference design synthesized with nothing deployed, because a live account costs money.</p>
<p>Two things changed on 26 October. The Vercel Marketplace now provisions some AWS products with short-lived OIDC credentials, and I wanted a version that uses only AWS's permanent monthly free quotas, not trials or credits. Of the seven products on offer, two have one: Aurora DSQL, with 100,000 DPUs and 1 GB of storage a month, and DynamoDB, with 25 GB of storage and 25 read and 25 write capacity units in provisioned mode.</p>
<p>The other constraint was compute. The site runs on Vercel's Hobby plan, which allows 4 hours of active CPU in 30 days, and it had used about 3 hours 15 minutes. Any design that added a server call per visitor was out.</p>

<h2>Writes from CI, reads at build time</h2>
<p>The decision, ADR 0070, gives each store one job. DSQL is the warehouse of record: the synthetic gold layer is loaded into it and checked against the DuckDB copy. DynamoDB is to be the run ledger, one item per pipeline or release run, holding versions, hashes and conformance results.</p>
<p>I spent more time on who touches them, and when, than on the products:</p>
<ul>
  <li>Writes come only from GitHub Actions workflows on main, through an OIDC role. No access key exists anywhere. The role may connect to the one cluster, put, query and describe on the one table, and read one CloudWatch metric. A test pins that list so it cannot widen unnoticed. Pull requests, forks and other branches cannot assume the role.</li>
  <li>Reads happen only while the production site is built, through the Marketplace's read role. No route handler, server component, revalidation or middleware calls AWS. Visitors get static pages, and the compute budget does not move.</li>
  <li>A failed read fails the production build, the same rule the site applies to its database and cache. A build without the warehouse variables renders the page without that section. It never fills the gap with invented numbers.</li>
</ul>
<p>I would want the same shape in any clinical platform: one automated path writes the system of record, a second one reads it, and nobody writes to it by hand.</p>

<h2>Prove the copy matches</h2>
<p>Loading a warehouse is the easy part. Knowing the load is right takes more work. The load plan (#3004) is pure code. It emits the statements, batched inside DSQL's limit of 3,000 rows per transaction, and a fingerprint for each table from the rows it loads. The loader (#3013) reads every table back, fingerprints what DSQL returns the same way, and writes a load manifest only when every table matches. It empties the manifest before it drops the first table, so a load that dies halfway leaves no manifest at all instead of an old one that still says everything matched.</p>
<p>Each fingerprint is a row count, a text length and a hash over the sorted rows, so the order DSQL returns rows in does not matter. It is a change detector and not a cryptographic hash, and the code says so. Making the two sides agree meant spelling out how PostgreSQL renders each type as text: dates as YYYY-MM-DD, booleans as words, and decimals sent as text so that no binary float reaches a NUMERIC column.</p>
<p>DSQL has limits of its own: no temporary tables, no triggers, no PL/pgSQL, and one DDL statement per transaction. So its DDL is generated on its own instead of being shared with the DuckDB and T-SQL dialects the warehouse already produces.</p>

<h2>An exit plan before the first load</h2>
<p>The AWS account is on the Free plan: no card, and it closes after six months, around 26 April 2027, unless it is upgraded. The always-free quotas continue only on the paid plan. So the way out is already written down (#3014), with a reminder set for 1 March.</p>
<p>Leaving is cheap because nothing in AWS is the only copy. The repository regenerates the gold layer, and the run ledger is history. The loader speaks plain PostgreSQL, so the same plan, parity check and manifest can point at a separate Neon schema instead. The plan also lists the clean-up: the integrations, the CloudFormation stack, the repository variables, and an amendment to the decision record that says what moved and why.</p>

<h2>Where it stands</h2>
<p>The plan, the loader, the role template and the workflow are merged. The first load has not run yet. It waits on a one-time step in the AWS console that creates the role, and then a manual run of the load workflow, which reports how many DPUs the load used. The workflow stays manual until that number is known. The decision record also commits to a monthly check that usage beyond the free quotas is $0.00.</p>
<p>What I would carry to any regulated cloud platform:</p>
<ul>
  <li>Decide the write path and the read path before choosing the database.</li>
  <li>Store no keys. Use short-lived credentials scoped to one resource, with a test that fails if the policy grows.</li>
  <li>Fail the build when a source is unreachable, instead of publishing fallback data as if it were real.</li>
  <li>Prove each load with a read-back, and write the success record last.</li>
  <li>Write the exit plan while leaving is still cheap.</li>
</ul>
`.trim(),
  },
  {
    id: "fallback-blog-20",
    slug: "one-metric-one-definition-every-tool",
    title: "One Metric, One Definition, Every Tool",
    dek: "When a dashboard, a SQL query and a BI model each define enrollment their own way, they will disagree, and nobody can say which one is right. Define each metric once, as data, and compile it to every tool.",
    pillar: "clinical-data-engineering",
    tags: "semantic-layer, metrics, governance, sql, power-bi, clinical-operations",
    published: true,
    reading_time_minutes: 7,
    hero_image_url: null,
    created_at: new Date("2026-10-27T23:00:00.000Z"),
    updated_at: new Date("2026-10-27T23:00:00.000Z"),
    body: `
<h2>Three numbers for one question</h2>
<p>Ask a clinical operations team how long site activation takes and you can get three answers in one meeting. The dashboard counts from the site's selection. The analyst's SQL counts from the protocol's final version. The BI model counts calendar days where the others count business days, and drops sites that never activated where the others don't. Each number is defensible, and the meeting spends its hour reconciling them instead of deciding anything.</p>
<p>The usual fix is a document: a metric dictionary that every tool is meant to follow. A document doesn't execute, so each tool still holds its own copy of the logic, and each copy drifts on its own schedule.</p>
<p>The <a href="/platform/governance">clinical data platform</a> on this site takes the other route. Each metric is defined once, as data, and every tool's version is compiled from that one definition.</p>

<h2>A definition is a record</h2>
<p>The registry holds 53 governed metrics. Each one is a record instead of a SQL string: the gold table it reads, the aggregation, the expression, the filters, the grain, the dimensions it may be grouped by, the unit and display format, a named owner and data steward, a link to the business glossary term it implements, a semantic version and a change log.</p>
<p>Site activation cycle time, for example, is the median of days from a site's first version in the site dimension to its activation date, over sites that have activated. Its description names the governed source of the start date: the study's protocol finalisation date, which the warehouse build uses to open each site's first version.</p>
<p>From that one record a compiler emits five targets:</p>
<ul>
  <li>SQL for DuckDB, PostgreSQL and SQL Server: three dialects, because a median, a date difference and a null comparison are spelled differently in each.</li>
  <li>dbt MetricFlow YAML, for a semantic layer that sits over the warehouse.</li>
  <li>Power BI TMDL measures, for a semantic model, with the metric's display folder and format carried over.</li>
</ul>
<p>The dashboards on the site use a TypeScript evaluator that reads the same records. Nobody hand-writes a metric in any of these places. Each generated file is checked in as a golden file, and a test fails when the generated output and the committed one drift apart, so any change to a definition shows up in review as a diff in every tool at once.</p>

<h2>Prove the copies agree</h2>
<p>Compiling from one definition removes hand-written drift, but it cannot show the compiler is right. A wrong join compiled five times is wrong five times.</p>
<p>So the platform computes every metric twice, by independent routes. A test loads the seeded gold tables into DuckDB, runs each metric's generated SQL, and compares the result with the TypeScript evaluator on the same data, for every metric, every allowed dimension and every filter. The two implementations write the joins, the filters, the null handling and the aggregation separately. When they agree, that is evidence both compute what the definition says. When they disagree, one of them has a bug, and the test names the metric.</p>
<p>Only the DuckDB output runs against data here. The PostgreSQL, SQL Server, MetricFlow and TMDL outputs are pinned by their golden files and by the compile rules below, and nothing executes them. That is a known limit.</p>

<h2>Rules that run on every change</h2>
<p>Before anything compiles, a check walks every definition and fails the build when a metric:</p>
<ul>
  <li>reads a table or column that does not exist in the gold model, or a type its aggregation cannot take;</li>
  <li>reads a nullable column without a not-null guard. SQL and DAX treat a null operand differently, so an unguarded null is a place where two correct compilations give two different answers;</li>
  <li>allows a dimension it cannot reach from every table it reads;</li>
  <li>is certified without a glossary term, or has a version its change log does not end at;</li>
  <li>makes a compliance or validation claim in its description.</li>
</ul>
<p>Versions follow semantic versioning, and the check enforces it against a lock file that records each release. Changing a certified metric's formula, grain, unit or default filters, or removing a dimension, is a breaking change and needs a major version. Adding a dimension or changing status needs at least a minor one. A version cannot go backwards, and one version cannot describe two different calculations. A consumer pinned to version 1 of a metric knows that version 1 means one thing.</p>
<p>Reports follow the same rule from the other side: a certified report may use only certified metrics, and no draft or deprecated ones.</p>

<h2>Certification has to mean the source exists</h2>
<p>One metric the registry refused to certify taught me the most. Overdue monitoring visit reports started with a 20-day deadline written into its formula. The number looked fine, but no table in the warehouse held the deadline. Governance does not certify an unsourced business rule, so the metric stayed a draft, and no certified report could use it.</p>
<p>The fix went into the warehouse. Each study got a monitoring plan in the warehouse, with its own visit interval, window and report deadline: 20 days where the sponsor's procedure applies, 15 where a CRO's plan does. Now "overdue" means overdue against the study's own terms, and the metric is certified because its rule has a source a reviewer can open.</p>

<h2>List what you cannot compute</h2>
<p>The registry also keeps a list of metrics it does not define, with the reason and what would be needed. There are six today. One is the query rate per 100 CRF pages, a common operational measure. The gold model counts visits but not the CRF pages a visit produces, so the registry defines a query rate per 100 visits, says why in its description, and lists the per-page rate as a gap naming the missing column.</p>
<p>The alternative is to estimate pages per visit and ship the familiar number, which would look certified and be a guess. A listed gap is also a backlog: each entry says which data would close it.</p>

<h2>What I would take to any warehouse</h2>
<ul>
  <li>Define metrics as data, then compile. A definition that generates the SQL and the BI measure binds every tool; a dictionary nobody executes binds none.</li>
  <li>Compute each metric twice, independently. One definition removes drift between tools. Two implementations that must agree catch the bugs that one definition would copy everywhere.</li>
  <li>Version metrics like an API. A changed calculation under the same version is how two quarters' numbers stop being comparable without anyone noticing.</li>
  <li>Certify only what has a source. A threshold someone typed in is an assumption, and a certified metric should not rest on one.</li>
  <li>Publish your gaps. Saying what you cannot yet measure makes the rest easier to trust.</li>
</ul>
<p>All data on the platform is synthetic. Every study, site and subject is fictional.</p>
`.trim(),
  },
];

/**
 * Static safety net for the blog's Resilient Hybrid Fallback service.
 * Authored blog posts are persisted in the database via `/admin` and
 * served through `BlogPostService`.
 */
export const FALLBACK_BLOG_POSTS: BlogPostData[] = rawFallbackBlogPosts.map(
  (post) => ({
    ...post,
    body: compileTerms(post.body),
  })
);
