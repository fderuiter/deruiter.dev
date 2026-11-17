export type RequestOrHeaders =
  | Request
  | Headers
  | { headers: Headers | { get(name: string): string | null }; ip?: string }
  | { ip?: string }
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

const IPV4_REGEX =
  /^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;

const IPV6_REGEX =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])[0-9]))$/;

/**
 * Validates whether the given string is a syntactically valid IPv4 or IPv6 address.
 * Works across both Node and Edge runtimes.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const net = require("net");
    if (typeof net?.isIP === "function") {
      return net.isIP(ip) !== 0;
    }
  } catch {
    // Edge runtime fallback
  }
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

/**
 * Sanitizes and validates an IP candidate string.
 * Strips whitespace, unwraps IPv6 brackets and ports, strips IPv4 ports,
 * and validates that the result is a valid IPv4 or IPv6 address.
 * Returns null if the candidate is invalid.
 */
export function sanitizeIp(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;

  let candidate = raw.trim();

  // Strip IPv6 bracket notation, e.g. [2001:db8::1] or [2001:db8::1]:8080
  const bracketMatch = candidate.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
  if (bracketMatch) {
    candidate = bracketMatch[1];
  } else {
    // Strip port from IPv4 if present, e.g. 192.0.2.1:8080
    const ipv4PortMatch = candidate.match(
      /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/
    );
    if (ipv4PortMatch) {
      candidate = ipv4PortMatch[1];
    }
  }

  if (isValidIp(candidate)) {
    return candidate;
  }

  return null;
}

/**
 * Centralized primary proxy IP extraction routine.
 * Extracts verified client IP address from runtime properties and proxy headers
 * without logging or retaining raw IP.
 * Supports HTTP request objects, Headers instances, and header maps.
 */
export function extractClientIp(reqOrHeaders?: RequestOrHeaders): string {
  if (!reqOrHeaders) return "127.0.0.1";

  // 1. Evaluate req.ip if provided directly by Next.js runtime
  if (typeof reqOrHeaders === "object" && "ip" in reqOrHeaders) {
    const directIp = (reqOrHeaders as { ip?: unknown }).ip;
    if (typeof directIp === "string") {
      const sanitized = sanitizeIp(directIp);
      if (sanitized) return sanitized;
    }
  }

  // 2. Platform-specific verified headers (e.g. Vercel edge, Cloudflare)
  const platformHeaders = ["x-vercel-forwarded-for", "cf-connecting-ip"];
  for (const header of platformHeaders) {
    const rawPlatform = extractHeaderValue(reqOrHeaders, header);
    if (rawPlatform) {
      const tokens = rawPlatform.split(",");
      for (let i = tokens.length - 1; i >= 0; i--) {
        const sanitized = sanitizeIp(tokens[i]);
        if (sanitized) return sanitized;
      }
    }
  }

  // 3. Trusted upstream proxy IP from x-forwarded-for chain
  const rawXff = extractHeaderValue(reqOrHeaders, "x-forwarded-for");
  if (rawXff) {
    const tokens = rawXff.split(",");
    for (let i = tokens.length - 1; i >= 0; i--) {
      const sanitized = sanitizeIp(tokens[i]);
      if (sanitized) return sanitized;
    }
  }

  // 4. Fallback to x-real-ip
  const realIp = extractHeaderValue(reqOrHeaders, "x-real-ip");
  if (realIp) {
    const sanitized = sanitizeIp(realIp);
    if (sanitized) return sanitized;
  }

  return "127.0.0.1";
}

/**
 * The anonymous SHA-256 connection hash for a request: the client IP and user
 * agent, hashed, so rate limits and reaction de-duplication key on a client
 * without storing its address. Every API handler computes it here (#3205).
 * An `x-connection-hash` request header is ignored: the proxy no longer runs
 * on public API routes to overwrite it, so a client could otherwise choose
 * its own rate-limit bucket.
 */
export async function getConnectionHashFromRequest(
  reqOrHeaders?: RequestOrHeaders
): Promise<string> {
  const userAgent = extractHeaderValue(reqOrHeaders, "user-agent") || "";
  const ip = extractClientIp(reqOrHeaders);
  return generateClientConnectionHash(`${ip}:${userAgent}`);
}
