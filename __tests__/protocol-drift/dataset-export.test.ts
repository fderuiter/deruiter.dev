// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CSV_HEADERS,
  csvField,
  parseCsv,
  toCsv,
  type DatasetExportBundle,
} from "@/lib/protocol-drift";
import { ok, playFullLevel, startEngine } from "./helpers";

function exportBundle(): DatasetExportBundle {
  const engine = startEngine();
  playFullLevel(engine);
  ok(engine, { type: "REQUEST_LOCK" });
  ok(engine, { type: "CONFIRM_LOCK" });
  const e = ok(engine, { type: "EXPORT_DATASETS" }).find(
    (x) => x.type === "DATASETS_EXPORTED"
  );
  if (!e || e.type !== "DATASETS_EXPORTED") throw new Error("no export");
  return e.bundle;
}

describe("dataset export", () => {
  const bundle = exportBundle();

  it("writes VS.csv with 110 rows plus the header", () => {
    const rows = parseCsv(bundle["VS.csv"]);
    expect(rows).toHaveLength(111);
    expect(rows[0]).toEqual([...CSV_HEADERS.VS]);
    expect(bundle["VS.csv"].endsWith("\r\n")).toBe(true);
    const c = rows.find(
      (r) => r[2] === "PD-101-C01" && r[13] === "7" && r[4] === "SYSBP"
    );
    expect(c?.[9]).toBe("120.0");
  });

  it("writes MH.csv with 6 rows and keeps the A02 partial date", () => {
    const rows = parseCsv(bundle["MH.csv"]);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual([...CSV_HEADERS.MH]);
    const a02 = rows.find((r) => r[2] === "PD-101-A02");
    expect(a02?.[7]).toBe("2025-10");
  });

  it("writes ADVS.csv with exactly the 20 evaluable rows", () => {
    const rows = parseCsv(bundle["ADVS.csv"]);
    expect(rows).toHaveLength(21);
    expect(rows[0]).toEqual([...CSV_HEADERS.ADVS]);
    expect(rows.slice(1).every((r) => r[7] !== "NOT EVALUABLE")).toBe(true);
    expect(rows[1].slice(1, 3)).toEqual(["PD-101-A01", "OSBPDRP"]);
  });

  it("exports the audit trail and the unpaired ledger as JSON", () => {
    const json = JSON.parse(bundle["audit_trail.json"]) as {
      events: unknown[];
      unpaired: { AVALC: string }[];
    };
    expect(json.events.length).toBeGreaterThan(0);
    expect(json.unpaired).toHaveLength(20);
    expect(json.unpaired.every((u) => u.AVALC === "NOT EVALUABLE")).toBe(true);
  });

  it("quotes fields per RFC 4180 and round-trips", () => {
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField(null)).toBe("");
    expect(csvField("line\nbreak")).toBe('"line\nbreak"');
    const text = toCsv(
      ["x", "y"],
      [
        ['he said "hi", ok', 3],
        [undefined, "a\r\nb"],
      ]
    );
    expect(parseCsv(text)).toEqual([
      ["x", "y"],
      ['he said "hi", ok', "3"],
      ["", "a\r\nb"],
    ]);
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});
