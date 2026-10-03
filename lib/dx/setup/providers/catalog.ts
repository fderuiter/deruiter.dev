import type { ProbeContext, ProbeResult, ProviderAdapter } from "./types";

const INTEGRATIONS_GUIDE = "docs/how-to/configure-integrations.md";

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function parseUrl(value: string | undefined): URL | null {
  if (isBlank(value)) return null;
  try {
    return new URL(value as string);
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Shared offline check: `configured` when every required key has a value,
 * `not-checked` when none do, `failed` with the missing names otherwise.
 * `shape` runs only once everything required is present.
 */
function checkKeys(
  adapter: Pick<ProviderAdapter, "keys">,
  values: Readonly<Record<string, string>>,
  shape?: () => string | null
): ProbeResult {
  const required = adapter.keys.filter((key) => key.required);
  const missing = required
    .filter((key) => isBlank(values[key.name]))
    .map((key) => key.name);
  if (missing.length === required.length && required.length > 0) {
    return { status: "not-checked", detail: "Not configured." };
  }
  if (missing.length > 0) {
    return { status: "failed", detail: `Missing ${missing.join(", ")}.` };
  }
  const problem = shape?.() ?? null;
  if (problem) return { status: "failed", detail: problem };
  return {
    status: shape ? "schema-valid" : "configured",
    detail: shape ? "Values have the expected shape." : "Values are present.",
  };
}

/**
 * Runs one read-only GET and maps the HTTP status to a probe result. Only
 * the status code is reported, never a response body.
 */
async function httpProbe(
  context: ProbeContext,
  url: string,
  headers: Record<string, string>,
  accept: (status: number, body: string) => ProbeResult | null
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), context.timeoutMs);
  try {
    const response = await context.fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const body = await response.text().catch(() => "");
    const mapped = accept(response.status, body);
    if (mapped) return mapped;
    return {
      status: "failed",
      detail: `Provider answered HTTP ${response.status}.`,
    };
  } catch (error) {
    const aborted = (error as Error).name === "AbortError";
    return {
      status: "failed",
      detail: aborted
        ? `No answer within ${context.timeoutMs} ms.`
        : "Could not reach the provider.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function postgresShape(value: string | undefined): string | null {
  const url = parseUrl(value);
  if (!url || !["postgres:", "postgresql:"].includes(url.protocol)) {
    return "is not a postgres:// connection string";
  }
  return null;
}

const postgres: ProviderAdapter = {
  id: "postgres",
  name: "PostgreSQL (Neon recommended)",
  capability: "database",
  portability: {
    portable: false,
    note: "Prisma schema and migration commands work with any PostgreSQL server. The application and the seed script connect through @prisma/adapter-neon, which speaks Neon's WebSocket protocol, so a non-Neon server also needs a Neon-compatible WebSocket proxy before pages and seeding can read it.",
  },
  keys: [
    {
      name: "DATABASE_URL",
      required: true,
      hint: "pooled postgresql:// connection string",
    },
    {
      name: "DATABASE_URL_UNPOOLED",
      required: true,
      hint: "direct connection string used for migrations",
    },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "Create a free Neon project at https://console.neon.tech and a development branch (never point setup at the production branch).",
    "Open Connection Details, choose Prisma, and copy the pooled connection string.",
    "Turn off connection pooling in the same panel and copy the direct connection string.",
  ],
  manualPath:
    "Paste any postgresql:// URL. For a local server, use the same URL for both keys and run a Neon-compatible WebSocket proxy if you want the app itself (not just Prisma) to read it.",
  docs: "DATABASE_MIGRATIONS.md",
  degraded:
    "Without a database, pages serve their static fallback content and writes (contact form, admin) are unavailable.",
  validate(values) {
    return checkKeys(this, values, () => {
      for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
        const problem = postgresShape(values[key]);
        if (problem) return `${key} ${problem}.`;
      }
      return null;
    });
  },
};

const upstashRedis: ProviderAdapter = {
  id: "upstash-redis",
  name: "Upstash Redis",
  capability: "cache",
  portability: {
    portable: true,
    note: "Any service that implements the Upstash Redis REST protocol works, for example a self-hosted serverless-redis-http proxy in front of Redis.",
  },
  keys: [
    {
      name: "UPSTASH_REDIS_REST_URL",
      required: true,
      hint: "https:// REST URL",
    },
    { name: "UPSTASH_REDIS_REST_TOKEN", required: true, hint: "REST token" },
    {
      name: "UPSTASH_REDIS_KEY_PREFIX",
      required: false,
      hint: "optional key namespace, e.g. dev:",
    },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "Create a free Redis database at https://console.upstash.com.",
    "Open the database's REST API section and copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
  ],
  manualPath:
    "Enter the URL and token of any Upstash-REST-compatible endpoint. Plain http:// is accepted only for a localhost proxy.",
  docs: `${INTEGRATIONS_GUIDE}#upstash-redis`,
  degraded:
    "Rate limiting falls back to an in-memory window and the read-through cache is bypassed, so every read goes to Postgres.",
  validate(values) {
    return checkKeys(this, values, () => {
      const url = parseUrl(values.UPSTASH_REDIS_REST_URL);
      if (!url) return "UPSTASH_REDIS_REST_URL is not a URL.";
      if (url.protocol !== "https:" && !LOCAL_HOSTS.has(url.hostname)) {
        return "UPSTASH_REDIS_REST_URL must use https:// unless it points at localhost.";
      }
      return null;
    });
  },
  probe(context) {
    const base = (context.values.UPSTASH_REDIS_REST_URL ?? "").replace(
      /\/$/,
      ""
    );
    return httpProbe(
      context,
      `${base}/ping`,
      { Authorization: `Bearer ${context.values.UPSTASH_REDIS_REST_TOKEN}` },
      (status, body) =>
        status === 200 && body.includes("PONG")
          ? { status: "live-verified", detail: "PING answered PONG." }
          : null
    );
  },
};

const upstashQstash: ProviderAdapter = {
  id: "upstash-qstash",
  name: "Upstash QStash",
  capability: "queue",
  portability: {
    portable: false,
    note: "QStash's signed-delivery protocol is Upstash-specific.",
  },
  keys: [
    { name: "QSTASH_URL", required: true, hint: "https://qstash.upstash.io" },
    { name: "QSTASH_TOKEN", required: true },
    { name: "QSTASH_CURRENT_SIGNING_KEY", required: true },
    { name: "QSTASH_NEXT_SIGNING_KEY", required: true },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "Open https://console.upstash.com/qstash and copy the token and both signing keys.",
  ],
  manualPath: "Enter the QStash URL, token and signing keys by hand.",
  docs: "docs/reference/integrations-catalog.md",
  degraded:
    "Sub-daily email retries wait for the daily maintenance cron instead of a QStash callback.",
  validate(values) {
    return checkKeys(this, values, () =>
      parseUrl(values.QSTASH_URL)?.protocol === "https:"
        ? null
        : "QSTASH_URL must be an https:// URL."
    );
  },
};

const clerk: ProviderAdapter = {
  id: "clerk",
  name: "Clerk",
  capability: "authentication",
  portability: {
    portable: false,
    note: "The admin area is built on Clerk's SDK and session tokens; there is no drop-in substitute.",
  },
  keys: [
    {
      name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      required: true,
      hint: "starts with pk_test_ or pk_live_",
    },
    {
      name: "CLERK_SECRET_KEY",
      required: true,
      hint: "starts with sk_test_ or sk_live_",
    },
    {
      name: "ADMIN_EMAILS",
      required: false,
      hint: "comma-separated admin emails",
    },
    {
      name: "ADMIN_USER_IDS",
      required: false,
      hint: "comma-separated Clerk user IDs (user_...)",
    },
  ],
  destinations: ["github", "vercel"],
  guidedSteps: [
    "API keys: open https://dashboard.clerk.com/last-active?path=api-keys and copy the Publishable key and the Secret key.",
    "Paths: open https://dashboard.clerk.com/last-active?path=paths, set the Sign-in URL to /admin/login and the After sign-in URL to /admin.",
    "Restrictions: under Configure, User & Authentication, Restrictions, turn off public sign-ups so only authorized authors can create accounts.",
    "Allowlist: open https://dashboard.clerk.com/last-active?path=users and copy your primary email and your user ID (user_...).",
    "Afterwards run npm run dev, sign in at http://localhost:3000/admin/login and confirm you land on /admin.",
  ],
  manualPath:
    "Enter existing Clerk keys and the admin allowlist directly. Admin access stays closed until ADMIN_EMAILS or ADMIN_USER_IDS is set.",
  docs: `${INTEGRATIONS_GUIDE}#clerk-admin-authentication`,
  degraded:
    "The admin area denies everyone (the allowlist defaults closed); the public site is unaffected.",
  validate(values) {
    return checkKeys(this, values, () => {
      const pk = values.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      const sk = values.CLERK_SECRET_KEY;
      if (!/^pk_(test|live)_/.test(pk)) {
        return "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_.";
      }
      if (!/^sk_(test|live)_/.test(sk)) {
        return "CLERK_SECRET_KEY must start with sk_test_ or sk_live_.";
      }
      if (pk.slice(3, 7) !== sk.slice(3, 7)) {
        return "The publishable and secret keys come from different instances (test and live).";
      }
      return null;
    });
  },
  probe(context) {
    return httpProbe(
      context,
      "https://api.clerk.com/v1/jwks",
      { Authorization: `Bearer ${context.values.CLERK_SECRET_KEY}` },
      (status) =>
        status === 200
          ? {
              status: "live-verified",
              detail: "Clerk accepted the secret key.",
            }
          : null
    );
  },
};

const resend: ProviderAdapter = {
  id: "resend",
  name: "Resend",
  capability: "email",
  portability: {
    portable: false,
    note: "Sending and the webhook receiver use Resend's API and Svix-signed webhooks.",
  },
  keys: [
    { name: "RESEND_API_KEY", required: true, hint: "starts with re_" },
    {
      name: "RESEND_WEBHOOK_SECRET",
      required: false,
      hint: "starts with whsec_",
    },
    {
      name: "RESEND_FROM_EMAIL",
      required: false,
      hint: "Name <sender@your-domain>",
    },
    { name: "CONTACT_NOTIFICATION_EMAIL", required: false },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "Create an API key at https://resend.com/api-keys (sending access is enough for local work).",
    "Verify a sending domain at https://resend.com/domains before sending to anyone but yourself.",
  ],
  manualPath:
    "Enter an existing Resend API key and, optionally, the webhook signing secret.",
  docs: "docs/how-to/configure-resend-and-webhooks.md",
  degraded:
    "Email runs in simulated delivery mode: messages are logged in development and never sent.",
  validate(values) {
    return checkKeys(this, values, () => {
      if (!values.RESEND_API_KEY.startsWith("re_")) {
        return "RESEND_API_KEY must start with re_.";
      }
      const hook = values.RESEND_WEBHOOK_SECRET;
      if (!isBlank(hook) && !hook.startsWith("whsec_")) {
        return "RESEND_WEBHOOK_SECRET must start with whsec_.";
      }
      return null;
    });
  },
  probe(context) {
    return httpProbe(
      context,
      "https://api.resend.com/domains",
      { Authorization: `Bearer ${context.values.RESEND_API_KEY}` },
      (status, body) => {
        if (status === 200) {
          return {
            status: "live-verified",
            detail: "Resend accepted the API key.",
          };
        }
        if (status === 401 && /restricted/i.test(body)) {
          return {
            status: "configured",
            detail:
              "The key is sending-only, so it cannot be checked without sending an email.",
          };
        }
        return null;
      }
    );
  },
};

const sentry: ProviderAdapter = {
  id: "sentry",
  name: "Sentry",
  capability: "monitoring",
  portability: {
    portable: true,
    note: "Any service that accepts the Sentry SDK's DSN protocol works, for example self-hosted Sentry or GlitchTip.",
  },
  keys: [
    {
      name: "NEXT_PUBLIC_SENTRY_DSN",
      required: true,
      hint: "https://<key>@<host>/<project id>",
    },
    { name: "SENTRY_ORG", required: false },
    { name: "SENTRY_PROJECT", required: false },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "In Sentry, open Settings, Projects, your project, Client Keys (DSN) and copy the DSN.",
    "SENTRY_ORG and SENTRY_PROJECT are only needed for source-map upload in production builds.",
  ],
  manualPath: "Paste the DSN of any Sentry-protocol-compatible service.",
  docs: `${INTEGRATIONS_GUIDE}#sentry-error-monitoring`,
  degraded: "Errors go to a dummy DSN and are discarded; nothing is reported.",
  validate(values) {
    return checkKeys(this, values, () => {
      const dsn = parseUrl(values.NEXT_PUBLIC_SENTRY_DSN);
      if (
        !dsn ||
        dsn.protocol !== "https:" ||
        !dsn.username ||
        !/\/\d+$/.test(dsn.pathname)
      ) {
        return "NEXT_PUBLIC_SENTRY_DSN is not a Sentry DSN (https://<key>@<host>/<project id>).";
      }
      return null;
    });
  },
};

const vercel: ProviderAdapter = {
  id: "vercel",
  name: "Vercel (hosting and cron)",
  capability: "hosting",
  portability: {
    portable: false,
    note: "The daily cron schedule (vercel.json) and Analytics are Vercel features. Another Next.js host needs its own scheduler that calls /api/cron/maintenance with CRON_SECRET as a bearer token.",
  },
  keys: [
    { name: "CRON_SECRET", required: true, hint: "generated by setup" },
    {
      name: "NEXT_PUBLIC_APP_URL",
      required: false,
      hint: "http://localhost:3000 locally",
    },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "Setup generates CRON_SECRET locally. To use it in a deployment, publish it to Vercel below or add it under Project, Settings, Environment Variables.",
  ],
  manualPath: "Supply your own CRON_SECRET (at least 32 random characters).",
  docs: `${INTEGRATIONS_GUIDE}#vercel-hosting-cron-analytics-and-speed-insights`,
  degraded:
    "Without CRON_SECRET in a deployment, the maintenance route rejects every call, so telemetry and email retries stop draining.",
  validate(values) {
    return checkKeys(this, values, () =>
      (values.CRON_SECRET ?? "").length >= 32
        ? null
        : "CRON_SECRET should be at least 32 characters."
    );
  },
};

const github: ProviderAdapter = {
  id: "github",
  name: "GitHub REST API",
  capability: "source-control-api",
  portability: {
    portable: false,
    note: "Repository statistics come from GitHub's REST API.",
  },
  keys: [
    {
      name: "GITHUB_TOKEN",
      required: true,
      hint: "fine-grained token with read-only public repository access",
    },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "Create a fine-grained personal access token at https://github.com/settings/personal-access-tokens with read-only access to public repositories.",
  ],
  manualPath: "Paste any token that can read public repositories.",
  docs: `${INTEGRATIONS_GUIDE}#github-data-fetching`,
  degraded:
    "Requests are unauthenticated (60 per hour); when rate-limited the site shows simulated activity.",
  validate(values) {
    return checkKeys(this, values);
  },
  probe(context) {
    return httpProbe(
      context,
      "https://api.github.com/rate_limit",
      {
        Authorization: `Bearer ${context.values.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "deruiter-dev-setup",
      },
      (status) =>
        status === 200
          ? { status: "live-verified", detail: "GitHub accepted the token." }
          : null
    );
  },
};

const vercelBlob: ProviderAdapter = {
  id: "vercel-blob",
  name: "Vercel Blob",
  capability: "object-storage",
  portability: {
    portable: false,
    note: "Admin media uploads use the @vercel/blob SDK, which only talks to Vercel Blob.",
  },
  keys: [
    {
      name: "BLOB_READ_WRITE_TOKEN",
      required: true,
      hint: "starts with vercel_blob_rw_",
    },
  ],
  destinations: ["vercel"],
  guidedSteps: [
    "In Vercel, open Storage, create a Blob store, connect it to the project, and copy BLOB_READ_WRITE_TOKEN.",
  ],
  manualPath: "Paste an existing Blob read-write token.",
  docs: "docs/reference/integrations-catalog.md",
  degraded: "Admin media uploads are unavailable; everything else works.",
  validate(values) {
    return checkKeys(this, values, () =>
      values.BLOB_READ_WRITE_TOKEN.startsWith("vercel_blob_rw_")
        ? null
        : "BLOB_READ_WRITE_TOKEN must start with vercel_blob_rw_."
    );
  },
};

/**
 * Every integration the application reads through `lib/env.ts`, in the order
 * the wizard offers them. All are optional: core setup works with every one
 * skipped.
 */
export const PROVIDER_ADAPTERS: readonly ProviderAdapter[] = [
  postgres,
  upstashRedis,
  upstashQstash,
  clerk,
  resend,
  sentry,
  vercel,
  github,
  vercelBlob,
];

/** Looks up adapters by id; unknown ids are returned in `unknown`. */
export function resolveProviderAdapters(ids: readonly string[]): {
  adapters: ProviderAdapter[];
  unknown: string[];
} {
  const adapters: ProviderAdapter[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const adapter = PROVIDER_ADAPTERS.find((candidate) => candidate.id === id);
    if (adapter) adapters.push(adapter);
    else unknown.push(id);
  }
  return { adapters, unknown };
}
