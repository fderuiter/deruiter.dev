import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/quasi-perfect/lean-verify/route";

describe("POST /api/quasi-perfect/lean-verify API Route", () => {
  it("rejects invalid payloads with 400 and validation issues", async () => {
    const req = new Request(
      "http://localhost:3000/api/quasi-perfect/lean-verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invalidField: 123,
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid payload for Lean verification");
    expect(json.issues).toBeDefined();
  });

  it("verifies theorem script with local simulation fallback", async () => {
    const leanScript = `theorem test_theorem (a b : Nat) : a + b = b + a := by\n  ring`;
    const req = new Request(
      "http://localhost:3000/api/quasi-perfect/lean-verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theoremName: "test_theorem",
          typeSignature: "(a b : Nat) : a + b = b + a",
          leanScript,
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(["verified", "fallback_simulated"]).toContain(json.status);
    expect(json.engine).toBeDefined();
    expect(json.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("flags 'sorry' steps with line diagnostics", async () => {
    const leanScript = `theorem test_sorry (a : Nat) : a = a := by\n  sorry`;
    const req = new Request(
      "http://localhost:3000/api/quasi-perfect/lean-verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theoremName: "test_sorry",
          leanScript,
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.diagnostics).toBeDefined();
    expect(
      json.diagnostics.some(
        (d: { line: number; severity: string }) =>
          d.line === 2 && d.severity === "warning"
      )
    ).toBe(true);
  });
});
