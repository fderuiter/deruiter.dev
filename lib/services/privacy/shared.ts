/**
 * Shared pure primitives for the privacy domain slices.
 * Zero framework or Node built-in dependencies so browser, Edge, and Node
 * callers share identical SHA-256 connection hashing and header extraction.
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

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Pure FIPS 180-4 SHA-256 hex digest for synchronous and Web-Crypto-unavailable
 * environments without pulling Node built-in modules into client bundles.
 */
export function sha256HexSync(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const totalLen = ((bytes.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
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
 * Computes a privacy-preserving SHA-256 hash token from client IP or connection info
 * using standard Web Crypto APIs, safe for Edge, browser, and Node runtimes.
 */
export async function computeSha256Hash(
  input: string,
  subtle?: SubtleCrypto | null
): Promise<string> {
  const normalized = input?.trim() || "127.0.0.1";
  const resolvedSubtle =
    subtle !== undefined
      ? subtle
      : typeof globalThis !== "undefined" && globalThis.crypto?.subtle
        ? globalThis.crypto.subtle
        : null;

  if (resolvedSubtle) {
    const data = new TextEncoder().encode(normalized);
    const hashBuffer = await resolvedSubtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  return sha256HexSync(normalized);
}

/**
 * Synchronous SHA-256 connection hash helper.
 */
export function generateClientConnectionHashSync(input: string): string {
  const normalized = input?.trim() || "127.0.0.1";
  return sha256HexSync(normalized);
}

/**
 * Extracts client IP address from proxy headers without logging or retaining raw IP.
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
 * Computes a privacy-preserving SHA-256 hash token from client IP or connection info.
 */
export async function generateClientConnectionHash(
  ip: string
): Promise<string> {
  return computeSha256Hash(ip);
}

/**
 * Computes the anonymous SHA-256 connection hash for an incoming request from
 * its proxy IP and user-agent header.
 */
export async function getConnectionHashFromRequest(
  reqOrHeaders?: RequestOrHeaders
): Promise<string> {
  const userAgent = extractHeaderValue(reqOrHeaders, "user-agent") || "";
  const ip = extractClientIp(reqOrHeaders);
  return computeSha256Hash(`${ip}:${userAgent}`);
}
