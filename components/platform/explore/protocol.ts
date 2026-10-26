/**
 * Messages between the /platform/explore page and its worker. The worker
 * builds the synthetic portfolio's warehouse once and answers each request
 * with one exploration's result, a few kilobytes; the warehouse itself
 * never crosses to the page.
 */
import type { Exploration, ExplorationResult } from "@/lib/clinical-platform";

/** A request to run one exploration. */
export interface ExploreRequest {
  readonly id: number;
  readonly type: "explore";
  readonly exploration: Exploration;
}

/** The worker's answer to one request. */
export type ExploreResponse =
  | {
      readonly id: number;
      readonly ok: true;
      readonly result: ExplorationResult;
    }
  | { readonly id: number; readonly ok: false; readonly error: string };
