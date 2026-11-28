import type { SecretDetector } from "../types";

/**
 * The single source of truth for every secret detector in the repository.
 *
 * Each entry owns its identifier, human description, live-text regex, and a
 * POSIX-extended-regex `gitPattern` usable with `git log -G<pattern>` for
 * history/pickaxe scanning. `appliesTo` declares which scanning surfaces
 * (`ScannerSurface`, see `types.ts`) the detector is confident enough to
 * run under.
 *
 * Order matters for `contentGuard`-surface scanning: `scanText` reports the
 * first detector that matches a given line, so detectors most likely to
 * co-occur with a broader/noisier detector on the same line are listed
 * first. New detectors are appended to preserve that ordering.
 */
export const SECRET_DETECTORS = [
  {
    id: "database-url-credentialed",
    description:
      "Database or cache connection URL with an embedded username and password (Postgres/Neon, MySQL, MongoDB incl. mongodb+srv, Redis/Upstash rediss)",
    regex:
      /(?:postgres|postgresql|mongodb(?:\+srv)?|redis|rediss|mysql):\/\/[^\s/:]+:[^\s@]+@[^\s"'`<>]+/gi,
    gitPattern:
      "(postgres|postgresql|mongodb(\\+srv)?|redis|rediss|mysql)://[^[:space:]/:]+:[^[:space:]@]+@",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "database-url-bare",
    description:
      "Database or cache connection URL scheme/host without embedded credentials",
    regex:
      /(?:postgres|postgresql|mongodb(?:\+srv)?|redis|rediss|mysql):\/\/[^\s/]+/gi,
    gitPattern:
      "(postgres|postgresql|mongodb(\\+srv)?|redis|rediss|mysql)://[^[:space:]/]+",
    appliesTo: ["contentGuard"],
  },
  {
    id: "generic-assigned-secret",
    description: "Generic API Key/Secret/Password",
    regex:
      /(?:api[_-]?key|secret[_-]?key|private[_-]?key|password|auth[_-]?token|access[_-]?token|session[_-]?token)\s*[:=]\s*['"`][a-zA-Z0-9_.-]{16,}['"`]/gi,
    gitPattern:
      "(api[_-]?key|secret[_-]?key|private[_-]?key|password|auth[_-]?token|access[_-]?token|session[_-]?token)[[:space:]]*[:=][[:space:]]*['\"`][a-zA-Z0-9_.-]{16,}['\"`]",
    appliesTo: ["contentGuard"],
  },
  {
    id: "aws-access-key",
    description: "AWS access key ID (long-term AKIA or temporary/session ASIA)",
    regex: /(?:AKIA|ASIA)[0-9A-Z]{16}/gi,
    gitPattern: "(AKIA|ASIA)[0-9A-Z]{16}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "github-token",
    description:
      "GitHub token (classic ghp_, fine-grained github_pat_, or app-issued gho_/ghu_/ghs_/ghr_)",
    regex: /(?:github_pat_[A-Za-z0-9_]{20,}|gh[oprsu]_[A-Za-z0-9]{20,})/gi,
    gitPattern: "(github_pat_[A-Za-z0-9_]{20,}|gh[oprsu]_[A-Za-z0-9]{20,})",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "private-key-pem",
    description: "PEM-encoded private key block",
    regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/gi,
    gitPattern: "BEGIN [A-Z ]+ PRIVATE KEY",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "stripe-or-clerk-secret-key",
    description:
      "Stripe or Clerk secret key (sk_live_/sk_test_ — both providers share this prefix shape)",
    regex: /sk_(?:live|test)_[A-Za-z0-9_]{16,}/g,
    gitPattern: "sk_(live|test)_[A-Za-z0-9_]{16,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "openai-project-key",
    description: "OpenAI project-scoped API key",
    regex: /sk-proj-[A-Za-z0-9_-]{16,}/g,
    gitPattern: "sk-proj-[A-Za-z0-9_-]{16,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "resend-api-key",
    description: "Resend API key",
    regex: /re_[A-Za-z0-9_]{20,}/g,
    gitPattern: "re_[A-Za-z0-9_]{20,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "vercel-token",
    description:
      "Vercel platform token (CLI/API access token or Blob read-write token)",
    regex: /(?:vcp_[A-Za-z0-9_]{20,}|vercel_blob_rw_[A-Za-z0-9_]{20,})/g,
    gitPattern: "(vcp_[A-Za-z0-9_]{20,}|vercel_blob_rw_[A-Za-z0-9_]{20,})",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "npm-token",
    description: "npm registry access token",
    regex: /npm_[A-Za-z0-9]{20,}/g,
    gitPattern: "npm_[A-Za-z0-9]{20,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "gitlab-token",
    description: "GitLab personal access token",
    regex: /glpat-[A-Za-z0-9_-]{20,}/g,
    gitPattern: "glpat-[A-Za-z0-9_-]{20,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "slack-token",
    description: "Slack bot/user/app/refresh token",
    regex: /xox[baprs]-[A-Za-z0-9-]{20,}/g,
    gitPattern: "xox[baprs]-[A-Za-z0-9-]{20,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "sentry-auth-token",
    description: "Sentry internal-integration or user auth token",
    regex: /sntry[us]_[A-Za-z0-9_]{10,}/g,
    gitPattern: "sntry[us]_[A-Za-z0-9_]{10,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "upstash-rest-token",
    description:
      "Upstash REST API token assigned to an UPSTASH_*TOKEN-named variable",
    regex:
      /UPSTASH_[A-Z0-9_]*TOKEN\s*[:=]\s*(?:['"`][A-Za-z0-9_-]{16,}['"`]|[A-Za-z0-9_-]{16,})/gi,
    gitPattern:
      "UPSTASH_[A-Z0-9_]*TOKEN[[:space:]]*[:=][[:space:]]*(['\"`][A-Za-z0-9_-]{16,}['\"`]|[A-Za-z0-9_-]{16,})",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "neon-role-password",
    description:
      "Neon Postgres role password (npg_ prefix), on its own rather than inside a connection URL",
    regex: /npg_[A-Za-z0-9]{12,}/g,
    gitPattern: "npg_[A-Za-z0-9]{12,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "anthropic-api-key",
    description: "Anthropic API key (sk-ant- prefix)",
    regex: /sk-ant-[A-Za-z0-9_-]{20,}/g,
    gitPattern: "sk-ant-[A-Za-z0-9_-]{20,}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
  {
    id: "google-api-key",
    description: "Google Cloud or Gemini API key (AIza prefix)",
    regex: /AIza[0-9A-Za-z_-]{35}/g,
    gitPattern: "AIza[0-9A-Za-z_-]{35}",
    appliesTo: ["contentGuard", "historyAudit"],
  },
] as const satisfies readonly SecretDetector[];
