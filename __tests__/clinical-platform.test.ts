import { describe, expect, it } from "vitest";
import {
  DQ_DIMENSIONS,
  LAYER_RANK,
  MEDALLION_LAYERS,
  PLATFORM_STAGES,
  REGULATORY_WORDING,
  checkLayerFlow,
  checkRegulatoryWording,
  type LineageEdge,
  type MedallionLayer,
} from "@/lib/clinical-platform";

function edge(from: MedallionLayer, to: MedallionLayer): LineageEdge {
  return {
    from: { productId: "src", layer: from, column: "a" },
    to: { productId: "dst", layer: to, column: "b" },
    transformation: "identity",
  };
}

describe("clinical-platform presets", () => {
  it("orders the medallion layers bronze, silver, gold", () => {
    expect(MEDALLION_LAYERS.map((layer) => layer.id)).toEqual([
      "bronze",
      "silver",
      "gold",
    ]);
    MEDALLION_LAYERS.forEach((layer, index) => {
      expect(LAYER_RANK[layer.id]).toBe(index);
    });
  });

  it("lists each internal stage once, starting from the portfolio", () => {
    const ids = PLATFORM_STAGES.map((stage) => stage.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("portfolio");
    expect(ids.indexOf("warehouse")).toBeLessThan(ids.indexOf("semantic"));
  });

  it("covers the six DAMA quality dimensions", () => {
    expect(DQ_DIMENSIONS).toHaveLength(6);
    expect(Object.isFrozen(DQ_DIMENSIONS)).toBe(true);
  });
});

describe("checkRegulatoryWording", () => {
  it("accepts the sanctioned wording", () => {
    expect(checkRegulatoryWording(REGULATORY_WORDING)).toEqual([]);
  });

  it("flags compliance and validation claims", () => {
    const findings = checkRegulatoryWording(
      "A Part 11 compliant platform with a Validated audit trail."
    );
    expect(findings.map((finding) => finding.message)).toEqual([
      expect.stringContaining('"compliant"'),
      expect.stringContaining('"Validated"'),
    ]);
    expect(findings.every((f) => f.rule === "regulatory-wording")).toBe(true);
  });

  it("allows non-compliant as the name of a finding", () => {
    expect(checkRegulatoryWording("Three non-compliant records.")).toEqual([]);
  });
});

describe("checkLayerFlow", () => {
  it("allows data to stay in a layer or move towards gold", () => {
    expect(checkLayerFlow(edge("bronze", "silver"))).toBeNull();
    expect(checkLayerFlow(edge("silver", "silver"))).toBeNull();
    expect(checkLayerFlow(edge("bronze", "gold"))).toBeNull();
  });

  it("rejects gold writing back into silver", () => {
    expect(checkLayerFlow(edge("gold", "silver"))).toEqual({
      rule: "layer-flow",
      message: "src.a (gold) cannot feed dst.b (silver).",
    });
  });
});
