"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TheoremId } from "@/lib/proof";
import type { TerminalLog } from "@/components/proof/ProofTerminalConsole";
import { makeLogId } from "./useProofSession";

/** A worker that reports nothing for this long is presumed stuck and restarted. */
export const SIMULATION_WATCHDOG_MS = 5000;

/** Progress lines are batched into the terminal at most this often. */
export const SIMULATION_FLUSH_MS = 100;

interface SimulationProgress {
  step: number;
  total: number;
  log: string;
}

interface SimulationRequest {
  mode: "normal" | "loop";
  theoremId: TheoremId;
  customFormulas?: string[];
  sandboxSteps?: string[];
}

interface ProofSimulationOptions {
  appendLogs: (...logs: TerminalLog[]) => void;
  announce: (text: string) => void;
}

/** A buffered progress line and the attempt that produced it. */
interface PendingLog {
  readonly requestId: number;
  readonly log: TerminalLog;
}

/**
 * Runs the proof simulation in a Web Worker. Progress lines are batched into
 * the terminal, a watchdog restarts a worker that goes silent, and replies to
 * a request that has since been aborted are ignored.
 *
 * Each buffered line carries its attempt (#3800). When an attempt finishes or
 * fails, its lines are written before the final line and progress stays
 * cleared. When it is aborted, timed out or replaced, its unwritten lines are
 * dropped, so they never show as the next attempt's output.
 */
export function useProofSimulation({
  appendLogs,
  announce,
}: ProofSimulationOptions) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] =
    useState<SimulationProgress | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLogsRef = useRef<PendingLog[]>([]);
  const requestIdRef = useRef(0);
  /** The attempt whose progress may show, or null when none is running. */
  const activeRequestRef = useRef<number | null>(null);
  const initWorkerRef = useRef<() => void>(() => {});

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  /** Writes one attempt's buffered lines now, without touching progress. */
  const flushAttempt = useCallback(
    (requestId: number) => {
      const mine = pendingLogsRef.current.filter(
        (entry) => entry.requestId === requestId
      );
      pendingLogsRef.current = [];
      if (mine.length > 0) appendLogs(...mine.map((entry) => entry.log));
    },
    [appendLogs]
  );

  /** Ends the running attempt: no later batch may revive its progress. */
  const endAttempt = useCallback(() => {
    activeRequestRef.current = null;
    pendingLogsRef.current = [];
  }, []);

  const handleWatchdogTimeout = useCallback(() => {
    endAttempt();
    workerRef.current?.terminate();
    initWorkerRef.current();
    setIsSimulating(false);
    setSimulationProgress(null);
    clearWatchdog();
    appendLogs({
      id: makeLogId("out-timeout"),
      type: "error",
      text: "Background calculation terminated by watchdog: execution exceeded 5-second limit (potential infinite loop detected)",
    });
    announce(
      "Background calculation terminated by watchdog: execution exceeded 5-second limit."
    );
  }, [endAttempt, clearWatchdog, appendLogs, announce]);

  const resetWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogRef.current = setTimeout(
      handleWatchdogTimeout,
      SIMULATION_WATCHDOG_MS
    );
  }, [clearWatchdog, handleWatchdogTimeout]);

  const initWorker = useCallback(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") return;
    workerRef.current?.terminate();

    const worker = new Worker(new URL("./proof-worker.ts", import.meta.url));

    worker.onmessage = (event) => {
      const message = event.data;
      if (!message) return;

      // Discard stale in-flight messages from previous request IDs
      if (message.requestId && message.requestId !== requestIdRef.current) {
        return;
      }

      resetWatchdog();

      if (message.type === "progress") {
        pendingLogsRef.current.push({
          requestId: requestIdRef.current,
          log: { id: makeLogId("sim"), type: "output", text: message.log },
        });
        announce(`Simulation update: ${message.log}`);
      } else if (message.type === "done") {
        flushAttempt(requestIdRef.current);
        endAttempt();
        setIsSimulating(false);
        setSimulationProgress(null);
        clearWatchdog();
        appendLogs({
          id: makeLogId("sim-done"),
          type: "success",
          text: `✔ Background Simulation completed successfully with ${message.stepsCompleted} steps.`,
        });
        announce("Background proof simulation completed successfully.");
      } else if (message.type === "error") {
        flushAttempt(requestIdRef.current);
        endAttempt();
        setIsSimulating(false);
        setSimulationProgress(null);
        clearWatchdog();
        appendLogs({
          id: makeLogId("sim-err"),
          type: "error",
          text: `Background Simulation error: ${message.message}`,
        });
        announce(`Background proof simulation error: ${message.message}`);
      }
    };

    workerRef.current = worker;
  }, [
    clearWatchdog,
    resetWatchdog,
    appendLogs,
    announce,
    flushAttempt,
    endAttempt,
  ]);

  useEffect(() => {
    initWorkerRef.current = initWorker;
  }, [initWorker]);

  useEffect(() => {
    initWorker();

    const flushInterval = setInterval(() => {
      if (pendingLogsRef.current.length === 0) return;
      const batch = pendingLogsRef.current;
      pendingLogsRef.current = [];
      const logsToAppend = batch.map((entry) => entry.log);
      appendLogs(...logsToAppend);
      // Only the running attempt's own lines may move its progress.
      const active = activeRequestRef.current;
      if (
        active === null ||
        batch.some((entry) => entry.requestId !== active)
      ) {
        return;
      }

      const stepLogs = logsToAppend.filter(
        (log) => log.type === "output" && log.text.includes("[Step")
      );
      const match = stepLogs.at(-1)?.text.match(/\[Step (\d+)\/(\d+)\] (.*)/);
      if (match) {
        setSimulationProgress({
          step: parseInt(match[1], 10),
          total: parseInt(match[2], 10),
          log: match[3],
        });
      }
    }, SIMULATION_FLUSH_MS);

    return () => {
      workerRef.current?.terminate();
      clearInterval(flushInterval);
      clearWatchdog();
    };
  }, [initWorker, clearWatchdog, appendLogs]);

  /** Cancels any running simulation; its late replies are ignored. */
  const abortSimulation = useCallback(() => {
    requestIdRef.current += 1;
    endAttempt();
    workerRef.current?.postMessage({ type: "ABORT" });
    setIsSimulating(false);
    setSimulationProgress(null);
    clearWatchdog();
  }, [clearWatchdog, endAttempt]);

  const startSimulation = useCallback(
    ({ mode, theoremId, customFormulas, sandboxSteps }: SimulationRequest) => {
      requestIdRef.current += 1;
      // A previous attempt's unwritten lines are not this attempt's output.
      pendingLogsRef.current = [];
      activeRequestRef.current = requestIdRef.current;
      setIsSimulating(true);
      setSimulationProgress({
        step: 1,
        total: sandboxSteps?.length ?? 10,
        log: "Booting Proof Simulation Engine...",
      });
      resetWatchdog();
      workerRef.current?.postMessage({
        type: "START_SIMULATION",
        requestId: requestIdRef.current,
        mode,
        theoremId,
        customFormulas,
        sandboxSteps,
      });
    },
    [resetWatchdog]
  );

  return {
    isSimulating,
    simulationProgress,
    startSimulation,
    abortSimulation,
  };
}
