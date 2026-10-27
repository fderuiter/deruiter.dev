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

const rawFallbackBlogPosts: BlogPostData[] = [
  {
    id: "fallback-blog-1",
    slug: "cdisc-odm-sdtm-clinical-data-pipelines",
    title: "Architecting CDISC ODM & SDTM Clinical Data Pipelines",
    dek: "How to design deterministic, streaming XML compilation pipelines for submission-style CDISC ODM and SDTM datasets without memory blowouts.",
    pillar: "clinical-data-engineering",
    tags: "cdisc, odm, sdtm, edc, fda, clinical-data-systems",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-01T00:00:00.000Z"),
    updated_at: new Date("2026-03-01T00:00:00.000Z"),
    body: `
<h2>The Challenge: Memory Exhaustion in Clinical Data Ingestion</h2>
<p>Electronic Data Capture (EDC) systems produce massive XML payloads conforming to the <strong>CDISC Operational Data Model (ODM)</strong> standard. When clinical studies scale to hundreds of trial sites and tens of thousands of subject records, naive DOM-based parsers attempt to construct in-memory tree representations of the entire XML document. The result is predictable: multi-gigabyte heap footprints, severe garbage collection pauses, latency spikes, and serverless worker crashes under peak ingestion loads.</p>

<p>In high-assurance clinical environments, ingestion failure is not merely an operational inconvenience. A failed extract delays monitoring audits, blocks interim statistical safety reviews, and risks database lock deadlines governed by regulatory submission windows.</p>

<h2>Streaming XML Tokenization Architecture</h2>
<p>By transitioning from in-memory DOM representations to an event-driven SAX and streaming pipeline, clinical trial domains can be processed record-by-record. Instead of materializing whole study archives into memory, the tokenizer streams through the XML document, emitting typed event tokens as element boundaries open and close.</p>

<h3>Bounded Memory Execution Models</h3>
<p>Each study event, form definition, item group, and clinical item is compiled directly into strongly-typed domain representations while keeping heap memory strictly bounded under 50 MB regardless of whether the incoming payload is 5 megabytes or 5 gigabytes:</p>

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

<p>This streaming formulation allows pipeline workers to yield backpressure to upstream data brokers whenever downstream persistence layers encounter write throttling, completely preventing buffer bloat.</p>

<h2>Enforcing SDTM Regulatory Conformance</h2>
<p>The FDA and PMDA mandate strict adherence to <strong>CDISC SDTM</strong> guidelines for human drug submissions. Translating operational EDC extracts into tabulation domains (such as Demographics <code>DM</code>, Adverse Events <code>AE</code>, and Vital Signs <code>VS</code>) requires multi-pass normalization:</p>

<ul>
  <li><strong>Controlled Terminology Alignment:</strong> Validating coded entries against quarterly NCI EVS dictionary codelists with pinned snapshot versions.</li>
  <li><strong>Deterministic ISO 8601 Standardization:</strong> Reconciling partial dates into valid SDTM character representations without silent truncation.</li>
  <li><strong>Part 11-Style Audit Trails:</strong> SHA-256 hashing of the inputs to every derived observation, so a reviewer can check record provenance and detect tampering.</li>
</ul>

<h3>Cryptographic Audit Trails &amp; Provenance</h3>
<p>Rather than relying on volatile database transaction logs, every transformed observation carries a hash linking the emitted tabulation record directly back to the source ODM XML token offset and transformation rule version:</p>

<pre><code class="language-typescript">
interface ProvenanceCertificate {
  sourceOID: string;
  mappingRuleId: string;
  ruleVersion: string;
  sourceInputHash: string; // SHA-256 digest of raw ODM token
  compiledAtUtc: string;
}
</code></pre>

<h2>Verification and Production Benchmarks</h2>
<p>In automated load testing against a 1.2 GB CDISC ODM study export containing 45,000 subject visits, the streaming pipeline completed end-to-end SDTM transformation in 14.2 seconds on a single vCPU container, with memory consumption peaking at 38.4 MB. The legacy DOM parser running the same workload crashed with an unrecoverable heap exhaustion error after allocating 2.8 GB.</p>

<p>To inspect the architectural boundary patterns that keep clinical audit surfaces mathematically sound, see the <a href="/case-studies/cadence-clinical">Cadence Clinical</a> case study and the <a href="/case-studies/clinical-data-mapper">Clinical Data Mapper</a> architecture. You can also explore real-time electronic form rule compilation in the interactive <a href="/crf">CRF Studio</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-2",
    slug: "statecharts-invariant-verification-high-assurance-frontends",
    title: "Statecharts and Invariant Verification in High-Assurance Frontends",
    dek: "Applying formal specification and statechart modeling to frontend UI state transitions, guaranteeing zero unreachable error states in mission-critical workflows.",
    pillar: "formal-verification",
    tags: "formal-methods, verification, statecharts, invariants, tla, distributed-systems",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-05T00:00:00.000Z"),
    updated_at: new Date("2026-03-05T00:00:00.000Z"),
    body: `
<h2>The Hidden Fragility of Boolean UI Flags</h2>
<p>In high-assurance frontend applications (such as clinical dosing calculators, radiation oncology planners, and medical telemetry consoles), relying on disconnected boolean flags (such as <code>isLoading</code>, <code>isError</code>, and <code>isSubmitting</code>) creates exponential combinatorial state explosion. With just four independent boolean flags, a component can theoretically exist in 16 distinct states, yet only four or five correspond to valid clinical business operations.</p>
<p>Inevitably, impossible states emerge in production: a view simultaneously rendering a stale error dialog while spinning an active network loader, or a submission button re-enabling while a mutation request is still in flight. When these glitches occur in consumer web apps, users refresh the page. In regulated medical software, an ambiguous UI state can lead to duplicate drug dispensing or unverified patient dose calculations.</p>

<h2>Formal Statecharts as Execution Contracts</h2>
<p>By defining user interfaces as mathematical hierarchical state machines (<strong>statecharts</strong>), UI transitions become deterministic, closed, and mathematically bounded. We specify every valid state, permitted event, and transition matrix explicitly as an architectural contract:</p>

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

<h3>Hierarchical State Decomposition</h3>
<p>Statecharts extend basic finite state machines with hierarchy, orthogonal regions, and guarded transitions. Rather than flattening complex multi-step wizards into dozens of disconnected states, nested compound states encapsulate local invariants without polluting parent contexts.</p>

<h2>Model Checking and Invariant Proofs</h2>
<p>Because statecharts are formal mathematical objects, they can be statically verified before any code executes in a browser. Using automated state space exploration, we test exhaustive reachability across every possible user interaction sequence:</p>

<ul>
  <li><strong>Deadlock Freedom:</strong> Asserting that no state sequence can trap the user without a valid reset or exit transition.</li>
  <li><strong>Safety Invariants:</strong> Proving that the application can never enter the <code>dispensed</code> state unless the <code>verified</code> state was visited with a non-expired cryptographic audit signature.</li>
  <li><strong>Exhaustive Event Coverage:</strong> Verifying that unexpected events dispatched during network lag are either explicitly handled or cleanly dropped without causing unhandled runtime exceptions.</li>
</ul>

<h3>Eliminating Race Conditions by Construction</h3>
<p>Consider the classic typeahead race condition: a user types query A, then query B; response B arrives first, followed by stale response A overwriting the view. In a statechart, entering the <code>searching</code> state automatically cancels any pending actor invocations associated with previous queries. Race conditions are not patched with ad-hoc cancellation tokens: they are eliminated by construction.</p>

<h2>Lessons from Mission-Critical Clinical Deployments</h2>
<p>Adopting statechart-driven state management requires an initial mindset shift: thinking about discrete state transitions first, rather than sprinkling imperative event callbacks across React hooks. However, the benefits compound over the lifetime of a system. When clinical requirements change, updating the state transition matrix immediately reveals missing edges and unreachable states at compile time.</p>

<p>To see formal verification principles applied to interactive directed acyclic graphs (DAGs), test the <a href="/proof">Proof Studio</a> or walk through the compiler architecture in the <a href="/case-studies/crf-xl">CRF-XL Case Study</a>. You can also explore live real-time simulation invariants in the <a href="/neuro">NeuroRecon 3D Brain Studio</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-3",
    slug: "sub-pixel-canvas-deterministic-browser-physics",
    title:
      "Sub-Pixel Canvas Rasterization and Deterministic 60 FPS Browser Physics",
    dek: "Techniques for deterministic fixed-timestep physics simulations, sub-pixel rasterization, and zero-allocation game loops in modern browser runtimes.",
    pillar: "browser-graphics-engineering",
    tags: "browser-physics, canvas, game-loop, webgl, performance, 60fps",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-10T00:00:00.000Z"),
    updated_at: new Date("2026-03-10T00:00:00.000Z"),
    body: `
<h2>Variable Frame Timesteps: The Source of Simulation Drift</h2>
<p>Modern browser displays vary widely across 60 Hz mobile panels, 120 Hz ProMotion laptop screens, and 144 Hz or 240 Hz desktop gaming monitors. Coupling physics simulations directly to <code>requestAnimationFrame</code> timestamp deltas introduces numerical integration drift, unpredictable collision tunneling, and non-deterministic gameplay across differing client hardware.</p>

<p>When Euler integration runs with variable <code>dt</code>, two players running identical input sequences on different machines end up with divergent rigid-body trajectories within seconds. In competitive arcade engines or verifiable physics models, this divergence renders replays un-reproducible and anti-cheat validation impossible.</p>

<h2>Fixed-Timestep Accumulators &amp; State Interpolation</h2>
<p>To guarantee bit-identical, reproducible physics simulations regardless of screen refresh rate, we decouple physical integration from graphical interpolation. The simulation advances in deterministic fixed slices (e.g. exactly 16.666ms per step), while visual transforms interpolate smoothly between previous and current spatial coordinates:</p>

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

<h3>Decoupling Physics from Display Refresh Rates</h3>
<p>The fractional accumulator value <code>alpha</code> represents how far between the previous and current physics ticks the renderer is currently positioned. By interpolating position and rotation vectors using <code>lerp(prevPos, currPos, alpha)</code>, a 144 Hz monitor renders buttery-smooth visuals with zero jitter while the underlying physics simulation executes at a locked 60 Hz rate.</p>

<h2>Zero-Allocation Geometry Pipelines</h2>
<p>JavaScript garbage collection spikes are the primary culprit behind micro-stutters and dropped frames during complex 2D canvas rendering. Instantiating temporary objects (such as coordinate vectors) inside inner simulation loops forces the browser runtime to execute frequent garbage collection sweeps.</p>

<h3>Contiguous TypedArray Pools &amp; Particle Rings</h3>
<p>By pre-allocating contiguous <code>Float64Array</code> memory pools and circular ring buffers at engine initialization, runtime memory allocations drop to exactly zero during active gameplay cycles:</p>

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

<h2>Sub-Pixel Canvas Rendering &amp; High-DPI Clarity</h2>
<p>On high-DPI displays (such as Apple Retina panels with <code>devicePixelRatio = 2</code> or <code>3</code>), naive canvas sizing produces blurry rasterization. Scaling the canvas backing buffer by the device pixel ratio while clamping CSS dimensions ensures crisp, sub-pixel rasterization with proper geometric anti-aliasing.</p>

<p>To experience these deterministic physics loops and zero-allocation memory pools in action, play the <a href="/arcade/quasi-puzzler">Quasi-Perfect Puzzler</a> or navigate the physics obstacles in <a href="/arcade/retro-labyrinth">Retro Labyrinth</a>. For the mathematical underpinnings, review the <a href="/work/laser-loon">Laser Loon Architecture</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-4",
    slug: "ast-compilers-vs-regex-clinical-form-validation",
    title: "Why AST Compilers Replace Regex in Clinical Form Validation",
    dek: "Why regular expressions fail under regulatory scrutiny, and how Abstract Syntax Tree compilation guarantees sound semantic evaluation in clinical eCRF design.",
    pillar: "formal-verification",
    tags: "ast-compilers, compilers, parsing, formal-methods, json-schema, validation",
    published: true,
    reading_time_minutes: 8,
    hero_image_url: null,
    created_at: new Date("2026-03-15T00:00:00.000Z"),
    updated_at: new Date("2026-03-15T00:00:00.000Z"),
    body: `
<h2>The Catastrophic Limitations of Regular Expressions</h2>
<p>When authoring electronic Case Report Forms (eCRF) for multi-cohort pharmaceutical clinical trials, validation dynamics involve interdependent arithmetic formulas, cross-form consistency constraints, and historical visit delta assertions. Engineering teams frequently attempt to patch these rules with complex regular expressions, rapidly encountering catastrophic backtracking, unmaintainable pattern soup, and silent validation escapes.</p>

<p>A regex evaluates a stream of characters without understanding domain syntax, scope, or operator precedence. When an investigator writes an expression such as <code>LAB.CREATININE &gt; 1.5 AND (VISITA.DOSE != NULL OR LAB.ALT &gt; 3 * UPPER_LIMIT)</code>, a regular expression cannot build an evaluation context, verify types, or guarantee termination without risking catastrophic backtracking (ReDoS) that freezes an investigator's browser tab.</p>

<h2>Building a Domain-Specific AST Evaluator</h2>
<p>Instead of ad-hoc string regex manipulation, our clinical schema engine transforms domain expressions into structured <strong>Abstract Syntax Trees (ASTs)</strong>. Rules are tokenized with a deterministic scanner and parsed into recursive node hierarchies:</p>

<pre><code class="language-typescript">
type ASTNode =
  | { type: "Literal"; value: string | number | boolean }
  | { type: "Identifier"; fieldRef: string }
  | { type: "BinaryExpression"; operator: "+" | "-" | "*" | "/" | "&gt;" | "&lt;" | "=="; left: ASTNode; right: ASTNode }
  | { type: "LogicalExpression"; operator: "AND" | "OR"; left: ASTNode; right: ASTNode }
  | { type: "FunctionCall"; name: string; args: ASTNode[] };
</code></pre>

<h3>Lexical Grammar and Recursive Descent Parsing</h3>
<p>A custom recursive-descent parser enforces strict operator precedence (arithmetic over relational, relational over logical) without relying on <code>eval()</code> or <code>new Function()</code>. By binding variable references to an immutable trial dataset scope, evaluation executes as a pure mathematical fold over the syntax tree.</p>

<h2>Guaranteed Termination and Regulatory Auditability</h2>
<p>Because clinical validation scripts run directly in clinical coordinators' browsers during live subject visits, rule evaluation must guarantee bounded execution time. AST traversal strictly prohibits unbounded recursion and circular loops:</p>

<ul>
  <li><strong>Static Cycle Detection:</strong> The rule graph is analyzed before execution to ensure absence of cyclic dependency loops across form fields.</li>
  <li><strong>Depth-Bounded Tree Traversal:</strong> Tree depth is capped at 32 levels, guaranteeing that evaluation finishes in under 1 millisecond per form item.</li>
  <li><strong>Deterministic Derivation Trails:</strong> Every evaluation yields an inspectable derivation tree explaining <em>why</em> a validation failed, the kind of traceability a Part 11 reviewer looks for.</li>
</ul>

<h3>Zero-ReDoS Guarantees &amp; Step-by-Step Derivation</h3>
<p>Unlike regular expressions that can trigger exponential backtracking on hostile or unusual inputs, recursive AST evaluation has strictly linear complexity $O(N)$ proportional to the number of nodes in the syntax tree. When an FDA audit occurs, the system can reconstruct the exact derivation tree that triggered an edit check warning eighteen months prior.</p>

<h2>Hands-On Evaluation and Reference Implementations</h2>
<p>Moving from regular expressions to AST compilation eliminated hundreds of silent validation escapes across our clinical form pipelines. The compiler architecture is shared between client-side form wizards and server-side batch ETL validation pipelines, ensuring bit-for-bit identical evaluation semantics everywhere.</p>

<p>You can interactively design eCRF forms and test real-time AST rule evaluation in <a href="/crf">CRF Studio</a>. For deep architectural details on AST compilation in clinical pipelines, read the <a href="/case-studies/crf-xl">CRF-XL Case Study</a> and the formal proofs in <a href="/proof">Proof Studio</a>.</p>
`.trim(),
  },
  {
    id: "fallback-blog-5",
    slug: "pipelines-that-survive-an-audit",
    title: "Pipelines That Survive an Audit",
    dek: "An inspector does not ask whether your pipeline works. They ask you to prove what it did, to a record, on a date. Most pipelines cannot answer.",
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
<p>Regulatory inspection does not test whether software is correct. It tests whether you can <strong>demonstrate</strong> what the software did to a specific record at a specific time, and show that the demonstration itself was not edited afterwards. Those are different properties, and the second one has to be designed in. It cannot be added under deadline.</p>

<h2>Three properties that must be structural</h2>
<p><strong>1. Every value carries its provenance.</strong> A transformed value that does not know where it came from is an assertion, not evidence. The unit of storage is not the value: it is the value plus the source record, the rule that produced it, and the version of that rule.</p>

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

<p><strong>2. Controlled terminology is pinned, not fetched.</strong> NCI EVS publishes updates quarterly. A pipeline that resolves codelists at runtime produces different output on different days from identical input, and the difference is invisible until an inspector diffs two extracts. Pin the dictionary version per study, store it alongside the data, and treat a terminology upgrade as a deliberate migration with its own record, never as a background refresh.</p>

<p><strong>3. The audit trail is append-only or it is decorative.</strong> If the process that writes audit records can also update or delete them, the trail proves nothing beyond the good intentions of whoever held the credentials. This is the single most common gap, and it is usually justified by a cleanup job that "only removes duplicates."</p>

<h2>The failure that is hardest to catch</h2>
<p>A pipeline that fails loudly is a good pipeline. The dangerous one succeeds while doing nothing.</p>
<p>Fallback behaviour is the usual culprit. A service that substitutes static content when a query fails is correct at runtime: a visitor should still get a page. Run that same code at build time and it bakes the fallback into an artifact that ships as though it were real, and every downstream check passes, because from the outside a complete dataset and a complete <em>substitute</em> dataset are indistinguishable.</p>
<p>The rule worth internalising: <strong>gate on build versus runtime, not on production versus non-production.</strong> A production build satisfies every "is this production?" check while having no business touching a database at all. Make the build fail on an unreachable data source, and make an empty-but-successful query a non-failure, because those two states are genuinely different and conflating them produces either false alarms or false confidence.</p>

<h2>What to test</h2>
<p>Conformance suites check that output matches a schema. They do not check that the output is <em>this</em> input's output. Add tests that:</p>
<ul>
  <li>Re-run a pinned rule against a stored input hash and assert byte equality with the recorded result.</li>
  <li>Attempt to update an audit row and assert the write is rejected: not that it is "not done", that it <em>cannot</em> be done.</li>
  <li>Assert the build exits non-zero when the data source is unreachable. A green build is only evidence if a red one was possible.</li>
</ul>
<p>That last one is the test people skip, because it feels like testing the framework. It is not. It is testing the one assumption every other test rests on.</p>

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
<p>An automated accessibility audit will confirm your contrast ratios and your heading order. It will pass a page that is genuinely exhausting to read, because the properties that make prose readable for a dyslexic reader (glyph disambiguation, character orientation, line rhythm, the absence of reflow) are not in the checklist.</p>
<p>The gap is not an oversight in the tooling. Contrast is measurable from a pair of colours. Whether <strong>b</strong>, <strong>d</strong>, <strong>p</strong> and <strong>q</strong> are rotationally confusable in a given typeface is a property of the letterforms, and no linter has an opinion about it.</p>

<h2>Three jobs, three typefaces</h2>
<p>The instinct is to pick one accessible font and apply it everywhere. That trades one compromise for another, because headings and body prose are doing different work.</p>
<ul>
  <li><strong>Headings: Lexend.</strong> Designed around reading-speed research, with expanded spacing and distinct silhouettes. Headings are scanned, not read; silhouette matters more than fine detail.</li>
  <li><strong>Prose and UI: Atkinson Hyperlegible.</strong> Commissioned by the Braille Institute specifically to disambiguate the pairs that collapse in most grotesques: uppercase I, lowercase l, and the numeral 1. Body text is read linearly, so per-character certainty is what counts.</li>
  <li><strong>Opt-in mode: OpenDyslexic.</strong> Weighted bottoms anchor each glyph's orientation, which is what prevents the rotational flipping that makes letters "swim".</li>
</ul>
<p>OpenDyslexic is deliberately an <em>option</em>, not a default. The evidence for dyslexia-specific typefaces is genuinely mixed, and imposing one on every reader substitutes a different assumption for the one you removed. Making it a one-click persistent toggle respects that the reader knows their own needs better than the research aggregate does.</p>

<h2>Layout shift is an accessibility bug</h2>
<p>This is the part usually filed under performance, and it does not belong there.</p>
<p>A reader who has lost their place in a paragraph because the page reflowed has to re-find it. For a fluent reader that costs a fraction of a second. For someone who is decoding effortfully, it can mean restarting the paragraph. Cumulative Layout Shift is a <strong>cognitive</strong> cost before it is a performance metric, and a font switch is the most disruptive shift there is, because it moves every line simultaneously.</p>
<p>Which means a typography toggle has an unusually strict requirement: it must produce <strong>zero</strong> layout shift. Not "small". Zero. That rules out swapping a stylesheet and hoping metrics are close, and it rules out reading the preference in an effect after hydration; by then the first paint has already happened in the wrong font.</p>

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
<p>This inverts the usual advice about testing behaviour over implementation, and the inversion is the point.</p>
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
<p>The fix is not to abandon scoped testing. It is to recognise that some paths (build scripts, configuration, seeds, and anything widely depended upon but imported by nothing) must force a broader run regardless of what the graph says.</p>

<h2>A short checklist</h2>
<ul>
  <li>For every documented convention, name the file and line that enforces it. If you cannot, it is documentation, not a control.</li>
  <li>For every guardrail, write a test that fails when it is disconnected, then <strong>verify the test fails</strong> by disconnecting it.</li>
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
<p>That is the boundary. Not "important code", which is everything. Code where <em>being wrong is hard to detect from the outside</em>.</p>

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
<p>This is where verification efforts actually fail, and it is not in either tool.</p>
<p>You prove a theorem about real-valued Newton iteration. You implement it in floating point. The proof is valid. The implementation is a different algorithm operating on a different number system, and the proof does not transfer. It constrains the design and rules out whole families of mistakes, but it does not certify the binary.</p>
<p>Closing that gap honestly means stating what was proved about what. "Convergence proven for exact arithmetic; floating-point error bounded empirically at 1e-12 over the tested domain" is a true and useful claim. "Formally verified" is neither, and it is the claim that gets made.</p>

<h2>What a proof buys that a test does not</h2>
<ul>
  <li><strong>Quantification.</strong> "For all n" instead of "for the 10,000 values of n we tried." The difference matters exactly when the counterexample is rare and structured, which is when property testing is weakest.</li>
  <li><strong>Non-rot.</strong> A proof that still compiles still holds. A test suite can pass while asserting something that stopped being true; this is the silent-success failure mode in a different costume.</li>
  <li><strong>Forced precision.</strong> Most of the value arrives before the proof closes. Stating the theorem exactly enough for a proof assistant surfaces the unstated assumptions, and those are usually where the bug was.</li>
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
<p>Over about a week, preparing a release, this project found four separate controls that were reporting success while being wrong. Not flaky. Not intermittently misconfigured. Confidently, repeatably wrong, each with a passing check on top.</p>
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
<p>Which gives a usable test for your own tooling: <strong>a green check is only evidence when a red one was possible.</strong> For any check you rely on, you should be able to name the change that turns it red. If you cannot, it is not verifying anything: it is reporting that it ran.</p>

<h2>How every one was actually found</h2>
<p>Not by better tooling. By comparing what a tool claimed against what the system was observed to do: the provider's API rather than the document describing it, the running site rather than the build log.</p>
<p>Two of the week's wrong turns came from reading the tail of a long log and declaring success. The contradicting warning was near the top both times, in language that read as routine: <em>"Setting dummy connection string for offline compilation."</em> Perfectly clear, printed on every silent build, and missed because it described an intended mode. A warning that sounds like a status line is not a warning.</p>

<h2>The fifth one, caused on purpose</h2>
<p>The other four were found. This one was manufactured, by finally running a database restore rehearsal that had sat on the backlog specifically because nobody had ever done it.</p>
<p>The rehearsal cut production over. Not a failure of the tool: the parameter controlling that behaviour defaults to "yes, promote this", and the documentation says so plainly. It was read, and the default was accepted anyway, which is its own small lesson about how documentation performs under momentum.</p>
<p>No data was lost, and that was verified rather than assumed: identical schema and content fingerprints before and after, and the newest write in the database predated the restore point by thirty-four days. The rollback was the instructive part. Reversing the designation did not move the compute endpoint with it, and the provider refuses both to delete a root branch's endpoint and to add a second one to an occupied branch. The operation was not symmetric, and nothing said so in advance.</p>
<p>The rehearsal was worth more for that than for the number it produced. A recovery procedure nobody has executed is a hypothesis. This one turned out to have a sixty-four second recovery time and a footgun in the second step, and only one of those was discoverable from the documentation.</p>

<h2>What actually changed</h2>
<p>Not "be more careful". The useful changes were structural:</p>
<ul>
  <li>Make the build fail on an unreachable data source, so that a green build means something. Distinguish an empty result from a failed one: they are different states, and conflating them buys false alarms or false confidence.</li>
  <li>Gate on build versus runtime, not production versus non-production.</li>
  <li>Verify controls against the provider, not against the artifact describing the provider.</li>
  <li>For every guardrail, confirm the test fails when the guardrail is removed. Do this by removing it.</li>
  <li>Write down the failure modes that are silent, separately from the ones that crash. They need different detection, and only the second kind gets found by watching for errors.</li>
</ul>

<h2>The uncomfortable part</h2>
<p>Every one of these controls was built deliberately, by someone trying to be careful. The build guard, the convention, the inventory, and the test were each a good-faith attempt to prevent exactly the class of problem they went on to conceal.</p>
<p>That is not an argument against controls. It is an argument for periodically asking of each one: what would it look like if this were broken, and would I be able to tell? For four controls here, the answer was that it would look precisely like it looked every day.</p>
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
<p>None of that was implemented. What existed was a useful subset of design checks from the CDASH and SDTM implementation guides, an audit trail that lives in browser state, and a local slice of controlled terminology. That is a reasonable thing for a portfolio to demonstrate. It is not what the copy said, and the people the clinical work is written for are exactly the readers who notice the difference and stop trusting the rest of the page.</p>
<p>I cannot quote the old wording here. This file is one of more than 130 that a test now scans for it, and the build would fail.</p>

<h2>Describe what is implemented</h2>
<p>The replacement rule is easy to state: copy describes the checks that exist, never the standard they are aimed at. A clean run now reads "No findings from the implemented checks." The audit trail is a "Part 11-style audit trail (simulation)". The terminology is a local subset aligned to one NCI EVS package.</p>
<p>A rule like that decays the moment nobody is watching, so it is a function rather than a guideline. <code>findClinicalClaims()</code> matches the shapes that kept appearing: a standard or regulation followed by "compliant", a percentage score in front of a standard, a promise to comply with a regulation, an audit trail that cannot be changed. A test runs it across the clinical routes, components and libraries, the social card presets and this blog, and names the phrase and the file when it fails. It also has to let honest sentences through, so the test keeps a list of those as well. "Three non-compliant records." must pass.</p>

<h2>Then I checked the codes</h2>
<p>"Aligned to the package" was itself a claim, so the next job was to check it. Every codelist and term in CRF Studio went up against the NCI EVS SDTM terminology file for the package date the site declares.</p>
<p>It was worse than the issue I had filed. Most term codes were wrong or missing from the package, and several codelists sat under codes that belong to <em>other</em> codelists:</p>
<ul>
  <li>The yes/no codelist used C66741, which is the vital signs test code list. Sex used C66742, which is the yes/no list.</li>
  <li>Race and ethnicity pointed at codelists that have been retired; their last appearance was the 2025-09-26 package. Collection now uses C128689 and C128690.</li>
  <li>Severity was filed with CTCAE grade codes. Mild, moderate and severe have their own: C41338, C41339 and C41340.</li>
</ul>
<p>These were not cosmetic. They were published in ODM <code>def:NCICode</code> attributes, SAS format comments, the annotated CRF and the Word export. Every one of them looked right, which is the worst property a wrong identifier can have. A misspelled term fails a lookup. A real code from the neighbouring codelist passes every check that does not go back to the source file.</p>
<p>The error had spread, too. The study data pipeline wrote a dose unit of <code>TABLETS</code>, an extension that existed only to match the wrong CRF code. It now writes the package's own <code>TABLET</code>, C48542, and the golden files that changed changed for that reason alone.</p>

<h2>An outside opinion, in CI</h2>
<p>My own conformance stage checks my own reading of the rules. That is circular in the way that matters, so the pipeline's outputs now also go through CDISC's open-source rules engine, CORE, pinned to v0.17.1, in a separate workflow that runs whenever the pipeline changes and once a week.</p>
<p>The first run reported findings on 69 rule and dataset pairs. Sorted honestly:</p>
<ul>
  <li><strong>55 are real defects</strong> in my pipeline or its study definition, each tracked in an issue.</li>
  <li><strong>12 are engine limitations,</strong> such as duplicate-check rules that misfire on the fixture.</li>
  <li><strong>1 is by design:</strong> adverse events carry no epoch.</li>
  <li><strong>1 is a gap</strong> in the engine's terminology cache.</li>
</ul>
<p>The design decision worth copying is the allowlist that explains them. CI fails on any finding the list does not explain, which is the usual rule. It also fails on any entry that CORE <em>no longer</em> reports. A fix proves itself by making its allowlist entry stale, and the list cannot quietly become a museum of problems solved months ago.</p>
<p>The job summary also says what was not checked. CORE's newest cached terminology is from March while the pipeline declares September, so the export substitutes the older release and says so. CORE has no ADaMIG rules yet, so the analysis layer is reported as "not run". The workflow asks the engine for its rule list rather than hardcoding that, so it will notice when they arrive.</p>

<h2>Program it twice</h2>
<p>Clinical programming has an old answer to "how do you know the derivation is right": a second programmer writes it again from the specification, without looking at the first, and the outputs are compared. The pipeline now has that, as a test suite. Study days, baseline selection, change from baseline, last observation carried forward, adverse event date imputation, treatment-emergent flags, time to event and the three summary tables are each derived again from the specification and compared row for row with the pipeline, on the study's own seed and on 200 generated ones.</p>
<p>Its pull request listed what it could not test. The synthetic generator never lands an adverse event on the edge of the treatment-emergent window, so a mutant that moves that edge from fourteen days after last dose to thirteen survives. That gap is written down next to the suite instead of being left for a reader to find.</p>

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
<p>That throughput did not come from the agents being fast. It came from a rule about how their work reaches main, and the rule came from a bad evening the day before.</p>

<h2>What stacking cost</h2>
<p>That evening I let one wave of work land as a stack: each pull request based on the branch of the one below it, so they would merge in order. It looks tidy. It went badly, for reasons that are specific to this repository's setup and are probably true of yours:</p>
<ul>
  <li><strong>Nothing above the bottom of the stack got CI.</strong> The workflow runs for pull requests into <code>main</code>. A pull request into another branch ran no gates at all, so the stack was green the way an empty test suite is green.</li>
  <li><strong>Squash merges into intermediate branches leave add-versus-nothing conflicts</strong> that have to be resolved by hand, and every resolution is a chance to drop someone's change.</li>
  <li><strong>Closing keywords only fire on a merge into the default branch,</strong> so issues stayed open after their work had merged.</li>
  <li><strong>The history stopped describing itself.</strong> When the stack collapsed, the commit on main titled for Dataset-JSON, CSV and XPT exports also carried the arcade's stage-fitting layout and its tests. Anyone bisecting a layout regression later lands on a commit whose message is about clinical exports.</li>
</ul>

<h2>The rule: one slot</h2>
<p>Since then every pull request is cut from main and targets main. Work stays in draft until its quick checks pass. Only one pull request at a time may be marked ready: the one holding the slot. Whoever takes the slot merges the current main into their branch, reruns the fast checks if main moved, pushes, marks it ready and turns on auto-merge once. When it lands, the next one moves up.</p>
<p>A few files are touched by nearly every feature: the command palette, the navigation data, the sitemap, the route metadata, <code>package.json</code>, the CI workflow and the README. Those take a lock in the lane file before anyone edits them, so two lanes never find the conflict at merge time.</p>
<p>It is a merge queue, written in Markdown, which every agent reads before any pull request action. It is slower per pull request than letting everything race. It is much faster per day, because almost nothing has to be done twice.</p>

<h2>What the slot does not protect</h2>
<p>Serialising merges does not serialise <em>resources</em>. Two pull requests that day, Duck's Halloween mode and the new study data page, each passed every gate on its own and failed together. The cold type check needed about 2.54 GB of live heap, and CI's budget was 2,560 MB. Neither change was large. The program was simply around 5,800 files by then, and those two happened to be the pair that crossed the line.</p>
<p>Both ceilings went up by 512 MB, with the CI budget still 512 MB below the production build's, so growth still fails a pull request before it can reach a deploy. Before raising anything, the obvious suspects were measured. Leaving the tests out of the program dropped memory from about 3.0 GB to 2.0 GB. Stubbing a 7.6 MB icon declaration file down to the 262 icons actually used made no difference that rose above the run-to-run noise of about 300 MB. That second result saved a refactor nobody needed.</p>
<p>A budget gate is a shared resource. Parallel lanes spend it together, and the lane that crosses it is rarely the one that grew it most.</p>

<h2>Two smaller lessons</h2>
<p><strong>Push everything before you turn on auto-merge.</strong> The metric registry merged while its governance commit was still being written, because auto-merge does exactly what it says. The follow-up became its own pull request from main. Now a branch is finished before auto-merge goes on, or the next change is a fresh pull request.</p>
<p><strong>A shared types file is a serial resource too.</strong> Every platform pull request added to the same types file and the same table in the architecture decision record. One evening I marked three of them ready and turned on auto-merge for all three at once. Each merge forced the other two to merge main again and resolve the same two files. Resolving additively (keep both type blocks, keep both table rows, regenerate the docs) made it safe. Following my own rule would have made it unnecessary.</p>

<h2>What I would tell someone starting</h2>
<ul>
  <li>Parallelise the building, not the merging. Agents in separate lanes are cheap; merges that race are not.</li>
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
  <li><strong>The session owns the game:</strong> state, the fixed-step loop, timers, saves, scoring and an action map. It never reads the viewport or the pointer type.</li>
  <li><strong>The session is an external store.</strong> It exposes <code>getState</code>, <code>subscribe</code> and <code>dispatch</code>, plus an <code>onFrame</code> channel that asks the mounted view to paint once per frame. HUD components read slices of it, so a frame does not re-render React.</li>
  <li><strong>A view only lays out and paints.</strong> Views never branch on the device. Choosing the view is the branch.</li>
  <li><strong>The session holds no DOM.</strong> Canvases and WebGL contexts belong to the view and are disposed of when it unmounts. iOS caps a page at roughly sixteen live WebGL contexts, so a swap that leaked one would run out within a few rotations.</li>
</ul>
<p>Rotating a phone or narrowing a window pauses the game, swaps the view and keeps the run.</p>

<h2>Moving code without changing it</h2>
<p>Retro Labyrinth went first. The rule for the move was that code moved as it was and nothing was rewritten. The game's state and rules went into <code>useRetroLabyrinthSession</code>, the view now reads a typed snapshot and acts through named intents, and the presentation pieces went into shared parts. The view component went from 4,387 lines to about 1,430.</p>
<p>"No gameplay change" is an easy claim to make about 57 changed files and a hard one to check by playing. Two things checked it instead:</p>
<ul>
  <li><strong>Replays.</strong> Five runs had been recorded on main before the move. After the move, all five replay to exactly the same result.</li>
  <li><strong>Pixels.</strong> Screenshots at 1024, 1280 and 1440 pixels wide, with a frozen clock and seeded randomness, were compared against main. The launched and moved states are identical.</li>
</ul>
<p>The screenshot comparison earned its keep. It found that a developer-only view picker was showing in production builds, and that patrols started moving while the view's code was still downloading. The loop now runs only while a view has registered a painter and the room is not paused.</p>

<h2>Generate the docs from the map</h2>
<p>Keys and gamepad buttons now come from one action map. The cabinet's control list and the field manual's key column are generated from it, which fixed a small, old lie: the control list said the tools sat on keys 1 to 3, and the game read 1 to 5.</p>

<h2>A retry is not a pass</h2>
<p>The first CI run of that pull request failed device tests that had passed locally. They had passed locally because Playwright retried them. The summary said 120 passed, and the tests that only passed on a second attempt were counted inside that number. Device runs are now repeated with retries off before a pull request asks for review.</p>

<h2>A report that was not a bug</h2>
<p>A report said the touch controls in Working With Duck vanished after closing the wardrobe. They did, on purpose: a hardware Escape key had switched the input mode to keyboard, and the touch dock fades out until the next tap. The investigation was still worth it. The same dialog had close buttons with no accessible name and a heading order that skipped a level, and both are fixed.</p>

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
<p>Mutation testing asks the second question directly. A tool (Stryker, here) makes small changes to the source one at a time: it flips a comparison, removes a <code>+ 1</code>, swaps <code>&amp;&amp;</code> for <code>||</code>. Then it runs the tests against each mutant. A mutant that no test kills is a change in behaviour your suite would have shipped.</p>

<h2>The study data derivations</h2>
<p>Until this week nothing mutation-tested the SDTM, ADaM and table derivations behind the <a href="/study-data">study data pipeline</a>. They sat under the library-wide coverage floor of 70% of branches, which is a low bar for code that decides who counts as having a treatment-emergent adverse event.</p>
<p>The first run scored 80.65% over 1,891 mutants. The spread matters more than the total. Each file now has its own floor at its measured score: the ADaM core and the table filters at 91, the Kaplan-Meier code at 88, and the table assembly at 56. That last number is the honest one, and it is written into the configuration rather than averaged away.</p>
<p>Writing tests aimed at the surviving mutants added 27 edge cases on hand-made SDTM fixtures: baseline ties on the first-dose day, age-group boundaries, overlapping analysis windows, year-only partial dates, censoring for a subject with no contact at all. Branch coverage on the ADaM core went from 82% to 96%, and on the event derivations from 76% to 91%.</p>

<h2>A ratchet, not a target</h2>
<p>The issue asked for 95% branch coverage across the module. Measured coverage after the new tests was 86.8%, and most of the remaining branches are <code>?? []</code> fallbacks that the public API cannot reach. Tests written to hit them would exercise paths that real inputs never take, only to move a number.</p>
<p>I chose a ratchet instead. The floor is set at today's measurement (96% of statements, 86% of branches, 99% of functions and 96% of lines), and a test pins it so it can only go up. A target says where you wish you were. A ratchet says where you are and does not let you slide back.</p>

<h2>The mutant that was a data problem</h2>
<p>An independent QC suite programs the key derivations a second time from their specifications and compares them with the pipeline across 200 generated seeds. One mutant survives it anyway: move the end of the treatment-emergent window from fourteen days after last dose to thirteen, and nothing fails.</p>
<p>The assertions are not the problem; the QC logic for that boundary is in place. The synthetic generator never lands an adverse event on that boundary, never writes a partial end date, and never discontinues a subject for any reason other than an adverse event. No assertion can catch a case the data never contains.</p>
<p>That was the most useful thing the mutation run said. It points the fix at the test data rather than the tests: a library of deliberately messy scenarios, each with the findings it is expected to produce, is where those cases will come from.</p>

<h2>What it costs</h2>
<p>Mutation testing is slow, and the cost decides where it runs. The study data scope took 119 minutes on a loaded four-core container, so it runs weekly with a 150-minute bound, not on every pull request. The independent QC suite stays out of the mutation run: it costs about 30 seconds per re-import, which pushed the estimate past five hours.</p>
<p>The tooling can fail too, and this time it failed loudly. Upgrading to Vitest 5 broke the Stryker runner: it built test-name filters with spaces, Vitest 5 joins test names with <code>" &gt; "</code>, and every mutant ran zero tests. The gate scored 0%. A zero is at least obviously wrong. A filter that matched half the tests would have produced a plausible number, and I would have believed it. Once the runner was updated, the pull request gate came back at 82.24%, the same as before the upgrade, which is the check that the upgrade changed nothing it should not have.</p>

<h2>When to bother</h2>
<p>Most code does not need this. Derivations do, along with anything where a wrong answer looks like a right one: a count that is off by the subjects on a boundary day still renders as a perfectly good table. For that kind of code, coverage tells you the tests were there. Mutants tell you they were paying attention.</p>
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

<h2>What was actually failing</h2>
<p>Vercel holds a production deployment off its domains until the project's Deployment Checks pass. This project had two, Lint and Typecheck, which Vercel runs itself in a separate sandbox. The runbook, the deployment guide and an architecture decision record all said something else: that the check waited for the GitHub Merge Gate. That check had never been configured. The documents described a control that did not exist, and nobody re-read the settings page, because the documents were confident.</p>
<p>Lint passed every time. Typecheck printed "Types generated successfully", ran for about 80 seconds, and exited with code 137. Every production deployment checked since the 14th had failed the same way: eight of them.</p>
<p>Exit 137 is a SIGKILL from the out-of-memory killer. The sandbox ran <code>tsc</code> with a 3,584 MB heap ceiling alongside ESLint, and the two did not fit in its memory together. This project had already raised that ceiling twice, most recently on 24 October, after two pull requests crossed the CI budget together. A third raise would not have helped: <code>--max-old-space-size</code> moves V8's limit, not the machine's.</p>

<h2>Remove it, don't fix it</h2>
<p>The tempting fix was to make the check pass: a smaller program, a bigger sandbox, lint on its own. The better question was what the check caught that nothing else did. The answer was nothing.</p>
<ul>
  <li><strong>CI already runs both.</strong> The static gate runs lint and a cold type check on every pull request and every push to main, and the main branch requires it.</li>
  <li><strong>The production build type-checks itself.</strong> It runs the type check as its own step before anything is compiled. A type error fails the build, so it never gets far enough for a deployment check to hold it.</li>
</ul>
<p>The Typecheck check was a third run of the same verification, on a machine too small for it. When it worked, it added nothing. When it failed, which was always, it taught the person releasing to override it. I removed both checks. The next production deploy had the domain 2.6 seconds after it was READY.</p>

<h2>Don't swap in the obvious replacement</h2>
<p>The documents had promised a Merge Gate check, so wiring one up looked like the honest fix. It would have failed in a new way. CI cancels an in-progress run on main when a newer merge lands, which keeps the queue short. A commit whose run was cancelled never gets a passing Merge Gate, so on a busy day the check would have held back any commit that was not the last to land. The documents now say what is configured, which is nothing, and why.</p>

<h2>A gate is worth what only it catches</h2>
<p>An earlier post here, <a href="/blog/the-cost-of-being-wrong-quietly">The Cost of Being Wrong Quietly</a>, argued that a green check is only evidence when a red one was possible. The converse is just as true and does more damage. A check that is always red is not evidence either, and it is worse than no check at all, because it trains people to click past red. By the time a real failure arrived, Force Promote would have been muscle memory.</p>
<p>Questions I now ask of any gate:</p>
<ul>
  <li><strong>What does it catch that nothing earlier catches?</strong> If the answer is nothing, it is cost and noise.</li>
  <li><strong>When did it last pass?</strong> A gate that has not passed in a week is not a gate. It is a step people skip.</li>
  <li><strong>Does the documentation match the settings page?</strong> Check the provider, not the runbook. Here they disagreed about which check even existed.</li>
  <li><strong>Is the fix more resources, or less duplication?</strong> Raising a limit is right when the work is necessary. Here it was the third copy of the same work.</li>
</ul>
<p>An override button is useful. It should feel unusual every time you press it. When pressing it has become routine, the thing it overrides is what needs attention.</p>
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
<p>The site's own checks flag or handle all sixteen as declared. That proves little, because they were written alongside the scenarios. So on 26 October I ran CDISC CORE, the open-source engine CDISC publishes for its conformance rules, over the clean run and every scenario, and committed what it found.</p>

<h2>What CORE saw</h2>
<p>On the clean run, CORE evaluated 430 SDTM rules. 282 passed, 136 did not apply to this study, 9 reported issues, and 3 hit engine errors. Every reported issue was already explained in the pipeline's list of known, justified findings.</p>
<p>Then the scenarios. For twelve of the sixteen, CORE's output was identical to the clean run. For the other four:</p>
<ul>
  <li><strong>Impossible date.</strong> CORE did not say the date was impossible. It said the adverse event had no epoch, which is empty because no epoch can be derived from a day that does not exist. Right row, indirect reason.</li>
  <li><strong>Rescreened subject.</strong> Caught directly: the subject identifier is no longer unique in demographics, and the supplemental qualifiers are no longer unique per subject.</li>
  <li><strong>Death during treatment</strong> and <strong>withdrawal before Week 12.</strong> A finding that already existed on the disposition record changed its value. Nothing new was reported.</li>
</ul>
<p>The duplicated vital sign, FEMALE on a codelist that admits only F and M, the unit change and the missing baseline produced nothing at all.</p>

<h2>That is not a flaw in CORE</h2>
<p>CORE answers one question: does this dataset have the shape the standard requires? Are the required variables present, are the keys unique, do references resolve, do values sit where the implementation guide says they go? That question matters, and reviewers ask it first.</p>
<p>Whether a measurement was entered twice, whether a subject has a baseline, whether a date exists on the calendar: those are questions about this study's data, and a published standard cannot answer them. A dataset can pass every structural rule and still say something false about a patient.</p>
<p>So a clinical warehouse needs two layers, and neither replaces the other:</p>
<ul>
  <li><strong>Conformance to the published standard.</strong> Run the engine the standard's authors publish, pinned to a recorded version, rather than a home-grown copy of their rules. When it and your copy disagree, it is your copy that has to explain itself.</li>
  <li><strong>Study-specific data quality.</strong> Rules written against the protocol and the data: duplicates, missing baselines, impossible dates, units that drift. This layer is yours to write, and nobody else can.</li>
</ul>
<p>The twelve silent scenarios also say which of the site's own rules are worth keeping. A local rule that duplicates a CORE rule is a second implementation to maintain. A local rule that catches what CORE cannot is the whole point of having local rules. The next step of this work retires only the first kind.</p>

<h2>The file that went stale in four minutes</h2>
<p>CORE needs Python and several minutes per run, so it runs in a CI workflow, and its findings are committed to the repository as a JSON file the site can read with no server compute. Every view in that file carries a SHA-256 fingerprint of the pipeline output CORE ran on. A unit test recomputes the fingerprints and fails when any of them differ, so a stale file fails <code>npm test</code> in seconds, without Python.</p>
<p>That test paid for itself within the hour. A pull request that added the inclusion and exclusion domain for screen failures merged at 23:51 UTC. The CORE pull request merged at 23:55. Each had passed CI against a main that did not contain the other. Together, the pipeline now produced a domain the recorded findings had never seen, and the test failed for all seventeen views. The fix reran CORE and recorded again: two new findings, both already explained, and five rules that had skipped for want of that domain now passed.</p>
<p>Without the fingerprint, nothing would have failed. The file would have gone on describing a dataset that no longer existed, and the site would have shown CDISC's verdict on data CDISC never saw.</p>

<h2>What I would take to any warehouse</h2>
<ul>
  <li><strong>Plant defects, then see which layer catches each one.</strong> The gaps tell you what your own rules are for.</li>
  <li><strong>Do not read silence from a conformance engine as clean data.</strong> It means the structure is sound, and nothing more.</li>
  <li><strong>Record the engine's version with its results.</strong> A finding without the rule set that produced it cannot be reproduced.</li>
  <li><strong>Treat every committed derived file as a cache.</strong> Store the fingerprint of its inputs beside it and test that the two still match. Two green pull requests are not a green merge when one generates a file from the other's inputs.</li>
</ul>
<p>CDISC CORE is CDISC's open-source engine. Running it here does not imply CDISC endorsement.</p>
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
