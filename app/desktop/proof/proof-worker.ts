type TheoremId =
  | "modus-ponens"
  | "modus-tollens"
  | "hypothetical-syllogism"
  | "disjunctive-syllogism"
  | "resolution"
  | "two-phase-commit"
  | "quorum-overlap"
  | "cache-consistency"
  | "custom";

type WorkerAction =
  | {
      type: "START_SIMULATION";
      requestId?: number;
      mode: "normal" | "loop";
      theoremId?: TheoremId;
    }
  | { type: "ABORT"; requestId?: number };

const THEOREM_SIMULATION_STEPS: Record<TheoremId, string[]> = {
  "modus-ponens": [
    "Initializing Modus Ponens Tactic Engine...",
    "Traversing proof tree starting with premise nodes: Node A (P) and Node B (P → Q)...",
    "Validating Node A and Node B connection requirements...",
    "Applying Modus Ponens tactic to establish intermediate Node C (Q)...",
    "Local graph established intermediate Node C.",
    "Traversing next branch: Premise Node D (Q → R)...",
    "Validating Node C and Node D connection requirements to target Node E (R)...",
    "Applying Modus Ponens tactic to establish conclusion Node E (R)...",
    "Checking local proof graph structure...",
    "Local graph simulation completed; target R connected.",
  ],
  "modus-tollens": [
    "Initializing Modus Tollens Tactic Engine...",
    "Evaluating negative consequent: Node B (¬Q: No Heap Overflow)...",
    "Evaluating conditional implication: Node A (P → Q: Unbounded implies Overflow)...",
    "Applying Modus Tollens contrapositive rule to establish Node C (¬P: Bounded Memory)...",
    "Intermediate proposition ¬P discharged without sorry axiom.",
    "Linking with Premise Node D (¬P → R: Bounded memory prevents RCE)...",
    "Applying Modus Ponens on derived ¬P and Premise D...",
    "Discharging final Conclusion Node E (R: Exploit impossible)...",
    "Checking local contrapositive AST graph...",
    "Local deduction reached R; no runtime memory-safety guarantee was checked.",
  ],
  "hypothetical-syllogism": [
    "Initializing Hypothetical Syllogism Tactic Engine...",
    "Inspecting upstream conditional: Node A (P → Q: Auth to Cache)...",
    "Inspecting downstream conditional: Node B (Q → R: Cache to DB IOPS)...",
    "Applying Transitivity of Implication to synthesize intermediate Node C (P → R)...",
    "Transitive implication P → R proven valid.",
    "Connecting derived contract with SLA gatekeeper Node D ((P → R) → S)...",
    "Applying Modus Ponens on intermediate Node C and Premise Node D...",
    "Discharging Conclusion Node E (S: Global SLA Met)...",
    "Simulating latency dependencies in the example service mesh...",
    "Local implication graph reached S; no live service SLA was checked.",
  ],
  "disjunctive-syllogism": [
    "Initializing Disjunctive Syllogism Tactic Engine...",
    "Evaluating active disjunction: Node A (P ∨ Q: Primary or Standby)...",
    "Evaluating negation premise: Node B (¬P: Primary Heartbeat Failed)...",
    "Applying Disjunctive Syllogism elimination rule to establish Node C (Q: Standby Active)...",
    "Intermediate conclusion Q discharged successfully.",
    "Linking standby quorum with uptime guarantee: Node D (Q → R)...",
    "Applying Modus Ponens on derived Node C and Node D...",
    "Discharging final Conclusion Node E (R: Zero Downtime)...",
    "Simulating split-brain edge cases in the example Raft term...",
    "Local failover deduction completed; no distributed system was verified.",
  ],
  resolution: [
    "Initializing Resolution Refutation Tactic Engine...",
    "Inspecting Clause 1: Node A (P ∨ Q: Lock acquired or Enqueued)...",
    "Inspecting Clause 2: Node B (¬P ∨ R: Lock revoked or Rollback)...",
    "Applying Resolution Rule on complementary literal P / ¬P...",
    "Derived Resolvent Clause: Node C (Q ∨ R)...",
    "Inspecting unit clause constraint: Node D (¬Q: Not Enqueued)...",
    "Applying Unit Resolution on derived Node C and Node D...",
    "Discharging unit resolvent Conclusion Node E (R: Deadlock Rollback)...",
    "Checking empty clause refutation and cycle-free wait graph...",
    "Local concurrency deduction completed; no database was verified.",
  ],
  "two-phase-commit": [
    "Initializing Two-Phase Commit Verification...",
    "Gathering Phase-1 votes: Shard A (PrepA)...",
    "Gathering Phase-1 votes: Shard B (PrepB)...",
    "Applying Conjunction Introduction to establish (PrepA ∧ PrepB)...",
    "Unanimous prepare quorum established in the example graph.",
    "Linking with Coordinator Commit Rule Node D...",
    "Applying Modus Ponens to derive Global Commit...",
    "Simulating abort conditions across example network partitions...",
    "Local 2PC deduction completed; no production transaction was checked.",
  ],
  "quorum-overlap": [
    "Initializing Quorum Intersection Verification...",
    "Evaluating Quorum A size: (N/2 + 1)...",
    "Evaluating Quorum B size: (N/2 + 1)...",
    "Applying Majority Intersection Theorem to derive Overlap node...",
    "Inspecting overlapping voter term constraint Node D...",
    "Applying Modus Ponens to establish SingleLeader invariant...",
    "Simulating split-brain states across example network splits...",
    "Local quorum deduction completed; no Raft implementation was checked.",
  ],
  "cache-consistency": [
    "Initializing Cache Coherence Verification...",
    "Evaluating Primary Database Commit Event (Write)...",
    "Evaluating CDC Invalidation Trigger (Write → Invalidate)...",
    "Applying Modus Ponens to establish Cache Invalidation...",
    "Evaluating Edge Read Router Policy (Invalidate → FreshRead)...",
    "Applying Modus Ponens to discharge FreshRead invariant...",
    "Simulating race conditions between CDC stream and read replica...",
    "Local cache-consistency deduction completed; no live cache was checked.",
  ],
  custom: [
    "Custom workspace placeholder: entered formulas are not loaded yet.",
    "No custom SAT evaluation has been run.",
    "No custom inference tactic has been applied.",
    "Custom proof unavailable until the entered formulas populate the graph.",
  ],
};

let currentSimulationTimer: ReturnType<typeof setTimeout> | null = null;
let activeRequestId = 0;

function cancelCurrentSimulation() {
  if (currentSimulationTimer !== null) {
    clearTimeout(currentSimulationTimer);
    currentSimulationTimer = null;
  }
}

function runNormalSimulation(
  requestId: number,
  theoremId: TheoremId = "modus-ponens"
) {
  cancelCurrentSimulation();
  activeRequestId = requestId;
  const steps =
    THEOREM_SIMULATION_STEPS[theoremId] ||
    THEOREM_SIMULATION_STEPS["modus-ponens"];
  let currentStep = 0;

  function next() {
    if (activeRequestId !== requestId) return;

    if (currentStep < steps.length) {
      self.postMessage({
        type: "progress",
        requestId,
        step: currentStep + 1,
        log: `[Step ${currentStep + 1}/${steps.length}] ${steps[currentStep]}`,
      });
      currentStep++;
      currentSimulationTimer = setTimeout(next, 200); // 200ms delay between steps
    } else {
      self.postMessage({
        type: "done",
        requestId,
        stepsCompleted: steps.length,
        finalStatus: "success",
      });
      currentSimulationTimer = null;
    }
  }

  next();
}

self.addEventListener("message", (event: MessageEvent<WorkerAction>) => {
  const { data } = event;
  if (!data) return;

  if (data.type === "ABORT") {
    cancelCurrentSimulation();
    activeRequestId = 0;
    return;
  }

  if (data.type === "START_SIMULATION") {
    cancelCurrentSimulation();
    const reqId = data.requestId ?? Date.now();
    activeRequestId = reqId;

    if (data.mode === "loop") {
      self.postMessage({
        type: "progress",
        requestId: reqId,
        step: 0,
        log: "Starting loop simulation: this will enter an infinite loop to test the 5s watchdog...",
      });

      // Infinite synchronous loop to block the worker thread completely
      while (true) {
        // block
      }
    } else {
      runNormalSimulation(reqId, data.theoremId || "modus-ponens");
    }
  }
});
