# Bump Playwright

`@playwright/test` and the Playwright container image move together. CI runs
the browser suites inside `mcr.microsoft.com/playwright:vX-noble`, pinned by
digest, and `__tests__/ci-toolchain-pinning.test.ts` fails when an image tag
differs from the locked `@playwright/test` version. A Dependabot bump of
either one fails until you make the other match.

## Steps

1. Bump the package on a branch cut from `main`:

   ```bash
   npm install --save-dev --save-exact @playwright/test@<version>
   ```

   On a Dependabot PR, check out its branch instead. The lockfile already
   carries the new version.

2. Get the digest of the multi-platform image index for the new tag:

   ```bash
   curl -sSI \
     -H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json" \
     https://mcr.microsoft.com/v2/playwright/manifests/v<version>-noble \
     | grep -i docker-content-digest
   ```

   Pin the index digest, not one platform's manifest. Microsoft re-pushes
   tags for base-image updates, so the same tag can return a newer digest
   later. An older pin stays valid and still resolves.

3. Replace every `image: mcr.microsoft.com/playwright:v<old>-noble@sha256:<old>`
   line with the new tag and digest in both
   `.github/workflows/ci.yml` and `.github/workflows/synthetic-probes.yml`.
   `grep -rn "mcr.microsoft.com/playwright" .github/workflows` lists them.

4. Check the pins:

   ```bash
   npx vitest run __tests__/ci-toolchain-pinning.test.ts
   ```

5. Refresh the dependency credits, which read the lockfile:

   ```bash
   npm run oss:credits
   ```

   Commit `lib/oss-credits/internal/credits.generated.json` if it changed. Dev-only
   bundled entries (a wasm package's own dependencies, which Dependabot's npm
   records with no `resolved` URL or integrity) are skipped, so they no
   longer need a manual fix. A shipped entry without them still fails. See
   [Manage dependency licenses](manage-dependency-licenses.md).

## Cloud sessions

Cloud sessions run Playwright against the Chromium preinstalled in the
container, not the image. See
[Set up Claude cloud sessions](set-up-claude-cloud-sessions.md).
