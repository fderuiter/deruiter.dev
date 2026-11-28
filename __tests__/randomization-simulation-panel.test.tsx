import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MONTE_CARLO_SIMULATION_VERSION,
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  reproduceRepetitionRequest,
  serializeStructuralStratumKey,
  type BlockRandomizationRequest,
  type MinimizationRandomizationRequest,
} from "@/lib/randomization";
import { SimulationPanel } from "@/components/randomization/SimulationPanel";
import { createRandomizationClient } from "@/components/randomization/randomization-client";

const download = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("@/lib/download", () => ({
  downloadFile: (...args: unknown[]) => {
    download.calls.push(args);
  },
}));

afterEach(() => {
  cleanup();
  download.calls.length = 0;
});

function plan(weight = 1): MinimizationRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-panel",
    name: "Synthetic plan",
    provenance: {
      studyId: "study-1",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "MINIMIZATION",
    algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: weight },
    ],
    factors: [],
    seed: { value: "PanelSeed", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: 10,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      levelCaps: [],
      totalEnrollment: 10,
    },
    minimizationSettings: { virtualCohortSize: 10, biasedCoinProbability: 0.8 },
  };
}

function failingBlockPlan(): BlockRandomizationRequest {
  return {
    ...plan(),
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    minimizationSettings: undefined,
    enrollmentTarget: 5,
    caps: {
      strategy: "manual",
      capScope: "study-wide",
      intersectionCaps: [
        { stratumKey: serializeStructuralStratumKey([]), cap: 5 },
      ],
    },
    blockSettings: {
      defaultRule: { mode: "fixed-sequence", sizes: [4] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: false,
    },
  };
}

const setValue = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("SimulationPanel", () => {
  it("runs QA, reports every repetition and states its limits", async () => {
    render(<SimulationPanel plan={plan()} workspaceRevision={1} />);
    expect(screen.getByRole("status").textContent).toBe("No QA run yet.");
    setValue(/Repetitions/, "8");
    setValue(/Attrition/, "20");
    fireEvent.click(screen.getByRole("button", { name: "Run QA" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("QA run complete.")
    );
    const report = screen.getByTestId("randomization-simulation-report");
    expect(report.textContent).toContain(
      "Attempted 8 · succeeded 8 · failed 0 · canceled 0"
    );
    expect(report.textContent).toContain("attrition 20%");
    expect(report.textContent).toContain("not significance tests");
    expect(report.textContent).toContain(
      "These figures describe this sample of runs only."
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText(/This report is stale/)).toBeNull();
  });

  it("marks the report stale when site weights change, yet reproduces the reviewed run", async () => {
    const view = render(
      <SimulationPanel plan={plan(1)} workspaceRevision={1} />
    );
    setValue(/Repetitions/, "3");
    fireEvent.click(screen.getByRole("button", { name: "Run QA" }));
    await screen.findByTestId("randomization-simulation-report");
    view.rerender(<SimulationPanel plan={plan(2)} workspaceRevision={2} />);
    expect(screen.getByText(/This report is stale/)).toBeTruthy();
    // The reviewed run stays reproducible: it uses the plan it ran with.
    fireEvent.click(
      screen.getByRole("button", { name: /Download that repetition/ })
    );
    const [content] = download.calls[0] as [string];
    const reproduced = JSON.parse(content) as MinimizationRandomizationRequest;
    expect(reproduced.sites[0].recruitmentWeight).toBe(1);
  });

  it("downloads the exact request of one reviewed repetition", async () => {
    render(<SimulationPanel plan={plan()} workspaceRevision={1} />);
    setValue(/Master seed/, "Reviewed01");
    setValue(/Repetitions/, "4");
    fireEvent.click(screen.getByRole("button", { name: "Run QA" }));
    await screen.findByTestId("randomization-simulation-report");
    setValue(/Repetition to reproduce/, "2");
    fireEvent.click(
      screen.getByRole("button", { name: /Download that repetition/ })
    );
    expect(download.calls).toHaveLength(1);
    const [content, filename] = download.calls[0] as [string, string];
    expect(filename).toBe("plan-panel-repetition-2.json");
    expect(JSON.parse(content)).toEqual(
      reproduceRepetitionRequest(
        {
          simulationVersion: MONTE_CARLO_SIMULATION_VERSION,
          masterSeed: "Reviewed01",
          repetitions: 4,
          attritionPercent: 0,
          plan: plan(),
        },
        2
      )
    );
  });

  it("keeps the settings inside the documented ranges", () => {
    render(<SimulationPanel plan={plan()} workspaceRevision={1} />);
    setValue(/Attrition/, "80");
    setValue(/Repetitions/, "5000");
    setValue(/Master seed/, "bad seed!");
    expect((screen.getByLabelText(/Attrition/) as HTMLInputElement).value).toBe(
      "50"
    );
    expect(
      (screen.getByLabelText(/Repetitions/) as HTMLInputElement).value
    ).toBe("200");
    expect(
      (screen.getByLabelText(/Master seed/) as HTMLInputElement).value
    ).toBe("badseed");
  });

  it("never presents zero successful repetitions as a pass", async () => {
    render(<SimulationPanel plan={failingBlockPlan()} workspaceRevision={1} />);
    setValue(/Repetitions/, "2");
    fireEvent.click(screen.getByRole("button", { name: "Run QA" }));
    const report = await screen.findByTestId("randomization-simulation-report");
    expect(report.textContent).toContain("succeeded 0 · failed 2");
    expect(report.textContent).toContain("This is not a passing result.");
    expect(report.textContent).toContain("Failed repetitions: 0 (");
  });

  it("cancels a run and keeps no result", async () => {
    render(
      <SimulationPanel
        plan={plan()}
        workspaceRevision={1}
        createClient={() =>
          createRandomizationClient({ createWorker: () => null })
        }
      />
    );
    setValue(/Repetitions/, "200");
    fireEvent.click(screen.getByRole("button", { name: "Run QA" }));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() =>
      expect((cancel as HTMLButtonElement).disabled).toBe(false)
    );
    fireEvent.click(cancel);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "QA run canceled. No result was kept."
      )
    );
    expect(screen.queryByTestId("randomization-simulation-report")).toBeNull();
  });

  it("labels QA request JSON downloads distinctly from schedule artifacts", async () => {
    render(<SimulationPanel plan={plan()} workspaceRevision={1} />);
    const runnerBtn = screen.getByRole("button", {
      name: "Download Monte Carlo QA request JSON (no schedule rows)",
    });
    fireEvent.click(runnerBtn);
    expect(download.calls).toHaveLength(1);
    const [runnerJson, runnerName] = download.calls[0] as [string, string];
    expect(runnerName).toBe("plan-panel-monte-carlo-request.json");
    const parsedRunner = JSON.parse(runnerJson) as Record<string, unknown>;
    expect(parsedRunner.rows).toBeUndefined();
    expect(parsedRunner.digest).toBeUndefined();

    setValue(/Repetitions/, "2");
    fireEvent.click(screen.getByRole("button", { name: "Run QA" }));
    await screen.findByTestId("randomization-simulation-report");
    expect(
      screen.getByRole("button", {
        name: "Download that repetition's QA request JSON (single cohort, no schedule rows)",
      })
    ).toBeTruthy();
  });
});
