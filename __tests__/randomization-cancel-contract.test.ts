// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MT19937_MINIMIZATION_ALGORITHM_ID,
  type MinimizationRandomizationRequest,
} from "@/lib/randomization";
import {
  RANDOMIZATION_PROTOCOL_VERSION,
  type RandomizationCommand,
  type RandomizationGenerationSummary,
} from "@/components/randomization/protocol";
import {
  createRandomizationClient,
  type RandomizationClient,
} from "@/components/randomization/randomization-client";
import { createPipelineClient } from "@/components/study-data/pipeline-client";

/**
 * Cancel, supersede and dispose (#4004, RND-EXECU-002, RND-EXECU-003,
 * RND-EXECU-005). `ScriptedWorker` records commands and answers only when a
 * test says, so each case can deliver an old answer after a newer request
 * and check that it never becomes the published result.
 */

function plan(n = 12): MinimizationRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-cancel",
    name: "Synthetic plan",
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
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 1 },
    ],
    factors: [],
    seed: { value: "CancelSeed", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: n,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      levelCaps: [],
      totalEnrollment: n,
    },
    minimizationSettings: { virtualCohortSize: n, biasedCoinProbability: 0.8 },
  };
}

const summary = (rowCount: number): RandomizationGenerationSummary => ({
  method: "MINIMIZATION",
  rowCount,
  requestedRows: rowCount,
  shortfall: 0,
  reducedRatios: [1, 1],
  armCounts: [],
  contentDigest: "c".repeat(64),
});

class ScriptedWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  terminated = false;
  readonly commands: RandomizationCommand[] = [];

  postMessage(data: RandomizationCommand) {
    this.commands.push(data);
  }

  terminate() {
    this.terminated = true;
  }

  /** Delivers a message as the worker would, even after termination. */
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }

  generateCommand(index = 0) {
    const command = this.commands.filter((c) => c.kind === "generate")[index];
    if (!command || command.kind !== "generate") {
      throw new Error("no generate command");
    }
    return command;
  }

  complete(index = 0, rows = 12) {
    const command = this.generateCommand(index);
    this.emit({
      protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
      kind: "complete",
      requestId: command.requestId,
      identity: command.identity,
      summary: summary(rows),
    });
  }
}

const workers: ScriptedWorker[] = [];
const clients: RandomizationClient[] = [];

function scriptedClient() {
  const client = createRandomizationClient({
    createWorker: () => {
      const worker = new ScriptedWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  clients.push(client);
  return client;
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
  workers.splice(0);
  vi.unstubAllGlobals();
});

describe("latest-request publication", () => {
  it("never lets an old success overwrite a newer request", async () => {
    const client = scriptedClient();
    const a = client.generate({ plan: plan(12), workspaceRevision: 1 });
    const b = client.generate({ plan: plan(14), workspaceRevision: 2 });
    expect(await a).toMatchObject({ status: "canceled", reason: "superseded" });
    // A running worker is terminated, so B runs in a fresh one.
    expect(workers).toHaveLength(2);
    expect(workers[0].terminated).toBe(true);

    // A answers late from the old worker, then forged on the new one.
    workers[0].complete(0, 12);
    const stale = workers[0].generateCommand();
    workers[1].emit({
      protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
      kind: "complete",
      requestId: stale.requestId,
      identity: stale.identity,
      summary: summary(12),
    });
    expect(client.getState().status).toBe("running");

    workers[1].complete(0, 14);
    const outcome = await b;
    expect(outcome.status).toBe("complete");
    expect(client.getState().summary?.rowCount).toBe(14);
    expect(client.getState().identity?.workspaceRevision).toBe(2);
  });

  it("drops an answer whose plan digest or revision differs", async () => {
    const client = scriptedClient();
    const pending = client.generate({ plan: plan(), workspaceRevision: 5 });
    const command = workers[0].generateCommand();
    for (const identity of [
      { ...command.identity, planDigest: "d".repeat(64) },
      { ...command.identity, workspaceRevision: 4 },
      { ...command.identity, sessionId: "worker-99" },
    ]) {
      workers[0].emit({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "failed",
        requestId: command.requestId,
        identity,
        code: "WORKER_FAILED",
      });
    }
    await flush();
    expect(client.getState().status).toBe("running");
    workers[0].complete();
    expect((await pending).status).toBe("complete");
  });

  it("ignores late progress and failure for a replaced operation", async () => {
    const client = scriptedClient();
    void client.generate({ plan: plan(12), workspaceRevision: 1 });
    workers[0].complete();
    await flush();
    const old = workers[0].generateCommand(0);
    void client.generate({ plan: plan(14), workspaceRevision: 2 });
    for (const kind of ["progress", "failed"] as const) {
      workers[0].emit({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind,
        requestId: old.requestId,
        identity: old.identity,
        ...(kind === "progress"
          ? { phase: "hashing" }
          : { code: "WORKER_FAILED" }),
      });
    }
    expect(client.getState()).toMatchObject({ status: "running", phase: null });
  });

  it("fails the operation on a malformed answer to its request", async () => {
    const client = scriptedClient();
    const pending = client.generate({ plan: plan(), workspaceRevision: 0 });
    const command = workers[0].generateCommand();
    workers[0].emit({ requestId: command.requestId, kind: "complete" });
    expect(await pending).toMatchObject({
      status: "failed",
      code: "PROTOCOL_VIOLATION",
    });
  });

  it("fails the operation on a message deserialization error", async () => {
    const client = scriptedClient();
    const pending = client.generate({ plan: plan(), workspaceRevision: 0 });
    workers[0].onmessageerror?.({} as MessageEvent<unknown>);
    expect(await pending).toMatchObject({
      status: "failed",
      code: "WORKER_MESSAGE_FAILED",
    });
    expect(client.getState().status).toBe("failed");
  });
});

describe("cancel and dispose", () => {
  it("cancels a worker run, terminates it and releases busy state", async () => {
    const client = scriptedClient();
    const pending = client.generate({ plan: plan(), workspaceRevision: 0 });
    client.cancel();
    expect(await pending).toMatchObject({
      status: "canceled",
      reason: "canceled",
    });
    expect(client.getState().status).toBe("canceled");
    expect(workers[0].terminated).toBe(true);
    workers[0].complete();
    expect(client.getState().status).toBe("canceled");
  });

  it("cancels the fallback at its next phase and drops its answer", async () => {
    const client = createRandomizationClient({ createWorker: () => null });
    clients.push(client);
    const pending = client.generate({ plan: plan(200), workspaceRevision: 0 });
    client.cancel();
    expect(await pending).toMatchObject({ status: "canceled" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(client.getState().status).toBe("canceled");
    expect(client.getState().summary).toBeNull();

    // The same fallback session serves the next request.
    const next = await client.generate({ plan: plan(), workspaceRevision: 1 });
    expect(next.status).toBe("complete");
    expect(client.getState().mode).toBe("main-thread");
  });

  it("rejects pending pages when a new generation releases the result", async () => {
    const client = scriptedClient();
    const first = client.generate({ plan: plan(), workspaceRevision: 0 });
    workers[0].complete();
    await first;
    const page = client.page(0, 10);
    void client.generate({ plan: plan(14), workspaceRevision: 1 });
    await expect(page).rejects.toMatchObject({ code: "RESULT_RELEASED" });
    await expect(client.page(0)).rejects.toMatchObject({
      code: "NO_COMPLETED_RESULT",
    });
  });

  it("settles everything on dispose and leaves no busy state", async () => {
    const client = scriptedClient();
    const first = client.generate({ plan: plan(), workspaceRevision: 0 });
    workers[0].complete();
    await first;
    const page = client.page(0);
    const running = client.generate({ plan: plan(14), workspaceRevision: 1 });
    client.dispose();
    await expect(page).rejects.toMatchObject({ code: "RESULT_RELEASED" });
    expect(await running).toMatchObject({
      status: "canceled",
      reason: "disposed",
    });
    expect(client.getState()).toMatchObject({ status: "ready", mode: "idle" });
    expect(workers.every((w) => w.terminated)).toBe(true);
    // Dispose twice is harmless.
    client.dispose();
  });

  it("never stops a study-data pipeline run", async () => {
    const created: { url: string; worker: ScriptedWorker }[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        constructor(url: URL) {
          const worker = new ScriptedWorker();
          created.push({ url: String(url), worker });
          return worker;
        }
      }
    );
    const pipeline = createPipelineClient();
    const pipelineRun = pipeline.request({
      type: "run",
      seed: 1,
      nSubjects: 10,
    });
    const randomization = createRandomizationClient();
    clients.push(randomization);
    const allocation = randomization.generate({
      plan: plan(),
      workspaceRevision: 0,
    });
    randomization.cancel();
    expect(await allocation).toMatchObject({ status: "canceled" });

    expect(created.map((c) => c.url)).toEqual([
      expect.stringContaining("pipeline.worker"),
      expect.stringContaining("randomization.worker"),
    ]);
    expect(created[0].worker.terminated).toBe(false);
    expect(created[1].worker.terminated).toBe(true);
    expect(pipeline.mode()).toBe("worker");
    pipeline.dispose();
    await expect(pipelineRun).rejects.toThrow();
  });
});
