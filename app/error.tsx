"use client";

import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/client-sentry";
import { resolveBaseUrl } from "@/lib/domain";
import { logger } from "@/lib/logger";

/* jscpd:ignore-start */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [canonicalUrl, setCanonicalUrl] = useState<string>(
    `${resolveBaseUrl()}/`
  );

  useEffect(() => {
    // Capture the error in external observability system
    reportClientError(error);
    logger.error("Layout compile error:", error, { skipTelemetry: true });
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanonicalUrl(window.location.href);
    }
  }, [error]);

  return (
    <>
      <title>Something went wrong</title>
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href={canonicalUrl} />
      <div className="min-h-screen py-32 px-6 flex flex-col items-center justify-center bg-brand-dark text-foreground">
        <div className="relative z-10 w-full max-w-md p-8 bg-neutral-950/40 border border-neutral-900 rounded-3xl backdrop-blur-xl text-center shadow-2xl">
          <span className="inline-block px-3 py-1 text-xs font-mono font-bold bg-red-950/20 border border-red-900/40 text-red-400 rounded-md mb-6">
            RUNTIME_ERROR
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mb-4">
            This page hit a snag.
          </h1>

          <p className="text-sm text-neutral-400 leading-relaxed mb-8">
            Something went wrong while loading this page. Try again; if it keeps
            happening, please let me know.
          </p>

          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center w-full px-6 py-3 text-sm font-bold bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-brand-cyan/40 text-brand-cyan rounded-2xl transition-all duration-300 shadow-lg cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    </>
  );
/* jscpd:ignore-end */
}
