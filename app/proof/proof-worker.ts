import { createCustomTheorem } from "@/lib/proof-custom";
import { generateTruthTable, THEOREMS, type TheoremId } from "@/lib/proof";

type WorkerAction =
  | {
      type: "START_SIMULATION";
      requestId?: number;
      mode: "normal" | "loop";
      theoremId?: TheoremId;
      customFormulas?: string[];
      sandboxSteps?: string[];
    }
  | { type: "ABORT"; requestId?: number };

/**
 * Resolves the ordered simulation steps for any built-in theorem, custom studio formula set, or sandbox session.
 */
export function resolveWorkerSimulationSteps(
  theoremId: TheoremId = "modus-ponens",
  customFormulas?: string[],
  sandboxSteps?: string[]
): string[] {
  if (sandboxSteps && sandboxSteps.length > 0) {
    return sandboxSteps;
  }
  if (theoremId === "custom") {
    if (!customFormulas || customFormulas.length !== 4) {
      throw new Error("Load custom formulas before simulation.");
    }
    const theorem = createCustomTheorem(
      customFormulas.slice(0, 3),
      customFormulas[3]
    );
    const premises = theorem.nodes
      .filter((node) => node.type === "premise")
      .map((node) => ({
        label: node.label,
        ast: node.ast!,
        description: node.description,
      }));
    const target = theorem.nodes.find((node) => node.type === "conclusion")!;
    const result = generateTruthTable(premises, {
      label: target.label,
      ast: target.ast!,
    });
    if (result.truthTable.some((row) => row.isCounterexample)) {
      throw new Error("The submitted premises do not entail the goal.");
    }
    return [
      ...theorem.simulationSteps,
      `Checked ${result.truthTable.length} truth-table valuations against the submitted goal.`,
    ];
  }
  return (
    THEOREMS[theoremId]?.simulationSteps ??
    THEOREMS["modus-ponens"].simulationSteps
  );
}

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
  theoremId: TheoremId = "modus-ponens",
  customFormulas?: string[],
  sandboxSteps?: string[]
) {
  cancelCurrentSimulation();
  activeRequestId = requestId;
  let steps: string[];
  try {
    steps = resolveWorkerSimulationSteps(
      theoremId,
      customFormulas,
      sandboxSteps
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : "Invalid custom proof.",
    });
    return;
  }
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
      currentSimulationTimer = setTimeout(next, 200);
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

if (
  typeof self !== "undefined" &&
  typeof self.addEventListener === "function"
) {
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

        while (true) {
          // Intentional synchronous loop to exercise the 5s worker watchdog
        }
      } else {
        runNormalSimulation(
          reqId,
          data.theoremId || "modus-ponens",
          data.customFormulas,
          data.sandboxSteps
        );
      }
    }
  });
}
