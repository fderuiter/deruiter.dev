"use client";

import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/client-sentry";
import { resolveBaseUrl } from "@/lib/domain";
import { logger } from "@/lib/logger";

/* jscpd:ignore-start */
export default function GlobalError({
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
    reportClientError(error);
    logger.error("Global uncaught crash boundary:", error, {
      skipTelemetry: true,
    });
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanonicalUrl(window.location.href);
    }
/* jscpd:ignore-end */
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <head>
        <title>CRITICAL_HALT - Unrecoverable Crash</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={canonicalUrl} />
      </head>
      <body className="min-h-full flex flex-col items-center justify-center bg-zinc-950 text-neutral-100 font-sans p-6">
        <div className="w-full max-w-md p-8 bg-neutral-900/40 border border-neutral-800 rounded-3xl text-center shadow-2xl backdrop-blur-xl">
          <span className="inline-block px-3 py-1 text-xs font-mono font-bold bg-red-950/20 border border-red-900/40 text-red-400 rounded-md mb-6">
            CRITICAL_HALT
          </span>

          <h1 className="text-2xl font-bold tracking-tight mb-4">
            Unrecoverable Crash
          </h1>

          <p className="text-sm text-neutral-400 leading-relaxed mb-8">
            The root layout rendering tree has failed to compile. The details of
            this crash have been reported to our automated observability system.
            A critical reset of all DOM and state variables is required.
          </p>

          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center w-full px-6 py-3 text-sm font-bold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-brand-cyan/40 text-brand-cyan rounded-2xl transition-all duration-300 shadow-lg cursor-pointer"
          >
            Reset Root Layout
          </button>
        </div>
      </body>
    </html>
  );
}
