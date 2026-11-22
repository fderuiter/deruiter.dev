import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
  id: "canonical-10",
  slug: "oxidizemath",
  title: "OxidizeMath: Scientific Computing in Rust",
  primary_language: "Rust",
  github_url: "https://github.com/fderuiter/OxidizeMath",
  published: true,
  simulated_telemetry: false,
  tags: "Rust, WebAssembly, egui, Numerical Methods, Formal Verification, PDE Solver, Scientific Computing, Monorepo",
  editorial_content:
    "A **Rust** workspace for scientific simulation where the LaTeX papers, the code and the CI gates check each other. It builds for the desktop and for the browser from one codebase.",
  architectural_narrative: `<h3>The problem</h3>
<p>A scientific model usually lives in two places: the paper that derives it and the code that runs it. They drift. Someone fixes a sign in the code and not the paper, or copies an equation into a comment and edits only one copy. OxidizeMath tries to make the build notice.</p>
<p><strong>The approach:</strong> procedural macros read equations out of the LaTeX papers at compile time and check the Rust against them, a custom global allocator refuses heap allocation inside verified runs, and a workspace tool runs the structural checks in CI.</p>
<p><strong>Size on the default branch:</strong> 20 workspace crates, 28 LaTeX papers, about 184,000 lines of Rust and 1,696 unit tests. The repository's <code>Verification_Certificate.json</code> reports 84.5% native line coverage and 64.2% coverage on the WebAssembly path.</p>

<h3>How it works</h3>
<p><code>#[embed_theory("papers/mmwave_radiotherapy_setup.tex", label = "eq:czt")]</code> finds the labelled equation in the paper, converts it into the item's rustdoc, and fails the build if the label is missing. It also rejects hand-written display math in the same doc comment, so the equation has one copy. Then it compares operators: if the LaTeX divides and the function body never does, compilation stops.</p>
<p><code>#[verified]</code> sits on 2,575 functions. It rejects direct recursion and bodies over 60 statements (NASA's Power of Ten rules 1 and 4) unless the attribute carries a written <code>opt_out</code> reason, and it injects counters for arithmetic, index loads and calls.</p>
<p><code>VerifiedAllocator</code> wraps the system allocator. Inside <code>VerifiedEngine::run_verified</code>, any <code>alloc</code>, <code>alloc_zeroed</code> or <code>realloc</code> panics, which enforces Power of Ten rule 3: allocate during setup, never in the loop.</p>
<p>The <code>unified_verification</code> crate runs the rest in CI: workflow linting, release-profile checks, AST duplicate detection, public API drift against a baseline, ADR record checks, paper traceability, a 500-line file limit, a secrets and entropy scan, and documentation and link checks. The same GUI then builds for Linux, Windows, macOS and WebAssembly, the web bundle has to fit a 3 MB compressed budget and pass a Playwright smoke test, and it deploys to GitHub Pages.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    subgraph Sources
        P[LaTeX papers]
        R[Rust domain crates]
    end
    subgraph Build
        M[embed_theory and verified macros]
        A[VerifiedAllocator in tests]
        U[unified_verification gates]
    end
    subgraph Targets
        D[Desktop egui app]
        W[WebAssembly build on GitHub Pages]
    end
    P --> M
    R --> M
    M --> A
    A --> U
    U --> D
    U --> W
</code></pre>

<h3>Implementation notes</h3>

<h4>The allocation lock (<code>crates/verified_engine/src/allocator.rs</code>)</h4>
<pre><code class="language-rust">
unsafe impl GlobalAlloc for VerifiedAllocator {
    unsafe fn alloc(&amp;self, layout: Layout) -&gt; *mut u8 {
        if MEMORY_LOCK.load(Ordering::SeqCst) &amp;&amp; crate::metrics::is_verification_enabled() {
            runtime_violation!("VIOLATION: Dynamic memory allocation after initialization.");
        }
        unsafe { System.alloc(layout) }
    }
    // alloc_zeroed and realloc carry the same guard; dealloc does not.
}
</code></pre>

<h4>The operator check (<code>crates/verified_engine_macros/src/semantic_integrity.rs</code>)</h4>
<pre><code class="language-rust">
// The paper says f / (2B). This body only multiplies, so it fails.
fn wrong_range(beat: f64, bw: f64) -&gt; f64 {
    beat * bw
}
// verify_semantic_integrity(r"\frac{f}{2 B}", &amp;func)
// =&gt; Err("Missing operation in Rust implementation: expected Div ...")
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li>The operator check compares sets. It catches a missing division, but not a division in the wrong place, so it narrows review rather than replacing it.</li>
  <li>The traceability gate confirms that each domain links to a paper that exists. It can't tell whether it is the right paper, and some links in <code>traceability.toml</code> point at loosely related ones.</li>
  <li>The browser build is the less-tested build: 64.2% path coverage against 84.5% native. Publishing both numbers keeps that visible.</li>
  <li>The release profile keeps <code>overflow-checks = true</code> with <code>panic = "abort"</code>, so an integer overflow stops the program instead of wrapping into a plausible wrong answer.</li>
</ul>`,
  created_at: new Date("2026-02-28T00:00:00Z"),
  updated_at: new Date("2026-11-22T00:00:00Z"),
});
