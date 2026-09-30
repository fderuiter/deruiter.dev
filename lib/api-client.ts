/**
 * Typed, non-throwing JSON client for the site's own API routes.
 *
 * Every route built with `createApiHandler` (`lib/route-wrapper.ts`) answers
 * failures with the envelope `{ error: string, details?: [{ path, message }] }`.
 * The helpers here send JSON, read the response once, and return a uniform
 * {@link ApiClientResponse} so that components no longer repeat header
 * boilerplate, `response.json()` try/catch blocks and envelope parsing.
 *
 * The client never throws. A network failure (or an aborted request) is
 * reported as `status: 0` with `networkError: true`; a body that is empty
 * (204, 205, 304, zero length) or not JSON is reported as `body: null`.
 */

/** One field-level entry of the `createApiHandler` error envelope. */
export interface ApiErrorDetail {
  /** Dot-joined path of the offending field (e.g. `"slug"`, `"payload"`). */
  path: string;
  /** Human-readable validation message for that field. */
  message: string;
}

/** Uniform result of an {@link apiClient} call. */
export interface ApiClientResponse<T> {
  /** Parsed JSON body of a successful (2xx) response; `null` otherwise or when the body is empty or not JSON. */
  data: T | null;
  /**
   * Server-supplied `error` string from the envelope of a failed response.
   * `null` when the request succeeded or the server sent no usable message
   * (non-JSON body, network failure), so callers can supply their own copy.
   */
  error: string | null;
  /** Field-level `details` from the error envelope; empty when absent or malformed. */
  details: ApiErrorDetail[];
  /** Parsed JSON body regardless of status (useful when an error response also carries data); `null` when empty or not JSON. */
  body: unknown;
  /** HTTP status code, or `0` when no response was received. */
  status: number;
  /** `true` for a 2xx response. */
  ok: boolean;
  /** `true` when `fetch` itself rejected (offline, DNS, CORS, abort). */
  networkError: boolean;
}

/** Statuses that by definition carry no body. */
const EMPTY_BODY_STATUSES = new Set([204, 205, 304]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(res: Response): Promise<unknown> {
  if (EMPTY_BODY_STATUSES.has(res.status)) return null;
  if (res.headers?.get?.("content-length") === "0") return null;
  try {
    return await res.json();
  } catch {
    // Empty, truncated or non-JSON (e.g. an HTML error page from the edge).
    return null;
  }
}

function extractError(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const { error } = body;
  return typeof error === "string" && error.trim() !== "" ? error : null;
}

function extractDetails(body: unknown): ApiErrorDetail[] {
  if (!isRecord(body) || !Array.isArray(body.details)) return [];
  return body.details.flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.message !== "string") return [];
    return [
      {
        path: typeof entry.path === "string" ? entry.path : "",
        message: entry.message,
      },
    ];
  });
}

async function request<T>(
  method: string,
  url: string,
  body: unknown,
  init: RequestInit | undefined
): Promise<ApiClientResponse<T>> {
  const headers = new Headers(init?.headers);
  const hasBody = body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch {
    return {
      data: null,
      error: null,
      details: [],
      body: null,
      status: 0,
      ok: false,
      networkError: true,
    };
  }

  const parsed = await readJsonBody(res);
  if (res.ok) {
    return {
      data: parsed as T | null,
      error: null,
      details: [],
      body: parsed,
      status: res.status,
      ok: true,
      networkError: false,
    };
  }
  return {
    data: null,
    error: extractError(parsed),
    details: extractDetails(parsed),
    body: parsed,
    status: res.status,
    ok: false,
    networkError: false,
  };
}

/**
 * JSON helpers for same-origin API routes. Request bodies are serialised with
 * `JSON.stringify` and sent with `Content-Type: application/json` unless the
 * caller's `init.headers` already sets one. `init.method` and `init.body` are
 * ignored in favour of the helper's own.
 */
export const apiClient = {
  /** Sends a GET request. */
  get: <T>(url: string, init?: RequestInit) =>
    request<T>("GET", url, undefined, init),
  /** Sends a POST request with an optional JSON body. */
  post: <T>(url: string, body?: unknown, init?: RequestInit) =>
    request<T>("POST", url, body, init),
  /** Sends a PUT request with an optional JSON body. */
  put: <T>(url: string, body?: unknown, init?: RequestInit) =>
    request<T>("PUT", url, body, init),
  /** Sends a PATCH request with an optional JSON body. */
  patch: <T>(url: string, body?: unknown, init?: RequestInit) =>
    request<T>("PATCH", url, body, init),
  /** Sends a DELETE request. */
  delete: <T>(url: string, init?: RequestInit) =>
    request<T>("DELETE", url, undefined, init),
};
