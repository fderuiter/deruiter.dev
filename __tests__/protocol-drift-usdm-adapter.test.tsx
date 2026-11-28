import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudyRepositoryClient } from "@/components/clinical/study-repository-client";
import { ProtocolDriftWorkspaceBar } from "@/components/protocol-drift/ProtocolDriftWorkspaceBar";
import { CNS_NEURO_PRESET, exportStudyToUsdmObject } from "@/lib/crf";
import { adaptUsdmScheduleToProtocolDrift } from "@/lib/protocol-drift";
import { DEMO_301_USDM } from "@/lib/study-data/presets";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";
import { resetMockStorage } from "./helpers/storage-mock";

describe("Protocol Drift active USDM schedule adapter", () => {
  beforeEach(() => {
    resetMockStorage("localStorage");
    resetMockStorage("sessionStorage");
  });

  afterEach(() => {
    cleanup();
  });

  it("derives three submission waves from USDM visit schedules and preserves classic PD-101", () => {
    const demoAdapted = adaptUsdmScheduleToProtocolDrift(DEMO_301_USDM);
    expect(demoAdapted.source).toBe("workspace");
    expect(demoAdapted.studyId).toBe("DEMO-301");
    expect(demoAdapted.waves).toHaveLength(3);
    expect(demoAdapted.waves[0].releaseDay).toBeLessThan(
      demoAdapted.waves[1].releaseDay
    );
    expect(demoAdapted.waves[1].releaseDay).toBeLessThan(
      demoAdapted.waves[2].releaseDay
    );

    const tavrAdapted = adaptUsdmScheduleToProtocolDrift(TAVR_SAVR_USDM);
    expect(tavrAdapted.studyId).toBe("DEV-2026-VALVE-RCT");
    expect(tavrAdapted.visits.length).toBeGreaterThan(2);

    const classic = adaptUsdmScheduleToProtocolDrift(DEMO_301_USDM, {
      source: "pd-101",
    });
    expect(classic.source).toBe("pd-101");
    expect(classic.studyId).toBe("PD-101");
  });

  it("syncs with the shared study repository and toggles to classic PD-101", async () => {
    const repository = createStudyRepositoryClient();
    await repository.initialize();
    await repository.activateOrImportUsdm(
      "NEURO-2026-401",
      exportStudyToUsdmObject(CNS_NEURO_PRESET)
    );

    render(<ProtocolDriftWorkspaceBar repository={repository} />);
    expect(await screen.findByText(/NEURO-2026-401 —/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Classic PD-101 preset" })
    );
    expect(screen.getByText(/PD-101 — Phase II Orthostatic/)).toBeTruthy();
    repository.dispose();
  });
});
