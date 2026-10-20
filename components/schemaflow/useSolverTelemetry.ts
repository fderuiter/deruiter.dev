import { useEffect, useRef, useState } from "react";
import { solverRamPercent } from "./proof-graph";
import type { AddLog } from "./useConsoleLog";

/** How often the simulated solver reports, about 12.5 times a second. */
const TICK_MS = 80;

/**
 * The simulated solver loop. While it runs it writes the RAM gauge straight
 * into the DOM through refs, so its ticks cause no React renders.
 */
export function useSolverTelemetry(addLog: AddLog) {
  const [isSolverLoopActive, setIsSolverLoopActive] = useState(false);
  const ramValRef = useRef(42.5);
  const gaugeContainerRef = useRef<HTMLDivElement>(null);
  const ramTextRef = useRef<HTMLSpanElement>(null);

  const toggleSolverLoop = () => {
    const next = !isSolverLoopActive;
    setIsSolverLoopActive(next);
    addLog(
      "info",
      next
        ? "High-frequency mathematical solver loop initiated. RAM Telemetry active."
        : "Solver loop telemetry simulation suspended."
    );
  };

  useEffect(() => {
    if (!isSolverLoopActive) return;
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      const percent = solverRamPercent(tick);
      ramValRef.current = percent;
      if (gaugeContainerRef.current) {
        gaugeContainerRef.current.style.setProperty(
          "--gauge-progress",
          percent.toString()
        );
      }
      if (ramTextRef.current) {
        ramTextRef.current.textContent = `${percent.toFixed(0)}%`;
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isSolverLoopActive]);

  return {
    isSolverLoopActive,
    toggleSolverLoop,
    ramValRef,
    gaugeContainerRef,
    ramTextRef,
  };
}
