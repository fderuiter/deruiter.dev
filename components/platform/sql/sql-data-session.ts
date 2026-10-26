/**
 * The session the SQL workbench's data worker runs: it builds the default
 * synthetic portfolio's warehouse once and turns its gold tables into the
 * engine's load. It imports the platform through the public
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
  workbenchLoad,
  type WorkbenchLoad,
} from "@/lib/clinical-platform";

/** Builds the warehouse load once and returns it on every request. */
interface SqlDataSession {
  load(): Promise<WorkbenchLoad>;
}

/** Creates a session; the warehouse is built on the first request. */
export function createSqlDataSession(): SqlDataSession {
  let load: WorkbenchLoad | null = null;
  return {
    async load() {
      load ??= workbenchLoad(
        buildWarehouse(generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED }))
      );
      return load;
    },
  };
}
