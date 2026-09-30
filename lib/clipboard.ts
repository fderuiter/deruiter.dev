import { resolveBaseUrl } from "./domain";
import { logger } from "./logger";

/**
 * Centralized Clipboard Helper with Environment-Aware Base Origin
 */

/**
 * Dynamically resolves the active Vercel preview, production, or local host URL.
 * Safely executes in both browser and server-side (SSR) environments.
 */
export function getActiveHostUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  // Fallback for SSR or non-browser execution
  return resolveBaseUrl();
}

/**
 * Robust clipboard writing utility.
 * Attempts modern navigator.clipboard API before falling back to programmatic textarea selection.
 * Propagates errors cleanly to the caller.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error(
      "Clipboard copy is only supported in browser environments."
    );
  }

  // Attempt modern navigator.clipboard API first
  if (
    navigator &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      // A denied or unavailable clipboard is expected browser behavior, not a
      // defect, so it stays out of Sentry.
      logger.warn(
        "navigator.clipboard.writeText failed, attempting legacy fallback...",
        err,
        {
          skipTelemetry: true,
        }
      );
    }
  }

  // Fallback to programmatic document selection using textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Position off-screen and set opacity to 0
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error("Fallback document.execCommand('copy') returned false.");
    }
  } catch (err) {
    const originalMessage = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Clipboard copy failed in this environment: ${originalMessage}`
    );
  }
}
