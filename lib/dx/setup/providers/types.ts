import type { VerificationStatus } from "../types";

/** What a provider supplies to the application. */
export type ProviderCapability =
  | "database"
  | "cache"
  | "queue"
  | "authentication"
  | "email"
  | "monitoring"
  | "hosting"
  | "object-storage"
  | "source-control-api";

/** A deployment destination a value can be published to, besides `.env.local`. */
export type PublishDestination = "github" | "vercel";

/** One environment key an adapter reads. Secrecy comes from `classifyEnvKey`. */
export interface ProviderKey {
  name: string;
  /** Required for the integration to work; optional keys refine it. */
  required: boolean;
  /** Short format hint shown next to the prompt, never a real value. */
  hint?: string;
}

/** Whether the integration can be swapped for a compatible service. */
export interface ProviderPortability {
  /** True when any service speaking the same protocol works. */
  portable: boolean;
  /** What is substitutable, or why the integration is platform-specific. */
  note: string;
}

/** Result of an offline shape check or a live, read-only probe. */
export interface ProbeResult {
  status: VerificationStatus;
  detail: string;
}

/** Network access handed to a probe; tests pass a fake. */
export type ProbeFetch = (
  url: string,
  init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Everything a live probe may use. */
export interface ProbeContext {
  values: Readonly<Record<string, string>>;
  fetch: ProbeFetch;
  timeoutMs: number;
}

/**
 * The contract every integration implements. Adapters describe themselves;
 * the integrations stage does the prompting, writing and publishing, so no
 * adapter can write a file or call a deployment CLI on its own.
 */
export interface ProviderAdapter {
  id: string;
  name: string;
  capability: ProviderCapability;
  portability: ProviderPortability;
  keys: readonly ProviderKey[];
  /** Destinations a person may choose to publish these keys to. */
  destinations: readonly PublishDestination[];
  /** Dashboard steps for the guided path. */
  guidedSteps: readonly string[];
  /** What the advanced/manual path accepts instead of the named vendor. */
  manualPath: string;
  /** Repository documentation for the full dashboard journey. */
  docs: string;
  /** What the application does when this integration is skipped. */
  degraded: string;
  /** Offline check of the values' shape. Never touches the network. */
  validate(values: Readonly<Record<string, string>>): ProbeResult;
  /**
   * Optional live check. Must be read-only, must not send email, write
   * data or create resources, and must report only status codes.
   */
  probe?(context: ProbeContext): Promise<ProbeResult>;
}
