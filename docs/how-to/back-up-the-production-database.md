# Back Up the Production Database

Governing issue: [#3036](https://github.com/fderuiter/deruiter.dev/issues/3036).

Neon's free plan keeps six hours of point-in-time history and no snapshots
([restore runbook](restore-the-production-database.md)). An incident found the
next morning cannot be recovered from Neon alone. The `Neon Backup` workflow
(`.github/workflows/neon-backup.yml`) closes that gap with a weekly logical
backup.

## How it works

- **When:** scheduled every Sunday at 23:00 UTC, two hours before the
  weekly release train. It can also be run by hand from Actions → Neon
  Backup → Run workflow. The schedule can slip: GitHub can [delay or drop scheduled runs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
  and the train does not check that a backup ran or succeeded. Before a
  release that needs a restore point, check one exists (see
  [Check backup readiness before a release](#check-backup-readiness-before-a-release)).
- **What:** `pg_dump --format=custom` of the `public` schema (all application
  tables and `_prisma_migrations`), using Postgres 17 to match Neon. The job
  fails if `pg_restore --list` finds no table data.
- **Where:** a workflow artifact kept for 90 days, at no cost on a public
  repository. It stays in GitHub Actions and adds no Vercel compute.
- **Protection:** the dump is encrypted with [age](https://age-encryption.org)
  to a public key before upload, and the plaintext is shredded on the runner.
  Artifacts of a public repository can be downloaded by any signed-in GitHub
  user, so only ciphertext ever leaves the runner. The private key stays with
  the owner and never touches GitHub.

## Set up (once)

For interactive, read-only guidance and GitHub metadata checks, run
`scripts/setup-operator-wizard.sh backup` from the repository. The guide does
not write credentials or dispatch a workflow; follow the steps below to do so.

1. Make a key pair on your own computer and keep the private key safe (a
   password manager works):

   ```bash
   age-keygen -o deruiter-backup-key.txt
   ```

   The file's `# public key:` line is the recipient.

2. Add the repository **variable** `BACKUP_AGE_RECIPIENT` with that `age1…`
   public key (Settings → Secrets and variables → Actions → Variables).

3. Create the read-only `backup_reader` role from SQL, as `neondb_owner` in
   the Neon SQL Editor, with a fresh random password
   (`openssl rand -base64 32`). Creating it from SQL rather than the console
   keeps it out of `neon_superuser`:

   ```sql
   CREATE ROLE backup_reader WITH LOGIN PASSWORD '<generated>';
   GRANT USAGE ON SCHEMA public TO backup_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_reader;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_reader;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT SELECT ON TABLES TO backup_reader;
   ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
     GRANT SELECT ON SEQUENCES TO backup_reader;
   ```

4. Add the repository **secret** `NEON_BACKUP_DATABASE_URL`: the direct
   (unpooled) connection string, using the `PGHOST_UNPOOLED` host, with
   `backup_reader` and its password, plus `?sslmode=require`.

5. Run the workflow once by hand and check the job summary shows table data.

## Check backup readiness before a release

Three things are easy to confuse. Only the second gives you a restore point,
and only the third shows that it works.

| What you see | What it proves |
| --- | --- |
| A scheduled run in Actions → Neon Backup | Only that GitHub started the job. A run that fails at "Check configuration" leaves no backup. The runs on 2026-11-01 and 2026-11-08 both failed there, because the secret and variable were not set yet ([#3586](https://github.com/fderuiter/deruiter.dev/issues/3586), [#3587](https://github.com/fderuiter/deruiter.dev/issues/3587)). |
| A **successful** run with an unexpired `neon-backup-<stamp>` artifact | An encrypted dump exists and `pg_restore --list` found table data in it. The recovery point is `<stamp>` (UTC), when the dump started. Data written after it is not in the dump. |
| A restore of that artifact into a new Neon branch | That the dump decrypts with the private key you hold and restores. No restore from this workflow's artifacts has been recorded yet. |

Before firing the train (or any release with a migration), check the second
row:

```bash
gh run list --repo fderuiter/deruiter.dev --workflow neon-backup.yml \
  --limit 5 --json createdAt,event,conclusion
gh api "repos/fderuiter/deruiter.dev/actions/artifacts?per_page=100" \
  --jq '.artifacts[] | select(.name | startswith("neon-backup-"))
        | {name, created_at, expired}'
```

The newest artifact should be unexpired and its stamp recent enough for the
release. If its run succeeded, the job summary also shows the number of
tables with data and the start of the ciphertext's SHA-256.

**If the latest run failed or there is no recent artifact:**

1. Open the failed run. A "Check configuration" error means the secret or
   variable is missing; finish [Set up](#set-up-once) first.
2. Run the workflow by hand (Actions → Neon Backup → Run workflow) and wait
   for it to succeed before you fire the train.
3. If it keeps failing, decide whether to release without a fresh restore
   point. Neon's six-hour history is then the only way back
   ([restore runbook](restore-the-production-database.md)), so prefer waiting
   for any release whose migration changes data.

To check the third row, restore the newest artifact into a new branch as
described in [Restore from a backup](#restore-from-a-backup), check the
fingerprints, and delete the branch. Doing this once after setup and after
each key rotation proves the key you hold matches `BACKUP_AGE_RECIPIENT`.

### Why the train does not require a backup

The train does not check for a backup, and adding that check is the
owner's decision rather than a documentation change. Points to weigh:

- A required backup would block every release while the setup above is
  incomplete, and whenever GitHub delays or drops the Sunday schedule.
- The check would have to accept a manual run as well as the scheduled one,
  and define how old a backup may be.
- A successful run proves the dump lists table data, not that it restores,
  so a gate would still not prove a tested restore.
- The backup runs in Actions on a public repository, so a check costs no
  Vercel or Neon quota. Each extra dump does wake the Neon compute once.

## Restore from a backup

1. Download the artifact from the run (Actions → Neon Backup → the run →
   Artifacts) and unzip it.
2. Decrypt it with the private key:

   ```bash
   age --decrypt --identity deruiter-backup-key.txt \
     --output neon.dump neon-<stamp>.dump.age
   ```

3. Restore into a **new Neon branch** first, never straight into
   production. Follow the inspect-first path in the
   [restore runbook](restore-the-production-database.md):

   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists \
     --dbname "<new branch direct connection string>" neon.dump
   ```

4. Verify the fingerprints from the restore runbook, then cut over as it
   describes.

## Rotate

- **Key:** make a new key pair, update `BACKUP_AGE_RECIPIENT`, and keep the
  old private key until every artifact encrypted to it has expired (90 days).
- **Password:** `ALTER ROLE backup_reader WITH PASSWORD '<new generated>';`,
  then update `NEON_BACKUP_DATABASE_URL`.
