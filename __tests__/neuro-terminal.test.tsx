// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  SCENARIOS,
  parseReconAllCommand,
  formatScenarioDiagnostics,
  NEURO_TERMINAL_COMMANDS,
} from "@/lib/neuro";

describe("neuro terminal simulation", () => {
  it("accepts modeled recon-all forms including every scenario command", () => {
    expect(parseReconAllCommand("recon-all")).toMatchObject({ ok: true });
    expect(parseReconAllCommand("recon-all -autorecon3")).toMatchObject({
      ok: true,
      stage: "-autorecon3",
    });
    for (const sc of Object.values(SCENARIOS)) {
      const c = sc.lore.freeSurferCommand;
      if (c.startsWith("recon-all")) {
        expect(parseReconAllCommand(c)).toMatchObject({ ok: true });
      }
    }
  });

  it("rejects unknown flags, suffixes, and conflicting stages", () => {
    expect(
      parseReconAllCommand("recon-all -autorecon2 --nonsense")
    ).toMatchObject({ ok: false });
    expect(parseReconAllCommand("recon-allxyz")).toMatchObject({ ok: false });
    expect(
      parseReconAllCommand("recon-all -autorecon2 -autorecon3")
    ).toMatchObject({ ok: false });
    expect(parseReconAllCommand("recon-all -s")).toMatchObject({ ok: false });
  });

  it("formats diagnostics from the scenario and metrics passed in", () => {
    const text = formatScenarioDiagnostics(SCENARIOS.dura_inclusion, {
      eulerCharacteristic: 2,
      defectCount: 38,
    });
    expect(text).toContain("χ = 2");
    expect(text).toContain("38");
    expect(text).not.toContain("412");
  });

  it("lists the modeled commands", () => {
    expect(NEURO_TERMINAL_COMMANDS.join(" ")).toContain("recon-all");
  });
});
