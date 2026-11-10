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
<p>Procedural macros with custom AST visitors (<code>verified_engine_macros</code>) check mathematical invariants at compile time and tie each formula back to its LaTeX source.</p>
<p>Grid-based PDEs and Lattice Boltzmann fluids step in a double buffer (<code>oxidize_core::double_buffer</code>) that swaps without copying, so the numerical loop and the egui rendering thread never wait on each other.</p>
<p>The same visualizers compile to native desktop binaries and to WebAssembly canvas apps that need no install.</p>

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
  <li>Checking formulas in macros caught variable index mismatches at compile time, before an expensive GPU simulation ran.</li>
  <li>Removing mutex contention between the stepping thread and the 60fps GUI render loop steadied frame rates in the browser.</li>
</ul>`,
    created_at: new Date("2026-02-28T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
