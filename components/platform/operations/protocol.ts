/**
 * Messages between the /platform/operations page and its worker. The worker
 * builds the synthetic portfolio's warehouse once and answers each request
 * with the dashboard at one scope, a few tens of kilobytes; the warehouse
 * itself never crosses to the page.
 */
import type {
  OperationsDashboard,
  OperationsScope,
} from "@/lib/clinical-platform";

/** A request for the dashboard at a scope. */
export interface OperationsRequest {
  readonly id: number;
  readonly type: "dashboard";
  readonly scope: OperationsScope;
}

/** The worker's answer to one request. */
export type OperationsResponse =
  | {
      readonly id: number;
      readonly ok: true;
      readonly result: OperationsDashboard;
    }
  | { readonly id: number; readonly ok: false; readonly error: string };
