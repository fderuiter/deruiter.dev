import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { classifyCampaignKill, CAMPAIGN_ACTS } from "@/lib/laser-loon";

describe("Laser Loon campaign kills (#1303)", () => {
  const finalAct = CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1].actNumber;

  it("counts a regular enemy toward the act", () => {
    expect(classifyCampaignKill({ isBoss: false }, 1)).toBe("act-kill");
    expect(classifyCampaignKill({ isBoss: false }, finalAct)).toBe("act-kill");
  });

  it("ends the act when a boss dies before the final act", () => {
    expect(classifyCampaignKill({ isBoss: true }, 1)).toBe("act-victory");
    expect(classifyCampaignKill({ isBoss: true }, finalAct - 1)).toBe(
      "act-victory"
    );
  });

  it("wins the campaign when the final act's boss dies", () => {
    expect(classifyCampaignKill({ isBoss: true }, finalAct)).toBe(
      "campaign-victory"
    );
  });

  // The component wires three separate kill paths. The soft-lock came from
  // Tremolo and Cryo-Mortar kills skipping campaign progression, so check
  // that each path hands its kills to the shared handler.
  describe("every weapon's kills reach campaign progression", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "components/LaserLoon.tsx"),
      "utf-8"
    );

    function block(startMarker: string, endMarker: string): string {
      const start = source.indexOf(startMarker);
      expect(start, `missing ${startMarker}`).toBeGreaterThan(-1);
      const end = source.indexOf(endMarker, start);
      expect(end, `missing ${endMarker}`).toBeGreaterThan(start);
      return source.slice(start, end);
    }

    it("Tremolo", () => {
      const tremolo = block(
        "const fireUltimateTremolo = useCallback",
        "// Start campaign act"
      );
      expect(tremolo).toContain("recordCampaignKill(t)");
    });

    it("Cryo-Mortar", () => {
      const ice = block(
        "iceResult.killedTargets.forEach",
        "// Render Active Ice Blocks"
      );
      expect(ice).toContain("recordCampaignKill(t)");
      expect(ice).toContain("awardComboKill(t");
    });

    it("lasers", () => {
      const laser = block(
        "hitResult.killedTargets.forEach",
        "hitResult.hitAny"
      );
      expect(laser).toContain("recordCampaignKill(t)");
      expect(laser).toContain("awardComboKill(t");
    });
  });
});
