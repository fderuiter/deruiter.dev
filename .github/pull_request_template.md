## Summary

<!-- What changed, and why? -->

## Target branch

- [ ] Normal topic or hotfix PR into `main` (squash merge)

## Verification

- [ ] `npm run quality`
- [ ] `npm test`
- [ ] Generated documentation is synchronized when public contracts changed
- [ ] Runtime-impact declaration: I checked the actual diff (e.g.
      `git diff main... -- app components public app/globals.css`), not just
      my intent, for changes to rendered paths (`app/**`, `components/**`,
      `public/**`, `app/globals.css`) or visual snapshots
      (`__tests__/**/*-snapshots/**`). If that diff is non-empty, an
      operator-requested Vercel preview was checked and is linked below; if
      it is empty, state that explicitly instead of "no runtime code paths
      change"
- [ ] No production or shared-provider credentials were added to the repository
- [ ] `npm run audit:secrets` passes when history or public visibility is in scope

## Review notes

- **Files and symbols:** <!-- Exact review targets -->
- **Invariant boundaries:** Non-destructive Git operations; Vercel Hobby quota;
  environment-scoped credentials; no direct push to `main`.
- **Verification commands:** `npm run quality`, `npm test`,
  `npm run check-docs-drift`.
