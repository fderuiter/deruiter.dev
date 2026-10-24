/**
 * The session the operations worker runs: it builds the default synthetic
 * portfolio's warehouse on the first request, keeps it, and answers every
 * request from it. It imports the engine through the public
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
  operationsDashboard,
  type OperationsDashboard,
  type Warehouse,
} from "@/lib/clinical-platform";
import type { OperationsRequest } from "./protocol";

/** Answers dashboard requests over one warehouse. */
export interface OperationsSession {
  handle(request: OperationsRequest): Promise<OperationsDashboard>;
}

/** Creates a session; the warehouse is built on the first request. */
export function createOperationsSession(): OperationsSession {
  let warehouse: Warehouse | null = null;
  return {
    async handle(request) {
      warehouse ??= buildWarehouse(
        generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
      );
      return operationsDashboard(warehouse, request.scope);
    },
  };
}
