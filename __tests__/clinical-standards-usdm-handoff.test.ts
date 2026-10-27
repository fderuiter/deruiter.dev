import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  USDM_HANDOFF_ENVELOPE_VERSION,
  canonicalUsdmJson,
  createUsdmHandoff,
  readUsdmHandoff,
  usdmContentHash,
} from "@/lib/clinical-standards";
import { DEMO_301_USDM } from "@/lib/study-data/presets";

function nodeSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const route = { source: "crf-studio", target: "study-data" } as const;

describe("canonicalUsdmJson", () => {
  it("sorts keys at every level and keeps array order", () => {
    expect(
      canonicalUsdmJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })
    ).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("gives the same text for documents that differ only in key order", () => {
    expect(canonicalUsdmJson({ x: 1, y: [1, 2] })).toBe(
      canonicalUsdmJson(JSON.parse('{"y":[1,2],"x":1}'))
    );
  });
});

describe("usdmContentHash", () => {
  it.each([
    ["an empty document", {}],
    ["non-ASCII text", { study: { name: "Étude — 试验 🫀" } }],
    ["a document spanning several SHA-256 blocks", { text: "x".repeat(200) }],
    ["DEMO-301", DEMO_301_USDM],
  ])("matches Node's SHA-256 of the canonical JSON for %s", (_label, usdm) => {
    expect(usdmContentHash(usdm)).toBe(nodeSha256(canonicalUsdmJson(usdm)));
  });

  it('matches the published SHA-256 test vector for "abc"', () => {
    expect(usdmContentHash("abc")).toBe(nodeSha256('"abc"'));
    expect(nodeSha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("changes when any value changes", () => {
    expect(usdmContentHash({ study: { name: "A" } })).not.toBe(
      usdmContentHash({ study: { name: "B" } })
    );
  });
});

describe("createUsdmHandoff", () => {
  it("describes the study without choosing a version", () => {
    const usdm = {
      usdmVersion: "4.0.0",
      study: {
        id: null,
        name: "S-1",
        versions: [{ versionIdentifier: "1.0" }, { versionIdentifier: "2.0" }],
      },
    };
    expect(createUsdmHandoff(usdm, route)).toEqual({
      envelopeVersion: USDM_HANDOFF_ENVELOPE_VERSION,
      source: "crf-studio",
      target: "study-data",
      study: {
        id: null,
        name: "S-1",
        usdmVersion: "4.0.0",
        versionIdentifiers: ["1.0", "2.0"],
      },
      sha256: usdmContentHash(usdm),
      usdm,
    });
  });

  it("tolerates a document that is not USDM at all", () => {
    expect(createUsdmHandoff(null, route).study).toEqual({
      id: null,
      name: null,
      usdmVersion: null,
      versionIdentifiers: [],
    });
  });
});

describe("readUsdmHandoff", () => {
  it("round-trips DEMO-301 through JSON text", () => {
    const envelope = createUsdmHandoff(DEMO_301_USDM, route);
    const read = readUsdmHandoff(
      JSON.parse(JSON.stringify(envelope)),
      "study-data"
    );
    expect(read).toEqual({ status: "ok", envelope });
  });

  it("recomputes the study summary instead of trusting it", () => {
    const envelope = createUsdmHandoff({ study: { name: "Real" } }, route);
    const read = readUsdmHandoff(
      { ...envelope, study: { ...envelope.study, name: "Forged" } },
      "study-data"
    );
    expect(read.status === "ok" && read.envelope.study.name).toBe("Real");
  });

  it.each([
    ["not an object", "text", "not-an-envelope"],
    [
      "missing its document",
      { envelopeVersion: 1, sha256: "x" },
      "not-an-envelope",
    ],
    [
      "another envelope version",
      { ...createUsdmHandoff({}, route), envelopeVersion: 2 },
      "unsupported-version",
    ],
    [
      "from an unknown tool",
      { ...createUsdmHandoff({}, route), source: "elsewhere" },
      "unknown-tool",
    ],
    [
      "meant for another tool",
      createUsdmHandoff({}, { source: "study-data", target: "crf-studio" }),
      "wrong-target",
    ],
    [
      "changed after hashing",
      { ...createUsdmHandoff({ a: 1 }, route), usdm: { a: 2 } },
      "hash-mismatch",
    ],
  ])("rejects an envelope %s", (_label, value, problem) => {
    expect(readUsdmHandoff(value, "study-data")).toEqual({
      status: "invalid",
      problem,
    });
  });
});
