import type { FieldManualData } from "./types";

export const PROOF_MANUAL: FieldManualData = {
  id: "proof",
  title: "Logical Proof Canvas",
  subtitle: "Formal Verification & Multi-Theorem Propositional Logic Suite",
  genre: "Formal Verification",
  badge: "Formal Logic Suite",
  route: "/proof",
  accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
  badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  objective:
    "Construct deterministic deductive proofs across 5 classic propositional theorems (Modus Ponens, Modus Tollens, Hypothetical Syllogism, Disjunctive Syllogism, Resolution) to discharge target engineering conclusions with mathematical certainty.",
  quickSummary:
    "Select a theorem scenario, wire valid premise nodes on the interactive canvas or CLI, inspect live step-by-step mathematical deduction ledgers, diagnose fallacies with truth-table counterexamples, and export verified proofs to Lean 4, LaTeX, Markdown, or Mermaid.",
  controls: [
    {
      action: "Select & Connect Node",
      description:
        "Click any source node (e.g. Node C), then click the target node (e.g. Node E) to establish a deductive dependency edge.",
      key: "Click Node",
    },
    {
      action: "Drag Node Position",
      description:
        "Click and drag any node across the canvas to customize visual layout; click 'Reset Layout' to return to canonical graph coordinates.",
      key: "Drag Node",
    },
    {
      action: "Switch Theorem Scenario",
      description:
        "Select from 5 engineering proof scenarios (Modus Ponens, Modus Tollens, Hypothetical Syllogism, Disjunctive Syllogism, Resolution) using the top toolbar tabs or CLI.",
      key: "Toolbar / CLI",
    },
    {
      action: "Guided Tactic Step",
      description:
        "Click 'Apply Next Tactic' in the Guided Proof Assistant to automatically evaluate and apply the next valid deduction step.",
      key: "1-Click Tactic",
    },
    {
      action: "CLI Split Console",
      description:
        "Open the terminal and run commands such as `theorem mt`, `connect C E`, `inspect C`, `ledger`, `export lean`, `simulate normal`, or `clear`.",
      key: "Ctrl + \\",
    },
    {
      action: "Export Verified Proof",
      description:
        "Click 'Export Proof' to copy production-ready Lean 4 formal code, LaTeX deduction trees, Markdown audit tables, or Mermaid diagrams.",
      key: "Export Button",
    },
  ],
  rules: [
    {
      title: "Modus Ponens & Modus Tollens",
      detail:
        "Modus Ponens derives Q from (P ∧ (P → Q)). Modus Tollens derives ¬P from ((P → Q) ∧ ¬Q). Both antecedent/consequent pairs must reach the target node before it discharges.",
      badge: "Deductive Rules",
    },
    {
      title: "Syllogisms & Clausal Resolution",
      detail:
        "Hypothetical Syllogism chains (P → Q) ∧ (Q → R) into P → R. Disjunctive Syllogism eliminates (P ∨ Q) ∧ ¬P into Q. Resolution refutes complementary literals (P ∨ Q) ∧ (¬P ∨ R) into Q ∨ R.",
      badge: "Advanced Rules",
    },
    {
      title: "Fallacy Engine & Counterexamples",
      detail:
        "Attempting invalid inferences (such as Affirming the Consequent or Denying the Antecedent) triggers real-time truth-table counterexamples demonstrating rows where premises are TRUE but conclusion is FALSE.",
      badge: "Fallacy Detection",
    },
    {
      title: "Background Tactic Watchdog",
      detail:
        "Simulations run inside dedicated Web Workers off the main thread. A 5-second watchdog timer terminates divergent tactics to prevent UI thread lockup.",
      badge: "Worker Safety",
    },
  ],
  proTips: [
    "Use the 'Logic Inspector' tab to review the plain-English meaning and hypothesis requirements of any node.",
    "Switch to the 'Deduction Ledger' tab to view the live mathematical proof derivation table.",
    "The Guided Proof Assistant on the left highlights the immediate next deduction step needed to complete the proof.",
    "You can toggle between direct visual canvas interaction and the keyboard CLI console at any time without losing proof state.",
  ],
  lore: {
    title: "Why Formal Verification Matters in Modern Software",
    story:
      "Traditional testing (unit, integration, end-to-end) only tests sample inputs. Formal verification uses mathematical logic to prove that software satisfies specifications across all possible execution states. From NASA flight software and cryptographic microkernels (seL4) to blockchain smart contracts and compiler verification (CompCert), formal logic guarantees the complete absence of whole classes of bugs.",
    realWorldTech: [
      "Lean 4",
      "Coq / Rocq",
      "Z3 SMT Solver",
      "Curry-Howard Isomorphism",
      "seL4 Microkernel",
    ],
  },
};
