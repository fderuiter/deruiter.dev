import { initClientSentry } from "@/lib/client-sentry";
import { logger } from "@/lib/logger";

export { initClientSentry };

export const clientSentryPromise =
  typeof window !== "undefined"
    ? initClientSentry().catch((err) => {
        logger.warn("Failed to initialize client Sentry:", err);
      })
    : Promise.resolve(null);

export async function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse"
) {
  try {
    const isReady = await initClientSentry();
    if (!isReady) return;

    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRouterTransitionStart(url, navigationType);
  } catch (err) {
    logger.warn("Failed to capture Sentry router transition:", err, {
      url,
      navigationType,
    });
  }
}
