import * as Sentry from "@sentry/nextjs";
import {
  isBenignClientNoise,
  isReportableEnvironment,
  resolveTracesSampleRate,
} from "@/lib/sentry-policy";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN || "https://dummy@o0.ingest.sentry.io/0",
  tracesSampleRate: resolveTracesSampleRate(),
  debug: false,
  beforeSend(event, hint) {
    if (!isReportableEnvironment()) {
      return null;
    }
    if (isBenignClientNoise(hint?.originalException)) {
      return null;
    }
    return event;
  },
});
