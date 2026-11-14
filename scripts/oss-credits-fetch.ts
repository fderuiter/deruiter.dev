/**
 * Registry access for `npm run oss:credits`.
 *
 * Package facts (homepage, repository, author) and license files come from the
 * registry, addressed by the URL and integrity hash in package-lock.json, never
 * from node_modules. The output then depends on the lockfile alone, so it is
 * identical on every platform, including for platform-specific optional
 * binaries that are not installed locally.
 */
import crypto from "node:crypto";
import { Readable } from "node:stream";
import zlib from "node:zlib";

export interface FetchedFile {
  name: string;
  text: string;
}

export interface FetchedTarball {
  licenseFiles: FetchedFile[];
  noticeFiles: FetchedFile[];
}

export interface VersionDocument {
  license?: unknown;
  homepage?: unknown;
  repository?: unknown;
  author?: unknown;
}

const LICENSE_FILE = /^(licen[sc]e|copying|unlicen[sc]e)(\.|$|-)/i;
const NOTICE_FILE = /^notice(\.|$)/i;
const REGISTRY_HOST = "registry.npmjs.org";
const MAX_FILE_BYTES = 1024 * 1024;

/** Split `https://registry.npmjs.org/@scope/pkg/-/pkg-1.0.0.tgz` into name and version. */
export function parseResolvedUrl(
  resolved: string
): { name: string; version: string } | null {
  let url: URL;
  try {
    url = new URL(resolved);
  } catch {
    return null;
  }
  if (url.hostname !== REGISTRY_HOST) return null;
  const marker = "/-/";
  const index = url.pathname.indexOf(marker);
  if (index === -1) return null;
  const name = decodeURIComponent(url.pathname.slice(1, index));
  const file = url.pathname.slice(index + marker.length).replace(/\.tgz$/, "");
  const basename = name.startsWith("@") ? name.split("/")[1] : name;
  if (!file.startsWith(`${basename}-`)) return null;
  return { name, version: file.slice(basename.length + 1) };
}

/**
 * Pick top-level license and notice files out of a tar stream held in memory
 * chunk by chunk. Only entries directly inside the single root directory are read; every
 * other entry is skipped without being buffered, so a large native binary
 * costs only the time to stream past it.
 */
export class TarPicker {
  private buffer: Buffer = Buffer.alloc(0);
  private remaining = 0;
  private padding = 0;
  private current: { name: string; chunks: Buffer[]; size: number } | null =
    null;
  private skipping = false;
  private ended = false;
  readonly licenseFiles: FetchedFile[] = [];
  readonly noticeFiles: FetchedFile[] = [];

  push(chunk: Buffer): void {
    this.buffer = this.buffer.length
      ? Buffer.concat([this.buffer, chunk])
      : chunk;
    while (this.step()) {
      /* consume as much as is available */
    }
  }

  private step(): boolean {
    if (this.ended) {
      this.buffer = Buffer.alloc(0);
      return false;
    }
    if (this.remaining > 0 || this.skipping) {
      const take = Math.min(this.remaining, this.buffer.length);
      if (take === 0 && this.remaining > 0) return false;
      const part = this.buffer.subarray(0, take);
      if (this.current) this.current.chunks.push(Buffer.from(part));
      this.buffer = this.buffer.subarray(take);
      this.remaining -= take;
      if (this.remaining > 0) return false;
      this.finishEntry();
      return true;
    }
    if (this.padding > 0) {
      const take = Math.min(this.padding, this.buffer.length);
      this.buffer = this.buffer.subarray(take);
      this.padding -= take;
      if (this.padding > 0) return false;
      return true;
    }
    if (this.buffer.length < 512) return false;
    const header = this.buffer.subarray(0, 512);
    this.buffer = this.buffer.subarray(512);
    if (header.every((byte) => byte === 0)) {
      this.ended = true;
      return false;
    }
    const rawName = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "");
    const fullName = prefix ? `${prefix}/${rawName}` : rawName;
    const size = parseInt(
      header.toString("ascii", 124, 136).replace(/\0.*$/, "").trim() || "0",
      8
    );
    const type = String.fromCharCode(header[156] || 48);
    this.padding = (512 - (size % 512)) % 512;
    this.remaining = size;
    const match = /^(?:\.\/)?[^/]+\/([^/]+)$/.exec(fullName);
    const isFile = type === "0" || type === "\0";
    const wanted =
      isFile &&
      match !== null &&
      (LICENSE_FILE.test(match[1]) || NOTICE_FILE.test(match[1])) &&
      size > 0 &&
      size <= MAX_FILE_BYTES;
    this.current = wanted ? { name: match![1], chunks: [], size } : null;
    this.skipping = !wanted;
    if (size === 0) this.finishEntry();
    return true;
  }

  private finishEntry(): void {
    if (this.current) {
      const text = Buffer.concat(this.current.chunks).toString("utf8");
      const file = { name: this.current.name, text };
      if (LICENSE_FILE.test(file.name)) this.licenseFiles.push(file);
      else this.noticeFiles.push(file);
    }
    this.current = null;
    this.skipping = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error(
    `${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/** One npm name segment: a scope or a bare package name, never `.` or `..`. */
const NPM_NAME_SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9._~-]+$/;
/** A semver version, including prerelease and build metadata. */
const NPM_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;

/**
 * Build the registry URL of one version document, such as
 * `https://registry.npmjs.org/@scope%2Fpkg/1.0.0`.
 *
 * The name and version come from the lockfile, so they are checked against
 * the forms npm publishes and each path segment is percent-encoded. A `/`,
 * `?`, `#` or `%` can then never add a path segment, a query or a fragment
 * (CodeQL alert 12). Anything else throws.
 */
export function versionDocumentUrl(name: string, version: string): string {
  const scoped = /^@([^/]+)\/([^/]+)$/.exec(name);
  const segments = scoped ? [scoped[1], scoped[2]] : [name];
  if (!segments.every((segment) => NPM_NAME_SEGMENT.test(segment))) {
    throw new Error(`not an npm package name: ${JSON.stringify(name)}`);
  }
  if (!NPM_VERSION.test(version)) {
    throw new Error(`not an npm version: ${JSON.stringify(version)}`);
  }
  const encodedName = scoped
    ? `@${encodeURIComponent(segments[0])}%2F${encodeURIComponent(segments[1])}`
    : encodeURIComponent(name);
  return `https://${REGISTRY_HOST}/${encodedName}/${encodeURIComponent(version)}`;
}

export async function fetchVersionDocument(
  name: string,
  version: string
): Promise<VersionDocument> {
  const url = versionDocumentUrl(name, version);
  return withRetry(url, async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as VersionDocument;
  });
}

/**
 * Download one tarball, verify it against the lockfile integrity hash and
 * return its license and notice files. A hash mismatch is an error: the lockfile
 * says exactly which bytes this package is.
 */
export async function fetchTarball(
  resolved: string,
  integrity: string
): Promise<FetchedTarball> {
  const [algorithm, expected] = integrity.split("-", 2);
  const digest = integrity.slice(algorithm.length + 1);
  if (!expected || !["sha512", "sha1", "sha256"].includes(algorithm)) {
    throw new Error(`unsupported integrity ${integrity}`);
  }
  return withRetry(resolved, async () => {
    const response = await fetch(resolved);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }
    const hash = crypto.createHash(algorithm);
    const gunzip = zlib.createGunzip();
    const picker = new TarPicker();
    gunzip.on("data", (chunk: Buffer) => picker.push(chunk));
    const done = new Promise<void>((resolve, reject) => {
      gunzip.on("end", resolve);
      gunzip.on("error", reject);
    });
    const source = Readable.fromWeb(
      response.body as import("node:stream/web").ReadableStream
    );
    for await (const chunk of source) {
      hash.update(chunk as Buffer);
      gunzip.write(chunk as Buffer);
    }
    gunzip.end();
    await done;
    if (hash.digest("base64") !== digest) {
      throw new Error("integrity mismatch against package-lock.json");
    }
    return {
      licenseFiles: picker.licenseFiles,
      noticeFiles: picker.noticeFiles,
    };
  });
}

/** Run `task` over `items` with bounded concurrency, preserving input order in the result. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await task(items[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
