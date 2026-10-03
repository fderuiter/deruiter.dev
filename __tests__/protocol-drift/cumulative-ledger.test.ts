// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EXPECTED_ADVS_ROWS,
  EXPECTED_MH_RECORDS,
  EXPECTED_VS_RECORDS,
  GOLDEN_ADVS,
  formatDisplay,
} from "@/lib/protocol-drift";
import { playFullLevel, startEngine } from "./helpers";

describe("cumulative ledger after Wave 3", () => {
  const engine = startEngine();
  playFullLevel(engine);
  const v = engine.view();
  const current = v.vsLedger.filter((r) => !r.superseded);

  it("holds 110 current VS, 6 MH and 20 evaluable ADVS rows", () => {
    expect(current).toHaveLength(EXPECTED_VS_RECORDS);
    expect(current).toHaveLength(110);
    expect(v.mhLedger.filter((r) => !r.superseded)).toHaveLength(
      EXPECTED_MH_RECORDS
    );
    const evaluable = v.adamRows.filter((r) => r.AVAL !== null && !r.stale);
    expect(evaluable).toHaveLength(EXPECTED_ADVS_ROWS);
    expect(evaluable).toHaveLength(20);
  });

  it("matches the golden ADVS table at display precision, with CRIT1FL from unrounded values", () => {
    for (const g of GOLDEN_ADVS) {
      const row = v.adamRows.find(
        (r) =>
          r.USUBJID === g.USUBJID &&
          r.AVISITN === g.AVISITN &&
          r.PARAMCD === g.PARAMCD
      );
      expect(row, `${g.USUBJID} ${g.AVISITN} ${g.PARAMCD}`).toBeDefined();
      expect(Math.abs(Number(row?.AVALC) - g.aval)).toBeLessThanOrEqual(
        0.1 + 1e-9
      );
      expect(
        Math.abs(
          Number(formatDisplay(row?.BASE as number, row?.precision as number)) -
            g.sitting
        )
      ).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(row?.CRIT1FL).toBe(g.CRIT1FL);
    }
  });

  it("keeps every v1 visit as a NOT EVALUABLE ORTHOST entry in the unpaired ledger", () => {
    expect(v.unpaired).toHaveLength(20);
    expect(
      v.unpaired.every((r) => r.PARAMCD === "ORTHOST" && r.AVAL === null)
    ).toBe(true);
  });

  it("carries no fabricated precision and one documented uncertainty", () => {
    expect(v.debt).toMatchObject({
      fabricatedBits: 0,
      semanticLossCount: 0,
      uncertainCount: 1,
      traceBreaks: 0,
      collisionCount: 0,
    });
  });
});
