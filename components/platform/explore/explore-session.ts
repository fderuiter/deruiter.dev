/**
 * The session the explorer's worker runs: it builds the default synthetic
 * portfolio's warehouse on the first request, keeps it, and runs every
 * exploration over it. It imports the engine through the public
 * `@/lib/clinical-platform` entry and never imports the module that
 * constructs the worker (chunk cycle guard, #853).
 *
 * Where Workers are unavailable (jsdom tests, very old browsers) the client
 * loads this same module on demand and runs it on the main thread.
 */
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  generatePortfolio,
  runExploration,
  type ExplorationResult,
  type Warehouse,
} from "@/lib/clinical-platform";
import type { ExploreRequest } from "./protocol";

/** Runs explorations over one warehouse. */
interface ExploreSession {
  handle(request: ExploreRequest): Promise<ExplorationResult>;
}

/** Creates a session; the warehouse is built on the first request. */
export function createExploreSession(): ExploreSession {
  let warehouse: Warehouse | null = null;
  return {
    async handle(request) {
      warehouse ??= buildWarehouse(
        generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
      );
      return runExploration(warehouse, request.exploration);
    },
  };
}
