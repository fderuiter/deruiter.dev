/**
 * Centralized browser file download helper.
 *
 * Replaces the ad-hoc "Blob, object URL, temporary anchor, click" sequence
 * that export features used to copy-paste. The helper attaches the anchor to
 * the document before clicking (Firefox ignores clicks on detached anchors),
 * always detaches it again, and defers object URL revocation so the browser
 * can finish reading the Blob before it is released.
 */

/** Delay before an object URL is revoked after the download click, in milliseconds. */
export const DEFAULT_REVOKE_DELAY_MS = 1000;

/** Payloads accepted by {@link downloadFile}. */
export type DownloadData =
  Blob | string | ArrayBuffer | ArrayBufferView<ArrayBuffer>;

/** Options for {@link downloadFile}. */
export interface DownloadFileOptions {
  /**
   * MIME type of the downloaded file. Defaults to the Blob's own type, to
   * `text/plain;charset=utf-8` for strings, and to `application/octet-stream`
   * for binary buffers. When set on a Blob whose type differs, the Blob is
   * re-wrapped with this type.
   */
  mimeType?: string;
  /**
   * Milliseconds to wait after the click before revoking the object URL.
   * Defaults to {@link DEFAULT_REVOKE_DELAY_MS}. Zero revokes synchronously;
   * negative or non-finite values fall back to the default.
   */
  revokeDelayMs?: number;
}

function toBlob(data: DownloadData, mimeType: string | undefined): Blob {
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    if (mimeType === undefined || data.type === mimeType) return data;
    return new Blob([data], { type: mimeType });
  }
  const fallbackType =
    typeof data === "string"
      ? "text/plain;charset=utf-8"
      : "application/octet-stream";
  return new Blob([data], { type: mimeType ?? fallbackType });
}

function resolveRevokeDelay(revokeDelayMs: number | undefined): number {
  if (
    revokeDelayMs === undefined ||
    !Number.isFinite(revokeDelayMs) ||
    revokeDelayMs < 0
  ) {
    return DEFAULT_REVOKE_DELAY_MS;
  }
  return revokeDelayMs;
}

function scheduleRevoke(url: string, delayMs: number): void {
  const revoke = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Revocation is best-effort; a failure only delays garbage collection.
    }
  };
  if (delayMs === 0 || typeof setTimeout !== "function") {
    revoke();
    return;
  }
  setTimeout(revoke, delayMs);
}

/**
 * Whether the current runtime can trigger a browser file download: a DOM is
 * present and `URL.createObjectURL` is implemented. False during SSR and in
 * test environments such as JSDOM that do not implement object URLs.
 */
export function canDownloadFiles(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.createElement === "function" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    typeof URL.revokeObjectURL === "function"
  );
}

/**
 * Saves data to the user's device as a file named `filename`.
 *
 * The temporary anchor is attached to the document before the click and
 * detached afterwards, even when the click throws. The object URL is revoked
 * after `revokeDelayMs` rather than synchronously, so the download is not
 * aborted in engines that resolve the URL asynchronously.
 *
 * @param data - File contents: a Blob, a string, or a binary buffer.
 * @param filename - Suggested file name for the download.
 * @param options - Optional MIME type and revocation delay.
 * @returns True when the download was triggered; false when the runtime cannot download files (for example during SSR).
 */
export function downloadFile(
  data: DownloadData,
  filename: string,
  options: DownloadFileOptions = {}
): boolean {
  if (!canDownloadFiles()) return false;

  const blob = toBlob(data, options.mimeType);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  const host = document.body ?? document.documentElement;
  try {
    host.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    scheduleRevoke(url, resolveRevokeDelay(options.revokeDelayMs));
  }
  return true;
}
