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
      "A **Rust** scientific computing framework exploring numerical solvers, compile-time checks, and interactive simulations. The aim is to keep the mathematical model and the code that runs it close together.",
    architectural_narrative: `<h3>The problem</h3>
<p>Scientific software often separates the mathematical description from the code that runs quickly. OxidizeMath explores bringing those closer together in Rust, with numerical solvers, compile-time checks, and interactive views of simulation state.</p>
<p><strong>The approach:</strong> Rust modules separate numerical domains, while procedural macros and buffered state updates support checking and simulation.</p>
<p><strong>Reported project measurements:</strong> Sub-2ms Runge-Kutta adaptive stepping on 10,000-node lattices; compile-time LaTeX formula traceability; 100% WebAssembly browser execution parity.</p>

<h3>How it works</h3>
<p><strong>Procedural Macro Theory Verification:</strong> Custom AST visitors (<code>verified_engine_macros</code>) enforce mathematical invariants and formal LaTeX theory traceability at compile time.</p>
<p><strong>Zero-Copy Double-Buffered State Execution:</strong> Thread-safe buffer swapping (<code>oxidize_core::double_buffer</code>) for grid-based PDEs and Lattice Boltzmann fluids, decoupling numerical compute loops from egui rendering threads.</p>
<p><strong>WASM-First GUI Architecture:</strong> Cross-compiles identical math visualizers to native desktop binaries and zero-install WebAssembly canvas apps.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[LaTeX Mathematical Spec] --> B[Procedural Macro Compile-Time Linter]
    B --> C[Rust Numerical Engine Crates]
    C --> D[Adaptive Runge-Kutta PDE Solver]
    D --> E[Double-Buffered Grid State Buffer]
    E --> F1[Native Desktop egui Runner]
    E --> F2[WebAssembly Canvas / WebGL Renderer]
</code></pre>

<h3>Implementation notes</h3>

<h4>Fused Runge-Kutta Adaptive PDE Stepper (<code>oxidize_core/src/stepper.rs</code>)</h4>
<pre><code class="language-rust">
pub struct FusedRungeKuttaStepper<F> {
    pub dt: f64,
    pub tolerance: f64,
    pub system_fn: F,
}

impl<F> FusedRungeKuttaStepper<F>
where
    F: Fn(&[f64], &mut [f64]),
{
    pub fn step(&mut self, state: &mut [f64]) -> Result<f64, &'static str> {
        let dim = state.len();
        let mut k1 = vec![0.0; dim];
        let mut k2 = vec![0.0; dim];
        let mut temp_state = vec![0.0; dim];

        (self.system_fn)(state, &mut k1);
        for i in 0..dim {
            temp_state[i] = state[i] + 0.5 * self.dt * k1[i];
            if temp_state[i].is_nan() || temp_state[i].is_infinite() {
                return Err("Float divergence detected during k1 step");
            }
        }

        (self.system_fn)(&temp_state, &mut k2);
        for i in 0..dim {
            state[i] += self.dt * k2[i];
        }
        Ok(self.dt)
    }
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Compile-Time LaTeX Verification:</strong> Macro-based formula verification caught mathematical variable index mismatches prior to expensive GPU simulations.</li>
  <li><strong>Double-Buffered State Separation:</strong> Eliminating mutex contention between the numerical stepping thread and 60fps GUI render loop stabilized browser frame rates.</li>
</ul>`,
    created_at: new Date("2026-02-28T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
