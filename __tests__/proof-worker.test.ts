import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEOREMS, type TheoremId } from "@/lib/proof";
import { resolveWorkerSimulationSteps } from "@/app/proof/proof-worker";

describe("proof-worker simulation step resolution and message protocol", () => {
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    postMessageSpy = vi.fn();
    vi.spyOn(self, "postMessage").mockImplementation(
      postMessageSpy as unknown as typeof self.postMessage
    );
  });

  afterEach(() => {
    self.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "ABORT" },
      })
    );
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("resolveWorkerSimulationSteps", () => {
    it("gives non-empty sandboxSteps priority over theorem and custom formulas", () => {
      const sandbox = [
        "Loaded 2 sandbox premise(s): P; P -> Q",
        "Sandbox AST graph simulation completed locally.",
      ];
      expect(resolveWorkerSimulationSteps("custom", ["P"], sandbox)).toEqual(
        sandbox
      );
    });

    it("throws when theoremId is custom with fewer or more than 4 formulas", () => {
      expect(() => resolveWorkerSimulationSteps("custom")).toThrow(
        "Load custom formulas before simulation."
      );
      expect(() =>
        resolveWorkerSimulationSteps("custom", ["P", "P -> Q", "Q"])
      ).toThrow("Load custom formulas before simulation.");
      expect(() =>
        resolveWorkerSimulationSteps("custom", [
          "P",
          "P -> Q",
          "Q -> R",
          "R",
          "S",
        ])
      ).toThrow("Load custom formulas before simulation.");
    });

    it("returns generated custom simulation steps and truth-table check count for 4 valid formulas", () => {
      const steps = resolveWorkerSimulationSteps("custom", [
        "P",
        "P -> Q",
        "Q -> R",
        "R",
      ]);
      expect(steps).toContain("Parsed premises: P; P -> Q; Q -> R");
      expect(steps[steps.length - 1]).toBe(
        "Checked 8 truth-table valuations against the submitted goal."
      );
    });

    it("returns consensus verification steps for paxos-synod, paxos-phase2b, and bft-quorum", () => {
      for (const id of [
        "paxos-synod",
        "paxos-phase2b",
        "bft-quorum",
      ] as const) {
        const steps = resolveWorkerSimulationSteps(id, undefined, []);
        expect(steps).toEqual(THEOREMS[id].simulationSteps);
        expect(steps.length).toBeGreaterThan(0);
      }
    });

    it("falls back to modus-ponens simulation steps for default or unknown theorem ids", () => {
      expect(resolveWorkerSimulationSteps()).toEqual(
        THEOREMS["modus-ponens"].simulationSteps
      );
      expect(
        resolveWorkerSimulationSteps("unknown-theorem" as TheoremId)
      ).toEqual(THEOREMS["modus-ponens"].simulationSteps);
    });
  });

  describe("worker message listener", () => {
    it("ignores empty message events", () => {
      self.dispatchEvent(new MessageEvent("message", { data: null }));
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it("streams START_SIMULATION steps in normal mode and completes with matching requestId", () => {
      const steps = THEOREMS["paxos-synod"].simulationSteps;
      self.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "START_SIMULATION",
            requestId: 401,
            mode: "normal",
            theoremId: "paxos-synod",
          },
        })
      );

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenLastCalledWith({
        type: "progress",
        requestId: 401,
        step: 1,
        log: `[Step 1/${steps.length}] ${steps[0]}`,
      });

      vi.advanceTimersByTime(200 * steps.length);

      expect(postMessageSpy).toHaveBeenCalledTimes(steps.length + 1);
      expect(postMessageSpy).toHaveBeenLastCalledWith({
        type: "done",
        requestId: 401,
        stepsCompleted: steps.length,
        finalStatus: "success",
      });
    });

    it("posts an error message with matching requestId when custom formulas fail validation", () => {
      self.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "START_SIMULATION",
            requestId: 402,
            mode: "normal",
            theoremId: "custom",
            customFormulas: ["P"],
          },
        })
      );

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "error",
        requestId: 402,
        message: "Load custom formulas before simulation.",
      });
    });

    it("posts loop-mode progress with matching requestId on START_SIMULATION in loop mode", () => {
      const swallowLoopBreak = (event: ErrorEvent) => {
        if (event.message.includes("STOP_SYNC_WATCHDOG_LOOP")) {
          event.preventDefault();
        }
      };
      self.addEventListener("error", swallowLoopBreak);
      postMessageSpy.mockImplementationOnce(() => {
        throw new Error("STOP_SYNC_WATCHDOG_LOOP");
      });

      try {
        self.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "START_SIMULATION",
              requestId: 403,
              mode: "loop",
            },
          })
        );
      } catch {
        // Expected break before synchronous watchdog spin
      } finally {
        self.removeEventListener("error", swallowLoopBreak);
      }

      expect(postMessageSpy).toHaveBeenCalledTimes(1);
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "progress",
        requestId: 403,
        step: 0,
        log: expect.stringContaining("Starting loop simulation"),
      });
    });

    it("stops an active simulation on ABORT and ignores stale requestId timer callbacks", () => {
      let capturedStaleTick: (() => void) | undefined;
      const realSetTimeout = globalThis.setTimeout;
      const timeoutSpy = vi
        .spyOn(globalThis, "setTimeout")
        .mockImplementation(((fn: TimerHandler, delay?: number) => {
          if (!capturedStaleTick && typeof fn === "function") {
            capturedStaleTick = fn as () => void;
          }
          return realSetTimeout(fn, delay);
        }) as typeof setTimeout);

      self.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "START_SIMULATION",
            requestId: 500,
            mode: "normal",
          },
        })
      );
      expect(postMessageSpy).toHaveBeenCalledTimes(1);

      // Supersede request 500 with request 501, then ABORT request 501
      self.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "START_SIMULATION",
            requestId: 501,
            mode: "normal",
          },
        })
      );
      expect(postMessageSpy).toHaveBeenCalledTimes(2);

      // Invoking the stale callback for request 500 is ignored because activeRequestId is 501
      expect(capturedStaleTick).toBeTypeOf("function");
      capturedStaleTick?.();
      expect(postMessageSpy).toHaveBeenCalledTimes(2);

      // ABORT cancels the active timer and resets activeRequestId so no further steps post
      self.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ABORT", requestId: 501 },
        })
      );
      vi.advanceTimersByTime(5000);
      expect(postMessageSpy).toHaveBeenCalledTimes(2);

      timeoutSpy.mockRestore();
    });
  });
});
