import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PipelineCancelledError,
  PipelineDisposedError,
  createPipelineClient,
} from "@/components/study-data/pipeline-client";
import type { StudyDataRequest } from "@/components/study-data/protocol";

/**
 * Cancel and dispose on the main-thread fallback (#3805). The session module
 * is replaced by one whose import and whose answers settle only when the
 * test says, so each case can stop the client before the session exists,
 * while a request is in flight, or after it answered. Main-thread work that
 * has started cannot be interrupted; the contract is that its result never
 * reaches the caller after cancel or dispose.
 */

const fake = vi.hoisted(() => {
  const state = {
    sessionsCreated: 0,
    handled: [] as {
      request: StudyDataRequest;
      finish: (value: unknown) => void;
    }[],
    releaseImport: (() => {}) as () => void,
    importGate: Promise.resolve() as Promise<void>,
  };
  const holdImport = () => {
    state.importGate = new Promise<void>((resolve) => {
      state.releaseImport = resolve;
    });
  };
  return { state, holdImport };
});

// The client loads the session module, then calls createStudyDataSession;
// returning a promise here holds "the session is not available yet" open
// until the test releases it.
vi.mock("@/components/study-data/pipeline-session", () => ({
  createStudyDataSession: () => {
    fake.state.sessionsCreated += 1;
    const session = fake.state.sessionsCreated;
    const handle = (request: StudyDataRequest) =>
      new Promise((resolve) => {
        fake.state.handled.push({
          request,
          finish: (value) => resolve({ session, value }),
        });
      });
    return fake.state.importGate.then(() => ({ handle }));
  },
}));

const runRequest = { type: "run", seed: 1, nSubjects: 10 } as const;

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// Load the mocked module once up front: two dynamic imports of a module that
// is still loading can resolve differently under the test runner.
beforeAll(async () => {
  await import("@/components/study-data/pipeline-session");
});

afterEach(() => {
  fake.state.handled = [];
  fake.state.sessionsCreated = 0;
});

describe("pipeline client cancel and dispose without a worker (#3805)", () => {
  it("cancel before the session exists rejects the request and starts no work", async () => {
    expect(typeof Worker).toBe("undefined");
    fake.holdImport();
    const client = createPipelineClient();
    const pending = client.request(runRequest);

    client.cancel();
    fake.state.releaseImport();

    await expect(pending).rejects.toBeInstanceOf(PipelineCancelledError);
    await settle();
    expect(fake.state.handled).toHaveLength(0);
  });

  it("cancel during a request rejects it, and its late answer is dropped", async () => {
    const client = createPipelineClient();
    const pending = client.request(runRequest);
    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(1));

    client.cancel();
    fake.state.handled[0]!.finish("stale");

    await expect(pending).rejects.toBeInstanceOf(PipelineCancelledError);
  });

  it("the next request after cancel runs in a fresh session, as a fresh worker would", async () => {
    const client = createPipelineClient();
    const first = client.request(runRequest);
    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(1));
    fake.state.handled[0]!.finish("first");
    await expect(first).resolves.toEqual({ session: 1, value: "first" });

    client.cancel();
    const second = client.request(runRequest);
    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(2));
    fake.state.handled[1]!.finish("second");

    await expect(second).resolves.toEqual({ session: 2, value: "second" });
  });

  it("cancel with nothing pending only resets the session", async () => {
    const client = createPipelineClient();
    const first = client.request(runRequest);
    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(1));
    fake.state.handled[0]!.finish("done");
    await first;

    expect(() => client.cancel()).not.toThrow();
    expect(client.mode()).toBe("idle");
  });

  it("dispose rejects a pending request with PipelineDisposedError", async () => {
    const client = createPipelineClient();
    const pending = client.request(runRequest);
    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(1));

    client.dispose();
    fake.state.handled[0]!.finish("stale");

    await expect(pending).rejects.toBeInstanceOf(PipelineDisposedError);
  });

  it("serves the next request after dispose (setup, cleanup, setup)", async () => {
    const client = createPipelineClient();
    const first = client.request(runRequest);
    client.dispose();
    await expect(first).rejects.toBeInstanceOf(PipelineDisposedError);

    const second = client.request(runRequest);
    await vi.waitFor(() =>
      expect(fake.state.handled.length).toBeGreaterThan(0)
    );
    fake.state.handled.at(-1)!.finish("again");
    await expect(second).resolves.toMatchObject({ value: "again" });
  });

  it("a request sent after cancel is not rejected by the cancel before it", async () => {
    const client = createPipelineClient();
    const old = client.request(runRequest);
    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(1));
    client.cancel();
    const next = client.request(runRequest);
    await expect(old).rejects.toBeInstanceOf(PipelineCancelledError);

    await vi.waitFor(() => expect(fake.state.handled).toHaveLength(2));
    fake.state.handled[0]!.finish("stale");
    fake.state.handled[1]!.finish("kept");
    await expect(next).resolves.toEqual({ session: 2, value: "kept" });
  });
});
