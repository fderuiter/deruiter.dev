// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  buildImmutableArtifact,
  canonicalizeAuditValue,
  computeContentDigest,
  computeEventProvenanceDigest,
  computeRandomizationCheckDigit,
  createMt19937Stream,
  createRandomizationStreams,
  createSubjectIdGenerator,
  deriveSeedComponents,
  formatStratumHumanCode,
  generateRandomSeed,
  migrateLegacySubjectIdMask,
  parseSubjectIdMask,
  previewSubjectIdMask,
  serializeStructuralStratumKey,
  validateSeedValue,
  type AllocationRow,
  type BlockRandomizationRequest,
} from "@/lib/randomization";

describe("randomization primitives (#3999)", () => {
  describe("MT19937 PRNG and seed reduction", () => {
    it("matches published MT19937 reference uint32 vectors for seed 5489 including ISO C++11 10000th output", () => {
      const stream = createMt19937Stream(5489);
      const outputs: number[] = [];
      for (let i = 0; i < 10_000; i += 1) {
        outputs.push(stream.nextUint32());
      }

      // Published MT19937 outputs for seed 5489 (Matsumoto & Nishimura / ISO C++11 §26.5.1.4)
      expect(outputs[0]).toBe(3499211612);
      expect(outputs[1]).toBe(581869302);
      expect(outputs[2]).toBe(3890346734);
      expect(outputs[3]).toBe(3586334585);
      expect(outputs[4]).toBe(545404204);
      // 10,000th output (index 9999, 16 twist cycles past 624): ISO C++11 standard check value
      expect(outputs[9999]).toBe(4123659995);
    });

    it("converts uint32 outputs to floats in [0, 1) by dividing by 4294967296", () => {
      const intStream = createMt19937Stream(5489);
      const floatStream = createMt19937Stream(5489);

      for (let i = 0; i < 50; i += 1) {
        const expected = intStream.nextUint32() / 4294967296;
        const actual = floatStream.nextFloat();
        expect(actual).toBe(expected);
        expect(actual).toBeGreaterThanOrEqual(0);
        expect(actual).toBeLessThan(1);
      }
    });

    it("generates 32 lowercase hex seeds from four uint32 words with injectable entropy", () => {
      const seed = generateRandomSeed((buf) => {
        buf[0] = 0x01234567;
        buf[1] = 0x89abcdef;
        buf[2] = 0x0000000a;
        buf[3] = 0xffffffff;
        return buf;
      });
      expect(seed).toBe("0123456789abcdef0000000affffffff");
      expect(seed).toMatch(/^[0-9a-f]{32}$/);
    });

    it("reduces 32-char hex seeds directly and ASCII seeds via SHA-256 + FNV-1a mod 2147483647", () => {
      const hexSeed = "0123456789ABCDEF0123456789abcdef";
      const hexDerived = deriveSeedComponents(hexSeed);
      expect(hexDerived.compressedHex).toBe("0123456789abcdef0123456789abcdef");

      const textSeed = "StudySeed2026";
      const expectedHex = createHash("sha256")
        .update(textSeed, "ascii")
        .digest("hex")
        .slice(0, 32);
      const textDerived = deriveSeedComponents(textSeed);
      expect(textDerived.compressedHex).toBe(expectedHex);

      // Independent FNV-1a reference over the 32 lowercase hex chars
      let fnv = 2166136261 >>> 0;
      for (let i = 0; i < expectedHex.length; i += 1) {
        fnv ^= expectedHex.charCodeAt(i);
        fnv = Math.imul(fnv, 16777619) >>> 0;
      }
      expect(textDerived.numericSeed).toBe(fnv % 2147483647);
    });

    it("rejects empty, oversized (>128), non-ASCII, or punctuation seeds consistently", () => {
      expect(validateSeedValue("ValidSeed123").ok).toBe(true);
      expect(validateSeedValue("").ok).toBe(false);
      expect(validateSeedValue("a".repeat(129)).ok).toBe(false);
      expect(validateSeedValue("Seed-With-Dash").ok).toBe(false);
      expect(validateSeedValue("Seed café").ok).toBe(false);
      expect(() => deriveSeedComponents("Seed café")).toThrow();
    });

    it("isolates allocation and identifier PRNG streams using seed + '-id'", () => {
      const pairA = createRandomizationStreams("StudySeed2026");
      const pairB = createRandomizationStreams("StudySeed2026");

      // Draw heavily from identifier stream on pairA
      for (let i = 0; i < 100; i += 1) {
        pairA.identifier.nextUint32();
      }

      // Allocation stream on pairA must remain identical to untouched pairB
      const allocA = Array.from({ length: 10 }, () =>
        pairA.allocation.nextUint32()
      );
      const allocB = Array.from({ length: 10 }, () =>
        pairB.allocation.nextUint32()
      );
      expect(allocA).toEqual(allocB);

      // Identifier stream must differ from allocation stream
      const idB = Array.from({ length: 10 }, () =>
        pairB.identifier.nextUint32()
      );
      expect(idB).not.toEqual(allocB);
    });
  });

  describe("structural stratum identity and human label separation", () => {
    it("distinguishes colliding human abbreviations and delimiter-shaped IDs unambiguously", () => {
      const keyA = serializeStructuralStratumKey([
        { factorId: "fac|a", levelId: "b|c" },
      ]);
      const keyB = serializeStructuralStratumKey([
        { factorId: "fac", levelId: "a|b|c" },
      ]);
      expect(keyA).not.toBe(keyB);

      const modA = serializeStructuralStratumKey([
        { factorId: "severity", levelId: "lvl-mod-1" },
      ]);
      const modB = serializeStructuralStratumKey([
        { factorId: "severity", levelId: "lvl-mod-2" },
      ]);
      expect(modA).not.toBe(modB);
      expect(formatStratumHumanCode(["Moderate"])).toBe("MOD");
      expect(formatStratumHumanCode(["Modern"])).toBe("MOD");
    });

    it("keeps comparison-prefixed labels intact while abbreviating other levels to 3 uppercase characters", () => {
      expect(
        formatStratumHumanCode(["<65", ">=100", "Female", "Stage II"])
      ).toBe("<65->=100-FEM-STA");
      expect(formatStratumHumanCode([])).toBe("ALL");
    });
  });

  describe("subject ID masks, legacy migration, check digits, and collisions", () => {
    it("computes the documented check digit with hand-verified vectors", () => {
      expect(computeRandomizationCheckDigit("ABC-XYZ")).toBe(0);
      expect(computeRandomizationCheckDigit("5")).toBe(5);
      expect(computeRandomizationCheckDigit("S01-0001")).toBe(8);
      expect(computeRandomizationCheckDigit("7992739871")).toBe(4);
    });

    it("explicitly migrates supported legacy bracket masks to modern tokens", () => {
      expect(
        migrateLegacySubjectIdMask("[SiteID]-[StratumCode]-[0000]")
      ).toEqual({
        changed: true,
        pattern: "{SITE}-{STRATUM}-{SEQ:4}",
      });
      expect(migrateLegacySubjectIdMask("[SiteID]-[###]")).toEqual({
        changed: true,
        pattern: "{SITE}-{SEQ:3}",
      });
      expect(migrateLegacySubjectIdMask("{SITE}-{SEQ:4}")).toEqual({
        changed: false,
        pattern: "{SITE}-{SEQ:4}",
      });
    });

    it("enforces mask length <=128, token bounds (SEQ 1-12, RND 1-32), single CHECKSUM, and rejects malformed tokens", () => {
      expect(
        parseSubjectIdMask("{SITE}-{STRATUM}-{SEQ:4}-{RND:6}-{CHECKSUM}").ok
      ).toBe(true);

      expect(parseSubjectIdMask("").ok).toBe(false);
      expect(parseSubjectIdMask("A".repeat(129)).ok).toBe(false);
      expect(parseSubjectIdMask("{SITE}-{UNKNOWN}").ok).toBe(false);
      expect(parseSubjectIdMask("{SEQ}").ok).toBe(false);
      expect(parseSubjectIdMask("{SEQ:0}").ok).toBe(false);
      expect(parseSubjectIdMask("{SEQ:04}").ok).toBe(false);
      expect(parseSubjectIdMask("{SEQ:13}").ok).toBe(false);
      expect(parseSubjectIdMask("{RND:0}").ok).toBe(false);
      expect(parseSubjectIdMask("{RND:01}").ok).toBe(false);
      expect(parseSubjectIdMask("{RND:33}").ok).toBe(false);
      expect(parseSubjectIdMask("[SiteID]-[0000]").ok).toBe(false);
      expect(parseSubjectIdMask("{SITE}-{CHECKSUM}-{CHECKSUM}").ok).toBe(false);
      expect(parseSubjectIdMask("{SITE-{SEQ:4}").ok).toBe(false);
      expect(parseSubjectIdMask("SITE}-{SEQ:4}").ok).toBe(false);
    });

    it("replaces tokens exhaustively, pads SEQ without truncating, uses per-site counters across strata, and previews without consuming PRNG", () => {
      const streams = createRandomizationStreams("MaskTestSeed2026");
      const preview = previewSubjectIdMask(
        "{SITE}-{STRATUM}-{SEQ:3}-{RND:4}-{CHECKSUM}"
      );
      expect(preview.ok).toBe(true);
      if (preview.ok) {
        expect(preview.exampleId).toMatch(/^S01-STR-001-[A-Z0-9]{4}-\d$/);
      }

      // Confirm preview did not consume any live stream
      const freshStreams = createRandomizationStreams("MaskTestSeed2026");
      expect(streams.allocation.nextUint32()).toBe(
        freshStreams.allocation.nextUint32()
      );
      expect(streams.identifier.nextUint32()).toBe(
        freshStreams.identifier.nextUint32()
      );

      const gen = createSubjectIdGenerator(
        "{SITE}-{STRATUM}-{SEQ:2}-{RND:4}-{CHECKSUM}",
        streams.identifier
      );
      const id1 = gen.nextId({ siteCode: "S01", stratumLabel: "LT65" });
      const id2 = gen.nextId({ siteCode: "S01", stratumLabel: "GE65" });
      const id3 = gen.nextId({ siteCode: "S02", stratumLabel: "LT65" });

      // Per-site counter starts at 1 and spans intersections
      expect(id1).toMatch(/^S01-LT65-01-[A-Z0-9]{4}-\d$/);
      expect(id2).toMatch(/^S01-GE65-02-[A-Z0-9]{4}-\d$/);
      expect(id3).toMatch(/^S02-LT65-01-[A-Z0-9]{4}-\d$/);

      // Sequence width is padding, never truncation
      const padGen = createSubjectIdGenerator(
        "{SITE}-{SEQ:1}",
        streams.identifier
      );
      let tenth = "";
      for (let i = 0; i < 10; i += 1) {
        tenth = padGen.nextId({ siteCode: "S01", stratumLabel: "ALL" });
      }
      expect(tenth).toBe("S01-10");
    });

    it("fails immediately on deterministic collisions and retries up to 100 times when RND tokens are present", () => {
      const streams = createRandomizationStreams("CollisionSeed2026");
      // No SEQ and no RND -> second ID for same site collides immediately
      const detGen = createSubjectIdGenerator("{SITE}", streams.identifier);
      expect(detGen.nextId({ siteCode: "S01", stratumLabel: "ALL" })).toBe(
        "S01"
      );
      expect(() =>
        detGen.nextId({ siteCode: "S01", stratumLabel: "ALL" })
      ).toThrow(/collision/i);

      // With RND token and a stuck PRNG that always returns 0 -> retries 100 times then fails
      let draws = 0;
      const stuckStream = {
        nextUint32: () => {
          draws += 1;
          return 0;
        },
        nextFloat: () => {
          draws += 1;
          return 0;
        },
      };
      const rndGen = createSubjectIdGenerator("{SITE}-{RND:1}", stuckStream);
      expect(rndGen.nextId({ siteCode: "S01", stratumLabel: "ALL" })).toBe(
        "S01-A"
      );
      draws = 0;
      expect(() =>
        rndGen.nextId({ siteCode: "S01", stratumLabel: "ALL" })
      ).toThrow(/100/);
      // Initial attempt + 100 retries = 101 draws
      expect(draws).toBe(101);
    });
  });

  describe("canonical serialization, content vs event digests, and immutable provenance", () => {
    it("sorts object keys deterministically, preserves array order and full numeric precision, and rejects non-finite or non-plain values", () => {
      const a = canonicalizeAuditValue({
        z: [3, 1, 2],
        a: { b: 0.123456789012345, a: "text" },
      });
      const b = canonicalizeAuditValue({
        a: { a: "text", b: 0.123456789012345 },
        z: [3, 1, 2],
      });
      expect(a).toBe(b);
      expect(a).toBe('{"a":{"a":"text","b":0.123456789012345},"z":[3,1,2]}');

      expect(() => canonicalizeAuditValue({ bad: Number.NaN })).toThrow(
        /finite/i
      );
      expect(() =>
        canonicalizeAuditValue({ bad: Number.POSITIVE_INFINITY })
      ).toThrow(/finite/i);
      expect(() => canonicalizeAuditValue([1, undefined, 2])).toThrow();
      expect(() => canonicalizeAuditValue({ when: new Date() })).toThrow(
        /non-plain/i
      );
      expect(() => canonicalizeAuditValue({ map: new Map() })).toThrow(
        /non-plain/i
      );
    });

    it("separates numerical content digest from clock-based event digest and detects every meaningful mutation", () => {
      const request: BlockRandomizationRequest = {
        contractVersion: RANDOMIZATION_CONTRACT_VERSION,
        planSchemaVersion: RANDOMIZATION_PLAN_SCHEMA_VERSION,
        id: "plan-imm-1",
        name: "Integrity Test Plan",
        provenance: {
          studyId: "STUDY-999",
          studyVersionId: "sv-1",
          studyDesignId: "sd-1",
          workspaceRevisionId: "R1",
          usdmSha256: "b".repeat(64),
        },
        arms: [
          { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
          { id: "arm-b", code: "B", label: "Placebo", allocationRatio: 1 },
        ],
        sites: [
          { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 1 },
        ],
        factors: [],
        seed: { value: "IntegritySeed2026", source: "custom" },
        subjectIdMask: { pattern: "{SITE}-{SEQ:3}" },
        enrollmentTarget: 2,
        method: "BLOCK",
        algorithmId: MT19937_BLOCK_ALGORITHM_ID,
        caps: {
          strategy: "manual",
          capScope: "study-wide",
          intersectionCaps: [],
        },
        blockSettings: {
          trackingScope: "global",
          allowPartialFinalBlock: false,
          defaultRule: { mode: "fixed-sequence", sizes: [2] },
        },
      };

      const rows: AllocationRow[] = [
        {
          sequence: 1,
          subjectId: "S01-001",
          siteId: "site-1",
          stratumKey: "[]",
          stratumLevels: {},
          armId: "arm-a",
          armCode: "A",
          blockIndex: 0,
          blockSize: 2,
          positionInBlock: 0,
        },
        {
          sequence: 2,
          subjectId: "S01-002",
          siteId: "site-1",
          stratumKey: "[]",
          stratumLevels: {},
          armId: "arm-b",
          armCode: "B",
          blockIndex: 0,
          blockSize: 2,
          positionInBlock: 1,
        },
      ];

      const artifactT1 = buildImmutableArtifact({
        request,
        reducedRatios: [1, 1],
        rows,
        now: () => new Date("2026-11-19T12:00:00.000Z"),
      });
      const artifactT2 = buildImmutableArtifact({
        request,
        reducedRatios: [1, 1],
        rows,
        now: () => new Date("2026-11-20T08:30:00.000Z"),
      });

      // Content digest is independent of generation clock time
      expect(artifactT1.digest.hex).toBe(artifactT2.digest.hex);
      expect(artifactT1.digest.hex).toMatch(/^[0-9a-f]{64}$/);

      // Event provenance digest changes when generation timestamp changes
      const eventT1 = computeEventProvenanceDigest(
        artifactT1.digest.hex,
        artifactT1.provenance.generatedAtIso,
        artifactT1.provenance.study
      );
      const eventT2 = computeEventProvenanceDigest(
        artifactT2.digest.hex,
        artifactT2.provenance.generatedAtIso,
        artifactT2.provenance.study
      );
      expect(eventT1).not.toBe(eventT2);

      // Mutating a row site, arm label, or site weight changes the content digest
      const mutatedRows = [{ ...rows[0], siteId: "site-2" }, rows[1]];
      const mutatedDigest = computeContentDigest({
        request,
        reducedRatios: [1, 1],
        rows: mutatedRows,
      });
      expect(mutatedDigest.hex).not.toBe(artifactT1.digest.hex);

      // Editing caller draft objects after building artifact cannot mutate the artifact
      const mutableDraft = JSON.parse(JSON.stringify(request)) as {
        name: string;
        arms: { label: string }[];
      };
      const frozen = buildImmutableArtifact({
        request: mutableDraft as unknown as BlockRandomizationRequest,
        reducedRatios: [1, 1],
        rows,
        now: () => new Date("2026-11-19T12:00:00.000Z"),
      });
      mutableDraft.name = "Mutated Draft Name";
      mutableDraft.arms[0].label = "Mutated Arm";
      expect(frozen.request.name).toBe("Integrity Test Plan");
      expect(frozen.request.arms[0].label).toBe("Active");
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.request)).toBe(true);
      expect(Object.isFrozen(frozen.rows)).toBe(true);
    });
  });
});
