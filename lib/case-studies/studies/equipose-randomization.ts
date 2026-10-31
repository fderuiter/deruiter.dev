import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-14",
    slug: "equipose-randomization",
    title: "Equipose: Reproducible Clinical Trial Randomization",
    primary_language: "Angular / TypeScript",
    github_url: "https://github.com/fderuiter/equipose-randomization",
    external_platform_url: "https://equipose.org",
    published: true,
    simulated_telemetry: false,
    tags: "Angular, TypeScript, NgRx SignalStore, Web Workers, Clinical Informatics, Code Generation, Deterministic Algorithms",
    editorial_content:
      "A browser-based tool for designing stratified block and **Pocock–Simon minimization** randomization schedules. A seeded **MT19937** generator makes each schedule reproducible from its seed, and the app exports it as **R, Python, SAS, and Stata** scripts for independent review.",
    architectural_narrative: `<h3>The problem</h3>
<p>A trial randomization schedule has to be reproducible: anyone holding the seed and the study configuration should get the same subject-by-arm list, and a statistician should be able to read the allocation logic in a language they already use. Equipose is a free, open-source Angular app for designing stratified block and Pocock–Simon minimization schedules in the browser. It is deployed at <a href="https://equipose.org" target="_blank" rel="noopener noreferrer">equipose.org</a>.</p>
<p><strong>The approach:</strong> A seeded MT19937 generator drives every random choice, so a schedule can be regenerated from its seed. The same configuration can be exported as an R, Python, SAS, or Stata script, either with the generated list embedded (static) or with the allocation logic re-implemented in the target language (dynamic).</p>
<p><strong>What the repository shows, and where it stops:</strong></p>
<ul>
  <li>Schedules are generated in the browser. A Playwright suite fails if generation, CSV, PDF, or code export makes a request to any non-local host.</li>
  <li>A golden-fixture suite checks the TypeScript engine against stored schedules and, in CI, runs the exported R and Python scripts against the same fixtures.</li>
  <li>The project README states bit-for-bit parity between the web app and all four exports. Treat that as project-reported: the project’s own SAS/Stata exception report says dynamic SAS and Stata scripts do not guarantee sequence parity, and only static exports, which embed the list, match exactly in those languages.</li>
  <li>No timing benchmarks are published. The only enforced performance budget is bundle size: the production build fails if the initial bundle exceeds 2.2 MB.</li>
</ul>
<p>Equipose is a design and inspection tool, not a validated system. Its documentation marks the in-browser schedule as a draft and directs organisations to run exported scripts inside their own validated statistical environment.</p>

<h3>How it works</h3>
<p><strong>Three bounded contexts.</strong> <code>randomization-engine</code> holds the pure TypeScript algorithms, the Web Worker, and the facade the UI talks to. <code>study-builder</code> holds the configuration form and an NgRx SignalStore (<code>@ngrx/signals</code>). <code>schema-management</code> holds the results grid, CSV/PDF export, and code generation. ESLint forbids <code>fetch</code>, <code>XMLHttpRequest</code>, <code>WebSocket</code>, and Angular’s <code>HttpClient</code> everywhere under <code>src/app/domain</code>. The app is built on Angular 22 (<code>package.json</code>; the README badge still says 21).</p>
<p><strong>Seeding.</strong> If the user gives no seed, 128 bits from <code>crypto.getRandomValues</code> become one. The seed string is hashed with SHA-256, the first 32 hex characters are folded into a 31-bit integer with an FNV-style loop, and that integer seeds MT19937. A second generator, seeded from the seed plus <code>-id</code>, keeps random subject-ID tokens on a separate stream.</p>
<p><strong>Allocation.</strong> Block randomization builds each block from the arm ratios and shuffles it with Fisher–Yates. Enrollment caps follow one of three strategies: a manual matrix, proportional caps distributed by largest remainder in the study builder, or marginal-only caps. Minimization tracks counts per site; for each candidate arm it sums, over the subject’s factor levels, the range of ratio-normalised arm counts, then assigns the lowest-scoring arm with probability <em>p</em> (default 0.8, accepted range 0.5 to 1.0).</p>
<p><strong>Off-main-thread work.</strong> <code>RandomizationEngineFacade</code> sends <code>START_GENERATION</code> and <code>START_MONTE_CARLO</code> commands to a module Web Worker. If the worker cannot be constructed, generation falls back to the same pure function on the main thread. A Monte Carlo run is 10,000 regenerations of the design with a fresh random seed each time, progress every 500 iterations, and an optional 0–50% attrition filter.</p>
<p><strong>Code export.</strong> <code>CodeGeneratorService</code> registers four strategies (R, Python, SAS, Stata). Each builds an intermediate representation (<code>LogicIR</code>: seed hash, simplified ratios, per-site and per-stratum tasks, subject-ID tokens) and renders a language template; a static-mapping guard checks the output. Dynamic scripts carry MT19937 ports for R, SAS, and Stata and a Python class. For minimization designs the export dialog offers static mode only.</p>
<p><strong>Audit hash and ADaM-lite view.</strong> The facade attaches a SHA-256 hash over the configuration, timestamp, and schedule, computed from key-sorted JSON; Python and R scripts recompute it independently, and a Playwright test checks that Chromium, Firefox, and WebKit produce the same hash for the same seed. The results view also reshapes a schedule into an “ADaM-lite” dataset of labelled variables and records. That is the project’s own lightweight shape; it is not a CDISC ADaM dataset and is not checked for conformance.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    Form["Config form (study-builder)"] --> Store["StudyBuilderStore (NgRx SignalStore)"]
    Store --> Facade["RandomizationEngineFacade"]
    Facade -->|"START_GENERATION / START_MONTE_CARLO"| Worker["Module Web Worker"]
    Facade -.->|"worker unavailable"| Inline["Same pure function on main thread"]
    Worker --> Engine["generateRandomizationSchema (MT19937)"]
    Inline --> Engine
    Engine --> Block["Block path: Fisher-Yates per block"]
    Engine --> Min["Minimization path: range imbalance, biased coin"]
    Worker -->|"GENERATION_SUCCESS"| Facade
    Facade --> Hash["computeAuditHash (SHA-256)"]
    Hash --> Results["Results grid, CSV/PDF, ADaM-lite view"]
    Results --> Codegen["CodeGeneratorService: R, Python, SAS, Stata"]
</code></pre>

<h3>Implementation notes</h3>
<p>The excerpts below are copied verbatim from the <code>main</code> branch.</p>

<h4>Seed resolution (<code>src/app/domain/randomization-engine/core/randomization-algorithm.ts</code>)</h4>
<pre><code class="language-typescript">
  const resolvedConfig = config.seed
    ? config
    : { ...config, seed: generateCryptoSeed() };

  const primarySeed = resolvedConfig.seed;
  const secondarySeed = primarySeed + '-id';

  const mt = new MT19937Internal(MT19937Internal.get31BitSeed(primarySeed));
  const rng = () =&gt; mt.random();

  const mtSecondary = new MT19937Internal(MT19937Internal.get31BitSeed(secondarySeed));
  const rngId = () =&gt; mtSecondary.random();
</code></pre>

<h4>Minimization imbalance and biased coin (<code>src/app/domain/randomization-engine/core/minimization-algorithm.ts</code>)</h4>
<pre><code class="language-typescript">
    for (const arm of arms) {
      const count = (levelMarginals.get(arm.id) ?? 0) + (arm.id === candidateArmId ? 1 : 0);
      const mult = ratioMultipliers.get(arm.id) ?? 1;
      const normalizedCount = count * mult;
      if (min === null || normalizedCount &lt; min) min = normalizedCount;
      if (max === null || normalizedCount &gt; max) max = normalizedCount;
    }
    if (min !== null &amp;&amp; max !== null) {
      totalScore += (max - min);
    }
</code></pre>
<pre><code class="language-typescript">
    if (preferred.length === arms.length || nonPreferred.length === 0) {
      assignedArm = selectWeightedArm(preferred, rng);
    } else {
      const r = Math.floor(rng() * PRECISION_SCALE);
      const pScaled = Math.round(p * PRECISION_SCALE);
      if (r &lt; pScaled) {
        assignedArm = selectWeightedArm(preferred, rng);
      } else {
        assignedArm = selectWeightedArm(nonPreferred, rng);
      }
    }
</code></pre>

<h4>Monte Carlo in the worker (<code>src/app/domain/randomization-engine/worker/randomization-engine.worker.ts</code>)</h4>
<pre><code class="language-typescript">
function runMonteCarlo(id: string, { config, attritionRate, siteWeights }: MonteCarloPayload): void {
  const TOTAL_ITERATIONS = 10_000;
  const PROGRESS_INTERVAL = 500;
  // NaN guard: non-finite values (e.g. NaN from empty input) are normalized to 0.
  const normalizedAttritionRate = Number.isFinite(attritionRate) ? attritionRate : 0;
  const clampedAttritionRate = Math.max(0, Math.min(50, normalizedAttritionRate));
  const dropoutProbability = clampedAttritionRate / 100;
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Client-side execution over a backend:</strong> keeping generation in the browser means trial design parameters are never sent to a server, which a network-interception test enforces. The cost is that nothing is stored centrally; reproducibility depends on the user keeping the seed, the configuration, and the audit hash.</li>
  <li><strong>A hand-written MT19937 over the platform generator:</strong> <code>crypto.getRandomValues</code> cannot be seeded, so it only supplies a default seed. Every allocation step uses MT19937, which can be ported to R, SAS, Stata, and Python.</li>
  <li><strong>Static and dynamic exports:</strong> a static script reproduces the web schedule exactly because it contains it. A dynamic script shows the method but, for SAS and Stata, may not reproduce the same sequence, and the generated SAS and Stata scripts carry a warning comment saying so.</li>
  <li><strong>Minimization exports:</strong> the export dialog does not yet offer dynamic export for minimization, so those designs are exported as an embedded list.</li>
</ul>

<h3>Sources</h3>
<p>Every claim above is checked against the <a href="https://github.com/fderuiter/equipose-randomization" target="_blank" rel="noopener noreferrer">fderuiter/equipose-randomization</a> repository on <code>main</code>:</p>
<ul>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/README.md" target="_blank" rel="noopener noreferrer">README.md</a>: live site, bounded contexts, and the project-reported parity claim.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/package.json" target="_blank" rel="noopener noreferrer">package.json</a>: Angular 22 and <code>@ngrx/signals</code> versions.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/core/mt19937.ts" target="_blank" rel="noopener noreferrer">core/mt19937.ts</a> and <a href="https://github.com/fderuiter/equipose-randomization/blob/main/docs/explanation/SEED_COMPLIANCE_EXPLAINER.md" target="_blank" rel="noopener noreferrer">SEED_COMPLIANCE_EXPLAINER.md</a>: MT19937 and the SHA-256 to 31-bit seed fold.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/core/minimization-algorithm.ts" target="_blank" rel="noopener noreferrer">core/minimization-algorithm.ts</a> and <a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/core/minimization-algorithm.spec.ts" target="_blank" rel="noopener noreferrer">its spec</a>: Pocock–Simon minimization.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/worker/randomization-engine.worker.ts" target="_blank" rel="noopener noreferrer">worker/randomization-engine.worker.ts</a> and <a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/randomization-engine.facade.ts" target="_blank" rel="noopener noreferrer">randomization-engine.facade.ts</a>: Web Worker, main-thread fallback, and Monte Carlo.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/study-builder/store/study-builder.store.ts" target="_blank" rel="noopener noreferrer">study-builder/store/study-builder.store.ts</a>: NgRx SignalStore.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/schema-management/services/code-generator.service.ts" target="_blank" rel="noopener noreferrer">code-generator.service.ts</a> and <a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/schema-management/services/generation/ir/transpiler.ts" target="_blank" rel="noopener noreferrer">generation/ir/transpiler.ts</a>: R, Python, SAS, and Stata export.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/docs/explanation/SAS_Stata_Exception_Report.md" target="_blank" rel="noopener noreferrer">SAS_Stata_Exception_Report.md</a>: the limits on SAS and Stata sequence parity.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/core/randomization-algorithm-golden.spec.ts" target="_blank" rel="noopener noreferrer">randomization-algorithm-golden.spec.ts</a> and <a href="https://github.com/fderuiter/equipose-randomization/blob/main/tests_e2e/code-generation-fixture.spec.ts" target="_blank" rel="noopener noreferrer">code-generation-fixture.spec.ts</a>: golden fixtures and R/Python output comparison.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/randomization-engine/core/crypto-hash.ts" target="_blank" rel="noopener noreferrer">core/crypto-hash.ts</a> and <a href="https://github.com/fderuiter/equipose-randomization/blob/main/tests_e2e/determinism.spec.ts" target="_blank" rel="noopener noreferrer">determinism.spec.ts</a>: the audit hash and its cross-browser check.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/src/app/domain/schema-management/services/adam-lite.mapper.ts" target="_blank" rel="noopener noreferrer">adam-lite.mapper.ts</a>: the ADaM-lite view.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/tests_e2e/zero-trust.spec.ts" target="_blank" rel="noopener noreferrer">zero-trust.spec.ts</a>: the no-outbound-request check.</li>
  <li><a href="https://github.com/fderuiter/equipose-randomization/blob/main/docs/reference/PERFORMANCE_BUDGETS.md" target="_blank" rel="noopener noreferrer">PERFORMANCE_BUDGETS.md</a>: the bundle-size budget.</li>
</ul>`,
    created_at: new Date("2026-03-09T00:00:00Z"),
    updated_at: new Date("2026-10-02T00:00:00Z"),
  });
