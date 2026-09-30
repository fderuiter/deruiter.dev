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
    dek: "How to design deterministic, streaming XML compilation pipelines for FDA-compliant CDISC ODM and SDTM datasets without memory blowouts.",
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
  <li><strong>21 CFR Part 11 Audit Trails:</strong> Cryptographic SHA-256 input hashing on every derived observation to prove record provenance and immutability.</li>
</ul>

<h3>Cryptographic Audit Trails &amp; Provenance</h3>
<p>Rather than relying on volatile database transaction logs, every transformed observation carries an immutable hash certificate linking the emitted tabulation record directly back to the source ODM XML token offset and transformation rule version:</p>

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
  <li><strong>Deterministic Derivation Trails:</strong> Every evaluation yields an inspectable derivation tree explaining <em>why</em> a validation failed, satisfying FDA 21 CFR Part 11 electronic record requirements.</li>
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
