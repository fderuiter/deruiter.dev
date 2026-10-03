#!/usr/bin/env bash
#
# Clerk authentication and admin allowlist setup (`npm run setup:clerk`).
#
# The Clerk dashboard steps, key formats, admin allowlist and optional
# GitHub or Vercel publishing now live in the Clerk adapter of the shared
# setup framework (lib/dx/setup/providers/catalog.ts), so they have one
# source of truth. This script runs that adapter on its own: it skips the
# database stage and accepts any other setup flag, e.g.
#
#   npm run setup:clerk -- --publish vercel --publish-env preview

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/setup.sh" --integrations clerk --skip-db ${1+"$@"}
