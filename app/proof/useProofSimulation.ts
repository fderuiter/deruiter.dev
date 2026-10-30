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
}

interface ProofSimulationOptions {
  appendLogs: (...logs: TerminalLog[]) => void;
  announce: (text: string) => void;
}

/**
 * Runs the proof simulation in a Web Worker. Progress lines are batched into
 * the terminal, a watchdog restarts a worker that goes silent, and replies to
 * a request that has since been aborted are ignored.
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
  const pendingLogsRef = useRef<TerminalLog[]>([]);
  const requestIdRef = useRef(0);
  const initWorkerRef = useRef<() => void>(() => {});

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const handleWatchdogTimeout = useCallback(() => {
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
  }, [clearWatchdog, appendLogs, announce]);

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
          id: makeLogId("sim"),
          type: "output",
          text: message.log,
        });
        announce(`Simulation update: ${message.log}`);
      } else if (message.type === "done") {
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
  }, [clearWatchdog, resetWatchdog, appendLogs, announce]);

  useEffect(() => {
    initWorkerRef.current = initWorker;
  }, [initWorker]);

  useEffect(() => {
    initWorker();

    const flushInterval = setInterval(() => {
      if (pendingLogsRef.current.length === 0) return;
      const logsToAppend = pendingLogsRef.current;
      pendingLogsRef.current = [];
      appendLogs(...logsToAppend);

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
    workerRef.current?.postMessage({ type: "ABORT" });
    setIsSimulating(false);
    setSimulationProgress(null);
    clearWatchdog();
  }, [clearWatchdog]);

  const startSimulation = useCallback(
    ({ mode, theoremId, customFormulas }: SimulationRequest) => {
      requestIdRef.current += 1;
      setIsSimulating(true);
      setSimulationProgress({
        step: 1,
        total: 10,
        log: "Booting Proof Simulation Engine...",
      });
      resetWatchdog();
      workerRef.current?.postMessage({
        type: "START_SIMULATION",
        requestId: requestIdRef.current,
        mode,
        theoremId,
        customFormulas,
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
