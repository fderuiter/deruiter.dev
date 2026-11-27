/**
 * Pure, runtime-agnostic request IP extraction and SHA-256 connection hashing
 * primitives safe for Node, Edge, and client-shared utility graphs.
 * Never logs or persists raw IP addresses.
 */

export type RequestOrHeaders =
  | Request
  | Headers
  | { headers: Headers | { get(name: string): string | null } }
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

export interface PrivacyHashResult {
  hash: string;
}

/**
 * Safely extracts header value from request objects, Headers, or plain header maps.
 */
export function extractHeaderValue(
  reqOrHeaders: RequestOrHeaders,
  name: string
): string | null | undefined {
  if (!reqOrHeaders) return undefined;

  if (
    "headers" in reqOrHeaders &&
    reqOrHeaders.headers &&
    typeof reqOrHeaders.headers === "object" &&
    "get" in reqOrHeaders.headers &&
    typeof reqOrHeaders.headers.get === "function"
  ) {
    return reqOrHeaders.headers.get(name);
  }

  if ("get" in reqOrHeaders && typeof reqOrHeaders.get === "function") {
    return (reqOrHeaders as Headers).get(name);
  }

  if (typeof reqOrHeaders === "object") {
    const record = reqOrHeaders as Record<
      string,
      string | string[] | undefined
    >;
    const lower = name.toLowerCase();
    const val = record[lower] ?? record[name];
    if (Array.isArray(val)) return val[0];
    return val;
  }

  return undefined;
}

/**
 * Computes a privacy-preserving SHA-256 hash token from client IP / connection info
 * using standard Web Crypto APIs (crypto.subtle), safe for Edge and Node runtimes.
 * Never stores or logs plain-text IP addresses.
 */
export async function generateClientConnectionHash(
  ip: string
): Promise<string> {
  const normalizedIp = ip?.trim() || "127.0.0.1";
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedIp);
  const cryptoObj =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : undefined;
  if (cryptoObj?.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto");
  return nodeCrypto.createHash("sha256").update(normalizedIp).digest("hex");
}

/**
 * Synchronous SHA-256 connection hash helper using native platform crypto,
 * preserving legacy synchronous signatures without custom JS crypto logic.
 */
export function generateClientConnectionHashSync(input: string): string {
  const normalized = input?.trim() || "127.0.0.1";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto");
  return nodeCrypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Centralized primary proxy IP extraction routine.
 * Extracts client IP address from proxy headers without logging or retaining raw IP.
 * Supports HTTP request objects, Headers instances, and header maps.
 */
export function extractClientIp(reqOrHeaders?: RequestOrHeaders): string {
  if (!reqOrHeaders) return "127.0.0.1";

  const rawXff = extractHeaderValue(reqOrHeaders, "x-forwarded-for");
  if (rawXff) {
    const firstIp = rawXff.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = extractHeaderValue(reqOrHeaders, "x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return "127.0.0.1";
}

/**
 * Computes the anonymous SHA-256 connection hash for a request from client IP
 * and User-Agent without storing the raw address (#3205). Ignores any inbound
 * `x-connection-hash` header so clients cannot select their own rate-limit bucket.
 */
export async function getConnectionHashFromRequest(
  reqOrHeaders?: RequestOrHeaders
): Promise<string> {
  const userAgent = extractHeaderValue(reqOrHeaders, "user-agent") || "";
  const ip = extractClientIp(reqOrHeaders);
  return generateClientConnectionHash(`${ip}:${userAgent}`);
}
