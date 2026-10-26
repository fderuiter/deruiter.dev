/**
 * Messages between the /platform/portfolio page and its worker. The worker
 * builds the synthetic portfolio's warehouse once and answers each request
 * from it; the warehouse itself never crosses to the page.
 */
import type { PortfolioDashboard } from "@/lib/clinical-platform";

/** A request for the portfolio dashboard. */
export interface PortfolioRequest {
  readonly id: number;
  readonly type: "dashboard";
}

/** The worker's answer to one request. */
export type PortfolioResponse =
  | {
      readonly id: number;
      readonly ok: true;
      readonly result: PortfolioDashboard;
    }
  | { readonly id: number; readonly ok: false; readonly error: string };
