import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DISPLAY_PROFILE,
  RandomizationError,
  createRandomizationStreams,
  createSubjectIdGenerator,
  decideRandomizationExport,
  presentAllocationRows,
  presentTreatmentSummary,
  resolvePresentation,
  toReportableRandomizationError,
  toSafeRandomizationErrorReport,
  validateRandomizationPlan,
} from "@/lib/randomization";

const SENTINEL = "SENTINEL_STUDY_7f3a";

function sentinelPlan(): unknown {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: `${SENTINEL}-plan`,
    name: `${SENTINEL} protocol`,
    provenance: {
      studyId: `${SENTINEL}-study`,
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "BLOCK",
    algorithmId: "mt19937-block-v1",
    arms: [
      {
        id: `${SENTINEL}-arm`,
        code: "A",
        label: `${SENTINEL} active`,
        allocationRatio: 1,
      },
      {
        id: `${SENTINEL}-arm`,
        code: "B",
        label: `${SENTINEL} placebo`,
        allocationRatio: 1,
      },
    ],
    sites: [
      {
        id: `${SENTINEL}-site`,
        code: SENTINEL,
        label: SENTINEL,
        recruitmentWeight: 1,
      },
    ],
    factors: [],
    seed: { value: SENTINEL.replace(/_/g, ""), source: "custom" },
    subjectIdMask: { pattern: `${SENTINEL}-{SEQ:3}` },
    enrollmentTarget: 10,
    caps: { strategy: "manual", capScope: "study-wide", intersectionCaps: [] },
    blockSettings: {
      defaultRule: { mode: "random-pool", sizes: [2] },
      trackingScope: "global",
      allowPartialFinalBlock: false,
    },
  };
}

describe("randomization privacy boundary", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let beaconSpy: ReturnType<typeof vi.fn>;
  let xhrOpenSpy: ReturnType<typeof vi.spyOn>;
  const originalHash = window.location.hash;

  beforeEach(() => {
    fetchSpy = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchSpy);
    beaconSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: beaconSpy,
    });
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, "open");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    xhrOpenSpy.mockRestore();
    window.location.hash = originalHash;
  });

  function expectNoTransport(): void {
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(xhrOpenSpy).not.toHaveBeenCalled();
    expect(decodeURIComponent(window.location.href)).not.toContain(SENTINEL);
  }

  it("keeps sentinel values out of reports built from validation findings", () => {
    const result = validateRandomizationPlan(sentinelPlan());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const leaked = result.findings.some((finding) =>
        JSON.stringify(finding).includes(SENTINEL)
      );
      // The in-page finding may name the duplicate; the outbound report must not.
      expect(leaked).toBe(true);
      for (const finding of result.findings) {
        const report = toSafeRandomizationErrorReport(finding);
        expect(JSON.stringify(report)).not.toContain(SENTINEL);
        expect(report.code).toBe(finding.code);
      }
    }
    expectNoTransport();
  });

  it("throws subject ID failures that carry only a code", () => {
    const streams = createRandomizationStreams("PrivacySeed2026");
    const generator = createSubjectIdGenerator("{SITE}", streams.identifier);
    generator.nextId({ siteCode: SENTINEL, stratumLabel: "ALL" });
    let thrown: unknown;
    try {
      generator.nextId({ siteCode: SENTINEL, stratumLabel: "ALL" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RandomizationError);
    const error = thrown as RandomizationError;
    expect(error.code).toBe("SUBJECT_ID_COLLISION");
    expect(error.message).not.toContain(SENTINEL);
    expect(String(error.stack ?? "")).not.toContain(SENTINEL);

    expect(() =>
      createSubjectIdGenerator(`${SENTINEL}{BAD`, streams.identifier)
    ).toThrow(/^SUBJECT_ID_MASK_INVALID$/);
    expectNoTransport();
  });

  it("reduces arbitrary errors to a generic code before reporting", () => {
    const foreign = new Error(`Failed on ${SENTINEL} arm`);
    (foreign as Error & { code?: string }).code = SENTINEL;
    expect(toSafeRandomizationErrorReport(foreign)).toEqual({
      source: "randomization",
      code: "RANDOMIZATION_UNKNOWN_ERROR",
    });
    expect(toSafeRandomizationErrorReport({ code: SENTINEL })).toEqual({
      source: "randomization",
      code: "RANDOMIZATION_UNKNOWN_ERROR",
    });
    const reportable = toReportableRandomizationError(foreign);
    expect(reportable.message).toBe(
      "randomization:RANDOMIZATION_UNKNOWN_ERROR"
    );
    expect(reportable.stack).toBeUndefined();
  });

  it("sends the error reporter only the safe code", async () => {
    vi.resetModules();
    const captureException = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ init: vi.fn(), captureException }));
    // Built from parts so the test file holds no literal DSN.
    const dsn = ["https://key", "o1.ingest.sentry.io/1"].join(
      String.fromCharCode(64)
    );
    vi.doMock("@/lib/env", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/env")>();
      return {
        ...actual,
        getEnv: () => ({ ...actual.getEnv(), NEXT_PUBLIC_SENTRY_DSN: dsn }),
      };
    });
    vi.doMock("@/lib/sentry-policy", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("@/lib/sentry-policy")>();
      return { ...actual, isReportableEnvironment: () => true };
    });
    const sentry = await import("@/lib/client-sentry");
    const thrown = new RandomizationError("SUBJECT_ID_COLLISION");
    await sentry.reportClientError(toReportableRandomizationError(thrown));
    expect(captureException).toHaveBeenCalledTimes(1);
    for (const call of captureException.mock.calls) {
      expect(
        JSON.stringify(call, Object.getOwnPropertyNames(call[0] ?? {}))
      ).not.toContain(SENTINEL);
      expect((call[0] as Error).message).toBe(
        "randomization:SUBJECT_ID_COLLISION"
      );
    }
    vi.doUnmock("@sentry/nextjs");
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/lib/sentry-policy");
  });

  it("masks and gates sentinel data locally without any network call or URL change", () => {
    const presentation = resolvePresentation(DEFAULT_DISPLAY_PROFILE);
    const rows = presentAllocationRows(
      [
        {
          sequence: 1,
          subjectId: `${SENTINEL}-001`,
          siteId: SENTINEL,
          stratumKey: "[]",
          stratumLevels: { [SENTINEL]: SENTINEL },
          armId: `${SENTINEL}-arm`,
          armCode: SENTINEL,
          blockIndex: 0,
          blockSize: 2,
          positionInBlock: 0,
        },
      ],
      presentation
    );
    expect(rows[0].armCode).not.toContain(SENTINEL);
    expect(
      JSON.stringify(
        presentTreatmentSummary(
          [
            {
              id: SENTINEL,
              code: SENTINEL,
              label: SENTINEL,
              allocationRatio: 1,
            },
          ],
          { [SENTINEL]: 1 },
          presentation
        )
      )
    ).not.toContain(SENTINEL);
    const decision = decideRandomizationExport({
      kind: "allocation-json",
      lifecycle: "promoted",
      disclosure: "masked",
      fullDisclosureAcknowledged: false,
      useNoticeAcknowledged: true,
    });
    expect(decision).toEqual({
      allowed: false,
      code: "FULL_DISCLOSURE_REQUIRED",
    });
    expectNoTransport();
  });
});
