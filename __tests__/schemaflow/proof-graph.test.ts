// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  connectionError,
  edgeColor,
  HELP_TEXT,
  INITIAL_EDGES,
  isNodeProven,
  parseCommand,
  PROOF_NODES,
  proofStatus,
  solverRamPercent,
  suggestCommand,
  tooltipPosition,
} from "@/components/schemaflow/proof-graph";

const e = (source: string, target: string) => ({ source, target });
const Q = [e("A", "C"), e("B", "C")];
const R = [...Q, e("C", "E"), e("D", "E")];

describe("proofStatus", () => {
  it("starts with nothing proven", () => {
    expect(proofStatus(INITIAL_EDGES)).toEqual({
      isC_Proven: false,
      isE_Proven: false,
    });
  });

  it("proves Q once A and B both lead to C", () => {
    expect(proofStatus(Q)).toEqual({ isC_Proven: true, isE_Proven: false });
  });

  it("proves R only on top of a proven Q", () => {
    expect(proofStatus(R)).toEqual({ isC_Proven: true, isE_Proven: true });
    expect(proofStatus([e("C", "E"), e("D", "E")]).isE_Proven).toBe(false);
    expect(proofStatus([...Q, e("C", "E")]).isE_Proven).toBe(false);
  });
});

describe("isNodeProven", () => {
  it("treats premises as proven and C and E by the status", () => {
    const status = proofStatus(Q);
    expect(isNodeProven("A", status)).toBe(true);
    expect(isNodeProven("D", status)).toBe(true);
    expect(isNodeProven("C", status)).toBe(true);
    expect(isNodeProven("E", status)).toBe(false);
  });
});

describe("edgeColor", () => {
  it("brightens edges touching a proven Q, and every edge once R is proven", () => {
    expect(edgeColor(e("A", "C"), proofStatus(INITIAL_EDGES))).toBe("#0891b2");
    expect(edgeColor(e("A", "C"), proofStatus(Q))).toBe("#06b6d4");
    expect(edgeColor(e("C", "E"), proofStatus(Q))).toBe("#06b6d4");
    expect(edgeColor(e("D", "E"), proofStatus(Q))).toBe("#0891b2");
    expect(edgeColor(e("D", "E"), proofStatus(R))).toBe("#06b6d4");
  });
});

describe("connectionError", () => {
  it("accepts a new edge between known nodes", () => {
    expect(connectionError(INITIAL_EDGES, "B", "C")).toBeNull();
  });

  it("refuses unknown nodes, loops and duplicates", () => {
    expect(connectionError([], "A", "Z")).toBe(
      "Invalid node IDs: [A, Z]. Use A, B, C, D, E."
    );
    expect(connectionError([], "Q", "A")).toMatch(/^Invalid node IDs/);
    expect(connectionError([], "C", "C")).toBe(
      "Self-connections are forbidden."
    );
    expect(connectionError(INITIAL_EDGES, "A", "C")).toBe(
      "Pathway from Node A to Node C is already active."
    );
  });
});

describe("tooltipPosition", () => {
  it("sits above lower nodes and below the top row, inside the canvas", () => {
    const [a, , c, , eNode] = PROOF_NODES;
    expect(tooltipPosition(a)).toEqual({ x: 80, y: 168 });
    expect(tooltipPosition(c)).toEqual({ x: 340, y: 128 });
    expect(tooltipPosition(eNode)).toEqual({ x: 520, y: 208 });
    expect(tooltipPosition({ ...a, x: 0 }).x).toBe(10);
  });
});

describe("suggestCommand", () => {
  it("completes a prefix to the first matching command", () => {
    expect(suggestCommand("con")).toBe("connect");
    expect(suggestCommand("  DIS ")).toBe("disconnect");
    expect(suggestCommand("c")).toBe("connect");
    expect(suggestCommand("cl")).toBe("clear");
  });

  it("suggests nothing for empty or unknown input", () => {
    expect(suggestCommand("   ")).toBe("");
    expect(suggestCommand("xyz")).toBe("");
  });
});

describe("parseCommand", () => {
  it("lower-cases the verb and upper-cases node ids", () => {
    expect(parseCommand("  Connect  a   c ")).toEqual({
      verb: "Connect",
      op: "connect",
      source: "A",
      target: "C",
    });
    expect(parseCommand("help")).toEqual({
      verb: "help",
      op: "help",
      source: undefined,
      target: undefined,
    });
  });
});

describe("HELP_TEXT", () => {
  it("lists every command", () => {
    for (const command of [
      "connect",
      "disconnect",
      "rollback",
      "simulate",
      "clear",
      "help",
    ]) {
      expect(HELP_TEXT).toContain(`  ${command} `);
    }
  });
});

describe("solverRamPercent", () => {
  it("stays within the gauge's range", () => {
    for (let tick = 0; tick < 500; tick++) {
      const percent = solverRamPercent(tick);
      expect(percent).toBeGreaterThanOrEqual(30.2);
      expect(percent).toBeLessThanOrEqual(98.4);
    }
  });

  it("spikes every seventh tick and dips every eleventh", () => {
    const base = (tick: number) =>
      42.5 + Math.sin(tick * 0.4) * 8 + Math.cos(tick * 0.15) * 4;
    expect(solverRamPercent(7)).toBeCloseTo(base(7) + 10);
    expect(solverRamPercent(22)).toBeCloseTo(base(22) - 8);
    expect(solverRamPercent(11)).toBe(30.2);
    expect(solverRamPercent(1)).toBeCloseTo(base(1));
  });
});
