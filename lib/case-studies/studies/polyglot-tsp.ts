import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-9",
    slug: "polyglot-tsp",
    title: "Polyglot-TSP: One Problem, 50+ Languages",
    primary_language: "Rust",
    github_url: "https://github.com/fderuiter/polyglot-tsp",
    published: true,
    simulated_telemetry: false,
    tags: "algorithms, benchmarking, compiler-toolchains, polyglot-architecture, combinatorial-optimization, Rust, Haskell, Verilog, Python, C++, Zig, Go, Ada, VHDL",
    editorial_content:
      "The **Traveling Salesman Problem**, implemented across **50+ programming languages**. An excuse to compare memory models, type systems, and runtime costs while asking the same very expensive routing question.",
    architectural_narrative: `<h3>The problem</h3>
<p>What changes when you solve the same problem in a different language? Polyglot-TSP uses brute-force Traveling Salesman solutions across more than 50 languages to compare implementation choices, runtime behavior, and the cost of factorial growth.</p>
<p><strong>The approach:</strong> Each implementation solves the same routing problem. Comparing the code and benchmark results exposes differences in allocation, representation, and execution.</p>
<p><strong>Reported project measurements:</strong> 100% baseline output verification across 50+ language implementations; sub-microsecond execution on native Rust/C++ implementations; automated multi-target CI matrix.</p>

<h3>How it works</h3>
<p><strong>Unified Test Harness &amp; Process Driver:</strong> <code>scripts/run_all.py</code> maps file extensions to compiler flags, abstracting invocation models across native executables, bytecode interpreters, and JVM/CLR/Wasm targets.</p>
<p><strong>Canonical Baseline Verification:</strong> All implementations execute identical TSP adjacency matrices (Distance 60, 80, 97) and emit standardized JSON/stdout tuples (<code>min_distance</code>, <code>best_route</code>) verified by a central test suite.</p>
<p><strong>Cross-Paradigm Idiomatic Fidelity:</strong> Each language implements the algorithm using idiomatic paradigms (e.g. Heap's algorithm in Rust, lazy stream permutations in Haskell, finite state machines in Verilog).</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Test Matrix Dataset: test_cases.json] --> B[Testing Orchestrator: scripts/run_all.py]
    B --> C[Systems & Compiled: C, C++, Rust, Zig, D, Go, Ada/SPARK]
    B --> D[Functional & Declarative: Haskell, OCaml, Scheme, Clojure, Erlang]
    B --> E[Array & Dynamic: APL, BQN, J, Python, Ruby, Julia, Lua]
    B --> F[Hardware & HDL: VHDL, Verilog]
    B --> G[Legacy & Esoteric: COBOL, Fortran, Modula-2, INTERCAL]
    C & D & E & F & G --> H[Canonical Distance & Route Parser]
    H --> I[Standardized Verification: Distance 60 / 80 / 97]
</code></pre>

<h3>Implementation notes</h3>

<h4>Rust: Zero-Cost Abstractions & Memory Safety (<code>languages/rust/tsp.rs</code>)</h4>
<pre><code class="language-rust">
pub fn solve_tsp(matrix: &[Vec<u32>]) -> (u32, Vec<usize>) {
    let n = matrix.len();
    let mut cities: Vec<usize> = (1..n).collect();
    let mut min_cost = u32::MAX;
    let mut best_route = Vec::new();
    let mut permutations = Vec::new();
    heap_permute(&mut cities, n - 1, &mut permutations);

    for perm in permutations {
        let mut current_cost = matrix[0][perm[0]];
        for i in 0..perm.len() - 1 {
            current_cost += matrix[perm[i]][perm[i + 1]];
        }
        current_cost += matrix[perm[perm.len() - 1]][0];

        if current_cost < min_cost {
            min_cost = current_cost;
            let mut full_route = vec![0];
            full_route.extend_from_slice(&perm);
            full_route.push(0);
            best_route = full_route;
        }
    }
    (min_cost, best_route)
}
</code></pre>

<h4>Haskell: Lazy Stream Recursion (<code>languages/haskell/TSP.hs</code>)</h4>
<pre><code class="language-haskell">
module TSP (solveTSP) where
import Data.List (permutations)

solveTSP :: [[Int]] -> (Int, [Int])
solveTSP matrix =
  let n = length matrix
      cityIndices = [1 .. n - 1]
      allRoutes = [0 : p ++ [0] | p <- permutations cityIndices]
      routeCost r = sum $ zipWith (\\a b -> (matrix !! a) !! b) r (tail r)
      costs = map (\\r -> (routeCost r, r)) allRoutes
  in foldl1 (\\acc@(c1, _) item@(c2, _) -> if c2 < c1 then item else acc) costs
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Process-Level Assertion vs. C-ABI FFI:</strong> Chose process stdout stream assertion over C-ABI bindings to accommodate esoteric and simulated runtimes (INTERCAL, Verilog HDL) without linking incompatibilities.</li>
  <li><strong>Brute-Force Permutations ($O(N!)$) Parity:</strong> Maintained identical brute-force algorithms across all languages rather than heuristics to isolate raw language runtime efficiency.</li>
</ul>`,
    created_at: new Date("2026-02-25T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
