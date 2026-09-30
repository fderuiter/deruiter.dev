import { describe, it, expect } from "vitest";
import {
  ARCHETYPES,
  SIMULATOR_AXES,
  SIMULATOR_QUESTIONS,
  SIMULATOR_START_STEP,
  deriveSimulatorState,
  evaluateDecisions,
  formatSimulatorReport,
  maxAxisPoints,
  parseAnswerIndices,
  replayAnswers,
  resolveArchetype,
  type ArchetypeId,
  type SimulatorOption,
} from "@/lib/simulator";

/** Every complete path through the tree, as option indices. */
function allPaths(): number[][] {
  const paths: number[][] = [];
  const walk = (prefix: number[]) => {
    const { step } = replayAnswers(prefix);
    if (step === "final_eval") {
      paths.push(prefix);
      return;
    }
    SIMULATOR_QUESTIONS[step].options.forEach((_, index) =>
      walk([...prefix, index])
    );
  };
  walk([]);
  return paths;
}

const option = (
  points: Partial<SimulatorOption["points"]>
): SimulatorOption => ({
  text: "synthetic",
  description: "synthetic",
  points: { systems: 0, ui: 0, resilience: 0, velocity: 0, ...points },
  nextStep: "final_eval",
});

describe("simulator decision tree", () => {
  it("opens with the architecture bias question and its technical trade-offs", () => {
    const first = SIMULATOR_QUESTIONS[SIMULATOR_START_STEP];
    expect(first.title).toBe("1. Choose Your Architecture Bias");
    expect(first.options.map((o) => o.text)).toEqual([
      "Systems Rigor & Fault Isolation",
      "Interface Clarity & Human Ergonomics",
    ]);
    const copy = JSON.stringify(first).toLowerCase();
    expect(copy).not.toMatch(/hiring|recruit|candidate|leader/);
  });

  it("keeps the incident triage and code review scenarios", () => {
    expect(
      SIMULATOR_QUESTIONS.incident_triage.options.map((o) => o.text)
    ).toEqual([
      "Engage Distributed Circuit Breaker & Fallback Queue",
      "Scale Neon Read-Replicas & Increase Pool Timeouts",
    ]);
    expect(SIMULATOR_QUESTIONS.code_review.options.map((o) => o.text)).toEqual([
      "Enforce Exhaustive Idempotency Keys & Deduplication Window",
      "Implement Client-Side Optimistic Updates with Rollback",
    ]);
  });

  it("reaches the final evaluation after exactly three answers on every path", () => {
    const paths = allPaths();
    expect(paths).toHaveLength(8);
    for (const path of paths) expect(path).toHaveLength(3);
  });
});

describe("archetype mapping", () => {
  it("reaches every archetype from at least one real path", () => {
    const reached = new Set<ArchetypeId>(
      allPaths().map(
        (path) => evaluateDecisions(replayAnswers(path).answers).archetype.id
      )
    );
    expect([...reached].sort()).toEqual(Object.keys(ARCHETYPES).sort());
  });

  it("maps each path to the archetype named by its bias and stance", () => {
    const byPath = Object.fromEntries(
      allPaths().map((path) => [
        path.join(""),
        evaluateDecisions(replayAnswers(path).answers).archetype.id,
      ])
    );
    expect(byPath).toEqual({
      "000": "fault-isolation-architect",
      "001": "fault-isolation-architect",
      "010": "distributed-systems-pragmatist",
      "011": "distributed-systems-pragmatist",
      "100": "human-centered-systems-architect",
      "101": "human-centered-systems-architect",
      "110": "product-velocity-engineer",
      "111": "product-velocity-engineer",
    });
  });

  it("resolves ties deterministically towards systems and resilience", () => {
    expect(
      resolveArchetype({ systems: 3, ui: 3, resilience: 2, velocity: 2 }).id
    ).toBe("fault-isolation-architect");
    expect(
      resolveArchetype({ systems: 1, ui: 3, resilience: 2, velocity: 2 }).id
    ).toBe("human-centered-systems-architect");
    expect(
      resolveArchetype({ systems: 0, ui: 0, resilience: 0, velocity: 0 }).id
    ).toBe("fault-isolation-architect");
  });

  it("does not depend on answer order", () => {
    const a = option({ ui: 2, velocity: 1 });
    const b = option({ systems: 2, resilience: 1 });
    expect(evaluateDecisions([a, b])).toEqual(evaluateDecisions([b, a]));
  });

  it("breaks lead-axis ties in display order", () => {
    const tied = evaluateDecisions(replayAnswers([0, 0, 0]).answers);
    expect(tied.stats.systems).toBe(100);
    expect(tied.stats.resilience).toBe(100);
    expect(tied.leadAxis).toBe("systems");
  });

  it("normalises stats to 0-100 against the tree maximum", () => {
    const max = maxAxisPoints();
    expect(max).toEqual({ systems: 7, ui: 6, resilience: 5, velocity: 5 });
    for (const path of allPaths()) {
      const { stats } = evaluateDecisions(replayAnswers(path).answers);
      for (const { key } of SIMULATOR_AXES) {
        expect(Number.isInteger(stats[key])).toBe(true);
        expect(stats[key]).toBeGreaterThanOrEqual(0);
        expect(stats[key]).toBeLessThanOrEqual(100);
      }
    }
    expect(evaluateDecisions([]).stats).toEqual({
      systems: 0,
      ui: 0,
      resilience: 0,
      velocity: 0,
    });
  });
});

describe("hash state derivation", () => {
  it("parses answer indices and skips junk", () => {
    expect(parseAnswerIndices("0, 1,x,0")).toEqual([0, 1, 0]);
    expect(parseAnswerIndices(undefined)).toEqual([]);
    expect(parseAnswerIndices("")).toEqual([]);
  });

  it("stops replaying at the first invalid index", () => {
    const replay = replayAnswers([1, 5, 0]);
    expect(replay.step).toBe("incident_triage");
    expect(replay.answers).toHaveLength(1);
  });

  it("ignores indices past the final step", () => {
    expect(replayAnswers([0, 0, 0, 1]).answers).toHaveLength(3);
  });

  it("falls back to the first question for an unknown step", () => {
    expect(deriveSimulatorState("welcome", "0").currentStep).toBe(
      SIMULATOR_START_STEP
    );
  });

  it("never shows the evaluation for an incomplete path", () => {
    expect(deriveSimulatorState("final_eval", "0").currentStep).toBe(
      "incident_triage"
    );
    expect(deriveSimulatorState("final_eval", "0,1,0").currentStep).toBe(
      "final_eval"
    );
  });
});

describe("report", () => {
  it("lists the archetype, the four stats and the decisions without hiring framing", () => {
    const { answers } = replayAnswers([0, 1, 0]);
    const report = formatSimulatorReport(
      evaluateDecisions(answers),
      answers,
      "https://deruiter.dev/simulator#step=final_eval&ans=0,1,0"
    );
    expect(report).toContain(
      "Architectural Archetype: Distributed Systems Pragmatist"
    );
    for (const { label } of SIMULATOR_AXES) expect(report).toContain(label);
    expect(report).toContain("1. Systems Rigor & Fault Isolation");
    expect(report).toContain("ans=0,1,0");
    expect(report).not.toMatch(/match|schedule|calendar/i);
  });
});
