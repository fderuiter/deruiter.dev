/**
 * Messages between the /platform/portfolio page and its worker. The worker
 * builds the synthetic portfolio's warehouse once and answers each request
 * from it; the warehouse itself never crosses to the page.
 */
import type {
  EnrollmentWhatIf,
  PortfolioDashboard,
  PortfolioForecast,
} from "@/lib/clinical-platform";

/** A request for the portfolio dashboard, or for one study's forecast with a what-if. */
export type PortfolioRequest =
  | { readonly id: number; readonly type: "dashboard" }
  | {
      readonly id: number;
      readonly type: "forecast";
      readonly studyId: string;
      readonly whatIf: EnrollmentWhatIf | null;
    };

/** What the worker answers a request with. */
export type PortfolioResult = PortfolioDashboard | PortfolioForecast;

/** The worker's answer to one request. */
export type PortfolioResponse =
  | {
      readonly id: number;
      readonly ok: true;
      readonly result: PortfolioResult;
    }
  | { readonly id: number; readonly ok: false; readonly error: string };
