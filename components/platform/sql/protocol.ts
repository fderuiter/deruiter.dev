/**
 * Messages between the /platform/sql page and its data worker. The worker
 * builds the synthetic portfolio's warehouse and answers with the gold
 * tables as CSV plus the statements that load them, which the page hands to
 * the SQL engine. It runs only after the visitor starts the engine.
 */
import type { WorkbenchLoad } from "@/lib/clinical-platform";

/** A request for the warehouse load. */
export interface SqlDataRequest {
  readonly id: number;
  readonly type: "load";
}

/** The worker's answer to one request. */
export type SqlDataResponse =
  | { readonly id: number; readonly ok: true; readonly load: WorkbenchLoad }
  | { readonly id: number; readonly ok: false; readonly error: string };
