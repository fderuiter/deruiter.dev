import { SECRET_DETECTORS } from "./catalog";
import type { SecretDetectorFixtureSet } from "../types";

/**
 * Safe, non-functional positive and negative fixtures for every detector.
 *
 * Positive fixtures are structurally shaped like the secret they exercise
 * but are invented filler (sequential alphabet/number runs) that never
 * authenticated against any real system. Negative fixtures are near-misses
 * (too short, wrong prefix) or legitimately safe examples (a publishable
 * key, a localhost connection string) that a detector must not flag.
 *
 * This file is registered as a known-safe source in `internal/allowlist.ts`
 * (keyed by its own repo-relative path) so the positive fixtures below do
 * not trip the very detectors they exist to exercise when this file itself
 * is scanned.
 */
export const SECRET_DETECTOR_FIXTURES: Record<
  (typeof SECRET_DETECTORS)[number]["id"],
  SecretDetectorFixtureSet
> = {
  "database-url-credentialed": {
    positive: [
      "postgresql://fixture_user:fixture_pw9@db.fixture.internal:5432/app",
      "mongodb+srv://fixture_user:fixture_pw9@cluster0.fixture.mongodb.net/app",
      "postgres://fixture_user:fixture_pw9@ep-fixture-lake-000000.us-east-2.aws.neon.tech/neondb?sslmode=require",
      "rediss://default:fixture_pw9@fixture-cache.upstash.io:6379",
    ],
    negative: [
      "postgresql://db.fixture.internal:5432/app",
      "postgresql://postgres:postgres@localhost:5432/portfolio_ci",
    ],
  },
  "database-url-bare": {
    positive: [
      "postgresql://db.fixture.internal:5432/app",
      "mongodb+srv://cluster0.fixture.mongodb.net/app",
    ],
    negative: ["See the postgres docs for connection pooling."],
  },
  "generic-assigned-secret": {
    positive: [
      'api_key = "fixtureAssignedSecretValue1"',
      'password: "another-fixture-secret-value"',
    ],
    negative: [
      'const shortKey = "abc"',
      "plain text about api key rotation policy",
    ],
  },
  "aws-access-key": {
    positive: ["AKIAABCDEFGHIJKLMNOP", "ASIAABCDEFGHIJKLMNOP"],
    negative: ["AKIA12345", "ASIAN market analysis"],
  },
  "github-token": {
    positive: [
      "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ01234",
      "github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ01234",
    ],
    negative: ["ghz_ABCDEFGHIJKLMNOPQRSTUVWXYZ01234", "ghp_short"],
  },
  "private-key-pem": {
    positive: ["-----BEGIN RSA PRIVATE KEY-----"],
    negative: ["-----BEGIN CERTIFICATE-----"],
  },
  "stripe-or-clerk-secret-key": {
    positive: [
      "sk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      "sk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
    ],
    negative: ["pk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345", "sk_test_short"],
  },
  "openai-project-key": {
    positive: ["sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
    negative: ["sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
  },
  "resend-api-key": {
    positive: ["re_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
    negative: ["re_short", "requiem for a fallen token"],
  },
  "vercel-token": {
    positive: [
      "vcp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      "vercel_blob_rw_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
    ],
    negative: [
      "vcp_short",
      "BLOB_READ_WRITE_TOKEN is unset in this environment",
    ],
  },
  "npm-token": {
    positive: ["npm_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
    negative: ["npm_short", "npm install completed successfully"],
  },
  "gitlab-token": {
    positive: ["glpat-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
    negative: ["glpat-short"],
  },
  "slack-token": {
    positive: ["xoxb-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
    negative: ["xoxz-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
  },
  "sentry-auth-token": {
    positive: [
      "sntrys_ABCDEFGHIJKLMNOPQRSTUVWX",
      "sntryu_ABCDEFGHIJKLMNOPQRSTUVWX",
    ],
    negative: ["sntryx_ABCDEFGHIJKLMNOPQRSTUVWX"],
  },
  "upstash-rest-token": {
    positive: [
      'UPSTASH_REDIS_REST_TOKEN="fixtureUpstashRestTokenValue123"',
      "UPSTASH_CUSTOM_TOKEN = fixtureUpstashRestTokenValue123",
    ],
    negative: [
      'UPSTASH_REDIS_REST_URL="http://localhost:8079"',
      "UPSTASH_REDIS_REST_TOKEN=short",
    ],
  },
  "neon-role-password": {
    positive: ["PGPASSWORD=npg_FixtureOnly0000", "npg_AbCdEfGh1234"],
    negative: ["npg_short", "Npgsql connection pooling"],
  },
  "anthropic-api-key": {
    positive: [
      "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
      "sk-ant-admin01-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
    ],
    negative: ["sk-ant-short", "sk-inc-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
  },
  "google-api-key": {
    positive: [
      "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456",
      "AIzaZaABCDEFGHIJKLMNOPQRSTUVWXYZ0123456",
    ],
    negative: ["AIzaSyShort", "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
  },
};
