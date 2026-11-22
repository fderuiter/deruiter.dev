// @vitest-environment node
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { afterEach, describe, expect, it } from "vitest";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  computeContentDigest,
  computePlanDigest,
  generateMinimizationSchedule,
  serializeStructuralStratumKey,
  type BlockRandomizationRequest,
  type MinimizationRandomizationRequest,
} from "@/lib/randomization";
import {
  MAX_RANDOMIZATION_PAGE_ROWS,
  RANDOMIZATION_PROTOCOL_VERSION,
  parseRandomizationCommand,
  parseRandomizationResponse,
  type RandomizationResponse,
} from "@/components/randomization/protocol";
import { createRandomizationHost } from "@/components/randomization/randomization-session";
import {
  RandomizationClientError,
  createRandomizationClient,
  type RandomizationClient,
} from "@/components/randomization/randomization-client";

/**
 * Worker client, host and protocol (#4004). The host is the code the real
 * worker runs; `HostWorker` runs it behind a structured-clone boundary with
 * asynchronous delivery, so these tests exercise the worker path without a
 * browser. In this Node environment the default worker factory finds no
 * `Worker`, so a client without a factory takes the main-thread fallback.
 */

function minimizationPlan(
  n = 12,
  seed = "ClientSeed2026"
): MinimizationRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-min",
    name: "Synthetic minimization plan",
    provenance: {
      studyId: "study-1",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "MINIMIZATION",
    algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 2 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 1 },
    ],
    factors: [
      {
        id: "sex",
        code: "SEX",
        label: "Sex",
        levels: [
          { id: "sex-f", code: "F", label: "Female" },
          { id: "sex-m", code: "M", label: "Male" },
        ],
      },
    ],
    seed: { value: seed, source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:5}" },
    enrollmentTarget: n,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      levelCaps: [],
      totalEnrollment: n,
    },
    minimizationSettings: {
      virtualCohortSize: n,
      biasedCoinProbability: 0.8,
    },
  };
}

function blockPlan(cap = 40): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-block",
    name: "Synthetic block plan",
    provenance: {
      studyId: "study-1",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 1 },
    ],
    factors: [],
    seed: { value: "BlockClient2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: cap,
    caps: {
      strategy: "manual",
      capScope: "study-wide",
      intersectionCaps: [
        { stratumKey: serializeStructuralStratumKey([]), cap },
      ],
    },
    blockSettings: {
      defaultRule: { mode: "fixed-sequence", sizes: [4] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
  };
}

/** Runs the real host behind a clone boundary, like a dedicated worker. */
class HostWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  terminated = false;
  throwOnPost = false;
  readonly commands: unknown[] = [];
  private readonly host = createRandomizationHost((response) => {
    const copy = structuredClone(response);
    setTimeout(() => {
      if (!this.terminated) this.emit(copy);
    }, 0);
  });

  postMessage(data: unknown) {
    if (this.throwOnPost) throw new Error("DataCloneError");
    const copy = structuredClone(data);
    this.commands.push(copy);
    setTimeout(() => {
      if (!this.terminated) this.host.receive(copy);
    }, 0);
  }

  terminate() {
    this.terminated = true;
    this.host.dispose();
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }

  fail(message = "boom") {
    this.onerror?.(
      fromPartial<ErrorEvent>({
        message,
        preventDefault() {},
      })
    );
  }
}

const workers: HostWorker[] = [];
const workerClient = (
  setup: (worker: HostWorker) => void = () => {}
): RandomizationClient =>
  createRandomizationClient({
    createWorker: () => {
      const worker = new HostWorker();
      setup(worker);
      workers.push(worker);
      return fromAny<Worker, HostWorker>(worker);
    },
  });

const clients: RandomizationClient[] = [];
const track = (client: RandomizationClient) => {
  clients.push(client);
  return client;
};

afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
  workers.splice(0);
});

describe("randomization protocol envelopes", () => {
  const identity = {
    operationId: 1,
    sessionId: "worker-1",
    planDigest: "a".repeat(64),
    workspaceRevision: 3,
  };

  it("accepts well-formed commands and refuses malformed ones", () => {
    const base = { protocolVersion: RANDOMIZATION_PROTOCOL_VERSION };
    expect(
      parseRandomizationCommand({
        ...base,
        kind: "generate",
        requestId: 1,
        identity,
        plan: {},
      })
    ).not.toBeNull();
    expect(
      parseRandomizationCommand({
        ...base,
        kind: "page",
        requestId: 2,
        identity,
        offset: 0,
        limit: MAX_RANDOMIZATION_PAGE_ROWS + 1,
      })
    ).toBeNull();
    expect(
      parseRandomizationCommand({ ...base, kind: "generate", requestId: 1 })
    ).toBeNull();
    expect(
      parseRandomizationCommand({
        protocolVersion: 99,
        kind: "cancel",
        requestId: 1,
        operationId: 1,
      })
    ).toBeNull();
    expect(
      parseRandomizationCommand({
        ...base,
        kind: "generate",
        requestId: 1,
        identity: { ...identity, planDigest: "not-a-digest" },
        plan: {},
      })
    ).toBeNull();
  });

  it("refuses responses with unsafe codes or oversized pages", () => {
    const base = { protocolVersion: RANDOMIZATION_PROTOCOL_VERSION };
    expect(
      parseRandomizationResponse({
        ...base,
        kind: "failed",
        requestId: 1,
        identity,
        code: "Study ABC-123 failed",
      })
    ).toBeNull();
    expect(
      parseRandomizationResponse({
        ...base,
        kind: "page",
        requestId: 1,
        identity,
        page: {
          offset: 0,
          totalRows: 1000,
          rows: new Array(MAX_RANDOMIZATION_PAGE_ROWS + 1).fill({}),
        },
      })
    ).toBeNull();
  });
});

describe("randomization host", () => {
  const run = (
    plan: unknown,
    options: Parameters<typeof createRandomizationHost>[1] = {},
    digest = computePlanDigest(plan)
  ) =>
    new Promise<RandomizationResponse[]>((resolve) => {
      const responses: RandomizationResponse[] = [];
      const host = createRandomizationHost((response) => {
        responses.push(response);
        if (response.kind !== "progress") resolve(responses);
      }, options);
      host.receive({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "generate",
        requestId: 1,
        identity: {
          operationId: 1,
          sessionId: "s",
          planDigest: digest,
          workspaceRevision: 0,
        },
        plan,
      });
    });

  it("reports each phase and a summary that matches the engine", async () => {
    const plan = minimizationPlan(30);
    const responses = await run(plan);
    expect(responses.map((r) => r.kind)).toEqual([
      "progress",
      "progress",
      "progress",
      "complete",
    ]);
    const complete = responses[3];
    if (complete.kind !== "complete") throw new Error("expected complete");
    const direct = generateMinimizationSchedule(plan);
    if (!direct.ok) throw new Error("expected a schedule");
    expect(complete.summary.rowCount).toBe(30);
    expect(complete.summary.contentDigest).toBe(
      computeContentDigest({
        request: plan,
        reducedRatios: direct.reducedRatios,
        rows: direct.rows,
      }).hex
    );
    expect(
      complete.summary.armCounts.reduce((sum, a) => sum + a.count, 0)
    ).toBe(30);
  });

  it("refuses a plan whose digest does not match", async () => {
    const responses = await run(minimizationPlan(), {}, "b".repeat(64));
    expect(responses.at(-1)).toMatchObject({
      kind: "failed",
      code: "PLAN_DIGEST_MISMATCH",
    });
  });

  it("rejects an over-limit plan in preflight with its estimate", async () => {
    const responses = await run(minimizationPlan(100_001));
    const failed = responses.at(-1);
    expect(failed).toMatchObject({
      kind: "failed",
      code: "RESOURCE_LIMIT_EXCEEDED",
    });
    if (failed?.kind !== "failed") throw new Error("expected failure");
    expect(
      failed.findings?.some(
        (f) => f.code === "RESOURCE_LIMIT_EXCEEDED" && f.estimatedValue
      )
    ).toBe(true);
  });

  it("refuses work above the fallback row budget visibly", async () => {
    const responses = await run(minimizationPlan(50), { rowBudget: 20 });
    expect(responses.at(-1)).toMatchObject({
      kind: "failed",
      code: "FALLBACK_BUDGET_EXCEEDED",
    });
  });

  it("answers a malformed command with a protocol violation", () => {
    const responses: RandomizationResponse[] = [];
    const host = createRandomizationHost((r) => responses.push(r));
    host.receive({ kind: "generate", requestId: 7 });
    expect(responses).toEqual([
      expect.objectContaining({
        kind: "failed",
        requestId: 7,
        identity: null,
        code: "PROTOCOL_VIOLATION",
      }),
    ]);
  });
});

describe("randomization client", () => {
  it("runs in a worker, then pages the result in bounded windows", async () => {
    const client = track(workerClient());
    const plan = blockPlan(1200);
    const outcome = await client.generate({ plan, workspaceRevision: 4 });
    expect(outcome.status).toBe("complete");
    expect(client.getState()).toMatchObject({
      status: "complete",
      mode: "worker",
      errorCode: null,
    });
    if (outcome.status !== "complete") return;
    expect(outcome.identity.workspaceRevision).toBe(4);
    expect(outcome.summary.rowCount).toBe(1200);

    const first = await client.page(0, 10_000);
    expect(first.rows).toHaveLength(MAX_RANDOMIZATION_PAGE_ROWS);
    expect(first.totalRows).toBe(1200);
    const last = await client.page(1000);
    expect(last.rows).toHaveLength(200);
    expect(last.rows[0].sequence).toBe(first.rows[0].sequence + 1000);
    await expect(client.page(1201)).rejects.toMatchObject({
      code: "PAGE_OUT_OF_RANGE",
    });
    await expect(client.page(-1)).rejects.toBeInstanceOf(
      RandomizationClientError
    );
  });

  it("produces the same rows and digest in the worker and the fallback", async () => {
    const plan = minimizationPlan(60, "ParitySeed");
    const inWorker = track(workerClient());
    const inThread = track(createRandomizationClient());
    const [a, b] = await Promise.all([
      inWorker.generate({ plan, workspaceRevision: 1 }),
      inThread.generate({ plan, workspaceRevision: 1 }),
    ]);
    expect(inWorker.getState().mode).toBe("worker");
    expect(inThread.getState().mode).toBe("main-thread");
    if (a.status !== "complete" || b.status !== "complete") {
      throw new Error("expected both to complete");
    }
    expect(a.summary).toEqual(b.summary);
    expect((await inWorker.page(0)).rows).toEqual(
      (await inThread.page(0)).rows
    );
  });

  it("falls back to the main thread when the worker cannot be constructed", async () => {
    const client = track(
      createRandomizationClient({ createWorker: () => null })
    );
    const outcome = await client.generate({
      plan: minimizationPlan(),
      workspaceRevision: 0,
    });
    expect(outcome.status).toBe("complete");
    expect(client.getState().mode).toBe("main-thread");
  });

  it("re-runs on the fallback when the worker fails before answering (CSP)", async () => {
    const client = track(
      workerClient((worker) => {
        worker.postMessage = () => {
          setTimeout(
            () => worker.fail("Refused by Content-Security-Policy"),
            0
          );
        };
      })
    );
    const outcome = await client.generate({
      plan: minimizationPlan(),
      workspaceRevision: 0,
    });
    expect(outcome.status).toBe("complete");
    expect(client.getState().mode).toBe("main-thread");
    if (outcome.status === "complete") {
      expect(outcome.identity.sessionId).toMatch(/^main-/);
    }
  });

  it("fails with a retry path when a running worker crashes", async () => {
    const client = track(workerClient());
    await client.generate({ plan: minimizationPlan(), workspaceRevision: 0 });
    const crashed = workers[0];
    const pending = client.generate({
      plan: minimizationPlan(13),
      workspaceRevision: 1,
    });
    crashed.fail();
    const outcome = await pending;
    expect(outcome).toMatchObject({ status: "failed", code: "WORKER_FAILED" });
    expect(client.getState().status).toBe("failed");
    expect(crashed.terminated).toBe(true);

    const retry = await client.generate({
      plan: minimizationPlan(13),
      workspaceRevision: 1,
    });
    expect(retry.status).toBe("complete");
    expect(workers).toHaveLength(2);
  });

  it("reports a postMessage rejection and keeps the draft untouched", async () => {
    const client = track(
      workerClient((worker) => {
        worker.throwOnPost = true;
      })
    );
    const plan = minimizationPlan();
    const before = JSON.stringify(plan);
    const outcome = await client.generate({ plan, workspaceRevision: 0 });
    expect(outcome).toMatchObject({
      status: "failed",
      code: "POST_MESSAGE_FAILED",
    });
    expect(client.getState().status).toBe("failed");
    expect(JSON.stringify(plan)).toBe(before);
  });

  it("refuses a plan that is not canonical JSON before sending it", async () => {
    const client = track(workerClient());
    const outcome = await client.generate({
      plan: { ...minimizationPlan(), enrollmentTarget: Number.NaN },
      workspaceRevision: 0,
    });
    expect(outcome).toMatchObject({
      status: "failed",
      code: "PLAN_NOT_SERIALIZABLE",
    });
    expect(workers).toHaveLength(0);
  });

  it("publishes validation findings for an invalid plan", async () => {
    const client = track(workerClient());
    const outcome = await client.generate({
      plan: { ...minimizationPlan(), arms: [] },
      workspaceRevision: 0,
    });
    expect(outcome.status).toBe("failed");
    expect(client.getState().findings.length).toBeGreaterThan(0);
    expect(client.getState().status).toBe("failed");
  });

  it("shows exactly one state at a time and notifies subscribers", async () => {
    const client = track(workerClient());
    const seen: string[] = [];
    const unsubscribe = client.subscribe(() => {
      const s = client.getState();
      seen.push(s.phase ? `${s.status}:${s.phase}` : s.status);
    });
    expect(client.getState().status).toBe("ready");
    await client.generate({ plan: minimizationPlan(), workspaceRevision: 0 });
    unsubscribe();
    expect(seen[0]).toBe("running");
    expect(seen).toContain("running:generating");
    expect(seen.at(-1)).toBe("complete");
  });

  it("stays usable across Strict Mode setup, dispose and setup", async () => {
    const client = track(workerClient());
    const first = client.generate({
      plan: minimizationPlan(),
      workspaceRevision: 0,
    });
    client.dispose();
    expect(await first).toMatchObject({
      status: "canceled",
      reason: "disposed",
    });
    expect(client.getState().status).toBe("ready");
    expect(workers[0].terminated).toBe(true);

    const second = await client.generate({
      plan: minimizationPlan(),
      workspaceRevision: 0,
    });
    expect(second.status).toBe("complete");
    expect(workers).toHaveLength(2);
  });
});
