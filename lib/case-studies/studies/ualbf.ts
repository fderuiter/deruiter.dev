import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-11",
    slug: "ualbf",
    title: "UALBF: Searching for Quasiperfect Numbers",
    primary_language: "Rust",
    github_url: "https://github.com/fderuiter/ualbf",
    published: true,
    simulated_telemetry: false,
    tags: "Rust, Lean 4, Python, C, Formal Verification, Number Theory",
    editorial_content:
      "A computational number theory project pairing **Rust** branch-and-bound search with **Lean 4** verification. It explores prime signature lattices in the search for **quasiperfect numbers**, with proof checking alongside the search.",
    architectural_narrative: `<h3>The problem</h3>
<p>Quasiperfect numbers make for a deceptively short question and a very large search space. UALBF pairs Rust search routines with Lean 4 verification to explore candidate structures and check the reasoning used to rule them out.</p>
<p><strong>The approach:</strong> Rust branch-and-bound routines narrow the search space. Lean 4 provides a separate place to express and verify the mathematical arguments.</p>
<p><strong>Reported project measurements:</strong> 100% sound Lean 4 kernel verification with zero unverified mathematical axioms; 100,000+ branch evaluations/second in Rust; memory-safe FFI certificate serialization.</p>

<h3>How it works</h3>
<p><strong>Verified Engine Bridge Pattern:</strong> Decouples raw CPU-bound prime lattice traversal (Rust) from formal mathematical proof checking (Lean 4).</p>
<p><strong>Bipartition Sieve &amp; Cyclotomic Pruning:</strong> Employs cyclotomic polynomial factorizations and Euler product bounds to prune provably impossible lattice branches early.</p>
<p><strong>FFI Certificate Manifest:</strong> Serializes obstruction certificates across C-ABI memory boundaries for verification in Lean 4 without cross-process IPC bottlenecks.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Prime Signature Exponent Lattice] --> B[Rust Branch & Bound Traversal Engine]
    B --> C[Bipartition & Cyclotomic Obstruction Sieve]
    C -->|Branch Pruned| D[Proof Certificate Generator]
    D --> E[C-ABI Memory-Safe FFI Bridge]
    E --> F[Lean 4 Formal Proof Kernel]
    F --> G[Zero-Axiom Verified Proof Manifest]
</code></pre>

<h3>Implementation notes</h3>

<h4>Rust Lattice Traversal Engine (<code>rust-engine/src/dfs_tree.rs</code>)</h4>
<pre><code class="language-rust">
// High-throughput Rust Branch & Bound Lattice Traversal
pub struct LatticeSearchEngine {
    max_prime_bound: u32,
    abundancy_threshold: f64,
}

impl LatticeSearchEngine {
    pub fn traverse_lattice(&mut self, node: &PrimeSignatureNode, certs: &mut Vec<ProofCertificate>) -> SearchStatus {
        if node.abundancy() > self.abundancy_threshold {
            return SearchStatus::PrunedAbundancy;
        }
        if let Some(obs) = self.evaluate_cyclotomic_obstruction(node) {
            certs.push(ProofCertificate::from_obstruction(node, obs));
            return SearchStatus::PrunedCyclotomicObstruction;
        }
        for next in node.expand_children(self.max_prime_bound) {
            self.traverse_lattice(&next, certs);
        }
        SearchStatus::Exhausted
    }
}
</code></pre>

<h4>Lean 4 Obstruction Soundness Theorem (<code>lean4-proofs/UALBF/Engine/Bipartition.lean</code>)</h4>
<pre><code class="language-lean">
-- Formal verification theorem in Lean 4
structure ObstructionCertificate where
  node_id : Nat
  prime_bounds : List Nat
  abundancy_ratio : Fixed64
  is_valid_obstruction : Bool

theorem bipartition_sieve_soundness
    (cert : ObstructionCertificate)
    (h_cert : cert.is_valid_obstruction = true)
    (n : Nat) (h_node : n ∈ PrimeLattice cert.prime_bounds) :
    sigma n ≠ 2 * n + 1 := by
  intro h_quasi
  have h_bound : abundancyRatio n > 2 + 1 / (n : Fixed64) := by
    exact abundancy_bound_from_certificate cert h_cert h_node
  have h_eq : abundancyRatio n = 2 + 1 / (n : Fixed64) := by
    rw [h_quasi]
    ring
  linarith
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Hybrid Rust/Lean vs. Pure Lean:</strong> Hybrid architecture accelerated search space exploration by over 1,000x compared to pure theorem prover evaluation while retaining full formal proof soundness.</li>
  <li><strong>Zero-Axiom Soundness:</strong> Automated CI gates auditing Lean 4 via <code>#print axioms</code> guaranteed that no unproven conjectures were introduced.</li>
</ul>`,
    created_at: new Date("2026-03-01T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
